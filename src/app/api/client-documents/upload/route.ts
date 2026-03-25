import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertS3Configured, buildPublicFileUrl, s3BucketName, s3Client } from "@/lib/s3";
import { serializeInsuranceReview, summarizeInsuranceClaimPdf } from "@/lib/insurance-review";

/** Run insurance AI after the HTTP response is sent so the browser is not blocked on a long POST. */
function scheduleInsuranceAutoReview(args: {
  documentRecordId: string;
  clientId: string;
  documentId: string;
  fileName: string;
  base64: string;
}) {
  void (async () => {
    const reviewStartedAt = Date.now();
    console.info("[client-documents/upload] Background insurance auto-review start", {
      clientId: args.clientId,
      documentId: args.documentId,
      documentRecordId: args.documentRecordId,
    });
    try {
      const review = await summarizeInsuranceClaimPdf({
        fileName: args.fileName,
        base64: args.base64,
      });

      await (prisma as any).clientDocument.update({
        where: { id: args.documentRecordId },
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
      console.info("[client-documents/upload] Background insurance auto-review complete", {
        clientId: args.clientId,
        documentId: args.documentId,
        documentRecordId: args.documentRecordId,
        reviewElapsedMs: Date.now() - reviewStartedAt,
      });
    } catch (reviewError) {
      console.error("[client-documents/upload] Background insurance auto-review error:", reviewError);
      try {
        await (prisma as any).clientDocument.update({
          where: { id: args.documentRecordId },
          data: {
            aiDetectedType: "insurance_claim",
            aiReviewStatus: "failed",
            aiReviewSummary: "Insurance Review Agent could not summarize this file automatically.",
            aiReviewFlags: ["Automatic insurance review failed."],
            aiReviewedAt: new Date(),
          },
        });
      } catch (updateError) {
        console.error("[client-documents/upload] Failed to mark insurance review as failed", updateError);
      }
      console.error("[client-documents/upload] Background insurance auto-review failed", {
        clientId: args.clientId,
        documentId: args.documentId,
        documentRecordId: args.documentRecordId,
        reviewElapsedMs: Date.now() - reviewStartedAt,
      });
    }
  })();
}

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

    const isInsurancePdf =
      documentId === "insurance_claims_12m" && (file.type || "").includes("pdf");

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
        ...(isInsurancePdf
          ? {
              aiReviewStatus: "processing",
              aiDetectedType: "insurance_claim",
            }
          : {}),
      },
    });
    console.info("[client-documents/upload] Document row created", {
      clientId,
      documentId,
      documentRecordId: document.id,
      insuranceReviewDeferred: isInsurancePdf,
      elapsedMs: Date.now() - startedAt,
    });

    console.info("[client-documents/upload] Writing document status", {
      clientId,
      documentId,
      elapsedMs: Date.now() - startedAt,
    });

    const uploadedAt = new Date();
    const statusUpdate = {
      hasDoc: true,
      fileName: file.name,
      fileUrl: publicUrl,
      uploadedAt,
      notApplicable: false,
    };

    await (prisma as any).$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '5s'`);
      await tx.clientDocumentStatus.upsert({
        where: {
          clientId_documentId: {
            clientId,
            documentId,
          },
        },
        update: statusUpdate,
        create: {
          clientId,
          documentId,
          ...statusUpdate,
        },
      });
    });

    console.info("[client-documents/upload] Document status written", {
      clientId,
      documentId,
      elapsedMs: Date.now() - startedAt,
    });

    console.info("[client-documents/upload] Completed", {
      clientId,
      documentId,
      documentRecordId: document.id,
      totalElapsedMs: Date.now() - startedAt,
    });

    if (isInsurancePdf) {
      scheduleInsuranceAutoReview({
        documentRecordId: document.id,
        clientId,
        documentId,
        fileName: file.name,
        base64: bytes.toString("base64"),
      });
    }

    console.info("[client-documents/upload] Sending HTTP response to client (AI may continue in background)", {
      clientId,
      documentId,
      insuranceReviewPending: isInsurancePdf,
      totalElapsedMs: Date.now() - startedAt,
    });

    return NextResponse.json({
      id: document.id,
      fileName: document.fileName,
      fileUrl: publicUrl,
      uploadedAt: document.createdAt.toISOString(),
      insuranceReviewPending: isInsurancePdf,
    });
  } catch (error) {
    console.error("Upload Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
