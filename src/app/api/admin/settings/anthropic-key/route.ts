import { NextRequest, NextResponse } from "next/server";
import { getAnthropicApiKey, getStoredAnthropicApiKey, maskSecret, saveStoredAnthropicApiKey } from "@/lib/secure-settings";

export async function GET() {
  const apiKey = await getAnthropicApiKey();
  const stored = await getStoredAnthropicApiKey().catch(() => null);
  return NextResponse.json({
    configured: Boolean(apiKey),
    maskedKey: maskSecret(apiKey),
    source: stored ? "database" : "env",
  });
}

export async function POST(req: NextRequest) {
  try {
    const { apiKey } = await req.json();
    const maskedKey = await saveStoredAnthropicApiKey(String(apiKey || ""));
    return NextResponse.json({ configured: true, maskedKey, source: "database" });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Failed to save API key", { status: 400 });
  }
}
