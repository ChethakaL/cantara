import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isDeadlock(error: unknown) {
  const anyError = error as { cause?: { code?: string; originalCode?: string } };
  return anyError?.cause?.code === "40P01" || anyError?.cause?.originalCode === "40P01";
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  try {
    const { clientId, statuses } = await req.json();

    if (!clientId || !statuses || typeof statuses !== "object") {
      return new Response("Invalid payload", { status: 400 });
    }

    const entries = (Object.entries(statuses) as Array<
      [
        string,
        {
          hasDoc?: boolean | null;
          unavailableDecision?: "exclude_agent" | "keep_agent" | null;
          assignedTo?: string | null;
          uploadedAt?: string | null;
          fileName?: string | null;
          fileUrl?: string | null;
          notApplicable?: boolean;
        },
      ]
    >).sort(([a], [b]) => a.localeCompare(b));

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await prisma.$transaction(async (tx) => {
          for (const [documentId, status] of entries) {
            await (tx as any).clientDocumentStatus.upsert({
              where: {
                clientId_documentId: {
                  clientId,
                  documentId,
                },
              },
              update: {
                hasDoc: status.hasDoc ?? null,
                unavailableDecision:
                  status.hasDoc === false
                    ? (status.unavailableDecision ?? null)
                    : null,
                assignedTo: status.assignedTo ?? null,
                uploadedAt: status.uploadedAt ? new Date(status.uploadedAt) : null,
                fileName: status.fileName ?? null,
                fileUrl: status.fileUrl ?? null,
                notApplicable: Boolean(status.notApplicable),
              },
              create: {
                clientId,
                documentId,
                hasDoc: status.hasDoc ?? null,
                unavailableDecision:
                  status.hasDoc === false
                    ? (status.unavailableDecision ?? null)
                    : null,
                assignedTo: status.assignedTo ?? null,
                uploadedAt: status.uploadedAt ? new Date(status.uploadedAt) : null,
                fileName: status.fileName ?? null,
                fileUrl: status.fileUrl ?? null,
                notApplicable: Boolean(status.notApplicable),
              },
            });
          }
        });
        break;
      } catch (error) {
        if (!isDeadlock(error) || attempt === 2) throw error;
        await wait(150 * (attempt + 1));
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Save statuses error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
