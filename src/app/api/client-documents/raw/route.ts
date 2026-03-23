import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertS3Configured, s3BucketName, s3Client } from "@/lib/s3";

async function bodyToBuffer(body: any) {
  if (!body) return Buffer.alloc(0);
  if (typeof body.transformToByteArray === "function") {
    const bytes = await body.transformToByteArray();
    return Buffer.from(bytes);
  }
  const response = new Response(body);
  return Buffer.from(await response.arrayBuffer());
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    assertS3Configured();

    const clientId = req.nextUrl.searchParams.get("clientId");
    const documentId = req.nextUrl.searchParams.get("documentId");

    if (!clientId || !documentId) {
      return new Response("Missing clientId or documentId", { status: 400 });
    }

    const document = await (prisma as any).clientDocument.findFirst({
      where: { clientId, documentId },
      orderBy: { createdAt: "desc" },
      select: {
        fileName: true,
        mimeType: true,
        localPath: true,
        storageBucket: true,
      },
    });

    if (!document?.localPath) {
      return new Response("Document not found", { status: 404 });
    }

    const result = await s3Client.send(
      new GetObjectCommand({
        Bucket: document.storageBucket || s3BucketName,
        Key: document.localPath,
      }),
    );

    const bytes = await bodyToBuffer(result.Body);

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": document.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${document.fileName ?? documentId}"`,
      },
    });
  } catch (error) {
    console.error("Raw document fetch error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
