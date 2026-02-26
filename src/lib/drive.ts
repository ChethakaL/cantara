import type { Prisma } from "@prisma/client";
import { drive_v3, google } from "googleapis";
import { Readable } from "node:stream";
import { prisma } from "@/lib/prisma";

const GOOGLE_DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
];

function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ??
    (process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/admin/google-drive/callback`
      : "http://localhost:3000/api/admin/google-drive/callback");

  if (!clientId || !clientSecret) {
    throw new Error(
      "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
    );
  }

  return { clientId, clientSecret, redirectUri };
}

function createGoogleOAuthClient() {
  const config = getGoogleOAuthConfig();
  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
}

function buildTokenUpdate(tokens: {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
}) {
  const data: Prisma.UserUpdateInput = {};

  if (tokens.access_token) {
    data.googleAccessToken = tokens.access_token;
  }

  if (tokens.refresh_token) {
    data.googleRefreshToken = tokens.refresh_token;
  }

  if (typeof tokens.expiry_date === "number") {
    data.googleTokenExpiry = new Date(tokens.expiry_date);
  }

  return data;
}

async function getDriveClientForAdmin(adminUserId: string) {
  const admin = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: {
      id: true,
      googleAccessToken: true,
      googleRefreshToken: true,
      googleTokenExpiry: true,
      googleDriveRootFolderId: true,
      googleDriveRootFolderName: true,
    },
  });

  if (!admin) {
    throw new Error("Admin account not found");
  }

  if (!admin.googleRefreshToken && !admin.googleAccessToken) {
    throw new Error("Google Drive not connected. Connect it from the admin portal first.");
  }

  const oauthClient = createGoogleOAuthClient();

  oauthClient.setCredentials({
    access_token: admin.googleAccessToken ?? undefined,
    refresh_token: admin.googleRefreshToken ?? undefined,
    expiry_date: admin.googleTokenExpiry ? admin.googleTokenExpiry.getTime() : undefined,
  });

  oauthClient.on("tokens", (tokens) => {
    const data = buildTokenUpdate(tokens);

    if (Object.keys(data).length === 0) {
      return;
    }

    void prisma.user.update({
      where: { id: adminUserId },
      data,
    });
  });

  return {
    drive: google.drive({ version: "v3", auth: oauthClient }),
    admin,
  };
}

async function createFolder(drive: drive_v3.Drive, name: string, parentId: string) {
  const response = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id,name",
    supportsAllDrives: true,
  });

  if (!response.data.id) {
    throw new Error("Could not create Google Drive folder");
  }

  return response.data.id;
}

export function getGoogleDriveRedirectUri() {
  return getGoogleOAuthConfig().redirectUri;
}

export function createGoogleDriveConsentUrl(state: string) {
  const oauthClient = createGoogleOAuthClient();

  return oauthClient.generateAuthUrl({
    access_type: "offline",
    include_granted_scopes: true,
    prompt: "consent",
    scope: GOOGLE_DRIVE_SCOPES,
    state,
  });
}

export async function exchangeGoogleCodeForTokens(code: string) {
  const oauthClient = createGoogleOAuthClient();
  const result = await oauthClient.getToken(code);
  return result.tokens;
}

export async function listDriveFoldersForAdmin(adminUserId: string) {
  const { drive } = await getDriveClientForAdmin(adminUserId);

  const response = await drive.files.list({
    q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    fields: "files(id,name)",
    orderBy: "name_natural",
    pageSize: 200,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  return (response.data.files ?? [])
    .filter((file): file is { id: string; name: string } => Boolean(file.id && file.name))
    .map((file) => ({
      id: file.id,
      name: file.name,
    }));
}

export async function validateDriveFolderForAdmin(adminUserId: string, folderId: string) {
  if (folderId === "root") {
    return {
      id: "root",
      name: "My Drive",
    };
  }

  const { drive } = await getDriveClientForAdmin(adminUserId);

  const response = await drive.files.get({
    fileId: folderId,
    fields: "id,name,mimeType,trashed",
    supportsAllDrives: true,
  });

  if (!response.data.id || !response.data.name) {
    throw new Error("Selected folder was not found");
  }

  if (response.data.mimeType !== "application/vnd.google-apps.folder") {
    throw new Error("Selected item is not a folder");
  }

  if (response.data.trashed) {
    throw new Error("Selected folder is in trash");
  }

  return {
    id: response.data.id,
    name: response.data.name,
  };
}

export async function uploadToClientDriveFolder({
  adminUserId,
  clientName,
  existingFolderId,
  fileName,
  mimeType,
  fileBuffer,
}: {
  adminUserId: string;
  clientName: string;
  existingFolderId?: string | null;
  fileName: string;
  mimeType: string;
  fileBuffer: Buffer;
}) {
  const { drive, admin } = await getDriveClientForAdmin(adminUserId);

  const rootFolderId = admin.googleDriveRootFolderId ?? "root";

  const folderId =
    existingFolderId ?? (await createFolder(drive, clientName, rootFolderId));

  const upload = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: Readable.from(fileBuffer),
    },
    fields: "id,name,webViewLink",
    supportsAllDrives: true,
  });

  if (!upload.data.id) {
    throw new Error("Failed to upload file to Google Drive");
  }

  return {
    folderId,
    fileId: upload.data.id,
    webViewLink: upload.data.webViewLink,
  };
}
