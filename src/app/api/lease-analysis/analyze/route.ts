import Anthropic, {
  APIConnectionError,
  APIConnectionTimeoutError,
  InternalServerError,
  RateLimitError,
} from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { buildLeaseAnalysisSystemPrompt } from "@/lib/lease-analysis/prompt";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse") as {
  PDFParse: new (args: { data: Buffer }) => {
    getText: () => Promise<{ text?: string; total?: number }>;
    destroy: () => Promise<void>;
  };
};

export const maxDuration = 300; // 5 min — large PDFs need time

const MAX_UPSTREAM_ATTEMPTS = 3;
const UPSTREAM_RETRY_DELAYS_MS = [1000, 2500];
const MAX_DOCUMENTS = 10;
const MAX_PDF_BYTES = 32 * 1024 * 1024;
const MAX_UPSTREAM_PDF_PAGES = 100;
const LOW_TEXT_CHARS_PER_PAGE = 100;
type LeaseMessageStream = AsyncIterable<any> & { controller: { abort: () => void } };

type LeaseInputDocument = {
  name?: string;
  base64?: string;
  mediaType?: string;
  sizeBytes?: number;
};

type PdfReadability = {
  name: string;
  pages: number | null;
  sizeBytes: number;
  readableChars: number;
  charsPerPage: number | null;
  status: "text-searchable" | "scanned-or-low-text" | "unknown";
  note: string;
  extractedText: string;
};

