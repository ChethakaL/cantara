import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { assertS3Configured, buildPublicFileUrl, s3BucketName, s3Client } from "@/lib/s3";

const MAX_ADVISOR_IMAGE_SIZE = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    assertS3Configured();

    const form = await req.formData();
    const file = form.get("file");
    const clientId = String(form.get("clientId") || "");

    if (!(file instanceof File) || !clientId) {
      return new Response("Missing upload fields", { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return new Response("Only image uploads are allowed", { status: 400 });
    }

    if (file.size > MAX_ADVISOR_IMAGE_SIZE) {
      return new Response("Advisor image exceeds the 5MB size limit", { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `clients/${clientId}/advisor-images/${Date.now()}-${safeName}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: s3BucketName,
        Key: key,
        Body: bytes,
        ContentType: file.type,
      }),
    );

    return NextResponse.json({
      imageUrl: buildPublicFileUrl(key),
      key,
    });
  } catch (error) {
    console.error("Advisor image upload error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
