import { PutObjectCommand } from "@aws-sdk/client-s3";
import { renderHtmlToPdfBuffer } from "@/lib/report-pdf";
import { assertS3Configured, buildPresignedFileUrl, s3BucketName, s3Client } from "@/lib/s3";
import {
  composioFetch,
  createComposioAuthLink,
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
          "GOOGLEDRIVE_MOVE_FILE",
          "GOOGLEDRIVE_CREATE_PERMISSION",
          "GOOGLEDRIVE_SHARE_FILE",
          "GOOGLEDRIVE_GET_FILE_METADATA",
        ],
      },
    }),
  });

  return created.auth_config.id;
}

export async function createGoogleDriveConnectLink(callbackUrl: string, adminId?: string) {
  const userId = adminId || getComposioAdminId() || ADMIN_DRIVE_USER_ID;
  const authConfigId = await getGoogleDriveAuthConfigId();
  return createComposioAuthLink({
    authConfigId,
    userId,
    callbackUrl,
    alias: `cantara-google-drive-${Date.now()}`,
    allowMultiple: true,
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
    result?.documentId ??
    result?.document_id ??
    result?.data?.id ??
    result?.data?.file_id ??
    result?.data?.folder_id ??
    result?.data?.documentId ??
    result?.response_data?.id ??
    result?.response_data?.file?.id ??
    result?.data?.file?.id ??
    result?.file?.id ??
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

export async function listDriveFolderChildren(folderId: string): Promise<Array<{ id: string; name: string; mimeType?: string; isFolder: boolean }>> {
  return listDriveChildren(folderId);
}

export async function moveDriveFileToFolder(fileId: string, newParentId: string, oldParentId?: string) {
  return moveDriveFile(fileId, newParentId, oldParentId);
}

const PRE_CALL_BRIEF_PREFIX = "Pre-Call Brief - ";

function normalizeBusinessKey(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type PreCallBriefOrganizeResult = {
  moved: number;
  unmatchedMoved: number;
  duplicatesTrashed: number;
  alreadyOrganized: number;
  unlinkedFolders: string[];
  errors: string[];
  message: string;
};

/**
 * Organize loose "Pre-Call Brief - {Business}" docs in the Cantara parent folder into:
 *   Pre-Call Briefs / {Business Name} /
 * Known sales-lead names go into named folders; unknown briefs go to _Unmatched.
 * Duplicate briefs for the same business keep the first and trash the rest.
 * Does NOT delete client folders that aren't linked in Cantara (reported only).
 */
export async function organizePreCallBriefsInParentFolder(args: {
  parentFolderId: string;
  knownBusinessNames: string[];
  linkedClientFolderIds: Set<string>;
}): Promise<PreCallBriefOrganizeResult> {
  const result: PreCallBriefOrganizeResult = {
    moved: 0,
    unmatchedMoved: 0,
    duplicatesTrashed: 0,
    alreadyOrganized: 0,
    unlinkedFolders: [],
    errors: [],
    message: "",
  };

  const knownByKey = new Map<string, string>();
  for (const name of args.knownBusinessNames) {
    const key = normalizeBusinessKey(name);
    if (key && !knownByKey.has(key)) knownByKey.set(key, name.trim());
  }

  const briefsRoot = await ensureFolder("Pre-Call Briefs", args.parentFolderId);
  const folderCache = new Map<string, string>([[`${args.parentFolderId}/Pre-Call Briefs`, briefsRoot.id]]);
  const children = await listDriveChildren(args.parentFolderId);

  const SYSTEM_FOLDER_NAMES = new Set([
    "pre-call briefs",
    "client uploads",
    "generated reports",
    "correspondence",
  ]);

  for (const child of children) {
    if (child.isFolder) {
      if (SYSTEM_FOLDER_NAMES.has(child.name.toLowerCase())) continue;
      if (!args.linkedClientFolderIds.has(child.id)) {
        result.unlinkedFolders.push(child.name);
      }
      continue;
    }

    if (!child.name.startsWith(PRE_CALL_BRIEF_PREFIX)) continue;

    const rawBusiness = child.name.slice(PRE_CALL_BRIEF_PREFIX.length).trim();
    if (!rawBusiness) continue;

    const knownName = knownByKey.get(normalizeBusinessKey(rawBusiness));
    const targetBusiness = knownName || rawBusiness;
    const bucket = knownName ? sanitizeDriveFolderName(targetBusiness) : "_Unmatched";

    try {
      const targetId = await ensureFolderPath(briefsRoot.id, [bucket], folderCache);
      const existingInTarget = await listDriveChildren(targetId);
      const sameName = existingInTarget.filter(
        (f) => !f.isFolder && f.name === child.name,
      );

      // Already living in the right place (shouldn't happen for root-level files)
      if (sameName.some((f) => f.id === child.id)) {
        result.alreadyOrganized += 1;
        continue;
      }

      // Duplicate already in target — trash this root copy
      if (sameName.length > 0) {
        await executeGoogleDriveTool("GOOGLEDRIVE_DELETE_FILE", { file_id: child.id }).catch(() => null);
        result.duplicatesTrashed += 1;
        continue;
      }

      const moved = await moveDriveFile(child.id, targetId, args.parentFolderId);
      if (!moved) {
        result.errors.push(`Could not move ${child.name}`);
        continue;
      }
      if (knownName) result.moved += 1;
      else result.unmatchedMoved += 1;
    } catch (error) {
      result.errors.push(
        `${child.name}: ${error instanceof Error ? error.message : "organize failed"}`,
      );
    }
  }

  // Deduplicate inside each business folder under Pre-Call Briefs
  try {
    const briefFolders = await listDriveChildren(briefsRoot.id);
    for (const folder of briefFolders.filter((f) => f.isFolder)) {
      const files = (await listDriveChildren(folder.id)).filter((f) => !f.isFolder && f.name.startsWith(PRE_CALL_BRIEF_PREFIX));
      const byName = new Map<string, typeof files>();
      for (const file of files) {
        const list = byName.get(file.name) ?? [];
        list.push(file);
        byName.set(file.name, list);
      }
      for (const group of Array.from(byName.values())) {
        if (group.length <= 1) continue;
        // Keep the first, trash the rest
        for (const dup of group.slice(1)) {
          await executeGoogleDriveTool("GOOGLEDRIVE_DELETE_FILE", { file_id: dup.id }).catch(() => null);
          result.duplicatesTrashed += 1;
        }
      }
    }
  } catch (error) {
    result.errors.push(
      `Deduplicate: ${error instanceof Error ? error.message : "failed"}`,
    );
  }

  result.message = [
    `Pre-Call Briefs: ${result.moved} moved`,
    `${result.unmatchedMoved} unmatched`,
    `${result.duplicatesTrashed} duplicates removed`,
    result.unlinkedFolders.length
      ? `${result.unlinkedFolders.length} unlinked folder(s) left in place (not deleted)`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return result;
}

function sanitizeDriveFolderName(value: string) {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "untitled";
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

/** Ensure nested folders under a parent, caching ids by relative path. */
export async function ensureFolderPath(
  parentId: string,
  parts: string[],
  cache?: Map<string, string>,
): Promise<string> {
  let currentId = parentId;
  let pathKey = parentId;
  for (const part of parts) {
    const name = part.trim();
    if (!name) continue;
    pathKey = `${pathKey}/${name}`;
    const cached = cache?.get(pathKey);
    if (cached) {
      currentId = cached;
      continue;
    }
    const folder = await ensureFolder(name, currentId);
    currentId = folder.id;
    cache?.set(pathKey, currentId);
  }
  return currentId;
}

type DriveChild = { id: string; name: string; mimeType?: string; isFolder: boolean };

async function listDriveChildren(folderId: string): Promise<DriveChild[]> {
  const found = await executeGoogleDriveTool<any>("GOOGLEDRIVE_FIND_FILE", {
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType)",
  }).catch(() => null);
  const files = found?.data?.files ?? found?.files ?? found?.data?.data?.files ?? [];
  if (!Array.isArray(files)) return [];
  return files
    .filter((f: any) => f?.id && f?.name && f?.trashed !== true)
    .map((f: any) => ({
      id: String(f.id),
      name: String(f.name),
      mimeType: typeof f.mimeType === "string" ? f.mimeType : undefined,
      isFolder: f.mimeType === "application/vnd.google-apps.folder",
    }));
}

async function moveDriveFile(fileId: string, newParentId: string, oldParentId?: string) {
  try {
    const result = await executeGoogleDriveTool<any>("GOOGLEDRIVE_MOVE_FILE", {
      file_id: fileId,
      add_parents: newParentId,
      ...(oldParentId ? { remove_parents: oldParentId } : {}),
    });
    if (result.successful === false) {
      throw new Error(typeof result.error === "string" ? result.error : "MOVE_FILE failed");
    }
    return true;
  } catch {
    return false;
  }
}

export type ClientUploadsDriveSyncResult = {
  alreadyStructured: boolean;
  foldersEnsured: number;
  filesAlreadyInPlace: number;
  filesMoved: number;
  filesUploaded: number;
  filesSkipped: number;
  errors: string[];
  message: string;
};

/**
 * Mirror client documents into:
 *   Client Uploads / {Category} / {Checklist Item} / {fileName}
 * Fast path: if every file is already in the target folder, only folder existence checks run.
 */
export async function syncClientUploadsDriveStructure(args: {
  clientFolderId: string;
  documents: Array<{
    id: string;
    documentId?: string | null;
    fileName?: string | null;
    mimeType?: string | null;
    localPath?: string | null;
    googleDriveFileId?: string | null;
  }>;
  /** When true, also create empty category/checklist folders for the full checklist. */
  scaffoldAllFolders?: boolean;
}): Promise<ClientUploadsDriveSyncResult> {
  const { buildDocumentLookup, listDataRoomFolderPairs, resolveClientUploadDrivePath, sanitizePathPart } =
    await import("@/lib/client-document-paths");
  const { buildPresignedFileUrl } = await import("@/lib/s3");

  const result: ClientUploadsDriveSyncResult = {
    alreadyStructured: false,
    foldersEnsured: 0,
    filesAlreadyInPlace: 0,
    filesMoved: 0,
    filesUploaded: 0,
    filesSkipped: 0,
    errors: [],
    message: "",
  };

  const uploads = await ensureFolder("Client Uploads", args.clientFolderId);
  result.foldersEnsured += 1;
  const folderCache = new Map<string, string>([[uploads.id, uploads.id]]);

  const lookup = buildDocumentLookup();
  const pairsNeeded = new Map<string, { category: string; checklistItem: string }>();

  for (const doc of args.documents) {
    const path = resolveClientUploadDrivePath({
      documentId: doc.documentId,
      fileName: doc.fileName,
      lookup,
    });
    pairsNeeded.set(`${path.category}/${path.checklistItem}`, {
      category: path.category,
      checklistItem: path.checklistItem,
    });
  }

  if (args.scaffoldAllFolders !== false) {
    // Only ensure top-level category folders (cheap). Checklist leaves are created
    // when a file for that slot exists or is uploaded.
    const categories = new Set(listDataRoomFolderPairs().map((p) => p.category));
    for (const category of Array.from(categories)) {
      await ensureFolderPath(uploads.id, [category], folderCache);
      result.foldersEnsured += 1;
    }
  }

  // Ensure expected folder tree (FIND is cheap when folders already exist).
  for (const pair of Array.from(pairsNeeded.values())) {
    await ensureFolderPath(uploads.id, [pair.category, pair.checklistItem], folderCache);
    result.foldersEnsured += 1;
  }

  // Index immediate children under Client Uploads (flat leftovers + category folders).
  const uploadsChildren = await listDriveChildren(uploads.id);
  const flatFiles = uploadsChildren.filter((c) => !c.isFolder);
  const categoryFolders = new Map(
    uploadsChildren.filter((c) => c.isFolder).map((c) => [c.name, c.id] as const),
  );

  // Cache checklist folders under each category we care about.
  for (const pair of Array.from(pairsNeeded.values())) {
    let categoryId = categoryFolders.get(pair.category);
    if (!categoryId) {
      categoryId = await ensureFolderPath(uploads.id, [pair.category], folderCache);
      categoryFolders.set(pair.category, categoryId);
    }
    const catKey = `${uploads.id}/${pair.category}`;
    folderCache.set(catKey, categoryId);
  }

  const checklistChildrenCache = new Map<string, DriveChild[]>();
  async function childrenOf(folderId: string) {
    if (!checklistChildrenCache.has(folderId)) {
      checklistChildrenCache.set(folderId, await listDriveChildren(folderId));
    }
    return checklistChildrenCache.get(folderId)!;
  }

  for (const doc of args.documents) {
    const path = resolveClientUploadDrivePath({
      documentId: doc.documentId,
      fileName: doc.fileName,
      lookup,
    });
    const targetFolderId = await ensureFolderPath(
      uploads.id,
      [path.category, path.checklistItem],
      folderCache,
    );

    try {
      const targetChildren = await childrenOf(targetFolderId);
      const inPlace = targetChildren.find((c) => !c.isFolder && c.name === path.fileName);
      if (inPlace) {
        result.filesAlreadyInPlace += 1;
        continue;
      }

      // Legacy names that may sit flat under Client Uploads.
      const legacyPrefixed = sanitizePathPart(
        `${doc.documentId || "document"} - ${doc.fileName || path.fileName}`,
      );
      const flatMatch =
        flatFiles.find((f) => f.name === path.fileName) ||
        flatFiles.find((f) => f.name === legacyPrefixed) ||
        flatFiles.find((f) => f.name === (doc.fileName || ""));

      if (flatMatch) {
        if (flatMatch.name === path.fileName) {
          const moved = await moveDriveFile(flatMatch.id, targetFolderId, uploads.id);
          if (moved) {
            result.filesMoved += 1;
            const idx = flatFiles.findIndex((f) => f.id === flatMatch.id);
            if (idx >= 0) flatFiles.splice(idx, 1);
            checklistChildrenCache.set(targetFolderId, [
              ...targetChildren,
              { ...flatMatch, name: path.fileName },
            ]);
            continue;
          }
        } else {
          // Legacy prefixed name — upload with correct name, then remove the flat leftover.
          if (!doc.localPath && !doc.googleDriveFileId) {
            result.filesSkipped += 1;
            result.errors.push(`${path.fileName}: missing storage path (legacy file found but cannot rename)`);
            continue;
          }
          const sourceUrl = doc.localPath
            ? await buildPresignedFileUrl(doc.localPath)
            : String(doc.googleDriveFileId);
          await uploadClientDocumentToDrive({
            folderId: targetFolderId,
            fileName: path.fileName,
            mimeType: doc.mimeType || undefined,
            sourceUrl,
            skipExistingCheck: true,
          });
          await executeGoogleDriveTool("GOOGLEDRIVE_DELETE_FILE", { file_id: flatMatch.id }).catch(() => null);
          result.filesUploaded += 1;
          const idx = flatFiles.findIndex((f) => f.id === flatMatch.id);
          if (idx >= 0) flatFiles.splice(idx, 1);
          checklistChildrenCache.set(targetFolderId, [
            ...targetChildren,
            { id: `uploaded-${doc.id}`, name: path.fileName, isFolder: false },
          ]);
          continue;
        }
        // Move unsupported for correctly named flat file — fall through to re-upload.
      }

      // Also check wrong checklist folder under same category (rare).
      const categoryId = categoryFolders.get(path.category);
      if (categoryId) {
        const siblingFolders = (await childrenOf(categoryId)).filter((c) => c.isFolder);
        let relocated = false;
        for (const sibling of siblingFolders) {
          if (sibling.id === targetFolderId) continue;
          const siblingFiles = await childrenOf(sibling.id);
          const wrongPlace = siblingFiles.find((f) => !f.isFolder && (f.name === path.fileName || f.name === legacyPrefixed));
          if (!wrongPlace) continue;
          const moved = await moveDriveFile(wrongPlace.id, targetFolderId, sibling.id);
          if (moved) {
            result.filesMoved += 1;
            checklistChildrenCache.set(
              sibling.id,
              siblingFiles.filter((f) => f.id !== wrongPlace.id),
            );
            checklistChildrenCache.set(targetFolderId, [...targetChildren, wrongPlace]);
            relocated = true;
            break;
          }
        }
        if (relocated) continue;
      }

      if (!doc.localPath && !doc.googleDriveFileId) {
        result.filesSkipped += 1;
        result.errors.push(`${path.fileName}: missing storage path`);
        continue;
      }

      const sourceUrl = doc.localPath
        ? await buildPresignedFileUrl(doc.localPath)
        : String(doc.googleDriveFileId);

      await uploadClientDocumentToDrive({
        folderId: targetFolderId,
        fileName: path.fileName,
        mimeType: doc.mimeType || undefined,
        sourceUrl,
        skipExistingCheck: true,
      });
      result.filesUploaded += 1;
      checklistChildrenCache.set(targetFolderId, [
        ...targetChildren,
        { id: `uploaded-${doc.id}`, name: path.fileName, isFolder: false },
      ]);
    } catch (error) {
      result.errors.push(
        `${doc.fileName || doc.id}: ${error instanceof Error ? error.message : "sync failed"}`,
      );
    }
  }

  result.alreadyStructured =
    result.filesUploaded === 0 &&
    result.filesMoved === 0 &&
    result.errors.length === 0 &&
    result.filesAlreadyInPlace === args.documents.length;

  if (result.alreadyStructured) {
    result.message = `Already structured — ${result.filesAlreadyInPlace} file(s) in place.`;
  } else {
    result.message = [
      `Synced ${args.documents.length} document(s):`,
      `${result.filesAlreadyInPlace} already in place`,
      `${result.filesMoved} moved`,
      `${result.filesUploaded} uploaded`,
      result.errors.length ? `${result.errors.length} error(s)` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  return result;
}

/** Resolve nested Client Uploads / Category / Checklist folder for a new upload. */
export async function ensureClientUploadDocumentFolder(args: {
  clientFolderId: string;
  documentId?: string | null;
  fileName?: string | null;
}) {
  const { resolveClientUploadDrivePath } = await import("@/lib/client-document-paths");
  const uploads = await ensureFolder("Client Uploads", args.clientFolderId);
  const path = resolveClientUploadDrivePath({
    documentId: args.documentId,
    fileName: args.fileName,
  });
  const folderId = await ensureFolderPath(uploads.id, [path.category, path.checklistItem]);
  return { folderId, ...path, uploadsFolderId: uploads.id };
}

export async function uploadClientDocumentToDrive(args: {
  folderId: string;
  fileName: string;
  mimeType?: string;
  sourceUrl: string;
  skipExistingCheck?: boolean;
}) {
  const connection = await getGoogleDriveConnection();
  if (!connection || connection.status !== "ACTIVE" || connection.is_disabled) {
    console.warn(`[Composio] No active Drive connection found for the configured entity; attempting the Drive action directly.`);
  }
  if (!args.skipExistingCheck && await fileExistsInFolder(args.fileName, args.folderId)) return { skipped: true, reason: "exists" };

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

  const details = await executeGoogleDriveTool<any>("GOOGLEDRIVE_GET_FILE_METADATA", {
    fileId,
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

function driveFolderId(value: string) {
  const match = value.match(/\/folders\/([^/?#]+)/)
  return match?.[1] || (value.match(/^[a-zA-Z0-9_-]{10,}$/)?.[0] ?? null)
}

export async function createPublicEditableGoogleDoc(args: {
  folderUrl: string
  fileName: string
  html: string
  /** Optional nested folders under folderUrl, e.g. ["Pre-Call Briefs", "Bass Pet Resort"] */
  nestedFolders?: string[]
}) {
  const rootFolderId = driveFolderId(args.folderUrl)
  if (!rootFolderId) throw new Error('Google Drive brief folder is not configured.')
  assertS3Configured()
  let folderId = rootFolderId
  if (args.nestedFolders?.length) {
    folderId = await ensureFolderPath(
      rootFolderId,
      args.nestedFolders.map((part) =>
        part.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120) || 'untitled',
      ),
    )
  }
  const safeName = args.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const key = `drive-sync/pre-call-briefs/${Date.now()}-${safeName}.html`
  await s3Client.send(new PutObjectCommand({
    Bucket: s3BucketName,
    Key: key,
    Body: args.html,
    ContentType: 'text/html; charset=utf-8',
  }))
  // Drive converts the HTML into a native, editable Google Doc. This deliberately
  // uses the Drive toolkit—the same connected account used by the folder picker.
  const result = await uploadClientDocumentToDrive({
    folderId,
    fileName: args.fileName,
    mimeType: 'application/vnd.google-apps.document',
    sourceUrl: await buildPresignedFileUrl(key),
    skipExistingCheck: true,
  })
  const fileId = extractDriveFileId((result as any)?.data ?? result)
  if (!fileId) throw new Error('Google Drive did not return a document id.')
  await executeGoogleDriveTool('GOOGLEDRIVE_CREATE_PERMISSION', {
    file_id: fileId,
    role: 'writer',
    type: 'anyone',
  })
  const details = await executeGoogleDriveTool<any>('GOOGLEDRIVE_GET_FILE_METADATA', {
    fileId,
    fields: 'id,name,webViewLink,webContentLink',
  }).catch(() => null)
  return {
    fileId,
    webViewLink: details?.data?.webViewLink ?? (details as any)?.webViewLink ?? `https://drive.google.com/open?id=${fileId}`,
  }
}
