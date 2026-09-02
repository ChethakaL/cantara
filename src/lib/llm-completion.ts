import { requireAIClient, resolveModel } from "@/lib/ai-client";
import type { AgentAiProvider } from "@/lib/agent-model-provider";
import { buildOpenAiChatParams, requireOpenAiClient } from "@/lib/openai-client";
import { getActiveAgentModelId, getActiveAgentProvider } from "@/lib/agent-llm-context";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse") as {
  PDFParse: new (args: { data: Buffer }) => {
    getText: () => Promise<{ text?: string }>;
    destroy: () => Promise<void>;
  };
};

export type AgentMessageBlock =
  | { type: "text"; text: string }
  | { type: "document"; title?: string; source?: { type?: string; media_type?: string; data?: string } }
  | { type: "image"; source?: { media_type?: string; data?: string } };

type StreamTextArgs = {
  provider: AgentAiProvider;
  model: string;
  system: string;
  userText: string;
  maxTokens?: number;
  temperature?: number;
};

type CreateAgentMessageArgs = {
  provider?: AgentAiProvider;
  model?: string;
  system: string;
  content: AgentMessageBlock[] | string;
  maxTokens?: number;
  temperature?: number;
};

export function createTextStreamResponse(stream: ReadableStream<Uint8Array>) {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function streamTextCompletion(args: StreamTextArgs): Promise<ReadableStream<Uint8Array>> {
  if (args.provider === "openai") {
    return streamOpenAiText(args);
  }
  return streamBedrockText(args);
}

async function streamBedrockText(args: StreamTextArgs): Promise<ReadableStream<Uint8Array>> {
  const client = await requireAIClient();
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const stream = await client.messages.stream({
        model: resolveModel(args.model),
        max_tokens: args.maxTokens ?? 16000,
        temperature: args.temperature ?? 0,
        system: args.system,
        messages: [{ role: "user", content: args.userText }],
      });

      for await (const chunk of stream) {
        if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });
}

async function streamOpenAiText(args: StreamTextArgs): Promise<ReadableStream<Uint8Array>> {
  const client = await requireOpenAiClient();
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const stream = await client.chat.completions.create({
        model: args.model,
        ...buildOpenAiChatParams(args.model, {
          maxTokens: args.maxTokens,
          temperature: args.temperature,
        }),
        stream: true,
        messages: [
          { role: "system", content: args.system },
          { role: "user", content: args.userText },
        ],
      });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content;
        if (text) controller.enqueue(encoder.encode(text));
      }
      controller.close();
    },
  });
}

export async function completeText(args: StreamTextArgs): Promise<string> {
  const stream = await streamTextCompletion(args);
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return text;
}

async function extractPdfBase64Text(base64: string): Promise<string> {
  const parser = new PDFParse({ data: Buffer.from(base64, "base64") });
  try {
    const result = await parser.getText();
    return result.text?.trim() ?? "";
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

export async function agentMessageBlocksToText(blocks: AgentMessageBlock[]): Promise<string> {
  const parts: string[] = [];
  for (const block of blocks) {
    if (block.type === "text") {
      if (block.text.trim()) parts.push(block.text);
      continue;
    }
    if (block.type === "document" && block.source?.data) {
      const title = block.title ? `=== ${block.title} ===` : "=== PDF DOCUMENT ===";
      const text = await extractPdfBase64Text(block.source.data);
      parts.push(`${title}\n${text || "[No readable text extracted from PDF]"}`);
      continue;
    }
    if (block.type === "image") {
      parts.push("[Image attached — use Claude (Bedrock) for visual document analysis.]");
    }
  }
  return parts.join("\n\n");
}

export async function createAgentMessage(args: CreateAgentMessageArgs): Promise<string> {
  const provider = args.provider ?? getActiveAgentProvider();
  const model = args.model ?? getActiveAgentModelId();
  const userText =
    typeof args.content === "string" ? args.content : await agentMessageBlocksToText(args.content);

  return completeText({
    provider,
    model,
    system: args.system,
    userText,
    maxTokens: args.maxTokens,
    temperature: args.temperature,
  });
}

export async function streamAgentMessage(args: CreateAgentMessageArgs): Promise<ReadableStream<Uint8Array>> {
  const provider = args.provider ?? getActiveAgentProvider();
  const model = args.model ?? getActiveAgentModelId();
  const userText =
    typeof args.content === "string" ? args.content : await agentMessageBlocksToText(args.content);

  return streamTextCompletion({
    provider,
    model,
    system: args.system,
    userText,
    maxTokens: args.maxTokens,
    temperature: args.temperature,
  });
}
