import { NextRequest, NextResponse } from "next/server";
import {
  saveGeneratedReportToDrive,
  structureFlatGeneratedReports,
  generatedReportExistsInDrive,
} from "@/lib/composio";
import { prisma } from "@/lib/prisma";
import { buildClientGeneratedReportArchiveTasks } from "@/lib/drive/archive-generated-reports";

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
  preCallBriefsMoved: number;
  preCallBriefsUnmatched: number;
  preCallBriefsDuplicatesRemoved: number;
  unlinkedParentFolders: string[];
  errors: Array<{ clientId: string; message: string }>;
  logs: string[];
  skippedMissingFolder: number;
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
  preCallBriefsMoved: 0,
  preCallBriefsUnmatched: 0,
  preCallBriefsDuplicatesRemoved: 0,
  unlinkedParentFolders: [],
  errors: [],
  logs: [],
  skippedMissingFolder: 0,
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

function addLog(job: DriveSyncJob, message: string) {
  const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  job.summary.logs = [`[${timestamp}] ${message}`, ...job.summary.logs].slice(0, 20);
}

function extractDriveFolderId(value: unknown) {
  if (typeof value !== "string") return null;
  const folderMatch = value.match(/\/folders\/([^/?#]+)/);
  if (folderMatch?.[1]) return folderMatch[1];
  return /^[a-zA-Z0-9_-]{10,}$/.test(value.trim()) ? value.trim() : null;
}

function clientDisplayName(client: any) {
  return client.User?.name || client.businessName || "Client";
}

async function archiveReports(client: any, folderId: string) {
  let count = 0;
  let skipped = 0;
  const clientName = clientDisplayName(client);
  const tasks = buildClientGeneratedReportArchiveTasks(client, clientName);
  addLog(currentJob(), `Found ${tasks.length} generated report(s) to archive for ${clientName}`);

  for (const task of tasks) {
    try {
      const exists = await generatedReportExistsInDrive({
        folderId,
        agentFolder: task.agentFolder,
        fileName: task.fileName,
        overwritePrefix: task.overwritePrefix,
      });
      if (exists) {
        skipped += 1;
        count += 1;
        addLog(currentJob(), `Already on Drive — skipped: ${task.label}`);
        console.log(`[DriveSync]   - Skipped (exists): ${task.label}`);
        continue;
      }

      const html = task.buildHtml();
      if (!html) {
        addLog(currentJob(), `No HTML for ${task.label} — skipped`);
        continue;
      }

      addLog(currentJob(), `Archiving: ${task.label}`);
      console.log(`[DriveSync]   - Archiving: ${task.label}`);
      await saveGeneratedReportToDrive({
        folderId,
        agentFolder: task.agentFolder,
        fileName: task.fileName,
        overwritePrefix: task.overwritePrefix,
        html,
        skipIfExists: false,
      });
      count += 1;
      await new Promise((r) => setTimeout(r, 400));
    } catch (error) {
      console.error("[drive/sync-all] Report archive failed", {
        clientId: client.id,
        report: task.label,
        error,
      });
      currentJob().summary.errors.push({
        clientId: client.id,
        message: `Report archive failed: ${task.label}`,
      });
    }
  }

  if (skipped > 0) {
    addLog(currentJob(), `${clientName}: ${skipped} report(s) already on Drive (skipped regen)`);
  }
  return count;
}

async function mirrorDocuments(client: any, folderId: string) {
  const { syncClientUploadsDriveStructure } = await import("@/lib/composio/drive");
  const docs = (client.ClientDocument ?? []).filter(
    (doc: any) => doc.fileName && (doc.localPath || doc.googleDriveFileId),
  );
  addLog(currentJob(), `Structuring ${docs.length} client upload(s) into category folders`);
  const result = await syncClientUploadsDriveStructure({
    clientFolderId: folderId,
    documents: docs,
    scaffoldAllFolders: true,
  });
  addLog(currentJob(), result.message);
  return result.filesAlreadyInPlace + result.filesMoved + result.filesUploaded;
}

async function runDriveSync(job: DriveSyncJob, clientId?: string | null) {
  try {
    const clients = await prisma.clientProfile.findMany({
      where: clientId ? { id: clientId } : undefined,
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
        RealEstateAppraisalReports: true,
        OwnershipVerificationReports: true,
        PermitsZoningReports: true,
        LegalEntitySearchReports: true,
        TaxLiabilityReports: true,
        CimReport: true,
        TeaserReport: true,
        AgentAnalysisRuns: true,
      },
      orderBy: { createdAt: "asc" },
    });

    job.summary = emptySummary();
    job.summary.totalClients = clients.length;
    job.summary.phase = "Starting Google Drive sync";
    job.message = clientId
      ? "Starting Google Drive sync for this client."
      : "Starting Google Drive sync. This can take more than 10 minutes for clients with many reports.";

    if (!clientId) {
      try {
        const { getDriveParentFolderId } = await import("@/lib/drive-settings");
        const { organizePreCallBriefsInParentFolder } = await import("@/lib/composio/drive");
        const parentFolderId = await getDriveParentFolderId();
        if (parentFolderId) {
          job.summary.phase = "Organizing Pre-Call Briefs in parent folder";
          addLog(job, "Organizing Pre-Call Briefs in parent folder");
          const leads = await (prisma as any).salesLead.findMany({
            select: { businessName: true },
          });
          const linkedIds = new Set<string>();
          for (const client of clients) {
            const id = extractDriveFolderId(client.driveFolderId);
            if (id) linkedIds.add(id);
          }
          const briefResult = await organizePreCallBriefsInParentFolder({
            parentFolderId,
            knownBusinessNames: (leads as Array<{ businessName: string | null }>)
              .map((l) => l.businessName)
              .filter((n): n is string => Boolean(n && n.trim())),
            linkedClientFolderIds: linkedIds,
          });
          job.summary.preCallBriefsMoved = briefResult.moved;
          job.summary.preCallBriefsUnmatched = briefResult.unmatchedMoved;
          job.summary.preCallBriefsDuplicatesRemoved = briefResult.duplicatesTrashed;
          job.summary.unlinkedParentFolders = briefResult.unlinkedFolders;
          addLog(job, briefResult.message);
          if (briefResult.unlinkedFolders.length) {
            addLog(
              job,
              `Unlinked parent folders (not deleted): ${briefResult.unlinkedFolders.slice(0, 8).join(", ")}`,
            );
          }
          for (const err of briefResult.errors) {
            job.summary.errors.push({ clientId: "pre-call-briefs", message: err });
          }
        } else {
          addLog(job, "No Drive parent folder configured — skipped Pre-Call Brief cleanup");
        }
      } catch (error) {
        job.summary.errors.push({
          clientId: "pre-call-briefs",
          message: error instanceof Error ? error.message : "Pre-Call Brief organize failed",
        });
      }
    }

    for (const client of clients) {
      const name = clientDisplayName(client);
      addLog(job, `Processing client: ${name}`);
      console.log(`[DriveSync] Processing client: ${name} (${job.summary.clients + 1}/${job.summary.totalClients})`);

      job.summary.clients += 1;
      job.summary.currentClientName = clientDisplayName(client);
      job.summary.phase = "Checking assigned client folder";
      job.message = `Syncing ${job.summary.currentClientName} (${job.summary.clients}/${job.summary.totalClients})...`;
      try {
        const folderId = extractDriveFolderId(client.driveFolderId);
        if (!folderId) {
          job.summary.skippedMissingFolder += 1;
          addLog(job, `Skipped ${name}: no Google Drive folder set`);
          continue;
        }
        job.summary.foldersCreatedOrFound += 1;

        job.summary.phase = "Uploading client documents";
        job.summary.documentsMirrored += await mirrorDocuments(client, folderId);
        job.summary.phase = "Generating and uploading report PDFs";
        job.summary.reportsArchived += await archiveReports(client, folderId);
        job.summary.phase = "Structuring Generated Reports folders";
        try {
          const structured = await structureFlatGeneratedReports(folderId);
          if (structured.moved > 0) {
            addLog(job, `${name}: moved ${structured.moved} flat report(s) into agent folders`);
          }
          for (const err of structured.errors) {
            job.summary.errors.push({ clientId: client.id, message: `Generated Reports: ${err}` });
          }
        } catch (error) {
          job.summary.errors.push({
            clientId: client.id,
            message: error instanceof Error ? error.message : "Generated Reports structure failed",
          });
        }
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
    job.message = [
      `Sync complete: ${job.summary.foldersCreatedOrFound} assigned folders`,
      `${job.summary.documentsMirrored} documents`,
      `${job.summary.reportsArchived} reports`,
      !clientId
        ? `${job.summary.preCallBriefsMoved} briefs filed · ${job.summary.preCallBriefsDuplicatesRemoved} duplicates removed`
        : null,
    ]
      .filter(Boolean)
      .join(", ");
  } catch (error) {
    console.error("Drive sync all error:", error);
    job.status = "error";
    job.finishedAt = new Date().toISOString();
    job.summary.phase = "Failed";
    job.message = error instanceof Error ? error.message : "Failed to sync Google Drive";
  }
}

export async function POST(req: NextRequest) {
  const existing = currentJob();
  if (existing.status === "running") {
    return NextResponse.json(existing);
  }

  const body = await req.json().catch(() => ({}));
  const clientId = typeof body?.clientId === "string" ? body.clientId : null;

  const job: DriveSyncJob = {
    id: `drive-sync-${Date.now()}`,
    status: "running",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    message: "Google Drive sync started. This can take more than 10 minutes.",
    summary: emptySummary(),
  };
  globalForDriveSync.cantaraDriveSyncJob = job;
  void runDriveSync(job, clientId);
  return NextResponse.json(job);
}

export async function GET() {
  return NextResponse.json(currentJob());
}
