import { prisma } from "@/lib/prisma";

const DRIVE_PARENT_FOLDER_KEY = "google_drive_parent_folder_url";

export async function getDriveParentFolder() {
  const row = await prisma.appSecret.findUnique({
    where: { key: DRIVE_PARENT_FOLDER_KEY },
  });
  return row?.value || "";
}

export async function saveDriveParentFolder(folderUrl: string) {
  const trimmed = folderUrl.trim();
  if (!trimmed) throw new Error("Drive parent folder is required");
  await prisma.appSecret.upsert({
    where: { key: DRIVE_PARENT_FOLDER_KEY },
    update: { value: trimmed },
    create: { key: DRIVE_PARENT_FOLDER_KEY, value: trimmed },
  });
  return trimmed;
}

export async function getDriveParentFolderId() {
  const value = await getDriveParentFolder()
  const match = value.match(/\/folders\/([^/?#]+)/)
  return match?.[1] || null
}
