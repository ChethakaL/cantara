import {
  composioFetch,
  tryComposioFetch,
  getComposioAdminId,
  ComposioAuthConfig,
  ComposioAuthConfigListItem,
  ComposioConnectedAccount,
} from "./client";
import {
  clearStoredComposioMondayConnectedAccountId,
  getStoredComposioMondayConnectedAccountId,
  saveStoredComposioMondayConnectedAccountId,
} from "@/lib/secure-settings";

export const MONDAY_TOOLKIT_SLUG = "MONDAY";
export const ADMIN_MONDAY_USER_ID = "cantara-admin-monday";
export const COMPOSIO_MONDAY_CLIENT_ID = "96b038435fc029e045f9ba800e66fefa";

type MondayConnection = ComposioConnectedAccount & {
  id: string;
  status: string;
  updated_at?: string;
  is_disabled?: boolean;
  user_id?: string;
};

function isUsableMondayConnection(item: {
  status?: string;
  is_disabled?: boolean;
  user_id?: string;
} | null | undefined) {
  if (!item) return false;
  if (item.is_disabled) return false;
  if (!["ACTIVE", "VERIFYING", "INITIATED"].includes(String(item.status || ""))) return false;
  const userId = String(item.user_id || "");
  // Shared Composio orgs may contain other projects (e.g. tinyfrog). Never use those
  // as Cantara's system Monday connection.
  if (userId.startsWith("tinyfrog:")) return false;
  return true;
}

function isPreferredCantaraMondayUser(userId: string | null | undefined) {
  const id = String(userId || "");
  return id.startsWith("admin:") || id === ADMIN_MONDAY_USER_ID;
}

export async function getMondayAuthConfigId() {
  if (process.env.COMPOSIO_MONDAY_AUTH_CONFIG_ID) {
    return process.env.COMPOSIO_MONDAY_AUTH_CONFIG_ID;
  }

  const params = new URLSearchParams({
    toolkit_slug: MONDAY_TOOLKIT_SLUG,
    is_composio_managed: "true",
    limit: "20",
  });
  const list = await composioFetch<{ items?: ComposioAuthConfigListItem[] }>(`/auth_configs?${params}`);
  const existing = (list.items ?? []).find((item) => {
    const authConfig = item.auth_config ?? item;
    return item.toolkit?.slug?.toUpperCase() === MONDAY_TOOLKIT_SLUG && !authConfig.is_disabled && item.status !== "DISABLED";
  });
  const existingId = existing?.auth_config?.id ?? existing?.id;
  if (existingId) return existingId;

  const created = await composioFetch<{ auth_config: ComposioAuthConfig }>("/auth_configs", {
    method: "POST",
    body: JSON.stringify({
      toolkit: { slug: MONDAY_TOOLKIT_SLUG },
      auth_config: {
        type: "use_composio_managed_auth",
        credentials: {},
        restrict_to_following_tools: [
          "MONDAY_LIST_BOARDS",
          "MONDAY_BOARDS",
          "MONDAY_ITEMS_PAGE",
          "MONDAY_GET_BOARD",
          "MONDAY_GET_BOARD_ITEMS",
          "MONDAY_LIST_BOARD_ITEMS",
          "MONDAY_GET_ITEMS",
          "MONDAY_CREATE_ITEM",
          "MONDAY_CREATE_UPDATE",
          "MONDAY_LIST_COLUMNS",
          "MONDAY_UPDATE_ITEM",
          "MONDAY_CHANGE_SIMPLE_COLUMN_VALUE",
        ],
      },
    }),
  });
  return created.auth_config.id;
}

export async function createMondayConnectLink(callbackUrl: string, adminId?: string) {
  const userId = adminId || getComposioAdminId() || ADMIN_MONDAY_USER_ID;
  const authConfigId = await getMondayAuthConfigId();
  const direct = await tryComposioFetch<{
    id: string;
    redirect_url: string;
  }>("/connected_accounts", {
    method: "POST",
    body: JSON.stringify({
      auth_config: { id: authConfigId },
      connection: { user_id: userId },
    }),
  });

  if (direct?.redirect_url) {
    return { redirect_url: direct.redirect_url, connected_account_id: direct.id };
  }

  const res = await composioFetch<{ redirect_url: string; connected_account_id: string }>("/connected_accounts/link", {
    method: "POST",
    body: JSON.stringify({
      auth_config_id: authConfigId,
      user_id: userId,
      alias: `cantara-monday-${Date.now()}`,
      callback_url: callbackUrl,
    }),
  });

  if (res.redirect_url) {
    try {
      const url = new URL(res.redirect_url);
      url.searchParams.set("force_install_if_needed", "true");
      res.redirect_url = url.toString();
    } catch (e) {
      res.redirect_url += (res.redirect_url.includes("?") ? "&" : "?") + "force_install_if_needed=true";
    }
  }

  return res;
}

export function getMondayInstallUrl() {
  return `https://auth.monday.com/oauth2/authorize?client_id=${COMPOSIO_MONDAY_CLIENT_ID}&response_type=install`;
}

async function fetchMondayConnectionById(accountId: string): Promise<MondayConnection | null> {
  const direct = await tryComposioFetch<MondayConnection>(`/connected_accounts/${accountId}`);
  if (!direct || !isUsableMondayConnection(direct)) return null;
  return direct;
}

async function listMondayConnections(userId?: string | null) {
  const params = new URLSearchParams({
    limit: "50",
    account_type: "ALL",
    order_by: "updated_at",
    order_direction: "desc",
  });
  if (userId) params.append("user_ids", userId);
  params.append("toolkit_slugs", MONDAY_TOOLKIT_SLUG);
  const list = await composioFetch<{ items?: MondayConnection[] }>(`/connected_accounts?${params}`);
  return list.items ?? [];
}

