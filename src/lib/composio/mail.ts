import { getProjectEnv } from "@/lib/project-env";
import {
  getStoredComposioMailConnectedAccountId,
  hasStoredComposioMailConnectedAccountId,
} from "@/lib/secure-settings";
import {
  composioFetch,
  tryComposioFetch,
  COMPOSIO_MAIL_USER_ID,
  DEFAULT_MAIL_TOOLKIT_SLUG,
  ComposioAuthConfigListItem,
  ComposioConnectedAccount,
} from "./client";

export function getComposioMailToolkitSlug() {
  const toolkit = (getProjectEnv("COMPOSIO_MAIL_TOOLKIT") || DEFAULT_MAIL_TOOLKIT_SLUG).toUpperCase();
  if (toolkit === "OUTLOOK" || toolkit === "GMAIL") return toolkit;
  throw new Error("COMPOSIO_MAIL_TOOLKIT must be GMAIL or OUTLOOK.");
}

export function getComposioMailToolSlug(toolkit = getComposioMailToolkitSlug()) {
  return toolkit === "OUTLOOK" ? "OUTLOOK_SEND_EMAIL" : "GMAIL_SEND_EMAIL";
}

export function getComposioMailProfileToolSlug(toolkit = getComposioMailToolkitSlug()) {
  return toolkit === "OUTLOOK" ? "OUTLOOK_GET_PROFILE" : "GMAIL_GET_PROFILE";
}

export function getComposioMailAuthConfigEnvKey(toolkit = getComposioMailToolkitSlug()) {
  return toolkit === "OUTLOOK" ? "COMPOSIO_OUTLOOK_AUTH_CONFIG_ID" : "COMPOSIO_GMAIL_AUTH_CONFIG_ID";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatEmailBody(body: string) {
  if (/<(?:p|br|div|strong|em|ul|ol|li)\b/i.test(body)) return body;
  return escapeHtml(body).replace(/\r?\n\r?\n/g, "<br><br>").replace(/\r?\n/g, "<br>");
}

function buildComposioMailArguments(args: { to: string; displayName?: string; subject: string; body: string }) {
  const toolkit = getComposioMailToolkitSlug();
  const formattedBody = formatEmailBody(args.body);
  if (toolkit === "OUTLOOK") {
    return {
      to_email: args.to,
      to_name: args.displayName || args.to,
      subject: args.subject,
      body: formattedBody,
      is_html: true,
      save_to_sent_items: true,
    };
  }
  return {
    recipient_email: args.to,
    subject: args.subject,
    body: formattedBody,
    is_html: true,
  };
}

function extractComposioEmail(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of ["email", "emailAddress", "mail", "userPrincipalName", "username", "identifier", "name"]) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.includes("@")) return candidate;
  }
  for (const nested of ["connection", "state", "data", "response_data", "profile"]) {
    const found = extractComposioEmail(record[nested]);
    if (found) return found;
  }
  return null;
}

export async function getComposioMailAuthConfigId() {
  const toolkit = getComposioMailToolkitSlug();
  const envKey = getComposioMailAuthConfigEnvKey(toolkit);
  if (process.env[envKey]) return process.env[envKey];

  const params = new URLSearchParams({
    toolkit_slug: toolkit,
    is_composio_managed: "true",
    limit: "20",
  });
  const list = await composioFetch<{ items?: ComposioAuthConfigListItem[] }>(`/auth_configs?${params}`);
  const existing = (list.items ?? []).find((item) => {
    const authConfig = item.auth_config ?? item;
    return item.toolkit?.slug?.toUpperCase() === toolkit && !authConfig.is_disabled && item.status !== "DISABLED";
  });
  if (existing?.auth_config?.id || existing?.id) {
    return existing.auth_config?.id || existing.id;
  }

  const created = await composioFetch<{ id: string }>("/auth_configs", {
    method: "POST",
    body: JSON.stringify({
      toolkit_slug: toolkit,
      is_composio_managed: true,
    }),
  });
  return created.id;
}

export function isComposioMailConfigured() {
  const toolkit = getComposioMailToolkitSlug();
  return Boolean(process.env.COMPOSIO_API_KEY && (process.env[getComposioMailAuthConfigEnvKey(toolkit)] || hasStoredComposioMailConnectedAccountId()));
}

