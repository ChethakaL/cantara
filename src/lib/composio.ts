import { PutObjectCommand } from "@aws-sdk/client-s3";
import { renderHtmlToPdfBuffer } from "@/lib/report-pdf";
import { assertS3Configured, buildPresignedFileUrl, s3BucketName, s3Client } from "@/lib/s3";
import { cookies } from "next/headers";

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

export function getComposioAdminId() {
  try {
    const c = cookies();
    const email = c.get('cantara_admin_email')?.value;
    if (email) return `admin:${email}`;
  } catch (e) {}
  return null;
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

export async function createGoogleDriveConnectLink(callbackUrl: string, adminId?: string) {
  const userId = adminId || getComposioAdminId() || ADMIN_DRIVE_USER_ID;
  const authConfigId = await getGoogleDriveAuthConfigId();
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
      user_id: userId,
      alias: `cantara-google-drive-${Date.now()}`,
      callback_url: callbackUrl,
    }),
  });
}

export async function executeGoogleDriveTool<T = any>(slug: string, argumentsPayload: Record<string, unknown>, adminId?: string) {
  const userId = adminId || getComposioAdminId() || ADMIN_DRIVE_USER_ID;
  return composioFetch<{ data?: T; successful?: boolean; error?: unknown }>(`/tools/execute/${slug}`, {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      arguments: argumentsPayload,
    }),
  });
}

export async function getGoogleDriveConnection(adminId?: string) {
  const userId = adminId || getComposioAdminId() || ADMIN_DRIVE_USER_ID;
  const params = new URLSearchParams({
    limit: "10",
    account_type: "ALL",
    order_by: "updated_at",
    order_direction: "desc",
  });
  params.append("user_ids", userId);
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

export async function disconnectGoogleDrive(adminId?: string) {
  const userId = adminId || getComposioAdminId() || ADMIN_DRIVE_USER_ID;
  const params = new URLSearchParams({
    limit: "50",
    account_type: "ALL",
  });
  params.append("user_ids", userId);
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
          "MONDAY_BOARDS",
          "MONDAY_ITEMS_PAGE",
          "MONDAY_GET_BOARD",
          "MONDAY_GET_BOARD_ITEMS",
          "MONDAY_LIST_BOARD_ITEMS",
          "MONDAY_GET_ITEMS",
          "MONDAY_CREATE_ITEM",
          "MONDAY_CREATE_UPDATE",
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

export async function getMondayConnection(adminId?: string) {
  const userId = adminId || getComposioAdminId() || ADMIN_MONDAY_USER_ID;
  const params = new URLSearchParams({
    limit: "10",
    account_type: "ALL",
    order_by: "updated_at",
    order_direction: "desc",
  });
  params.append("user_ids", userId);
  params.append("toolkit_slugs", MONDAY_TOOLKIT_SLUG);

  const connections = await composioFetch<{
    items?: Array<{
      id: string;
      status: string;
      updated_at?: string;
      status_reason?: string;
      is_disabled?: boolean;
    }>;
  }>(`/connected_accounts?${params}`);

  // Any status that isn't failed or disabled is considered "connected" for the UI
  const validStatuses = ["ACTIVE", "VERIFYING", "INITIATED"];
  return (connections.items ?? []).find((item) => validStatuses.includes(item.status) && !item.is_disabled) ?? null;
}

export async function disconnectMonday(adminId?: string) {
  const userId = adminId || getComposioAdminId() || ADMIN_MONDAY_USER_ID;
  const params = new URLSearchParams({
    limit: "50",
    account_type: "ALL",
  });
  params.append("user_ids", userId);
  params.append("toolkit_slugs", MONDAY_TOOLKIT_SLUG);

  const connections = await composioFetch<{
    items?: Array<{ id: string; status: string }>;
  }>(`/connected_accounts?${params}`);

  const toDelete = connections.items ?? [];
  if (toDelete.length === 0) return;

  await Promise.all(
    toDelete.map((conn) =>
      composioFetch(`/connected_accounts/${conn.id}`, {
        method: "DELETE",
      }).catch((err) => console.warn(`Failed to delete Monday connection ${conn.id}:`, err))
    )
  );
}

async function executeMondayTool<T>(slug: string, argumentsPayload: Record<string, unknown>, adminId?: string) {
  const userId = adminId || getComposioAdminId() || ADMIN_MONDAY_USER_ID;
  return composioFetch<{ data?: T; successful?: boolean; error?: unknown }>(`/tools/execute/${slug}`, {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      arguments: argumentsPayload,
    }),
  });
}

