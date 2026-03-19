import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { CONTRACT_ANALYSIS_SYSTEM_PROMPT } from "@/lib/contract-analysis/prompt";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { documents } = await req.json();

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return new Response("No documents provided", { status: 400 });
    }

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    });

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

    const stream = await client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      temperature: 0,
      system: CONTRACT_ANALYSIS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            controller.enqueue(new TextEncoder().encode(chunk.delta.text));
          }
        }
        controller.close();
      },
      cancel() {
        stream.controller.abort();
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
