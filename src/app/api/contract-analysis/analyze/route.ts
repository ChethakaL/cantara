import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "@/lib/secure-settings"
import { NextRequest } from "next/server";
import { CONTRACT_ANALYSIS_SYSTEM_PROMPT } from "@/lib/contract-analysis/prompt";
import { getAIClient, requireAIClient, resolveModel, usesBedrock } from "@/lib/ai-client"

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { documents } = await req.json();

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return new Response("No documents provided", { status: 400 });
    }

    const client = await requireAIClient();

    const userContent: Anthropic.Messages.ContentBlockParam[] = [
      ...documents.map((doc: { base64: string }) => ({
        type: "document" as const,
        source: {
          type: "base64" as const,
          media_type: "application/pdf" as const,
          data: doc.base64,
        },
      })),
      {
        type: "text" as const,
        text: `Please analyze the ${documents.length} contract document(s) provided above. Produce the full contract diligence report exactly as instructed. Document names for reference: ${documents.map((doc: { name: string }) => doc.name).join(", ")}`,
      },
    ];

    const result = await client.messages.create({
      model: resolveModel("claude-sonnet-4-20250514"),
      max_tokens: 8000,
      temperature: 0,
      system: CONTRACT_ANALYSIS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    const text = result.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    console.log("[contract-analysis] Claude response:\n", text);

    return new Response(text, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
