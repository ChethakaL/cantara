import { NextResponse } from "next/server";
import {
  ensureClientDriveFolder,
  ensureClientDriveSubfolder,
  saveGeneratedReportToDrive,
  uploadClientDocumentToDrive,
} from "@/lib/composio";
import { prisma } from "@/lib/prisma";
import { buildPresignedFileUrl } from "@/lib/s3";
import { buildCompetitorReportHtml } from "@/lib/report-export/build-competitor-report";
import { buildContractReportHtml } from "@/lib/report-export/build-contract-report";
import { buildEmployeeObligationsReportHtml } from "@/lib/report-export/build-employee-obligations-report";
import { buildLeaseReportHtml } from "@/lib/report-export/build-lease-report";
import { buildMarkdownReportHtml } from "@/lib/report-export/build-markdown-report";
import { parseReport as parseContractReport } from "@/lib/contract-analysis/parse-report";
import { parseReport as parseLeaseReport } from "@/lib/lease-analysis/parse-report";
import { parseWS16Markdown } from "@/lib/ws1-6/parser";

export const dynamic = "force-dynamic";
export const maxDuration = 900;

type DriveSyncSummary = {
  clients: number;
  totalClients: number;
  currentClientName: string | null;
  phase: string;
  foldersCreatedOrFound: number;
  documentsMirrored: number;
  reportsArchived: number;
  errors: Array<{ clientId: string; message: string }>;
  logs: string[];
};

type DriveSyncJob = {
  id: string;
  status: "idle" | "running" | "complete" | "error";
  startedAt: string | null;
  finishedAt: string | null;
  message: string;
  summary: DriveSyncSummary;
};

const emptySummary = (): DriveSyncSummary => ({
  clients: 0,
  totalClients: 0,
  currentClientName: null,
  phase: "Idle",
  foldersCreatedOrFound: 0,
  documentsMirrored: 0,
  reportsArchived: 0,
  errors: [],
  logs: [],
});

const globalForDriveSync = globalThis as typeof globalThis & {
  cantaraDriveSyncJob?: DriveSyncJob;
};

function currentJob() {
  if (!globalForDriveSync.cantaraDriveSyncJob) {
    globalForDriveSync.cantaraDriveSyncJob = {
      id: "",
      status: "idle",
      startedAt: null,
      finishedAt: null,
      message: "No sync running.",
      summary: emptySummary(),
    };
  }
  return globalForDriveSync.cantaraDriveSyncJob;
}

function safeFileName(input: string) {
  return input.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").replace(/\s+/g, " ").trim().slice(0, 180) || "report";
}

function addLog(job: DriveSyncJob, message: string) {
  const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  job.summary.logs = [`[${timestamp}] ${message}`, ...job.summary.logs].slice(0, 20);
}

function clientDisplayName(client: any) {
  return client.User?.name || client.businessName || "Client";
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function markdownReportHtml(args: {
  title: string;
  clientName: string;
  markdown: string;
  generatedAt?: string | Date | null;
}) {
  return buildMarkdownReportHtml({
    title: args.title,
    clientName: args.clientName,
    generatedAt: args.generatedAt,
    markdown: args.markdown,
  });
}

function latestBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    const key = keyFn(item);
    const existing = map.get(key);
    const itemDate = new Date((item as any).updatedAt || (item as any).createdAt || 0).getTime();
    const existingDate = existing ? new Date((existing as any).updatedAt || (existing as any).createdAt || 0).getTime() : 0;
    if (!existing || itemDate > existingDate) {
      map.set(key, item);
    }
  }
  return Array.from(map.values());
}

