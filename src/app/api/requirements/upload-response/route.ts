import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertS3Configured, buildPublicFileUrl, s3BucketName, s3Client } from "@/lib/s3";

export async function POST(req: NextRequest) {
  try {
    assertS3Configured();
    const form = await req.formData();
    const file = form.get("file");
    const requirementId = String(form.get("requirementId") || "");

    if (!(file instanceof File) || !requirementId) {
      return new Response("Missing upload fields", { status: 400 });
    }

    const requirement = await prisma.additionalRequirement.findUnique({
      where: { id: requirementId },
      select: { clientId: true },
    });

    if (!requirement) {
      return new Response("Requirement not found", { status: 404 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `clients/${requirement.clientId}/requirement-responses/${requirementId}/${Date.now()}-${safeName}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: s3BucketName,
        Key: key,
        Body: bytes,
        ContentType: file.type || "application/octet-stream",
      }),
    );

    const fileUrl = buildPublicFileUrl(key);

    return NextResponse.json({
      fileName: file.name,
      fileUrl,
    });
  } catch (error) {
    console.error("Requirement response upload error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
