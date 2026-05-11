import { NextRequest, NextResponse } from "next/server";
import { getMondayBoardItems } from "@/lib/composio";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const boardId = req.nextUrl.searchParams.get("boardId");
  if (!boardId || boardId === "undefined") return new Response("boardId is required", { status: 400 });

  try {
    const items = await getMondayBoardItems(boardId);
    console.log(`[API] Returning ${items.length} items to frontend. First item keys:`, Object.keys(items[0] || {}));
    console.log(`[API] First item data:`, JSON.stringify(items[0] || {}));
    return NextResponse.json({ items });
  } catch (error) {
    console.error("Monday.com board items error:", error);
    return new Response("Failed to fetch Monday.com board items", { status: 500 });
  }
}
