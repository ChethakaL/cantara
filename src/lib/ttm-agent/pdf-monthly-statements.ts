/**
 * PDF monthly P&L / BS support for WS2-1.
 *
 * Excel/GL path stays preferred. This module is only used when a slot has
 * PDF sources and no Excel for that same documentId.
 */
import { PDFDocument } from "pdf-lib";
import { getActiveAgentModelId, getActiveAgentProvider } from "@/lib/agent-llm-context";
import { requireAIClient, resolveModel } from "@/lib/ai-client";
import { createAgentMessage } from "@/lib/llm-completion";
import type { ExtractedFinancials } from "@/lib/ttm-agent/llm-extraction";
import { CANTARA_TAXONOMY, type TaxonomyEntry } from "@/lib/ttm-agent/taxonomy";
import type {
  NormalizedLedgerRow,
  ParsedMonthlyWorkbook,
  TtmRequiredDocumentId,
} from "@/lib/ttm-agent/types";

export type MonthlyStatementKind = "excel" | "pdf" | "other";

export type ClientDocumentLike = {
  id: string;
  documentId: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  localPath: string;
  createdAt: Date;
  storageBucket?: string | null;
};

export type ResolvedMonthlySlot = {
  documentId: Extract<TtmRequiredDocumentId, "monthly_pl_excel" | "monthly_bs_excel">;
  kind: MonthlyStatementKind;
  /** Preferred single record (latest Excel if any, else latest PDF, else latest). */
  primary: ClientDocumentLike;
  /** All records of the preferred kind (Excel set or PDF set). */
  sources: ClientDocumentLike[];
};

export type PdfLedgerExtraction = {
  monthKeys: string[];
  rows: Array<{
    accountName: string;
    accountCode: string | null;
    valuesByMonth: Record<string, number>;
    total?: number;
  }>;
  notes?: string[];
};

export type PdfMonthlyExtractionResult = {
  financials: ExtractedFinancials;
  monthlyPl: PdfLedgerExtraction;
  monthlyBs: PdfLedgerExtraction;
};

const PDF_EXTRACT_MAX_TOKENS = 32000;

