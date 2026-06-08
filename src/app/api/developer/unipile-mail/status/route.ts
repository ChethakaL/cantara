import { NextRequest, NextResponse } from "next/server";
import { requireDeveloperSecret } from "@/lib/developer-auth";
import {
  clearStoredComposioMailConnectedAccountId,
  getStoredComposioMailConnectedAccountId,
  hasStoredComposioMailConnectedAccountId,
  maskSecret,
  saveStoredComposioMailConnectedAccountId,
} from "@/lib/secure-settings";
import {
  disconnectComposioMail,
  extractComposioMailEmail,
  getComposioMailConnection,
  getComposioMailProfile,
  isComposioMailConfigured,
  pingComposioApi,
} from "@/lib/composio";

export async function GET(req: NextRequest) {
  const auth = requireDeveloperSecret(req.headers.get("x-developer-secret"));
  if (!auth.ok) return new Response(auth.message, { status: auth.status });

  const storedRowExists = await hasStoredComposioMailConnectedAccountId().catch(() => false);
  const stored = await getStoredComposioMailConnectedAccountId().catch(() => null);
  const accountId = stored;
  let connectedEmail: string | null = null;
  let accountStatus: string | null = null;
  let accountError: string | null = null;
  let connection: Awaited<ReturnType<typeof getComposioMailConnection>> | null = null;
  if (isComposioMailConfigured()) {
    try {
      connection = await getComposioMailConnection(accountId);
      accountStatus = connection?.status ?? null;
      connectedEmail = extractComposioMailEmail(connection);
      if (connection?.status === "ACTIVE" && !connectedEmail) {
        connectedEmail = extractComposioMailEmail(await getComposioMailProfile().catch(() => null));
      }
    } catch (error) {
      accountError = error instanceof Error ? error.message : "Account lookup failed";
    }
  }
  const apiPing = await pingComposioApi();
  const active = Boolean(connection?.status === "ACTIVE" && !connection.is_disabled);

  return NextResponse.json({
    configured: active,
    accountId: maskSecret(connection?.id ?? accountId),
    connectedEmail,
    accountStatus,
    apiPing,
    accountError:
      accountError ||
      (storedRowExists && !accountId
        ? "Mailbox was connected but the Composio connected account id is missing. Click Change Sender to reconnect."
        : connection && !active
          ? `Composio connection is ${connection.status || "not active"}${connection.status_reason ? `: ${connection.status_reason}` : ""}.`
          : null),
    source: stored ? "database" : connection?.id ? "composio" : null,
    usingEnvFallback: false,
    apiConfigured: isComposioMailConfigured(),
  });
}

export async function POST(req: NextRequest) {
  const auth = requireDeveloperSecret(req.headers.get("x-developer-secret"));
  if (!auth.ok) return new Response(auth.message, { status: auth.status });

  try {
    const { accountId } = await req.json();
    const masked = await saveStoredComposioMailConnectedAccountId(String(accountId || ""));
    return NextResponse.json({ configured: true, accountId: masked, source: "database" });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Failed to save Composio connected account id", { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = requireDeveloperSecret(req.headers.get("x-developer-secret"));
  if (!auth.ok) return new Response(auth.message, { status: auth.status });

  await disconnectComposioMail().catch((error) => console.warn("[composio-mail] disconnect failed", error));
  await clearStoredComposioMailConnectedAccountId();
  return NextResponse.json({
    configured: false,
    accountId: null,
    source: null,
    apiConfigured: isComposioMailConfigured(),
  });
}
