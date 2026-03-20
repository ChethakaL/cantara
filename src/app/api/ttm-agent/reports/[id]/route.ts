import { NextRequest, NextResponse } from "next/server";
import { getTtmAnalysis } from "@/lib/ttm-agent/orchestrator";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const analysis = await getTtmAnalysis(params.id);
    if (!analysis) {
      return new Response("Not Found", { status: 404 });
    }
    return NextResponse.json(analysis);
  } catch (error) {
    console.error("TTM report detail error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
