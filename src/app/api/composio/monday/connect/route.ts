import { NextRequest, NextResponse } from "next/server";
import { createMondayConnectLink } from "@/lib/composio";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get("origin") ?? new URL(req.url).origin;
    const link = await createMondayConnectLink(`${origin}/admin?monday=connected`);
    return NextResponse.json(link);
  } catch (error) {
    console.error("Monday.com connect link error:", error);
    return new Response("Failed to create Monday.com connect link", { status: 500 });
  }
}
