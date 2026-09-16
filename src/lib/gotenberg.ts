/**
 * Thin Gotenberg client for PDF merge.
 * Defaults to http://127.0.0.1:3100 (dev maps host 3100 → container 3000
 * so it does not clash with Next.js on 3000).
 */
export function getGotenbergBaseUrl(): string {
  return (
    process.env.GOTENBERG_URL ||
    process.env.GOTENBERG_BASE_URL ||
    "http://127.0.0.1:3100"
  ).replace(/\/$/, "");
}

export async function isGotenbergHealthy(baseUrl = getGotenbergBaseUrl()): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(2500) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Merge PDFs via Gotenberg `/forms/pdfengines/merge`.
 * Files are sent with alphanumeric-safe filenames so merge order is stable.
 */
export async function mergePdfsWithGotenberg(
  files: Array<{ fileName: string; buffer: Buffer }>,
  options?: { baseUrl?: string; outputFileName?: string },
): Promise<Buffer> {
  if (!files.length) throw new Error("No PDF files provided to Gotenberg merge");
  if (files.length === 1) return files[0].buffer;

  const baseUrl = options?.baseUrl ?? getGotenbergBaseUrl();
  const form = new FormData();

  const sorted = [...files].sort((a, b) =>
    a.fileName.localeCompare(b.fileName, undefined, { numeric: true, sensitivity: "base" }),
  );

  sorted.forEach((file, index) => {
    const safeName = `${String(index + 1).padStart(3, "0")}_${file.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const bytes = new Uint8Array(file.buffer);
    form.append("files", new Blob([bytes], { type: "application/pdf" }), safeName);
  });

  if (options?.outputFileName) {
    form.append("Gotenberg-Output-Filename", options.outputFileName.replace(/\.pdf$/i, ""));
  }

  const res = await fetch(`${baseUrl}/forms/pdfengines/merge`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gotenberg merge failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}
