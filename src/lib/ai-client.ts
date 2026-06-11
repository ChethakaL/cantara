import Anthropic from "@anthropic-ai/sdk";
import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk";
import { getAnthropicApiKey } from "@/lib/secure-settings";

export type AIClient = Anthropic | AnthropicBedrock;

/**
 * Maps Cantara architecture model names → current Amazon Bedrock model IDs.
 * Sonnet 4 (20250514) is legacy on Bedrock; we route to Sonnet 4.6 in production.
 * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids.html
 */
const BEDROCK_MODEL_MAP: Record<string, string> = {
  // Primary agent model (lease analysis, TTM, WS1, etc.)
  "claude-sonnet-4-20250514": "us.anthropic.claude-sonnet-4-6",
  // Opus tasks (org chart, insurance, digital presence analysis)
  "claude-opus-4-5": "us.anthropic.claude-opus-4-6-v1",
  // Fast extraction (form questions)
  "claude-3-5-haiku-latest": "us.anthropic.claude-haiku-4-5-20251001-v1:0",
};

export function usesBedrock(): boolean {
  const provider = process.env.AI_PROVIDER?.toLowerCase();
  if (provider === "anthropic") return false;
  if (provider === "bedrock") return true;
  return Boolean(
    process.env.AWS_BEARER_TOKEN_BEDROCK ||
      process.env.AWS_ACCESS_KEY_ID ||
      process.env.AWS_PROFILE ||
      process.env.AWS_ROLE_ARN ||
      process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI,
  );
}

/** True when Bedrock or a direct Anthropic API key is available. */
export async function hasAIConfigured(): Promise<boolean> {
  if (usesBedrock()) {
    return Boolean(
      process.env.AWS_BEARER_TOKEN_BEDROCK ||
        process.env.AWS_ACCESS_KEY_ID ||
        process.env.AWS_PROFILE,
    );
  }
  const { getAnthropicApiKey } = await import("@/lib/secure-settings");
  return Boolean(await getAnthropicApiKey());
}

export function resolveModel(model: string): string {
  if (!usesBedrock()) return model;
  const mapped = BEDROCK_MODEL_MAP[model] ?? model;
  // Allow override per tier via env (optional)
  if (model === "claude-sonnet-4-20250514" && process.env.BEDROCK_SONNET_MODEL) {
    return process.env.BEDROCK_SONNET_MODEL;
  }
  if (model === "claude-opus-4-5" && process.env.BEDROCK_OPUS_MODEL) {
    return process.env.BEDROCK_OPUS_MODEL;
  }
  if (model === "claude-3-5-haiku-latest" && process.env.BEDROCK_HAIKU_MODEL) {
    return process.env.BEDROCK_HAIKU_MODEL;
  }
  return mapped;
}

export async function getAIClient(): Promise<AIClient | null> {
  if (usesBedrock()) {
    return new AnthropicBedrock({
      awsRegion:
        process.env.BEDROCK_REGION ||
        process.env.AWS_REGION ||
        "us-east-1",
    });
  }

  const apiKey = await getAnthropicApiKey();
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

export async function requireAIClient(): Promise<AIClient> {
  const client = await getAIClient();
  if (!client) {
    throw new Error(
      usesBedrock()
        ? "AWS Bedrock is not configured. Set AWS_BEARER_TOKEN_BEDROCK (Bedrock console API key) or AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY, and AI_PROVIDER=bedrock."
        : "ANTHROPIC_API_KEY is required.",
    );
  }
  return client;
}
