import { PutObjectCommand } from "@aws-sdk/client-s3";
import { renderHtmlToPdfBuffer } from "@/lib/report-pdf";
import { assertS3Configured, buildPresignedFileUrl, s3BucketName, s3Client } from "@/lib/s3";

const COMPOSIO_BASE_URL = "https://backend.composio.dev/api/v3.1";
const QUICKBOOKS_TOOLKIT_SLUG = "QUICKBOOKS";
export const GOOGLEDRIVE_TOOLKIT_SLUG = "GOOGLEDRIVE";
export const ADMIN_DRIVE_USER_ID = "cantara-admin-drive";

type ComposioAuthConfig = {
  id: string;
  auth_scheme?: string;
  is_composio_managed?: boolean;
  is_disabled?: boolean;
};

type ComposioAuthConfigListItem = {
  id?: string;
  auth_config?: ComposioAuthConfig;
  toolkit?: { slug?: string };
  status?: string;
  is_disabled?: boolean;
};

function composioApiKey() {
  const key = process.env.COMPOSIO_API_KEY;
  if (!key) throw new Error("COMPOSIO_API_KEY is not configured");
  return key;
}

async function composioFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${COMPOSIO_BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": composioApiKey(),
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Composio request failed (${res.status}): ${detail}`);
  }

  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

async function tryComposioFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    return await composioFetch<T>(path, init);
  } catch (error) {
    console.warn(error);
    return null;
  }
}

export function composioUserIdForClient(clientId: string) {
  return `cantara-client:${clientId}`;
}

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

async function getGoogleDriveAuthConfigId() {
  if (process.env.COMPOSIO_GOOGLE_DRIVE_AUTH_CONFIG_ID) {
    return process.env.COMPOSIO_GOOGLE_DRIVE_AUTH_CONFIG_ID;
  }

  const params = new URLSearchParams({
    toolkit_slug: GOOGLEDRIVE_TOOLKIT_SLUG,
    is_composio_managed: "true",
    limit: "20",
  });
  const list = await composioFetch<{ items?: ComposioAuthConfigListItem[] }>(`/auth_configs?${params}`);
  const existing = (list.items ?? []).find((item) => {
    const authConfig = item.auth_config ?? item;
    return item.toolkit?.slug?.toUpperCase() === GOOGLEDRIVE_TOOLKIT_SLUG && !authConfig.is_disabled && item.status !== "DISABLED";
  });

  const existingId = existing?.auth_config?.id ?? existing?.id;
  if (existingId) return existingId;

  const created = await composioFetch<{ auth_config: ComposioAuthConfig }>("/auth_configs", {
    method: "POST",
    body: JSON.stringify({
      toolkit: { slug: GOOGLEDRIVE_TOOLKIT_SLUG },
      auth_config: {
        type: "use_composio_managed_auth",
        credentials: {},
        restrict_to_following_tools: [
          "GOOGLEDRIVE_CREATE_FOLDER",
          "GOOGLEDRIVE_FIND_FOLDER",
          "GOOGLEDRIVE_FIND_FILE",
          "GOOGLEDRIVE_UPLOAD_FROM_URL",
          "GOOGLEDRIVE_CREATE_FILE_FROM_TEXT",
          "GOOGLEDRIVE_DELETE_FILE",
          "GOOGLEDRIVE_CREATE_PERMISSION",
          "GOOGLEDRIVE_SHARE_FILE",
          "GOOGLEDRIVE_GET_FILE_DETAILS",
        ],
      },
    }),
  });

  return created.auth_config.id;
}

export async function createGoogleDriveConnectLink(callbackUrl: string) {
  const authConfigId = await getGoogleDriveAuthConfigId();
  const direct = await tryComposioFetch<{
    id: string;
    redirect_url: string;
    redirect_uri?: string;
  }>("/connected_accounts", {
    method: "POST",
    body: JSON.stringify({
      auth_config: { id: authConfigId },
      connection: { user_id: ADMIN_DRIVE_USER_ID },
    }),
  });

  if (direct?.redirect_url) {
    return {
      redirect_url: direct.redirect_url,
      connected_account_id: direct.id,
    };
  }

  return composioFetch<{
    redirect_url: string;
    connected_account_id: string;
  }>("/connected_accounts/link", {
    method: "POST",
    body: JSON.stringify({
      auth_config_id: authConfigId,
      user_id: ADMIN_DRIVE_USER_ID,
      alias: `cantara-google-drive-${Date.now()}`,
      callback_url: callbackUrl,
    }),
  });
}

export async function getGoogleDriveConnection() {
  const params = new URLSearchParams({
    limit: "10",
    account_type: "ALL",
    order_by: "updated_at",
    order_direction: "desc",
  });
  params.append("user_ids", ADMIN_DRIVE_USER_ID);
  params.append("toolkit_slugs", GOOGLEDRIVE_TOOLKIT_SLUG);

  const connections = await composioFetch<{
    items?: Array<{
      id: string;
      status: string;
      updated_at?: string;
      status_reason?: string;
      is_disabled?: boolean;
    }>;
  }>(`/connected_accounts?${params}`);

  return (connections.items ?? []).find((item) => item.status === "ACTIVE" && !item.is_disabled) ?? null;
}

export async function disconnectGoogleDrive() {
  const params = new URLSearchParams({
    limit: "50",
    account_type: "ALL",
  });
  params.append("user_ids", ADMIN_DRIVE_USER_ID);
  params.append("toolkit_slugs", GOOGLEDRIVE_TOOLKIT_SLUG);

  const connections = await composioFetch<{
    items?: Array<{ id: string; status: string }>;
  }>(`/connected_accounts?${params}`);

  const toDelete = connections.items ?? [];
  if (toDelete.length === 0) return;

  await Promise.all(
    toDelete.map((conn) =>
      composioFetch(`/connected_accounts/${conn.id}`, {
        method: "DELETE",
      }).catch((err) => console.warn(`Failed to delete connection ${conn.id}:`, err))
    )
  );
}

export async function executeGoogleDriveTool<T>(slug: string, argumentsPayload: Record<string, unknown>) {
  return composioFetch<{
    data?: T;
    successful?: boolean;
    error?: unknown;
  }>(`/tools/execute/${slug}`, {
    method: "POST",
    body: JSON.stringify({
      user_id: ADMIN_DRIVE_USER_ID,
      arguments: argumentsPayload,
    }),
  });
}

function extractDriveFileId(result: any): string | null {
  return (
    result?.id ??
    result?.file_id ??
    result?.folder_id ??
    result?.data?.id ??
    result?.data?.file_id ??
    result?.data?.folder_id ??
    result?.response_data?.id ??
    null
  );
}

function extractFirstFolderId(result: any): string | null {
  const files = result?.files ?? result?.data?.files ?? result?.response_data?.files ?? [];
  const folder = Array.isArray(files) ? files.find((file) => file?.id && file?.trashed !== true) : null;
  return folder?.id ?? null;
}

function extractFirstFileId(result: any): string | null {
  const files = result?.files ?? result?.data?.files ?? result?.response_data?.files ?? [];
  const file = Array.isArray(files) ? files.find((item) => item?.id && item?.trashed !== true) : null;
  return file?.id ?? null;
}

function driveQueryString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findFilesByPrefix(prefix: string, folderId: string) {
  const found = await executeGoogleDriveTool<any>("GOOGLEDRIVE_FIND_FILE", {
    q: `name contains '${driveQueryString(prefix)}' and '${folderId}' in parents and trashed = false`,
    fields: "files(id, name)",
  }).catch(() => null);
  const files = found?.data?.files ?? found?.files ?? [];
  return Array.isArray(files) ? files.filter(f => f.name.startsWith(prefix)) : [];
}

async function findFileInFolder(name: string, folderId: string) {
  const found = await executeGoogleDriveTool<any>("GOOGLEDRIVE_FIND_FILE", {
    q: `name = '${driveQueryString(name)}' and '${folderId}' in parents and trashed = false`,
    fields: "files(id, name)",
  }).catch(() => null);
  return found ? extractFirstFileId(found.data ?? found) : null;
}

async function fileExistsInFolder(name: string, folderId: string) {
  return Boolean(await findFileInFolder(name, folderId));
}

async function ensureFolder(name: string, parentId?: string) {
  const found = await executeGoogleDriveTool<any>("GOOGLEDRIVE_FIND_FOLDER", {
    name_exact: name,
    ...(parentId ? { parent_folder_id: parentId } : {}),
  }).catch(() => null);
  const foundId = found ? extractFirstFolderId(found.data ?? found) : null;
  if (foundId) return { id: foundId, url: `https://drive.google.com/drive/folders/${foundId}` };

  const created = await executeGoogleDriveTool<any>("GOOGLEDRIVE_CREATE_FOLDER", {
    name,
    ...(parentId ? { parent_id: parentId } : {}),
  });
  const folderId = extractDriveFileId(created.data ?? created);
  if (!folderId) {
    throw new Error(`Could not resolve Google Drive folder id for ${name}`);
  }
  return { id: folderId, url: `https://drive.google.com/drive/folders/${folderId}` };
}

