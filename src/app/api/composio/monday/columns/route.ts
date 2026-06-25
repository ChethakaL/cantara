import { NextRequest, NextResponse } from "next/server";
import { getMondayBoardColumns } from "@/lib/composio";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const boardId = req.nextUrl.searchParams.get("boardId");
  if (!boardId || boardId === "undefined") {
    return new Response("boardId is required", { status: 400 });
  }

  try {
    const columns = await getMondayBoardColumns(boardId);
    return NextResponse.json({ columns });
  } catch (error) {
    console.error("Monday.com board columns metadata error:", error);
    return new Response("Failed to fetch Monday.com board columns", { status: 500 });
  }
}
