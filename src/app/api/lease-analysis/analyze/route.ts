import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { LEASE_ANALYSIS_SYSTEM_PROMPT } from "@/lib/lease-analysis/prompt";

export const maxDuration = 300; // 5 min — large PDFs need time

export async function POST(req: NextRequest) {
  try {
    const { documents } = await req.json();

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
        return new Response("No documents provided", { status: 400 });
    }

    const client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    });

    console.log(`[API Analyze] Starting streaming analysis for ${documents.length} documents.`);

    // Build the content array: one document block per PDF + instruction text
    // Note: Anthropic's document support requires specific block structure
    const userContent: any[] = [
      ...documents.map((doc: any) => ({
        type: "document",
        source: {
          type: "base64",
          media_type: doc.mediaType || "application/pdf",
          data: doc.base64,
        },
      })),
      {
        type: "text",
        text: `Please analyze the ${documents.length} lease document(s) provided above. 
               Produce the full analysis report as specified in your instructions. 
               Document names for reference: ${documents.map((d: any) => d.name).join(", ")}`,
      },
    ];

    const stream = await client.messages.stream({
      model: "claude-sonnet-4-20250514", // Exactly as specified in architecture.md
      max_tokens: 8000,
      temperature: 0,
      system: LEASE_ANALYSIS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    // Pipe Anthropic stream to Next.js Response
    const readableStream = new ReadableStream({
      async start(controller) {
        let fullResponse = "";
        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            const text = chunk.delta.text;
            fullResponse += text;
            controller.enqueue(new TextEncoder().encode(text));
          }
        }
        console.log("[API Analyze] Claude response complete. Total length:", fullResponse.length);
        console.log("[API Analyze] FULL RESPONSE:\n", fullResponse);
        controller.close();
      },
      cancel() {
        console.log("[API Analyze] Stream cancelled by client.");
        stream.controller.abort();
      }
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Accel-Buffering": "no", // disables nginx buffering for true streaming
      },
    });
  } catch (error: any) {
    console.error("[API Analyze Error]:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
    });
  }
}
