import { getProjectEnv } from "@/lib/project-env";
import { getStoredUnipileMailAccountId } from "@/lib/secure-settings";

function getUnipileBaseUrl() {
  const dsn = getProjectEnv("UNIPILE_DSN");
  if (!dsn) throw new Error("UNIPILE_DSN is not configured.");
  return dsn.startsWith("http") ? dsn.replace(/\/$/, "") : `https://${dsn.replace(/\/$/, "")}`;
}

function getUnipileAccessToken() {
  return getProjectEnv("UNIPILE_ACCESS_TOKEN") || getProjectEnv("UNIPILE_API_KEY");
}

export function isUnipileMailConfigured() {
  return Boolean(
    getProjectEnv("UNIPILE_DSN") &&
      getUnipileAccessToken() &&
      getProjectEnv("UNIPILE_ACCOUNT_ID"),
  );
}

export async function isUnipileMailConfiguredAsync() {
  const storedAccountId = await getStoredUnipileMailAccountId().catch(() => null);
  return Boolean(
    getProjectEnv("UNIPILE_DSN") &&
      getUnipileAccessToken() &&
      (storedAccountId || getProjectEnv("UNIPILE_ACCOUNT_ID")),
  );
}

export async function getUnipileAccount(accountId: string) {
  const accessToken = getUnipileAccessToken();
  if (!accessToken) throw new Error("UNIPILE_ACCESS_TOKEN is not configured.");

  const response = await fetch(`${getUnipileBaseUrl()}/api/v1/accounts/${accountId}`, {
    headers: {
      "X-API-KEY": accessToken,
      accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Unipile account lookup failed (${response.status}).`);
  }

  return text ? JSON.parse(text) as Record<string, unknown> : {};
}

function formatUnipileError(status: number, text: string) {
  try {
    const parsed = JSON.parse(text) as { title?: string; detail?: string; type?: string };
    if (parsed.detail) {
      return `Unipile ${status}: ${parsed.detail}${parsed.type ? ` (${parsed.type})` : ""}`;
    }
  } catch {
    /* not JSON — often nginx HTML */
  }
  if (status === 502) {
    return "Unipile 502: Mail proxy error — disconnect and reconnect the sender in Developer Mail Settings, then try again.";
  }
  const trimmed = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return trimmed.slice(0, 280) || `Unipile email send failed (${status}).`;
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function sendEmailWithUnipile(args: {
  to: string;
  displayName?: string;
  subject: string;
  body: string;
}) {
  const accessToken = getUnipileAccessToken();
  const accountId = (await getStoredUnipileMailAccountId().catch(() => null)) || getProjectEnv("UNIPILE_ACCOUNT_ID");

  if (!accessToken || !accountId) {
    throw new Error("Unipile mail is not configured.");
  }

  const form = new FormData();
  form.set("account_id", accountId);
  form.set("subject", args.subject);
  form.set("body", args.body);
  form.set(
    "to",
    JSON.stringify([
      {
        display_name: args.displayName || args.to,
        identifier: args.to,
      },
    ]),
  );

  const url = `${getUnipileBaseUrl()}/api/v1/emails`;
  const retryableStatuses = new Set([502, 503, 504]);
  let lastError = "Unipile email send failed.";

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-API-KEY": accessToken,
      },
      body: form,
      cache: "no-store",
    });

    const text = await response.text();
    if (response.ok) {
      return text ? JSON.parse(text) : null;
    }

    lastError = formatUnipileError(response.status, text);
    if (!retryableStatuses.has(response.status) || attempt === 3) {
      throw new Error(lastError);
    }
    await wait(attempt * 2000);
  }

  throw new Error(lastError);
}

export async function createUnipileHostedAuthLink(args: {
  successRedirectUrl: string;
  failureRedirectUrl: string;
  notifyUrl: string;
}) {
  const accessToken = getUnipileAccessToken();
  if (!accessToken) throw new Error("UNIPILE_ACCESS_TOKEN is not configured.");

  const apiUrl = getUnipileBaseUrl();
  const response = await fetch(`${apiUrl}/api/v1/hosted/accounts/link`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": accessToken,
      accept: "application/json",
    },
    body: JSON.stringify({
      type: "create",
      providers: ["GOOGLE", "OUTLOOK", "MAIL"],
      api_url: apiUrl,
      expiresOn: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      success_redirect_url: args.successRedirectUrl,
      failure_redirect_url: args.failureRedirectUrl,
      notify_url: args.notifyUrl,
      name: "cantara_system_mailbox",
    }),
    cache: "no-store",
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Unipile hosted auth link failed (${response.status}).`);
  }

  return text ? JSON.parse(text) as { url?: string } : {};
}