/** Composio often returns `data` as a JSON string for Monday tools. */
function unwrapMondayToolData(raw: unknown): Record<string, unknown> | null {
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

function findMondayItemsPagePayload(payload: Record<string, unknown> | null): {
  items: unknown[];
  cursor?: string;
} | null {
  if (!payload) return null;
  const tryPage = (p: unknown) => {
    if (!p || typeof p !== "object") return null;
    const o = p as Record<string, unknown>;
    const items = o.items;
    if (!Array.isArray(items)) return null;
    const cursor =
      (typeof o.cursor === "string" && o.cursor) ||
      (typeof o.next_cursor === "string" && o.next_cursor) ||
      undefined;
    return { items, cursor };
  };

  const boards = payload.boards;
  if (Array.isArray(boards) && boards[0] && typeof boards[0] === "object") {
    const b0 = boards[0] as Record<string, unknown>;
    const fromIp = tryPage(b0.items_page);
    if (fromIp) return fromIp;
  }

  const direct = tryPage(payload.items_page);
  if (direct) return direct;

  const data = payload.data;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    const bs = d.boards;
    if (Array.isArray(bs) && bs[0] && typeof bs[0] === "object") {
      const b0 = bs[0] as Record<string, unknown>;
      const fromIp = tryPage(b0.items_page);
      if (fromIp) return fromIp;
    }
  }

  const raw = payload.raw_response;
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const d = r.data;
    if (d && typeof d === "object") {
      const dd = d as Record<string, unknown>;
      const bs = dd.boards;
      if (Array.isArray(bs) && bs[0] && typeof bs[0] === "object") {
        const b0 = bs[0] as Record<string, unknown>;
        const fromIp = tryPage(b0.items_page);
        if (fromIp) return fromIp;
      }
    }
  }

  return null;
}

async function collectMondayBoardItemsViaItemsPage(boardId: string): Promise<any[]> {
  const boardIdNum = parseInt(boardId, 10);
  if (Number.isNaN(boardIdNum)) return [];

  const byId = new Map<string, any>();
  let cursor: string | undefined;

  for (let safety = 0; safety < 40; safety++) {
    const args: Record<string, unknown> = {
      board_id: boardIdNum,
      limit: 500,
      include_column_values: true,
    };
    if (cursor) args.cursor = cursor;

    let result: { data?: unknown; successful?: boolean } | null = null;
    try {
      result = await executeMondayTool<unknown>("MONDAY_ITEMS_PAGE", args);
    } catch (e) {
      console.log("[Composio] MONDAY_ITEMS_PAGE request failed:", e);
      break;
    }

    if (!result?.successful) {
      console.log("[Composio] MONDAY_ITEMS_PAGE unsuccessful");
      break;
    }

    const payload = unwrapMondayToolData(result.data);
    const page = findMondayItemsPagePayload(payload);
    if (!page) {
      console.log("[Composio] MONDAY_ITEMS_PAGE could not parse items_page from payload keys:", payload ? Object.keys(payload) : []);
      break;
    }

    for (const item of page.items) {
      if (item && typeof item === "object") {
        const id = String((item as any).id ?? (item as any).item_id ?? "");
        if (id) byId.set(id, item);
      }
    }

    const next = page.cursor;
    if (!next || page.items.length === 0) break;
    cursor = next;
  }

  return Array.from(byId.values());
}

const EMAIL_LIKE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

function columnTitle(cv: any): string {
  return String(cv?.title ?? cv?.column?.title ?? cv?.id ?? "").trim();
}

function extractEmailFromMondayColumns(item: any): string {
  const columnValues = item.column_values || item.values || [];
  if (!Array.isArray(columnValues)) return "";

  const emailCol = columnValues.find(
    (cv: any) =>
      columnTitle(cv).toLowerCase().includes("email") ||
      String(cv?.id || "").toLowerCase().includes("email") ||
      cv?.type === "email"
  );
  if (emailCol) {
    const direct = String(emailCol.text || "").trim();
    if (direct) return direct.toLowerCase();
    if (emailCol.value != null) {
      try {
        const parsed =
          typeof emailCol.value === "string" ? JSON.parse(emailCol.value) : emailCol.value;
        const fromParsed = String(parsed?.email || parsed?.text || parsed?.value || "").trim();
        if (fromParsed) return fromParsed.toLowerCase();
      } catch {
        /* ignore */
      }
    }
  }

  for (const cv of columnValues) {
    const t = String(cv?.text || "").trim();
    const m = t.match(EMAIL_LIKE);
    if (m) return m[0].toLowerCase();
    if (cv?.value != null && typeof cv.value === "string") {
      try {
        const parsed = JSON.parse(cv.value);
        const nested = String(parsed?.email || parsed?.text || "").trim();
        const m2 = nested.match(EMAIL_LIKE);
        if (m2) return m2[0].toLowerCase();
      } catch {
        /* ignore */
      }
    }
  }

  return "";
}