export async function POST(req: NextRequest) {
  try {
    const { documents } = await req.json();

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
        return new Response("No documents provided", { status: 400 });
    }

    if (documents.length > MAX_DOCUMENTS) {
      return new Response(`Maximum ${MAX_DOCUMENTS} documents per analysis.`, { status: 400 });
    }

    const normalizedDocuments = documents as LeaseInputDocument[];
    for (const doc of normalizedDocuments) {
      const sizeBytes = Number(doc.sizeBytes ?? estimateBase64Bytes(doc.base64 ?? ""));
      if (!doc.base64 || typeof doc.base64 !== "string") {
        return new Response(`Missing PDF data for ${doc.name || "uploaded document"}.`, { status: 400 });
      }
      if (sizeBytes > MAX_PDF_BYTES) {
        return new Response(`File ${doc.name || "uploaded document"} exceeds 32MB limit.`, { status: 400 });
      }
    }

    const client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    });

    console.log(`[API Analyze] Starting streaming analysis for ${documents.length} documents.`);
    const systemPrompt = buildLeaseAnalysisSystemPrompt(new Date());
    const readability = await Promise.all(normalizedDocuments.map(inspectPdfReadability));
    const pdfBlockPages = readability.reduce((sum, item) => (
      shouldSendAsPdfBlock(item) ? sum + (item.pages ?? MAX_UPSTREAM_PDF_PAGES + 1) : sum
    ), 0);

    if (pdfBlockPages > MAX_UPSTREAM_PDF_PAGES) {
      return new Response(
        `Lease analysis can visually inspect up to ${MAX_UPSTREAM_PDF_PAGES} scanned/low-text PDF pages per run. This upload has ${pdfBlockPages} scanned/low-text PDF pages after text extraction. Please split the scanned PDFs into smaller runs or OCR them before upload.`,
        { status: 400 },
      );
    }

    // Build the content array: one document block per PDF + instruction text
    // Note: Anthropic's document support requires specific block structure
    const userContent: any[] = [
      {
        type: "text",
        text: buildDocumentManifest(readability),
      },
      ...normalizedDocuments.map((doc, index) => buildDocumentContentBlock(doc, readability[index], index)),
      {
        type: "text",
        text: `Please analyze the ${documents.length} lease document(s) provided above. 
               Produce the full analysis report as specified in your instructions. 
               Document names for reference: ${normalizedDocuments.map((d) => d.name).join(", ")}

               Critical extraction instruction: some uploaded PDFs may be scanned or have a weak/empty text layer.
               If the manifest marks a document as scanned-or-low-text, visually inspect that PDF's rendered pages,
               signature blocks, notary pages, rent tables, and date confirmations. Do not treat a weak text layer as
               a missing or blank document. If a visually readable scanned page contains operative lease terms, extract
               them and cite the document title and visible section/page context. Text-searchable PDFs are provided as
               extracted text to stay under the upstream PDF page limit; cite those by document title and section labels
               visible in the extracted text.`,
      },
    ];

    let activeStream: LeaseMessageStream | null = null;

    // Pipe Anthropic stream to Next.js Response
    const readableStream = new ReadableStream({
      async start(controller) {
        let fullResponse = "";
        for (let attempt = 1; attempt <= MAX_UPSTREAM_ATTEMPTS; attempt += 1) {
          let sawText = false;

          try {
            activeStream = await client.messages.stream({
              model: "claude-sonnet-4-20250514", // Exactly as specified in architecture.md
              max_tokens: 16000,
              temperature: 0,
              system: systemPrompt,
              messages: [{ role: "user", content: userContent }],
            });

            for await (const chunk of activeStream) {
              if (
                chunk.type === "content_block_delta" &&
                chunk.delta.type === "text_delta"
              ) {
                const text = chunk.delta.text;
                sawText = true;
                fullResponse += text;
                controller.enqueue(new TextEncoder().encode(text));
              }
            }

            console.log("[API Analyze] Claude response complete. Total length:", fullResponse.length);
            console.log("[API Analyze] FULL RESPONSE:\n", fullResponse);
            controller.close();
            return;
          } catch (error) {
            activeStream?.controller.abort();
            activeStream = null;

            const shouldRetry =
              !sawText &&
              attempt < MAX_UPSTREAM_ATTEMPTS &&
              isRetryableLeaseAnalysisError(error);

            console.error(`[API Analyze] Attempt ${attempt} failed:`, error);

            if (!shouldRetry) {
              controller.error(error instanceof Error ? error : new Error(String(error)));
              return;
            }

            await delay(UPSTREAM_RETRY_DELAYS_MS[attempt - 1] ?? 3000);
          }
        }
      },
      cancel() {
        console.log("[API Analyze] Stream cancelled by client.");
        activeStream?.controller.abort();
      }
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Accel-Buffering": "no", // disables nginx buffering for true streaming
      },
    });
  } catch (error: any) {
    console.error("[API Analyze Error]:", error);
    return NextResponse.json(
      { error: formatLeaseAnalysisError(error) },
      { status: isRetryableLeaseAnalysisError(error) ? 503 : 500 },
    );
  }
}

