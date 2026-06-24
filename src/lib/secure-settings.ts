import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

const ANTHROPIC_SECRET_KEY = "anthropic_api_key";
const UNIPILE_MAIL_ACCOUNT_ID_KEY = "unipile_mail_account_id";
const COMPOSIO_MAIL_CONNECTED_ACCOUNT_ID_KEY = "composio_mail_connected_account_id";
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

export async function hasStoredUnipileMailAccountId() {
  const secret = await (prisma as any).appSecret.findUnique({
    where: { key: UNIPILE_MAIL_ACCOUNT_ID_KEY },
    select: { value: true },
  });
  return Boolean(secret?.value);
}

export async function getStoredUnipileMailAccountId() {
  const secret = await (prisma as any).appSecret.findUnique({
    where: { key: UNIPILE_MAIL_ACCOUNT_ID_KEY },
  });
  if (!secret?.value) return null;
  try {
    return decryptSecret(secret.value);
  } catch (error) {
    console.error(
      "[secure-settings] Cannot decrypt unipile_mail_account_id. AUTH_SECRET/APP_SECRET may have changed since connect.",
      error,
    );
    return null;
  }
}

export async function saveStoredUnipileMailAccountId(accountId: string) {
  const trimmed = accountId.trim();
  if (!trimmed) throw new Error("Unipile account id is required");
  await (prisma as any).appSecret.upsert({
    where: { key: UNIPILE_MAIL_ACCOUNT_ID_KEY },
    update: { value: encryptSecret(trimmed) },
    create: { key: UNIPILE_MAIL_ACCOUNT_ID_KEY, value: encryptSecret(trimmed) },
  });
  return maskSecret(trimmed);
}

export async function clearStoredUnipileMailAccountId() {
  await (prisma as any).appSecret.deleteMany({
    where: { key: UNIPILE_MAIL_ACCOUNT_ID_KEY },
  });
}

export async function hasStoredComposioMailConnectedAccountId() {
  const secret = await (prisma as any).appSecret.findUnique({
    where: { key: COMPOSIO_MAIL_CONNECTED_ACCOUNT_ID_KEY },
    select: { value: true },
  });
  return Boolean(secret?.value);
}

export async function getStoredComposioMailConnectedAccountId() {
  const secret = await (prisma as any).appSecret.findUnique({
    where: { key: COMPOSIO_MAIL_CONNECTED_ACCOUNT_ID_KEY },
  });
  if (!secret?.value) return null;
  try {
    return decryptSecret(secret.value);
  } catch (error) {
    console.error(
      "[secure-settings] Cannot decrypt composio_mail_connected_account_id. AUTH_SECRET/APP_SECRET may have changed since connect.",
      error,
    );
    return null;
  }
}

export async function saveStoredComposioMailConnectedAccountId(accountId: string) {
  const trimmed = accountId.trim();
  if (!trimmed) throw new Error("Composio connected account id is required");
  await (prisma as any).appSecret.upsert({
    where: { key: COMPOSIO_MAIL_CONNECTED_ACCOUNT_ID_KEY },
    update: { value: encryptSecret(trimmed) },
    create: { key: COMPOSIO_MAIL_CONNECTED_ACCOUNT_ID_KEY, value: encryptSecret(trimmed) },
  });
  return maskSecret(trimmed);
}

export async function clearStoredComposioMailConnectedAccountId() {
  await (prisma as any).appSecret.deleteMany({
    where: { key: COMPOSIO_MAIL_CONNECTED_ACCOUNT_ID_KEY },
  });
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
  const { getAIClient } = await import("@/lib/ai-client");
  return getAIClient();
}

const MONDAY_BOARD_ID_KEY = "monday_global_board_id";
const MONDAY_MAPPING_KEY = "monday_global_column_mapping";

export async function getStoredMondayBoardId() {
  const secret = await (prisma as any).appSecret.findUnique({
    where: { key: MONDAY_BOARD_ID_KEY },
  });
  return secret?.value ? decryptSecret(secret.value) : null;
}

export async function saveStoredMondayBoardId(boardId: string) {
  const trimmed = boardId.trim();
  await (prisma as any).appSecret.upsert({
    where: { key: MONDAY_BOARD_ID_KEY },
    update: { value: encryptSecret(trimmed) },
    create: { key: MONDAY_BOARD_ID_KEY, value: encryptSecret(trimmed) },
  });
}

export async function getStoredMondayColumnMapping() {
  const secret = await (prisma as any).appSecret.findUnique({
    where: { key: MONDAY_MAPPING_KEY },
  });
  if (!secret?.value) return null;
  try {
    const jsonStr = decryptSecret(secret.value);
    return JSON.parse(jsonStr);
  } catch (e) {
    return null;
  }
}

export async function saveStoredMondayColumnMapping(mapping: Record<string, string | null>) {
  const jsonStr = JSON.stringify(mapping);
  await (prisma as any).appSecret.upsert({
    where: { key: MONDAY_MAPPING_KEY },
    update: { value: encryptSecret(jsonStr) },
    create: { key: MONDAY_MAPPING_KEY, value: encryptSecret(jsonStr) },
  });
}
