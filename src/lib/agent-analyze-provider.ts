import { parseAgentAiProvider } from "@/lib/agent-model-provider";
import { resolveAgentModelId } from "@/lib/agent-model-provider.server";
import { hasOpenAiConfigured } from "@/lib/openai-client";
import type { AgentMessageBlock } from "@/lib/llm-completion";
import { createTextStreamResponse, streamAgentMessage } from "@/lib/llm-completion";

export function parseAnalyzeProvider(raw: unknown) {
  return parseAgentAiProvider(raw);
}

export function resolveAnalyzeModelId(provider: ReturnType<typeof parseAnalyzeProvider>, requestedModelId?: unknown) {
  return String(requestedModelId || resolveAgentModelId(provider));
}

export async function assertOpenAiConfiguredForAnalyze(): Promise<Response | null> {
  if (await hasOpenAiConfigured()) return null;
  return new Response("OpenAI API key is not configured. Add it in Admin Settings.", { status: 400 });
}

export async function maybeOpenAiStreamFromBlocks(args: {
  provider: ReturnType<typeof parseAnalyzeProvider>;
  modelId: string;
  system: string;
  userContent: AgentMessageBlock[];
  maxTokens?: number;
}): Promise<Response | null> {
  if (args.provider !== "openai") return null;
  const gate = await assertOpenAiConfiguredForAnalyze();
  if (gate) return gate;
  const stream = await streamAgentMessage({
    provider: args.provider,
    model: args.modelId,
    system: args.system,
    content: args.userContent,
    maxTokens: args.maxTokens ?? 8000,
    temperature: 0,
  });
  return createTextStreamResponse(stream);
}
