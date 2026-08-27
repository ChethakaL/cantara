import {
  composioFetch,
  createComposioAuthLink,
  ComposioAuthConfig,
  ComposioAuthConfigListItem,
} from "./client";

/** Global Composio user for one shared Cantara DocuSign connection. */
export const DOCUSIGN_SYSTEM_USER_ID = "cantara-system-docusign";
export const DOCUSIGN_TOOLKIT_SLUG = "DOCUSIGN";

const COMPOSIO_OAUTH_REDIRECT =
  "https://backend.composio.dev/api/v1/auth-apps/add";

function docusignAuthorizationUrl(): string {
  const fromEnv = (process.env.DOCUSIGN_AUTHORIZATION_URL || "").trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const env = (process.env.DOCUSIGN_ENVIRONMENT || "demo").trim().toLowerCase();
  // Composio Auth Config expects the account-server host (no /oauth/auth path).
  return env === "production" || env === "prod"
    ? "https://account.docusign.com"
    : "https://account-d.docusign.com";
}

/** Client ID in Dev Console = Integration Key. Accept either env name. */
function docusignClientId(): string {
  return (
    process.env.DOCUSIGN_INTEGRATION_KEY ||
    process.env.DOCUSIGN_CLIENT_ID ||
    ""
  ).trim();
}

function docusignClientSecret(): string {
  return (
    process.env.DOCUSIGN_SECRET_KEY ||
    process.env.DOCUSIGN_CLIENT_SECRET ||
    ""
  ).trim();
}

/**
 * Resolve DocuSign auth config.
 * DocuSign has no Composio-managed app — credentials must come from:
 * 1) COMPOSIO_DOCUSIGN_AUTH_CONFIG_ID (preferred — create once in Composio dashboard), or
 * 2) DOCUSIGN_CLIENT_ID (or INTEGRATION_KEY) + DOCUSIGN_SECRET_KEY.
 */
export async function getDocuSignAuthConfigId(): Promise<string> {
  if (process.env.COMPOSIO_DOCUSIGN_AUTH_CONFIG_ID) {
    return process.env.COMPOSIO_DOCUSIGN_AUTH_CONFIG_ID;
  }

  const params = new URLSearchParams({
    toolkit_slug: DOCUSIGN_TOOLKIT_SLUG,
    limit: "20",
  });
  const list = await composioFetch<{ items?: ComposioAuthConfigListItem[] }>(
    `/auth_configs?${params}`
  );
  const existing = (list.items ?? []).find((item) => {
    const authConfig = item.auth_config ?? item;
    const slug = item.toolkit?.slug?.toUpperCase();
    return (
      slug === DOCUSIGN_TOOLKIT_SLUG &&
      !authConfig.is_disabled &&
      item.status !== "DISABLED"
    );
  });
  const existingId = existing?.auth_config?.id ?? existing?.id;
  if (existingId) return existingId;

  const clientId = docusignClientId();
  const clientSecret = docusignClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error(
      "DocuSign is not configured. Set COMPOSIO_DOCUSIGN_AUTH_CONFIG_ID, or " +
        "DOCUSIGN_CLIENT_ID (same as Integration Key) + DOCUSIGN_SECRET_KEY."
    );
  }

  const authHost = docusignAuthorizationUrl();
  const created = await composioFetch<{
    auth_config?: ComposioAuthConfig;
    id?: string;
  }>("/auth_configs", {
    method: "POST",
    body: JSON.stringify({
      toolkit: { slug: DOCUSIGN_TOOLKIT_SLUG },
      auth_config: {
        type: "use_custom_auth",
        name: "Cantara DocuSign",
        // Composio v3.1 REST expects camelCase authScheme (snake_case alone 400s).
        authScheme: "OAUTH2",
        auth_scheme: "OAUTH2",
        credentials: {
          client_id: clientId,
          client_secret: clientSecret,
          oauth_redirect_uri: COMPOSIO_OAUTH_REDIRECT,
          // Demo Client IDs only work on account-d; production defaults break OAuth.
          authorization_url: authHost,
          base_url: authHost,
          full: authHost,
          token_url: `${authHost}/oauth/token`,
        },
      },
    }),
  });

  const id = created.auth_config?.id ?? created.id;
  if (!id) {
    throw new Error("Composio did not return a DocuSign auth config id");
  }
  return id;
}

export async function createDocuSignConnectLink(callbackUrl: string) {
  const authConfigId = await getDocuSignAuthConfigId();
  // Single global connection — do not allow multiple active accounts for this user.
  return createComposioAuthLink({
    authConfigId,
    userId: DOCUSIGN_SYSTEM_USER_ID,
    callbackUrl,
    alias: `cantara-docusign-${Date.now()}`,
    allowMultiple: false,
  });
}

export async function getDocuSignConnection() {
  const params = new URLSearchParams({
    limit: "10",
    account_type: "ALL",
    order_by: "updated_at",
    order_direction: "desc",
  });
  params.append("user_ids", DOCUSIGN_SYSTEM_USER_ID);
  params.append("toolkit_slugs", DOCUSIGN_TOOLKIT_SLUG);

  const connections = await composioFetch<{
    items?: Array<{
      id: string;
      status: string;
      updated_at?: string;
      status_reason?: string;
      is_disabled?: boolean;
      user_id?: string;
    }>;
  }>(`/connected_accounts?${params}`);

  return (
    (connections.items ?? []).find(
      (item) => item.status === "ACTIVE" && !item.is_disabled
    ) ?? null
  );
}

export async function disconnectDocuSign() {
  const params = new URLSearchParams({
    limit: "50",
    account_type: "ALL",
  });
  params.append("user_ids", DOCUSIGN_SYSTEM_USER_ID);
  params.append("toolkit_slugs", DOCUSIGN_TOOLKIT_SLUG);

  const connections = await composioFetch<{
    items?: Array<{ id: string; status: string }>;
  }>(`/connected_accounts?${params}`);

  const toDelete = connections.items ?? [];
  if (toDelete.length === 0) return;

  await Promise.all(
    toDelete.map((conn) =>
      composioFetch(`/connected_accounts/${conn.id}`, {
        method: "DELETE",
      }).catch((err) =>
        console.warn(`[docusign] Failed to delete connection ${conn.id}:`, err)
      )
    )
  );
}

/** Execute a DocuSign toolkit action via /tools/execute (not proxy). */
export async function executeDocuSignTool<T = unknown>(
  slug: string,
  argumentsPayload: Record<string, unknown>
) {
  return composioFetch<{ data?: T; successful?: boolean; error?: unknown }>(
    `/tools/execute/${slug}`,
    {
      method: "POST",
      body: JSON.stringify({
        user_id: DOCUSIGN_SYSTEM_USER_ID,
        arguments: argumentsPayload,
      }),
    }
  );
}
