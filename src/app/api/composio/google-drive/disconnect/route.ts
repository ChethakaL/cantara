import { NextResponse } from "next/server";
import { disconnectGoogleDrive } from "@/lib/composio";

export async function POST() {
  try {
    await disconnectGoogleDrive();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Google Drive disconnect error:", error);
    return new Response("Failed to disconnect Google Drive", { status: 500 });
  }
}
