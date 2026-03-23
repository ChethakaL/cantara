import { NextRequest, NextResponse } from "next/server";
import { runWs2DerivedAgent, TtmOrchestratorError } from "@/lib/ttm-agent/orchestrator";
import { Ws2DerivedAgentId } from "@/lib/ttm-agent/types";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { analysisId, agentId, preparedDocuments } = (await req.json()) as {
      analysisId: string;
      agentId: Ws2DerivedAgentId;
      preparedDocuments?: unknown[];
    };

    if (!analysisId || !agentId) {
      return new Response("analysisId and agentId are required", { status: 400 });
    }

    const updated = await runWs2DerivedAgent({
      analysisId,
      agentId,
      preparedDocuments: Array.isArray(preparedDocuments) ? (preparedDocuments as any) : undefined,
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof TtmOrchestratorError) {
      return new Response(error.message, { status: error.statusCode });
    }
    console.error("WS2 derived route error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
