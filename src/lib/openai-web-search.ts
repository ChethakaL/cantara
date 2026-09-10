import { hasOpenAiConfigured, requireOpenAiClient } from "@/lib/openai-client";

function extractResponseText(response: { output_text?: string; output?: unknown[] }): string {
  if (response.output_text?.trim()) {
    return response.output_text.trim();
  }

  const chunks: string[] = [];
  for (const item of response.output ?? []) {
    if (!item || typeof item !== "object") continue;
    const record = item as { type?: string; content?: unknown[] };
    if (record.type !== "message" || !Array.isArray(record.content)) continue;
    for (const part of record.content) {
      if (!part || typeof part !== "object") continue;
      const textPart = part as { type?: string; text?: string };
      if (textPart.type === "output_text" && textPart.text?.trim()) {
        chunks.push(textPart.text.trim());
      }
    }
  }
  return chunks.join("\n").trim();
}

/** Cheap default for research-only web search (not full analysis). */
export function resolveOpenAiWebSearchModel(): string {
  return (
    process.env.OPENAI_WEB_SEARCH_MODEL?.trim() ||
    process.env.OPENAI_DEFAULT_MODEL?.trim() ||
    "gpt-4o-mini"
  );
}

export async function runOpenAiWebSearch(args: {
  prompt: string;
  model?: string;
  /**
   * Prefer GA `web_search` (~$10/1k calls + tokens).
   * Falls back to preview if the account/model rejects GA tool.
   */
  preferLowCostTool?: boolean;
}): Promise<string> {
  const client = await requireOpenAiClient();
  const model = args.model?.trim() || resolveOpenAiWebSearchModel();
  const toolCandidates = args.preferLowCostTool
    ? (["web_search", "web_search_preview_2025_03_11"] as const)
    : (["web_search_preview_2025_03_11", "web_search"] as const);

  let lastError: unknown;
  for (const tool of toolCandidates) {
    try {
      const response = await client.responses.create({
        model,
        tools: [{ type: tool as "web_search" }],
        input: args.prompt,
        max_output_tokens: 1600,
      });
      return extractResponseText(response);
    } catch (error) {
      lastError = error;
      console.warn(`[OpenAI Web Search] tool=${tool} model=${model} failed:`, error instanceof Error ? error.message : error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("OpenAI web search failed");
}

export async function canRunOpenAiWebSearch(): Promise<boolean> {
  return hasOpenAiConfigured();
}
