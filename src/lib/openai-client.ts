import OpenAI from "openai";
import { getOpenAiApiKey } from "@/lib/secure-settings";

export async function hasOpenAiConfigured(): Promise<boolean> {
  return Boolean(await getOpenAiApiKey());
}

export async function requireOpenAiClient(): Promise<OpenAI> {
  const apiKey = await getOpenAiApiKey();
  if (!apiKey) {
    throw new Error("OpenAI API key is not configured. Add it in Admin Settings.");
  }
  return new OpenAI({ apiKey });
}

/** GPT-5+ and o-series models use max_completion_tokens instead of max_tokens. */
export function openAiUsesMaxCompletionTokens(model: string): boolean {
  const id = model.toLowerCase();
  return id.startsWith("gpt-5") || /^o[0-9]/.test(id);
}

/** Reasoning models (GPT-5+, o-series) reject custom temperature — omit the field. */
export function openAiSupportsTemperature(model: string): boolean {
  return !openAiUsesMaxCompletionTokens(model);
}

export function buildOpenAiChatTokenLimit(model: string, maxTokens: number) {
  if (openAiUsesMaxCompletionTokens(model)) {
    return { max_completion_tokens: maxTokens };
  }
  return { max_tokens: maxTokens };
}

type OpenAiChatSamplingArgs = {
  maxTokens?: number;
  temperature?: number;
};

/** Build Chat Completions params compatible with both legacy and GPT-5.6 models. */
export function buildOpenAiChatParams(model: string, args: OpenAiChatSamplingArgs = {}) {
  const params: Record<string, unknown> = {
    ...buildOpenAiChatTokenLimit(model, args.maxTokens ?? 16000),
  };

  if (openAiSupportsTemperature(model)) {
    params.temperature = args.temperature ?? 0;
  }

  // Optional: tune reasoning for GPT-5.6 tiers via env (sol = demanding, terra = default).
  if (openAiUsesMaxCompletionTokens(model)) {
    const id = model.toLowerCase();
    const effort =
      (id.includes("-sol")
        ? process.env.OPENAI_OPUS_REASONING_EFFORT
        : process.env.OPENAI_DEFAULT_REASONING_EFFORT) || undefined;
    if (effort === "low" || effort === "medium" || effort === "high") {
      params.reasoning_effort = effort;
    }
  }

  return params;
}
