import { NextRequest } from "next/server";
import { CONTRACT_ANALYSIS_SYSTEM_PROMPT } from "@/lib/contract-analysis/prompt";
import { requireAIClient, resolveModel } from "@/lib/ai-client";
import { parseAgentAiProvider } from "@/lib/agent-model-provider";
import { resolveAgentModelId } from "@/lib/agent-model-provider.server";
import { completeText } from "@/lib/llm-completion";
import { hasOpenAiConfigured } from "@/lib/openai-client";
import { createRequire } from "module";

export const maxDuration = 300;

const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse") as {
  PDFParse: new (args: { data: Buffer }) => {
    getText: () => Promise<{ text?: string; total?: number }>;
    destroy: () => Promise<void>;
  };
};

async function extractPdfText(base64: string) {
  const parser = new PDFParse({ data: Buffer.from(base64, "base64") });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { documents, provider: rawProvider, modelId: requestedModelId } = body;
    const provider = parseAgentAiProvider(rawProvider);
    const modelId = String(requestedModelId || resolveAgentModelId(provider));

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return new Response("No documents provided", { status: 400 });
    }

    if (provider === "openai" && !(await hasOpenAiConfigured())) {
      return new Response("OpenAI API key is not configured. Add it in Admin Settings.", { status: 400 });
    }

    if (provider === "openai") {
      const sections = await Promise.all(
        documents.map(async (doc: { name: string; base64: string }) => {
          const text = await extractPdfText(doc.base64);
          return `=== DOCUMENT: ${doc.name} ===\n${text}\n=== END DOCUMENT ===`;
        }),
      );
      const userText = `${sections.join("\n\n")}\n\nPlease analyze the ${documents.length} contract document(s) above. Document names: ${documents.map((doc: { name: string }) => doc.name).join(", ")}`;
      const text = await completeText({
        provider,
        model: modelId,
        system: CONTRACT_ANALYSIS_SYSTEM_PROMPT,
        userText,
        maxTokens: 8000,
      });
      return new Response(text, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const client = await requireAIClient();
    const userContent = [
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

    return new Response(text, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
