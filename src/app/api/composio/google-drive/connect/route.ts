import { NextRequest, NextResponse } from "next/server";
import { createGoogleDriveConnectLink } from "@/lib/composio";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get("origin") ?? new URL(req.url).origin;
    const link = await createGoogleDriveConnectLink(`${origin}/admin?drive=connected`);
    return NextResponse.json(link);
  } catch (error) {
    console.error("Google Drive connect link error:", error);
    return new Response("Failed to create Google Drive connect link", { status: 500 });
  }
}
