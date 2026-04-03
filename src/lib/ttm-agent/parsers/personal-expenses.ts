/**
 * Parser for Owner Expenses / Addback files.
 *
 * Handles three distinct formats:
 *
 * FORMAT 1: QB Transaction Report (e.g., Foothills Owner Expenses List)
 *   - Category headers in column 0 (e.g., "Donations", "   Church")
 *   - Transaction rows: [blank] | Date | Type | Num | Name | Memo | Account | Split | Amount | Balance
 *   - "Total for X" subtotal rows
 *   - Nested sub-categories (indented)
 *   - Dates: MM/DD/YYYY or Mon-YYYY
 *
 * FORMAT 2: Shareholder Remuneration (e.g., Grand Shareholder Remuneration)
 *   - Row 0: Company name, Row 1: "Transaction Report"
 *   - Row 4: Headers: "" | Date | Transaction Type | Num | Name | Memo/Description | Split | Amount
 *   - Category headers like "Donna Harris - Draw" followed by indented transaction rows
 *   - Dates: Excel serial numbers (e.g., 43465.00 = 12/31/2018)
 *   - ALL entries are addbacks (shareholder draws/payments)
 *
 * FORMAT 3: Owner Discretionary (e.g., Sample #2 Owner Discretionary Expense Details)
 *   - Multiple sections, each starting with a category header in ALL CAPS
 *     (e.g., "OWNER CELL PHONE EXPENSE", "OWNER VEHICLE MILEAGE FOR BUSINESS")
 *   - Each section has its own "Retained Earnings" and "Total" rows
 *   - Dates: Excel serial numbers
 *   - Amounts scattered across columns
 *
 * Returns per-top-level-category amounts bucketed by fiscal year.
 *
 * DATE BOUNDARY ENFORCEMENT: Transactions after the P&L end date are excluded.
 */

import type { PreparedDocumentInput } from "@/lib/ttm-agent/types";

export interface PersonalExpenseCategory {
  category: string;
  subCategories: string[];
  ttmAmount: number;
  fy3Amount: number;
  fy2Amount: number;
  fy1Amount: number;
  transactionCount: number;
}

export interface ParsedPersonalExpenses {
  categories: PersonalExpenseCategory[];
  totalTtm: number;
  totalFy3: number;
  totalFy2: number;
  totalFy1: number;
  dateRange: { earliest: string; latest: string };
}

// ── Date Parsing ─────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/**
 * Convert an Excel serial date number to a YYYY-MM string.
 * Excel serial: days since 1900-01-01 (with the 1900 leap year bug).
 */
function excelSerialToMonth(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 30000 || serial > 60000) return null;
  const excelEpoch = new Date(1900, 0, 1);
  const date = new Date(excelEpoch.getTime() + (serial - 2) * 86400000);
  if (isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Parse any date format we encounter into a YYYY-MM string.
 * Handles: MM/DD/YYYY, Mon DD YYYY, Mon-YYYY, Excel serial numbers.
 */
function parseDateToMonth(value: string): string | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;

  // Excel serial date number (e.g., 43465.00 or 44286)
  const numVal = Number(trimmed.replace(/\.0+$/, ""));
  if (Number.isFinite(numVal) && numVal > 30000 && numVal < 60000) {
    return excelSerialToMonth(numVal);
  }

  // MM/DD/YYYY or M/D/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) return `${slashMatch[3]}-${slashMatch[1].padStart(2, "0")}`;

  // M/D/YY or MM/DD/YY (2-digit year)
  const slash2 = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (slash2) {
    const yr = Number(slash2[3]);
    const fullYear = yr >= 50 ? 1900 + yr : 2000 + yr;
    return `${fullYear}-${slash2[1].padStart(2, "0")}`;
  }

  // "Mon DD, YYYY" or "Mon DD YYYY" (e.g., "Jan 15, 2022")
  const longMatch = trimmed.match(/^([A-Za-z]{3})\s+\d{1,2},?\s+(\d{4})$/);
  if (longMatch) {
    const mm = MONTH_MAP[longMatch[1].toLowerCase()];
    if (mm) return `${longMatch[2]}-${mm}`;
  }

  // Mon-YYYY (e.g., "Jan-2022")
  const monMatch = trimmed.match(/^([A-Za-z]{3})-(\d{4})$/);
  if (monMatch) {
    const mm = MONTH_MAP[monMatch[1].toLowerCase()];
    if (mm) return `${monMatch[2]}-${mm}`;
  }

  return null;
}

