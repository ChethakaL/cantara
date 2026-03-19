import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertS3Configured, buildPublicFileUrl, s3BucketName, s3Client } from "@/lib/s3";

export async function POST(req: NextRequest) {
  try {
    assertS3Configured();
    const form = await req.formData();
    const file = form.get("file");
    const clientId = String(form.get("clientId") || "");
    const documentId = String(form.get("documentId") || "");
    const uploaderEmail = String(form.get("uploaderEmail") || "");

    if (!(file instanceof File) || !clientId || !documentId || !uploaderEmail) {
      return new Response("Missing upload fields", { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: uploaderEmail } });
    if (!user) {
      return new Response("Uploader not found", { status: 404 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `clients/${clientId}/documents/${documentId}/${Date.now()}-${safeName}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: s3BucketName,
        Key: key,
        Body: bytes,
        ContentType: file.type || "application/octet-stream",
      }),
    );
    const publicUrl = buildPublicFileUrl(key);

    const document = await (prisma as any).clientDocument.create({
      data: {
        clientId,
        documentId,
        uploadedById: user.id,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        localPath: key,
        storageBucket: s3BucketName,
        storageProvider: "s3",
        googleDriveFileId: publicUrl,
      },
    });

    await (prisma as any).clientDocumentStatus.upsert({
      where: {
        clientId_documentId: {
          clientId,
          documentId,
        },
      },
      update: {
        hasDoc: true,
        fileName: file.name,
        fileUrl: publicUrl,
        uploadedAt: new Date(),
        notApplicable: false,
      },
      create: {
        clientId,
        documentId,
        hasDoc: true,
        fileName: file.name,
        fileUrl: publicUrl,
        uploadedAt: new Date(),
        notApplicable: false,
      },
    });

    return NextResponse.json({
      id: document.id,
      fileName: document.fileName,
      fileUrl: publicUrl,
      uploadedAt: document.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Upload Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
