import * as XLSX from "xlsx";
import { ParsedArAging, ParsedMonthlyWorkbook, PreparedDocumentInput, TtmRequiredDocumentId } from "@/lib/ttm-agent/types";

const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const PL_SECTION_HEADERS = [
  "income",
  "ordinary income",
  "ordinary income/expense",
  "ordinary income expense",
  "sales",
  "cost of goods sold",
  "cogs",
  "expense",
  "expenses",
  "operating expenses",
  "other income",
  "other expense",
  "other income/expense",
  "other income expense",
  "gross profit",
  "net income",
  "net ordinary income",
];

const AR_BUCKET_ALIASES: Array<{ key: keyof Omit<ParsedArAging["entries"][number], "customerName" | "total">; matches: string[] }> = [
  { key: "current", matches: ["current"] },
  { key: "days1To30", matches: ["1-30", "1 - 30", "1 to 30", "1 30", "30 days", "0-30", "0 30"] },
  { key: "days31To60", matches: ["31-60", "31 - 60", "31 to 60", "31 60", "60 days"] },
  { key: "days61To90", matches: ["61-90", "61 - 90", "61 to 90", "61 90"] },
  { key: "days90Plus", matches: ["90+", ">90", "over 90", "91+", "91 and over", "91 days", "91 days overdue", "over 90 days"] },
];

type WorksheetRows = Array<Array<string | number | Date | null>>;
type ParsedMonthlySection = {
  sheetName: string;
  rows: WorksheetRows;
  headerRowIndex: number;
  monthColumns: number[];
};

function readWorkbook(buffer: Buffer) {
  return XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    raw: false,
  });
}

function sheetToRows(sheet: XLSX.WorkSheet): WorksheetRows {
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: null,
    blankrows: false,
  }) as WorksheetRows;
}

function csvTextToRows(text: string): WorksheetRows {
  const workbook = XLSX.read(text, {
    type: "string",
    cellDates: true,
    raw: false,
  });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return [];
  }
  return sheetToRows(workbook.Sheets[firstSheetName]);
}

export function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Date) return Number.NaN;
  if (typeof value !== "string") return Number.NaN;

  const trimmed = value.trim();
  if (!trimmed) return Number.NaN;

  const cleaned = trimmed
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/%/g, "")
    .replace(/\s+/g, "")
    .replace(/^\((.*)\)$/, "-$1");

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function toYearMonth(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function parseExcelDateSerial(value: number) {
  const parsed = XLSX.SSF.parse_date_code(value);
  if (!parsed) return null;
  return toYearMonth(parsed.y, parsed.m - 1);
}

export function parseMonthLabel(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return toYearMonth(value.getUTCFullYear(), value.getUTCMonth());
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return parseExcelDateSerial(value);
  }

  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  // Do not treat plain numeric strings as dates. In prepared CSV rows these are
  // usually GL codes or financial amounts, and permissive Date parsing will
  // misclassify detail rows as month headers.
  if (/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    return null;
  }

  const yyyyMm = normalized.match(/^(\d{4})[-/](\d{1,2})$/);
  if (yyyyMm) {
    const year = Number(yyyyMm[1]);
    const month = Number(yyyyMm[2]) - 1;
    if (month >= 0 && month <= 11) return toYearMonth(year, month);
  }

  const monthYear = normalized.match(/^([a-z]+)[\s/-]+(\d{2,4})$/);
  if (monthYear && MONTH_INDEX[monthYear[1]] !== undefined) {
    const rawYear = Number(monthYear[2]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    return toYearMonth(year, MONTH_INDEX[monthYear[1]]);
  }

  const slashDate = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slashDate) {
    const rawYear = Number(slashDate[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const month = Number(slashDate[1]) - 1;
    if (month >= 0 && month <= 11) return toYearMonth(year, month);
  }

  // Only allow generic Date parsing for strings that visibly look date-like.
  if (/[a-z]/i.test(normalized) || /[/-]/.test(normalized)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) {
      return toYearMonth(parsed.getUTCFullYear(), parsed.getUTCMonth());
    }
  }

  return null;
}

export function parseYearLabel(value: unknown): string | null {
  if (typeof value === "number" && value >= 2000 && value <= 2100) {
    return String(value);
  }
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return String(value.getUTCFullYear());
  }
  if (typeof value !== "string") return null;

  const match = value.trim().match(/(20\d{2})/);
  return match ? match[1] : null;
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9\s/&]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sortMonthKeys(keys: string[]) {
  return [...keys].sort((a, b) => a.localeCompare(b));
}

function pickHeaderRow(rows: WorksheetRows) {
  let best = { index: -1, monthColumns: [] as number[] };

  // Scan up to 20 rows to handle files where the header is further down
  // (e.g., Grand format has headers at row 4, some files have title rows)
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 20); rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const monthColumns = row
      .map((cell, index) => ({ index, monthKey: parseMonthLabel(cell) }))
      .filter((entry) => Boolean(entry.monthKey))
      .map((entry) => entry.index);

    if (monthColumns.length > best.monthColumns.length) {
      best = { index: rowIndex, monthColumns };
    }
  }

  if (best.index !== -1 && best.monthColumns.length >= 3) {
    return best;
  }

  throw new Error("Could not locate a month header row in workbook.");
}