function parseAmount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const cleaned = String(value ?? "").replace(/[$,]/g, "").replace(/^\((.*)\)$/, "-$1").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// ── CSV Parsing ──────────────────────────────────────────────────────────────

function parseCSVRows(doc: PreparedDocumentInput): string[][] {
  const allRows: string[][] = [];
  for (const block of doc.textBlocks ?? []) {
    const lines = block.text.split("\n");
    for (const line of lines) {
      const cells: string[] = [];
      let cell = "";
      let inQuote = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuote) {
          if (ch === '"' && line[i + 1] === '"') { cell += '"'; i++; }
          else if (ch === '"') { inQuote = false; }
          else { cell += ch; }
        } else {
          if (ch === '"') { inQuote = true; }
          else if (ch === ",") { cells.push(cell.trim()); cell = ""; }
          else { cell += ch; }
        }
      }
      cells.push(cell.trim());
      allRows.push(cells);
    }
  }
  return allRows;
}

// ── Format Detection ─────────────────────────────────────────────────────────

type AddbackFormat = "qb-transaction-report" | "shareholder-remuneration" | "owner-discretionary";

function detectFormat(allRows: string[][]): AddbackFormat {
  // Check top ~10 rows for format clues
  const top10 = allRows.slice(0, 10).map(r => r.map(c => String(c ?? "").trim()));

  // Format 3: Owner Discretionary — first row is ALL CAPS category header
  // like "OWNER CELL PHONE EXPENSE" or "OWNER VEHICLE MILEAGE FOR BUSINESS"
  const row0Text = top10[0]?.join(" ").trim() ?? "";
  if (/^OWNER\s/i.test(row0Text) && row0Text === row0Text.toUpperCase() && row0Text.length > 5) {
    console.log(`[Personal Expenses] Detected format: owner-discretionary (row0="${row0Text.slice(0, 60)}")`);
    return "owner-discretionary";
  }

  // Format 2: Shareholder Remuneration — row 1 contains "Transaction Report"
  // and header row has "Memo/Description" or "Split" but NOT "Balance"
  const row1Text = top10[1]?.join(" ").trim() ?? "";
  if (/transaction\s*report/i.test(row1Text)) {
    // Check if header row has "Split" without "Balance" — this is Shareholder format
    for (let i = 2; i < Math.min(allRows.length, 8); i++) {
      const rowText = allRows[i].map(c => String(c ?? "").trim().toLowerCase()).join("|");
      if (/date/.test(rowText) && /amount/.test(rowText)) {
        const hasBalance = /balance/.test(rowText);
        if (!hasBalance) {
          console.log(`[Personal Expenses] Detected format: shareholder-remuneration (row1="${row1Text.slice(0, 60)}")`);
          return "shareholder-remuneration";
        }
      }
    }
  }

  // Also detect shareholder format by checking for Excel serial dates in early data rows
  // (after header) combined with "Transaction Report" or draw/shareholder keywords in top rows
  for (const row of top10) {
    const text = row.join(" ").toLowerCase();
    if (/shareholder|remuneration|draw/.test(text)) {
      // Look for Excel serial dates in data rows
      for (let i = 5; i < Math.min(allRows.length, 20); i++) {
        const dateCell = String(allRows[i]?.[1] ?? "").trim();
        const numVal = Number(dateCell.replace(/\.0+$/, ""));
        if (Number.isFinite(numVal) && numVal > 30000 && numVal < 60000) {
          console.log(`[Personal Expenses] Detected format: shareholder-remuneration (serial dates + shareholder keyword)`);
          return "shareholder-remuneration";
        }
      }
    }
  }

  // Also check: if many rows have ALL CAPS section headers scattered through the file
  let allCapsHeaderCount = 0;
  for (let i = 0; i < Math.min(allRows.length, 50); i++) {
    const cellText = String(allRows[i]?.[0] ?? "").trim();
    if (cellText.length > 10 && cellText === cellText.toUpperCase() && /^[A-Z\s]+$/.test(cellText)) {
      allCapsHeaderCount++;
    }
  }
  if (allCapsHeaderCount >= 2) {
    console.log(`[Personal Expenses] Detected format: owner-discretionary (${allCapsHeaderCount} ALL CAPS headers)`);
    return "owner-discretionary";
  }

  // Default: Format 1 — standard QB Transaction Report
  console.log(`[Personal Expenses] Detected format: qb-transaction-report`);
  return "qb-transaction-report";
}

