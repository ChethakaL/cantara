import {
  composioFetch,
  tryComposioFetch,
  composioUserIdForClient,
  QUICKBOOKS_TOOLKIT_SLUG,
  ComposioAuthConfig,
  ComposioAuthConfigListItem,
} from "./client";

export async function getQuickBooksAuthConfigId() {
  if (process.env.COMPOSIO_QUICKBOOKS_AUTH_CONFIG_ID) {
    return process.env.COMPOSIO_QUICKBOOKS_AUTH_CONFIG_ID;
  }

  const params = new URLSearchParams({
    toolkit_slug: QUICKBOOKS_TOOLKIT_SLUG,
    is_composio_managed: "true",
    limit: "20",
  });
  const list = await composioFetch<{ items?: ComposioAuthConfigListItem[] }>(`/auth_configs?${params}`);
  const existing = (list.items ?? []).find((item) => {
    const authConfig = item.auth_config ?? item;
    const toolkitSlug = item.toolkit?.slug?.toUpperCase();
    return toolkitSlug === QUICKBOOKS_TOOLKIT_SLUG && !authConfig.is_disabled && item.status !== "DISABLED";
  });

  const existingId = existing?.auth_config?.id ?? existing?.id;
  if (existingId) return existingId;

  const created = await composioFetch<{ auth_config: ComposioAuthConfig }>("/auth_configs", {
    method: "POST",
    body: JSON.stringify({
      toolkit: { slug: QUICKBOOKS_TOOLKIT_SLUG },
      auth_config: {
        type: "use_composio_managed_auth",
        credentials: {},
        restrict_to_following_tools: [
          "QUICKBOOKS_GET_COMPANY_INFO",
          "QUICKBOOKS_GET_PROFIT_AND_LOSS_REPORT",
          "QUICKBOOKS_GET_BALANCE_SHEET_REPORT",
          "QUICKBOOKS_GET_GENERAL_LEDGER_REPORT",
        ],
      },
    }),
  });

  return created.auth_config.id;
}

export async function createQuickBooksConnectLink(args: {
  clientId: string;
  callbackUrl: string;
}) {
  const authConfigId = await getQuickBooksAuthConfigId();
  const connectionData = {
    user_id: composioUserIdForClient(args.clientId),
    token_url: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
    tokenUrl: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
    authorization_url: "https://appcenter.intuit.com/connect/oauth2",
    authorizationUrl: "https://appcenter.intuit.com/connect/oauth2",
    base_url: "https://quickbooks.api.intuit.com",
    baseUrl: "https://quickbooks.api.intuit.com",
    full: "https://quickbooks.api.intuit.com",
  };

  const direct = await tryComposioFetch<{
    id: string;
    redirect_url: string;
    redirect_uri?: string;
  }>("/connected_accounts", {
    method: "POST",
    body: JSON.stringify({
      auth_config: { id: authConfigId },
      connection: connectionData,
    }),
  });

  if (direct?.redirect_url) {
    return {
      link_token: "",
      redirect_url: direct.redirect_url,
      expires_at: null,
      connected_account_id: direct.id,
    };
  }

  return composioFetch<{
    link_token: string;
    redirect_url: string;
    expires_at: string | null;
    connected_account_id: string;
  }>("/connected_accounts/link", {
    method: "POST",
    body: JSON.stringify({
      auth_config_id: authConfigId,
      user_id: composioUserIdForClient(args.clientId),
      alias: `cantara-quickbooks-${args.clientId}-${Date.now()}`,
      callback_url: args.callbackUrl,
      connection_data: connectionData,
    }),
  });
}

export async function getQuickBooksConnections(clientId: string) {
  const params = new URLSearchParams({
    limit: "10",
    account_type: "ALL",
    order_by: "updated_at",
    order_direction: "desc",
  });
  params.append("user_ids", composioUserIdForClient(clientId));
  params.append("toolkit_slugs", QUICKBOOKS_TOOLKIT_SLUG);

  return composioFetch<{
    items?: Array<{
      id: string;
      status: string;
      created_at?: string;
      updated_at?: string;
      status_reason?: string;
      is_disabled?: boolean;
      toolkit?: { slug?: string };
    }>;
  }>(`/connected_accounts?${params}`);
}
