import { DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseStoredInsuranceReview, serializeInsuranceReview, summarizeInsuranceClaimPdf } from "@/lib/insurance-review";
import { assertS3Configured, s3BucketName, s3Client } from "@/lib/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get("clientId");
    if (!clientId) {
      return new Response("Missing clientId", { status: 400 });
    }

    const document = await (prisma as any).clientDocument.findFirst({
      where: {
        clientId,
        documentId: "insurance_claims_12m",
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        localPath: true,
        storageBucket: true,
        createdAt: true,
        aiDetectedType: true,
        aiReviewFlags: true,
        aiReviewStatus: true,
        aiReviewSummary: true,
      },
    });

    if (!document) {
      return NextResponse.json({ document: null, summary: null });
    }

    const parsedReview = parseStoredInsuranceReview(document.aiReviewSummary);

    return NextResponse.json({
      document: {
        id: document.id,
        fileName: document.fileName,
        createdAt: document.createdAt.toISOString(),
      },
      summary: parsedReview
        ? {
            ...parsedReview,
            claimType: document.aiDetectedType || parsedReview.claimType,
            flags: document.aiReviewFlags ?? [],
            status: document.aiReviewStatus || parsedReview.status,
            cached: true,
          }
        : null,
    });
  } catch (error) {
    console.error("Insurance review fetch error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    assertS3Configured();
    const { clientId } = await req.json();

    if (!clientId) {
      return new Response("Missing clientId", { status: 400 });
    }

    const document = await (prisma as any).clientDocument.findFirst({
      where: {
        clientId,
        documentId: "insurance_claims_12m",
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        localPath: true,
        storageBucket: true,
      },
    });

    if (!document?.localPath) {
      return new Response("Insurance claim document not found", { status: 404 });
    }

    if (!(document.mimeType || "").includes("pdf") && !document.fileName.toLowerCase().endsWith(".pdf")) {
      return new Response("Insurance Review Agent currently supports PDF uploads only", { status: 400 });
    }

    const file = await s3Client.send(new GetObjectCommand({
      Bucket: document.storageBucket || s3BucketName,
      Key: document.localPath,
    }));
    const chunks: Buffer[] = [];
    for await (const chunk of file.Body as any) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const bytes = Buffer.concat(chunks);

    const review = await summarizeInsuranceClaimPdf({
      fileName: document.fileName,
      base64: bytes.toString("base64"),
    });

    await (prisma as any).clientDocument.update({
      where: { id: document.id },
      data: {
        aiDetectedType: review.claimType || "insurance_claim",
        aiReviewStatus: review.status || "complete",
        aiReviewSummary: serializeInsuranceReview(review),
        aiReviewFlags: review.withinLast12Months === false
          ? [`Claim is older than 12 months${review.incidentDate && review.incidentDate !== "Unknown" ? ` (incident date: ${review.incidentDate})` : ""}.`]
          : [],
        aiReviewedAt: new Date(),
      },
    });

    return NextResponse.json({
      document: {
        id: document.id,
        fileName: document.fileName,
      },
      summary: review,
    });
  } catch (error) {
    console.error("Insurance review run error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    assertS3Configured();
    const clientId = req.nextUrl.searchParams.get("clientId");

    if (!clientId) {
      return new Response("Missing clientId", { status: 400 });
    }

    const documents = await (prisma as any).clientDocument.findMany({
      where: {
        clientId,
        documentId: "insurance_claims_12m",
      },
      select: {
        id: true,
        localPath: true,
        storageBucket: true,
      },
    });

    console.info("[insurance-review] Reset requested", {
      clientId,
      documentCount: documents.length,
    });

    for (const document of documents) {
      if (!document.localPath) continue;
      try {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: document.storageBucket || s3BucketName,
          Key: document.localPath,
        }));
      } catch (storageError) {
        console.error("[insurance-review] Failed to delete S3 object", {
          clientId,
          documentId: document.id,
          key: document.localPath,
          storageError,
        });
      }
    }

    await (prisma as any).clientDocument.deleteMany({
      where: {
        clientId,
        documentId: "insurance_claims_12m",
      },
    });

    try {
      await (prisma as any).clientDocumentStatus.delete({
        where: {
          clientId_documentId: {
            clientId,
            documentId: "insurance_claims_12m",
          },
        },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025")) {
        throw error;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Insurance review reset error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
