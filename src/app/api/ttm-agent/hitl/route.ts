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

    if (body.mode === "create-and-resolve") {
      const { analysisId, section, severity, title, description, payload, resolutionAction, resolutionNotes, actorName } = body as {
        analysisId: string;
        section: string;
        severity: string;
        title: string;
        description: string;
        payload?: Record<string, unknown>;
        resolutionAction: FlagResolutionAction;
        resolutionNotes?: string;
        actorName?: string;
      };
      if (!analysisId || !title || !resolutionAction) {
        return new Response("analysisId, title, and resolutionAction are required", { status: 400 });
      }

      // Create the flag and resolve it in one step
      const { prisma } = await import("@/lib/prisma");
      const flag = await (prisma as any).ttmFlag.create({
        data: {
          analysisId,
          section: section || "A",
          severity: severity || "MEDIUM",
          title,
          description: description || "",
          payload: payload || {},
          resolutionStatus: "ACTIONED",
          resolutionAction,
          resolutionNotes: resolutionNotes || "",
          resolvedByName: actorName || "Admin",
          resolvedAt: new Date(),
        },
      });

      // Return the updated analysis
      const { getTtmAnalysis } = await import("@/lib/ttm-agent/orchestrator");
      const updated = await getTtmAnalysis(analysisId);
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
