import { NextRequest, NextResponse } from "next/server";
import { listTtmAnalyses } from "@/lib/ttm-agent/orchestrator";

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) {
    return new Response("clientId is required", { status: 400 });
  }

  try {
    const analyses = await listTtmAnalyses(clientId);
    return NextResponse.json(analyses);
  } catch (error) {
    console.error("TTM reports error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