function findAccountColumn(headerRow: WorksheetRows[number], monthColumns: number[], rows?: WorksheetRows, headerRowIndex?: number) {
  const firstMonthColumn = Math.min(...monthColumns);
  let accountColumnIndex = -1;
  let codeColumnIndex: number | null = null;

  // First pass: look for explicit code column headers
  // "Cantara GL Code", "GL Code", "Acct #", "Account Number"
  for (let index = 0; index < firstMonthColumn; index += 1) {
    const normalized = normalizeText(headerRow[index]);
    if (!normalized) continue;
    // Code column: must contain "code" or "acct" but NOT be a general "account" label
    // e.g. "Cantara GL Code" → yes, "GL Code" → yes, "QB GL Account" → no (that's account name)
    if (/\bcode\b/.test(normalized) || /\bacct\s*#?\b/.test(normalized) || /\baccount\s*(no|number|#)\b/.test(normalized)) {
      codeColumnIndex = index;
    }
  }

  // Second pass: look for account name column
  // "QB GL Account", "Account", "Description", "Line Item", "Name"
  for (let index = 0; index < firstMonthColumn; index += 1) {
    if (index === codeColumnIndex) continue; // Skip the code column
    const normalized = normalizeText(headerRow[index]);
    if (!normalized) continue;
    if (/(account|description|line item|name)/.test(normalized)) {
      accountColumnIndex = index;
      break; // Take the first match
    }
  }

  if (accountColumnIndex === -1) {
    // For plain QB formats (Format 2: Grand, Format 3: Sample #2), there is no
    // labeled account column. The account names live in the first non-empty column
    // before the month data, typically column 0. Detect this by scanning data rows
    // below the header to find which column contains text account names.
    if (rows && headerRowIndex !== undefined) {
      const columnTextCounts: Record<number, number> = {};
      const scanEnd = Math.min((headerRowIndex ?? 0) + 20, rows.length);
      for (let ri = (headerRowIndex ?? 0) + 1; ri < scanEnd; ri++) {
        const row = rows[ri] ?? [];
        for (let ci = 0; ci < firstMonthColumn; ci++) {
          if (ci === codeColumnIndex) continue;
          const cellVal = String(row[ci] ?? "").trim();
          if (cellVal && !parseMonthLabel(cellVal) && Number.isNaN(parseNumber(cellVal))) {
            columnTextCounts[ci] = (columnTextCounts[ci] ?? 0) + 1;
          }
        }
      }
      // Pick the column with the most text entries
      let bestCol = -1;
      let bestCount = 0;
      for (const [col, count] of Object.entries(columnTextCounts)) {
        if (count > bestCount) {
          bestCount = count;
          bestCol = Number(col);
        }
      }
      if (bestCol >= 0) {
        accountColumnIndex = bestCol;
      }
    }

    if (accountColumnIndex === -1) {
      // Fallback: use the column just before the first month column, excluding code column
      for (let index = firstMonthColumn - 1; index >= 0; index -= 1) {
        if (index !== codeColumnIndex) {
          accountColumnIndex = index;
          break;
        }
      }
      if (accountColumnIndex === -1) accountColumnIndex = 0;
    }
  }

  if (codeColumnIndex === accountColumnIndex) {
    codeColumnIndex = null;
  }

  return { accountColumnIndex, codeColumnIndex };
}

function resolveAccountNameForRow(
  row: WorksheetRows[number],
  monthColumns: number[],
  accountColumnIndex: number,
  codeColumnIndex: number | null,
) {
  const firstMonthColumn = Math.min(...monthColumns);
  // Trim both leading indentation and trailing whitespace from QB-style accounts
  // (e.g., "   Sales", "      Cash & Check Sales")
  const explicitAccountCell = String(row[accountColumnIndex] ?? "").trim();
  if (explicitAccountCell) return explicitAccountCell;

  // Fallback: scan columns before the first month column for a text value
  for (let index = firstMonthColumn - 1; index >= 0; index -= 1) {
    if (index === codeColumnIndex) continue;
    const candidate = String(row[index] ?? "").trim();
    if (!candidate) continue;
    if (parseMonthLabel(candidate)) continue;
    return candidate;
  }

  return explicitAccountCell;
}

// Cantara GL codes assigned to rollup/subtotal rows in F1 and F2.
// These codes are for human readability — only leaf-level accounts should be ingested.
// Every Cantara GL code that represents a computed subtotal, rollup, or out-of-scope line.
// Only leaf-level transaction accounts should pass through to the mapper.
const ROLLUP_ACCOUNT_CODES = new Set([
  // P&L rollup lines (computed from leaf accounts)
  "REV-TOTAL",   // Total Income / Total Revenue
  "REV-SVC",     // Total Services (subtotal of boarding+daycare+grooming)
  "COGS-TOTAL",  // Total COGS
  "GP",          // Gross Profit = Revenue - COGS
  "PAY-TOTAL",   // Total Payroll Expenses
  "OPX-TOTAL",   // Total Expenses / Total OpEx
  "NOI",         // Net Operating Income
  "NET-INC",     // Net Income
  "OTH-INC",     // Other Income (below-the-line)
  "OTH-EXP",     // Other Expenses (below-the-line)
  "OTH-NET",     // Net Other Income

  // BS structural totals
  "CA-OTHER", "CA-TOTAL", "FA-TOTAL", "OA-TOTAL", "ASSET-TOTAL",
  "CL-OTHER", "CL-TOTAL", "LIAB-TOTAL", "EQ-TOTAL",

  // Equity accounts (outside P&L scope)
  "EQ-DRAWS", "EQ-NETINC",

  // Fixed asset lines (BS only, not P&L)
  "FA-LHI",
]);

