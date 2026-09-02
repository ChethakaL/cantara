import { useState } from "react";
import type { AgentAiProvider } from "@/lib/agent-model-provider";
import { resolveAgentModelId } from "@/lib/agent-model-provider";

export function useAgentAiProvider(defaultProvider: AgentAiProvider = "bedrock") {
  const [provider, setProvider] = useState<AgentAiProvider>(defaultProvider);
  const [lastModelId, setLastModelId] = useState<string | null>(null);

  const recordModelUsed = (usedProvider?: AgentAiProvider) => {
    setLastModelId(resolveAgentModelId(usedProvider ?? provider));
  };

  return { provider, setProvider, lastModelId, setLastModelId, recordModelUsed };
}
