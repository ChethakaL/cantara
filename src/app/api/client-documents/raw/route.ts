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

    let document = await (prisma as any).clientDocument.findFirst({
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
      const status = await (prisma as any).clientDocumentStatus.findUnique({
        where: { clientId_documentId: { clientId, documentId } },
        select: { fileName: true, fileUrl: true },
      });
      const key = storageKeyFromFileUrl(status?.fileUrl);
      if (key) {
        document = {
          fileName: status?.fileName || documentId,
          mimeType: mimeTypeFromFileName(status?.fileName || ""),
          localPath: key,
          storageBucket: bucketFromFileUrl(status?.fileUrl) || s3BucketName,
        };
      }
    }

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
        "Content-Disposition": buildInlineContentDisposition(document.fileName ?? "", documentId),
      },
    });
  } catch (error) {
    console.error("Raw document fetch error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

function storageKeyFromFileUrl(fileUrl: string | null | undefined) {
  if (!fileUrl) return null;
  try {
    const url = new URL(fileUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    if (!parts.length) return null;
    if (bucketFromVirtualHostedUrl(url)) return parts.join("/");
    if (parts.length < 2) return null;
    return parts.slice(1).join("/");
  } catch {
    return null;
  }
}

function bucketFromFileUrl(fileUrl: string | null | undefined) {
  if (!fileUrl) return null;
  try {
    const url = new URL(fileUrl);
    const virtualHostedBucket = bucketFromVirtualHostedUrl(url);
    if (virtualHostedBucket) return virtualHostedBucket;
    return url.pathname.split("/").filter(Boolean)[0] || null;
  } catch {
    return null;
  }
}

function bucketFromVirtualHostedUrl(url: URL) {
  const marker = ".s3.";
  const markerIndex = url.hostname.indexOf(marker);
  if (markerIndex > 0) return url.hostname.slice(0, markerIndex);
  if (url.hostname.endsWith(".s3.amazonaws.com")) return url.hostname.replace(".s3.amazonaws.com", "");
  return null;
}

function mimeTypeFromFileName(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".txt")) return "text/plain";
  return "application/octet-stream";
}

/** HTTP headers must be ASCII; use RFC 5987 for Unicode filenames (e.g. en-dash). */
function buildInlineContentDisposition(fileName: string, fallback: string): string {
  const name = fileName || fallback;
  const asciiName = name
    .replace(/[^\x20-\x7E]/g, "-")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
  return `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
