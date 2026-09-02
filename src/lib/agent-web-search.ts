import type { AgentAiProvider } from "@/lib/agent-model-provider";
import { requireAIClient, resolveModel, usesBedrock } from "@/lib/ai-client";
import { getActiveAgentModelId, getActiveAgentProvider } from "@/lib/agent-llm-context";
import { resolveAgentModelId } from "@/lib/agent-model-provider.server";
import { runOpenAiWebSearch } from "@/lib/openai-web-search";

export type WebSearchResult = {
  title: string;
  url: string;
  content: string;
  score: number;
};

function parseWebSearchJson(rawText: string, channelLabel: string): WebSearchResult[] {
  const cleaned = rawText.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();

  try {
    const results = JSON.parse(cleaned);
    if (Array.isArray(results)) {
      return results.map((r: Record<string, unknown>) => ({
        title: String(r.title ?? ""),
        url: String(r.url ?? ""),
        content: String(r.content ?? ""),
        score: typeof r.score === "number" ? r.score : 0.8,
      }));
    }
  } catch {
    // fall through
  }

  if (rawText.trim()) {
    return [
      {
        title: `${channelLabel} Research`,
        url: "",
        content: rawText.slice(0, 2000),
        score: 0.7,
      },
    ];
  }

  return [];
}

function buildWebSearchPrompt(args: {
  queries: string[];
  businessName: string;
  channelLabel: string;
}): string {
  return `Search for the following information about "${args.businessName}" for a ${args.channelLabel} digital presence audit. For each search result, extract the key metrics (ratings, review counts, follower counts, engagement data, etc.) accurately.

Search queries to execute:
${args.queries.map((q, i) => `${i + 1}. ${q}`).join("\n")}

After searching, return a JSON array of findings:
[
  {
    "title": "Result title",
    "url": "Source URL",
    "content": "Key information found including exact metrics, ratings, review counts, follower counts etc.",
    "score": 0.9
  }
]

IMPORTANT: Report exact numbers as found on the source websites. Do not estimate or round. If a Google Business Profile shows 4.3 stars with 287 reviews, report exactly "4.3 stars" and "287 reviews". Return ONLY the JSON array.`;
}

async function claudeWebSearch(args: {
  queries: string[];
  businessName: string;
  channelLabel: string;
}): Promise<WebSearchResult[]> {
  const client = await requireAIClient();
  const prompt = buildWebSearchPrompt(args);

  try {
    const response = usesBedrock()
      ? await client.messages.create({
          model: resolveModel("claude-sonnet-4-20250514"),
          max_tokens: 2000,
          temperature: 0,
          messages: [{ role: "user", content: prompt }],
        })
      : await client.messages.create({
          model: resolveModel("claude-sonnet-4-20250514"),
          max_tokens: 2000,
          temperature: 0,
          tools: [{ type: "web_search_20250305" as never, name: "web_search" }],
          messages: [{ role: "user", content: prompt }],
        });

    const textBlocks = response.content.filter((b) => b.type === "text");
    const rawText = textBlocks.map((b) => ("text" in b ? b.text : "")).join("").trim();
    return parseWebSearchJson(rawText, args.channelLabel);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Agent Web Search] Claude error for ${args.channelLabel}:`, message);
    return [];
  }
}

async function openAiWebSearch(args: {
  queries: string[];
  businessName: string;
  channelLabel: string;
  model: string;
}): Promise<WebSearchResult[]> {
  const prompt = buildWebSearchPrompt(args);

  try {
    const rawText = await runOpenAiWebSearch({ prompt, model: args.model });
    return parseWebSearchJson(rawText, args.channelLabel);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Agent Web Search] OpenAI error for ${args.channelLabel}:`, message);
    return [];
  }
}

export async function agentWebSearch(args: {
  queries: string[];
  businessName: string;
  channelLabel: string;
  provider?: AgentAiProvider;
  modelId?: string;
}): Promise<WebSearchResult[]> {
  const provider = args.provider ?? getActiveAgentProvider();
  const modelId =
    args.modelId ??
    getActiveAgentModelId() ??
    resolveAgentModelId(provider);

  if (provider === "openai") {
    return openAiWebSearch({
      queries: args.queries,
      businessName: args.businessName,
      channelLabel: args.channelLabel,
      model: modelId,
    });
  }

  return claudeWebSearch(args);
}
