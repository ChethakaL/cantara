import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const region =
  process.env.AWS_REGION ||
  process.env.AWS_S3_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  "us-east-1";
const endpoint =
  process.env.S3_ENDPOINT ||
  process.env.AWS_S3_ENDPOINT ||
  process.env.AWS_S3_ENDPOINT_URL ||
  undefined;

export const s3BucketName =
  process.env.S3_BUCKET ||
  process.env.AWS_S3_BUCKET ||
  process.env.AWS_S3_BUCKET_NAME ||
  process.env.S3_BUCKET_NAME ||
  "";

export const s3Client = new S3Client({
  region,
  endpoint,
  forcePathStyle: Boolean(endpoint),
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
});

export function assertS3Configured() {
  if (!s3BucketName) {
    throw new Error("S3 bucket is not configured. Set S3_BUCKET, AWS_S3_BUCKET, or AWS_S3_BUCKET_NAME.");
  }
}

export function buildPublicFileUrl(key: string) {
  const explicitBase = process.env.S3_PUBLIC_BASE_URL || process.env.AWS_S3_PUBLIC_BASE_URL;
  if (explicitBase) {
    return `${explicitBase.replace(/\/$/, "")}/${key}`;
  }
  if (endpoint) {
    return `${endpoint.replace(/\/$/, "")}/${s3BucketName}/${key}`;
  }
  return `https://${s3BucketName}.s3.${region}.amazonaws.com/${key}`;
}

export function buildPresignedFileUrl(key: string, expiresInSeconds = 60 * 15) {
  assertS3Configured();
  return getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: s3BucketName,
      Key: key,
    }),
    { expiresIn: expiresInSeconds },
  );
}
