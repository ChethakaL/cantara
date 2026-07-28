import { PutObjectCommand } from "@aws-sdk/client-s3";
import { renderHtmlToPdfBuffer } from "@/lib/report-pdf";
import { assertS3Configured, buildPresignedFileUrl, s3BucketName, s3Client } from "@/lib/s3";
import {
  composioFetch,
  tryComposioFetch,
  getComposioAdminId,
  ADMIN_DRIVE_USER_ID,
  GOOGLEDRIVE_TOOLKIT_SLUG,
  ComposioAuthConfig,
  ComposioAuthConfigListItem,
} from "./client";

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
  return Array.isArray(files) ? files.filter((f) => f.name.startsWith(prefix)) : [];
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

export async function ensureClientDriveFolder(args: { clientName: string; clientId: string; parentFolderId?: string }) {
  const connection = await getGoogleDriveConnection();
  if (!connection || connection.status !== "ACTIVE" || connection.is_disabled) {
    throw new Error("Google Drive is not connected");
  }

  const clientFolder = await ensureFolder(args.clientName, args.parentFolderId);
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

  if (args.overwritePrefix) {
    const existing = await findFilesByPrefix(args.overwritePrefix, reports.id);
    for (const file of existing) {
      console.log(`[Composio] Cleaning up old version/file: ${file.name} (${file.id})`);
      await executeGoogleDriveTool("GOOGLEDRIVE_DELETE_FILE", { file_id: file.id }).catch((err) => {
        console.warn(`[Composio] Failed to delete ${file.name}: ${err.message}`);
      });
    }
  } else {
    const existingId = await findFileInFolder(resolvedFileName, reports.id);
    if (existingId) {
      console.log(`[Composio] Deleting existing report to overwrite: ${resolvedFileName} (${existingId})`);
      await executeGoogleDriveTool("GOOGLEDRIVE_DELETE_FILE", { file_id: existingId }).catch((err) => {
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
    })
  );

  const result = await uploadClientDocumentToDrive({
    folderId: reports.id,
    fileName: resolvedFileName,
    mimeType: "application/pdf",
    sourceUrl: await buildPresignedFileUrl(key),
  });

  const fileId = extractDriveFileId((result as any)?.data ?? result);
  if (fileId) {
    console.log(`[Composio] Making file ${fileId} public...`);
    await executeGoogleDriveTool("GOOGLEDRIVE_CREATE_PERMISSION", {
      file_id: fileId,
      role: "reader",
      type: "anyone",
    }).catch((err) => {
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
    webViewLink:
      details?.data?.webViewLink ??
      details?.webViewLink ??
      ((result as any)?.data?.webViewLink ?? (result as any)?.webViewLink),
  };
}
