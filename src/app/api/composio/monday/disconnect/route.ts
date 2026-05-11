import { NextResponse } from "next/server";
import { disconnectMonday } from "@/lib/composio";

export async function POST() {
  try {
    await disconnectMonday();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Monday disconnect error:", error);
    return new Response("Failed to disconnect Monday.com", { status: 500 });
  }
}