function pickPreferredMondayConnection(items: MondayConnection[]) {
  const usable = items.filter((item) => isUsableMondayConnection(item));
  return (
    usable.find((item) => isPreferredCantaraMondayUser(item.user_id)) ||
    usable[0] ||
    null
  );
}

/**
 * Resolve Cantara's system Monday connection.
 * Prefer the DB-stored Composio connected account id so cron/outbox never
 * accidentally use another project's connection on the shared Composio org.
 */
export async function getMondayConnection(adminId?: string) {
  const storedId =
    (await getStoredComposioMondayConnectedAccountId().catch(() => null)) ||
    process.env.COMPOSIO_MONDAY_CONNECTED_ACCOUNT_ID ||
    null;

  if (storedId) {
    const stored = await fetchMondayConnectionById(storedId);
    if (stored) return stored;
  }

  const scopedUserId = adminId || getComposioAdminId();
  if (scopedUserId) {
    const scoped = pickPreferredMondayConnection(await listMondayConnections(scopedUserId));
    if (scoped) {
      if (!storedId && scoped.status === "ACTIVE") {
        await saveStoredComposioMondayConnectedAccountId(scoped.id).catch(() => null);
      }
      return scoped;
    }
  }

  const global = pickPreferredMondayConnection(await listMondayConnections());
  if (global && !storedId && global.status === "ACTIVE" && isPreferredCantaraMondayUser(global.user_id)) {
    await saveStoredComposioMondayConnectedAccountId(global.id).catch(() => null);
  }
  return global;
}

export async function disconnectMonday(adminId?: string) {
  const storedId = await getStoredComposioMondayConnectedAccountId().catch(() => null);
  const connection = await getMondayConnection(adminId).catch(() => null);
  const targetId = storedId || connection?.id;
  if (targetId) {
    await composioFetch(`/connected_accounts/${targetId}`, {
      method: "DELETE",
    }).catch((err) => console.warn(`Failed to delete Monday connection ${targetId}:`, err));
  }
  await clearStoredComposioMondayConnectedAccountId().catch(() => null);
}

export async function executeMondayTool<T>(slug: string, argumentsPayload: Record<string, unknown>, adminId?: string) {
  const connection = await getMondayConnection(adminId).catch(() => null);
  const userId =
    (typeof connection?.user_id === "string" && connection.user_id) ||
    adminId ||
    getComposioAdminId() ||
    ADMIN_MONDAY_USER_ID;

  const run = (toolSlug: string) =>
    composioFetch<{ data?: T; successful?: boolean; error?: unknown }>(`/tools/execute/${toolSlug}`, {
      method: "POST",
      body: JSON.stringify({
        ...(connection?.id ? { connected_account_id: connection.id } : {}),
        user_id: userId,
        arguments: argumentsPayload,
      }),
    });

  try {
    const result = await run(slug);
    if (result?.successful !== false) return result;
  } catch (error) {
    if (slug === slug.toLowerCase()) throw error;
  }

  return run(slug.toLowerCase());
}

export function unwrapMondayToolData(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") return raw as Record<string, unknown>;
  return null;
}

export function parseComposioProxyJson(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") return raw as Record<string, unknown>;
  return null;
}

export function unwrapComposioProxyData(proxyResult: any): Record<string, unknown> | null {
  const outer = parseComposioProxyJson(proxyResult?.data);
  const dataLayer = parseComposioProxyJson(outer?.data) ?? outer?.data;
  return dataLayer && typeof dataLayer === "object" ? (dataLayer as Record<string, unknown>) : outer;
}

export async function getMondayAuthHeader(): Promise<string | null> {
  const connection = await getMondayConnection().catch(() => null);
  if (!connection) return null;
  const connectionDetails = await composioFetch<any>(`/connected_accounts/${connection.id}`).catch(() => null);
  const candidates = [
    connectionDetails?.params?.headers?.Authorization,
    connectionDetails?.connection?.access_token,
    connectionDetails?.params?.access_token,
    connectionDetails?.data?.access_token,
    connectionDetails?.state?.val?.access_token,
    connectionDetails?.connection?.state?.val?.access_token,
    (connection as any)?.connection?.access_token,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const token = String(candidate).trim();
    // Composio often returns the literal "REDACTED" for tokens on this API key.
    if (token.length <= 20 || token.toUpperCase() === "REDACTED") continue;
    return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  }
  return null;
}

export async function executeMondayGraphqlDirect(args: {
  query: string;
  variables?: Record<string, unknown>;
}): Promise<Record<string, unknown> | null> {
  // Do NOT use Composio /tools/execute/proxy — production API keys do not have
  // proxy-execute permission (403 ExternalProxy_OrgNotAllowed). Call Monday API
  // directly with the connected account token instead.
  const authHeader = await getMondayAuthHeader();
  if (!authHeader) {
    console.warn("[Monday Direct GraphQL] No Monday access token available from connected account.");
    return null;
  }

  const mondayRes = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
      "API-Version": "2024-01",
    },
    body: JSON.stringify({ query: args.query, variables: args.variables }),
    cache: "no-store",
  });

  const mondayJson = await mondayRes.json().catch(() => null);
  if (!mondayRes.ok || (Array.isArray(mondayJson?.errors) && mondayJson.errors.length)) {
    console.error("[Monday Direct GraphQL Error]", mondayRes.status, JSON.stringify(mondayJson));
    return null;
  }
  return mondayJson;
}
