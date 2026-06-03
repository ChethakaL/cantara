import { NextRequest, NextResponse } from "next/server";
import { requireDeveloperSecret } from "@/lib/developer-auth";
import { createUnipileHostedAuthLink, pingUnipileApi } from "@/lib/unipile";

function formatConnectionError(error: unknown) {
  if (!(error instanceof Error)) return "Failed to create Unipile connection link";
  const raw = error.message;
  if (raw.includes("502 Bad Gateway") || raw.includes("<html")) {
    return "Unipile API is returning 502 Bad Gateway for your DSN. The mail server cannot connect or send until Unipile fixes your instance — check status.unipile.com and your dashboard DSN (api host + port).";
  }
  try {
    const parsed = JSON.parse(raw) as { title?: string; detail?: string };
    if (parsed.detail) return parsed.detail.split("\n")[0] || parsed.detail;
    if (parsed.title) return parsed.title;
  } catch {
    /* not JSON */
  }
  if (raw.length > 400) return raw.slice(0, 400);
  return raw;
}

function connectionErrorStatus(error: unknown) {
  const status = (error as { status?: number })?.status;
  if (status === 502 || status === 503 || status === 504) return status;
  return 400;
}

export async function POST(req: NextRequest) {
  const auth = requireDeveloperSecret(req.headers.get("x-developer-secret"));
  if (!auth.ok) return new Response(auth.message, { status: auth.status });

  try {
    const ping = await pingUnipileApi();
    if (!ping.ok) {
      return NextResponse.json(
        { ok: false, error: ping.message, apiUrl: ping.apiUrl, status: ping.status },
        { status: ping.status && ping.status >= 400 ? ping.status : 503 },
      );
    }

    const origin = new URL(req.url).origin;
    const url = await createUnipileHostedAuthLink({
      successRedirectUrl: `${origin}/developer/mail-settings?unipile=connected`,
      failureRedirectUrl: `${origin}/developer/mail-settings?unipile=failed`,
      notifyUrl: `${origin}/api/developer/unipile-mail/callback`,
    });
    return NextResponse.json(url);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: formatConnectionError(error) },
      { status: connectionErrorStatus(error) },
    );
  }
}
