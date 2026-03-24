import Anthropic, {
  APIConnectionError,
  APIConnectionTimeoutError,
  InternalServerError,
  RateLimitError,
} from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { buildLeaseAnalysisSystemPrompt } from "@/lib/lease-analysis/prompt";

export const maxDuration = 300; // 5 min — large PDFs need time

const MAX_UPSTREAM_ATTEMPTS = 3;
const UPSTREAM_RETRY_DELAYS_MS = [1000, 2500];
type LeaseMessageStream = AsyncIterable<any> & { controller: { abort: () => void } };

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
    const systemPrompt = buildLeaseAnalysisSystemPrompt(new Date());

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

    let activeStream: LeaseMessageStream | null = null;

    // Pipe Anthropic stream to Next.js Response
    const readableStream = new ReadableStream({
      async start(controller) {
        let fullResponse = "";
        for (let attempt = 1; attempt <= MAX_UPSTREAM_ATTEMPTS; attempt += 1) {
          let sawText = false;

          try {
            activeStream = await client.messages.stream({
              model: "claude-sonnet-4-20250514", // Exactly as specified in architecture.md
              max_tokens: 8000,
              temperature: 0,
              system: systemPrompt,
              messages: [{ role: "user", content: userContent }],
            });

            for await (const chunk of activeStream) {
              if (
                chunk.type === "content_block_delta" &&
                chunk.delta.type === "text_delta"
              ) {
                const text = chunk.delta.text;
                sawText = true;
                fullResponse += text;
                controller.enqueue(new TextEncoder().encode(text));
              }
            }

            console.log("[API Analyze] Claude response complete. Total length:", fullResponse.length);
            console.log("[API Analyze] FULL RESPONSE:\n", fullResponse);
            controller.close();
            return;
          } catch (error) {
            activeStream?.controller.abort();
            activeStream = null;

            const shouldRetry =
              !sawText &&
              attempt < MAX_UPSTREAM_ATTEMPTS &&
              isRetryableLeaseAnalysisError(error);

            console.error(`[API Analyze] Attempt ${attempt} failed:`, error);

            if (!shouldRetry) {
              controller.error(error instanceof Error ? error : new Error(String(error)));
              return;
            }

            await delay(UPSTREAM_RETRY_DELAYS_MS[attempt - 1] ?? 3000);
          }
        }
      },
      cancel() {
        console.log("[API Analyze] Stream cancelled by client.");
        activeStream?.controller.abort();
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
    return NextResponse.json(
      { error: formatLeaseAnalysisError(error) },
      { status: isRetryableLeaseAnalysisError(error) ? 503 : 500 },
    );
  }
}

function isRetryableLeaseAnalysisError(error: unknown) {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: number }).status)
      : undefined;
  const message = error instanceof Error ? error.message : String(error);

  return (
    error instanceof APIConnectionError ||
    error instanceof APIConnectionTimeoutError ||
    error instanceof RateLimitError ||
    error instanceof InternalServerError ||
    status === 408 ||
    status === 429 ||
    (typeof status === "number" && status >= 500) ||
    /network error|connection error|fetch failed|timeout|socket hang up|econnreset/i.test(message)
  );
}

function formatLeaseAnalysisError(error: unknown) {
  const message = error instanceof Error ? error.message : "Lease analysis failed.";

  if (isRetryableLeaseAnalysisError(error)) {
    return `Transient upstream connection error while running lease analysis. ${message}`;
  }

  return message;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
