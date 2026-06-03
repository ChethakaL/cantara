import { NextRequest, NextResponse } from "next/server";
import { requireDeveloperSecret } from "@/lib/developer-auth";
import { getProjectEnv } from "@/lib/project-env";
import {
  clearStoredUnipileMailAccountId,
  getStoredUnipileMailAccountId,
  maskSecret,
  saveStoredUnipileMailAccountId,
} from "@/lib/secure-settings";
import { getUnipileAccount } from "@/lib/unipile";

function extractAccountEmail(account: Record<string, unknown> | null) {
  if (!account) return null;
  for (const key of ["email", "username", "identifier", "name"]) {
    const value = account[key];
    if (typeof value === "string" && value.includes("@")) return value;
  }
  const connection = account.connection_params;
  if (connection && typeof connection === "object") {
    const value = (connection as Record<string, unknown>).email || (connection as Record<string, unknown>).username;
    if (typeof value === "string" && value.includes("@")) return value;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const auth = requireDeveloperSecret(req.headers.get("x-developer-secret"));
  if (!auth.ok) return new Response(auth.message, { status: auth.status });

  const stored = await getStoredUnipileMailAccountId().catch(() => null);
  const envAccountId = getProjectEnv("UNIPILE_ACCOUNT_ID") || null;
  const accountId = stored || envAccountId;
  let connectedEmail: string | null = null;
  let accountStatus: string | null = null;
  const hasAccessToken = Boolean(getProjectEnv("UNIPILE_ACCESS_TOKEN") || getProjectEnv("UNIPILE_API_KEY"));
  let accountError: string | null = null;
  if (accountId && hasAccessToken && getProjectEnv("UNIPILE_DSN")) {
    try {
      const account = await getUnipileAccount(accountId);
      connectedEmail = extractAccountEmail(account);
      accountStatus =
        typeof account?.status === "string"
          ? account.status
          : typeof account?.state === "string"
            ? account.state
            : null;
    } catch (error) {
      accountError = error instanceof Error ? error.message : "Account lookup failed";
    }
  }
  return NextResponse.json({
    configured: Boolean(accountId),
    accountId: maskSecret(accountId),
    connectedEmail,
    accountStatus,
    accountError,
    source: stored ? "database" : envAccountId ? "env" : null,
    apiConfigured: Boolean(getProjectEnv("UNIPILE_DSN") && hasAccessToken),
  });
}

export async function POST(req: NextRequest) {
  const auth = requireDeveloperSecret(req.headers.get("x-developer-secret"));
  if (!auth.ok) return new Response(auth.message, { status: auth.status });

  try {
    const { accountId } = await req.json();
    const masked = await saveStoredUnipileMailAccountId(String(accountId || ""));
    return NextResponse.json({ configured: true, accountId: masked, source: "database" });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Failed to save Unipile account id", { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = requireDeveloperSecret(req.headers.get("x-developer-secret"));
  if (!auth.ok) return new Response(auth.message, { status: auth.status });

  await clearStoredUnipileMailAccountId();
  return NextResponse.json({
    configured: Boolean(getProjectEnv("UNIPILE_ACCOUNT_ID")),
    accountId: maskSecret(getProjectEnv("UNIPILE_ACCOUNT_ID") || null),
    source: getProjectEnv("UNIPILE_ACCOUNT_ID") ? "env" : null,
    apiConfigured: Boolean(getProjectEnv("UNIPILE_DSN") && (getProjectEnv("UNIPILE_ACCESS_TOKEN") || getProjectEnv("UNIPILE_API_KEY"))),
  });
}
