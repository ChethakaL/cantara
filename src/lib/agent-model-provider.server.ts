import { resolveModel } from "@/lib/ai-client";
import type { AgentAiProvider, AgentModelTier } from "@/lib/agent-model-provider";

export function resolveAgentModelId(provider: AgentAiProvider, tier: AgentModelTier = "sonnet"): string {
  if (provider === "openai") {
    if (tier === "opus") {
      return process.env.OPENAI_OPUS_MODEL || process.env.OPENAI_DEFAULT_MODEL || "gpt-4o";
    }
    return process.env.OPENAI_DEFAULT_MODEL || "gpt-4o";
  }
  return resolveModel(tier === "opus" ? "claude-opus-4-5" : "claude-sonnet-4-20250514");
}