export async function createComposioMailConnectLink(callbackUrl: string) {
  const authConfigId = await getComposioMailAuthConfigId();
  const res = await composioFetch<{ redirect_url?: string; url?: string; connected_account_id?: string; id?: string }>("/connected_accounts", {
    method: "POST",
    body: JSON.stringify({
      auth_config_id: authConfigId,
      user_uuid: COMPOSIO_MAIL_USER_ID,
      redirect_url: callbackUrl,
    }),
  });

  const url = res.redirect_url || res.url;
  if (!url) throw new Error("Composio did not return a connection URL");
  return {
    redirect_url: url,
    connected_account_id: res.connected_account_id || res.id || "",
  };
}

export async function getComposioMailConnection(accountId?: string | null) {
  const targetId = accountId || (await getStoredComposioMailConnectedAccountId()) || process.env.COMPOSIO_MAIL_CONNECTED_ACCOUNT_ID;
  let connection: ComposioConnectedAccount | null = null;
  if (targetId) {
    const direct = await tryComposioFetch<ComposioConnectedAccount>(`/connected_accounts/${targetId}`);
    if (direct && direct.status === "ACTIVE") connection = direct;
  }

  if (!connection) {
    const toolkit = getComposioMailToolkitSlug();
    const params = new URLSearchParams({
      user_uuid: COMPOSIO_MAIL_USER_ID,
      toolkit_slug: toolkit,
      status: "ACTIVE",
      limit: "10",
    });
    const list = await composioFetch<{ items?: ComposioConnectedAccount[] }>(`/connected_accounts?${params}`);
    connection = (list.items ?? []).find(
      (item) => item.status === "ACTIVE" && !item.is_disabled && item.toolkit?.slug?.toUpperCase() === toolkit
    ) ?? null;
  }

  if (!connection) return null;

  return {
    ...connection,
    accountId: connection.id,
    source: "composio" as const,
  };
}

export async function resolveComposioMailConnectedAccountId() {
  const conn = await getComposioMailConnection();
  if (!conn) return { accountId: null, source: null };
  return { accountId: conn.id, source: "composio" as const };
}

export async function isComposioMailConfiguredAsync() {
  if (!process.env.COMPOSIO_API_KEY) return false;
  const conn = await getComposioMailConnection().catch(() => null);
  return Boolean(conn);
}

export async function getComposioMailProfile() {
  const connection = await getComposioMailConnection();
  if (!connection) return null;

  const toolkit = getComposioMailToolkitSlug();
  const toolSlug = getComposioMailProfileToolSlug(toolkit);
  try {
    const res = await composioFetch<{ successful?: boolean; data?: unknown }>(`/tools/execute/${toolSlug}`, {
      method: "POST",
      body: JSON.stringify({
        connected_account_id: connection.id,
        user_id: COMPOSIO_MAIL_USER_ID,
        arguments: {},
      }),
    });
    const email = extractComposioEmail(res.data) || extractComposioEmail(connection);
    return {
      connectedAccountId: connection.id,
      toolkit,
      email,
      raw: res.data ?? connection,
    };
  } catch (error) {
    return {
      connectedAccountId: connection.id,
      toolkit,
      email: extractComposioEmail(connection),
      raw: connection,
    };
  }
}

export async function sendEmailWithComposio(args: {
  to: string;
  displayName?: string;
  subject: string;
  body: string;
  connectedAccountId?: string | null;
}) {
  const connection = await getComposioMailConnection(args.connectedAccountId);
  if (!connection) {
    throw new Error("No active mail connection found in Composio");
  }

  const toolkit = getComposioMailToolkitSlug();
  const toolSlug = getComposioMailToolSlug(toolkit);
  const toolArguments = buildComposioMailArguments(args);

  const res = await composioFetch<{ successful?: boolean; error?: string; data?: unknown }>(`/tools/execute/${toolSlug}`, {
    method: "POST",
    body: JSON.stringify({
      connected_account_id: connection.id,
      user_id: COMPOSIO_MAIL_USER_ID,
      arguments: toolArguments,
    }),
  });

  if (res.successful === false) {
    throw new Error(res.error || "Composio email execution returned an unsuccessful status");
  }

  return res.data ?? { success: true };
}

export async function disconnectComposioMail() {
  const connection = await getComposioMailConnection();
  if (!connection) return true;
  await composioFetch(`/connected_accounts/${connection.id}`, {
    method: "DELETE",
  });
  return true;
}

export function extractComposioMailEmail(value: unknown) {
  return extractComposioEmail(value);
}
