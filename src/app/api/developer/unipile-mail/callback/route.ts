import { NextRequest, NextResponse } from "next/server";
import { saveStoredUnipileMailAccountId } from "@/lib/secure-settings";

async function handleCallback(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const accountId = typeof payload.account_id === "string" ? payload.account_id : "";
  const status = typeof payload.status === "string" ? payload.status : "";
  const name = typeof payload.name === "string" ? payload.name : "";

  if (!accountId || !["CREATION_SUCCESS", "RECONNECTED"].includes(status) || name !== "cantara_system_mailbox") {
    return new Response("Ignored", { status: 202 });
  }

  await saveStoredUnipileMailAccountId(accountId);
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  try {
    return await handleCallback(req);
  } catch (error) {
    console.error("UNIPILE_MAIL_CALLBACK_ERROR", error);
    return new Response("Callback failed", { status: 500 });
  }
}
