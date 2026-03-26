import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertS3Configured, s3BucketName, s3Client } from "@/lib/s3";

export async function DELETE(req: NextRequest) {
  try {
    const { clientId, documentId } = (await req.json()) as {
      clientId?: string;
      documentId?: string;
    };

    if (!clientId || !documentId) {
      return new Response("clientId and documentId are required", { status: 400 });
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

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[client-documents/delete] Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
