import { NextRequest, NextResponse } from "next/server";
import { actionTtmFlag, approveTtmAnalysis, saveNormOverrides, TtmOrchestratorError } from "@/lib/ttm-agent/orchestrator";
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
        payloadPatch?: Record<string, unknown>;
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
        payloadPatch: typeof body.payloadPatch === "object" && body.payloadPatch ? body.payloadPatch : undefined,
      });
      return NextResponse.json(updated);
    }

    if (body.mode === "approve") {
      const { analysisId, actorName, userOverrides } = body as {
        analysisId: string;
        actorName?: string;
        userOverrides?: Record<string, number>;
      };
      if (!analysisId) {
        return new Response("analysisId is required", { status: 400 });
      }

      const updated = await approveTtmAnalysis({ analysisId, actorName, userOverrides });
      return NextResponse.json(updated);
    }

    if (body.mode === "save-overrides") {
      const { analysisId, userOverrides } = body as {
        analysisId: string;
        userOverrides?: Record<string, number>;
      };
      if (!analysisId) {
        return new Response("analysisId is required", { status: 400 });
      }
      if (userOverrides && Object.keys(userOverrides).length > 0) {
        await saveNormOverrides({ analysisId, userOverrides });
      }
      return NextResponse.json({ ok: true });
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
