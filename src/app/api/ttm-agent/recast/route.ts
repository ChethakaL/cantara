import { NextRequest, NextResponse } from "next/server";
import {
  actionWs2RecastFlag,
  approveWs2RecastAnalysis,
  runWs2RecastAnalysis,
  TtmOrchestratorError,
} from "@/lib/ttm-agent/orchestrator";
import { FlagResolutionAction, Ws2RecastAssumptions } from "@/lib/ttm-agent/types";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.mode === "run") {
      const { analysisId, assumptions, preparedDocuments } = body as {
        analysisId: string;
        assumptions: Ws2RecastAssumptions;
        preparedDocuments: unknown[];
      };

      if (!analysisId) {
        return new Response("analysisId is required", { status: 400 });
      }
      if (!Array.isArray(preparedDocuments)) {
        return new Response("preparedDocuments must be an array", { status: 400 });
      }

      const updated = await runWs2RecastAnalysis({
        analysisId,
        assumptions,
        preparedDocuments: preparedDocuments as any,
      });
      return NextResponse.json(updated);
    }

    if (body.mode === "flag") {
      const { recastAnalysisId, flagId, resolutionAction, resolutionNotes, actorName, overrideAmount, payloadPatch } = body as {
        recastAnalysisId: string;
        flagId: string;
        resolutionAction: FlagResolutionAction;
        resolutionNotes?: string;
        actorName?: string;
        overrideAmount?: number | null;
        payloadPatch?: Record<string, unknown>;
      };

      if (!recastAnalysisId || !flagId || !resolutionAction) {
        return new Response("recastAnalysisId, flagId, and resolutionAction are required", { status: 400 });
      }

      const updated = await actionWs2RecastFlag({
        recastAnalysisId,
        flagId,
        action: resolutionAction,
        notes: resolutionNotes,
        actorName,
        overrideAmount,
        payloadPatch,
      });
      return NextResponse.json(updated);
    }

    if (body.mode === "approve") {
      const { recastAnalysisId, actorName } = body as { recastAnalysisId: string; actorName?: string };
      if (!recastAnalysisId) {
        return new Response("recastAnalysisId is required", { status: 400 });
      }

      const updated = await approveWs2RecastAnalysis({ recastAnalysisId, actorName });
      return NextResponse.json(updated);
    }

    return new Response("Unsupported WS2-2 action", { status: 400 });
  } catch (error) {
    if (error instanceof TtmOrchestratorError) {
      return new Response(error.message, { status: error.statusCode });
    }
    console.error("WS2-2 route error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
