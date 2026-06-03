import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertS3Configured, s3BucketName, s3Client } from "@/lib/s3";
import { multiYearStatusMirrorIds, syncDocumentStatusForUpload } from "@/lib/client-document-status-sync";

/** Metadata + optional parsed AI JSON for agent tabs (e.g. Sales Process Review). */
export async function GET(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get("clientId");
    const documentId = req.nextUrl.searchParams.get("documentId");
    const all = req.nextUrl.searchParams.get("all") === "true";

    if (!clientId || !documentId) {
      return new Response("clientId and documentId are required", { status: 400 });
    }

    if (all) {
      const docs = await (prisma as any).clientDocument.findMany({
        where: { clientId, documentId },
        orderBy: { createdAt: "desc" },
        take: Math.min(Number(req.nextUrl.searchParams.get("limit") || 50), 100),
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          googleDriveFileId: true,
          createdAt: true,
        },
      });

      return NextResponse.json({
        documents: docs.map((doc: any) => ({
          id: doc.id,
          fileName: doc.fileName,
          mimeType: doc.mimeType,
          fileUrl: doc.googleDriveFileId,
          uploadedAt: doc.createdAt.toISOString(),
        })),
      });
    }

    const doc = await (prisma as any).clientDocument.findFirst({
      where: { clientId, documentId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        createdAt: true,
        aiReviewSummary: true,
        aiReviewStatus: true,
      },
    });

    if (!doc) {
      return NextResponse.json({ document: null, analysis: null });
    }

    let analysis: unknown = null;
    if (doc.aiReviewSummary && typeof doc.aiReviewSummary === "string") {
      try {
        const parsed = JSON.parse(doc.aiReviewSummary);
        if (parsed && typeof parsed === "object" && "summary" in (parsed as object)) {
          analysis = parsed;
        }
      } catch {
        /* not JSON — ignore */
      }
    }

    return NextResponse.json({
      document: {
        id: doc.id,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        uploadedAt: doc.createdAt.toISOString(),
      },
      analysis,
    });
  } catch (error) {
    console.error("[client-documents/get] Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { clientId, documentId, recordId } = (await req.json()) as {
      clientId?: string;
      documentId?: string;
      recordId?: string;
    };

    if (!clientId) {
      return new Response("clientId is required", { status: 400 });
    }

    if (recordId) {
      const record = await (prisma as any).clientDocument.findFirst({
        where: { id: recordId, clientId },
        select: {
          id: true,
          documentId: true,
          localPath: true,
          storageBucket: true,
          storageProvider: true,
        },
      });

      if (!record) {
        return new Response("Document not found", { status: 404 });
      }

      if (record.storageProvider === "s3" && record.localPath) {
        try {
          assertS3Configured();
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket: record.storageBucket || s3BucketName,
              Key: record.localPath,
            }),
          );
        } catch (storageError) {
          console.error("[client-documents/delete] Storage cleanup warning:", storageError);
        }
      }

      await (prisma as any).$transaction(async (tx: any) => {
        await tx.clientDocument.delete({ where: { id: record.id } });
        await syncDocumentStatusForUpload(tx, clientId, record.documentId);
      });

      return NextResponse.json({ ok: true });
    }

    if (!documentId) {
      return new Response("documentId or recordId is required", { status: 400 });
    }

    const documents = await (prisma as any).clientDocument.findMany({
      where: { clientId, documentId },
      select: { id: true, localPath: true, storageBucket: true, storageProvider: true },
    });

    if (documents.length > 0) {
      try {
        assertS3Configured();
        await Promise.all(
          documents
            .filter((doc: any) => doc.storageProvider === "s3" && doc.localPath)
            .map((doc: any) =>
              s3Client.send(
                new DeleteObjectCommand({
                  Bucket: doc.storageBucket || s3BucketName,
                  Key: doc.localPath,
                }),
              ),
            ),
        );
      } catch (storageError) {
        console.error("[client-documents/delete] Storage cleanup warning:", storageError);
      }
    }

    await (prisma as any).$transaction([
      (prisma as any).clientDocument.deleteMany({
        where: { clientId, documentId },
      }),
      (prisma as any).clientDocumentStatus.deleteMany({
        where: { clientId, documentId },
      }),
    ]);

    for (const mirrorId of multiYearStatusMirrorIds(documentId)) {
      await (prisma as any).clientDocumentStatus.deleteMany({
        where: { clientId, documentId: mirrorId },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[client-documents/delete] Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
