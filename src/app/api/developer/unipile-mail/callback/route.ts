import { NextRequest, NextResponse } from "next/server";
import { saveStoredComposioMailConnectedAccountId } from "@/lib/secure-settings";

async function handleCallback(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const accountId =
    typeof payload.connected_account_id === "string"
      ? payload.connected_account_id
      : typeof payload.account_id === "string"
        ? payload.account_id
        : typeof payload.id === "string"
          ? payload.id
          : "";
  const status = typeof payload.status === "string" ? payload.status : "";

  if (!accountId || (status && !["ACTIVE", "CREATION_SUCCESS", "RECONNECTED"].includes(status))) {
    return new Response("Ignored", { status: 202 });
  }

  await saveStoredComposioMailConnectedAccountId(accountId);
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  try {
    return await handleCallback(req);
  } catch (error) {
    console.error("COMPOSIO_MAIL_CALLBACK_ERROR", error);
    return new Response("Callback failed", { status: 500 });
  }
}