export async function ensureClientDriveSubfolder(clientFolderId: string, name: string) {
  return ensureFolder(name, clientFolderId);
}

export async function ensureClientDriveFolder(args: { clientName: string; clientId: string }) {
  const connection = await getGoogleDriveConnection();
  if (!connection || connection.status !== "ACTIVE" || connection.is_disabled) {
    throw new Error("Google Drive is not connected");
  }

  const root = await ensureFolder("Cantara Clients");
  const clientFolder = await ensureFolder(args.clientName, root.id);
  await Promise.all([
    ensureFolder("Client Uploads", clientFolder.id),
    ensureFolder("Generated Reports", clientFolder.id),
    ensureFolder("Correspondence", clientFolder.id),
  ]);
  return clientFolder;
}

export async function uploadClientDocumentToDrive(args: {
  folderId: string;
  fileName: string;
  mimeType?: string;
  sourceUrl: string;
}) {
  const connection = await getGoogleDriveConnection();
  if (!connection || connection.status !== "ACTIVE" || connection.is_disabled) return null;
  if (await fileExistsInFolder(args.fileName, args.folderId)) return { skipped: true, reason: "exists" };

  const result = await executeGoogleDriveTool<any>("GOOGLEDRIVE_UPLOAD_FROM_URL", {
    source_url: args.sourceUrl,
    name: args.fileName,
    parent_folder_id: args.folderId,
    ...(args.mimeType ? { mime_type: args.mimeType } : {}),
  });
  if (result.successful === false) {
    throw new Error(typeof result.error === "string" ? result.error : JSON.stringify(result.error ?? result.data));
  }
  return result;
}