function shouldSkipLedgerRow(accountName: string, accountCode: string | null, values: number[]) {
  const normalizedName = normalizeText(accountName);
  const hasNumbers = values.some((value) => Number.isFinite(value));
  if (!normalizedName || !hasNumbers) return true;

  // Skip rollup rows by Cantara GL code — this is the primary filter.
  // These codes exist in F1/F2 for readability but are computed subtotals.
  if (accountCode) {
    const code = accountCode.trim().toUpperCase();
    if (ROLLUP_ACCOUNT_CODES.has(code)) {
      console.log(`[TTM Parser] SKIPPING rollup row: code=${code} name=${accountName}`);
      return true;
    }
    // Catch any code ending in -TOTAL (future-proof)
    if (/-TOTAL$/.test(code)) return true;
    // Equity accounts outside P&L scope
    if (/^EQ-/.test(code)) return true;
  }

  // Skip section headers — these are structural labels in QB exports.
  // In some formats (Grand, Sample #2) these may have subtotal numbers but are
  // still not leaf-level accounts. Always skip them.
  if (PL_SECTION_HEADERS.includes(normalizedName)) {
    return true;
  }

  if (/^total\b/.test(normalizedName)) {
    return true;
  }

  if (/(gross profit|net income|net ordinary income|ordinary income|ebitda|pre recast|subtotal|total assets|total liabilities|total equity|owner.?s? equity|retained earnings)/.test(normalizedName)) {
    return true;
  }

  return false;
}

function shouldCaptureSummaryRow(accountName: string) {
  const normalizedName = normalizeText(accountName);
  if (!normalizedName) return false;
  if (/^total\b/.test(normalizedName)) return true;
  return /(gross profit|net income|net ordinary income|ordinary income|ebitda|pre recast|subtotal|interest|depreciation|amortization)/.test(
    normalizedName,
  );
}

function deriveFormat(headerRow: WorksheetRows[number], codeColumnIndex: number | null) {
  // Format 1 (Foothills): has an explicit GL code column → "qb"
  if (codeColumnIndex !== null) return "qb" as const;
  // Format 2 & 3 (Grand, Sample #2): no code column, plain QB export → "standalone"
  // These need auto-mapping via the taxonomy alias system
  const headerText = normalizeText(headerRow.join(" "));
  return /(quickbooks|qb)/.test(headerText) ? ("qb" as const) : ("standalone" as const);
}

function chooseBestMonthlySheet(workbook: XLSX.WorkBook, documentId: TtmRequiredDocumentId) {
  let best:
    | {
        sheetName: string;
        rows: WorksheetRows;
        headerRowIndex: number;
        monthColumns: number[];
      }
    | null = null;

  for (const sheetName of workbook.SheetNames) {
    const rows = sheetToRows(workbook.Sheets[sheetName]);
    try {
      const header = pickHeaderRow(rows);
      const score = header.monthColumns.length * 100 + rows.length;
      const currentBestScore = best ? best.monthColumns.length * 100 + best.rows.length : -1;
      const boostedScore =
        score +
        (documentId === "monthly_pl_excel" && /(profit|loss|p&l|income)/i.test(sheetName) ? 25 : 0) +
        (documentId === "monthly_bs_excel" && /(balance|sheet|bs)/i.test(sheetName) ? 25 : 0);

      if (boostedScore > currentBestScore) {
        best = { sheetName, rows, headerRowIndex: header.index, monthColumns: header.monthColumns };
      }
    } catch {
      continue;
    }
  }

  if (!best) {
    throw new Error("Could not find a valid monthly statement sheet.");
  }

  return best;
}

function chooseBestMonthlySheetFromPrepared(
  preparedDocument: PreparedDocumentInput,
  documentId: TtmRequiredDocumentId,
) {
  let best:
    | {
        sheetName: string;
        rows: WorksheetRows;
        headerRowIndex: number;
        monthColumns: number[];
      }
    | null = null;

  for (const block of preparedDocument.textBlocks ?? []) {
    const rows = csvTextToRows(block.text);
    try {
      const header = pickHeaderRow(rows);
      const score = header.monthColumns.length * 100 + rows.length;
      const currentBestScore = best ? best.monthColumns.length * 100 + best.rows.length : -1;
      const boostedScore =
        score +
        (documentId === "monthly_pl_excel" && /(profit|loss|p&l|income)/i.test(block.sheetName) ? 25 : 0) +
        (documentId === "monthly_bs_excel" && /(balance|sheet|bs)/i.test(block.sheetName) ? 25 : 0);

      if (boostedScore > currentBestScore) {
        best = { sheetName: block.sheetName, rows, headerRowIndex: header.index, monthColumns: header.monthColumns };
      }
    } catch {
      continue;
    }
  }

  if (!best) {
    throw new Error("Could not find a valid monthly statement sheet in prepared text blocks.");
  }

  return best;
}

