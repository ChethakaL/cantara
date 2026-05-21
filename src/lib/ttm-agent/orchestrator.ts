import { createHash } from "crypto";
import { readFile as readFileBuffer } from "fs/promises";
import path from "path";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { assertS3Configured, buildPublicFileUrl, s3BucketName, s3Client } from "@/lib/s3";
import { mapLedgerRows } from "@/lib/ttm-agent/mapping";
import { parseAccountantStatementsDocument, parseAccountantStatementsPreparedDocument } from "@/lib/ttm-agent/parsers/accountant-statements";
import { parseMonthlyWorkbook, parseMonthlyWorkbookFromPrepared } from "@/lib/ttm-agent/parsers/excel";
import { buildDataQualityReport, flattenFlagsForPersistence } from "@/lib/ttm-agent/report-builder";
import { reconcileFinancials } from "@/lib/ttm-agent/reconciler";
import { REVENUE_CODES, TAXONOMY_BY_CODE } from "@/lib/ttm-agent/taxonomy";
import {
  AgentDispatchTaskView,
  FlagResolutionAction,
  FlagSeverity,
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
import {
  excelToText,
  extractFinancialsWithLLM,
  extractAddbacksWithLLM,
  computeValuation,
  type ExtractedFinancials,
  type ExtractedAddbacks,
  type ValuationResult,
} from "@/lib/ttm-agent/llm-extraction";

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

async function loadOptionalDocument(clientId: string, documentId: string) {
  const row = await (prisma as any).clientDocument.findFirst({
    where: { clientId, documentId },
    orderBy: { createdAt: "desc" },
  });
  return row ?? null;
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

  // V3 Section 4.3: buildWS21MessageContent exact format
  return [
    { type: "text" as const, text: plText || `=== INPUT FILE: Monthly P&L — 3 Fiscal Years ===\nNo P&L data available.` },
    { type: "text" as const, text: bsText || `=== INPUT FILE: Monthly Balance Sheet — 3 Fiscal Years ===\nNo balance sheet data available.` },
    { type: "text" as const, text: accountantText.startsWith("===") ? accountantText : `=== INPUT FILE: Accountant-Prepared Financial Statements — 3 Fiscal Years ===\n${accountantText}` },
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
    monthly_pl_excel: "Monthly P&L (36 months)",
    monthly_bs_excel: "Monthly Balance Sheet (36 months)",
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
    const [monthlyPlDocument, monthlyBsDocument] = inputDocuments;

    const preparedMonthlyPl = ensurePreparedDocument(preparedMap, "monthly_pl_excel", monthlyPlDocument);
    const preparedMonthlyBs = ensurePreparedDocument(preparedMap, "monthly_bs_excel", monthlyBsDocument);

    const monthlyPlBuffer = await safeReadDocumentBuffer(monthlyPlDocument.localPath);
    const monthlyBsBuffer = await safeReadDocumentBuffer(monthlyBsDocument.localPath);

    const monthlyPl = monthlyPlBuffer
      ? parseMonthlyWorkbook(monthlyPlBuffer, "monthly_pl_excel")
      : parseMonthlyWorkbookFromPrepared(preparedMonthlyPl, "monthly_pl_excel");
    console.log(`[TTM] Parsed monthly P&L: format=${monthlyPl.format}, ${monthlyPl.rows.length} rows, ${monthlyPl.monthKeys.length} months, source=${monthlyPlBuffer ? "xlsx-direct" : "prepared-csv"}`);

    const monthlyBs = monthlyBsBuffer
      ? parseMonthlyWorkbook(monthlyBsBuffer, "monthly_bs_excel")
      : parseMonthlyWorkbookFromPrepared(preparedMonthlyBs, "monthly_bs_excel");
    console.log(`[TTM] Parsed monthly BS: format=${monthlyBs.format}, ${monthlyBs.rows.length} rows, ${monthlyBs.monthKeys.length} months, source=${monthlyBsBuffer ? "xlsx-direct" : "prepared-csv"}`);

    // Optional: Accountant Statements
    const accountantDocRecord = await loadOptionalDocument(args.clientId, "accountant_statements");
    let accountantStatements: Awaited<ReturnType<typeof parseAccountantStatementsDocument>> | null = null;
    if (accountantDocRecord) {
      try {
        const accountantBuffer = await safeReadDocumentBuffer(accountantDocRecord.localPath);
        const preparedAccountant = preparedMap.get("accountant_statements" as any);
        accountantStatements = accountantBuffer
          ? await parseAccountantStatementsDocument({ fileName: accountantDocRecord.fileName, mimeType: accountantDocRecord.mimeType, buffer: accountantBuffer })
          : preparedAccountant ? await parseAccountantStatementsPreparedDocument(preparedAccountant) : null;
        if (accountantStatements) console.log(`[TTM] Parsed accountant statements: ${accountantStatements.years.length} fiscal years`);
      } catch (e) { console.log(`[TTM] Accountant statements skipped: ${(e as Error).message}`); }
    } else {
      console.log("[TTM] No accountant statements uploaded — skipping cross-reference");
    }

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
      accountantStatements: accountantStatements ?? { years: [], sourceType: "xlsx" as const, confidence: "LOW" as const, notes: ["Accountant statements not provided"] },
    });

    const wcResult = buildWorkingCapitalSummary({
      mappedBalanceSheetRows: mappedBsRows,
      balanceSheetMonths: monthlyBs.monthKeys,
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

    // ── LLM-first extraction (PRIMARY path) ──────────────────────────────
    // Run the LLM pipeline FIRST as the primary extraction step.
    // The old deterministic pipeline above serves as a silent fallback for
    // data the LLM might not extract (working capital, etc.).
    let llmExtraction: ExtractedFinancials | null = null;
    let llmSucceeded = false;
    const llmFlags: Array<{ section: string; severity: string; title: string; description: string; payload: Record<string, unknown> }> = [];
    try {
      const plText = monthlyPlBuffer ? excelToText(monthlyPlBuffer) : null;
      const bsText = monthlyBsBuffer ? excelToText(monthlyBsBuffer) : null;

      if (plText) {
        console.log(`[TTM] Running LLM financial extraction (PRIMARY path)...`);
        llmExtraction = await extractFinancialsWithLLM(plText, bsText);
        llmSucceeded = true;
        console.log(`[TTM] LLM extraction complete (PRIMARY): ${llmExtraction.periods.length} periods, ${llmExtraction.glMapping.length} GL mappings, ${llmExtraction.notes.length} notes`);

        // Generate HITL flags from LLM extraction
        // Section A flags: GL mappings where Claude's confidence < 0.8
        for (const mapping of llmExtraction.glMapping) {
          if (mapping.confidence < 0.8) {
            llmFlags.push({
              section: "A",
              severity: mapping.confidence < 0.5 ? "HIGH" : "MEDIUM",
              title: `LLM GL mapping: low confidence for "${mapping.accountName}"`,
              description: `Claude mapped "${mapping.accountName}" to ${mapping.cantaraCode} with confidence ${(mapping.confidence * 100).toFixed(0)}%. Admin should verify this mapping.`,
              payload: {
                source: "LLM_EXTRACTION",
                accountName: mapping.accountName,
                suggestedCode: mapping.cantaraCode,
                confidence: mapping.confidence,
              },
            });
          }
        }

        // Section E flags: Data quality warnings from Claude
        for (const note of llmExtraction.notes) {
          llmFlags.push({
            section: "E",
            severity: /critical|error|missing/i.test(note) ? "HIGH" : "LOW",
            title: `LLM data quality note`,
            description: note,
            payload: {
              source: "LLM_EXTRACTION",
              noteText: note,
            },
          });
        }

        console.log(`[TTM] LLM extraction generated ${llmFlags.length} HITL flags (${llmFlags.filter(f => f.section === "A").length} GL mapping, ${llmFlags.filter(f => f.section === "E").length} data quality)`);
      }
    } catch (llmError) {
      const llmMsg = llmError instanceof Error ? llmError.message : "Unknown LLM error";
      console.warn(`[TTM] LLM extraction failed (falling back to deterministic pipeline): ${llmMsg}`);
      llmSucceeded = false;
      // LLM failure is non-fatal — fall back to the deterministic pipeline
    }

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
              accountantStatements: accountantStatements?.notes ?? [],
            },
            ...(llmExtraction ? { llmExtraction } : {}),
            primarySource: llmSucceeded ? "LLM" : "DETERMINISTIC",
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

      // When LLM succeeded: use ONLY LLM-generated flags. Suppress ALL old section A flags.
      // Keep old sections B-E flags only for non-overlapping checks (working capital, etc.).
      const useOldFlags = llmSucceeded
        ? flattenedFlags.filter((flag) => flag.section !== "A") // suppress ALL old section A flags
        : flattenedFlags; // no LLM — use all old flags

      // When LLM succeeded, use LLM flags as primary + old B-E as supplementary
      // When LLM failed, use only old deterministic flags
      const allFlags = llmSucceeded
        ? [
            ...llmFlags.map((flag) => ({
              analysisId: created.id,
              section: flag.section,
              severity: flag.severity,
              title: flag.title,
              description: flag.description,
              payload: flag.payload,
            })),
            // Keep old B-E flags only for non-overlapping checks
            ...useOldFlags.map((flag) => ({
              analysisId: created.id,
              section: flag.section,
              severity: flag.severity,
              title: flag.title,
              description: flag.description,
              payload: flag.payload,
            })),
          ]
        : flattenedFlags.map((flag) => ({
            analysisId: created.id,
            section: flag.section,
            severity: flag.severity,
            title: flag.title,
            description: flag.description,
            payload: flag.payload,
          }));

      if (allFlags.length) {
        await tx.ttmFlag.createMany({
          data: allFlags,
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

  // If this is a Section A GL mapping flag with an assigned Cantara code,
  // immediately update the mapped rows in normalizedData so Step 2 reflects it
  const assignedCode = mergedPayload?.assignedCantaraCode as string | null | undefined;
  const accountName = (mergedPayload?.accountName ?? flag.payload?.accountName) as string | null | undefined;
  if (flag.section === "A" && assignedCode && accountName) {
    try {
      const analysis = await (prisma as any).ttmAnalysis.findUnique({ where: { id: args.analysisId } });
      if (analysis?.normalizedData) {
        const nd = typeof analysis.normalizedData === "object" ? analysis.normalizedData : {};
        const updateRows = (rows: unknown) => {
          if (!Array.isArray(rows)) return rows;
          return rows.map((row: any) => {
            if (row.accountName !== accountName) return row;
            if (assignedCode === "_EXCLUDED") {
              return { ...row, cantaraCode: "_EXCLUDED", category: "Excluded", mappingMethod: "exact", mappingConfidence: 1 };
            }
            const entry = TAXONOMY_BY_CODE[assignedCode];
            return {
              ...row,
              cantaraCode: entry?.code ?? assignedCode,
              category: entry?.category ?? null,
              categoryType: entry?.type ?? row.categoryType ?? "other",
              mappingMethod: "exact",
              mappingConfidence: 1,
            };
          });
        };
        await (prisma as any).ttmAnalysis.update({
          where: { id: args.analysisId },
          data: {
            normalizedData: {
              ...nd,
              mappedPlRows: updateRows((nd as any).mappedPlRows),
              mappedBsRows: updateRows((nd as any).mappedBsRows),
            },
          },
        });
      }
    } catch (glErr) {
      console.error("[actionTtmFlag] Failed to update GL mapping in normalizedData:", glErr);
      // Non-fatal — flag was still resolved
    }
  }

  const updated = await getTtmAnalysis(args.analysisId);
  if (!updated) {
    throw new TtmOrchestratorError("TTM analysis not found after flag update.", 404);
  }
  return updated;
}

export async function approveTtmAnalysis(args: {
  analysisId: string;
  actorName?: string;
  userOverrides?: Record<string, number>;
}) {
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

  // Merge user overrides into normalizedData if provided
  const normalizedDataUpdate =
    args.userOverrides && Object.keys(args.userOverrides).length > 0
      ? {
          normalizedData: {
            ...(typeof analysis.normalizedData === "object" && analysis.normalizedData !== null
              ? analysis.normalizedData
              : {}),
            userOverrides: args.userOverrides,
          },
        }
      : {};

  await (prisma as any).$transaction([
    (prisma as any).ttmAnalysis.update({
      where: { id: args.analysisId },
      data: {
        status: "APPROVED",
        hitlStatus: "APPROVED",
        approvedAt: new Date(),
        approvedByName: actorName,
        ...normalizedDataUpdate,
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

/** Persist normalization schedule overrides to normalizedData.userOverrides (fire-and-forget from UI) */
export async function saveNormOverrides(args: {
  analysisId: string;
  userOverrides: Record<string, number>;
}) {
  const analysis = await (prisma as any).ttmAnalysis.findUnique({
    where: { id: args.analysisId },
  });
  if (!analysis) {
    throw new TtmOrchestratorError("TTM analysis not found.", 404);
  }
  const existing =
    typeof analysis.normalizedData === "object" && analysis.normalizedData !== null
      ? analysis.normalizedData
      : {};

  await (prisma as any).ttmAnalysis.update({
    where: { id: args.analysisId },
    data: {
      normalizedData: {
        ...existing,
        userOverrides: args.userOverrides,
      },
    },
  });
}

export async function saveGlMappings(args: {
  analysisId: string;
  mappings: Record<string, string | null>;
}) {
  const analysis = await (prisma as any).ttmAnalysis.findUnique({
    where: { id: args.analysisId },
  });
  if (!analysis) {
    throw new TtmOrchestratorError("TTM analysis not found.", 404);
  }

  const existing =
    typeof analysis.normalizedData === "object" && analysis.normalizedData !== null
      ? analysis.normalizedData
      : {};

  const applyMappings = (rows: unknown) => {
    if (!Array.isArray(rows)) return rows;
    return rows.map((row: any) => {
      const key = `${row.sourceSheet ?? ""}|${row.accountCode ?? ""}|${row.accountName ?? ""}`;
      if (!Object.prototype.hasOwnProperty.call(args.mappings, key)) return row;

      const nextCode = args.mappings[key] || null;
      if (nextCode === "_EXCLUDED") {
        return {
          ...row,
          cantaraCode: "_EXCLUDED",
          category: "Excluded",
          categoryType: "other",
          mappingMethod: "exact",
          mappingConfidence: 1,
        };
      }

      const entry = nextCode ? TAXONOMY_BY_CODE[nextCode] : null;
      return {
        ...row,
        cantaraCode: entry?.code ?? null,
        category: entry?.category ?? null,
        categoryType: entry?.type ?? row.categoryType ?? "other",
        mappingMethod: entry ? "exact" : "unmapped",
        mappingConfidence: entry ? 1 : 0,
      };
    });
  };

  await (prisma as any).ttmAnalysis.update({
    where: { id: args.analysisId },
    data: {
      normalizedData: {
        ...existing,
        mappedPlRows: applyMappings((existing as any).mappedPlRows),
        mappedBsRows: applyMappings((existing as any).mappedBsRows),
        confirmedGlMappings: args.mappings,
        confirmedGlMappingsAt: new Date().toISOString(),
      },
    },
  });

  const updated = await getTtmAnalysis(args.analysisId);
  if (!updated) {
    throw new TtmOrchestratorError("TTM analysis not found after GL mapping update.", 404);
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

// Parse CSV text that may have multi-line quoted headers like "Draws\n(Other Earnings)"
// Returns array of rows, each row is array of cell strings
function parseCSVWithQuotes(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') { inQuote = false; }
      else { cell += ch; }
    } else {
      if (ch === '"') { inQuote = true; }
      else if (ch === ",") { current.push(cell.trim()); cell = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        current.push(cell.trim());
        cell = "";
        if (current.some(c => c)) rows.push(current);
        current = [];
      } else { cell += ch; }
    }
  }
  current.push(cell.trim());
  if (current.some(c => c)) rows.push(current);
  return rows;
}

// ── Seller File Extraction Helpers ──────────────────────────────────────────

const MONTH_MAP: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };

/** Parse a date cell (MM/DD/YYYY, Mon-YYYY, or YYYY-MM) to month key "YYYY-MM" */
function parseDateToMonth(value: string): string | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  // MM/DD/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) return `${slashMatch[3]}-${slashMatch[1].padStart(2, "0")}`;
  // Mon-YYYY (e.g., Jun-2019)
  const monMatch = trimmed.match(/^(\w{3})-(\d{4})$/i);
  if (monMatch) {
    const mm = MONTH_MAP[monMatch[1].toLowerCase()];
    if (mm) return `${monMatch[2]}-${mm}`;
  }
  // YYYY-MM
  if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed;
  return null;
}

function parseAmount(value: string): number {
  const cleaned = String(value ?? "").replace(/[$,"]/g, "").replace(/^\((.*)\)$/, "-$1").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parse F5 Add-Back Summary: extract per-account 36-month totals grouped by section.
 * Format: Acct # | Account Name | Type | 36-Month Total | Reference | Notes
 * Section headers like "A — OWNER / OFFICER COMPENSATION"
 */
function extractF5Summary(doc: PreparedDocumentInput | undefined): {
  ownerComp: Array<{ acctNum: string; name: string; total: number }>;
  personalExpenses: Array<{ acctNum: string; name: string; total: number }>;
  nonRecurringExpenses: Array<{ acctNum: string; name: string; total: number }>;
  nonRecurringIncome: Array<{ acctNum: string; name: string; total: number }>;
  tenantImprovements: Array<{ acctNum: string; name: string; total: number }>;
} {
  const result = { ownerComp: [] as any[], personalExpenses: [] as any[], nonRecurringExpenses: [] as any[], nonRecurringIncome: [] as any[], tenantImprovements: [] as any[] };
  if (!doc?.textBlocks?.length) return result;

  for (const block of doc.textBlocks) {
    const rows = parseCSVWithQuotes(block.text);
    let currentSection = "";

    for (const cells of rows) {
      const first = String(cells[0] ?? "").trim();
      // Detect section headers
      if (/^A\s*—|OWNER.*COMPENSATION/i.test(first)) { currentSection = "A"; continue; }
      if (/^B\s*—|PERSONAL\s*EXPENSE/i.test(first)) { currentSection = "B"; continue; }
      if (/^C\s*—|NON.*RECURRING.*INCOME|SECTION\s*1/i.test(first)) { currentSection = "C"; continue; }
      if (/^D\s*—|NON.*RECURRING.*EXPENSE|SECTION\s*2/i.test(first)) { currentSection = "D"; continue; }
      if (/^E\s*—|TENANT\s*IMPROVEMENT/i.test(first)) { currentSection = "E"; continue; }
      // Skip headers, subtotals, blanks
      if (!first || /^acct|^#|subtotal|^total|^$|^type$/i.test(first)) continue;
      if (cells.length < 4) continue;

      const acctNum = first;
      const name = String(cells[1] ?? "").trim();
      // Find the numeric total — typically column 3 (36-Month Total)
      let total = 0;
      for (let i = 2; i < cells.length; i++) {
        const v = parseAmount(String(cells[i] ?? ""));
        if (v !== 0 && !name) break; // Skip if no name (probably a header)
        if (v !== 0) { total = v; break; }
      }
      if (!name || total === 0) continue;

      const item = { acctNum, name, total };
      if (currentSection === "A") result.ownerComp.push(item);
      else if (currentSection === "B") result.personalExpenses.push(item);
      else if (currentSection === "C") result.nonRecurringIncome.push(item);
      else if (currentSection === "D") result.nonRecurringExpenses.push(item);
      else if (currentSection === "E") result.tenantImprovements.push(item);
    }
  }

  console.log(`[WS2-2 Extract] F5 summary: ownerComp=${result.ownerComp.length}, personal=${result.personalExpenses.length}, nonRecurIncome=${result.nonRecurringIncome.length}, nonRecurExpense=${result.nonRecurringExpenses.length}, TI=${result.tenantImprovements.length}`);
  return result;
}

/**
 * Parse F6 Shareholder Remuneration (transaction-level) — sum by account within TTM.
 * Format: Date | Acct# | Account Name | Description | Amount | Where Recorded
 */
function extractF6OwnerComp(doc: PreparedDocumentInput | undefined, ttmMonths: string[]): Record<string, { name: string; ttmAmount: number }> {
  const result: Record<string, { name: string; ttmAmount: number }> = {};
  if (!doc?.textBlocks?.length || !ttmMonths.length) return result;

  for (const block of doc.textBlocks) {
    if (/shareholder list/i.test(block.sheetName)) continue; // Skip the ownership sheet
    const rows = parseCSVWithQuotes(block.text);
    for (const cells of rows) {
      const dateMonth = parseDateToMonth(String(cells[0] ?? ""));
      if (!dateMonth || !ttmMonths.includes(dateMonth)) continue;
      const acctName = String(cells[2] ?? "").trim();
      if (!acctName) continue;
      const amount = parseAmount(String(cells[4] ?? ""));
      if (amount === 0) continue;

      if (!result[acctName]) result[acctName] = { name: acctName, ttmAmount: 0 };
      result[acctName].ttmAmount += amount;
    }
  }

  for (const [name, data] of Object.entries(result)) {
    console.log(`[WS2-2 Extract] F6 owner comp: "${name}" TTM=$${data.ttmAmount.toFixed(0)}`);
  }
  return result;
}

/**
 * Parse F7 Personal Expenses (transaction-level) — sum by category within TTM.
 * Format: Date | Transaction Type | Num | Name/Vendor | Memo | Account | Amount
 * Category headers are standalone rows (e.g., "Church")
 */
function extractF7PersonalByCategory(doc: PreparedDocumentInput | undefined, ttmMonths: string[]): Record<string, { category: string; glAccount: string; ttmAmount: number }> {
  const result: Record<string, { category: string; glAccount: string; ttmAmount: number }> = {};
  if (!doc?.textBlocks?.length || !ttmMonths.length) return result;

  for (const block of doc.textBlocks) {
    const rows = parseCSVWithQuotes(block.text);
    let currentCategory = "";
    let headerFound = false;

    for (const cells of rows) {
      const first = String(cells[0] ?? "").trim();
      // Skip title rows and header
      if (/^foothills|^transaction detail|^36 months|^cash basis|^date$/i.test(first)) { headerFound = /^date$/i.test(first); continue; }
      if (!headerFound) continue;
      if (!first) continue;
      if (/^total\b|^subtotal/i.test(first)) continue;

      const dateMonth = parseDateToMonth(first);
      if (!dateMonth) {
        // Not a date — this is a category header row
        if (first.length > 1 && !/^#|^acct/i.test(first)) {
          currentCategory = first;
        }
        continue;
      }

      if (!ttmMonths.includes(dateMonth)) continue;
      if (!currentCategory) continue;

      // Find amount — last numeric column
      const amountCol = cells.length - 1;
      const amount = parseAmount(String(cells[amountCol] ?? ""));
      if (amount === 0) continue;

      // Find GL account — column with "XXXX · Name" pattern
      let glAccount = "";
      for (let i = 1; i < cells.length - 1; i++) {
        const val = String(cells[i] ?? "");
        if (/\d+\s*·/.test(val)) { glAccount = val; break; }
      }

      if (!result[currentCategory]) result[currentCategory] = { category: currentCategory, glAccount, ttmAmount: 0 };
      result[currentCategory].ttmAmount += amount;
    }
  }

  for (const [cat, data] of Object.entries(result)) {
    console.log(`[WS2-2 Extract] F7 personal: "${cat}" (${data.glAccount}) TTM=$${data.ttmAmount.toFixed(0)}`);
  }
  return result;
}

/**
 * Parse F8 Non-Recurring Items (transaction-level) — separate income (remove) from expenses (add back).
 * Format: Date | Acct# | Account Name | Description | Amount | Where Recorded
 * Section headers: "SECTION 1 — One-Time Income" / "SECTION 2 — One-Time Expenses"
 */
function extractF8NonRecurring(doc: PreparedDocumentInput | undefined, ttmMonths: string[]): {
  incomeToRemove: Array<{ date: string; description: string; amount: number }>;
  expensesToAddBack: Array<{ date: string; description: string; amount: number }>;
} {
  const result = { incomeToRemove: [] as any[], expensesToAddBack: [] as any[] };
  if (!doc?.textBlocks?.length || !ttmMonths.length) return result;

  for (const block of doc.textBlocks) {
    const rows = parseCSVWithQuotes(block.text);
    let currentSection = ""; // "income" or "expense"

    for (const cells of rows) {
      const first = String(cells[0] ?? "").trim();
      // Detect section headers
      if (/SECTION\s*1|one.time\s*income|non.recurring\s*income|income.*to.*remove/i.test(first)) { currentSection = "income"; continue; }
      if (/SECTION\s*2|one.time\s*expense|non.recurring\s*expense|expense.*add.*back/i.test(first)) { currentSection = "expense"; continue; }
      if (/^date|^acct|^total|^subtotal|^$|^foothills|^material|^36 months/i.test(first)) continue;

      const dateMonth = parseDateToMonth(first);
      if (!dateMonth) continue;
      if (!ttmMonths.includes(dateMonth)) continue;

      const description = String(cells[3] ?? cells[2] ?? "").trim();
      const amount = parseAmount(String(cells[4] ?? ""));
      if (amount === 0) continue;

      const item = { date: first, description, amount };
      if (currentSection === "income") {
        result.incomeToRemove.push(item);
        console.log(`[WS2-2 Extract] F8 income to remove: ${first} "${description}" $${amount}`);
      } else if (currentSection === "expense") {
        result.expensesToAddBack.push(item);
        console.log(`[WS2-2 Extract] F8 expense to add back: ${first} "${description}" $${amount}`);
      }
    }
  }
  return result;
}

/**
 * Extract personal expense add-backs grouped by expense category.
 * Handles TWO formats:
 *   Format A (row-based): Period | Month | Description | GL | Gross | % | Add-Back | Notes
 *     with category header rows (e.g., "Church / Religious Donations" on its own row)
 *   Format B (column-based): # | Description | GL Account | GL Code | Jan-2022 | Feb-2022 | ...
 */
function extractPersonalExpensesByCategory(
  preparedDoc: PreparedDocumentInput | undefined,
  ttmMonths: string[],
): Record<string, { description: string; glAccount: string; ttmAmount: number }> {
  const result: Record<string, { description: string; glAccount: string; ttmAmount: number }> = {};
  if (!preparedDoc?.textBlocks?.length || !ttmMonths.length) return result;

  const monthMap: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };

  for (const block of preparedDoc.textBlocks) {
    // Only process personal expense sheets
    if (/non.recurring|tenant|section c|section d|section e/i.test(block.sheetName)) continue;

    const rows = parseCSVWithQuotes(block.text);
    if (rows.length < 3) continue;

    // Find header row — look for "Period" + "Add-Back" or "Gross" columns
    let headerIndex = -1;
    let headers: string[] = [];
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const normalized = rows[i].map(c => c.replace(/\n/g, " ").replace(/\s+/g, " ").trim());
      if (normalized.some(c => /^period$/i.test(c)) && normalized.some(c => /add.back|gross/i.test(c))) {
        headers = normalized;
        headerIndex = i;
        break;
      }
    }
    if (headerIndex < 0) continue;

    const periodCol = headers.findIndex(h => /^period$/i.test(h));
    const addBackCol = headers.findIndex(h => /add.back/i.test(h));
    const grossCol = headers.findIndex(h => /^gross/i.test(h));
    const glDescCol = headers.findIndex(h => /qb gl|gl.*description|description/i.test(h));
    const amountCol = addBackCol >= 0 ? addBackCol : grossCol;

    if (periodCol < 0 || amountCol < 0) continue;

    console.log(`[WS2-2 Extract] F7 per-category parse: periodCol=${periodCol}, amountCol=${amountCol} (${headers[amountCol]}), ${rows.length - headerIndex - 1} data rows`);

    // Parse rows — category headers are rows where Period column is text (not month pattern)
    let currentCategory = "Unknown";
    for (let i = headerIndex + 1; i < rows.length; i++) {
      const cells = rows[i];
      if (cells.every(c => !c || String(c).trim() === "")) continue;
      if (cells.some(c => /\bTOTAL\b|\bSUBTOTAL\b|\bSECTION\b|\bCOMBINED\b/i.test(String(c)))) continue;

      const periodCell = String(cells[periodCol] ?? "").trim();
      const monthMatch = periodCell.match(/(\w{3})-(\d{4})/i);

      if (!monthMatch) {
        // This is a category header row (e.g., "Church / Religious Donations")
        if (periodCell && periodCell.length > 2) {
          currentCategory = periodCell;
        }
        continue;
      }

      // This is a data row with a month
      const monthKey = `${monthMatch[2]}-${monthMap[monthMatch[1].toLowerCase()] ?? "00"}`;
      if (!ttmMonths.includes(monthKey)) continue;

      const rawAmount = String(cells[amountCol] ?? "").replace(/[$,"]/g, "").trim();
      const amount = Number(rawAmount);
      if (!Number.isFinite(amount) || amount === 0) continue;

      const glDesc = glDescCol >= 0 ? String(cells[glDescCol] ?? "").replace(/"/g, "").trim() : "";

      if (!result[currentCategory]) {
        result[currentCategory] = { description: currentCategory, glAccount: glDesc || currentCategory, ttmAmount: 0 };
      }
      result[currentCategory].ttmAmount += amount;
    }

    for (const [cat, data] of Object.entries(result)) {
      console.log(`[WS2-2 Extract] F7 category: "${cat}" TTM=$${data.ttmAmount.toFixed(0)}`);
    }
  }

  return result;
}

function extractTtmColumnTotals(preparedDoc: PreparedDocumentInput | undefined, ttmMonths: string[], sheetFilter?: string): Record<string, number> {
  const totals: Record<string, number> = {};
  if (!preparedDoc?.textBlocks?.length || !ttmMonths.length) return totals;

  for (const block of preparedDoc.textBlocks) {
    if (sheetFilter && !block.sheetName.toLowerCase().includes(sheetFilter.toLowerCase())) continue;

    const rows = parseCSVWithQuotes(block.text);
    if (rows.length < 2) continue;

    // Find header row — contains "Period" or "Month" AND has 4+ columns
    let headerIndex = -1;
    let headers: string[] = [];
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = rows[i];
      // Normalize multi-line headers: "Draws\n(Other Earnings)" → "Draws (Other Earnings)"
      const normalized = row.map(c => c.replace(/\n/g, " ").replace(/\s+/g, " ").trim());
      if (normalized.some(c => /^period$/i.test(c) || /^month$/i.test(c)) && normalized.length >= 4) {
        headers = normalized;
        headerIndex = i;
        break;
      }
    }
    if (headerIndex < 0) continue;

    // Identify data columns (not period/month/gl/description)
    const dataColIndices: Array<{ index: number; name: string }> = [];
    const periodColIndex = headers.findIndex(h => /^period$/i.test(h));
    for (let col = 0; col < headers.length; col++) {
      const h = headers[col];
      if (!/period|month|gl|cantara|description|account/i.test(h) && h.length > 0) {
        // Clean the header name
        const cleanName = h.replace(/\(.*\)/g, "").trim() || h;
        dataColIndices.push({ index: col, name: cleanName });
      }
    }

    console.log(`[WS2-2 Extract] Sheet "${block.sheetName}": ${dataColIndices.map(c => c.name).join(", ")} (${rows.length} rows, header at ${headerIndex})`);

    // Sum each data column for TTM months only
    const monthMap: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };

    for (let i = headerIndex + 1; i < rows.length; i++) {
      const cells = rows[i];
      if (cells.some(c => /\bTOTAL\b|\bSUBTOTAL\b|\bCOMBINED\b/i.test(c))) continue;
      if (cells.some(c => /^FY\b/i.test(c) && !/\d{4}-\d{2}/.test(c) && !/\w{3}-\d{4}/.test(c))) continue; // Skip FY header rows

      // Find month in this row
      const periodCell = periodColIndex >= 0 ? (cells[periodColIndex] ?? "") : "";
      const monthMatch = periodCell.match(/(\w{3})-(\d{4})/);
      if (!monthMatch) continue;
      const monthKey = `${monthMatch[2]}-${monthMap[monthMatch[1].toLowerCase()] ?? "00"}`;
      if (!ttmMonths.includes(monthKey)) continue;

      for (const col of dataColIndices) {
        const raw = (cells[col.index] ?? "").replace(/[$,"]/g, "").trim();
        const value = Number(raw);
        if (Number.isFinite(value) && value !== 0) {
          totals[col.name] = (totals[col.name] ?? 0) + value;
        }
      }
    }
  }

  return totals;
}

async function buildWs22PromptContent(args: {
  analysis: TtmAnalysisView;
  assumptions: Ws2RecastAssumptions;
  preparedDocuments: PreparedDocumentInput[];
}) {
  const preparedMap = buildPreparedDocumentMap(args.preparedDocuments);
  console.log(`[WS2-2] Documents received: ${Array.from(preparedMap.keys()).join(", ") || "NONE"}`);
  console.log(`[WS2-2] Document details: ${args.preparedDocuments.map(d => `${d.documentId}=${d.textBlocks?.length ?? 0} blocks`).join(", ")}`);

  // V3: Single consolidated File 5 — Add-Back Disclosure
  const addbackDisclosure = preparedMap.get("addback_disclosure");

  // Detail files F6-F9
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
      text: `=== WS2-1 SUMMARY ===
TTM Revenue: $${(args.analysis.ttmSummary?.totalRevenue ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
TTM Pre-Recast EBITDA: $${(args.analysis.ttmSummary?.ebitdaPreRecast ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
TTM Period: ${args.analysis.ttmSummary?.startMonth ?? "?"} to ${args.analysis.ttmSummary?.endMonth ?? "?"}
Annual Years: ${(args.analysis.annualModel?.years ?? []).map(y => `${y.fiscalYear} (Rev: $${(y.totalRevenue ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}, EBITDA: $${(y.ebitdaPreRecast ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })})`).join(" | ")}`,
    },
  ];

  // Raw file text no longer sent — the deterministic schedule has all the numbers.
  // The LLM only needs the schedule + summary to write the report.

  // ── SIMPLIFIED DETERMINISTIC EXTRACTION (4 inputs only) ──────────────────
  const { parsePersonalExpenses } = require("@/lib/ttm-agent/parsers/personal-expenses");
  const { parseOneOffExpenses } = require("@/lib/ttm-agent/parsers/one-off-expenses");

  const ttmMonths = args.analysis.ttmSummary
    ? (() => {
        const months: string[] = [];
        let [y, m] = args.analysis.ttmSummary.startMonth.split("-").map(Number);
        const [ey, em] = args.analysis.ttmSummary.endMonth.split("-").map(Number);
        while (y < ey || (y === ey && m <= em)) {
          months.push(`${y}-${String(m).padStart(2, "0")}`);
          m++; if (m > 12) { m = 1; y++; }
        }
        return months;
      })()
    : [];

  // ── DETERMINISTIC EXTRACTION (clean module) ──────────────────────────────
  const { buildDeterministicSchedule } = require("@/lib/ttm-agent/ws2-extraction");
  const schedule = await buildDeterministicSchedule({
    analysis: args.analysis,
    assumptions: args.assumptions,
    personalExpensesDoc: personal ?? addbackDisclosure,
    shareholderDoc: shareholder,
    oneOffDoc: nonRecurring ?? addbackDisclosure,
  });

  // Old extraction code removed — all computation now in ws2-extraction.ts
  if (false) { // dead code block — to be deleted
  const f5Summary = extractF5Summary(addbackDisclosure);
  const f6OwnerComp = extractF6OwnerComp(shareholder, ttmMonths);
  const f7Personal = extractF7PersonalByCategory(personal, ttmMonths);
  const f8NonRecur = extractF8NonRecurring(nonRecurring, ttmMonths);

  // Legacy extraction (fallback for older file formats)
  const f5OwnerTotals = extractTtmColumnTotals(addbackDisclosure, ttmMonths, "owner");
  const f6Totals = extractTtmColumnTotals(shareholder, ttmMonths);
  const ownerTotals = Object.keys(f6OwnerComp).length > 0
    ? Object.fromEntries(Object.entries(f6OwnerComp).map(([k, v]) => [v.name, v.ttmAmount]))
    : { ...f6Totals, ...f5OwnerTotals };
  const f5PersonalTotals = extractTtmColumnTotals(addbackDisclosure, ttmMonths, "personal");
  const f7Totals = extractTtmColumnTotals(personal, ttmMonths);
  const personalTotals = { ...f7Totals, ...f5PersonalTotals };
  const personalByCategory = Object.keys(f7Personal).length > 0
    ? Object.fromEntries(Object.entries(f7Personal).map(([k, v]) => [k, { description: v.category, glAccount: v.glAccount, ttmAmount: v.ttmAmount }]))
    : {} as Record<string, { description: string; glAccount: string; ttmAmount: number }>;
  // Non-recurring: merge F8 structured extraction with legacy F5 Sheet D extraction
  const nonRecurTotals: Record<string, number> = {};
  // From new F8 parser
  for (const item of f8NonRecur.expensesToAddBack) {
    nonRecurTotals[`${item.date} ${item.description.slice(0, 60)}`] = item.amount;
  }
  // Legacy extraction from F5 Sheet D (for older formats)
  if (Object.keys(nonRecurTotals).length === 0) {
    for (const doc of [addbackDisclosure, nonRecurring]) {
      if (!doc?.textBlocks?.length) continue;
      for (const block of doc.textBlocks) {
        if (!/non.recurring|repair|section d/i.test(block.sheetName) && !/non.recurring|repair|section d/i.test(block.text.slice(0, 200))) continue;
        const rows = parseCSVWithQuotes(block.text);
        for (const cells of rows) {
          const firstCell = (cells[0] ?? "").trim();
          if (!firstCell || /^(period|section|net ebitda|date|acct)/i.test(firstCell)) continue;
          if (/subtotal|total|combined/i.test(firstCell)) continue;
          const mm = firstCell.match(/(\w{3})-(\d{4})/);
          if (!mm) continue;
          const monthKey = `${mm[2]}-${MONTH_MAP[mm[1].toLowerCase()] ?? "00"}`;
          if (!ttmMonths.includes(monthKey)) continue;
          const directionCell = cells.find(c => /add back/i.test(c));
          if (!directionCell) continue;
          const amountCell = cells.find(c => {
            const cleaned = c.replace(/[$,"\s]/g, "");
            const num = Number(cleaned);
            return Number.isFinite(num) && num > 100 && (num < 2018 || num > 2030);
          });
          if (!amountCell) continue;
          const amount = Number(amountCell.replace(/[$,"\s]/g, ""));
          if (!Number.isFinite(amount) || amount <= 0) continue;
          const desc = (cells[2] ?? cells[1] ?? firstCell).replace(/"/g, "").trim().slice(0, 60);
          nonRecurTotals[`${firstCell} ${desc}`] = amount;
          console.log(`[WS2-2 Extract] Non-recurring TTM item (legacy): ${firstCell} — $${amount} — ${desc}`);
        }
      }
    }
  }

  // ── GL-BASED EXTRACTION FROM F1 P&L (via WS2-1 mapped rows) ──────────────
  // Build per-GL-account TTM amounts so the LLM can apply full normalization.
  const { ADD_BACK_CODES: addBackCodes, TAXONOMY_BY_CODE: taxByCode } = require("@/lib/ttm-agent/taxonomy");
  const mappedPlRows = (args.analysis.normalizedData?.mappedPlRows ?? []) as Array<{
    cantaraCode: string | null;
    accountName: string;
    accountCode?: string | null;
    valuesByMonth: Record<string, number>;
  }>;

  // Build per-account TTM summary from F1 GL data
  const glAccountSummary: Array<{ accountCode: string; accountName: string; cantaraCode: string; ttm: number; fy3: number; fy2: number; fy1: number }> = [];

  const annualYears = args.analysis.annualModel?.years ?? [];
  const fyMonthRanges = annualYears.map(y => {
    const months: string[] = [];
    if (!y.periodStart || !y.periodEnd) return months;
    let [yr, mo] = y.periodStart.split("-").map(Number);
    const [eyr, emo] = y.periodEnd.split("-").map(Number);
    while (yr < eyr || (yr === eyr && mo <= emo)) {
      months.push(`${yr}-${String(mo).padStart(2, "0")}`);
      mo++; if (mo > 12) { mo = 1; yr++; }
    }
    return months;
  });

  // Build per-account GL summary for the LLM
  for (const row of mappedPlRows) {
    if (!row.cantaraCode || !row.accountName) continue;
    const ttm = ttmMonths.reduce((sum, m) => sum + (row.valuesByMonth?.[m] ?? 0), 0);
    const byFy = fyMonthRanges.map(months =>
      months.reduce((sum, m) => sum + (row.valuesByMonth?.[m] ?? 0), 0)
    );
    if (ttm !== 0 || byFy.some(v => v !== 0)) {
      glAccountSummary.push({
        accountCode: row.accountCode ?? "",
        accountName: row.accountName,
        cantaraCode: row.cantaraCode,
        ttm,
        fy3: byFy[2] ?? 0,
        fy2: byFy[1] ?? 0,
        fy1: byFy[0] ?? 0,
      });
    }
  }
  console.log(`[WS2-2 Extract] GL account summary: ${glAccountSummary.length} accounts with non-zero values`);

  // Sum GL amounts for each add-back code, per period
  const addBackByCode: Record<string, { label: string; ttm: number; fy1: number; fy2: number; fy3: number }> = {};
  for (const code of addBackCodes as string[]) {
    const rows = mappedPlRows.filter(r => r.cantaraCode === code);
    if (rows.length === 0) continue;
    const ttm = rows.reduce((sum, r) => sum + ttmMonths.reduce((ms, m) => ms + (r.valuesByMonth?.[m] ?? 0), 0), 0);
    const byFy = fyMonthRanges.map(months =>
      rows.reduce((sum, r) => sum + months.reduce((ms, m) => ms + (r.valuesByMonth?.[m] ?? 0), 0), 0)
    );
    const entry = taxByCode[code];
    addBackByCode[code] = {
      label: entry?.category ?? code,
      ttm,
      fy1: byFy[0] ?? 0,
      fy2: byFy[1] ?? 0,
      fy3: byFy[2] ?? 0,
    };
    console.log(`[WS2-2 Extract] ADD-BACK ${code} (${entry?.category}): TTM=$${ttm.toFixed(0)}, FY3=$${(byFy[2] ?? 0).toFixed(0)}, FY2=$${(byFy[1] ?? 0).toFixed(0)}, FY1=$${(byFy[0] ?? 0).toFixed(0)}`);
  }

  const totalAddBackTtm = Object.values(addBackByCode).reduce((s, v) => s + v.ttm, 0);
  console.log(`[WS2-2 Extract] Total add-back from GL codes: TTM=$${totalAddBackTtm.toFixed(0)}`);

  const allExtracted = {
    ownerCompensation: ownerTotals,
    personalExpenses: personalTotals,
    nonRecurring: nonRecurTotals,
    addBackByCode,
    ttmWindow: ttmMonths.length > 0 ? `${ttmMonths[0]} to ${ttmMonths[ttmMonths.length - 1]}` : "unknown",
  };

  console.log("[WS2-2] Deterministic extraction:", JSON.stringify({ ...allExtracted, addBackByCode: "see ADD-BACK logs" }));

  const fyLabels = annualYears.map(y => y.fiscalYear ?? y.periodStart?.slice(0, 4) ?? "FY");

  // ── BUILD DETERMINISTIC NORMALIZATION SCHEDULE ─────────────────────────
  // Compute exact add-back amounts from GL data. The LLM formats these — it does NOT choose amounts.
  type NormLine = { id: string; category: string; description: string; glRef: string; ltm: number; fy3: number; fy2: number; fy1: number; status: string };
  const normLines: NormLine[] = [];
  let lineNum = 0;

  // Helper: sum a GL account across months
  const sumAccount = (acctCode: string, months: string[]) => {
    return glAccountSummary
      .filter(a => a.accountCode === acctCode)
      .reduce((s, a) => s + months.reduce((ms, m) => ms + (a.ttm !== undefined ? 0 : 0), 0), 0); // placeholder
  };

  // Category 1: Owner comp — use GL amounts for each account in OPX-LABOR-OWN
  const ownerAccounts = glAccountSummary.filter(a => a.cantaraCode === "OPX-LABOR-OWN");
  for (const acct of ownerAccounts) {
    lineNum++;
    normLines.push({
      id: `1${String.fromCharCode(96 + lineNum)}`,
      category: "Owner / Officer Compensation",
      description: acct.accountName,
      glRef: acct.accountCode,
      ltm: acct.ttm, fy3: acct.fy3, fy2: acct.fy2, fy1: acct.fy1,
      status: "VERIFIED",
    });
  }
  // Add consulting if not already in OPX-LABOR-OWN
  const consultingAccounts = glAccountSummary.filter(a => /consult/i.test(a.accountName) && a.cantaraCode !== "OPX-LABOR-OWN");
  for (const acct of consultingAccounts) {
    lineNum++;
    normLines.push({
      id: `1${String.fromCharCode(96 + lineNum)}`,
      category: "Owner / Officer Compensation",
      description: acct.accountName,
      glRef: acct.accountCode,
      ltm: acct.ttm, fy3: acct.fy3, fy2: acct.fy2, fy1: acct.fy1,
      status: "VERIFIED",
    });
  }
  // Replacement salary
  normLines.push({
    id: `1${String.fromCharCode(96 + lineNum + 1)}`,
    category: "Owner / Officer Compensation",
    description: "Owner Replacement Salary",
    glRef: "—",
    ltm: 0, fy3: -20000, fy2: -20000, fy1: -20000,
    status: "DEFAULT",
  });

  // Category 2: Personal expenses from F7 + full GL normalization
  lineNum = 0;
  // F7 disclosed personal items
  for (const [cat, data] of Object.entries(f7Personal)) {
    lineNum++;
    normLines.push({
      id: `2${String.fromCharCode(96 + lineNum)}`,
      category: "Personal Expenses",
      description: cat,
      glRef: data.glAccount || "—",
      ltm: data.ttmAmount, fy3: data.ttmAmount, fy2: 0, fy1: 0, // F7 only has TTM; per-year needs GL
      status: "VERIFIED",
    });
  }

  // GL categories to normalize (full amounts from P&L)
  const glNormCategories: Array<{ code: string; label: string }> = [
    { code: "OPX-REPAIR", label: "Total Repairs & Maintenance" },
    { code: "OPX-SUPPLY", label: "Total Supplies" },
    { code: "OPX-UTIL", label: "Total Utilities" },
    { code: "OPX-PROF", label: "Professional Fees" },
    { code: "OPX-VET", label: "Emergency Vet" },
    { code: "OPX-SOFT", label: "Dues & Subscriptions" },
  ];
  for (const { code, label } of glNormCategories) {
    const accounts = glAccountSummary.filter(a => a.cantaraCode === code);
    const ttm = accounts.reduce((s, a) => s + a.ttm, 0);
    const fy3 = accounts.reduce((s, a) => s + a.fy3, 0);
    const fy2 = accounts.reduce((s, a) => s + a.fy2, 0);
    const fy1 = accounts.reduce((s, a) => s + a.fy1, 0);
    if (ttm !== 0 || fy3 !== 0 || fy2 !== 0 || fy1 !== 0) {
      lineNum++;
      normLines.push({
        id: `2${String.fromCharCode(96 + lineNum)}`,
        category: "Personal Expenses",
        description: label,
        glRef: code,
        ltm: ttm, fy3: fy3, fy2: fy2, fy1: fy1,
        status: "FROM-GL",
      });
    }
  }

  // Category 3: Non-recurring from F8
  lineNum = 0;
  for (const item of f8NonRecur.expensesToAddBack) {
    lineNum++;
    normLines.push({
      id: `3${String.fromCharCode(96 + lineNum)}`,
      category: "One-Off Expenses",
      description: item.description.slice(0, 60),
      glRef: "F8",
      ltm: item.amount, fy3: item.amount, fy2: 0, fy1: 0,
      status: "VERIFIED",
    });
  }

  // Compute totals
  const totalLtm = normLines.reduce((s, l) => s + l.ltm, 0);
  const totalFy3 = normLines.reduce((s, l) => s + l.fy3, 0);
  const totalFy2 = normLines.reduce((s, l) => s + l.fy2, 0);
  const totalFy1 = normLines.reduce((s, l) => s + l.fy1, 0);
  const normEbitdaLtm = (args.analysis.ttmSummary?.ebitdaPreRecast ?? 0) + totalLtm;
  const multiple = args.assumptions.multipleMid ?? 0;

  console.log(`[WS2-2] Deterministic normalization: ${normLines.length} lines, total add-backs LTM=$${totalLtm.toFixed(0)}, normalized EBITDA=$${normEbitdaLtm.toFixed(0)}`);
  for (const line of normLines) {
    console.log(`[WS2-2]   ${line.id} ${line.description}: LTM=$${line.ltm.toFixed(0)}`);
  }

  const disclosureOwnerTotal = Object.values(ownerTotals).reduce((s, v) => s + v, 0);
  const ownerCompFromGL = addBackByCode["OPX-LABOR-OWN"]?.ttm ?? 0;
  const ownerCompBest = Math.max(ownerCompFromGL, disclosureOwnerTotal);

  // F5 gives us the 36-month master list; F7 gives us TTM per-category
  const f5PersonalItems = f5Summary.personalExpenses;
  const f7PersonalItems = Object.values(personalByCategory);
  const hasF7Detail = f7PersonalItems.length > 0;

  const f8ExpenseTotal = f8NonRecur.expensesToAddBack.reduce((s, v) => s + v.amount, 0);
  const f8IncomeTotal = f8NonRecur.incomeToRemove.reduce((s, v) => s + v.amount, 0);

  // Build GL account detail for normalization categories
  const normCategories = ["OPX-LABOR-OWN", "OPX-LABOR-TAX", "OPX-DONAT", "OPX-GIFTS", "OPX-VET", "OPX-VET-OWNER", "OPX-PROF", "OPX-PROF-OWNER", "OPX-MEALS", "OPX-MEALS-OWNER", "OPX-TRAVEL", "OPX-TRAVEL-OWNER", "OPX-REPAIR", "OPX-REPAIR-OWNER", "OPX-SUPPLY", "OPX-SUPPLY-OWNER", "OPX-UTIL", "OPX-UTIL-OWNER", "OPX-MKTG", "OPX-SOFT", "OPX-DUES-OWNER", "OPX-OFFICE-OWNER", "OPX-POSTAGE-OWNER", "OPX-BANK", "OPX-OTHER"];
  const glByCategory = normCategories.map(code => {
    const accounts = glAccountSummary.filter(a => a.cantaraCode === code);
    const ttm = accounts.reduce((s, a) => s + a.ttm, 0);
    return { code, accounts, ttm };
  }).filter(c => c.accounts.length > 0);

  // Format the deterministic schedule as a table for the prompt
  const fmt$ = (v: number) => v < 0 ? `-$${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const deterministicSchedule = [
    `| # | Category | Item Description | GL Reference | LTM | FY3 | FY2 | FY1 | Status |`,
    `|---|---|---|---|---|---|---|---|---|`,
    `| — | — | Revenue | — | ${fmt$(args.analysis.ttmSummary?.totalRevenue ?? 0)} | ${fmt$(annualYears[2]?.totalRevenue ?? 0)} | ${fmt$(annualYears[1]?.totalRevenue ?? 0)} | ${fmt$(annualYears[0]?.totalRevenue ?? 0)} | — |`,
    `| — | — | Net Income/EBITDA (Pre-Recast) | — | ${fmt$(args.analysis.ttmSummary?.ebitdaPreRecast ?? 0)} | ${fmt$(annualYears[2]?.ebitdaPreRecast ?? 0)} | ${fmt$(annualYears[1]?.ebitdaPreRecast ?? 0)} | ${fmt$(annualYears[0]?.ebitdaPreRecast ?? 0)} | — |`,
    ...normLines.map(l => `| ${l.id} | ${l.category} | ${l.description} | ${l.glRef} | ${fmt$(l.ltm)} | ${fmt$(l.fy3)} | ${fmt$(l.fy2)} | ${fmt$(l.fy1)} | ${l.status} |`),
    `| — | **TOTAL ADD-BACKS** | | | **${fmt$(totalLtm)}** | **${fmt$(totalFy3)}** | **${fmt$(totalFy2)}** | **${fmt$(totalFy1)}** | |`,
    `| — | **NORMALIZED / RECAST EBITDA** | | | **${fmt$(normEbitdaLtm)}** | **${fmt$((annualYears[2]?.ebitdaPreRecast ?? 0) + totalFy3)}** | **${fmt$((annualYears[1]?.ebitdaPreRecast ?? 0) + totalFy2)}** | **${fmt$((annualYears[0]?.ebitdaPreRecast ?? 0) + totalFy1)}** | |`,
    `| — | Multiple | | | ${Number(multiple).toFixed(1)}x | ${Number(multiple).toFixed(1)}x | ${Number(multiple).toFixed(1)}x | ${Number(multiple).toFixed(1)}x | |`,
    `| — | **Valuation** | | | **${fmt$(normEbitdaLtm * multiple)}** | **${fmt$((annualYears[2]?.ebitdaPreRecast ?? 0 + totalFy3) * multiple)}** | **${fmt$((annualYears[1]?.ebitdaPreRecast ?? 0 + totalFy2) * multiple)}** | **${fmt$((annualYears[0]?.ebitdaPreRecast ?? 0 + totalFy1) * multiple)}** | |`,
  ].join("\n");

  content.push({
    type: "text",
    text: `=== PRE-COMPUTED NORMALIZATION SCHEDULE (USE EXACTLY AS-IS) ===
The system has computed the normalization schedule from GL data and seller disclosures. Your job is to OUTPUT this exact schedule in the EBITDA RECAST SCHEDULE section. Do NOT change any amounts — they are computed from the authoritative GL P&L data.

## EBITDA RECAST SCHEDULE

${deterministicSchedule}

=== ADDITIONAL CONTEXT (for flag generation and narrative only) ===

IMPORTANT: Apply normalization from the GL P&L data below. The GL amounts from F1 are the AUTHORITATIVE source for dollar amounts. F5-F9 disclosure files tell you WHICH items are personal — the GL tells you HOW MUCH.

=== GL ACCOUNT DETAIL BY CATEGORY (from F1 via WS2-1) ===
${glByCategory.map(cat => {
  const label = taxByCode[cat.code]?.category ?? cat.code;
  return `\n${label} [${cat.code}] — TTM Total: $${cat.ttm.toLocaleString("en-US", { maximumFractionDigits: 0 })}\n${cat.accounts.map(a =>
    `  ${a.accountCode ? a.accountCode + " " : ""}${a.accountName}: LTM=$${a.ttm.toLocaleString("en-US", { maximumFractionDigits: 0 })} | ${fyLabels[2] ?? "FY3"}=$${a.fy3.toLocaleString("en-US", { maximumFractionDigits: 0 })} | ${fyLabels[1] ?? "FY2"}=$${a.fy2.toLocaleString("en-US", { maximumFractionDigits: 0 })} | ${fyLabels[0] ?? "FY1"}=$${a.fy1.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
  ).join("\n")}`;
}).join("\n")}

=== CATEGORY 1: OWNER COMPENSATION ===
Use the GL amounts above for each owner comp account. The GL includes year-end true-ups (e.g., S-Corp Health Insurance annual adjustment) that F6 transaction detail may not capture.
F6 sub-items for reference: ${Object.entries(ownerTotals).map(([name, val]) => `${name}: $${val.toLocaleString("en-US", { maximumFractionDigits: 0 })}`).join(", ") || "none extracted"}
F5 36-mo totals: ${f5Summary.ownerComp.map(i => `${i.name}: $${i.total.toLocaleString("en-US", { maximumFractionDigits: 0 })}`).join(", ") || "none"}
→ For each owner comp GL account (OPX-LABOR-OWN), use the GL TTM amount as the add-back. These are the actual P&L amounts including year-end adjustments.

=== CATEGORY 2: PERSONAL EXPENSES ===
The seller disclosed these personal expenses (F5 Section B / F7):
${hasF7Detail ? f7PersonalItems.map(item =>
  `  ${item.description} (${item.glAccount || "n/a"}): TTM=$${item.ttmAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
).join("\n") : "  No F7 detail extracted."}
${f5PersonalItems.length > 0 ? `F5 36-mo totals:\n${f5PersonalItems.map(i => `  ${i.acctNum} ${i.name}: $${i.total.toLocaleString("en-US", { maximumFractionDigits: 0 })}`).join("\n")}` : ""}

ADDITIONALLY — apply full normalization to these P&L categories using GL amounts above:
- Total Repairs & Maintenance (OPX-REPAIR): add back FULL GL amount
- Total Supplies (OPX-SUPPLY): add back FULL GL amount
- Total Utilities (OPX-UTIL): add back FULL GL amount
- Professional Fees (OPX-PROF): add back FULL GL amount
- Marketing & Advertising (OPX-MKTG): add back FULL GL amount if seller identified as personal
- Office/Admin expenses: add back from GL
- Postage & Delivery: add back from GL
- Emergency Vet (OPX-VET): add back FULL GL amount
→ Use the exact GL amounts from the account detail above for each line item.

=== CATEGORY 3: NON-RECURRING ITEMS ===
${f8NonRecur.expensesToAddBack.length > 0 ? `Expenses to ADD BACK (from F8):\n${f8NonRecur.expensesToAddBack.map(i => `  ${i.date}: ${i.description} — $${i.amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`).join("\n")}` : "No non-recurring expenses in TTM."}
${f8NonRecur.incomeToRemove.length > 0 ? `Income to REMOVE (from F8):\n${f8NonRecur.incomeToRemove.map(i => `  ${i.date}: ${i.description} — $${i.amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`).join("\n")}` : "No non-recurring income in TTM."}
${Object.keys(nonRecurTotals).length > 0 && f8NonRecur.expensesToAddBack.length === 0 ? `Legacy:\n${Object.entries(nonRecurTotals).map(([desc, val]) => `  ${desc}: $${val.toLocaleString("en-US", { maximumFractionDigits: 0 })}`).join("\n")}` : ""}
→ Do NOT double-count repairs that are already in Category 2.

=== CATEGORY 4: TENANT IMPROVEMENTS ===
${f5Summary.tenantImprovements.length > 0 ? f5Summary.tenantImprovements.map(i => `  ${i.name}: $${i.total.toLocaleString("en-US", { maximumFractionDigits: 0 })}`).join("\n") : "No tenant improvement add-backs."}

=== REPLACEMENT SALARY ===
$0 for LTM, -$20,000 for each prior FY (or Admin override).

=== ADMIN INPUTS ===
${JSON.stringify(args.assumptions, null, 2)}`,
  });
  } // end SKIP_OLD_EXTRACTION

  // ── NEW: Clean prompt using deterministic schedule ──────────────────────
  content.push({
    type: "text",
    text: `=== PRE-COMPUTED NORMALIZATION SCHEDULE ===
The system computed this schedule from the P&L GL data (owner comp) and the seller's personal expense disclosure. Output it in the EBITDA RECAST SCHEDULE section. Do NOT change any amounts.

## EBITDA RECAST SCHEDULE

${schedule.scheduleMarkdown}

Your job: wrap this schedule in the standard WS2-2 report format (STARTING POINT, CATEGORIES, FLAG LIST, SUMMARY). Flag any items that look unusual. Do not recalculate amounts.

=== ADMIN INPUTS ===
${JSON.stringify(args.assumptions, null, 2)}`,
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
  const hasAnyAddbackDocs =
    preparedMap.has("personal_expenses_36m") ||
    preparedMap.has("non_recurring_expenses_36m") ||
    preparedMap.has("addback_disclosure"); // legacy fallback

  if (!hasAnyAddbackDocs) {
    console.warn("[WS2-2] No addback documents uploaded — recast will run using only P&L-extracted data (no separate personal/non-recurring expense files).");
  }

  const existingRecords = await (prisma as any).ws2RecastAnalysis.findMany({
    where: { ttmAnalysisId: args.analysisId },
    select: { version: true },
    orderBy: { version: "desc" },
    take: 1,
  });
  const existingCount = existingRecords[0]?.version ?? 0;

  if (!isFiniteNumber(args.assumptions.multipleLow) || !isFiniteNumber(args.assumptions.multipleMid) || !isFiniteNumber(args.assumptions.multipleHigh)) {
    throw new TtmOrchestratorError("Admin must provide low, mid, and high valuation multiples before WS2-2 can run.", 400);
  }
  if (args.assumptions.multipleLow <= 0 || args.assumptions.multipleMid <= 0 || args.assumptions.multipleHigh <= 0) {
    throw new TtmOrchestratorError("Valuation multiples must be positive numbers.", 400);
  }
  if (!(args.assumptions.multipleLow <= args.assumptions.multipleMid && args.assumptions.multipleMid <= args.assumptions.multipleHigh)) {
    throw new TtmOrchestratorError("Admin's valuation multiples must be ordered low ≤ mid ≤ high.", 400);
  }

  // Owner replacement salary not provided → default to $0 for LTM, $20K for prior FY
  const normalizedAssumptions = { ...args.assumptions };
  let usedDefaultSalary = false;
  if (normalizedAssumptions.replacementSalary == null) {
    normalizedAssumptions.replacementSalary = 0;
    usedDefaultSalary = true;
    console.warn(`[TTM] ⚠ Owner replacement salary not provided. Defaulting to $0 for LTM, $20K for prior years.`);
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
    // ── LLM-only recast path (PRIMARY) — old deterministic is silent fallback ──
    let reportMarkdown: string;
    let metrics: ReturnType<typeof extractWs2RecastMetrics>;
    let flagPayloads: Array<{ title: string; description: string; severity: FlagSeverity; payload: Record<string, unknown> }>;
    let llmValuationResult: ValuationResult | null = null;

    const llmExtractionData = (analysis.normalizedData as any)?.llmExtraction as ExtractedFinancials | undefined;
    let usedLlmPath = false;

    if (llmExtractionData && llmExtractionData.periods?.length > 0 && llmExtractionData.annualData?.length > 0) {
      try {
        console.log(`[WS2-2] Using LLM-ONLY recast path (${llmExtractionData.periods.length} periods from WS2-1 LLM extraction)`);

        // Build owner expenses text from prepared documents for LLM addback extraction
        const llmPreparedMap = buildPreparedDocumentMap(args.preparedDocuments);
        const personalDoc = llmPreparedMap.get("personal_expenses_36m");
        const nonRecurringDoc = llmPreparedMap.get("non_recurring_expenses_36m");
        const addbackDoc = llmPreparedMap.get("addback_disclosure");

        const ownerExpensesText = [personalDoc, addbackDoc]
          .filter(Boolean)
          .flatMap((doc) => (doc!.textBlocks ?? []).map((block) => `--- SHEET: ${block.sheetName} ---\n${block.text}`))
          .join("\n\n") || null;

        const oneOffText = nonRecurringDoc
          ? (nonRecurringDoc.textBlocks ?? []).map((block) => `--- SHEET: ${block.sheetName} ---\n${block.text}`).join("\n\n")
          : null;

        {
          // Build P&L expense breakdown text so LLM can scan for additional personal/owner expenses
          const plExpenseLines: string[] = [];
          for (const annual of llmExtractionData.annualData) {
            if (annual.expenseBreakdown?.length) {
              plExpenseLines.push(`\n${annual.period}:`);
              for (const exp of annual.expenseBreakdown) {
                plExpenseLines.push(`  ${exp.category}: $${Math.abs(exp.amount).toLocaleString()}`);
              }
            }
          }
          const plExpenseData = plExpenseLines.length > 0 ? plExpenseLines.join("\n") : null;

          let addbacks: ExtractedAddbacks;
          if (ownerExpensesText) {
            addbacks = await extractAddbacksWithLLM(ownerExpensesText, oneOffText, llmExtractionData.periods, plExpenseData);
            console.log(`[WS2-2] LLM addback extraction: ${addbacks.sourceA.length} Source A, ${addbacks.sourceB.length} Source B, ${addbacks.sourceC.length} Source C`);
          } else if (plExpenseData) {
            // No personal expenses file — use only P&L-extracted data for addback scanning
            console.log(`[WS2-2] No personal expenses file uploaded — running addback extraction from P&L data only`);
            addbacks = await extractAddbacksWithLLM("(No owner/personal expenses file provided. Scan the P&L data below for any personal/owner expenses.)", oneOffText, llmExtractionData.periods, plExpenseData);
            console.log(`[WS2-2] P&L-only addback extraction: ${addbacks.sourceA.length} Source A, ${addbacks.sourceB.length} Source B, ${addbacks.sourceC.length} Source C`);
          } else {
            // No addback documents and no P&L data — use empty addbacks
            console.warn(`[WS2-2] No addback documents or P&L expense data — running with zero addbacks`);
            addbacks = { sourceA: [], sourceB: [], sourceC: [], notes: ["No personal expenses or non-recurring expenses files were uploaded. Recast uses only base financials."] };
          }

          llmValuationResult = computeValuation(llmExtractionData, addbacks, {
            multipleLow: normalizedAssumptions.multipleLow,
            multipleMid: normalizedAssumptions.multipleMid,
            multipleHigh: normalizedAssumptions.multipleHigh,
            replacementSalary: normalizedAssumptions.replacementSalary ?? 20_000,
          });
          console.log(`[WS2-2] LLM valuation computed: Normalized EBITDA by period = ${JSON.stringify(llmValuationResult.normalizedEbitda)}`);

          // LLM ValuationResult is the SOLE source of truth — no old deterministic schedule
          const llmNormEbitda = llmValuationResult.normalizedEbitda["LTM"] ?? llmValuationResult.normalizedEbitda["FY3"] ?? null;
          const llmValLow = llmValuationResult.valuation["LTM"]?.low ?? llmValuationResult.valuation["FY3"]?.low ?? null;
          const llmValMid = llmValuationResult.valuation["LTM"]?.mid ?? llmValuationResult.valuation["FY3"]?.mid ?? null;
          const llmValHigh = llmValuationResult.valuation["LTM"]?.high ?? llmValuationResult.valuation["FY3"]?.high ?? null;

          metrics = {
            startingEbitda: llmValuationResult.preRecast["LTM"] ?? llmValuationResult.preRecast["FY3"] ?? null,
            normalizedEbitda: llmNormEbitda,
            valuationLow: llmValLow,
            valuationMid: llmValMid,
            valuationHigh: llmValHigh,
          } as any;

          // Generate report markdown directly from LLM ValuationResult — skip old Claude report prompt
          const periodKeys = Object.keys(llmValuationResult.normalizedEbitda);
          const normLinesMd = llmValuationResult.normLines
            .map((line) => {
              const amounts = periodKeys.map((pk) => `$${((line.byPeriod?.[pk] ?? 0)).toLocaleString("en-US", { maximumFractionDigits: 0 })}`).join(" | ");
              return `| ${line.description} | ${amounts} | ${line.source ?? ""} |`;
            })
            .join("\n");
          const headerCols = periodKeys.join(" | ");
          reportMarkdown = [
            `## EBITDA RECAST SCHEDULE`,
            ``,
            `| Normalization Items | ${headerCols} | Source |`,
            `|---|${periodKeys.map(() => "---:").join("|")}|---|`,
            `| **Net Income (Pre-Recast)** | ${periodKeys.map((pk) => `**$${(llmValuationResult!.preRecast[pk] ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}**`).join(" | ")} | |`,
            normLinesMd,
            `| **Total Adjustments** | ${periodKeys.map((pk) => `**$${(llmValuationResult!.normLines.reduce((s, l) => s + (l.byPeriod?.[pk] ?? 0), 0)).toLocaleString("en-US", { maximumFractionDigits: 0 })}**`).join(" | ")} | |`,
            `| **Revised Net Income / EBITDA** | ${periodKeys.map((pk) => `**$${(llmValuationResult!.normalizedEbitda[pk] ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}**`).join(" | ")} | |`,
            ``,
            `## PRELIMINARY VALUATION`,
            ``,
            `| Metric | ${headerCols} |`,
            `|---|${periodKeys.map(() => "---:").join("|")}|`,
            `| Normalized EBITDA | ${periodKeys.map((pk) => `$${(llmValuationResult!.normalizedEbitda[pk] ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`).join(" | ")} |`,
            `| 4-Wall EBITDA | ${periodKeys.map((pk) => `$${(llmValuationResult!.fourWallEbitda?.[pk] ?? llmValuationResult!.normalizedEbitda[pk] ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`).join(" | ")} |`,
            `| Multiple | ${normalizedAssumptions.multipleLow?.toFixed(1)}x – ${normalizedAssumptions.multipleHigh?.toFixed(1)}x |`,
            `| Valuation (Low) | ${periodKeys.map((pk) => `$${(llmValuationResult!.valuation[pk]?.low ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`).join(" | ")} |`,
            `| Valuation (Mid) | ${periodKeys.map((pk) => `$${(llmValuationResult!.valuation[pk]?.mid ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`).join(" | ")} |`,
            `| Valuation (High) | ${periodKeys.map((pk) => `$${(llmValuationResult!.valuation[pk]?.high ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`).join(" | ")} |`,
          ].join("\n");

          flagPayloads = [];

          // Add LLM-specific flags for addback notes
          for (const note of addbacks.notes) {
            flagPayloads.push({
              title: "LLM addback extraction note",
              description: note,
              severity: /critical|error|missing/i.test(note) ? "HIGH" : "LOW",
              payload: { source: "LLM_ADDBACK_EXTRACTION", noteText: note },
            });
          }

          usedLlmPath = true;
          console.log(`[WS2-2] LLM-ONLY path succeeded: normalizedEbitda=${llmNormEbitda}, valuationMid=${llmValMid}`);
        }
      } catch (llmRecastError) {
        const llmMsg = llmRecastError instanceof Error ? llmRecastError.message : "Unknown LLM recast error";
        console.warn(`[WS2-2] LLM recast failed (falling back to deterministic): ${llmMsg}`);
        usedLlmPath = false;
      }
    } else if (llmExtractionData) {
      console.log(`[WS2-2] LLM extraction exists but has no periods/annualData — falling back to deterministic`);
    } else {
      console.log(`[WS2-2] No LLM extraction data (pre-LLM run) — using deterministic path`);
    }

    // ── Deterministic fallback (ONLY used when LLM extraction is missing or failed) ──
    if (!usedLlmPath) {
      const rawReportMarkdown = await generateWs22Report(
        await buildWs22PromptContent({
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
      reportMarkdown = corrected.reportMarkdown;
      metrics = corrected.metrics;
      flagPayloads = [
        ...extractWs2RecastFlagPayloads(reportMarkdown),
        ...corrected.extraFlags,
      ];
    }

    // V3 Section 10: Default salary flag
    if (usedDefaultSalary) {
      flagPayloads.push({
        title: "Owner replacement salary defaulted to $0 for LTM",
        description: "No replacement salary was provided by Admin. Per Cantara methodology, LTM uses $0 replacement salary. Prior fiscal years use -$20,000/year default. Admin should verify.",
        severity: "MEDIUM" as const,
        payload: { source: "SYSTEM_DEFAULT", defaultAmount: 0 },
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
            ...(llmValuationResult ? { llmValuationResult } : {}),
          },
          normalizedEbitda: metrics.normalizedEbitda,
          // Deterministic fallback: if Claude's report didn't yield valuation but we have EBITDA + multiples, calculate directly
          valuationLow: metrics.valuationLow ?? (metrics.normalizedEbitda != null && normalizedAssumptions.multipleLow != null ? metrics.normalizedEbitda * normalizedAssumptions.multipleLow : null),
          valuationMid: metrics.valuationMid ?? (metrics.normalizedEbitda != null && normalizedAssumptions.multipleMid != null ? metrics.normalizedEbitda * normalizedAssumptions.multipleMid : null),
          valuationHigh: metrics.valuationHigh ?? (metrics.normalizedEbitda != null && normalizedAssumptions.multipleHigh != null ? metrics.normalizedEbitda * normalizedAssumptions.multipleHigh : null),
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

export async function addManualWs2RecastAddback(args: {
  recastAnalysisId: string;
  description: string;
  amount: number;
  source?: string | null;
  actorName?: string;
}) {
  const description = args.description.trim();
  const amount = args.amount;
  if (!description) {
    throw new TtmOrchestratorError("Add-back description is required.", 400);
  }
  if (!isFiniteNumber(amount) || amount === 0) {
    throw new TtmOrchestratorError("Add-back amount must be a non-zero number.", 400);
  }

  const updated = await (prisma as any).$transaction(async (tx: any) => {
    const recastRecord = await tx.ws2RecastAnalysis.findUnique({
      where: { id: args.recastAnalysisId },
      include: {
        flags: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!recastRecord) {
      throw new TtmOrchestratorError("WS2-2 analysis not found.", 404);
    }
    if (recastRecord.status === "APPROVED") {
      throw new TtmOrchestratorError("Approved valuations cannot be changed. Re-run valuation first.", 400);
    }

    const parsedReport = recastRecord.parsedReport && typeof recastRecord.parsedReport === "object"
      ? { ...(recastRecord.parsedReport as Record<string, unknown>) }
      : {};
    const assumptions = (recastRecord.assumptions ?? {}) as Ws2RecastAssumptions;
    const currentBase =
      isFiniteNumber(parsedReport.baseNormalizedEbitda) ? parsedReport.baseNormalizedEbitda :
      isFiniteNumber(parsedReport.normalizedEbitda) ? parsedReport.normalizedEbitda :
      recastRecord.normalizedEbitda ?? 0;
    const nextBase = currentBase + amount;
    const llmValuationResult = parsedReport.llmValuationResult && typeof parsedReport.llmValuationResult === "object"
      ? { ...(parsedReport.llmValuationResult as Record<string, any>) }
      : null;

    if (llmValuationResult) {
      const normLines = Array.isArray(llmValuationResult.normLines) ? [...llmValuationResult.normLines] : [];
      normLines.push({
        id: `manual-${Date.now()}`,
        description,
        source: args.source?.trim() || "Manual add-back",
        byPeriod: { LTM: amount },
      });
      llmValuationResult.normLines = normLines;
      llmValuationResult.normalizedEbitda = {
        ...(llmValuationResult.normalizedEbitda ?? {}),
        LTM: nextBase,
      };
      llmValuationResult.valuation = {
        ...(llmValuationResult.valuation ?? {}),
        LTM: {
          low: assumptions.multipleLow != null ? nextBase * assumptions.multipleLow : null,
          mid: assumptions.multipleMid != null ? nextBase * assumptions.multipleMid : null,
          high: assumptions.multipleHigh != null ? nextBase * assumptions.multipleHigh : null,
        },
      };
    }

    const nextParsedReport = {
      ...parsedReport,
      baseNormalizedEbitda: nextBase,
      normalizedEbitda: nextBase,
      baseValuationLow: assumptions.multipleLow != null ? nextBase * assumptions.multipleLow : null,
      baseValuationMid: assumptions.multipleMid != null ? nextBase * assumptions.multipleMid : null,
      baseValuationHigh: assumptions.multipleHigh != null ? nextBase * assumptions.multipleHigh : null,
      ...(llmValuationResult ? { llmValuationResult } : {}),
    };

    await tx.ws2RecastAnalysis.update({
      where: { id: args.recastAnalysisId },
      data: {
        hitlStatus: "IN_REVIEW",
        parsedReport: nextParsedReport,
        normalizedEbitda: nextBase,
        valuationLow: assumptions.multipleLow != null ? nextBase * assumptions.multipleLow : null,
        valuationMid: assumptions.multipleMid != null ? nextBase * assumptions.multipleMid : null,
        valuationHigh: assumptions.multipleHigh != null ? nextBase * assumptions.multipleHigh : null,
      },
    });

    await tx.ws2RecastFlag.create({
      data: {
        recastAnalysisId: args.recastAnalysisId,
        severity: "MEDIUM",
        title: `Manual add-back: ${description}`,
        description: args.source?.trim() || "Added manually by Admin because AI may have missed it.",
        payload: {
          source: "MANUAL_ADDBACK",
          description,
          dollarImpact: amount,
          sourceNote: args.source?.trim() || null,
          addedByName: args.actorName || "Admin",
        },
      },
    });

    return tx.ws2RecastAnalysis.findUnique({
      where: { id: args.recastAnalysisId },
      select: { ttmAnalysisId: true },
    });
  });

  if (!updated?.ttmAnalysisId) {
    throw new TtmOrchestratorError("Parent WS2-1 analysis not found after manual add-back.", 404);
  }
  const analysis = await getTtmAnalysis(updated.ttmAnalysisId);
  if (!analysis) {
    throw new TtmOrchestratorError("Parent WS2-1 analysis not found after manual add-back.", 404);
  }
  return analysis;
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

  const existingCompleteReport = analysis.derivedReports?.find(
    (report) => report.agentId === args.agentId && report.status === "COMPLETE",
  );
  if (args.agentId !== "ws2_10_report_generator_v1" && existingCompleteReport) {
    return analysis;
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