async function inspectPdfReadability(doc: LeaseInputDocument): Promise<PdfReadability> {
  const name = doc.name || "uploaded document";
  const base64 = doc.base64 ?? "";
  const sizeBytes = Number(doc.sizeBytes ?? estimateBase64Bytes(base64));
  const parser = new PDFParse({ data: Buffer.from(base64, "base64") });

  try {
    const result = await parser.getText();
    const pages = typeof result.total === "number" && Number.isFinite(result.total) ? result.total : null;
    const readableChars = countReadableChars(result.text ?? "");
    const charsPerPage = pages && pages > 0 ? Math.round(readableChars / pages) : null;
    const status =
      charsPerPage === null
        ? "unknown"
        : charsPerPage < LOW_TEXT_CHARS_PER_PAGE
          ? "scanned-or-low-text"
          : "text-searchable";

    return {
      name,
      pages,
      sizeBytes,
      readableChars,
      charsPerPage,
      status,
      note:
        status === "scanned-or-low-text"
          ? "PDF text layer is weak or absent. The lease analyzer must read this document visually from rendered pages."
          : status === "text-searchable"
            ? "PDF has a usable text layer."
            : "PDF text layer could not be confidently measured. The lease analyzer must inspect rendered pages if text is incomplete.",
      extractedText: result.text ?? "",
    };
  } catch (error) {
    console.warn(`[API Analyze] PDF readability inspection failed for ${name}:`, error);
    return {
      name,
      pages: null,
      sizeBytes,
      readableChars: 0,
      charsPerPage: null,
      status: "unknown",
      note: "PDF readability inspection failed. The lease analyzer must inspect rendered pages and should not assume the document is blank.",
      extractedText: "",
    };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

function buildDocumentContentBlock(doc: LeaseInputDocument, readability: PdfReadability, index: number) {
  const title = doc.name || `Lease document ${index + 1}`;

  if (!shouldSendAsPdfBlock(readability)) {
    return {
      type: "text",
      text: [
        `=== DOCUMENT ${index + 1}: ${title} ===`,
        `Source handling: server-side text extraction from text-searchable PDF.`,
        `Pages: ${readability.pages ?? "unknown"}. Size: ${formatBytes(readability.sizeBytes)}.`,
        `Readability: ${readability.status}; ${readability.readableChars} readable characters.`,
        "",
        readability.extractedText.trim() || "[No readable text extracted from this PDF.]",
        "",
        `=== END DOCUMENT ${index + 1}: ${title} ===`,
      ].join("\n"),
    };
  }

  return {
    type: "document",
    title,
    context: buildDocumentContext(readability),
    citations: { enabled: true },
    source: {
      type: "base64",
      media_type: doc.mediaType || "application/pdf",
      data: doc.base64,
    },
  };
}

function shouldSendAsPdfBlock(readability: PdfReadability) {
  return readability.status !== "text-searchable";
}

function buildDocumentManifest(readability: PdfReadability[]) {
  const rows = readability
    .map((doc, index) => {
      const pages = doc.pages === null ? "unknown" : String(doc.pages);
      const charsPerPage = doc.charsPerPage === null ? "unknown" : String(doc.charsPerPage);
      return `${index + 1}. ${doc.name} — ${pages} page(s), ${formatBytes(doc.sizeBytes)}, text status: ${doc.status}, readable chars/page: ${charsPerPage}. ${doc.note}`;
    })
    .join("\n");

  return `DOCUMENT READABILITY MANIFEST

Use this manifest to avoid missing scanned lease documents. A scanned-or-low-text document is not blank; it needs visual PDF review.

${rows}`;
}

function buildDocumentContext(readability?: PdfReadability) {
  if (!readability) return null;

  return [
    `Uploaded file name: ${readability.name}.`,
    `Readability status: ${readability.status}.`,
    readability.pages === null ? "Page count unknown." : `Page count: ${readability.pages}.`,
    readability.note,
    "Analyze this file as part of the unified lease package and cite it by this title.",
  ].join(" ");
}

function countReadableChars(text: string) {
  return text
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, "")
    .replace(/\s+/g, "")
    .replace(/[^A-Za-z0-9$%.,:/#-]/g, "")
    .length;
}

function estimateBase64Bytes(base64: string) {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function isRetryableLeaseAnalysisError(error: unknown) {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: number }).status)
      : undefined;
  const message = error instanceof Error ? error.message : String(error);

  return (
    error instanceof APIConnectionError ||
    error instanceof APIConnectionTimeoutError ||
    error instanceof RateLimitError ||
    error instanceof InternalServerError ||
    status === 408 ||
    status === 429 ||
    (typeof status === "number" && status >= 500) ||
    /network error|connection error|fetch failed|timeout|socket hang up|econnreset/i.test(message)
  );
}

function formatLeaseAnalysisError(error: unknown) {
  const message = error instanceof Error ? error.message : "Lease analysis failed.";

  if (isRetryableLeaseAnalysisError(error)) {
    return `Transient upstream connection error while running lease analysis. ${message}`;
  }

  return message;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