function extractPreparedMonthlySections(preparedDocument: PreparedDocumentInput) {
  const sections: ParsedMonthlySection[] = [];

  for (const block of preparedDocument.textBlocks ?? []) {
    const normalizedText = block.text.replace(/\r\n/g, "\n");
    const matches = Array.from(
      normalizedText.matchAll(/=== SHEET:\s*(.+?)\s*===\n([\s\S]*?)(?=\n=== END OF SHEET — NEXT FISCAL YEAR BELOW ===|\n=== SHEET:\s*.+?\s*===\n|$)/g),
    );

    if (matches.length > 0) {
      for (const match of matches) {
        const sheetName = match[1]?.trim() || block.sheetName;
        const csvText = match[2]?.trim();
        if (!csvText) continue;

        const rows = csvTextToRows(csvText);
        const header = pickHeaderRow(rows);
        sections.push({
          sheetName,
          rows,
          headerRowIndex: header.index,
          monthColumns: header.monthColumns,
        });
      }
      continue;
    }

    const rows = csvTextToRows(block.text);
    const header = pickHeaderRow(rows);
    sections.push({
      sheetName: block.sheetName,
      rows,
      headerRowIndex: header.index,
      monthColumns: header.monthColumns,
    });
  }

  return sections;
}

function parsePreparedMonthlySection(section: ParsedMonthlySection) {
  const headerRow = section.rows[section.headerRowIndex] ?? [];
  const { accountColumnIndex, codeColumnIndex } = findAccountColumn(headerRow, section.monthColumns, section.rows, section.headerRowIndex);
  const monthKeys = sortMonthKeys(
    section.monthColumns
      .map((columnIndex) => parseMonthLabel(headerRow[columnIndex]))
      .filter((value): value is string => Boolean(value)),
  );

  const monthIndexMap = new Map<number, string>();
  section.monthColumns.forEach((columnIndex) => {
    const monthKey = parseMonthLabel(headerRow[columnIndex]);
    if (monthKey) monthIndexMap.set(columnIndex, monthKey);
  });

  const rows = [];
  const summaryRows = [];

  for (let rowIndex = section.headerRowIndex + 1; rowIndex < section.rows.length; rowIndex += 1) {
    const row = section.rows[rowIndex] ?? [];
    const accountName = resolveAccountNameForRow(row, section.monthColumns, accountColumnIndex, codeColumnIndex);
    const accountCode = codeColumnIndex === null ? null : String(row[codeColumnIndex] ?? "").trim() || null;

    const values = Array.from(monthIndexMap.entries()).map(([columnIndex]) => parseNumber(row[columnIndex]));
    if (shouldSkipLedgerRow(accountName, accountCode, values)) {
      if (shouldCaptureSummaryRow(accountName)) {
        const valuesByMonth = Object.fromEntries(
          Array.from(monthIndexMap.entries()).map(([columnIndex, monthKey]) => [
            monthKey,
            Number.isFinite(parseNumber(row[columnIndex])) ? parseNumber(row[columnIndex]) : 0,
          ]),
        );
        summaryRows.push({
          accountName,
          accountCode,
          valuesByMonth,
          total: Object.values(valuesByMonth).reduce((sum, value) => sum + value, 0),
          sourceSheet: section.sheetName,
          rowIndex,
        });
      }
      continue;
    }

    const valuesByMonth = Object.fromEntries(
      Array.from(monthIndexMap.entries()).map(([columnIndex, monthKey]) => [
        monthKey,
        Number.isFinite(parseNumber(row[columnIndex])) ? parseNumber(row[columnIndex]) : 0,
      ]),
    );

    rows.push({
      accountName,
      accountCode,
      valuesByMonth,
      total: Object.values(valuesByMonth).reduce((sum, value) => sum + value, 0),
      sourceSheet: section.sheetName,
      rowIndex,
    });
  }

  return {
    headerRow,
    accountColumnIndex,
    codeColumnIndex,
    monthKeys,
    rows,
    summaryRows,
  };
}

