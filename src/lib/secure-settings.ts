import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

const ANTHROPIC_SECRET_KEY = "anthropic_api_key";
const VERSION = "v1";

function encryptionSecret() {
  return (
    process.env.APP_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.DATABASE_URL ||
    "cantara-local-development-secret"
  );
}

function encryptionKey() {
  return crypto.createHash("sha256").update(encryptionSecret()).digest();
}

export function encryptSecret(plainText: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptSecret(payload: string) {
  const [version, ivRaw, tagRaw, encryptedRaw] = payload.split(":");
  if (version !== VERSION || !ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("Unsupported secret payload format");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivRaw, "base64"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function maskSecret(value: string | null | undefined) {
  if (!value) return null;
  if (value.length <= 8) return `${value.slice(0, 2)}...${value.slice(-2)}`;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export async function getStoredAnthropicApiKey() {
  const secret = await (prisma as any).appSecret.findUnique({
    where: { key: ANTHROPIC_SECRET_KEY },
  });
  if (!secret?.value) return null;
  return decryptSecret(secret.value);
}

export async function saveStoredAnthropicApiKey(apiKey: string) {
  const trimmed = apiKey.trim();
  if (!trimmed) throw new Error("Claude API key is required");
  await (prisma as any).appSecret.upsert({
    where: { key: ANTHROPIC_SECRET_KEY },
    update: { value: encryptSecret(trimmed) },
    create: { key: ANTHROPIC_SECRET_KEY, value: encryptSecret(trimmed) },
  });
  return maskSecret(trimmed);
}

export async function getAnthropicApiKey() {
  try {
    const stored = await getStoredAnthropicApiKey();
    if (stored) return stored;
  } catch (error) {
    console.error("[secure-settings] Failed to load stored Claude API key; falling back to env.", error);
  }
  return process.env.ANTHROPIC_API_KEY || "";
}

export async function getAnthropicClient() {
  const apiKey = await getAnthropicApiKey();
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}