// ── Compute the P&L end month boundary ───────────────────────────────────────

function computeMaxMonth(
  ttmMonths: string[],
  fyRanges: Array<{ label: string; months: string[] }>,
): string | null {
  // The max month is the latest month across all FY ranges and TTM months.
  // This ensures we never include transactions beyond what the P&L covers.
  let maxMonth = "0000-00";
  for (const m of ttmMonths) {
    if (m > maxMonth) maxMonth = m;
  }
  for (const fy of fyRanges) {
    for (const m of fy.months) {
      if (m > maxMonth) maxMonth = m;
    }
  }
  return maxMonth > "0000-00" ? maxMonth : null;
}

// ── Format 1: QB Transaction Report ──────────────────────────────────────────

function parseQBTransactionReport(
  allRows: string[][],
  ttmMonths: string[],
  fyRanges: Array<{ label: string; months: string[] }>,
  maxMonth: string | null,
): ParsedPersonalExpenses {
  const empty: ParsedPersonalExpenses = {
    categories: [], totalTtm: 0, totalFy3: 0, totalFy2: 0, totalFy1: 0,
    dateRange: { earliest: "", latest: "" },
  };

  // Find the header row (contains "Date" and "Amount")
  let headerIdx = -1;
  let dateCol = -1;
  let amountCol = -1;
  for (let i = 0; i < Math.min(allRows.length, 10); i++) {
    const row = allRows[i];
    const dIdx = row.findIndex(c => /^date$/i.test(c.trim()));
    const aIdx = row.findIndex(c => /^amount$/i.test(c.trim()));
    if (dIdx >= 0 && aIdx >= 0) {
      headerIdx = i;
      dateCol = dIdx;
      amountCol = aIdx;
      break;
    }
  }
  if (headerIdx < 0) {
    console.log("[Personal Expenses/QB] Could not find header row with Date and Amount columns");
    return empty;
  }

  const categoryStack: string[] = [];
  const categoryData = new Map<string, { subCats: Set<string>; ttm: number; fy3: number; fy2: number; fy1: number; count: number }>();
  let earliest = "9999-99";
  let latest = "0000-00";
  let skippedBeyondBoundary = 0;

  for (let i = headerIdx + 1; i < allRows.length; i++) {
    const row = allRows[i];
    const col0 = String(row[0] ?? "").trimEnd();
    const col0Trimmed = col0.trim();
    const dateCell = String(row[dateCol] ?? "").trim();
    const rawAmount = row[amountCol];

    if (!col0Trimmed && !dateCell) continue;
    if (/^Total/i.test(col0Trimmed)) continue;
    if (/^TOTAL$/i.test(col0Trimmed)) break;

    // Category header detection
    const looksLikeDate = /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(col0Trimmed) || /^\d{5}$/.test(col0Trimmed);
    const hasAmount = rawAmount !== undefined && String(rawAmount) !== "" && rawAmount !== null && Number(rawAmount) !== 0;
    if (col0Trimmed && !looksLikeDate && !hasAmount) {
      const indent = col0.length - col0.trimStart().length;
      if (indent === 0) {
        categoryStack.length = 0;
        categoryStack.push(col0Trimmed);
      } else if (indent <= 3) {
        categoryStack.length = 1;
        categoryStack.push(col0Trimmed);
      } else {
        if (categoryStack.length < 2) categoryStack.push(col0Trimmed);
        else { categoryStack.length = 2; categoryStack.push(col0Trimmed); }
      }
      continue;
    }

    // Transaction row
    if (!dateCell) continue;
    const month = parseDateToMonth(dateCell);
    if (!month) continue;

    // DATE BOUNDARY ENFORCEMENT: skip transactions beyond P&L end date
    if (maxMonth && month > maxMonth) {
      skippedBeyondBoundary++;
      continue;
    }

    const amount = parseAmount(row[amountCol]);
    if (amount === 0) continue;

    if (month < earliest) earliest = month;
    if (month > latest) latest = month;

    const topCategory = categoryStack[0] ?? "Unknown";
    const subCategory = categoryStack.slice(1).join(" > ");

    if (!categoryData.has(topCategory)) {
      categoryData.set(topCategory, { subCats: new Set(), ttm: 0, fy3: 0, fy2: 0, fy1: 0, count: 0 });
    }
    const data = categoryData.get(topCategory)!;
    if (subCategory) data.subCats.add(subCategory);
    data.count++;

    if (ttmMonths.includes(month)) data.ttm += amount;
    if (fyRanges[2]?.months.includes(month)) data.fy3 += amount;
    if (fyRanges[1]?.months.includes(month)) data.fy2 += amount;
    if (fyRanges[0]?.months.includes(month)) data.fy1 += amount;
  }

  if (skippedBeyondBoundary > 0) {
    console.log(`[Personal Expenses/QB] Skipped ${skippedBeyondBoundary} transactions beyond P&L boundary (maxMonth=${maxMonth})`);
  }

  return buildResult(categoryData, earliest, latest, "QB");
}