function mergePreparedMonthlySections(
  parsedSections: Array<
    ReturnType<typeof parsePreparedMonthlySection> & {
      sheetName: string;
      headerRowIndex: number;
    }
  >,
  documentId: Extract<TtmRequiredDocumentId, "monthly_pl_excel" | "monthly_bs_excel">,
): ParsedMonthlyWorkbook {
  const allMonthKeys = sortMonthKeys(parsedSections.flatMap((section) => section.monthKeys));
  const mergedRows = new Map<
    string,
    {
      accountName: string;
      accountCode: string | null;
      valuesByMonth: Record<string, number>;
      total: number;
      sourceSheet: string;
      rowIndex: number;
    }
  >();
  const mergedSummaryRows = new Map<
    string,
    {
      accountName: string;
      accountCode: string | null;
      valuesByMonth: Record<string, number>;
      total: number;
      sourceSheet: string;
      rowIndex: number;
    }
  >();

  for (const section of parsedSections) {
    for (const row of section.rows) {
      const rowKey = `${row.accountCode ?? ""}::${normalizeText(row.accountName)}`;
      const existing = mergedRows.get(rowKey);

      if (!existing) {
        mergedRows.set(rowKey, {
          ...row,
          valuesByMonth: { ...row.valuesByMonth },
          sourceSheet: row.sourceSheet,
        });
        continue;
      }

      for (const [monthKey, value] of Object.entries(row.valuesByMonth) as Array<[string, number]>) {
        existing.valuesByMonth[monthKey] = value;
      }
      existing.total = Object.values(existing.valuesByMonth).reduce((sum, value) => sum + value, 0);
      if (!existing.sourceSheet.includes(row.sourceSheet)) {
        existing.sourceSheet = `${existing.sourceSheet}, ${row.sourceSheet}`;
      }
    }
    for (const row of section.summaryRows) {
      const rowKey = `${row.accountCode ?? ""}::${normalizeText(row.accountName)}`;
      const existing = mergedSummaryRows.get(rowKey);

      if (!existing) {
        mergedSummaryRows.set(rowKey, {
          ...row,
          valuesByMonth: { ...row.valuesByMonth },
          sourceSheet: row.sourceSheet,
        });
        continue;
      }

      for (const [monthKey, value] of Object.entries(row.valuesByMonth) as Array<[string, number]>) {
        existing.valuesByMonth[monthKey] = value;
      }
      existing.total = Object.values(existing.valuesByMonth).reduce((sum, value) => sum + value, 0);
      if (!existing.sourceSheet.includes(row.sourceSheet)) {
        existing.sourceSheet = `${existing.sourceSheet}, ${row.sourceSheet}`;
      }
    }
  }

  const firstSection = parsedSections[0];
  const lastSection = parsedSections[parsedSections.length - 1];
  const formats = parsedSections.map((section) => deriveFormat(section.headerRow, section.codeColumnIndex));
  const format = formats.includes("qb") ? "qb" as const : "standalone" as const;

  return {
    documentId,
    format,
    headerRowIndex: firstSection?.headerRowIndex ?? 0,
    monthKeys: allMonthKeys,
    accountColumnIndex: firstSection?.accountColumnIndex ?? 0,
    codeColumnIndex: firstSection?.codeColumnIndex ?? null,
    rows: Array.from(mergedRows.values()),
    summaryRows: Array.from(mergedSummaryRows.values()),
    notes: [
      `Parsed ${parsedSections.length} fiscal-year sections from prepared input.`,
      `Month coverage spans ${allMonthKeys[0] ?? "n/a"} through ${allMonthKeys[allMonthKeys.length - 1] ?? "n/a"}.`,
      `Merged recurring GL rows across sections ${firstSection?.sheetName ?? "?"} → ${lastSection?.sheetName ?? "?"}.`,
    ],
  };
}

export function parseMonthlyWorkbook(
  buffer: Buffer,
  documentId: Extract<TtmRequiredDocumentId, "monthly_pl_excel" | "monthly_bs_excel">,
): ParsedMonthlyWorkbook {
  const workbook = readWorkbook(buffer);

  // Try multi-sheet merge first (e.g., Year 1, Year 2, Year 3 sheets)
  const allSections: Array<ParsedMonthlySection & { sheetName: string }> = [];
  for (const sheetName of workbook.SheetNames) {
    const rows = sheetToRows(workbook.Sheets[sheetName]);
    try {
      const header = pickHeaderRow(rows);
      allSections.push({ sheetName, rows, headerRowIndex: header.index, monthColumns: header.monthColumns });
    } catch {
      continue;
    }
  }

  if (allSections.length > 1) {
    const parsedSections = allSections.map((section) => ({
      sheetName: section.sheetName,
      headerRowIndex: section.headerRowIndex,
      ...parsePreparedMonthlySection(section),
    }));
    return mergePreparedMonthlySections(parsedSections, documentId);
  }

  const selected = allSections[0] ?? chooseBestMonthlySheet(workbook, documentId);
  const headerRow = selected.rows[selected.headerRowIndex] ?? [];
  const { accountColumnIndex, codeColumnIndex } = findAccountColumn(headerRow, selected.monthColumns, selected.rows, selected.headerRowIndex);
  const monthKeys = sortMonthKeys(
    selected.monthColumns
      .map((columnIndex) => parseMonthLabel(headerRow[columnIndex]))
      .filter((value): value is string => Boolean(value)),
  );

  const monthIndexMap = new Map<number, string>();
  selected.monthColumns.forEach((columnIndex) => {
    const monthKey = parseMonthLabel(headerRow[columnIndex]);
    if (monthKey) monthIndexMap.set(columnIndex, monthKey);
  });

  const rows = [];
  const summaryRows = [];

  for (let rowIndex = selected.headerRowIndex + 1; rowIndex < selected.rows.length; rowIndex += 1) {
    const row = selected.rows[rowIndex] ?? [];
    const accountName = resolveAccountNameForRow(row, selected.monthColumns, accountColumnIndex, codeColumnIndex);
    const accountCode = codeColumnIndex === null ? null : String(row[codeColumnIndex] ?? "").trim() || null;

    const values = Array.from(monthIndexMap.entries()).map(([columnIndex]) => parseNumber(row[columnIndex]));
    if (shouldSkipLedgerRow(accountName, accountCode, values)) {
      if (shouldCaptureSummaryRow(accountName)) {
        const valuesByMonth = Object.fromEntries(
          Array.from(monthIndexMap.entries()).map(([columnIndex, monthKey]) => [
            monthKey,
            Number.isFinite(parseNumber(row[columnIndex])) ? parseNumber(row[columnIndex]) : 0,
          ]),
        );
        summaryRows.push({
          accountName,
          accountCode,
          valuesByMonth,
          total: Object.values(valuesByMonth).reduce((sum, value) => sum + value, 0),
          sourceSheet: selected.sheetName,
          rowIndex,
        });
      }
      continue;
    }

    const valuesByMonth = Object.fromEntries(
      Array.from(monthIndexMap.entries()).map(([columnIndex, monthKey]) => [
        monthKey,
        Number.isFinite(parseNumber(row[columnIndex])) ? parseNumber(row[columnIndex]) : 0,
      ]),
    );

    rows.push({
      accountName,
      accountCode,
      valuesByMonth,
      total: Object.values(valuesByMonth).reduce((sum, value) => sum + value, 0),
      sourceSheet: selected.sheetName,
      rowIndex,
    });
  }

  return {
    documentId,
    format: deriveFormat(headerRow, codeColumnIndex),
    headerRowIndex: selected.headerRowIndex,
    monthKeys,
    accountColumnIndex,
    codeColumnIndex,
    rows,
    summaryRows,
    notes: [
      `Detected ${deriveFormat(headerRow, codeColumnIndex)} format in sheet "${selected.sheetName}".`,
      `Header row located at Excel row ${selected.headerRowIndex + 1}.`,
    ],
  };
}