function slimColumnValuesForApi(item: any): Array<{ id: string; title: string; type: string; text: string }> {
  const columnValues = item.column_values || item.values || [];
  if (!Array.isArray(columnValues)) return [];
  return columnValues.map((cv: any) => ({
    id: String(cv.id ?? ""),
    title: columnTitle(cv) || String(cv.id ?? ""),
    type: String(cv.type ?? ""),
    text: String(cv.text ?? "").trim(),
  }));
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
  let bestResult: any[] = [];
  let foundColumnData = false;

  // 1. Preferred: Composio MONDAY_ITEMS_PAGE (column_values + pagination).
  try {
    console.log(`[Composio] MONDAY_ITEMS_PAGE for board ${boardId}...`);
    const pageItems = await collectMondayBoardItemsViaItemsPage(boardId);
    if (pageItems.length > 0) {
      bestResult = pageItems;
      foundColumnData = pageItems.some(
        (i) => Array.isArray(i.column_values) && i.column_values.length > 0
      );
      console.log(
        `[Composio] MONDAY_ITEMS_PAGE collected ${pageItems.length} items. Has column_values: ${foundColumnData}`
      );
    }
  } catch (e) {
    console.log("[Composio] MONDAY_ITEMS_PAGE failed:", e);
  }

  // 2. GraphQL via Composio proxy — `body` is forwarded to Monday (not `data`).
  if (bestResult.length === 0 || !foundColumnData) {
    console.log(`[Composio] Proxy GraphQL for board ${boardId}...`);
    try {
      const connection = await getMondayConnection();
      if (connection) {
        const gql = `query { boards(ids: [${boardId}]) { items_page(limit: 500) { cursor items { id name column_values { id type text value column { title } } } } } }`;
        const proxyResult = await composioFetch<any>("/tools/execute/proxy", {
          method: "POST",
          body: JSON.stringify({
            endpoint: "https://api.monday.com/v2",
            method: "POST",
            connected_account_id: connection.id,
            parameters: [
              { name: "Content-Type", value: "application/json", type: "header" },
              { name: "API-Version", value: "2024-01", type: "header" },
            ],
            body: { query: gql },
          }),
        });

        const outer = proxyResult?.data;
        let up: Record<string, unknown> | null = null;
        if (outer && typeof outer === "object") up = outer as Record<string, unknown>;
        else if (typeof outer === "string") {
          try {
            up = JSON.parse(outer) as Record<string, unknown>;
          } catch {
            up = null;
          }
        }
        const httpStatus = typeof up?.status === "number" ? (up.status as number) : undefined;
        let graphqlLayer = up?.data as Record<string, unknown> | string | null | undefined;
        if (typeof graphqlLayer === "string") {
          try {
            graphqlLayer = JSON.parse(graphqlLayer) as Record<string, unknown>;
          } catch {
            graphqlLayer = null;
          }
        }
        const gq = (graphqlLayer && typeof graphqlLayer === "object" ? graphqlLayer : null) as Record<
          string,
          unknown
        > | null;
        if (gq && Array.isArray(gq.errors) && gq.errors.length) {
          console.log("[Composio] Proxy GraphQL errors:", JSON.stringify(gq.errors).slice(0, 400));
        }
        const boards = gq?.boards as unknown[] | undefined;
        let items: any[] | undefined;
        if (Array.isArray(boards) && boards[0] && typeof boards[0] === "object") {
          const ip = (boards[0] as Record<string, unknown>).items_page as Record<string, unknown> | undefined;
          if (ip && Array.isArray(ip.items)) items = ip.items as any[];
        }

        if (Array.isArray(items) && items.length > 0) {
          const hasCols = items.some((i) => Array.isArray(i.column_values) && i.column_values.length > 0);
          if (bestResult.length === 0 || hasCols) {
            bestResult = items;
            foundColumnData = hasCols;
          }
          console.log(
            `[Composio] Proxy returned ${items.length} items (upstream HTTP ${httpStatus ?? "?"}). column_values: ${hasCols}`
          );
        } else if (httpStatus && httpStatus >= 400) {
          console.log(`[Composio] Proxy upstream HTTP ${httpStatus}`);
        } else {
          console.log(`[Composio] Proxy could not parse items from response.`);
        }
      }
    } catch (e) {
      console.log(`[Composio] Proxy call failed:`, e);
    }
  }

  // 3. Legacy fallbacks if we still have no rows
  if (bestResult.length === 0) {
    const toolNames = ["MONDAY_GET_BOARD", "MONDAY_LIST_BOARD_ITEMS"];

    for (const toolName of toolNames) {
      try {
        console.log(`[Composio] Trying ${toolName} for board ${boardId}...`);
        const payload: Record<string, unknown> = { board_id: boardId };
        if (toolName === "MONDAY_GET_BOARD") payload.id = boardId;

        const result = await executeMondayTool<any>(toolName, payload);

        if (result?.successful && result?.data) {
          const dataObj = unwrapMondayToolData(result.data) ?? (result.data as Record<string, unknown>);
          let rawItems =
            (dataObj as any)?.items ??
            (dataObj as any)?.details ??
            (dataObj as any)?.boards?.[0]?.items ??
            (dataObj as any)?.boards?.[0]?.items_page?.items ??
            result.data?.boards?.[0]?.items_page?.items ??
            result.data?.boards?.[0]?.items ??
            result.data?.items ??
            [];

          if (!Array.isArray(rawItems) || rawItems.length === 0) {
            const groups = (dataObj as any)?.boards?.[0]?.groups || result.data?.boards?.[0]?.groups || [];
            if (Array.isArray(groups)) {
              rawItems = groups.flatMap((g: any) => g.items || []);
            }
          }

          const items = Array.isArray(rawItems) ? rawItems : [];

          if (items.length > 0) {
            const hasColumns = items.some((i: any) => i.column_values || i.values);
            console.log(`[Composio] ${toolName} found ${items.length} items. Has columns: ${hasColumns}`);

            if (bestResult.length === 0 || (hasColumns && !foundColumnData)) {
              bestResult = items;
              foundColumnData = hasColumns;
            }
            if (hasColumns) break;
          }
        }
      } catch (e) {
        console.log(`[Composio] ${toolName} failed or not found.`);
      }
    }
  }

  // 4. MONDAY_GET_ITEMS does not include column_values per Composio; metadata merge only.
  if (bestResult.length > 0 && !foundColumnData) {
    const itemIds = bestResult.map((i) => String(i.id || i.item_id || i.pulse_id)).filter(Boolean);
    console.log(`[Composio] No column_values yet; MONDAY_GET_ITEMS for ${itemIds.length} ids (metadata only)...`);
    try {
      const enrichment = await executeMondayTool<any>("MONDAY_GET_ITEMS", { ids: itemIds });
      if (enrichment?.successful && enrichment?.data) {
        const dataObj = unwrapMondayToolData(enrichment.data) ?? enrichment.data;
        const enrichedItems =
          (dataObj as any)?.items ??
          (dataObj as any)?.details ??
          (dataObj as any)?.data?.items ??
          (dataObj as any)?.raw_response?.data?.items ??
          [];

        if (Array.isArray(enrichedItems) && enrichedItems.length > 0) {
          bestResult = bestResult.map((original) => {
            const enriched = enrichedItems.find(
              (e: any) => String(e.id || e.item_id) === String(original.id)
            );
            return enriched ? { ...original, ...enriched } : original;
          });
        }
      }
    } catch (e) {
      console.log(`[Composio] MONDAY_GET_ITEMS fallback failed:`, e);
    }
  }

  if (bestResult.length === 0) {
    console.log("[Composio] No items found across all tried tools.");
  }

  return bestResult
    .map((i: any) => {
      const email = extractEmailFromMondayColumns(i);
      return {
        id: String(i.id || i.item_id || i.pulse_id || ""),
        name: String(i.name || i.title || i.text || "Untitled Item"),
        email,
        columnValues: slimColumnValuesForApi(i),
      };
    })
    .filter((row) => row.id);
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
