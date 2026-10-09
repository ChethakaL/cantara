import { NextRequest } from "next/server";
import {
  getStoredDataForSeoCredentials,
  maskSecret,
  saveStoredDataForSeoCredentials,
} from "@/lib/secure-settings";

export async function GET() {
  const credentials = await getStoredDataForSeoCredentials().catch(() => null);
  return Response.json({
    configured: Boolean(credentials?.login && credentials?.password),
    maskedLogin: credentials ? maskSecret(credentials.login) : null,
    maskedApiKey: credentials ? maskSecret(credentials.password) : null,
    source: "database",
  });
}

export async function POST(req: NextRequest) {
  try {
    const { login, apiKey } = await req.json();
    const masked = await saveStoredDataForSeoCredentials({ login: String(login || ""), password: String(apiKey || "") });
    return Response.json({ configured: true, ...masked, source: "database" });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Failed to save DataForSEO credentials", { status: 400 });
  }
}