async function archiveReports(client: any, folderId: string) {
  let count = 0;
  const tasks: Array<{ label: string; run: () => Promise<unknown> }> = [];
  const clientName = clientDisplayName(client);

  const leases = latestBy(client.LeaseAnalysis ?? [], (item: any) => item.fileName || item.id) as any[];
  for (const item of leases) {
    const parsed = asObject(item.parsed) ?? parseLeaseReport(item.report);
    tasks.push({
      label: `Lease Analysis: ${item.fileName || item.id}`,
      run: () => saveGeneratedReportToDrive({
        folderId,
        fileName: safeFileName(`Lease Analysis - ${item.fileName || item.id}.pdf`),
        html: buildLeaseReportHtml(parsed as any, clientName),
      }),
    });
  }

  const contracts = latestBy(client.ContractAnalysis ?? [], (item: any) => item.fileName || item.id) as any[];
  for (const item of contracts) {
    const parsed = asObject(item.parsed) ?? parseContractReport(item.report);
    tasks.push({
      label: `Contract Analysis: ${item.fileName || item.id}`,
      run: () => saveGeneratedReportToDrive({
        folderId,
        fileName: safeFileName(`Contract Analysis - ${item.fileName || item.id}.pdf`),
        html: buildContractReportHtml(parsed as any, clientName),
      }),
    });
  }

  const competitors = latestBy(client.CompetitorAnalyses ?? [], (item: any) => "latest") as any[];
  for (const item of competitors) {
    const parsed = asObject(item.parsed);
    tasks.push({
      label: `Competitor Analysis`,
      run: () => saveGeneratedReportToDrive({
        folderId,
        fileName: safeFileName(`Competitor Analysis.pdf`),
        overwritePrefix: "Competitor Analysis",
        html: parsed
          ? buildCompetitorReportHtml(parsed as any)
          : markdownReportHtml({
              title: "Competitor Analysis Report",
              clientName,
              markdown: (item as any).report,
              generatedAt: item.createdAt,
            }),
      }),
    });
  }

  const employeeReports = latestBy(client.EmployeeObligationsReports ?? [], (item: any) => "latest") as any[];
  for (const item of employeeReports) {
    const { report, flags } = parseWS16Markdown(item.markdown, clientName);
    tasks.push({
      label: `Employee Obligations`,
      run: () => saveGeneratedReportToDrive({
        folderId,
        fileName: safeFileName(`Employee Obligations.pdf`),
        overwritePrefix: "Employee Obligations",
        html: buildEmployeeObligationsReportHtml({
          documents: [], agreements: [], nonCompetes: [], benefits: [], contractors: [], keyPeople: [], keyPersonNarrative: "", coverageGaps: [],
          buyerSummary: { workforceOverview: "No summary available.", nonCompeteProtections: "", assumedBenefitObligations: "", retirementAndPTO: "", independentContractorRisk: "", transitionConsiderations: "", counselItems: [] },
          ...report,
        } as any, flags as any, clientName),
      }),
    });
  }

  const ttms = latestBy(client.TtmAnalyses ?? [], (item: any) => "latest") as any[];
  for (const item of ttms) {
    if (!item.reportMarkdown) continue;
    tasks.push({
      label: `TTM Analysis`,
      run: () => saveGeneratedReportToDrive({
        folderId,
        fileName: safeFileName(`TTM Analysis.pdf`),
        overwritePrefix: "TTM Analysis",
        html: markdownReportHtml({
          title: `TTM Analysis v${item.version}`,
          clientName,
          markdown: item.reportMarkdown,
          generatedAt: item.updatedAt,
        }),
      }),
    });
  }

  const recasts = latestBy(client.Ws2RecastAnalyses ?? [], (item: any) => "latest") as any[];
  for (const item of recasts) {
    if (!item.reportMarkdown) continue;
    tasks.push({
      label: `WS2 Recast`,
      run: () => saveGeneratedReportToDrive({
        folderId,
        fileName: safeFileName(`WS2 Recast.pdf`),
        overwritePrefix: "WS2 Recast",
        html: markdownReportHtml({
          title: `WS2 Recast v${item.version}`,
          clientName,
          markdown: item.reportMarkdown,
          generatedAt: item.updatedAt,
        }),
      }),
    });
  }

  const derived = latestBy(client.Ws2DerivedReports ?? [], (item: any) => item.agentId) as any[];
  for (const item of derived) {
    if (!item.reportMarkdown) continue;
    tasks.push({
      label: `WS2 Derived: ${item.agentId}`,
      run: () => saveGeneratedReportToDrive({
        folderId,
        fileName: safeFileName(`WS2 Derived - ${item.agentId}.pdf`),
        overwritePrefix: `WS2 Derived - ${item.agentId}`,
        html: markdownReportHtml({
          title: `WS2 Derived ${item.agentId}`,
          clientName,
          markdown: item.reportMarkdown,
          generatedAt: item.updatedAt,
        }),
      }),
    });
  }

  for (const task of tasks) {
    try {
      addLog(currentJob(), `Archiving: ${task.label}`);
      console.log(`[DriveSync]   - Archiving: ${task.label}`);
      await task.run();
      count += 1;
    } catch (error) {
      console.error("[drive/sync-all] Report archive failed", {
        clientId: client.id,
        report: task.label,
        error,
      });
    }
  }

  return count;
}

