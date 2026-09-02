export type AgentAiProvider = "bedrock" | "openai";

/** Client-safe Bedrock defaults (server routes use env-aware resolution). */
const CLIENT_BEDROCK_MODELS: Record<AgentModelTier, string> = {
  sonnet: "us.anthropic.claude-sonnet-4-6",
  opus: "us.anthropic.claude-opus-4-6-v1",
};

export const AGENT_AI_PROVIDER_OPTIONS: Array<{
  id: AgentAiProvider;
  label: string;
  description: string;
}> = [
  {
    id: "bedrock",
    label: "Claude (AWS Bedrock)",
    description: "Uses Claude via AWS Bedrock (production default).",
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "Uses your OpenAI API key from Settings.",
  },
];

export type AgentModelTier = "sonnet" | "opus";

export function parseAgentAiProvider(value: unknown): AgentAiProvider {
  return value === "openai" ? "openai" : "bedrock";
}

/** Client-safe model id for UI labels; API routes resolve env-aware ids server-side. */
export function resolveAgentModelId(provider: AgentAiProvider, tier: AgentModelTier = "sonnet"): string {
  if (provider === "openai") {
    if (tier === "opus") {
      return process.env.NEXT_PUBLIC_OPENAI_OPUS_MODEL || process.env.NEXT_PUBLIC_OPENAI_DEFAULT_MODEL || "gpt-4o";
    }
    return process.env.NEXT_PUBLIC_OPENAI_DEFAULT_MODEL || "gpt-4o";
  }
  return CLIENT_BEDROCK_MODELS[tier];
}

export function formatAgentProviderLabel(provider: AgentAiProvider | string | null | undefined): string {
  if (provider === "openai") return "OpenAI";
  return "Claude (Bedrock)";
}

export function formatAgentRunLabel(args: {
  provider?: string | null;
  model?: string | null;
  createdAt?: string | Date | null;
  fileName?: string | null;
}): string {
  const provider = formatAgentProviderLabel(args.provider);
  const model = args.model ? args.model.replace(/^us\.anthropic\./, "") : null;
  const date = args.createdAt ? new Date(args.createdAt).toLocaleString() : null;
  const parts = [provider, model, date, args.fileName].filter(Boolean);
  return parts.join(" · ");
}
