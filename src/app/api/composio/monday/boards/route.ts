import { NextResponse } from "next/server";
import { getMondayBoards } from "@/lib/composio";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const boards = await getMondayBoards();
    return NextResponse.json({ boards });
  } catch (error) {
    console.error("Monday.com boards error:", error);
    return new Response("Failed to fetch Monday.com boards", { status: 500 });
  }
}
