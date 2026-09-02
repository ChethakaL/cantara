import { requireOpenAiClient } from "@/lib/openai-client";

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

export async function runOpenAiWebSearch(args: {
  prompt: string;
  model: string;
}): Promise<string> {
  const client = await requireOpenAiClient();
  const response = await client.responses.create({
    model: args.model,
    tools: [{ type: "web_search_preview_2025_03_11" }],
    input: args.prompt,
  });

  return extractResponseText(response);
}
