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
  "sales",
  "cost of goods sold",
  "cogs",
  "expense",
  "expenses",
  "operating expenses",
  "other income",
  "other expense",
  "gross profit",
  "net income",
];

const AR_BUCKET_ALIASES: Array<{ key: keyof Omit<ParsedArAging["entries"][number], "customerName" | "total">; matches: string[] }> = [
  { key: "current", matches: ["current"] },
  { key: "days1To30", matches: ["1-30", "1 - 30", "1 to 30", "30 days"] },
  { key: "days31To60", matches: ["31-60", "31 - 60", "31 to 60", "60 days"] },
  { key: "days61To90", matches: ["61-90", "61 - 90", "61 to 90", "90 days"] },
  { key: "days90Plus", matches: ["90+", ">90", "over 90", "91+", "91 and over"] },
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

  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 12); rowIndex += 1) {
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

function findAccountColumn(headerRow: WorksheetRows[number], monthColumns: number[]) {
  const firstMonthColumn = Math.min(...monthColumns);
  let accountColumnIndex = -1;
  let codeColumnIndex: number | null = null;

  for (let index = 0; index < firstMonthColumn; index += 1) {
    const normalized = normalizeText(headerRow[index]);
    if (!normalized) continue;
    if (/(gl|acct|account no|account number|code)/.test(normalized) && codeColumnIndex === null) {
      codeColumnIndex = index;
      continue;
    }
    if (/(account|description|line item|name)/.test(normalized)) {
      accountColumnIndex = index;
    }
  }

  if (accountColumnIndex === -1) {
    accountColumnIndex = Math.max(0, firstMonthColumn - 1);
  }

  if (codeColumnIndex === accountColumnIndex) {
    codeColumnIndex = null;
  }

  return { accountColumnIndex, codeColumnIndex };
}

function shouldSkipLedgerRow(accountName: string, accountCode: string | null, values: number[]) {
  const normalizedName = normalizeText(accountName);
  const hasNumbers = values.some((value) => Number.isFinite(value));
  if (!normalizedName || !hasNumbers) return true;

  if (!accountCode && PL_SECTION_HEADERS.includes(normalizedName)) {
    return true;
  }

  if (/^total\b/.test(normalizedName)) {
    return true;
  }

  if (/(gross profit|net income|net ordinary income|ordinary income|ebitda|pre recast|subtotal)/.test(normalizedName)) {
    return true;
  }

  return false;
}

function deriveFormat(headerRow: WorksheetRows[number], codeColumnIndex: number | null) {
  if (codeColumnIndex !== null) return "qb" as const;
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
  const { accountColumnIndex, codeColumnIndex } = findAccountColumn(headerRow, section.monthColumns);
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

  for (let rowIndex = section.headerRowIndex + 1; rowIndex < section.rows.length; rowIndex += 1) {
    const row = section.rows[rowIndex] ?? [];
    const accountName = String(row[accountColumnIndex] ?? "").trim();
    const accountCode = codeColumnIndex === null ? null : String(row[codeColumnIndex] ?? "").trim() || null;

    const values = Array.from(monthIndexMap.entries()).map(([columnIndex]) => parseNumber(row[columnIndex]));
    if (shouldSkipLedgerRow(accountName, accountCode, values)) continue;

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
  const selected = chooseBestMonthlySheet(workbook, documentId);
  const headerRow = selected.rows[selected.headerRowIndex] ?? [];
  const { accountColumnIndex, codeColumnIndex } = findAccountColumn(headerRow, selected.monthColumns);
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

  for (let rowIndex = selected.headerRowIndex + 1; rowIndex < selected.rows.length; rowIndex += 1) {
    const row = selected.rows[rowIndex] ?? [];
    const accountName = String(row[accountColumnIndex] ?? "").trim();
    const accountCode = codeColumnIndex === null ? null : String(row[codeColumnIndex] ?? "").trim() || null;

    const values = Array.from(monthIndexMap.entries()).map(([columnIndex]) => parseNumber(row[columnIndex]));
    if (shouldSkipLedgerRow(accountName, accountCode, values)) continue;

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
  const { accountColumnIndex, codeColumnIndex } = findAccountColumn(headerRow, selected.monthColumns);
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

  for (let rowIndex = selected.headerRowIndex + 1; rowIndex < selected.rows.length; rowIndex += 1) {
    const row = selected.rows[rowIndex] ?? [];
    const accountName = String(row[accountColumnIndex] ?? "").trim();
    const accountCode = codeColumnIndex === null ? null : String(row[codeColumnIndex] ?? "").trim() || null;

    const values = Array.from(monthIndexMap.entries()).map(([columnIndex]) => parseNumber(row[columnIndex]));
    if (shouldSkipLedgerRow(accountName, accountCode, values)) continue;

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

export function parseArAgingWorkbook(buffer: Buffer): ParsedArAging {
  const workbook = readWorkbook(buffer);

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
        if (/^total\b/.test(normalizedCustomer)) continue;

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
        if (/^total\b/.test(normalizedCustomer)) continue;

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
