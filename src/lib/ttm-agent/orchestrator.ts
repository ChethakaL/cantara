import { createHash } from "crypto";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { assertS3Configured, s3BucketName, s3Client } from "@/lib/s3";
import { mapLedgerRows } from "@/lib/ttm-agent/mapping";
import { parseAccountantStatementsDocument } from "@/lib/ttm-agent/parsers/accountant-statements";
import { parseArAgingWorkbook, parseMonthlyWorkbook } from "@/lib/ttm-agent/parsers/excel";
import { buildDataQualityReport, flattenFlagsForPersistence } from "@/lib/ttm-agent/report-builder";
import { reconcileFinancials } from "@/lib/ttm-agent/reconciler";
import {
  AgentDispatchTaskView,
  FlagResolutionAction,
  InputDocumentSnapshot,
  TtmAnalysisView,
  TTM_REQUIRED_DOCUMENT_IDS,
  TtmRequiredDocumentId,
  TtmReadinessItem,
} from "@/lib/ttm-agent/types";
import { summarizeTtmAnalysis } from "@/lib/ttm-agent/claude";
import { buildWorkingCapitalSummary } from "@/lib/ttm-agent/wc-calculator";
import { TTM_AGENT_MAX_TOKENS, TTM_AGENT_MODEL, TTM_AGENT_TEMPERATURE } from "@/lib/ttm-agent/prompt";

class TtmOrchestratorError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

async function bodyToBuffer(body: any) {
  if (!body) return Buffer.alloc(0);
  if (typeof body.transformToByteArray === "function") {
    const bytes = await body.transformToByteArray();
    return Buffer.from(bytes);
  }
  const response = new Response(body);
  return Buffer.from(await response.arrayBuffer());
}

function hashInputSnapshot(snapshot: InputDocumentSnapshot[]) {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(snapshot));
  return hash.digest("hex");
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
    errorMessage: record.errorMessage ?? null,
    approvedAt: record.approvedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    flags: (record.flags ?? []).map(mapFlag),
    dispatchTasks: (record.dispatchTasks ?? []).map(mapDispatchTask),
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

async function loadDocumentBytes(document: any) {
  const result = await s3Client.send(
    new GetObjectCommand({
      Bucket: document.storageBucket || s3BucketName,
      Key: document.localPath,
    }),
  );
  return bodyToBuffer(result.Body);
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
    },
  });

  return record ? mapTtmAnalysisForFrontend(record) : null;
}

