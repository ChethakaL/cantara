import { AsyncLocalStorage } from "async_hooks";
import { parseAgentAiProvider, type AgentAiProvider } from "@/lib/agent-model-provider";
import { resolveAgentModelId } from "@/lib/agent-model-provider.server";

export type AgentLlmContext = {
  provider: AgentAiProvider;
  modelId: string;
};

const storage = new AsyncLocalStorage<AgentLlmContext>();

export function runWithAgentLlmContext<T>(context: AgentLlmContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getAgentLlmContext(): AgentLlmContext {
  const store = storage.getStore();
  if (store) return store;
  return {
    provider: "bedrock",
    modelId: resolveAgentModelId("bedrock"),
  };
}

export function getActiveAgentProvider(): AgentAiProvider {
  return getAgentLlmContext().provider;
}

export function getActiveAgentModelId(): string {
  return getAgentLlmContext().modelId;
}

/** Restore provider context from a persisted analysis run (TTM, etc.). */
export function llmContextFromStoredAnalysis(analysis: {
  aiProvider?: string | null;
  model?: string | null;
}): AgentLlmContext {
  const provider = parseAgentAiProvider(analysis.aiProvider);
  const modelId =
    String(analysis.model || "").trim() ||
    resolveAgentModelId(provider, provider === "openai" ? "opus" : "sonnet");
  return { provider, modelId };
}
