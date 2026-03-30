/**
 * Parser for QB Transaction Report format (Personal Expenses / Owner Expenses List).
 *
 * Structure:
 *   - Category headers in column 0 (e.g., "Donations", "   Church")
 *   - Transaction rows: [blank] | Date | Type | Num | Name | Memo | Account | Split | Amount | Balance
 *   - "Total for X" subtotal rows
 *   - Nested sub-categories (indented)
 *
 * Returns per-top-level-category TTM amounts.
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

function parseDateToMonth(value: string): string | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  // MM/DD/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) return `${slashMatch[3]}-${slashMatch[1].padStart(2, "0")}`;
  // Mon-YYYY
  const monMatch = trimmed.match(/^([A-Za-z]{3})-(\d{4})$/);
  if (monMatch) {
    const months: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
    const mm = months[monMatch[1].toLowerCase()];
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

function monthInRange(month: string, start: string, end: string): boolean {
  return month >= start && month <= end;
}

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

  // Parse CSV from text blocks
  const allRows: string[][] = [];
  for (const block of doc.textBlocks) {
    const lines = block.text.split("\n");
    for (const line of lines) {
      // Simple CSV parse (handles basic quoting)
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
    console.log("[Personal Expenses Parser] Could not find header row with Date and Amount columns");
    return empty;
  }

  // Parse transactions grouped by top-level category
  const categoryStack: string[] = [];
  const categoryData = new Map<string, { subCats: Set<string>; ttm: number; fy3: number; fy2: number; fy1: number; count: number }>();
  let earliest = "9999-99";
  let latest = "0000-00";

  for (let i = headerIdx + 1; i < allRows.length; i++) {
    const row = allRows[i];
    const col0 = String(row[0] ?? "").trimEnd(); // preserve leading spaces for indent detection
    const col0Trimmed = col0.trim();
    const dateCell = String(row[dateCol] ?? "").trim();
    const amountCell = row[amountCol];

    // Skip empty rows
    if (!col0Trimmed && !dateCell) continue;

    // "Total for X" rows — skip
    if (/^Total for/i.test(col0Trimmed)) continue;

    // TOTAL row at end
    if (/^TOTAL$/i.test(col0Trimmed)) break;

    // Category header: has text in col0, no date
    if (col0Trimmed && !dateCell) {
      // Determine indent level (rough: count leading spaces)
      const indent = col0.length - col0.trimStart().length;
      if (indent === 0) {
        // Top-level category
        categoryStack.length = 0;
        categoryStack.push(col0Trimmed);
      } else if (indent <= 3) {
        // Sub-category level 1
        categoryStack.length = 1;
        categoryStack.push(col0Trimmed);
      } else {
        // Deeper sub-category
        if (categoryStack.length < 2) categoryStack.push(col0Trimmed);
        else { categoryStack.length = 2; categoryStack.push(col0Trimmed); }
      }
      continue;
    }

    // Transaction row: has a date
    if (!dateCell) continue;
    const month = parseDateToMonth(dateCell);
    if (!month) continue;

    const amount = parseAmount(amountCell);
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
    dateRange: { earliest, latest },
  };

  console.log(`[Personal Expenses] Parsed ${categories.length} categories, ${categoryData.size} unique, TTM total=$${result.totalTtm.toFixed(0)}`);
  for (const cat of categories) {
    if (cat.ttmAmount !== 0) {
      console.log(`[Personal Expenses]   ${cat.category}: TTM=$${cat.ttmAmount.toFixed(0)}, FY3=$${cat.fy3Amount.toFixed(0)}, FY2=$${cat.fy2Amount.toFixed(0)}, FY1=$${cat.fy1Amount.toFixed(0)} (${cat.transactionCount} txns)`);
    }
  }

  return result;
}