// ── Format 2: Shareholder Remuneration ───────────────────────────────────────

function parseShareholderRemuneration(
  allRows: string[][],
  ttmMonths: string[],
  fyRanges: Array<{ label: string; months: string[] }>,
  maxMonth: string | null,
): ParsedPersonalExpenses {
  const empty: ParsedPersonalExpenses = {
    categories: [], totalTtm: 0, totalFy3: 0, totalFy2: 0, totalFy1: 0,
    dateRange: { earliest: "", latest: "" },
  };

  // Find header row — look for row with "Date" and "Amount" columns
  let headerIdx = -1;
  let dateCol = -1;
  let amountCol = -1;
  for (let i = 0; i < Math.min(allRows.length, 10); i++) {
    const row = allRows[i];
    const dIdx = row.findIndex(c => /^date$/i.test(c.trim()));
    const aIdx = row.findIndex(c => /^amount$/i.test(c.trim()));
    if (dIdx >= 0 && aIdx >= 0) {
      headerIdx = i;
      dateCol = dIdx;
      amountCol = aIdx;
      break;
    }
  }

  // Fallback: row 4 with standard column layout
  if (headerIdx < 0) {
    headerIdx = 4;
    dateCol = 1;
    amountCol = 7;
    console.log(`[Personal Expenses/Shareholder] No header found, using positional: headerIdx=4, dateCol=1, amountCol=7`);
  }

  let currentCategory = "Shareholder Remuneration";
  const categoryData = new Map<string, { subCats: Set<string>; ttm: number; fy3: number; fy2: number; fy1: number; count: number }>();
  let earliest = "9999-99";
  let latest = "0000-00";
  let skippedBeyondBoundary = 0;

  for (let i = headerIdx + 1; i < allRows.length; i++) {
    const row = allRows[i];
    const col0 = String(row[0] ?? "").trim();
    const dateCell = String(row[dateCol] ?? "").trim();

    if (!col0 && !dateCell) continue;
    if (/^Total/i.test(col0)) continue;
    if (/^TOTAL$/i.test(col0)) break;

    // Category header: text in col0, no date, no amount in amount column
    const amountVal = parseAmount(row[amountCol]);
    if (col0 && !dateCell && amountVal === 0) {
      // This is a category header like "Donna Harris - Draw"
      currentCategory = col0;
      continue;
    }

    // Transaction row: needs a parseable date
    if (!dateCell) continue;
    const month = parseDateToMonth(dateCell);
    if (!month) continue;

    // DATE BOUNDARY ENFORCEMENT
    if (maxMonth && month > maxMonth) {
      skippedBeyondBoundary++;
      continue;
    }

    // Try amount from the designated column; if 0, scan rightmost non-empty numeric column
    let amount = parseAmount(row[amountCol]);
    if (amount === 0) {
      for (let c = row.length - 1; c > dateCol; c--) {
        const v = parseAmount(row[c]);
        if (v !== 0) { amount = v; break; }
      }
    }
    if (amount === 0) continue;

    if (month < earliest) earliest = month;
    if (month > latest) latest = month;

    if (!categoryData.has(currentCategory)) {
      categoryData.set(currentCategory, { subCats: new Set(), ttm: 0, fy3: 0, fy2: 0, fy1: 0, count: 0 });
    }
    const data = categoryData.get(currentCategory)!;
    data.count++;

    // For shareholder remuneration, ALL transactions represent owner compensation.
    // Draws are negative (cash out), salary is positive (expense). Both are addbacks.
    // Use absolute value so draws don't cancel out salary.
    const absAmount = Math.abs(amount);
    if (ttmMonths.includes(month)) data.ttm += absAmount;
    if (fyRanges[2]?.months.includes(month)) data.fy3 += absAmount;
    if (fyRanges[1]?.months.includes(month)) data.fy2 += absAmount;
    if (fyRanges[0]?.months.includes(month)) data.fy1 += absAmount;
  }

  if (skippedBeyondBoundary > 0) {
    console.log(`[Personal Expenses/Shareholder] Skipped ${skippedBeyondBoundary} transactions beyond P&L boundary (maxMonth=${maxMonth})`);
  }

  return buildResult(categoryData, earliest, latest, "Shareholder");
}

