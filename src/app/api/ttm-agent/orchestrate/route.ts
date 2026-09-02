import { NextRequest, NextResponse } from "next/server";
import { runTtmAgent, TtmOrchestratorError } from "@/lib/ttm-agent/orchestrator";
import { parseAnalyzeProvider, resolveAnalyzeModelId } from "@/lib/agent-analyze-provider";
import { assertOpenAiConfiguredForAnalyze } from "@/lib/agent-analyze-provider";
import { runWithAgentLlmContext } from "@/lib/agent-llm-context";
import { resolveAgentModelId } from "@/lib/agent-model-provider.server";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { clientId, triggeredByName, preparedDocuments, provider: rawProvider, modelId: requestedModelId } = await req.json();
    if (!clientId) {
      return new Response("clientId is required", { status: 400 });
    }

    if (!Array.isArray(preparedDocuments) || preparedDocuments.length === 0) {
      return new Response("preparedDocuments is required", { status: 400 });
    }

    const provider = parseAnalyzeProvider(rawProvider);
    if (provider === "openai") {
      const gate = await assertOpenAiConfiguredForAnalyze();
      if (gate) return gate;
    }
    const modelId = resolveAnalyzeModelId(
      provider,
      requestedModelId || resolveAgentModelId(provider, "opus"),
    );

    const analysis = await runWithAgentLlmContext({ provider, modelId }, () =>
      runTtmAgent({ clientId, triggeredByName, preparedDocuments, aiProvider: provider, aiModel: modelId }),
    );
    return NextResponse.json(analysis);
  } catch (error) {
    if (error instanceof TtmOrchestratorError) {
      return new Response(error.message, { status: error.statusCode });
    }
    console.error("TTM orchestrate error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