function buildTaxonomyReference(): string {
  const lines: string[] = ["CANTARA TAXONOMY CODES:", ""];
  const grouped: Record<string, TaxonomyEntry[]> = {};
  for (const entry of CANTARA_TAXONOMY) {
    const key = entry.type;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(entry);
  }
  for (const [type, entries] of Object.entries(grouped)) {
    lines.push(`## ${type.toUpperCase()}`);
    for (const e of entries) {
      const addback = e.addBack ? " [ADD-BACK]" : "";
      lines.push(`  ${e.code} — ${e.category}${addback}`);
      lines.push(`    aliases: ${e.aliases.join(", ")}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function isExcelDocument(doc: Pick<ClientDocumentLike, "fileName" | "mimeType">): boolean {
  const mime = String(doc.mimeType || "").toLowerCase();
  const name = String(doc.fileName || "").toLowerCase();
  return (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls")
  );
}

export function isPdfDocument(doc: Pick<ClientDocumentLike, "fileName" | "mimeType">): boolean {
  const mime = String(doc.mimeType || "").toLowerCase();
  const name = String(doc.fileName || "").toLowerCase();
  return mime.includes("pdf") || name.endsWith(".pdf");
}

export function resolveMonthlySlot(
  documentId: Extract<TtmRequiredDocumentId, "monthly_pl_excel" | "monthly_bs_excel">,
  rows: ClientDocumentLike[],
): ResolvedMonthlySlot {
  if (!rows.length) {
    throw new Error(`Missing required valuation documents: ${documentId}`);
  }

  const excelRows = rows.filter(isExcelDocument);
  if (excelRows.length) {
    const sorted = [...excelRows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return {
      documentId,
      kind: "excel",
      primary: sorted[sorted.length - 1],
      sources: [sorted[sorted.length - 1]],
    };
  }

  const pdfRows = rows.filter(isPdfDocument);
  if (pdfRows.length) {
    const sorted = [...pdfRows].sort((a, b) =>
      a.fileName.localeCompare(b.fileName, undefined, { numeric: true, sensitivity: "base" }),
    );
    return {
      documentId,
      kind: "pdf",
      primary: sorted[sorted.length - 1],
      sources: sorted,
    };
  }

  const sorted = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return {
    documentId,
    kind: "other",
    primary: sorted[sorted.length - 1],
    sources: [sorted[sorted.length - 1]],
  };
}

/** Merge PDFs in the given order (caller should sort filenames first). */
export async function mergePdfBuffers(buffers: Buffer[]): Promise<Buffer> {
  if (!buffers.length) {
    throw new Error("No PDF buffers to merge");
  }
  if (buffers.length === 1) return buffers[0];

  const merged = await PDFDocument.create();
  for (const buffer of buffers) {
    const src = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const pages = await merged.copyPages(src, src.getPageIndices());
    for (const page of pages) merged.addPage(page);
  }
  const bytes = await merged.save();
  return Buffer.from(bytes);
}

function parseJsonPayload<T>(text: string): T {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    }
    throw new Error(`Model did not return valid JSON (starts with: ${cleaned.slice(0, 80)})`);
  }
}

const PDF_MONTHLY_SYSTEM_PROMPT = `You are a senior M&A financial analyst at Cantara Pet Advisors.

You will receive merged monthly Profit & Loss and Balance Sheet PDFs (often many months concatenated).

CRITICAL RULES:
- Many PDFs will NOT include GL/account codes. That is OK. Use account names only and map names to Cantara taxonomy codes.
- Prefer reading numbers from the attached PDFs directly. Do not invent months or accounts that are not present.
- Identify the most recent 3 complete fiscal years when possible (FY1 oldest → FY3 newest).
- TTM = trailing 12 consecutive months from the latest month with data.
- monthKeys must be YYYY-MM.
- Include detail account rows (not only totals). Skip pure section headers with no amounts.
- valuesByMonth should only include months that appear in that row. Missing months = omit or 0.
- Map every account name to a Cantara taxonomy code when possible. If unsure, closest match with confidence < 0.7.
- Include extraordinary revenue (PPP, EIDL, insurance proceeds, etc.) in revenue totals AND list them in extraordinaryRevenue.

${buildTaxonomyReference()}

OUTPUT FORMAT:
Return ONLY valid JSON (no markdown fences, no preamble). The first character must be "{" and the last must be "}". Match:

{
  "financials": {
    "periods": [{ "label": "FY1 (Jan 2023 - Dec 2023)", "startMonth": "2023-01", "endMonth": "2023-12" }],
    "ttmPeriod": { "startMonth": "2024-08", "endMonth": "2025-07" },
    "annualData": [{
      "period": "FY1",
      "revenue": 0,
      "cogs": 0,
      "grossProfit": 0,
      "totalOpEx": 0,
      "netIncome": 0,
      "revenueBreakdown": [{ "category": "Boarding Revenue", "amount": 0 }],
      "expenseBreakdown": [{ "category": "Staff Wages", "amount": 0, "cantaraCode": "OPX-LABOR-STAFF" }]
    }],
    "ttmData": { "revenue": 0, "cogs": 0, "grossProfit": 0, "totalOpEx": 0, "netIncome": 0 },
    "glMapping": [{ "accountName": "Boarding Income", "cantaraCode": "REV-BOARD", "confidence": 0.95 }],
    "extraordinaryRevenue": [],
    "notes": ["observations"]
  },
  "monthlyPl": {
    "monthKeys": ["2023-01", "2023-02"],
    "rows": [{
      "accountName": "Boarding Income",
      "accountCode": null,
      "valuesByMonth": { "2023-01": 1000, "2023-02": 1100 },
      "total": 2100
    }],
    "notes": []
  },
  "monthlyBs": {
    "monthKeys": ["2023-01", "2023-02"],
    "rows": [{
      "accountName": "Cash",
      "accountCode": null,
      "valuesByMonth": { "2023-01": 5000 },
      "total": 5000
    }],
    "notes": []
  }
}`;

export async function extractMonthlyStatementsFromMergedPdfs(args: {
  plFileName: string;
  plPdfBase64: string;
  bsFileName: string;
  bsPdfBase64: string;
}): Promise<PdfMonthlyExtractionResult> {
  const userText =
    "Extract structured monthly ledgers and annual/TTM financials from the attached merged P&L and Balance Sheet PDFs. Account codes may be missing — map by account name. Reply with JSON only. Do not write any explanation before or after the JSON.";

  const provider = getActiveAgentProvider();
  let text = "";

  if (provider === "openai") {
    text = await createAgentMessage({
      provider,
      model: getActiveAgentModelId(),
      system: PDF_MONTHLY_SYSTEM_PROMPT,
      content: [
        {
          type: "document",
          title: args.plFileName,
          source: { type: "base64", media_type: "application/pdf", data: args.plPdfBase64 },
        },
        {
          type: "document",
          title: args.bsFileName,
          source: { type: "base64", media_type: "application/pdf", data: args.bsPdfBase64 },
        },
        { type: "text", text: userText },
      ],
      maxTokens: PDF_EXTRACT_MAX_TOKENS,
      temperature: 0,
    });
  } else {
    const client = await requireAIClient();
    // Large dual-PDF extraction can exceed the SDK's non-streaming 10-minute limit.
    const stream = client.messages.stream({
      model: resolveModel(getActiveAgentModelId()),
      max_tokens: PDF_EXTRACT_MAX_TOKENS,
      temperature: 0,
      system: PDF_MONTHLY_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: args.plPdfBase64,
              },
            },
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: args.bsPdfBase64,
              },
            },
            { type: "text", text: userText },
          ],
        },
      ],
    });

    const parts: string[] = [];
    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
        parts.push(chunk.delta.text);
      }
    }
    text = parts.join("");
    if (!text.trim()) {
      const finalMessage = await stream.finalMessage();
      text = finalMessage.content[0]?.type === "text" ? finalMessage.content[0].text : "";
    }
  }

  const parsed = parseJsonPayload<PdfMonthlyExtractionResult>(text);
  if (!parsed?.financials || !parsed?.monthlyPl || !parsed?.monthlyBs) {
    throw new Error("PDF monthly extraction missing financials/monthlyPl/monthlyBs");
  }
  if (!Array.isArray(parsed.financials.periods) || !Array.isArray(parsed.financials.annualData)) {
    throw new Error("PDF monthly extraction financials missing periods/annualData");
  }
  if (!Array.isArray(parsed.monthlyPl.monthKeys) || !Array.isArray(parsed.monthlyPl.rows)) {
    throw new Error("PDF monthly extraction monthlyPl invalid");
  }
  if (!Array.isArray(parsed.monthlyBs.monthKeys) || !Array.isArray(parsed.monthlyBs.rows)) {
    throw new Error("PDF monthly extraction monthlyBs invalid");
  }
  return parsed;
}

function normalizeLedgerRows(
  rows: PdfLedgerExtraction["rows"],
  _fallbackMonthKeys: string[],
): NormalizedLedgerRow[] {
  return rows
    .map((row, index) => {
      const valuesByMonth: Record<string, number> = {};
      const source = row.valuesByMonth && typeof row.valuesByMonth === "object" ? row.valuesByMonth : {};
      for (const [key, value] of Object.entries(source)) {
        if (!/^\d{4}-\d{2}$/.test(key)) continue;
        const n = typeof value === "number" ? value : Number(String(value).replace(/[,$]/g, ""));
        if (Number.isFinite(n)) valuesByMonth[key] = n;
      }
      const totalFromValues = Object.values(valuesByMonth).reduce((sum, n) => sum + n, 0);
      return {
        accountName: String(row.accountName || `Row ${index + 1}`).trim() || `Row ${index + 1}`,
        accountCode: row.accountCode ? String(row.accountCode).trim() : null,
        valuesByMonth,
        total: Number.isFinite(row.total) ? Number(row.total) : totalFromValues,
        sourceSheet: "pdf",
        rowIndex: index,
      };
    })
    .filter((row) => row.accountName && (Object.keys(row.valuesByMonth).length > 0 || row.total !== 0));
}

export function parsedWorkbookFromPdfLedger(
  documentId: Extract<TtmRequiredDocumentId, "monthly_pl_excel" | "monthly_bs_excel">,
  ledger: PdfLedgerExtraction,
): ParsedMonthlyWorkbook {
  const monthKeys = (ledger.monthKeys || [])
    .map((key) => String(key).trim())
    .filter((key) => /^\d{4}-\d{2}$/.test(key))
    .sort();
  const rows = normalizeLedgerRows(ledger.rows || [], monthKeys);
  const monthKeySet = new Set(monthKeys);
  for (const row of rows) {
    for (const key of Object.keys(row.valuesByMonth)) monthKeySet.add(key);
  }
  const resolvedMonths = Array.from(monthKeySet).sort();

  return {
    documentId,
    format: "standalone",
    headerRowIndex: 0,
    monthKeys: resolvedMonths,
    accountColumnIndex: 0,
    codeColumnIndex: null,
    rows,
    summaryRows: [],
    notes: [
      ...(ledger.notes || []),
      "Source: merged monthly statement PDFs (LLM structured extraction).",
      "GL codes may be absent; mappings rely on account names.",
    ],
  };
}
