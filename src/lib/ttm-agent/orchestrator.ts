import { createHash } from "crypto";
import { readFile as readFileBuffer } from "fs/promises";
import path from "path";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { assertS3Configured, buildPublicFileUrl, s3BucketName, s3Client } from "@/lib/s3";
import { mapLedgerRows } from "@/lib/ttm-agent/mapping";
import { parseAccountantStatementsDocument, parseAccountantStatementsPreparedDocument } from "@/lib/ttm-agent/parsers/accountant-statements";
import { parseArAgingWorkbook, parseArAgingWorkbookFromPrepared, parseMonthlyWorkbook, parseMonthlyWorkbookFromPrepared } from "@/lib/ttm-agent/parsers/excel";
import { buildDataQualityReport, flattenFlagsForPersistence } from "@/lib/ttm-agent/report-builder";
import { reconcileFinancials } from "@/lib/ttm-agent/reconciler";
import { REVENUE_CODES } from "@/lib/ttm-agent/taxonomy";
import {
  AgentDispatchTaskView,
  FlagResolutionAction,
  InputDocumentSnapshot,
  PreparedDocumentInput,
  TtmAnalysisView,
  TTM_REQUIRED_DOCUMENT_IDS,
  TtmReadinessItem,
  TtmRequiredDocumentId,
  Ws2DerivedAgentId,
  Ws2DerivedReportView,
  Ws2RecastAssumptions,
  Ws2RecastView,
} from "@/lib/ttm-agent/types";
import { generateWs22Report, generateWs23Report, generateWs24Report, generateWs25Report, summarizeTtmAnalysis } from "@/lib/ttm-agent/claude";
import { buildWorkingCapitalSummary } from "@/lib/ttm-agent/wc-calculator";
import { TTM_AGENT_MAX_TOKENS, TTM_AGENT_MODEL, TTM_AGENT_TEMPERATURE, WS2_RECAST_MAX_TOKENS } from "@/lib/ttm-agent/prompt";
import {
  applyWs22SpecCorrections,
  buildWs2WorkbookBuffer,
  extractWs2RecastFlagPayloads,
  extractWs2RecastMetrics,
  resolveWs2RecastMetrics,
} from "@/lib/ws2/report-utils";
import { buildBaselineValuationReport } from "@/lib/ws2/baseline-report";
import { buildStructuredWs2DerivedReport } from "@/lib/ws2/derived-report-structure";
import { buildWs21DeterministicReport } from "@/lib/ws2/ws21-report";
import { buildWS2ReportAdapter } from "@/lib/ttm-agent/export-adapter";
import {
  buildWorkbookOverrideSnapshot,
  diffWorkbookOverrideSnapshots,
  WorkbookOverrideSnapshot,
} from "@/lib/ttm-agent/workbook-overrides";
import { parseWorkbookOverrideSnapshotFromXlsx } from "@/lib/ttm-agent/workbook-overrides-xlsx";

const WS2_BASELINE_SOURCE_AGENT_IDS = [
  "ws2_3_rev_vertical_v1",
  "ws2_4_benchmark_v1",
  "ws2_5_labor_v1",
] as const;

class TtmOrchestratorError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

function hashInputSnapshot(snapshot: InputDocumentSnapshot[]) {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(snapshot));
  return hash.digest("hex");
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function mapFlag(flag: any) {
  return {
    ...flag,
    payload: (flag.payload ?? {}) as Record<string, unknown>,
    resolvedAt: flag.resolvedAt?.toISOString() ?? null,
    createdAt: flag.createdAt.toISOString(),
    updatedAt: flag.updatedAt.toISOString(),
  };
}

