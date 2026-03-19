import { S3Client } from "@aws-sdk/client-s3";

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
const endpoint = process.env.S3_ENDPOINT || process.env.AWS_S3_ENDPOINT || undefined;

export const s3BucketName =
  process.env.S3_BUCKET ||
  process.env.AWS_S3_BUCKET ||
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
    throw new Error("S3 bucket is not configured. Set S3_BUCKET or AWS_S3_BUCKET.");
  }
}
