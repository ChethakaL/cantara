import { NextRequest, NextResponse } from "next/server";
import { runTtmAgent, TtmOrchestratorError } from "@/lib/ttm-agent/orchestrator";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { clientId, triggeredByName } = await req.json();
    if (!clientId) {
      return new Response("clientId is required", { status: 400 });
    }

    const analysis = await runTtmAgent({ clientId, triggeredByName });
    return NextResponse.json(analysis);
  } catch (error) {
    if (error instanceof TtmOrchestratorError) {
      return new Response(error.message, { status: error.statusCode });
    }
    console.error("TTM orchestrate error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
