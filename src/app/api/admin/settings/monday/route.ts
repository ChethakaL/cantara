import { NextRequest, NextResponse } from "next/server";
import { getStoredMondayBoardId, saveStoredMondayBoardId, getStoredMondayColumnMapping, saveStoredMondayColumnMapping } from "@/lib/secure-settings";
import { normalizeMondayColumnMapping } from "@/lib/monday-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const boardId = await getStoredMondayBoardId();
    const columnMapping = normalizeMondayColumnMapping(await getStoredMondayColumnMapping());
    return NextResponse.json({ boardId, columnMapping });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Failed to load Monday settings", { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { boardId, columnMapping } = await req.json();
    if (boardId !== undefined) {
      await saveStoredMondayBoardId(String(boardId || ""));
    }
    if (columnMapping !== undefined) {
      await saveStoredMondayColumnMapping(normalizeMondayColumnMapping(columnMapping));
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Failed to save Monday settings", { status: 500 });
  }
}