export function parseMonthlyWorkbookFromPrepared(
  preparedDocument: PreparedDocumentInput,
  documentId: Extract<TtmRequiredDocumentId, "monthly_pl_excel" | "monthly_bs_excel">,
): ParsedMonthlyWorkbook {
  const preparedSections = extractPreparedMonthlySections(preparedDocument);
  if (preparedSections.length > 1) {
    const parsedSections = preparedSections.map((section) => ({
      sheetName: section.sheetName,
      headerRowIndex: section.headerRowIndex,
      ...parsePreparedMonthlySection(section),
    }));

    return mergePreparedMonthlySections(parsedSections, documentId);
  }

  const selected = chooseBestMonthlySheetFromPrepared(preparedDocument, documentId);
  const headerRow = selected.rows[selected.headerRowIndex] ?? [];
  const { accountColumnIndex, codeColumnIndex } = findAccountColumn(headerRow, selected.monthColumns, selected.rows, selected.headerRowIndex);
  const monthKeys = sortMonthKeys(
    selected.monthColumns
      .map((columnIndex) => parseMonthLabel(headerRow[columnIndex]))
      .filter((value): value is string => Boolean(value)),
  );

  const monthIndexMap = new Map<number, string>();
  selected.monthColumns.forEach((columnIndex) => {
    const monthKey = parseMonthLabel(headerRow[columnIndex]);
    if (monthKey) monthIndexMap.set(columnIndex, monthKey);
  });

  const rows = [];
  const summaryRows = [];

  for (let rowIndex = selected.headerRowIndex + 1; rowIndex < selected.rows.length; rowIndex += 1) {
    const row = selected.rows[rowIndex] ?? [];
    const accountName = String(row[accountColumnIndex] ?? "").trim();
    const accountCode = codeColumnIndex === null ? null : String(row[codeColumnIndex] ?? "").trim() || null;

    const values = Array.from(monthIndexMap.entries()).map(([columnIndex]) => parseNumber(row[columnIndex]));
    if (shouldSkipLedgerRow(accountName, accountCode, values)) {
      if (shouldCaptureSummaryRow(accountName)) {
        const valuesByMonth = Object.fromEntries(
          Array.from(monthIndexMap.entries()).map(([columnIndex, monthKey]) => [
            monthKey,
            Number.isFinite(parseNumber(row[columnIndex])) ? parseNumber(row[columnIndex]) : 0,
          ]),
        );
        summaryRows.push({
          accountName,
          accountCode,
          valuesByMonth,
          total: Object.values(valuesByMonth).reduce((sum, value) => sum + value, 0),
          sourceSheet: selected.sheetName,
          rowIndex,
        });
      }
      continue;
    }

    const valuesByMonth = Object.fromEntries(
      Array.from(monthIndexMap.entries()).map(([columnIndex, monthKey]) => [
        monthKey,
        Number.isFinite(parseNumber(row[columnIndex])) ? parseNumber(row[columnIndex]) : 0,
      ]),
    );

    rows.push({
      accountName,
      accountCode,
      valuesByMonth,
      total: Object.values(valuesByMonth).reduce((sum, value) => sum + value, 0),
      sourceSheet: selected.sheetName,
      rowIndex,
    });
  }

  return {
    documentId,
    format: deriveFormat(headerRow, codeColumnIndex),
    headerRowIndex: selected.headerRowIndex,
    monthKeys,
    accountColumnIndex,
    codeColumnIndex,
    rows,
    summaryRows,
    notes: [
      `Detected ${deriveFormat(headerRow, codeColumnIndex)} format in sheet "${selected.sheetName}".`,
      `Header row located at CSV row ${selected.headerRowIndex + 1}.`,
    ],
  };
}

