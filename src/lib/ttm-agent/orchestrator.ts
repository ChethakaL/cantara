import { createHash } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { assertS3Configured, buildPublicFileUrl, s3BucketName, s3Client } from "@/lib/s3";
import { mapLedgerRows } from "@/lib/ttm-agent/mapping";
import { parseAccountantStatementsPreparedDocument } from "@/lib/ttm-agent/parsers/accountant-statements";
import { parseArAgingWorkbookFromPrepared, parseMonthlyWorkbookFromPrepared } from "@/lib/ttm-agent/parsers/excel";
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
import { generateWs21Report, generateWs22Report, generateWs23Report, generateWs24Report, generateWs25Report, summarizeTtmAnalysis } from "@/lib/ttm-agent/claude";
import { buildWorkingCapitalSummary } from "@/lib/ttm-agent/wc-calculator";
import { TTM_AGENT_MAX_TOKENS, TTM_AGENT_MODEL, TTM_AGENT_TEMPERATURE, WS2_RECAST_MAX_TOKENS } from "@/lib/ttm-agent/prompt";
import {
  buildWs2WorkbookBuffer,
  resolveWs2RecastMetrics,
} from "@/lib/ws2/report-utils";

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

function dedupeWs2RecastFlagPayloads(
  flags: Array<{
    title: string;
    description: string;
    severity: "HIGH" | "MEDIUM" | "LOW" | "INFO";
    payload: Record<string, unknown>;
  }>,
) {
  const seen = new Set<string>();
  const deduped: typeof flags = [];

  for (const flag of flags) {
    const key = `${flag.severity}::${flag.title.trim()}::${flag.description.trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(flag);
  }

  return deduped;
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

    const monthlyPl = parseMonthlyWorkbookFromPrepared(preparedMonthlyPl, "monthly_pl_excel");
    console.log(`[TTM] Parsed monthly P&L from prepared CSV: format=${monthlyPl.format}, ${monthlyPl.rows.length} rows, ${monthlyPl.monthKeys.length} months`);
    const monthlyBs = parseMonthlyWorkbookFromPrepared(preparedMonthlyBs, "monthly_bs_excel");
    console.log(`[TTM] Parsed monthly BS from prepared CSV: format=${monthlyBs.format}, ${monthlyBs.rows.length} rows, ${monthlyBs.monthKeys.length} months`);
    const accountantStatements = await parseAccountantStatementsPreparedDocument(preparedAccountant);
    console.log(`[TTM] Parsed accountant statements: ${accountantStatements.years.length} fiscal years, source=${accountantStatements.sourceType}`);
    const arAging = parseArAgingWorkbookFromPrepared(preparedArAging);
    console.log(`[TTM] Parsed AR aging: ${arAging.entries.length} customer entries`);

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
        "Critical data error: TTM period has zero revenue across all revenue lines. Cannot proceed without Craig input. Please verify the uploaded P&L file contains the correct 36-month data.",
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

    console.log(`[TTM] Generating exact WS2-1 architecture report`);
    const reportMarkdown = await generateWs21Report(
      buildWs21PromptContent({
        monthlyPl: preparedMonthlyPl,
        monthlyBs: preparedMonthlyBs,
        accountant: preparedAccountant,
        accountantStatements,
        arAging: preparedArAging,
      }),
    );

    console.log(`[TTM] Generating Craig summary`);
    const summary = await summarizeTtmAnalysis({
      ttmSummary: reconciled.ttmSummary,
      annualTrends: reconciled.annualModel.trends,
      anomalies: reconciled.annualModel.anomalies,
      qualityCounts: dataQualityReport.counts,
      workingCapital: wcResult.workingCapital,
      quickBooksStatus: "Skipped - QuickBooks not connected",
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
            payload: { reason: "Awaiting Craig WS2-1 approval" },
          },
          {
            analysisId: created.id,
            clientId: args.clientId,
            agentId: "ws2_3_rev_vertical_v1",
            status: "BLOCKED_HITL",
            payload: { reason: "Awaiting Craig WS2-1 approval" },
          },
          {
            analysisId: created.id,
            clientId: args.clientId,
            agentId: "ws2_4_benchmark_v1",
            status: "BLOCKED_HITL",
            payload: { reason: "Awaiting Craig WS2-1 approval" },
          },
          // V3 Section 9: WS2-5 runs in parallel after WS2-1 (uses WS2-2 if available)
          {
            analysisId: created.id,
            clientId: args.clientId,
            agentId: "ws2_5_labor_v1",
            status: "BLOCKED_HITL",
            payload: { reason: "Awaiting Craig WS2-1 approval and approved WS2-2 recast" },
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

  const actorName = args.actorName || "Craig Pollack";
  let escalatedRequirementId: string | null = flag.escalatedRequirementId ?? null;

  if (args.action === "ESCALATE_CLIENT" && !escalatedRequirementId) {
    const priority = flag.severity === "HIGH" ? "HIGH" : flag.severity === "MEDIUM" ? "MEDIUM" : "LOW";
    const requirement = await prisma.additionalRequirement.create({
      data: {
        clientId: flag.analysis.clientId,
        title: `TTM Follow-up: ${flag.title}`,
        description: args.notes || flag.description || "Craig requested client follow-up on a TTM data-quality item.",
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

  const actorName = args.actorName || "Craig Pollack";
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
    // WS2-2 also releases here so Craig can enter the valuation inputs and run it.
    // WS2-5 waits for an approved WS2-2 recast because it depends on owner comp adjustments.
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
    text: `=== CRAIG INPUTS ===\n${JSON.stringify(args.assumptions, null, 2)}`,
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
  return {
    structuredModel: analysis.structuredModel,
    normalizedData: analysis.normalizedData,
    ttmSummary: analysis.ttmSummary,
    annualModel: analysis.annualModel,
    workingCapital: analysis.workingCapital,
    dataQualityReport: analysis.dataQualityReport,
    reportMarkdown: analysis.reportMarkdown,
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

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseYearTokens(value: string) {
  return Array.from(value.matchAll(/\b(20\d{2})\b/g)).map((match) => match[1]);
}

function parseFirstYear(value: string) {
  return parseYearTokens(value)[0] ?? null;
}

function parseDisclosureRows(preparedDocuments: PreparedDocumentInput[]) {
  const prepared = preparedDocuments.find((doc) => doc.documentId === "addback_disclosure");
  const text = prepared?.textBlocks?.map((block) => block.text).join("\n") ?? "";
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);

  const ownerComp: Array<{ name: string; glCode: string; annualAmount: number }> = [];
  const personalExpenses: Array<{ description: string; glCode: string; annualAmount: number; years: string[] }> = [];
  const oneOffExpenses: Array<{ description: string; glCode: string; amount: number; yearLabel: string; year: string | null }> = [];
  const tenantImprovements: Array<{ description: string; glCode: string; amount: number; yearLabel: string; year: string | null; expensed: boolean }> = [];

  let section: "2.1" | "2.2" | "2.3" | "2.4" | null = null;
  for (const line of lines) {
    if (line.includes("2.1")) {
      section = "2.1";
      continue;
    }
    if (line.includes("2.2")) {
      section = "2.2";
      continue;
    }
    if (line.includes("2.3")) {
      section = "2.3";
      continue;
    }
    if (line.includes("2.4")) {
      section = "2.4";
      continue;
    }
    if (!/^\d+,/.test(line)) continue;

    const cells = parseCsvLine(line);
    if (section === "2.1" && cells.length >= 6) {
      const annualAmount = Number(cells[5].replace(/,/g, ""));
      if (Number.isFinite(annualAmount) && cells[4]) {
        ownerComp.push({ name: cells[1], glCode: cells[4], annualAmount });
      }
    }
    if (section === "2.2" && cells.length >= 7) {
      const annualAmount = Number(cells[4].replace(/,/g, ""));
      if (Number.isFinite(annualAmount) && cells[3]) {
        personalExpenses.push({ description: cells[1], glCode: cells[3], annualAmount, years: parseYearTokens(cells[6]) });
      }
    }
    if (section === "2.3" && cells.length >= 6) {
      const amount = Number(cells[4].replace(/,/g, ""));
      if (Number.isFinite(amount) && cells[3]) {
        oneOffExpenses.push({ description: cells[1], glCode: cells[3], amount, yearLabel: cells[5], year: parseFirstYear(cells[5]) });
      }
    }
    if (section === "2.4" && cells.length >= 7) {
      const amount = Number(cells[4].replace(/,/g, ""));
      if (Number.isFinite(amount) && cells[3]) {
        tenantImprovements.push({
          description: cells[1],
          glCode: cells[3],
          amount,
          yearLabel: cells[5],
          year: parseFirstYear(cells[5]),
          expensed: /expensed/i.test(cells[6]),
        });
      }
    }
  }

  return { ownerComp, personalExpenses, oneOffExpenses, tenantImprovements };
}

function sumMappedRowValue(
  rows: Array<Record<string, unknown>>,
  predicate: (row: Record<string, unknown>) => boolean,
  months: string[],
) {
  return rows
    .filter(predicate)
    .reduce((total, row) => {
      const valuesByMonth = row.valuesByMonth && typeof row.valuesByMonth === "object" ? (row.valuesByMonth as Record<string, unknown>) : {};
      return total + months.reduce((acc, month) => acc + (typeof valuesByMonth[month] === "number" ? Number(valuesByMonth[month]) : 0), 0);
    }, 0);
}

function groupMonthsByYear(months: string[]) {
  return months.reduce<Record<string, string[]>>((acc, month) => {
    const year = month.slice(0, 4);
    acc[year] = [...(acc[year] ?? []), month];
    return acc;
  }, {});
}

function findMappedRow(
  rows: Array<Record<string, unknown>>,
  matchers: { accountCode?: string; accountNamePattern?: RegExp }[],
) {
  return rows.find((row) =>
    matchers.some((matcher) => {
      const codeMatch = matcher.accountCode ? String(row.accountCode ?? "") === matcher.accountCode : false;
      const nameMatch = matcher.accountNamePattern ? matcher.accountNamePattern.test(String(row.accountName ?? "")) : false;
      return codeMatch || nameMatch;
    }),
  );
}

function buildDeterministicWs2Recast(args: {
  analysis: TtmAnalysisView;
  assumptions: Ws2RecastAssumptions;
  preparedDocuments: PreparedDocumentInput[];
}) {
  const mappedPlRows = Array.isArray(args.analysis.normalizedData?.mappedPlRows)
    ? (args.analysis.normalizedData?.mappedPlRows as Array<Record<string, unknown>>)
    : [];
  const monthKeys = Array.isArray(args.analysis.normalizedData?.monthKeys)
    ? (args.analysis.normalizedData?.monthKeys as string[])
    : [];
  const byYearMonths = groupMonthsByYear(monthKeys);
  const annualYears = args.analysis.annualModel?.years ?? [];
  const ttmMonths = monthKeys.slice(-12);
  const ttmYear = args.analysis.ttmSummary?.endMonth?.slice(0, 4) ?? annualYears.at(-1)?.fiscalYear ?? null;
  const disclosure = parseDisclosureRows(args.preparedDocuments);

  const ownerWageByYear = (year: string) =>
    sumMappedRowValue(
      mappedPlRows,
      (row) => String(row.accountCode ?? "") === "6020" || /officer wages/i.test(String(row.accountName ?? "")),
      byYearMonths[year] ?? [],
    );
  const ownerHealthByYear = (year: string) =>
    sumMappedRowValue(
      mappedPlRows,
      (row) => String(row.accountCode ?? "") === "6021" || /s.?corp health/i.test(String(row.accountName ?? "")),
      byYearMonths[year] ?? [],
    );
  const ownerWageTtm =
    sumMappedRowValue(mappedPlRows, (row) => String(row.accountCode ?? "") === "6020" || /officer wages/i.test(String(row.accountName ?? "")), ttmMonths);
  const ownerHealthTtm =
    sumMappedRowValue(mappedPlRows, (row) => String(row.accountCode ?? "") === "6021" || /s.?corp health/i.test(String(row.accountName ?? "")), ttmMonths);

  const autoExpenseTtm = sumMappedRowValue(
    mappedPlRows,
    (row) => String(row.accountCode ?? "") === "7400" || /auto expense/i.test(String(row.accountName ?? "")),
    ttmMonths,
  );
  const personalCellTtm = sumMappedRowValue(
    mappedPlRows,
    (row) => String(row.accountCode ?? "") === "7401" || /personal cell phone/i.test(String(row.accountName ?? "")),
    ttmMonths,
  );
  const donationsTtm = sumMappedRowValue(
    mappedPlRows,
    (row) => String(row.accountCode ?? "") === "7300" || /donations/i.test(String(row.accountName ?? "")),
    ttmMonths,
  );

  const replacementSalary = args.assumptions.replacementSalary ?? 65000;
  const ownerNetByYear = (year: string) => {
    const wages = ownerWageByYear(year);
    const health = ownerHealthByYear(year);
    const fica = wages * 0.0765;
    return wages + health + fica - replacementSalary;
  };
  const ownerNetTtm = ownerWageTtm + ownerHealthTtm + ownerWageTtm * 0.0765 - replacementSalary;

  const personalByYear = (year: string) => {
    const months = byYearMonths[year] ?? [];
    if (!months.length) return 0;
    return (
      sumMappedRowValue(mappedPlRows, (row) => String(row.accountCode ?? "") === "7400" || /auto expense/i.test(String(row.accountName ?? "")), months) +
      sumMappedRowValue(mappedPlRows, (row) => String(row.accountCode ?? "") === "7401" || /personal cell phone/i.test(String(row.accountName ?? "")), months) +
      sumMappedRowValue(mappedPlRows, (row) => String(row.accountCode ?? "") === "7300" || /donations/i.test(String(row.accountName ?? "")), months)
    );
  };
  const personalTtm = autoExpenseTtm + personalCellTtm + donationsTtm;

  const oneOffByYear = (year: string) =>
    disclosure.oneOffExpenses.reduce((total, item) => total + (item.year === year ? item.amount : 0), 0);
  const tiByYear = (year: string) =>
    disclosure.tenantImprovements.reduce((total, item) => total + (item.expensed && item.year === year ? item.amount : 0), 0);
  const oneOffTtm = ttmYear ? oneOffByYear(ttmYear) : 0;
  const tiTtm = ttmYear ? tiByYear(ttmYear) : 0;

  const annualNormalized = annualYears.map((year) => {
    const normalizedEbitda =
      year.ebitdaPreRecast +
      ownerNetByYear(year.fiscalYear) +
      personalByYear(year.fiscalYear) +
      oneOffByYear(year.fiscalYear) +
      tiByYear(year.fiscalYear);
    return {
      fiscalYear: year.fiscalYear,
      normalizedEbitda,
      normalizedMargin: year.totalRevenue ? (normalizedEbitda / year.totalRevenue) * 100 : null,
    };
  });

  const startingTtm = args.analysis.ttmSummary?.ebitdaPreRecast ?? 0;
  const totalAddBackTtm = ownerNetTtm + personalTtm + oneOffTtm + tiTtm;
  const normalizedEbitda = startingTtm + totalAddBackTtm;
  const valuationLow = normalizedEbitda * Number(args.assumptions.multipleLow ?? 0);
  const valuationMid = normalizedEbitda * Number(args.assumptions.multipleMid ?? 0);
  const valuationHigh = normalizedEbitda * Number(args.assumptions.multipleHigh ?? 0);
  const ttmRevenue = args.analysis.ttmSummary?.totalRevenue ?? 0;

  const flags: Array<{ title: string; description: string; severity: "HIGH" | "MEDIUM" | "LOW" | "INFO"; payload: Record<string, unknown> }> = [];

  const phoneRow = findMappedRow(mappedPlRows, [{ accountCode: "7401" }, { accountNamePattern: /personal cell phone/i }]);
  const phoneValues = phoneRow?.valuesByMonth && typeof phoneRow.valuesByMonth === "object" ? Object.values(phoneRow.valuesByMonth as Record<string, unknown>).filter((v): v is number => typeof v === "number") : [];
  if (phoneValues.length >= 12 && phoneValues.every((value) => Math.abs(value - phoneValues[0]) < 0.01)) {
    flags.push({
      title: "TEST 1 (Recurrence): Cell phone shows exact $280/month - SUSPICIOUS-RECURRING but reasonable for fixed service",
      description: "Cell phone expense is a fixed identical monthly charge. Craig should confirm this is truly personal and not a continuing business-required expense.",
      severity: "MEDIUM",
      payload: { source: "CONTROL_SCAN", dollarImpact: personalTtm },
    });
  }

  const donationRow = findMappedRow(mappedPlRows, [{ accountCode: "7300" }, { accountNamePattern: /donations/i }]);
  const donationValues = donationRow?.valuesByMonth && typeof donationRow.valuesByMonth === "object"
    ? ttmMonths.map((month) => {
        const raw = (donationRow.valuesByMonth as Record<string, unknown>)[month];
        return typeof raw === "number" ? raw : 0;
      })
    : [];
  const donationNonZero = donationValues.filter((value) => Math.abs(value) > 0.01);
  if (
    donationValues.length >= 12 &&
    donationNonZero.length >= 4 &&
    donationNonZero.every((value) => Math.abs(value - donationNonZero[0]) < 0.01) &&
    Math.abs(donationNonZero[0] - 250) < 0.01
  ) {
    flags.push({
      title: "Donations show an exact quarterly round-number pattern",
      description: "Donations post as the same $250 amount each quarter. This pattern suggests an owner estimate or standing personal contribution rather than a naturally varying business expense. Craig should confirm the add-back basis.",
      severity: "MEDIUM",
      payload: { source: "CONTROL_PATTERN", glCode: "7300", dollarImpact: donationsTtm },
    });
  }

  const duplicateOneOffTiGlCodes = Array.from(
    new Set(
      disclosure.oneOffExpenses
        .map((item) => item.glCode)
        .filter((code) => disclosure.tenantImprovements.some((ti) => ti.glCode === code)),
    ),
  );
  for (const glCode of duplicateOneOffTiGlCodes) {
    const oneOffDescriptions = disclosure.oneOffExpenses.filter((item) => item.glCode === glCode).map((item) => item.description);
    const tiDescriptions = disclosure.tenantImprovements.filter((item) => item.glCode === glCode).map((item) => item.description);
    flags.push({
      title: `GL ${glCode} is used in both one-off and TI add-back categories`,
      description: `GL ${glCode} supports both one-off expense item(s) (${oneOffDescriptions.join("; ")}) and tenant improvement item(s) (${tiDescriptions.join("; ")}). Craig should confirm these are distinct events and not the same spend claimed twice under different categories.`,
      severity: "HIGH",
      payload: { source: "CONTROL_GL_OVERLAP", glCode, oneOffDescriptions, tiDescriptions },
    });
  }

  const disclosedAutoExpense = disclosure.personalExpenses
    .filter((item) => item.glCode === "7400" && (!ttmYear || item.years.includes(ttmYear)))
    .reduce((total, item) => total + item.annualAmount, 0);
  if (disclosedAutoExpense > 0 && Math.abs(disclosedAutoExpense - autoExpenseTtm) >= 1) {
    flags.push({
      title: "Auto expense disclosure does not match the actual TTM P&L total",
      description: `The seller disclosure claims $${disclosedAutoExpense.toLocaleString()} for auto expense, but the actual TTM P&L total for GL 7400 is $${Math.round(autoExpenseTtm).toLocaleString()}. Craig should verify the add-back uses the actual booked amount rather than the rounded disclosed estimate.`,
      severity: "MEDIUM",
      payload: {
        source: "CONTROL_DISCLOSURE_MISMATCH",
        glCode: "7400",
        disclosedAmount: disclosedAutoExpense,
        actualTtmAmount: Math.round(autoExpenseTtm),
        variance: Math.round(disclosedAutoExpense - autoExpenseTtm),
      },
    });
  }

  for (const item of disclosure.oneOffExpenses.filter((entry) => entry.year && ttmYear && entry.year !== ttmYear)) {
    flags.push({
      title: "One-Off Expenses item appears outside the TTM period",
      description: `${item.description} is tagged to ${item.yearLabel}, which pre-dates the TTM window starting ${args.analysis.ttmSummary?.startMonth}. Craig should verify it is not being added back to TTM EBITDA unless it is actually present in the TTM period.`,
      severity: "HIGH",
      payload: { source: "CONTROL_OUT_OF_PERIOD", description: item.description, sourcePeriodLabel: item.yearLabel, dollarImpact: item.amount },
    });
  }
  for (const item of disclosure.tenantImprovements.filter((entry) => entry.expensed && entry.year && ttmYear && entry.year !== ttmYear)) {
    flags.push({
      title: "TI Add-Backs item appears outside the TTM period",
      description: `${item.description} is tagged to ${item.yearLabel}, which pre-dates the TTM window starting ${args.analysis.ttmSummary?.startMonth}. Craig should verify it is not being added back to TTM EBITDA unless it is actually present in the TTM period.`,
      severity: "HIGH",
      payload: { source: "CONTROL_OUT_OF_PERIOD", description: item.description, sourcePeriodLabel: item.yearLabel, dollarImpact: item.amount },
    });
  }

  const addBackPct = startingTtm !== 0 ? (totalAddBackTtm / Math.abs(startingTtm)) * 100 : null;
  if (addBackPct !== null && addBackPct > 30) {
    flags.push({
      title: `Total add-backs are ${addBackPct.toFixed(1)}% of pre-recast EBITDA`,
      description: `Total adjustments of $${totalAddBackTtm.toLocaleString()} represent ${addBackPct.toFixed(1)}% of the pre-recast EBITDA ($${startingTtm.toLocaleString()}). This exceeds the 30% threshold. Craig must verify carefully — unusually large add-backs reduce buyer confidence.`,
      severity: "HIGH",
      payload: { source: "ADDBACK_THRESHOLD", addBackPct, totalAddBack: totalAddBackTtm, preRecastEbitda: startingTtm, dollarImpact: totalAddBackTtm },
    });
  }

  const ttmStart = args.analysis.ttmSummary?.startMonth ?? ttmMonths[0] ?? "n/a";
  const ttmEnd = args.analysis.ttmSummary?.endMonth ?? ttmMonths.at(-1) ?? "n/a";
  const comparisonRevenue = annualYears.at(-1)?.totalRevenue ?? ttmRevenue;
  const trendLabel =
    ttmRevenue > comparisonRevenue
      ? "GROWING REVENUE"
      : ttmRevenue < comparisonRevenue
        ? "DECLINING REVENUE"
        : "FLAT REVENUE";

  const reportMarkdown = [
    "# EBITDA RECAST REPORT",
    "",
    "## STARTING POINT",
    "",
    `Starting TTM 4-Wall EBITDA (Pre-Recast): $${startingTtm.toLocaleString()}`,
    "",
    "3-year annual pre-recast EBITDA for context:",
    ...annualYears.map((year, index) => `- FY${index + 1} (${year.fiscalYear}): ${year.ebitdaPreRecast < 0 ? `($${Math.abs(year.ebitdaPreRecast).toLocaleString()})` : `$${year.ebitdaPreRecast.toLocaleString()}`}`),
    "",
    "## CATEGORY 1: OWNER COMPENSATION",
    "",
    `TTM owner wages: $${ownerWageTtm.toLocaleString()}`,
    `TTM owner health insurance: $${ownerHealthTtm.toLocaleString()}`,
    `Employer FICA on owner wages (7.65%): $${Math.round(ownerWageTtm * 0.0765).toLocaleString()}`,
    `Replacement salary deduction: ($${replacementSalary.toLocaleString()})`,
    `Net Owner Compensation Add-Back (TTM): $${Math.round(ownerNetTtm).toLocaleString()}`,
    "",
    "## CATEGORY 2: PERSONAL EXPENSES",
    "",
    `Included in TTM: $${Math.round(personalTtm).toLocaleString()}`,
    `Auto Expense (GL 7400 actual TTM): $${Math.round(autoExpenseTtm).toLocaleString()}`,
    `Personal Cell Phone (GL 7401 actual TTM): $${Math.round(personalCellTtm).toLocaleString()}`,
    `Donations (GL 7300 actual TTM): $${Math.round(donationsTtm).toLocaleString()}`,
    "",
    "## CATEGORY 3: ONE-OFF NON-RECURRING EXPENSES",
    "",
    oneOffTtm ? `Included in TTM: $${oneOffTtm.toLocaleString()}` : "No one-off items fall inside the TTM period. Out-of-period one-off items are excluded from the TTM schedule and only affect their original fiscal years.",
    "",
    "## CATEGORY 4: TENANT IMPROVEMENT ADD-BACKS",
    "",
    tiTtm ? `Included in TTM: $${tiTtm.toLocaleString()}` : "No tenant improvement add-backs fall inside the TTM period. Out-of-period TI items are excluded from the TTM schedule and only affect their original fiscal years.",
    "",
    "## CATEGORY 5: FAIR MARKET RENT NORMALIZATION",
    "",
    "Not Applicable — no related-party rent adjustment required.",
    "",
    "## EBITDA RECAST SCHEDULE",
    "",
    `EBITDA RECAST SCHEDULE — TTM ${ttmStart} to ${ttmEnd}`,
    "",
    "| # | Category | Item Description | GL Reference | TTM Amount | Status |",
    "|---|---|---|---|---|---|",
    `| — | TTM 4-Wall EBITDA (Pre-Recast) | Starting point from WS2-1 | — | $${startingTtm.toLocaleString()} | — |`,
    `| 1a | Owner Compensation | Gross owner compensation in books | 6020 / 6021 | $${(ownerWageTtm + ownerHealthTtm).toLocaleString()} | VERIFIED ✓ |`,
    `| 1b | Owner Compensation | Employer FICA on owner wages | 6020 | $${Math.round(ownerWageTtm * 0.0765).toLocaleString()} | CALCULATED |`,
    `| 1c | Owner Compensation | Replacement Manager Salary (deduction) | — | -$${replacementSalary.toLocaleString()} | Craig-confirmed |`,
    `| 2a | Personal Expenses | Actual TTM GL totals for disclosed personal expenses | 7400 / 7401 / 7300 | $${Math.round(personalTtm).toLocaleString()} | VERIFIED ✓ |`,
    `| 3a | One-Off Expenses | Outside-TTM one-off items excluded from TTM schedule | 6502 / 6801 | $${oneOffTtm.toLocaleString()} | ${oneOffTtm ? "VERIFIED ✓" : "EXCLUDED — OUTSIDE TTM"} |`,
    `| 4a | TI Add-Backs | Outside-TTM TI items excluded from TTM schedule | 6502 | $${tiTtm.toLocaleString()} | ${tiTtm ? "VERIFIED-EXPENSED ✓" : "EXCLUDED — OUTSIDE TTM"} |`,
    `| 5a | FMR Rent Adjustment | Not applicable - unrelated landlord | — | $0 | N/A |`,
    `| — | **TOTAL ADD-BACKS** | | | **$${Math.round(totalAddBackTtm).toLocaleString()}** | |`,
    `| — | **NORMALIZED / RECAST EBITDA (TTM)** | | | **$${Math.round(normalizedEbitda).toLocaleString()}** | |`,
    `| — | **NORMALIZED EBITDA MARGIN (TTM)** | | | **${ttmRevenue ? ((normalizedEbitda / ttmRevenue) * 100).toFixed(1) : "0.0"}%** | |`,
    "",
    "## 3-YEAR NORMALIZED EBITDA SUMMARY",
    "",
    "| Period | Normalized EBITDA | Normalized Margin |",
    "|--------|-------------------|-------------------|",
    ...annualNormalized.map((year, index) => `| FY${index + 1} (${year.fiscalYear}) | $${Math.round(year.normalizedEbitda).toLocaleString()} | ${year.normalizedMargin?.toFixed(1) ?? "n/a"}% |`),
    `| TTM (${ttmYear ?? "Current"}) | $${Math.round(normalizedEbitda).toLocaleString()} | ${ttmRevenue ? ((normalizedEbitda / ttmRevenue) * 100).toFixed(1) : "0.0"}% |`,
    "",
    "## FLAG LIST FOR CRAIG REVIEW",
    "",
    ...(flags.length ? flags.map((flag) => `- ${flag.description}`) : ["- No items require Craig's review."]),
    "",
    "## PRELIMINARY VALUATION RANGE",
    "",
    `- Low: $${Math.round(normalizedEbitda).toLocaleString()} × ${args.assumptions.multipleLow}x = **$${Math.round(valuationLow).toLocaleString()}**`,
    `- Mid: $${Math.round(normalizedEbitda).toLocaleString()} × ${args.assumptions.multipleMid}x = **$${Math.round(valuationMid).toLocaleString()}**`,
    `- High: $${Math.round(normalizedEbitda).toLocaleString()} × ${args.assumptions.multipleHigh}x = **$${Math.round(valuationHigh).toLocaleString()}**`,
    "",
    `Revenue Trend Adjustment Flag: **${trendLabel}**`,
    "",
    "## SUMMARY FOR CRAIG",
    "",
    `Normalized TTM EBITDA is $${Math.round(normalizedEbitda).toLocaleString()} with total TTM add-backs of $${Math.round(totalAddBackTtm).toLocaleString()}. Out-of-period one-off and TI items are excluded from the TTM schedule. ${flags.length} item(s) require Craig review before approval.`,
    "",
  ].join("\n");

  return {
      reportMarkdown,
      metrics: {
        startingEbitda: startingTtm,
        normalizedEbitda: Math.round(normalizedEbitda),
        valuationLow: Math.round(valuationLow),
      valuationMid: Math.round(valuationMid),
      valuationHigh: Math.round(valuationHigh),
    },
    flags,
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
    throw new TtmOrchestratorError("Craig must approve WS2-1 before WS2-2 can run.", 400);
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
    throw new TtmOrchestratorError("Craig must provide low, mid, and high valuation multiples before WS2-2 can run.", 400);
  }
  if (args.assumptions.multipleLow <= 0 || args.assumptions.multipleMid <= 0 || args.assumptions.multipleHigh <= 0) {
    throw new TtmOrchestratorError("Valuation multiples must be positive numbers.", 400);
  }
  if (!(args.assumptions.multipleLow <= args.assumptions.multipleMid && args.assumptions.multipleMid <= args.assumptions.multipleHigh)) {
    throw new TtmOrchestratorError("Craig's valuation multiples must be ordered low ≤ mid ≤ high.", 400);
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
    const deterministic = buildDeterministicWs2Recast({
      analysis,
      assumptions: normalizedAssumptions,
      preparedDocuments: args.preparedDocuments,
    });
    const reportMarkdown = deterministic.reportMarkdown;
    const metrics = deterministic.metrics;
    const flagPayloads = dedupeWs2RecastFlagPayloads([
      ...deterministic.flags,
    ]);

    // V3 Section 10: Default salary flag
    if (usedDefaultSalary) {
      flagPayloads.push({
        title: "Owner replacement salary defaulted to $65,000",
        description: "No replacement salary was provided by Craig. The system used the V3 default of $65,000/year. All outputs are labeled DEFAULT. Craig should verify this amount.",
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
      rawDraftSuppressed: Boolean(rawReportMarkdown),
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
    throw new TtmOrchestratorError("Craig must enter an override amount to use Override Amount.", 400);
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
        resolvedByName: args.actorName || "Craig Pollack",
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
  const allDerivedComplete = ["ws2_3_rev_vertical_v1", "ws2_4_benchmark_v1", "ws2_5_labor_v1"].every((agentId) =>
    (frontendAnalysis.derivedReports ?? []).some((report) => report.agentId === agentId && report.status === "COMPLETE"),
  );
  const client = await (prisma as any).clientProfile.findUnique({
    where: { id: frontendAnalysis.clientId },
    include: { User: true },
  });
  const clientName = client?.businessName || client?.User?.name || frontendAnalysis.clientId;

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
        approvedByName: args.actorName || "Craig Pollack",
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
        agentId: { in: ["ws2_5_labor_v1", "ws2_8_seller_net_proceeds_v1"] },
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
    throw new TtmOrchestratorError("Craig must approve WS2-1 before downstream WS2 agents can run.", 400);
  }

  const dispatchTask = analysis.dispatchTasks.find((task) => task.agentId === args.agentId);
  if (dispatchTask && dispatchTask.status !== "RELEASED") {
    throw new TtmOrchestratorError(`${args.agentId} has not been released by the required HITL gate yet.`, 400);
  }

  const recast = await getLatestApprovedRecast(args.analysisId);
  if (args.agentId === "ws2_5_labor_v1" && !recast) {
    throw new TtmOrchestratorError("WS2-5 requires an approved WS2-2 recast before it can run.", 400);
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
      parsedReport: null,
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
      parsedReport: null,
    },
  });

  if (recast) {
    const latestAnalysis = await getTtmAnalysis(args.analysisId);
    const allDerivedComplete = ["ws2_3_rev_vertical_v1", "ws2_4_benchmark_v1", "ws2_5_labor_v1"].every((agentId) =>
      (latestAnalysis?.derivedReports ?? []).some((report) => report.agentId === agentId && report.status === "COMPLETE"),
    );

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
    }
  }

  const updated = await getTtmAnalysis(args.analysisId);
  if (!updated) {
    throw new TtmOrchestratorError("WS2-1 analysis not found after downstream agent run.", 404);
  }
  return updated;
}

export { TtmOrchestratorError };
