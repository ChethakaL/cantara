import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { clientId, statuses } = await req.json();

    if (!clientId || !statuses || typeof statuses !== "object") {
      return new Response("Invalid payload", { status: 400 });
    }

    const entries = Object.entries(statuses) as Array<
      [
        string,
        {
          hasDoc?: boolean | null;
          assignedTo?: string | null;
          uploadedAt?: string | null;
          fileName?: string | null;
          fileUrl?: string | null;
          notApplicable?: boolean;
        },
      ]
    >;

    await prisma.$transaction(
      entries.map(([documentId, status]) =>
        (prisma as any).clientDocumentStatus.upsert({
          where: {
            clientId_documentId: {
              clientId,
              documentId,
            },
          },
          update: {
            hasDoc: status.hasDoc ?? null,
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
            assignedTo: status.assignedTo ?? null,
            uploadedAt: status.uploadedAt ? new Date(status.uploadedAt) : null,
            fileName: status.fileName ?? null,
            fileUrl: status.fileUrl ?? null,
            notApplicable: Boolean(status.notApplicable),
          },
        }),
      ),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Save statuses error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
