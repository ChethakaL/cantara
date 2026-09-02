import { NextRequest } from "next/server";
import { getOpenAiApiKey, getStoredOpenAiApiKey, maskSecret, saveStoredOpenAiApiKey } from "@/lib/secure-settings";

export async function GET() {
  const apiKey = await getOpenAiApiKey();
  const stored = await getStoredOpenAiApiKey().catch(() => null);
  return Response.json({
    configured: Boolean(apiKey),
    maskedKey: maskSecret(apiKey),
    source: stored ? "database" : "env",
  });
}

export async function POST(req: NextRequest) {
  try {
    const { apiKey } = await req.json();
    const maskedKey = await saveStoredOpenAiApiKey(String(apiKey || ""));
    return Response.json({ configured: true, maskedKey, source: "database" });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Failed to save API key", { status: 400 });
  }
}