export async function saveGeneratedReportToDrive(args: {
  folderId: string;
  fileName: string;
  html: string;
  overwritePrefix?: string;
}) {
  const reports = await ensureFolder("Generated Reports", args.folderId);
  const baseName = args.fileName.replace(/\.html?$/i, "").replace(/\.pdf$/i, "");
  const resolvedFileName = `${baseName}.pdf`;
  
  // If a prefix is provided, we delete ALL files matching that prefix (e.g. "TTM Analysis")
  // to clean up old versioned files like "TTM Analysis v10.pdf"
  if (args.overwritePrefix) {
    const existing = await findFilesByPrefix(args.overwritePrefix, reports.id);
    for (const file of existing) {
      console.log(`[Composio] Cleaning up old version/file: ${file.name} (${file.id})`);
      await executeGoogleDriveTool("GOOGLEDRIVE_DELETE_FILE", { file_id: file.id }).catch(err => {
        console.warn(`[Composio] Failed to delete ${file.name}: ${err.message}`);
      });
    }
  } else {
    // Standard overwrite for exact filename match
    const existingId = await findFileInFolder(resolvedFileName, reports.id);
    if (existingId) {
      console.log(`[Composio] Deleting existing report to overwrite: ${resolvedFileName} (${existingId})`);
      await executeGoogleDriveTool("GOOGLEDRIVE_DELETE_FILE", { file_id: existingId }).catch(err => {
        console.warn(`[Composio] Failed to delete existing file: ${err.message}`);
      });
    }
  }

  assertS3Configured();
  const pdf = await renderHtmlToPdfBuffer(args.html);
  const safeName = resolvedFileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `drive-sync/generated-reports/${Date.now()}-${safeName}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: s3BucketName,
      Key: key,
      Body: pdf,
      ContentType: "application/pdf",
    }),
  );

  const result = await uploadClientDocumentToDrive({
    folderId: reports.id,
    fileName: resolvedFileName,
    mimeType: "application/pdf",
    sourceUrl: await buildPresignedFileUrl(key),
  });

  // Make the file public after upload
  const fileId = extractDriveFileId((result as any)?.data ?? result);
  if (fileId) {
    console.log(`[Composio] Making file ${fileId} public...`);
    await executeGoogleDriveTool("GOOGLEDRIVE_CREATE_PERMISSION", {
      file_id: fileId,
      role: "reader",
      type: "anyone",
    }).catch(err => {
      console.warn(`[Composio] Failed to make file public: ${err.message}`);
    });
  }

  const details = await executeGoogleDriveTool<any>("GOOGLEDRIVE_GET_FILE_DETAILS", {
    file_id: fileId,
    fields: "id, name, webViewLink, webContentLink",
  }).catch(() => null);

  return {
    ...result,
    data: details?.data ?? details ?? (result as any)?.data ?? result,
    webViewLink: details?.data?.webViewLink ?? details?.webViewLink ?? ((result as any)?.data?.webViewLink ?? (result as any)?.webViewLink),
  };
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

// ── Monday.com ────────────────────────────────────────────────────────────────

const MONDAY_TOOLKIT_SLUG = "MONDAY";
const ADMIN_MONDAY_USER_ID = "cantara-admin-monday";
const COMPOSIO_MONDAY_CLIENT_ID = "96b038435fc029e045f9ba800e66fefa";

async function getMondayAuthConfigId() {
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
          "MONDAY_GET_BOARD_ITEMS",
          "MONDAY_CREATE_ITEM",
          "MONDAY_CREATE_UPDATE",
        ],
      },
    }),
  });
  return created.auth_config.id;
}

export async function createMondayConnectLink(callbackUrl: string) {
  const authConfigId = await getMondayAuthConfigId();
  const direct = await tryComposioFetch<{
    id: string;
    redirect_url: string;
  }>("/connected_accounts", {
    method: "POST",
    body: JSON.stringify({
      auth_config: { id: authConfigId },
      connection: { user_id: ADMIN_MONDAY_USER_ID },
    }),
  });

  if (direct?.redirect_url) {
    return { redirect_url: direct.redirect_url, connected_account_id: direct.id };
  }

  const res = await composioFetch<{ redirect_url: string; connected_account_id: string }>("/connected_accounts/link", {
    method: "POST",
    body: JSON.stringify({
      auth_config_id: authConfigId,
      user_id: ADMIN_MONDAY_USER_ID,
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

export async function getMondayConnection() {
  const params = new URLSearchParams({
    limit: "10",
    account_type: "ALL",
    order_by: "updated_at",
    order_direction: "desc",
  });
  params.append("user_ids", ADMIN_MONDAY_USER_ID);
  // Temporarily removing toolkit filter to see all connections for this user
  // params.append("toolkit_slugs", MONDAY_TOOLKIT_SLUG);

  const connections = await composioFetch<{
    items?: Array<{
      id: string;
      status: string;
      updated_at?: string;
      status_reason?: string;
      is_disabled?: boolean;
    }>;
  }>(`/connected_accounts?${params}`);

  console.log(`[Composio] Monday connection check for ${ADMIN_MONDAY_USER_ID}:`, JSON.stringify(connections.items ?? [], null, 2));

  // Any status that isn't failed or disabled is considered "connected" for the UI
  const validStatuses = ["ACTIVE", "VERIFYING", "INITIATED"];
  const connection = (connections.items ?? []).find((item) => validStatuses.includes(item.status) && !item.is_disabled);
  
  return connection ?? connections.items?.[0] ?? null;
}

async function executeMondayTool<T>(slug: string, argumentsPayload: Record<string, unknown>) {
  return composioFetch<{ data?: T; successful?: boolean; error?: unknown }>(`/tools/execute/${slug}`, {
    method: "POST",
    body: JSON.stringify({
      user_id: ADMIN_MONDAY_USER_ID,
      arguments: argumentsPayload,
    }),
  });
}

export async function getMondayBoards() {
  let result: any = null;
  
  // Try MONDAY_LIST_BOARDS
  try {
    result = await executeMondayTool<any>("MONDAY_LIST_BOARDS", { limit: 50 });
  } catch (e) {
    console.log("[Composio] MONDAY_LIST_BOARDS failed, trying fallback...");
  }

  // Fallback to MONDAY_BOARDS
  if (!result?.successful || !result?.data) {
    try {
      result = await executeMondayTool<any>("MONDAY_BOARDS", { limit: 50 });
    } catch (e) {
      console.log("[Composio] MONDAY_BOARDS failed as well.");
    }
  }

  const rawBoards = 
    result?.data?.boards ?? 
    result?.data?.details ?? 
    result?.data?.raw_response?.data?.boards ??
    result?.data?.data?.boards ?? 
    result?.data?.data ?? 
    [];
  const boards = Array.isArray(rawBoards) ? rawBoards : [];
  
  return boards.map((b: any) => ({ 
    id: String(b.id || b.board_id || ""), 
    name: String(b.name || b.title || "Untitled Board") 
  })).filter(b => b.id);
}

export async function getMondayBoardItems(boardId: string) {
  let result: any = null;
  const toolNames = ["MONDAY_GET_BOARD_ITEMS", "MONDAY_LIST_ITEMS", "MONDAY_GET_ITEMS", "MONDAY_ITEMS", "MONDAY_LIST_BOARD_ITEMS"];
  
  for (const toolName of toolNames) {
    try {
      console.log(`[Composio] Trying ${toolName}...`);
      result = await executeMondayTool<any>(toolName, { board_id: boardId, limit: 500 });
      if (result?.successful && result?.data) {
        console.log(`[Composio] ${toolName} successful! Result:`, JSON.stringify(result, null, 2));
        break;
      }
    } catch (e) {
      console.log(`[Composio] ${toolName} failed...`);
    }
  }
  
  const rawItems = 
    result?.data?.items ?? 
    result?.data?.details ?? 
    result?.data?.raw_response?.data?.boards?.[0]?.items_page?.items ??
    result?.data?.raw_response?.data?.boards?.[0]?.items ??
    result?.data?.data?.boards?.[0]?.items_page?.items ?? 
    result?.data?.data?.boards?.[0]?.items ??
    result?.data?.data?.items ??
    result?.data?.data ?? 
    [];
  const items = Array.isArray(rawItems) ? rawItems : [];
  
  return items.map((i: any) => ({ 
    id: String(i.id || i.item_id || i.pulse_id || ""), 
    name: String(i.name || i.title || i.text || "Untitled Item") 
  })).filter(i => i.id);
}

export async function postMondayUpdate(args: {
  itemId: string;
  reportType: "CIM" | "Teaser";
  clientName: string;
  fileUrl: string;
}) {
  const body = `📎 *${args.reportType} for ${args.clientName}*\n\n` +
    `The latest ${args.reportType} document has been linked by the Cantara team.\n\n` +
    `🔗 [View/Download ${args.reportType}](${args.fileUrl})\n\n` +
    `_Linked on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} via Cantara Advisor Dashboard._`;

  const result = await executeMondayTool<any>("MONDAY_CREATE_UPDATE", {
    item_id: args.itemId,
    body,
  });
  if (result?.successful === false) {
    throw new Error(typeof result.error === "string" ? result.error : "Failed to post Monday.com update");
  }
  return result;
}
