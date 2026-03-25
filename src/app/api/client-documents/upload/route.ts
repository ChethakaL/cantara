import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertS3Configured, buildPublicFileUrl, s3BucketName, s3Client } from "@/lib/s3";
import { serializeInsuranceReview, summarizeInsuranceClaimPdf } from "@/lib/insurance-review";

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
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

    console.info("[client-documents/upload] Start", {
      clientId,
      documentId,
      uploaderEmail,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    });

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
    console.info("[client-documents/upload] Stored in S3", {
      clientId,
      documentId,
      key,
      elapsedMs: Date.now() - startedAt,
    });
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
    console.info("[client-documents/upload] Document row created", {
      clientId,
      documentId,
      documentRecordId: document.id,
      elapsedMs: Date.now() - startedAt,
    });

    if (documentId === "insurance_claims_12m" && (file.type || "").includes("pdf")) {
      try {
        const reviewStartedAt = Date.now();
        console.info("[client-documents/upload] Starting insurance auto-review", {
          clientId,
          documentId,
          documentRecordId: document.id,
        });
        const review = await summarizeInsuranceClaimPdf({
          fileName: file.name,
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
        console.info("[client-documents/upload] Insurance auto-review complete", {
          clientId,
          documentId,
          documentRecordId: document.id,
          reviewElapsedMs: Date.now() - reviewStartedAt,
          totalElapsedMs: Date.now() - startedAt,
        });
      } catch (reviewError) {
        console.error("Insurance review error:", reviewError);
        await (prisma as any).clientDocument.update({
          where: { id: document.id },
          data: {
            aiDetectedType: "insurance_claim",
            aiReviewStatus: "failed",
            aiReviewSummary: "Insurance Review Agent could not summarize this file automatically.",
            aiReviewFlags: ["Automatic insurance review failed."],
            aiReviewedAt: new Date(),
          },
        });
        console.error("[client-documents/upload] Insurance auto-review failed", {
          clientId,
          documentId,
          documentRecordId: document.id,
          totalElapsedMs: Date.now() - startedAt,
        });
      }
    }

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

    console.info("[client-documents/upload] Completed", {
      clientId,
      documentId,
      documentRecordId: document.id,
      totalElapsedMs: Date.now() - startedAt,
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