function latestByCreatedAt<T extends { createdAt?: Date | string | null }>(items: T[] | null | undefined) {
  return [...(items ?? [])].sort((a, b) =>
    new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
  )[0];
}

async function mirrorDocuments(client: any, folderId: string) {
  let count = 0;
  const uploads = await ensureClientDriveSubfolder(folderId, "Client Uploads");
  const docs = (client.ClientDocument ?? []).filter((doc: any) => doc.googleDriveFileId);
  const job = currentJob();
  const results = await Promise.allSettled(docs.map(async (doc: any) => {
    addLog(job, `Mirroring doc: ${doc.fileName}`);
    console.log(`[DriveSync]   - Mirroring doc: ${doc.fileName}`);
    return uploadClientDocumentToDrive({
      folderId: uploads.id,
      fileName: safeFileName(`${doc.documentId || "document"} - ${doc.fileName}`),
      mimeType: doc.mimeType,
      sourceUrl: doc.localPath ? await buildPresignedFileUrl(doc.localPath) : doc.googleDriveFileId,
    });
  }));
  count += results.filter((result) => result.status === "fulfilled").length;
  return count;
}

async function runDriveSync(job: DriveSyncJob) {
  try {
    const clients = await prisma.clientProfile.findMany({
      include: {
        User: true,
        ClientDocument: true,
        LeaseAnalysis: true,
        ContractAnalysis: true,
        CompetitorAnalyses: true,
        EmployeeObligationsReports: true,
        TtmAnalyses: true,
        Ws2RecastAnalyses: true,
        Ws2DerivedReports: true,
      },
      orderBy: { createdAt: "asc" },
    });

    job.summary = emptySummary();
    job.summary.totalClients = clients.length;
    job.summary.phase = "Starting Google Drive sync";
    job.message = "Starting Google Drive sync. This can take more than 10 minutes for clients with many reports.";

    for (const client of clients) {
      const name = clientDisplayName(client);
      addLog(job, `Processing client: ${name}`);
      console.log(`[DriveSync] Processing client: ${name} (${job.summary.clients + 1}/${job.summary.totalClients})`);

      job.summary.clients += 1;
      job.summary.currentClientName = clientDisplayName(client);
      job.summary.phase = "Creating or finding client folder";
      job.message = `Syncing ${job.summary.currentClientName} (${job.summary.clients}/${job.summary.totalClients})...`;
      try {
        const folder = await ensureClientDriveFolder({
          clientName: client.User?.name || client.businessName,
          clientId: client.id,
        });
        const folderUrl = folder.url;
        await prisma.clientProfile.update({
          where: { id: client.id },
          data: { driveFolderId: folderUrl },
        });
        job.summary.foldersCreatedOrFound += 1;

        const folderId = folder.id;
        job.summary.phase = "Uploading client documents";
        job.summary.documentsMirrored += await mirrorDocuments(client, folderId);
        job.summary.phase = "Generating and uploading report PDFs";
        job.summary.reportsArchived += await archiveReports(client, folderId);
      } catch (error) {
        job.summary.errors.push({
          clientId: client.id,
          message: error instanceof Error ? error.message : "Unknown sync error",
        });
      }
    }

    job.status = "complete";
    job.finishedAt = new Date().toISOString();
    job.summary.currentClientName = null;
    job.summary.phase = "Complete";
    job.message = `Sync complete: ${job.summary.foldersCreatedOrFound} client folders, ${job.summary.documentsMirrored} documents, ${job.summary.reportsArchived} reports.`;
  } catch (error) {
    console.error("Drive sync all error:", error);
    job.status = "error";
    job.finishedAt = new Date().toISOString();
    job.summary.phase = "Failed";
    job.message = error instanceof Error ? error.message : "Failed to sync Google Drive";
  }
}

export async function POST() {
  const existing = currentJob();
  if (existing.status === "running") {
    return NextResponse.json(existing);
  }

  const job: DriveSyncJob = {
    id: `drive-sync-${Date.now()}`,
    status: "running",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    message: "Google Drive sync started. This can take more than 10 minutes.",
    summary: emptySummary(),
  };
  globalForDriveSync.cantaraDriveSyncJob = job;

  void runDriveSync(job);

  return NextResponse.json(job, { status: 202 });
}

export async function GET() {
  return NextResponse.json(currentJob());
}
