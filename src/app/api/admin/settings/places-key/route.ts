import { NextRequest } from "next/server";
import { getStoredPlacesApiKey, maskSecret, saveStoredPlacesApiKey } from "@/lib/secure-settings";

export async function GET() {
  const apiKey = await getStoredPlacesApiKey().catch(() => null);
  return Response.json({
    configured: Boolean(apiKey),
    maskedKey: maskSecret(apiKey),
    source: "database",
  });
}

export async function POST(req: NextRequest) {
  try {
    const { apiKey } = await req.json();
    const maskedKey = await saveStoredPlacesApiKey(String(apiKey || ""));
    return Response.json({ configured: true, maskedKey, source: "database" });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Failed to save API key", { status: 400 });
  }
}