// ── Format 3: Owner Discretionary ────────────────────────────────────────────

function parseOwnerDiscretionary(
  allRows: string[][],
  ttmMonths: string[],
  fyRanges: Array<{ label: string; months: string[] }>,
  maxMonth: string | null,
): ParsedPersonalExpenses {
  const categoryData = new Map<string, { subCats: Set<string>; ttm: number; fy3: number; fy2: number; fy1: number; count: number }>();
  let earliest = "9999-99";
  let latest = "0000-00";
  let skippedBeyondBoundary = 0;

  let currentCategory = "Unknown";

  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i];
    const col0 = String(row[0] ?? "").trim();

    // Detect ALL CAPS section header
    if (col0.length > 5 && col0 === col0.toUpperCase() && /^[A-Z][A-Z\s\/&\-]+$/.test(col0) && !/^TOTAL/.test(col0) && !/^RETAINED/.test(col0)) {
      // Clean up the category name: title case
      currentCategory = col0.split(/\s+/).map(w =>
        w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      ).join(" ");
      console.log(`[Personal Expenses/Discretionary] Section: "${currentCategory}" at row ${i}`);
      continue;
    }

    // Skip "Total" summary rows (we use individual entries or closing entries instead)
    const col1 = String(row[1] ?? "").trim();
    const col2 = String(row[2] ?? "").trim();
    if (/^total/i.test(col0)) continue;
    if (/^total\s+retained/i.test(col1)) continue;
    if (/^total\s/i.test(col2)) continue;

    // "Retained Earnings" is a parent label — skip the label row itself
    if (col1 === "Retained Earnings" && !String(row[5] ?? "").trim()) continue;

    // Try to find a date and amount in any column of this row
    let month: string | null = null;
    let amount = 0;

    // Scan all cells for a date
    for (let c = 0; c < row.length; c++) {
      const cellVal = String(row[c] ?? "").trim();
      if (!cellVal) continue;
      const m = parseDateToMonth(cellVal);
      if (m) { month = m; break; }
    }

    if (!month) continue;

    // For "Closing Entry" rows (Retained Earnings year-end rollups),
    // the date is the FY end date and the amount is the annual total.
    // These are valid addback entries — they represent the yearly total
    // for categories that only have closing entries (e.g., Vehicle Mileage, Home Office).
    const isClosingEntry = row.some(c => /closing entry/i.test(String(c ?? "")));

    // DATE BOUNDARY ENFORCEMENT
    if (maxMonth && month > maxMonth) {
      skippedBeyondBoundary++;
      continue;
    }

    // Scan all cells for amounts (skip the date cell). Take the last non-zero numeric value.
    for (let c = 0; c < row.length; c++) {
      const cellVal = String(row[c] ?? "").trim();
      // Skip if this cell was our date
      if (parseDateToMonth(cellVal)) continue;
      const v = parseAmount(row[c]);
      if (v !== 0) amount = v;
    }

    if (amount === 0) continue;

    // Use absolute value for closing entries (they represent yearly totals)
    if (isClosingEntry) amount = Math.abs(amount);

    if (month < earliest) earliest = month;
    if (month > latest) latest = month;

    if (!categoryData.has(currentCategory)) {
      categoryData.set(currentCategory, { subCats: new Set(), ttm: 0, fy3: 0, fy2: 0, fy1: 0, count: 0 });
    }
    const data = categoryData.get(currentCategory)!;
    data.count++;

    if (ttmMonths.includes(month)) data.ttm += amount;
    if (fyRanges[2]?.months.includes(month)) data.fy3 += amount;
    if (fyRanges[1]?.months.includes(month)) data.fy2 += amount;
    if (fyRanges[0]?.months.includes(month)) data.fy1 += amount;
  }

  if (skippedBeyondBoundary > 0) {
    console.log(`[Personal Expenses/Discretionary] Skipped ${skippedBeyondBoundary} transactions beyond P&L boundary (maxMonth=${maxMonth})`);
  }

  return buildResult(categoryData, earliest, latest, "Discretionary");
}

