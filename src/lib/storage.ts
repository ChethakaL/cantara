import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "uploads");

function sanitizeFilename(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function persistUpload({
  clientId,
  originalName,
  buffer,
}: {
  clientId: string;
  originalName: string;
  buffer: Buffer;
}) {
  const ext = path.extname(originalName);
  const base = sanitizeFilename(path.basename(originalName, ext));
  const finalName = `${base}_${randomUUID()}${ext}`;
  const clientDir = path.join(STORAGE_ROOT, clientId);

  await mkdir(clientDir, { recursive: true });

  const fullPath = path.join(clientDir, finalName);
  await writeFile(fullPath, buffer);

  return {
    relativePath: path.relative(process.cwd(), fullPath),
    savedName: finalName,
  };
}

export async function readStoredFile(relativePath: string) {
  const resolved = path.join(process.cwd(), relativePath);

  if (!resolved.startsWith(STORAGE_ROOT)) {
    throw new Error("Invalid path");
  }

  const content = await readFile(resolved);
  return content;
}

export async function deleteStoredFile(relativePath: string) {
  const resolved = path.join(process.cwd(), relativePath);

  if (!resolved.startsWith(STORAGE_ROOT)) {
    throw new Error("Invalid path");
  }

  await unlink(resolved);
}
