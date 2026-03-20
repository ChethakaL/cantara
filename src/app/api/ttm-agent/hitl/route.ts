import { NextRequest, NextResponse } from "next/server";
import { actionTtmFlag, approveTtmAnalysis, TtmOrchestratorError } from "@/lib/ttm-agent/orchestrator";
import { FlagResolutionAction } from "@/lib/ttm-agent/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.mode === "flag") {
      const { analysisId, flagId, resolutionAction, resolutionNotes, actorName } = body as {
        analysisId: string;
        flagId: string;
        resolutionAction: FlagResolutionAction;
        resolutionNotes?: string;
        actorName?: string;
      };

      if (!analysisId || !flagId || !resolutionAction) {
        return new Response("analysisId, flagId, and resolutionAction are required", { status: 400 });
      }

      const updated = await actionTtmFlag({
        analysisId,
        flagId,
        action: resolutionAction,
        notes: resolutionNotes,
        actorName,
      });
      return NextResponse.json(updated);
    }

    if (body.mode === "approve") {
      const { analysisId, actorName } = body as { analysisId: string; actorName?: string };
      if (!analysisId) {
        return new Response("analysisId is required", { status: 400 });
      }

      const updated = await approveTtmAnalysis({ analysisId, actorName });
      return NextResponse.json(updated);
    }

    return new Response("Unsupported HITL action", { status: 400 });
  } catch (error) {
    if (error instanceof TtmOrchestratorError) {
      return new Response(error.message, { status: error.statusCode });
    }
    console.error("TTM HITL error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