function findArAgingHeader(rows: WorksheetRows) {
  let best: { rowIndex: number; buckets: Array<{ columnIndex: number; key: "current" | "days1To30" | "days31To60" | "days61To90" | "days90Plus" }> } | null =
    null;

  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 15); rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const buckets: Array<{ columnIndex: number; key: "current" | "days1To30" | "days31To60" | "days61To90" | "days90Plus" }> = [];

    row.forEach((cell, columnIndex) => {
      const normalized = normalizeText(cell);
      const matched = AR_BUCKET_ALIASES.find((bucket) =>
        bucket.matches.some((match) => normalized.includes(match)),
      );
      if (matched) {
        buckets.push({ columnIndex, key: matched.key });
      }
    });

    if (buckets.length >= 4 && (!best || buckets.length > best.buckets.length)) {
      best = { rowIndex, buckets };
    }
  }

  if (!best) {
    throw new Error("Could not locate an AR aging header row.");
  }

  return best;
}

/**
 * Parse AR aging from transaction-detail format (e.g., QB A/R Aging Detail).
 * Columns: Type | Date | Num | Name | Account | Due Date | Aging | Open Balance
 * Buckets transactions by the Aging (days) column.
 */
function parseArAgingFromTransactionDetail(rows: WorksheetRows): ParsedArAging | null {
  // Find header row with "Aging" and "Open Balance" columns
  let headerIndex = -1;
  let agingCol = -1;
  let balanceCol = -1;
  let nameCol = -1;

  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const row = rows[i] ?? [];
    let foundAging = -1;
    let foundBalance = -1;
    let foundName = -1;
    row.forEach((cell, col) => {
      const n = normalizeText(cell);
      if (n === "aging") foundAging = col;
      if (/(open balance|balance|amount)/.test(n)) foundBalance = col;
      if (/(name|customer|client)/.test(n)) foundName = col;
    });
    if (foundAging >= 0 && foundBalance >= 0) {
      headerIndex = i;
      agingCol = foundAging;
      balanceCol = foundBalance;
      nameCol = foundName >= 0 ? foundName : 3; // default to column 3 (Name)
      break;
    }
  }

  if (headerIndex < 0) return null;

  const customerBuckets = new Map<string, { current: number; days1To30: number; days31To60: number; days61To90: number; days90Plus: number; total: number }>();
  let currentCustomerGroup = "";

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const firstCell = normalizeText(row[0]);
    // Section headers like "Current", "1 - 30", etc. indicate the bucket group
    if (/^current$/.test(firstCell)) { currentCustomerGroup = ""; continue; }
    if (/^1\s*-?\s*30|^1 30/.test(firstCell)) { currentCustomerGroup = ""; continue; }
    if (/^31\s*-?\s*60/.test(firstCell)) { currentCustomerGroup = ""; continue; }
    if (/^61\s*-?\s*90/.test(firstCell)) { currentCustomerGroup = ""; continue; }
    if (/^90\s*\+|^over\s*90|^91/.test(firstCell)) { currentCustomerGroup = ""; continue; }
    if (/^total\b/.test(firstCell)) continue;

    const agingDays = parseNumber(row[agingCol]);
    const balance = parseNumber(row[balanceCol]);
    const name = String(row[nameCol] ?? "").trim();
    if (!Number.isFinite(balance) || balance === 0) continue;

    const customerName = name || "Unknown";
    if (!customerBuckets.has(customerName)) {
      customerBuckets.set(customerName, { current: 0, days1To30: 0, days31To60: 0, days61To90: 0, days90Plus: 0, total: 0 });
    }
    const entry = customerBuckets.get(customerName)!;
    entry.total += balance;

    const days = Number.isFinite(agingDays) ? agingDays : 0;
    if (days <= 0) entry.current += balance;
    else if (days <= 30) entry.days1To30 += balance;
    else if (days <= 60) entry.days31To60 += balance;
    else if (days <= 90) entry.days61To90 += balance;
    else entry.days90Plus += balance;
  }

  if (customerBuckets.size === 0) return null;

  const entries = Array.from(customerBuckets.entries()).map(([customerName, buckets]) => ({
    customerName,
    ...buckets,
  }));

  const totalAr = entries.reduce((sum, e) => sum + e.total, 0);
  console.log(`[TTM Parser] AR aging from transaction detail: ${entries.length} customers, total=$${totalAr.toFixed(0)}`);

  return {
    headerRowIndex: headerIndex,
    sourceSheet: "A/R Aging Detail",
    entries,
    notes: [`Parsed from transaction-detail format: ${entries.length} customers, total AR $${totalAr.toFixed(0)}`],
  };
}