export async function runTtmAgent(args: { clientId: string; triggeredByName?: string }) {
  console.log(`[TTM] ▶ Starting TTM agent for client=${args.clientId} triggered by ${args.triggeredByName ?? "system"}`);
  assertS3Configured();
  const inputDocuments = await loadLatestInputDocuments(args.clientId);
  console.log(`[TTM] Loaded ${inputDocuments.length} input documents`);
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
    const [monthlyPlDocument, monthlyBsDocument, accountantDocument, arAgingDocument] = inputDocuments;
    const [monthlyPlBytes, monthlyBsBytes, accountantBytes, arAgingBytes] = await Promise.all([
      loadDocumentBytes(monthlyPlDocument),
      loadDocumentBytes(monthlyBsDocument),
      loadDocumentBytes(accountantDocument),
      loadDocumentBytes(arAgingDocument),
    ]);

    const monthlyPl = parseMonthlyWorkbook(monthlyPlBytes, "monthly_pl_excel");
    console.log(`[TTM] Parsed monthly P&L: format=${monthlyPl.format}, ${monthlyPl.rows.length} rows, ${monthlyPl.monthKeys.length} months`);
    const monthlyBs = parseMonthlyWorkbook(monthlyBsBytes, "monthly_bs_excel");
    console.log(`[TTM] Parsed monthly BS: format=${monthlyBs.format}, ${monthlyBs.rows.length} rows, ${monthlyBs.monthKeys.length} months`);
    const accountantStatements = await parseAccountantStatementsDocument({
      fileName: accountantDocument.fileName,
      mimeType: accountantDocument.mimeType || "application/octet-stream",
      buffer: accountantBytes,
    });
    console.log(`[TTM] Parsed accountant statements: ${accountantStatements.years.length} fiscal years, source=${accountantStatements.sourceType}`);
    const arAging = parseArAgingWorkbook(arAgingBytes);
    console.log(`[TTM] Parsed AR aging: ${arAging.entries.length} customer entries`);

    const [mappedPlRows, mappedBsRows] = await Promise.all([
      mapLedgerRows(monthlyPl.rows, "pl"),
      mapLedgerRows(monthlyBs.rows, "bs"),
    ]);
    const unmappedPl = mappedPlRows.filter((r) => !r.cantaraCode).length;
    const unmappedBs = mappedBsRows.filter((r) => !r.cantaraCode).length;
    console.log(`[TTM] GL mapping: P&L ${mappedPlRows.length} rows (${unmappedPl} unmapped), BS ${mappedBsRows.length} rows (${unmappedBs} unmapped)`);

    const reconciled = reconcileFinancials({
      monthlyPl,
      monthlyBs,
      mappedPlRows,
      mappedBsRows,
      accountantStatements,
    });

    console.log(`[TTM] Computing working capital`);
    const wcResult = buildWorkingCapitalSummary({
      mappedBalanceSheetRows: mappedBsRows,
      balanceSheetMonths: monthlyBs.monthKeys,
      arAging,
    });

    reconciled.dataQualitySections.E.push(...wcResult.qualityItems);

    const dataQualityReport = buildDataQualityReport(reconciled.dataQualitySections);
    console.log(`[TTM] Generating Claude summary`);
    const summary = await summarizeTtmAnalysis({
      ttmSummary: reconciled.ttmSummary,
      annualTrends: reconciled.annualModel.trends,
      anomalies: reconciled.annualModel.anomalies,
      qualityCounts: dataQualityReport.counts,
      workingCapital: wcResult.workingCapital,
      quickBooksStatus: "Skipped - QuickBooks not connected",
    });
    const flattenedFlags = flattenFlagsForPersistence(reconciled.dataQualitySections);
    console.log(`[TTM] Persisting: ${flattenedFlags.length} flags`);

    const saved = await (prisma as any).$transaction(async (tx: any) => {
      await tx.ttmAnalysis.update({
        where: { id: created.id },
        data: {
          status: "HITL_PENDING",
          hitlStatus: "PENDING_REVIEW",
          normalizedData: reconciled.normalizedData,
          structuredModel: reconciled.structuredModel,
          ttmSummary: reconciled.ttmSummary,
          annualModel: reconciled.annualModel,
          workingCapital: wcResult.workingCapital,
          dataQualityReport,
          summary,
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
            agentId: "agent_ebitda_recast_v1",
            status: "BLOCKED_HITL",
            payload: { reason: "Awaiting Craig HITL approval" },
          },
          {
            analysisId: created.id,
            clientId: args.clientId,
            agentId: "agent_seller_net_proceeds_v1",
            status: "READY",
            payload: { source: "working_capital" },
          },
          {
            analysisId: created.id,
            clientId: args.clientId,
            agentId: "agent_3yr_recast_v1",
            status: "READY",
            payload: { source: "structured_36m_model" },
          },
        ],
      });

      return tx.ttmAnalysis.findUnique({
        where: { id: created.id },
        include: {
          flags: { orderBy: [{ section: "asc" }, { createdAt: "asc" }] },
          dispatchTasks: { orderBy: { createdAt: "asc" } },
        },
      });
    });

    const result = mapTtmAnalysisForFrontend(saved);
    console.log(`[TTM] ✓ Complete: id=${created.id}, v${result.version}, ${result.flags.length} flags, status=${result.status}`);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown TTM orchestration error";
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

  await (prisma as any).$transaction([
    (prisma as any).ttmFlag.update({
      where: { id: args.flagId },
      data: {
        resolutionStatus: "ACTIONED",
        resolutionAction: args.action,
        resolutionNotes: args.notes ?? null,
        escalatedRequirementId,
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
    (prisma as any).agentDispatchTask.updateMany({
      where: {
        analysisId: args.analysisId,
        agentId: "agent_ebitda_recast_v1",
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

export { TtmOrchestratorError };
