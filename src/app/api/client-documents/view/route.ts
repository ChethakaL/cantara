import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertS3Configured, s3BucketName, s3Client } from "@/lib/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    assertS3Configured();

    const clientId = req.nextUrl.searchParams.get("clientId");
    const documentId = req.nextUrl.searchParams.get("documentId");
    const recordId = req.nextUrl.searchParams.get("recordId");

    if (!clientId || (!documentId && !recordId)) {
      return new Response("Missing clientId and documentId or recordId", { status: 400 });
    }

    const document = recordId
      ? await (prisma as any).clientDocument.findFirst({
          where: { id: recordId, clientId },
          select: {
            localPath: true,
            storageBucket: true,
          },
        })
      : await (prisma as any).clientDocument.findFirst({
          where: { clientId, documentId },
          orderBy: { createdAt: "desc" },
          select: {
            localPath: true,
            storageBucket: true,
          },
        });

    if (!document?.localPath) {
      return new Response("Document not found", { status: 404 });
    }

    const signedUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: document.storageBucket || s3BucketName,
        Key: document.localPath,
      }),
      { expiresIn: 60 * 10 },
    );

    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error("View document error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