export function parseArAgingWorkbook(buffer: Buffer): ParsedArAging {
  const workbook = readWorkbook(buffer);

  // First try transaction-detail format (Type | Date | Num | Name | ... | Aging | Open Balance)
  for (const sheetName of workbook.SheetNames) {
    const rows = sheetToRows(workbook.Sheets[sheetName]);
    const transactionResult = parseArAgingFromTransactionDetail(rows);
    if (transactionResult) return transactionResult;
  }

  // Fall back to bucket-column format (Current | 1-30 | 31-60 | 61-90 | 90+)
  for (const sheetName of workbook.SheetNames) {
    const rows = sheetToRows(workbook.Sheets[sheetName]);
    try {
      const header = findArAgingHeader(rows);
      const firstBucketColumn = Math.min(...header.buckets.map((bucket) => bucket.columnIndex));
      const headerRow = rows[header.rowIndex] ?? [];
      const customerHeaderIndex = headerRow.findIndex((cell) => /(customer|client|account|name)/.test(normalizeText(cell)));
      const customerColumnIndex = customerHeaderIndex >= 0 ? customerHeaderIndex : Math.max(0, firstBucketColumn - 1);
      const entries = [];

      for (let rowIndex = header.rowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex] ?? [];
        const customerName = String(row[customerColumnIndex] ?? "").trim();
        const normalizedCustomer = normalizeText(customerName);
        const bucketValues = Object.fromEntries(
          header.buckets.map((bucket) => [
            bucket.key,
            Number.isFinite(parseNumber(row[bucket.columnIndex])) ? parseNumber(row[bucket.columnIndex]) : 0,
          ]),
        ) as Record<"current" | "days1To30" | "days31To60" | "days61To90" | "days90Plus", number>;

        const total = Object.values(bucketValues).reduce((sum, value) => sum + value, 0);
        if (!normalizedCustomer && total === 0) continue;

        // Skip summary/total/subtotal rows — these are computed rollups, not customer records.
        if (/^total\b/.test(normalizedCustomer)) continue;
        if (/(subtotal|grand total|total ar|aging summary|summary|total receivables)/i.test(normalizedCustomer)) continue;
        // Skip aging bucket label rows from summary boxes
        if (/^(current|0\s*-?\s*30|1\s*-?\s*30|31\s*-?\s*60|61\s*-?\s*90|90\s*\+|over\s*90)\s*(days?)?\s*$/i.test(normalizedCustomer)) continue;
        // Skip rows with no customer name but have values (likely total/summary rows)
        if (!normalizedCustomer && total !== 0) continue;

        entries.push({
          customerName: customerName || `Row ${rowIndex + 1}`,
          ...bucketValues,
          total,
        });
      }

      return {
        headerRowIndex: header.rowIndex,
        sourceSheet: sheetName,
        entries,
        notes: [
          `AR aging parsed from sheet "${sheetName}".`,
          `Header row located at Excel row ${header.rowIndex + 1}.`,
        ],
      };
    } catch {
      continue;
    }
  }

  throw new Error("Could not find a valid AR aging sheet.");
}

export function parseArAgingWorkbookFromPrepared(preparedDocument: PreparedDocumentInput): ParsedArAging {
  // First try transaction-detail format
  for (const block of preparedDocument.textBlocks ?? []) {
    const rows = csvTextToRows(block.text);
    const transactionResult = parseArAgingFromTransactionDetail(rows);
    if (transactionResult) return transactionResult;
  }

  // Fall back to bucket-column format
  for (const block of preparedDocument.textBlocks ?? []) {
    const rows = csvTextToRows(block.text);
    try {
      const header = findArAgingHeader(rows);
      const firstBucketColumn = Math.min(...header.buckets.map((bucket) => bucket.columnIndex));
      const headerRow = rows[header.rowIndex] ?? [];
      const customerHeaderIndex = headerRow.findIndex((cell) => /(customer|client|account|name)/.test(normalizeText(cell)));
      const customerColumnIndex = customerHeaderIndex >= 0 ? customerHeaderIndex : Math.max(0, firstBucketColumn - 1);
      const entries = [];

      for (let rowIndex = header.rowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex] ?? [];
        const customerName = String(row[customerColumnIndex] ?? "").trim();
        const normalizedCustomer = normalizeText(customerName);
        const bucketValues = Object.fromEntries(
          header.buckets.map((bucket) => [
            bucket.key,
            Number.isFinite(parseNumber(row[bucket.columnIndex])) ? parseNumber(row[bucket.columnIndex]) : 0,
          ]),
        ) as Record<"current" | "days1To30" | "days31To60" | "days61To90" | "days90Plus", number>;

        const total = Object.values(bucketValues).reduce((sum, value) => sum + value, 0);
        if (!normalizedCustomer && total === 0) continue;

        // Skip summary/total/subtotal rows — these are computed rollups, not customer records.
        if (/^total\b/.test(normalizedCustomer)) continue;
        if (/(subtotal|grand total|total ar|aging summary|summary|total receivables)/i.test(normalizedCustomer)) continue;
        // Skip aging bucket label rows from summary boxes
        if (/^(current|0\s*-?\s*30|1\s*-?\s*30|31\s*-?\s*60|61\s*-?\s*90|90\s*\+|over\s*90)\s*(days?)?\s*$/i.test(normalizedCustomer)) continue;
        // Skip rows with no customer name but have values (likely total/summary rows)
        if (!normalizedCustomer && total !== 0) continue;

        entries.push({
          customerName: customerName || `Row ${rowIndex + 1}`,
          ...bucketValues,
          total,
        });
      }

      return {
        headerRowIndex: header.rowIndex,
        sourceSheet: block.sheetName,
        entries,
        notes: [
          `AR aging parsed from sheet "${block.sheetName}".`,
          `Header row located at CSV row ${header.rowIndex + 1}.`,
        ],
      };
    } catch {
      continue;
    }
  }

  throw new Error("Could not find a valid AR aging sheet in prepared text blocks.");
}
