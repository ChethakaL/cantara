import { NextRequest, NextResponse } from "next/server";
import { requireDeveloperSecret } from "@/lib/developer-auth";
import { createUnipileHostedAuthLink } from "@/lib/unipile";

function formatConnectionError(error: unknown) {
  if (!(error instanceof Error)) return "Failed to create Unipile connection link";
  try {
    const parsed = JSON.parse(error.message) as { title?: string; detail?: string };
    if (parsed.title) return parsed.title;
    if (parsed.detail) return parsed.detail.split("\n")[0] || parsed.detail;
  } catch {}
  return error.message;
}

export async function POST(req: NextRequest) {
  const auth = requireDeveloperSecret(req.headers.get("x-developer-secret"));
  if (!auth.ok) return new Response(auth.message, { status: auth.status });

  try {
    const origin = new URL(req.url).origin;
    const url = await createUnipileHostedAuthLink({
      successRedirectUrl: `${origin}/developer/mail-settings?unipile=connected`,
      failureRedirectUrl: `${origin}/developer/mail-settings?unipile=failed`,
      notifyUrl: `${origin}/api/developer/unipile-mail/callback`,
    });
    return NextResponse.json(url);
  } catch (error) {
    return new Response(formatConnectionError(error), { status: 400 });
  }
}
