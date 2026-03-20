import * as XLSX from "xlsx";
import { extractAccountantStatementsFromPdf } from "@/lib/ttm-agent/claude";
import { ParsedAccountantStatements } from "@/lib/ttm-agent/types";
import { parseNumber, parseYearLabel } from "@/lib/ttm-agent/parsers/excel";

type SheetRows = Array<Array<string | number | Date | null>>;

type MetricKey = keyof ParsedAccountantStatements["years"][number];

const TARGET_LINE_MATCHERS: Record<Exclude<MetricKey, "fiscalYear">, string[]> = {
  revenue: ["total revenue", "revenue", "sales", "gross sales", "net sales", "total income"],
  cogs: ["cost of goods sold", "cost of sales", "total cogs", "cogs"],
  grossProfit: ["gross profit"],
  opEx: ["total operating expenses", "operating expenses", "total expenses"],
  netIncome: ["net income", "net profit", "net ordinary income", "profit (loss)", "net earnings"],
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9\s/&]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readWorkbook(buffer: Buffer) {
  return XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    raw: false,
  });
}

function sheetToRows(sheet: XLSX.WorkSheet) {
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: null,
    blankrows: false,
  }) as SheetRows;
}

function findYearHeader(rows: SheetRows) {
  let best: { rowIndex: number; yearColumns: Array<{ columnIndex: number; fiscalYear: string }> } | null = null;

  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 12); rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const yearColumns = row
      .map((cell, columnIndex) => ({ columnIndex, fiscalYear: parseYearLabel(cell) }))
      .filter((entry): entry is { columnIndex: number; fiscalYear: string } => Boolean(entry.fiscalYear));

    if (yearColumns.length >= 2 && (!best || yearColumns.length > best.yearColumns.length)) {
      best = { rowIndex, yearColumns };
    }
  }

  if (!best) {
    throw new Error("Could not locate fiscal year columns in accountant statements.");
  }

  return best;
}

function scoreMetric(lineName: string, metric: Exclude<MetricKey, "fiscalYear">) {
  const normalized = normalizeText(lineName);
  let best = 0;

  for (const matcher of TARGET_LINE_MATCHERS[metric]) {
    const normalizedMatcher = normalizeText(matcher);
    if (normalized === normalizedMatcher) return 1;
    if (normalized.includes(normalizedMatcher)) {
      best = Math.max(best, 0.92);
    } else {
      const matcherTokens = normalizedMatcher.split(" ");
      const normalizedTokens = normalized.split(" ");
      const overlap = matcherTokens.filter((token) => normalizedTokens.includes(token)).length;
      best = Math.max(best, overlap / matcherTokens.length);
    }
  }

  return best;
}

function parseFromWorkbook(buffer: Buffer): ParsedAccountantStatements {
  const workbook = readWorkbook(buffer);
  const yearlyMetrics = new Map<string, ParsedAccountantStatements["years"][number]>();
  const notes: string[] = [];
  let matchedSheetCount = 0;

  for (const sheetName of workbook.SheetNames) {
    const rows = sheetToRows(workbook.Sheets[sheetName]);

    let header;
    try {
      header = findYearHeader(rows);
    } catch {
      continue;
    }

    matchedSheetCount += 1;
    notes.push(`Detected fiscal year columns in accountant sheet "${sheetName}" at row ${header.rowIndex + 1}.`);

    const firstYearColumn = Math.min(...header.yearColumns.map((column) => column.columnIndex));
    const accountColumnIndex = Math.max(0, firstYearColumn - 1);

    for (let rowIndex = header.rowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex] ?? [];
      const lineName = String(row[accountColumnIndex] ?? "").trim();
      const normalizedLine = normalizeText(lineName);
      if (!normalizedLine) continue;

      const metricScores = (Object.keys(TARGET_LINE_MATCHERS) as Array<Exclude<MetricKey, "fiscalYear">>)
        .map((metric) => ({ metric, score: scoreMetric(normalizedLine, metric) }))
        .sort((a, b) => b.score - a.score);

      if (!metricScores[0] || metricScores[0].score < 0.6) continue;

      const metric = metricScores[0].metric;
      for (const column of header.yearColumns) {
        const rawValue = parseNumber(row[column.columnIndex]);
        if (!Number.isFinite(rawValue)) continue;

        const existing = yearlyMetrics.get(column.fiscalYear) ?? {
          fiscalYear: column.fiscalYear,
          revenue: null,
          cogs: null,
          grossProfit: null,
          opEx: null,
          netIncome: null,
        };

        if (existing[metric] === null || metricScores[0].score > 0.9) {
          existing[metric] = rawValue;
          yearlyMetrics.set(column.fiscalYear, existing);
        }
      }
    }
  }

  if (!matchedSheetCount) {
    throw new Error("Could not parse accountant statement workbook.");
  }

  const years = Array.from(yearlyMetrics.values()).sort((a, b) => a.fiscalYear.localeCompare(b.fiscalYear));
  return {
    sourceType: "xlsx",
    confidence: "HIGH",
    years,
    notes,
  };
}

export async function parseAccountantStatementsDocument(args: {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}) {
  const extension = args.fileName.toLowerCase();

  if (
    args.mimeType.includes("spreadsheet") ||
    args.mimeType.includes("excel") ||
    extension.endsWith(".xlsx") ||
    extension.endsWith(".xls")
  ) {
    return parseFromWorkbook(args.buffer);
  }

  if (args.mimeType.includes("pdf") || extension.endsWith(".pdf")) {
    return extractAccountantStatementsFromPdf(args.fileName, args.buffer.toString("base64"));
  }

  throw new Error(`Unsupported accountant statement format for ${args.fileName}.`);
}