// ── Build Result ─────────────────────────────────────────────────────────────

function buildResult(
  categoryData: Map<string, { subCats: Set<string>; ttm: number; fy3: number; fy2: number; fy1: number; count: number }>,
  earliest: string,
  latest: string,
  formatLabel: string,
): ParsedPersonalExpenses {
  const categories: PersonalExpenseCategory[] = [];
  for (const [cat, data] of Array.from(categoryData.entries())) {
    categories.push({
      category: cat,
      subCategories: Array.from(data.subCats),
      ttmAmount: data.ttm,
      fy3Amount: data.fy3,
      fy2Amount: data.fy2,
      fy1Amount: data.fy1,
      transactionCount: data.count,
    });
  }

  // Sort by absolute TTM amount descending
  categories.sort((a, b) => Math.abs(b.ttmAmount) - Math.abs(a.ttmAmount));

  const result: ParsedPersonalExpenses = {
    categories,
    totalTtm: categories.reduce((s, c) => s + c.ttmAmount, 0),
    totalFy3: categories.reduce((s, c) => s + c.fy3Amount, 0),
    totalFy2: categories.reduce((s, c) => s + c.fy2Amount, 0),
    totalFy1: categories.reduce((s, c) => s + c.fy1Amount, 0),
    dateRange: {
      earliest: earliest === "9999-99" ? "" : earliest,
      latest: latest === "0000-00" ? "" : latest,
    },
  };

  console.log(`[Personal Expenses/${formatLabel}] Parsed ${categories.length} categories, TTM total=$${result.totalTtm.toFixed(0)}`);
  for (const cat of categories) {
    if (cat.ttmAmount !== 0 || cat.fy1Amount !== 0 || cat.fy2Amount !== 0 || cat.fy3Amount !== 0) {
      console.log(`[Personal Expenses/${formatLabel}]   ${cat.category}: TTM=$${cat.ttmAmount.toFixed(0)}, FY3=$${cat.fy3Amount.toFixed(0)}, FY2=$${cat.fy2Amount.toFixed(0)}, FY1=$${cat.fy1Amount.toFixed(0)} (${cat.transactionCount} txns)`);
    }
  }

  return result;
}

// ── Main Entry Point ─────────────────────────────────────────────────────────

export function parsePersonalExpenses(
  doc: PreparedDocumentInput | undefined,
  ttmMonths: string[],
  fyRanges: Array<{ label: string; months: string[] }>,
): ParsedPersonalExpenses {
  const empty: ParsedPersonalExpenses = {
    categories: [],
    totalTtm: 0, totalFy3: 0, totalFy2: 0, totalFy1: 0,
    dateRange: { earliest: "", latest: "" },
  };
  if (!doc?.textBlocks?.length) return empty;

  const allRows = parseCSVRows(doc);
  if (allRows.length === 0) return empty;

  // Compute the P&L date boundary — no transactions beyond this month
  const maxMonth = computeMaxMonth(ttmMonths, fyRanges);
  if (maxMonth) {
    console.log(`[Personal Expenses] P&L date boundary: maxMonth=${maxMonth}`);
  }

  // Detect format and dispatch
  const format = detectFormat(allRows);

  switch (format) {
    case "qb-transaction-report":
      return parseQBTransactionReport(allRows, ttmMonths, fyRanges, maxMonth);
    case "shareholder-remuneration":
      return parseShareholderRemuneration(allRows, ttmMonths, fyRanges, maxMonth);
    case "owner-discretionary":
      return parseOwnerDiscretionary(allRows, ttmMonths, fyRanges, maxMonth);
    default:
      console.log(`[Personal Expenses] Unknown format, falling back to QB Transaction Report parser`);
      return parseQBTransactionReport(allRows, ttmMonths, fyRanges, maxMonth);
  }
}