function mapDispatchTask(task: any): AgentDispatchTaskView {
  return {
    ...task,
    payload: (task.payload ?? null) as Record<string, unknown> | null,
    releasedAt: task.releasedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

function mapRecastFlag(flag: any) {
  return {
    ...flag,
    payload: (flag.payload ?? {}) as Record<string, unknown>,
    resolvedAt: flag.resolvedAt?.toISOString() ?? null,
    createdAt: flag.createdAt.toISOString(),
    updatedAt: flag.updatedAt.toISOString(),
  };
}

function mapRecastAnalysis(record: any): Ws2RecastView {
  return {
    ...record,
    assumptions: (record.assumptions ?? {}) as Ws2RecastView["assumptions"],
    parsedReport: (record.parsedReport ?? null) as Record<string, unknown> | null,
    reportMarkdown: record.reportMarkdown ?? null,
    workbookKey: record.workbookKey ?? null,
    workbookUrl: record.workbookUrl ?? null,
    normalizedEbitda: record.normalizedEbitda ?? null,
    valuationLow: record.valuationLow ?? null,
    valuationMid: record.valuationMid ?? null,
    valuationHigh: record.valuationHigh ?? null,
    errorMessage: record.errorMessage ?? null,
    approvedAt: record.approvedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    flags: (record.flags ?? []).map(mapRecastFlag),
  };
}

function mapDerivedReport(record: any): Ws2DerivedReportView {
  return {
    ...record,
    parsedReport: (record.parsedReport ?? null) as Record<string, unknown> | null,
    reportMarkdown: record.reportMarkdown ?? null,
    errorMessage: record.errorMessage ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function buildWs2FinancialModelPayload(analysis: TtmAnalysisView) {
  return {
    structuredModel: analysis.structuredModel,
    normalizedData: analysis.normalizedData,
    ttmSummary: analysis.ttmSummary,
    annualModel: analysis.annualModel,
    workingCapital: analysis.workingCapital,
    dataQualityReport: analysis.dataQualityReport,
    reportMarkdown: analysis.reportMarkdown,
  };
}

function calculateTtmRevenueFromMappedRows(
  mappedPlRows: Array<{
    cantaraCode: string | null;
    accountName: string;
    valuesByMonth: Record<string, number>;
  }>,
  monthKeys: string[],
) {
  const ttmMonths = monthKeys.slice(-12);
  const mappedRevenue = mappedPlRows
    .filter((row) => row.cantaraCode && REVENUE_CODES.includes(row.cantaraCode))
    .reduce((total, row) => total + ttmMonths.reduce((acc, month) => acc + (row.valuesByMonth[month] ?? 0), 0), 0);

  if (mappedRevenue !== 0) return mappedRevenue;

  return mappedPlRows
    .filter((row) => /revenue|sales|income/i.test(row.accountName))
    .reduce((total, row) => total + ttmMonths.reduce((acc, month) => acc + (row.valuesByMonth[month] ?? 0), 0), 0);
}

function hasAllBaselineSourceReportsComplete(
  analysis: Pick<TtmAnalysisView, "derivedReports"> | null | undefined,
) {
  return WS2_BASELINE_SOURCE_AGENT_IDS.every((agentId) =>
    (analysis?.derivedReports ?? []).some((report) => report.agentId === agentId && report.status === "COMPLETE"),
  );
}

async function getClientDisplayName(clientId: string) {
  const client = await (prisma as any).clientProfile.findUnique({
    where: { id: clientId },
    include: { User: true },
  });

  return client?.businessName || client?.User?.name || clientId;
}

async function upsertWs210BaselineReport(args: {
  analysisId: string;
  approvedRecast: Ws2RecastView;
}) {
  const analysis = await getTtmAnalysis(args.analysisId);
  if (!analysis) {
    throw new TtmOrchestratorError("WS2-1 analysis not found while building WS2-10.", 404);
  }

  if (analysis.status !== "APPROVED" || args.approvedRecast.status !== "APPROVED") {
    throw new TtmOrchestratorError("WS2-10 requires approved WS2-1 and WS2-2 outputs.", 400);
  }

  const ws23 = analysis.derivedReports?.find((report) => report.agentId === "ws2_3_rev_vertical_v1") ?? null;
  const ws24 = analysis.derivedReports?.find((report) => report.agentId === "ws2_4_benchmark_v1") ?? null;
  const ws25 = analysis.derivedReports?.find((report) => report.agentId === "ws2_5_labor_v1") ?? null;

  if (ws23?.status !== "COMPLETE" || ws24?.status !== "COMPLETE" || ws25?.status !== "COMPLETE") {
    throw new TtmOrchestratorError("WS2-10 requires completed WS2-3, WS2-4, and WS2-5 reports.", 400);
  }

  const clientName = await getClientDisplayName(analysis.clientId);
  const { reportMarkdown, parsedReport } = buildBaselineValuationReport({
    clientName,
    analysis,
    recast: args.approvedRecast,
    ws23,
    ws24,
    ws25,
  });

  await (prisma as any).ws2DerivedReport.upsert({
    where: {
      ttmAnalysisId_agentId: {
        ttmAnalysisId: args.analysisId,
        agentId: "ws2_10_report_generator_v1",
      },
    },
    update: {
      status: "COMPLETE",
      reportMarkdown,
      parsedReport,
      recastAnalysisId: args.approvedRecast.id,
      errorMessage: null,
    },
    create: {
      clientId: analysis.clientId,
      ttmAnalysisId: args.analysisId,
      recastAnalysisId: args.approvedRecast.id,
      agentId: "ws2_10_report_generator_v1",
      status: "COMPLETE",
      reportMarkdown,
      parsedReport,
    },
  });
}

export function mapTtmAnalysisForFrontend(record: any): TtmAnalysisView {
  return {
    ...record,
    inputSnapshot: (record.inputSnapshot ?? []) as InputDocumentSnapshot[],
    normalizedData: (record.normalizedData ?? null) as Record<string, unknown> | null,
    structuredModel: record.structuredModel ?? null,
    ttmSummary: record.ttmSummary ?? null,
    annualModel: record.annualModel ?? null,
    workingCapital: record.workingCapital ?? null,
    dataQualityReport: record.dataQualityReport ?? null,
    summary: record.summary ?? null,
    reportMarkdown: record.reportMarkdown ?? null,
    errorMessage: record.errorMessage ?? null,
    approvedAt: record.approvedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    flags: (record.flags ?? []).map(mapFlag),
    dispatchTasks: (record.dispatchTasks ?? []).map(mapDispatchTask),
    recastAnalyses: (record.recastAnalyses ?? []).map(mapRecastAnalysis),
    derivedReports: (record.derivedReports ?? []).map(mapDerivedReport),
  };
}

async function loadLatestInputDocuments(clientId: string) {
  const rows = await (prisma as any).clientDocument.findMany({
    where: {
      clientId,
      documentId: { in: [...TTM_REQUIRED_DOCUMENT_IDS] },
    },
    orderBy: { createdAt: "desc" },
  });

  const latestByDocumentId = new Map<string, any>();
  for (const row of rows) {
    if (row.documentId && !latestByDocumentId.has(row.documentId)) {
      latestByDocumentId.set(row.documentId, row);
    }
  }

  const missing = TTM_REQUIRED_DOCUMENT_IDS.filter((documentId) => !latestByDocumentId.has(documentId));
  if (missing.length) {
    throw new TtmOrchestratorError(`Missing required valuation documents: ${missing.join(", ")}`);
  }

  return TTM_REQUIRED_DOCUMENT_IDS.map((documentId) => latestByDocumentId.get(documentId));
}

function buildPreparedDocumentMap(preparedDocuments: PreparedDocumentInput[]) {
  return new Map(preparedDocuments.map((document) => [document.documentId, document]));
}

function ensurePreparedDocument(
  preparedMap: Map<string, PreparedDocumentInput>,
  documentId: TtmRequiredDocumentId,
  fallbackMeta: { fileName: string; mimeType: string; size: number },
) {
  const prepared = preparedMap.get(documentId);
  if (!prepared) {
    throw new TtmOrchestratorError(`Prepared document payload missing for ${documentId} (${fallbackMeta.fileName}).`);
  }
  return {
    ...prepared,
    fileName: prepared.fileName || fallbackMeta.fileName,
    mimeType: prepared.mimeType || fallbackMeta.mimeType || "application/octet-stream",
    size: prepared.size || fallbackMeta.size || 0,
  } satisfies PreparedDocumentInput;
}

async function safeReadDocumentBuffer(localPath: string | null | undefined) {
  if (!localPath) return null;
  const resolvedPath = path.isAbsolute(localPath) ? localPath : path.resolve(process.cwd(), localPath);
  try {
    return await readFileBuffer(resolvedPath);
  } catch {
    // fall through to S3 fetch
  }

  try {
    assertS3Configured();
    const result = await s3Client.send(
      new GetObjectCommand({
        Bucket: s3BucketName,
        Key: localPath,
      }),
    );

    if (!result.Body) return null;
    if (typeof (result.Body as any).transformToByteArray === "function") {
      const bytes = await (result.Body as any).transformToByteArray();
      return Buffer.from(bytes);
    }
    const response = new Response(result.Body as any);
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

function formatAccountantPreparedText(preparedAccountant: PreparedDocumentInput, accountantStatements: Awaited<ReturnType<typeof parseAccountantStatementsPreparedDocument>>) {
  if (preparedAccountant.textBlocks?.length) {
    return preparedAccountant.textBlocks
      .map((block) => `--- SHEET: ${block.sheetName} ---\n${block.text}`)
      .join("\n\n");
  }

  return [
    `Source format: PDF`,
    ...accountantStatements.years.map(
      (year) =>
        `${year.fiscalYear}: Revenue=${year.revenue ?? "n/a"} | COGS=${year.cogs ?? "n/a"} | Gross Profit=${year.grossProfit ?? "n/a"} | OpEx=${year.opEx ?? "n/a"} | Net Income=${year.netIncome ?? "n/a"}`,
    ),
  ].join("\n");
}

function buildWs21PromptContent(args: {
  monthlyPl: PreparedDocumentInput;
  monthlyBs: PreparedDocumentInput;
  accountant: PreparedDocumentInput;
  accountantStatements: Awaited<ReturnType<typeof parseAccountantStatementsPreparedDocument>>;
  arAging: PreparedDocumentInput;
}) {
  // V3 Section 4.3: The client-side conversion already adds === INPUT FILE: === headers
  // and === SHEET: === separators. We pass the text blocks through directly.
  const plText = (args.monthlyPl.textBlocks ?? [])
    .map((block) => block.text)
    .join("\n\n");
  const bsText = (args.monthlyBs.textBlocks ?? [])
    .map((block) => block.text)
    .join("\n\n");
  const accountantText = formatAccountantPreparedText(args.accountant, args.accountantStatements);
  const arText = (args.arAging.textBlocks ?? [])
    .map((block) => block.text)
    .join("\n\n");

  // V3 Section 4.3: buildWS21MessageContent exact format
  return [
    { type: "text" as const, text: plText || `=== INPUT FILE: Monthly P&L — 3 Fiscal Years ===\nNo P&L data available.` },
    { type: "text" as const, text: bsText || `=== INPUT FILE: Monthly Balance Sheet — 3 Fiscal Years ===\nNo balance sheet data available.` },
    { type: "text" as const, text: accountantText.startsWith("===") ? accountantText : `=== INPUT FILE: Accountant-Prepared Financial Statements — 3 Fiscal Years ===\n${accountantText}` },
    { type: "text" as const, text: arText.startsWith("===") ? arText : `=== INPUT FILE: Accounts Receivable Aging Detail ===\n${arText}` },
    { type: "text" as const, text: "Please analyze the above financial data and produce the TTM Financial Analysis Report as specified in your instructions." },
  ];
}

export async function getTtmReadiness(clientId: string): Promise<TtmReadinessItem[]> {
  const statuses = (await (prisma as any).clientDocumentStatus.findMany({
    where: {
      clientId,
      documentId: { in: [...TTM_REQUIRED_DOCUMENT_IDS] },
    },
  })) as Array<{ documentId: string; fileName: string | null; uploadedAt: Date | null }>;

  const byId = new Map(statuses.map((status: any) => [status.documentId, status]));
  const labels: Record<TtmRequiredDocumentId, string> = {
    monthly_pl_excel: "Monthly P&L Excel",
    monthly_bs_excel: "Monthly Balance Sheet Excel",
    accountant_statements: "Accountant Statements",
    ar_aging_detail: "AR Aging Detail",
  };

  return TTM_REQUIRED_DOCUMENT_IDS.map((documentId) => {
    const status = byId.get(documentId);
    return {
      documentId,
      label: labels[documentId],
      uploaded: Boolean(status?.fileName),
      fileName: status?.fileName ?? null,
      uploadedAt: status?.uploadedAt?.toISOString() ?? null,
    };
  });
}

export async function listTtmAnalyses(clientId: string) {
  const records = await (prisma as any).ttmAnalysis.findMany({
    where: { clientId },
    include: {
      flags: { orderBy: [{ section: "asc" }, { createdAt: "asc" }] },
      dispatchTasks: { orderBy: { createdAt: "asc" } },
      recastAnalyses: {
        include: { flags: { orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "desc" },
      },
      derivedReports: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return records.map(mapTtmAnalysisForFrontend);
}

export async function getTtmAnalysis(id: string) {
  const record = await (prisma as any).ttmAnalysis.findUnique({
    where: { id },
    include: {
      flags: { orderBy: [{ section: "asc" }, { createdAt: "asc" }] },
      dispatchTasks: { orderBy: { createdAt: "asc" } },
      recastAnalyses: {
        include: { flags: { orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "desc" },
      },
      derivedReports: { orderBy: { createdAt: "desc" } },
    },
  });

  return record ? mapTtmAnalysisForFrontend(record) : null;
}

export async function runTtmAgent(args: {
  clientId: string;
  triggeredByName?: string;
  preparedDocuments: PreparedDocumentInput[];
}) {
  console.log(`[TTM] ▶ Starting WS2-1 agent for client=${args.clientId} triggered by ${args.triggeredByName ?? "system"}`);
  const inputDocuments = await loadLatestInputDocuments(args.clientId);
  const inputSnapshot: InputDocumentSnapshot[] = inputDocuments.map((document: any) => ({
    documentId: document.documentId,
    fileName: document.fileName,
    mimeType: document.mimeType,
    size: document.size,
    localPath: document.localPath,
    createdAt: document.createdAt.toISOString(),
  }));

  const previous = await (prisma as any).ttmAnalysis.findFirst({
    where: { clientId: args.clientId },
    orderBy: { version: "desc" },
  });

  const created = await (prisma as any).ttmAnalysis.create({
    data: {
      clientId: args.clientId,
      version: (previous?.version ?? 0) + 1,
      status: "RUNNING",
      hitlStatus: "PENDING_REVIEW",
      inputFingerprint: hashInputSnapshot(inputSnapshot),
      model: TTM_AGENT_MODEL,
      temperature: TTM_AGENT_TEMPERATURE,
      maxTokens: TTM_AGENT_MAX_TOKENS,
      inputSnapshot,
    },
  });

  try {
    const preparedMap = buildPreparedDocumentMap(args.preparedDocuments ?? []);
    const [monthlyPlDocument, monthlyBsDocument, accountantDocument, arAgingDocument] = inputDocuments;

    const preparedMonthlyPl = ensurePreparedDocument(preparedMap, "monthly_pl_excel", monthlyPlDocument);
    const preparedMonthlyBs = ensurePreparedDocument(preparedMap, "monthly_bs_excel", monthlyBsDocument);
    const preparedAccountant = ensurePreparedDocument(preparedMap, "accountant_statements", accountantDocument);
    const preparedArAging = ensurePreparedDocument(preparedMap, "ar_aging_detail", arAgingDocument);

    const monthlyPlBuffer = await safeReadDocumentBuffer(monthlyPlDocument.localPath);
    const monthlyBsBuffer = await safeReadDocumentBuffer(monthlyBsDocument.localPath);
    const accountantBuffer = await safeReadDocumentBuffer(accountantDocument.localPath);
    const arAgingBuffer = await safeReadDocumentBuffer(arAgingDocument.localPath);

    const monthlyPl = monthlyPlBuffer
      ? parseMonthlyWorkbook(monthlyPlBuffer, "monthly_pl_excel")
      : parseMonthlyWorkbookFromPrepared(preparedMonthlyPl, "monthly_pl_excel");
    console.log(`[TTM] Parsed monthly P&L: format=${monthlyPl.format}, ${monthlyPl.rows.length} rows, ${monthlyPl.monthKeys.length} months, source=${monthlyPlBuffer ? "xlsx-direct" : "prepared-csv"}`);

    const monthlyBs = monthlyBsBuffer
      ? parseMonthlyWorkbook(monthlyBsBuffer, "monthly_bs_excel")
      : parseMonthlyWorkbookFromPrepared(preparedMonthlyBs, "monthly_bs_excel");
    console.log(`[TTM] Parsed monthly BS: format=${monthlyBs.format}, ${monthlyBs.rows.length} rows, ${monthlyBs.monthKeys.length} months, source=${monthlyBsBuffer ? "xlsx-direct" : "prepared-csv"}`);

    const accountantStatements = accountantBuffer
      ? await parseAccountantStatementsDocument({
          fileName: accountantDocument.fileName,
          mimeType: accountantDocument.mimeType,
          buffer: accountantBuffer,
        })
      : await parseAccountantStatementsPreparedDocument(preparedAccountant);
    console.log(`[TTM] Parsed accountant statements: ${accountantStatements.years.length} fiscal years, source=${accountantStatements.sourceType}${accountantBuffer ? " (xlsx/pdf direct)" : " (prepared)"}`);

    const arAging = arAgingBuffer
      ? parseArAgingWorkbook(arAgingBuffer)
      : parseArAgingWorkbookFromPrepared(preparedArAging);
    console.log(`[TTM] Parsed AR aging: ${arAging.entries.length} customer entries, source=${arAgingBuffer ? "xlsx-direct" : "prepared-csv"}`);

    // V3 Section 10: Fewer than 24 months → proceed but flag PARTIAL DATA
    const isPartialData = monthlyPl.monthKeys.length < 24;
    if (isPartialData) {
      console.warn(`[TTM] ⚠ PARTIAL DATA: Only ${monthlyPl.monthKeys.length} months available (< 24). All outputs will be labeled PARTIAL DATA.`);
    }

    const [mappedPlRows, mappedBsRows] = await Promise.all([
      mapLedgerRows(monthlyPl.rows, "pl"),
      mapLedgerRows(monthlyBs.rows, "bs"),
    ]);
    const unmappedPl = mappedPlRows.filter((row) => !row.cantaraCode).length;
    const unmappedBs = mappedBsRows.filter((row) => !row.cantaraCode).length;
    console.log(`[TTM] GL mapping: P&L ${mappedPlRows.length} rows (${unmappedPl} unmapped), BS ${mappedBsRows.length} rows (${unmappedBs} unmapped)`);

    // V3 Section 10: TTM has revenue = $0 → critical data error
    const ttmRevenue = calculateTtmRevenueFromMappedRows(mappedPlRows, monthlyPl.monthKeys);
    if (ttmRevenue === 0 && monthlyPl.rows.length > 0) {
      throw new TtmOrchestratorError(
        "Critical data error: TTM period has zero revenue across all revenue lines. Cannot proceed without Admin input. Please verify the uploaded P&L file contains the correct 36-month data.",
        400,
      );
    }

    const reconciled = reconcileFinancials({
      monthlyPl,
      monthlyBs,
      mappedPlRows,
      mappedBsRows,
      accountantStatements,
    });

    const wcResult = buildWorkingCapitalSummary({
      mappedBalanceSheetRows: mappedBsRows,
      balanceSheetMonths: monthlyBs.monthKeys,
      arAging,
    });

    reconciled.dataQualitySections.E.push(...wcResult.qualityItems);
    const dataQualityReport = buildDataQualityReport(reconciled.dataQualitySections);

    console.log(`[TTM] Generating Admin summary`);
    const summary = await summarizeTtmAnalysis({
      ttmSummary: reconciled.ttmSummary,
      annualTrends: reconciled.annualModel.trends,
      anomalies: reconciled.annualModel.anomalies,
      qualityCounts: dataQualityReport.counts,
      workingCapital: wcResult.workingCapital,
      quickBooksStatus: "Skipped - QuickBooks not connected",
    });

    console.log(`[TTM] Building deterministic WS2-1 report from structured outputs`);
    const reportMarkdown = buildWs21DeterministicReport({
      structuredModelConfidence: reconciled.structuredModel.confidence,
      mappedPlRows,
      mappedBsRows,
      ttmSummary: reconciled.ttmSummary,
      annualModel: reconciled.annualModel,
      workingCapital: wcResult.workingCapital,
      dataQualityReport,
      summary,
    });

    const partialDataLabel =
      typeof reconciled.normalizedData?.partialDataLabel === "string" ? reconciled.normalizedData.partialDataLabel : null;
    const labeledReportMarkdown = partialDataLabel
      ? `> ${partialDataLabel}: fewer than 24 months were provided. Interpret all WS2-1 outputs with caution.\n\n${reportMarkdown}`
      : reportMarkdown;
    const labeledSummary = partialDataLabel
      ? {
          ...summary,
          overview: `${partialDataLabel} — ${summary.overview}`,
          qualitySummary: `${summary.qualitySummary} All outputs in this run are labeled ${partialDataLabel}.`.trim(),
        }
      : summary;

    const flattenedFlags = flattenFlagsForPersistence(reconciled.dataQualitySections);

    const saved = await (prisma as any).$transaction(async (tx: any) => {
      await tx.ttmAnalysis.update({
        where: { id: created.id },
        data: {
          status: "HITL_PENDING",
          hitlStatus: "PENDING_REVIEW",
          normalizedData: {
            ...(reconciled.normalizedData ?? {}),
            sourceNotes: {
              monthlyPl: monthlyPl.notes,
              monthlyBs: monthlyBs.notes,
              accountantStatements: accountantStatements.notes,
              arAging: arAging.notes,
            },
          },
          structuredModel: reconciled.structuredModel,
          ttmSummary: reconciled.ttmSummary,
          annualModel: reconciled.annualModel,
          workingCapital: wcResult.workingCapital,
          dataQualityReport,
          summary: labeledSummary,
          reportMarkdown: labeledReportMarkdown,
          errorMessage: null,
        },
      });

      if (flattenedFlags.length) {
        await tx.ttmFlag.createMany({
          data: flattenedFlags.map((flag) => ({
            analysisId: created.id,
            section: flag.section,
            severity: flag.severity,
            title: flag.title,
            description: flag.description,
            payload: flag.payload,
          })),
        });
      }

      await tx.agentDispatchTask.createMany({
        data: [
          {
            analysisId: created.id,
            clientId: args.clientId,
            agentId: "ws2_2_recast_v1",
            status: "BLOCKED_HITL",
            payload: { reason: "Awaiting Admin WS2-1 approval" },
          },
          {
            analysisId: created.id,
            clientId: args.clientId,
            agentId: "ws2_3_rev_vertical_v1",
            status: "BLOCKED_HITL",
            payload: { reason: "Awaiting Admin WS2-1 approval" },
          },
          {
            analysisId: created.id,
            clientId: args.clientId,
            agentId: "ws2_4_benchmark_v1",
            status: "BLOCKED_HITL",
            payload: { reason: "Awaiting Admin WS2-1 approval" },
          },
          // V3 Section 9: WS2-5 runs in parallel after WS2-1 (uses WS2-2 if available)
          {
            analysisId: created.id,
            clientId: args.clientId,
            agentId: "ws2_5_labor_v1",
            status: "BLOCKED_HITL",
            payload: { reason: "Awaiting Admin WS2-1 approval and completed WS2-2 recast" },
          },
          {
            analysisId: created.id,
            clientId: args.clientId,
            agentId: "ws2_8_seller_net_proceeds_v1",
            status: "BLOCKED_HITL",
            payload: { reason: "Awaiting approved WS2-2 recast" },
          },
          {
            analysisId: created.id,
            clientId: args.clientId,
            agentId: "ws2_10_report_generator_v1",
            status: "BLOCKED_HITL",
            payload: { reason: "Awaiting approved WS2-2 recast and completed WS2-3/WS2-4/WS2-5 reports" },
          },
        ],
      });

      return tx.ttmAnalysis.findUnique({
        where: { id: created.id },
        include: {
          flags: { orderBy: [{ section: "asc" }, { createdAt: "asc" }] },
          dispatchTasks: { orderBy: { createdAt: "asc" } },
          recastAnalyses: {
            include: { flags: { orderBy: { createdAt: "asc" } } },
            orderBy: { createdAt: "desc" },
          },
          derivedReports: { orderBy: { createdAt: "desc" } },
        },
      });
    });

    const result = mapTtmAnalysisForFrontend(saved);
    console.log(`[TTM] ✓ Complete: id=${created.id}, v${result.version}, ${result.flags.length} flags, status=${result.status}`);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown WS2-1 orchestration error";
    console.error(`[TTM] ✗ Failed: ${message}`);
    await (prisma as any).ttmAnalysis.update({
      where: { id: created.id },
      data: {
        status: "FAILED",
        errorMessage: message,
      },
    });
    throw error;
  }
}

export async function actionTtmFlag(args: {
  analysisId: string;
  flagId: string;
  action: FlagResolutionAction;
  notes?: string;
  actorName?: string;
  payloadPatch?: Record<string, unknown>;
}) {
  const flag = await (prisma as any).ttmFlag.findUnique({
    where: { id: args.flagId },
    include: { analysis: true },
  });

  if (!flag || flag.analysisId !== args.analysisId) {
    throw new TtmOrchestratorError("TTM flag not found.", 404);
  }

  const actorName = args.actorName || "Admin Pollack";
  let escalatedRequirementId: string | null = flag.escalatedRequirementId ?? null;

  if (args.action === "ESCALATE_CLIENT" && !escalatedRequirementId) {
    const priority = flag.severity === "HIGH" ? "HIGH" : flag.severity === "MEDIUM" ? "MEDIUM" : "LOW";
    const requirement = await prisma.additionalRequirement.create({
      data: {
        clientId: flag.analysis.clientId,
        title: `TTM Follow-up: ${flag.title}`,
        description: args.notes || flag.description || "Admin requested client follow-up on a TTM data-quality item.",
        question: flag.description || flag.title,
        requestUpload: true,
        sourceDocumentId: "ttm_agent",
        sourceDocumentName: `TTM Agent Section ${flag.section}`,
        sourceUploadedFileName: null,
        priority,
        status: "OPEN",
      },
    });
    escalatedRequirementId = requirement.id;
  }

  const mergedPayload = {
    ...(flag.payload ?? {}),
    ...(args.payloadPatch ?? {}),
  };

  await (prisma as any).$transaction([
    (prisma as any).ttmFlag.update({
      where: { id: args.flagId },
      data: {
        resolutionStatus: "ACTIONED",
        resolutionAction: args.action,
        resolutionNotes: args.notes ?? null,
        escalatedRequirementId,
        payload: mergedPayload,
        resolvedAt: new Date(),
        resolvedByName: actorName,
      },
    }),
    (prisma as any).ttmAnalysis.update({
      where: { id: args.analysisId },
      data: {
        hitlStatus: "IN_REVIEW",
      },
    }),
  ]);

  const updated = await getTtmAnalysis(args.analysisId);
  if (!updated) {
    throw new TtmOrchestratorError("TTM analysis not found after flag update.", 404);
  }
  return updated;
}

export async function approveTtmAnalysis(args: { analysisId: string; actorName?: string }) {
  const analysis = await (prisma as any).ttmAnalysis.findUnique({
    where: { id: args.analysisId },
    include: { flags: true, dispatchTasks: true },
  });

  if (!analysis) {
    throw new TtmOrchestratorError("TTM analysis not found.", 404);
  }

  const unresolvedFlags = analysis.flags.filter((flag: any) => flag.resolutionStatus !== "ACTIONED");
  if (unresolvedFlags.length) {
    throw new TtmOrchestratorError("All TTM flags must have a resolution action before approval.", 400);
  }

  const actorName = args.actorName || "Admin Pollack";
  await (prisma as any).$transaction([
    (prisma as any).ttmAnalysis.update({
      where: { id: args.analysisId },
      data: {
        status: "APPROVED",
        hitlStatus: "APPROVED",
        approvedAt: new Date(),
        approvedByName: actorName,
      },
    }),
    // V3 Section 9: WS2-3 and WS2-4 release after WS2-1 approval.
    // WS2-2 also releases here so Admin can enter the valuation inputs and run it.
    // WS2-5 releases when WS2-2 completes because it depends on the recast output.
    (prisma as any).agentDispatchTask.updateMany({
      where: {
        analysisId: args.analysisId,
        agentId: { in: ["ws2_2_recast_v1", "ws2_3_rev_vertical_v1", "ws2_4_benchmark_v1"] },
      },
      data: {
        status: "RELEASED",
        releasedAt: new Date(),
      },
    }),
  ]);

  const updated = await getTtmAnalysis(args.analysisId);
  if (!updated) {
    throw new TtmOrchestratorError("TTM analysis not found after approval.", 404);
  }
  return updated;
}

function preparedDocumentToText(preparedDocument: PreparedDocumentInput | undefined, emptyMessage: string) {
  if (!preparedDocument) return emptyMessage;
  if (preparedDocument.textBlocks?.length) {
    return preparedDocument.textBlocks.map((block) => `--- SHEET: ${block.sheetName} ---\n${block.text}`).join("\n\n");
  }
  if (preparedDocument.base64 && preparedDocument.mimeType.includes("pdf")) {
    return `Source file: ${preparedDocument.fileName} (PDF attached separately if applicable).`;
  }
  return emptyMessage;
}

function buildWs22PromptContent(args: {
  analysis: TtmAnalysisView;
  assumptions: Ws2RecastAssumptions;
  preparedDocuments: PreparedDocumentInput[];
}) {
  const preparedMap = buildPreparedDocumentMap(args.preparedDocuments);

  // V3: Single consolidated File 5 — Add-Back Disclosure
  const addbackDisclosure = preparedMap.get("addback_disclosure");

  // V2 fallback: separate documents
  const shareholder = preparedMap.get("shareholder_remuneration_36m");
  const personal = preparedMap.get("personal_expenses_36m");
  const nonRecurring = preparedMap.get("non_recurring_expenses_36m");
  const tenantImprovements = preparedMap.get("tenant_improvements_36m");

  const lease = preparedMap.get("leases");
  const ownerAssessment = preparedMap.get("owner_gm_assessment");

  const content: Array<
    | { type: "text"; text: string }
    | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } }
  > = [
    {
      type: "text",
      text: `=== WS2-1 STRUCTURED OUTPUT (36-MONTH FINANCIAL MODEL WITH GL MAPPING) ===\n${JSON.stringify(buildWs2FinancialModelPayload(args.analysis), null, 2)}`,
    },
  ];

  if (addbackDisclosure) {
    // V3 path: single consolidated file
    content.push({
      type: "text",
      text: `=== INPUT FILE: Seller Add-Back Disclosure (Items 2.1–2.5 and 3.2) ===\n${preparedDocumentToText(addbackDisclosure, "No add-back disclosure document provided.")}`,
    });
  } else {
    // V2 fallback: separate files
    content.push(
      {
        type: "text",
        text: `=== SELLER ADD-BACK LIST ITEM 5: SHAREHOLDER REMUNERATION ===\n${preparedDocumentToText(shareholder, "No shareholder remuneration document provided.")}`,
      },
      {
        type: "text",
        text: `=== SELLER ADD-BACK LIST ITEM 6: PERSONAL EXPENSES ===\n${preparedDocumentToText(personal, "No personal expense document provided.")}`,
      },
      {
        type: "text",
        text: `=== SELLER ADD-BACK LIST ITEM 7: NON-RECURRING EXPENSES ===\n${preparedDocumentToText(nonRecurring, "No non-recurring expense document provided.")}`,
      },
      {
        type: "text",
        text: `=== SELLER ADD-BACK LIST ITEM 8: TENANT IMPROVEMENTS ===\n${preparedDocumentToText(tenantImprovements, "No tenant improvement document provided.")}`,
      },
    );
  }

  content.push({
    type: "text",
    text: `=== ADMIN INPUTS ===\n${JSON.stringify(args.assumptions, null, 2)}`,
  });

  content.push({
    type: "text",
    text: `=== OWNER & GM ASSESSMENT FROM WS1 ===\n${preparedDocumentToText(ownerAssessment, "No owner and GM assessment provided.")}`,
  });

  if (lease?.base64 && lease.mimeType.includes("pdf")) {
    content.push({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: lease.base64,
      },
    });
    content.push({
      type: "text",
      text: `=== LEASE FROM WS1 ===\nAttached PDF: ${lease.fileName}`,
    });
  } else {
    content.push({
      type: "text",
      text: `=== LEASE FROM WS1 ===\n${preparedDocumentToText(lease, "No lease PDF provided.")}`,
    });
  }

  content.push({
    type: "text",
    text: "Please perform the EBITDA recast as specified in your instructions using the financial model and add-back disclosure above.",
  });

  return content;
}

function buildWs2DerivedPromptPayload(analysis: TtmAnalysisView, recast: Ws2RecastView | null) {
  const getCategoryValue = (
    rows: Array<{ code?: string; value?: number }> | undefined | null,
    codes: string[],
  ) => rows?.reduce((sum, row) => sum + (codes.includes(row.code ?? "") ? row.value ?? 0 : 0), 0) ?? 0;

  const benchmarkGroups = [
    { key: "cogs", label: "COGS", codes: ["COGS-SUPPLY", "COGS-RETAIL", "COGS-OTHER"], low: 0, high: 5 },
    { key: "marketing", label: "Marketing", codes: ["OPX-MKTG"], low: 3, high: 5 },
    { key: "directLabor", label: "Direct Labor", codes: ["OPX-LABOR-STAFF", "OPX-LABOR-MGMT"], low: 35, high: 45 },
    { key: "payrollTaxesBenefits", label: "Payroll Taxes & Benefits", codes: ["OPX-LABOR-TAX"], low: 2, high: 5 },
    { key: "buildingRent", label: "Building Rent", codes: ["OPX-RENT", "OPX-RENT-NNN"], low: 10, high: 15 },
    { key: "otherBuilding", label: "Other Building", codes: ["OPX-UTIL", "OPX-REPAIR"], low: 3, high: 5 },
    { key: "businessOperations", label: "Business Operations", codes: ["OPX-SOFT", "OPX-INSUR", "OPX-BANK", "OPX-PROF"], low: 7, high: 12 },
    { key: "other", label: "Other", codes: ["OPX-MEALS", "OPX-TRAVEL", "OPX-DONAT", "OPX-GIFTS", "OPX-VET", "OPX-OTHER"], low: null, high: null },
  ] as const;

  const buildPeriodBenchmark = (
    periodLabel: string,
    revenue: number,
    cogsRows: Array<{ code?: string; value?: number }> | undefined | null,
    opExRows: Array<{ code?: string; value?: number }> | undefined | null,
  ) => ({
    periodLabel,
    revenue,
    categories: benchmarkGroups.map((group) => {
      const sourceRows = group.codes.some((code) => code.startsWith("COGS-")) ? cogsRows : opExRows;
      const amount = getCategoryValue(sourceRows, group.codes as unknown as string[]);
      return {
        key: group.key,
        label: group.label,
        benchmarkLowPct: group.low,
        benchmarkHighPct: group.high,
        amount,
        pctOfRevenue: revenue > 0 ? (amount / revenue) * 100 : null,
      };
    }),
  });

  const benchmarkComparison = {
    categorizationRules: {
      cogs: ["COGS-SUPPLY", "COGS-RETAIL", "COGS-OTHER"],
      marketing: ["OPX-MKTG"],
      directLabor: ["OPX-LABOR-STAFF", "OPX-LABOR-MGMT"],
      payrollTaxesBenefits: ["OPX-LABOR-TAX"],
      buildingRent: ["OPX-RENT", "OPX-RENT-NNN"],
      otherBuilding: ["OPX-UTIL", "OPX-REPAIR"],
      businessOperations: ["OPX-SOFT", "OPX-INSUR", "OPX-BANK", "OPX-PROF"],
      other: ["OPX-MEALS", "OPX-TRAVEL", "OPX-DONAT", "OPX-GIFTS", "OPX-VET", "OPX-OTHER"],
    },
    excludedCodes: ["OPX-LABOR-OWN", "OPX-DEPR", "OPX-INT"],
    periods: [
      ...(analysis.annualModel?.years ?? []).map((year) =>
        buildPeriodBenchmark(year.fiscalYear, year.totalRevenue, year.cogsByCategory, year.opExByCategory),
      ),
      buildPeriodBenchmark(
        "TTM",
        analysis.ttmSummary?.totalRevenue ?? 0,
        analysis.ttmSummary?.cogsByCategory,
        analysis.ttmSummary?.opExByCategory,
      ),
    ],
  };

  const buildLaborPeriod = (periodLabel: string, revenue: number, opExRows: Array<{ code?: string; value?: number }> | undefined | null) => {
    const staffLabor = getCategoryValue(opExRows, ["OPX-LABOR-STAFF"]);
    const managementLabor = getCategoryValue(opExRows, ["OPX-LABOR-MGMT"]);
    const ownerComp = getCategoryValue(opExRows, ["OPX-LABOR-OWN"]);
    const payrollTaxesBenefits = getCategoryValue(opExRows, ["OPX-LABOR-TAX"]);
    const tipsPaidOut = getCategoryValue(opExRows, ["OPX-TIPS-OUT"]);
    const allInLabor = staffLabor + managementLabor + ownerComp + payrollTaxesBenefits + tipsPaidOut;
    const buyerAdjustedLabor =
      staffLabor + managementLabor + (periodLabel === "TTM" ? recast?.assumptions?.replacementSalary ?? 0 : recast?.assumptions?.replacementSalary ?? 0) + payrollTaxesBenefits;

    return {
      periodLabel,
      revenue,
      staffLabor,
      managementLabor,
      ownerComp,
      payrollTaxesBenefits,
      tipsPaidOut,
      directLaborExcludingOwner: staffLabor + managementLabor,
      allInLabor,
      buyerAdjustedLabor,
      directLaborPct: revenue > 0 ? ((staffLabor + managementLabor) / revenue) * 100 : null,
      allInLaborPct: revenue > 0 ? (allInLabor / revenue) * 100 : null,
      buyerAdjustedLaborPct: revenue > 0 ? (buyerAdjustedLabor / revenue) * 100 : null,
    };
  };

  const laborAnalysis = {
    benchmarkRangePct: { low: 35, high: 45 },
    ownerCompMustBeSeparate: true,
    periods: [
      ...(analysis.annualModel?.years ?? []).map((year) =>
        buildLaborPeriod(year.fiscalYear, year.totalRevenue, year.opExByCategory),
      ),
      buildLaborPeriod("TTM", analysis.ttmSummary?.totalRevenue ?? 0, analysis.ttmSummary?.opExByCategory),
    ],
  };

  return {
    structuredModel: analysis.structuredModel,
    normalizedData: analysis.normalizedData,
    ttmSummary: analysis.ttmSummary,
    annualModel: analysis.annualModel,
    workingCapital: analysis.workingCapital,
    dataQualityReport: analysis.dataQualityReport,
    reportMarkdown: analysis.reportMarkdown,
    benchmarkComparison,
    laborAnalysis,
    recast: recast
      ? {
          assumptions: recast.assumptions,
          parsedReport: recast.parsedReport,
          normalizedEbitda: recast.normalizedEbitda,
          valuationLow: recast.valuationLow,
          valuationMid: recast.valuationMid,
          valuationHigh: recast.valuationHigh,
          reportMarkdown: recast.reportMarkdown,
        }
      : null,
  };
}

async function getLatestApprovedRecast(analysisId: string) {
  const record = await (prisma as any).ws2RecastAnalysis.findFirst({
    where: {
      ttmAnalysisId: analysisId,
      status: "APPROVED",
    },
    include: { flags: { orderBy: { createdAt: "asc" } } },
    orderBy: { approvedAt: "desc" },
  });
  return record ? mapRecastAnalysis(record) : null;
}

export async function runWs2RecastAnalysis(args: {
  analysisId: string;
  assumptions: Ws2RecastAssumptions;
  preparedDocuments: PreparedDocumentInput[];
}) {
  const analysis = await getTtmAnalysis(args.analysisId);
  if (!analysis) {
    throw new TtmOrchestratorError("WS2-1 analysis not found.", 404);
  }
  if (analysis.status !== "APPROVED") {
    throw new TtmOrchestratorError("Admin must approve WS2-1 before WS2-2 can run.", 400);
  }

  const dispatchTask = analysis.dispatchTasks.find((task) => task.agentId === "ws2_2_recast_v1");
  if (dispatchTask && dispatchTask.status !== "RELEASED") {
    throw new TtmOrchestratorError("WS2-2 has not been released from the WS2-1 HITL gate yet.", 400);
  }

  const preparedMap = buildPreparedDocumentMap(args.preparedDocuments);
  const hasAddbackDisclosure =
    preparedMap.has("addback_disclosure") ||
    preparedMap.has("shareholder_remuneration_36m") ||
    preparedMap.has("personal_expenses_36m") ||
    preparedMap.has("non_recurring_expenses_36m") ||
    preparedMap.has("tenant_improvements_36m");

  if (!hasAddbackDisclosure) {
    throw new TtmOrchestratorError("WS2-2 requires File 5 (Seller Add-Back Disclosure) or the legacy add-back source files.", 400);
  }

  const existingCount = await (prisma as any).ws2RecastAnalysis.count({
    where: { ttmAnalysisId: args.analysisId },
  });

  if (!isFiniteNumber(args.assumptions.multipleLow) || !isFiniteNumber(args.assumptions.multipleMid) || !isFiniteNumber(args.assumptions.multipleHigh)) {
    throw new TtmOrchestratorError("Admin must provide low, mid, and high valuation multiples before WS2-2 can run.", 400);
  }
  if (args.assumptions.multipleLow <= 0 || args.assumptions.multipleMid <= 0 || args.assumptions.multipleHigh <= 0) {
    throw new TtmOrchestratorError("Valuation multiples must be positive numbers.", 400);
  }
  if (!(args.assumptions.multipleLow <= args.assumptions.multipleMid && args.assumptions.multipleMid <= args.assumptions.multipleHigh)) {
    throw new TtmOrchestratorError("Admin's valuation multiples must be ordered low ≤ mid ≤ high.", 400);
  }

  // V3 Section 10: Owner replacement salary not provided → default to $65,000
  const normalizedAssumptions = { ...args.assumptions };
  let usedDefaultSalary = false;
  if (normalizedAssumptions.replacementSalary == null) {
    normalizedAssumptions.replacementSalary = 65000;
    usedDefaultSalary = true;
    console.warn(`[TTM] ⚠ Owner replacement salary not provided. Defaulting to $65,000 as per V3 Section 10.`);
  }

  const created = await (prisma as any).ws2RecastAnalysis.create({
    data: {
      clientId: analysis.clientId,
      ttmAnalysisId: args.analysisId,
      version: existingCount + 1,
      status: "RUNNING",
      hitlStatus: "PENDING_REVIEW",
      model: TTM_AGENT_MODEL,
      temperature: TTM_AGENT_TEMPERATURE,
      maxTokens: WS2_RECAST_MAX_TOKENS,
      assumptions: normalizedAssumptions,
    },
  });

  try {
    const rawReportMarkdown = await generateWs22Report(
      buildWs22PromptContent({
        analysis,
        assumptions: normalizedAssumptions,
        preparedDocuments: args.preparedDocuments,
      }),
    );
    const corrected = applyWs22SpecCorrections({
      reportMarkdown: rawReportMarkdown,
      analysis,
      assumptions: normalizedAssumptions,
    });
    const reportMarkdown = corrected.reportMarkdown;
    const metrics = corrected.metrics;
    const flagPayloads = [
      ...extractWs2RecastFlagPayloads(reportMarkdown),
      ...corrected.extraFlags,
    ];

    // V3 Section 10: Default salary flag
    if (usedDefaultSalary) {
      flagPayloads.push({
        title: "Owner replacement salary defaulted to $65,000",
        description: "No replacement salary was provided by Admin. The system used the V3 default of $65,000/year. All outputs are labeled DEFAULT. Admin should verify this amount.",
        severity: "MEDIUM" as const,
        payload: { source: "SYSTEM_DEFAULT", defaultAmount: 65000 },
      });
    }

    await (prisma as any).$transaction(async (tx: any) => {
      await tx.ws2RecastAnalysis.update({
        where: { id: created.id },
        data: {
          status: "HITL_PENDING",
          hitlStatus: "PENDING_REVIEW",
          reportMarkdown,
          parsedReport: {
            ...metrics,
            baseNormalizedEbitda: metrics.normalizedEbitda,
            baseValuationLow: metrics.valuationLow,
            baseValuationMid: metrics.valuationMid,
            baseValuationHigh: metrics.valuationHigh,
          },
          normalizedEbitda: metrics.normalizedEbitda,
          valuationLow: metrics.valuationLow,
          valuationMid: metrics.valuationMid,
          valuationHigh: metrics.valuationHigh,
          errorMessage: null,
        },
      });

      if (flagPayloads.length) {
        await tx.ws2RecastFlag.createMany({
          data: flagPayloads.map((flag: any) => ({
            recastAnalysisId: created.id,
            severity: flag.severity,
            title: flag.title,
            description: flag.description,
            payload: flag.payload,
          })),
        });
      }
    });

    await (prisma as any).agentDispatchTask.updateMany({
      where: {
        analysisId: args.analysisId,
        agentId: "ws2_5_labor_v1",
        status: "BLOCKED_HITL",
      },
      data: {
        status: "RELEASED",
        releasedAt: new Date(),
      },
    });

    const updated = await getTtmAnalysis(args.analysisId);
    if (!updated) {
      throw new TtmOrchestratorError("WS2-1 analysis not found after WS2-2 run.", 404);
    }
    console.log("[TTM Final] WS2-2 saved result", {
      analysisId: args.analysisId,
      recastId: created.id,
      startingEbitda: metrics.startingEbitda,
      normalizedEbitda: metrics.normalizedEbitda,
      valuationLow: metrics.valuationLow,
      valuationMid: metrics.valuationMid,
      valuationHigh: metrics.valuationHigh,
      flagCount: flagPayloads.length,
      flagTitles: flagPayloads.map((flag) => flag.title),
    });
    return updated;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown WS2-2 orchestration error";
    await (prisma as any).ws2RecastAnalysis.update({
      where: { id: created.id },
      data: {
        status: "FAILED",
        errorMessage: message,
      },
    });
    throw error;
  }
}

export async function actionWs2RecastFlag(args: {
  recastAnalysisId: string;
  flagId: string;
  action: FlagResolutionAction;
  notes?: string;
  actorName?: string;
  overrideAmount?: number | null;
  payloadPatch?: Record<string, unknown>;
}) {
  const flag = await (prisma as any).ws2RecastFlag.findUnique({
    where: { id: args.flagId },
    include: { recastAnalysis: true },
  });

  if (!flag || flag.recastAnalysisId !== args.recastAnalysisId) {
    throw new TtmOrchestratorError("WS2-2 flag not found.", 404);
  }

  if (args.action === "OVERRIDE" && !isFiniteNumber(args.overrideAmount)) {
    throw new TtmOrchestratorError("Admin must enter an override amount to use Override Amount.", 400);
  }

  await (prisma as any).$transaction(async (tx: any) => {
    await tx.ws2RecastFlag.update({
      where: { id: args.flagId },
      data: {
        resolutionStatus: "ACTIONED",
        resolutionAction: args.action,
        resolutionNotes: args.notes ?? null,
        overrideAmount: args.overrideAmount ?? null,
        payload: {
          ...(flag.payload ?? {}),
          ...(args.payloadPatch ?? {}),
        },
        resolvedAt: new Date(),
        resolvedByName: args.actorName || "Admin Pollack",
      },
    });

    const recastRecord = await tx.ws2RecastAnalysis.findUnique({
      where: { id: args.recastAnalysisId },
      include: {
        flags: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!recastRecord) {
      throw new TtmOrchestratorError("WS2-2 analysis not found during flag update.", 404);
    }

    const effectiveMetrics = resolveWs2RecastMetrics({
      assumptions: (recastRecord.assumptions ?? {}) as Ws2RecastAssumptions,
      parsedReport: (recastRecord.parsedReport ?? null) as Record<string, unknown> | null,
      normalizedEbitda: recastRecord.normalizedEbitda ?? null,
      valuationLow: recastRecord.valuationLow ?? null,
      valuationMid: recastRecord.valuationMid ?? null,
      valuationHigh: recastRecord.valuationHigh ?? null,
      flags: recastRecord.flags.map(mapRecastFlag),
    });

    await tx.ws2RecastAnalysis.update({
      where: { id: args.recastAnalysisId },
      data: {
        hitlStatus: "IN_REVIEW",
        normalizedEbitda: effectiveMetrics.normalizedEbitda,
        valuationLow: effectiveMetrics.valuationLow,
        valuationMid: effectiveMetrics.valuationMid,
        valuationHigh: effectiveMetrics.valuationHigh,
      },
    });
  });

  const updated = await getTtmAnalysis(flag.recastAnalysis.ttmAnalysisId);
  if (!updated) {
    throw new TtmOrchestratorError("Parent WS2-1 analysis not found after WS2-2 flag update.", 404);
  }
  return updated;
}

export async function approveWs2RecastAnalysis(args: { recastAnalysisId: string; actorName?: string }) {
  const recast = await (prisma as any).ws2RecastAnalysis.findUnique({
    where: { id: args.recastAnalysisId },
    include: {
      flags: true,
      ttmAnalysis: {
        include: {
          flags: true,
          dispatchTasks: true,
          recastAnalyses: { include: { flags: true }, orderBy: { createdAt: "desc" } },
          derivedReports: { orderBy: { createdAt: "desc" } },
        },
      },
    },
  });

  if (!recast) {
    throw new TtmOrchestratorError("WS2-2 analysis not found.", 404);
  }

  const unresolvedFlags = recast.flags.filter((flag: any) => flag.resolutionStatus !== "ACTIONED");
  if (unresolvedFlags.length) {
    throw new TtmOrchestratorError("All WS2-2 flags must be resolved before approval.", 400);
  }

  const frontendAnalysis = mapTtmAnalysisForFrontend(recast.ttmAnalysis);
  const frontendRecast = {
    ...mapRecastAnalysis(recast),
    ...resolveWs2RecastMetrics(mapRecastAnalysis(recast)),
  };
  const allDerivedComplete = hasAllBaselineSourceReportsComplete(frontendAnalysis);
  const clientName = await getClientDisplayName(frontendAnalysis.clientId);

  assertS3Configured();
  const workbookBuffer = buildWs2WorkbookBuffer({
    clientName,
    ttmAnalysis: frontendAnalysis,
    recastAnalysis: frontendRecast,
    derivedReports: frontendAnalysis.derivedReports ?? [],
  });
  const timestamp = new Date().toISOString().slice(0, 10);
  const fileName = `${clientName}_WS2_Financial_Analysis_${timestamp}.xlsx`;
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `clients/${frontendAnalysis.clientId}/ws2/${args.recastAnalysisId}/${safeName}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: s3BucketName,
      Key: key,
      Body: workbookBuffer,
      ContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );

  const workbookUrl = buildPublicFileUrl(key);

  await (prisma as any).$transaction([
    (prisma as any).ws2RecastAnalysis.update({
      where: { id: args.recastAnalysisId },
      data: {
        status: "APPROVED",
        hitlStatus: "APPROVED",
        approvedAt: new Date(),
        approvedByName: args.actorName || "Admin Pollack",
        normalizedEbitda: frontendRecast.normalizedEbitda,
        valuationLow: frontendRecast.valuationLow,
        valuationMid: frontendRecast.valuationMid,
        valuationHigh: frontendRecast.valuationHigh,
        workbookKey: key,
        workbookUrl,
      },
    }),
    (prisma as any).clientProfile.update({
      where: { id: frontendAnalysis.clientId },
      data: {
        approvedNormalizedEbitda: frontendRecast.normalizedEbitda,
        approvedNormalizedEbitdaAt: new Date(),
      },
    }),
    (prisma as any).agentDispatchTask.updateMany({
      where: {
        analysisId: frontendAnalysis.id,
        agentId: { in: ["ws2_8_seller_net_proceeds_v1"] },
      },
      data: {
        status: "RELEASED",
        releasedAt: new Date(),
      },
    }),
    ...(allDerivedComplete
      ? [
          (prisma as any).agentDispatchTask.updateMany({
            where: {
              analysisId: frontendAnalysis.id,
              agentId: "ws2_10_report_generator_v1",
            },
            data: {
              status: "RELEASED",
              releasedAt: new Date(),
            },
          }),
        ]
      : []),
  ]);

  if (allDerivedComplete) {
    const approvedRecast = await getLatestApprovedRecast(frontendAnalysis.id);
    if (approvedRecast) {
      await upsertWs210BaselineReport({
        analysisId: frontendAnalysis.id,
        approvedRecast,
      });
    }
  }

  const updated = await getTtmAnalysis(frontendAnalysis.id);
  if (!updated) {
    throw new TtmOrchestratorError("WS2-1 analysis not found after WS2-2 approval.", 404);
  }
  return updated;
}

export async function runWs2DerivedAgent(args: {
  analysisId: string;
  agentId: Ws2DerivedAgentId;
  preparedDocuments?: PreparedDocumentInput[];
}) {
  const analysis = await getTtmAnalysis(args.analysisId);
  if (!analysis) {
    throw new TtmOrchestratorError("WS2-1 analysis not found.", 404);
  }
  if (analysis.status !== "APPROVED") {
    throw new TtmOrchestratorError("Admin must approve WS2-1 before downstream WS2 agents can run.", 400);
  }

  const dispatchTask = analysis.dispatchTasks.find((task) => task.agentId === args.agentId);
  if (dispatchTask && dispatchTask.status !== "RELEASED") {
    throw new TtmOrchestratorError(`${args.agentId} has not been released by the required HITL gate yet.`, 400);
  }

  const approvedRecast = await getLatestApprovedRecast(args.analysisId);
  const latestRecastRecord = analysis.recastAnalyses?.find((item) => item.status !== "FAILED") ?? null;
  const recast = args.agentId === "ws2_5_labor_v1" ? latestRecastRecord : approvedRecast;
  if (args.agentId === "ws2_5_labor_v1" && !recast) {
    throw new TtmOrchestratorError("WS2-5 requires a completed WS2-2 recast output before it can run.", 400);
  }
  if (args.agentId === "ws2_10_report_generator_v1") {
    if (!approvedRecast) {
      throw new TtmOrchestratorError("WS2-10 requires an approved WS2-2 recast before it can run.", 400);
    }
    if (!hasAllBaselineSourceReportsComplete(analysis)) {
      throw new TtmOrchestratorError("WS2-10 requires completed WS2-3, WS2-4, and WS2-5 reports before it can run.", 400);
    }

    await upsertWs210BaselineReport({
      analysisId: args.analysisId,
      approvedRecast,
    });

    const updated = await getTtmAnalysis(args.analysisId);
    if (!updated) {
      throw new TtmOrchestratorError("WS2-1 analysis not found after WS2-10 generation.", 404);
    }
    return updated;
  }

  const preparedMap = buildPreparedDocumentMap(args.preparedDocuments ?? []);
  const ownerAssessment = preparedMap.get("owner_gm_assessment");

  const content = [
    {
      type: "text" as const,
      text: `=== WS2 INPUT MODEL ===\n${JSON.stringify(buildWs2DerivedPromptPayload(analysis, recast), null, 2)}`,
    },
  ];

  if (args.agentId === "ws2_5_labor_v1") {
    content.push({
      type: "text" as const,
      text: `=== OWNER & GM ASSESSMENT FROM WS1 ===\n${preparedDocumentToText(ownerAssessment, "No owner and GM assessment provided.")}`,
    });
  }

  const reportMarkdown =
    args.agentId === "ws2_3_rev_vertical_v1"
      ? await generateWs23Report(content)
      : args.agentId === "ws2_4_benchmark_v1"
        ? await generateWs24Report(content)
        : await generateWs25Report(content);
  const parsedReport = buildStructuredWs2DerivedReport({
    agentId: args.agentId,
    analysis,
    recast,
  });

  await (prisma as any).ws2DerivedReport.upsert({
    where: {
      ttmAnalysisId_agentId: {
        ttmAnalysisId: args.analysisId,
        agentId: args.agentId,
      },
    },
    update: {
      status: "COMPLETE",
      reportMarkdown,
      parsedReport,
      recastAnalysisId: recast?.id ?? null,
      errorMessage: null,
    },
    create: {
      clientId: analysis.clientId,
      ttmAnalysisId: args.analysisId,
      recastAnalysisId: recast?.id ?? null,
      agentId: args.agentId,
      status: "COMPLETE",
      reportMarkdown,
      parsedReport,
    },
  });

  if (approvedRecast) {
    const latestAnalysis = await getTtmAnalysis(args.analysisId);
    const allDerivedComplete = hasAllBaselineSourceReportsComplete(latestAnalysis);

    if (allDerivedComplete) {
      await (prisma as any).agentDispatchTask.updateMany({
        where: {
          analysisId: args.analysisId,
          agentId: "ws2_10_report_generator_v1",
        },
        data: {
          status: "RELEASED",
          releasedAt: new Date(),
        },
      });

      await upsertWs210BaselineReport({
        analysisId: args.analysisId,
        approvedRecast,
      });
    }
  }

  const updated = await getTtmAnalysis(args.analysisId);
  if (!updated) {
    throw new TtmOrchestratorError("WS2-1 analysis not found after downstream agent run.", 404);
  }
  return updated;
}

export async function previewWorkbookOverrides(args: {
  analysisId: string;
  workbookBuffer: Buffer;
}) {
  const analysis = await getTtmAnalysis(args.analysisId);
  if (!analysis) throw new TtmOrchestratorError("WS2-1 analysis not found.", 404);
  const approvedRecast = await getLatestApprovedRecast(args.analysisId);
  if (!approvedRecast) throw new TtmOrchestratorError("Approved WS2-2 recast is required.", 400);

  const clientName = await getClientDisplayName(analysis.clientId);
  const currentReport = buildWS2ReportAdapter(clientName, analysis, approvedRecast, analysis.derivedReports ?? []);
  const currentSnapshot = buildWorkbookOverrideSnapshot(currentReport);
  const uploadedSnapshot = parseWorkbookOverrideSnapshotFromXlsx(args.workbookBuffer);
  const changes = diffWorkbookOverrideSnapshots(currentSnapshot, uploadedSnapshot);

  return {
    changes,
    snapshot: uploadedSnapshot,
  };
}

export async function applyWorkbookOverrides(args: {
  analysisId: string;
  snapshot: WorkbookOverrideSnapshot;
}) {
  const analysis = await getTtmAnalysis(args.analysisId);
  if (!analysis) throw new TtmOrchestratorError("WS2-1 analysis not found.", 404);

  const existingWs210 = analysis.derivedReports?.find((report) => report.agentId === "ws2_10_report_generator_v1");
  if (!existingWs210) {
    throw new TtmOrchestratorError("Baseline valuation report must exist before applying workbook overrides.", 400);
  }

  await (prisma as any).ws2DerivedReport.update({
    where: { id: existingWs210.id },
    data: {
      parsedReport: {
        ...((existingWs210.parsedReport ?? {}) as Record<string, unknown>),
        workbookOverrideSnapshot: args.snapshot,
        workbookOverrideAppliedAt: new Date().toISOString(),
      },
    },
  });

  const updated = await getTtmAnalysis(args.analysisId);
  if (!updated) throw new TtmOrchestratorError("WS2-1 analysis not found after workbook override apply.", 404);
  return updated;
}

export { TtmOrchestratorError };
