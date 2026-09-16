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

/** Chat Completions multimodal user parts (text + images + file/PDF attachments). */
type OpenAiUserContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

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
          ...(args.system.trim() ? [{ role: "system" as const, content: args.system }] : []),
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
  let parser: {
    getText: () => Promise<{ text?: string }>;
    destroy: () => Promise<void>;
  } | null = null;
  try {
    parser = new PDFParse({ data: Buffer.from(base64, "base64") });
    const result = await parser.getText();
    return result.text?.trim() ?? "";
  } catch (error) {
    // pdf-parse can throw SyntaxError (e.g. Unterminated string in JSON) on bad PDFs.
    // Never fail the whole agent run — continue with empty extract.
    console.warn("[llm-completion] PDF text extraction failed:", error instanceof Error ? error.message : error);
    return "";
  } finally {
    await parser?.destroy().catch(() => undefined);
  }
}

export function agentMessageBlocksToOpenAiContent(blocks: AgentMessageBlock[]): OpenAiUserContentPart[] {
  const parts: OpenAiUserContentPart[] = [];

  for (const block of blocks) {
    if (block.type === "text") {
      if (block.text.trim()) parts.push({ type: "text", text: block.text });
      continue;
    }

    if (block.type === "image" && block.source?.data) {
      const mediaType = block.source.media_type || "image/jpeg";
      parts.push({
        type: "image_url",
        image_url: { url: `data:${mediaType};base64,${block.source.data}` },
      });
      continue;
    }

    if (block.type === "document" && block.source?.data) {
      const mediaType = (block.source.media_type || "application/pdf").toLowerCase();
      const filename =
        block.title
        || (mediaType === "application/pdf" ? "document.pdf" : "document.txt");

      // OpenAI Chat Completions accepts PDF (and other files) as native `file` parts.
      parts.push({
        type: "file",
        file: {
          filename,
          file_data: `data:${mediaType};base64,${block.source.data}`,
        },
      });
    }
  }

  if (!parts.length) {
    parts.push({ type: "text", text: "(No content provided.)" });
  }

  return parts;
}

export async function agentMessageBlocksToText(blocks: AgentMessageBlock[]): Promise<string> {
  const parts: string[] = [];
  for (const block of blocks) {
    if (block.type === "text") {
      if (block.text.trim()) parts.push(block.text);
      continue;
    }
    if (block.type === "document" && block.source?.data) {
      const title = block.title ? `=== ${block.title} ===` : "=== DOCUMENT ===";
      const mediaType = (block.source.media_type || "application/pdf").toLowerCase();
      if (mediaType === "text/plain" || mediaType.startsWith("text/")) {
        const text = Buffer.from(block.source.data, "base64").toString("utf8").trim();
        parts.push(`${title}\n${text || "[Empty text document]"}`);
        continue;
      }
      const text = await extractPdfBase64Text(block.source.data);
      parts.push(`${title}\n${text || "[No readable text extracted from PDF]"}`);
      continue;
    }
    if (block.type === "image") {
      parts.push("[Image attached]");
    }
  }
  return parts.join("\n\n");
}

function blocksNeedOpenAiMultimodal(blocks: AgentMessageBlock[]): boolean {
  return blocks.some((block) => block.type === "document" || block.type === "image");
}

async function completeOpenAiWithBlocks(args: {
  model: string;
  system: string;
  content: AgentMessageBlock[];
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const client = await requireOpenAiClient();
  const userContent = agentMessageBlocksToOpenAiContent(args.content);
  const completion = await client.chat.completions.create({
    model: args.model,
    ...buildOpenAiChatParams(args.model, {
      maxTokens: args.maxTokens,
      temperature: args.temperature,
    }),
    messages: [
      ...(args.system.trim() ? [{ role: "system" as const, content: args.system }] : []),
      // SDK typings may lag behind Chat Completions `file` parts — cast is intentional.
      { role: "user", content: userContent as any },
    ],
  });
  return completion.choices[0]?.message?.content?.trim() ?? "";
}

async function streamOpenAiWithBlocks(args: {
  model: string;
  system: string;
  content: AgentMessageBlock[];
  maxTokens?: number;
  temperature?: number;
}): Promise<ReadableStream<Uint8Array>> {
  const client = await requireOpenAiClient();
  const encoder = new TextEncoder();
  const userContent = agentMessageBlocksToOpenAiContent(args.content);

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
          ...(args.system.trim() ? [{ role: "system" as const, content: args.system }] : []),
          { role: "user", content: userContent as any },
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

export async function createAgentMessage(args: CreateAgentMessageArgs): Promise<string> {
  const provider = args.provider ?? getActiveAgentProvider();
  const model = args.model ?? getActiveAgentModelId();

  if (provider === "openai" && Array.isArray(args.content) && blocksNeedOpenAiMultimodal(args.content)) {
    return completeOpenAiWithBlocks({
      model,
      system: args.system,
      content: args.content,
      maxTokens: args.maxTokens,
      temperature: args.temperature,
    });
  }

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

  if (provider === "openai" && Array.isArray(args.content) && blocksNeedOpenAiMultimodal(args.content)) {
    return streamOpenAiWithBlocks({
      model,
      system: args.system,
      content: args.content,
      maxTokens: args.maxTokens,
      temperature: args.temperature,
    });
  }

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
