/**
 * Parser for One-Off Non-Recurring Expenses file.
 *
 * Structure:
 *   Header row: # | Date | Vendor | Description | Recorded In (GL Path) | Amount | Notes
 *   Rows: individual events with dates and amounts
 *   PPP/ERC are positive one-offs (income to REMOVE from EBITDA)
 *   Repair events etc. are expenses to ADD BACK
 *   FY subtotals at bottom
 */

import type { PreparedDocumentInput } from "@/lib/ttm-agent/types";

export interface OneOffItem {
  index: number;
  date: string;
  vendor: string;
  description: string;
  glPath: string;
  amount: number;
  notes: string;
  type: "income-remove" | "expense-addback";
  month: string | null;
}

export interface ParsedOneOffExpenses {
  incomeToRemove: OneOffItem[];
  expensesToAddBack: OneOffItem[];
  ttmIncomeToRemove: number;
  ttmExpensesToAddBack: number;
}

function parseDateToMonth(value: string): string | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;

  // Excel serial date number (e.g., 43584 = 2019-04-29)
  const numVal = Number(trimmed);
  if (Number.isFinite(numVal) && numVal > 30000 && numVal < 60000) {
    // Excel serial: days since 1900-01-01 (with the 1900 leap year bug)
    const excelEpoch = new Date(1900, 0, 1);
    const date = new Date(excelEpoch.getTime() + (numVal - 2) * 86400000);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  // MM/DD/YYYY or M/D/YYYY (4-digit year)
  const slash4 = trimmed.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slash4) return `${slash4[3]}-${slash4[1].padStart(2, "0")}`;

  // M/D/YY or MM/DD/YY (2-digit year)
  const slash2 = trimmed.match(/(\d{1,2})\/(\d{1,2})\/(\d{2})(?:\s|$|[^0-9])/);
  if (slash2) {
    const yr = Number(slash2[3]);
    const fullYear = yr >= 50 ? 1900 + yr : 2000 + yr;
    return `${fullYear}-${slash2[1].padStart(2, "0")}`;
  }

  // Mon-YYYY (exact)
  const monMatch = trimmed.match(/^([A-Za-z]{3})-(\d{4})$/i);
  if (monMatch) {
    const months: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
    const mm = months[monMatch[1].toLowerCase()];
    if (mm) return `${monMatch[2]}-${mm}`;
  }

  // "Apr-Jun 2020" or "Jan-Jul 2020" — use first month
  const rangeMatch = trimmed.match(/([A-Za-z]{3}).*?(\d{4})/);
  if (rangeMatch) {
    const months: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
    const mm = months[rangeMatch[1].toLowerCase()];
    if (mm) return `${rangeMatch[2]}-${mm}`;
  }

  // Just a year "2021"
  const yearMatch = trimmed.match(/(\d{4})/);
  if (yearMatch) return `${yearMatch[1]}-01`;
  return null;
}

function parseAmount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const cleaned = String(value ?? "").replace(/[$,]/g, "").replace(/^\((.*)\)$/, "-$1").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function parseOneOffExpenses(
  doc: PreparedDocumentInput | undefined,
  ttmMonths: string[],
): ParsedOneOffExpenses {
  const empty: ParsedOneOffExpenses = { incomeToRemove: [], expensesToAddBack: [], ttmIncomeToRemove: 0, ttmExpensesToAddBack: 0 };
  if (!doc?.textBlocks?.length) return empty;

  const allRows: string[][] = [];
  for (const block of doc.textBlocks) {
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

  // Find header row
  let headerIdx = -1;
  let dateCol = 1, vendorCol = 2, descCol = 3, glCol = 4, amountCol = 5, notesCol = 6;
  for (let i = 0; i < Math.min(allRows.length, 10); i++) {
    const row = allRows[i];
    if (row.some(c => /^date$/i.test(c.trim())) && row.some(c => /amount/i.test(c.trim()))) {
      headerIdx = i;
      dateCol = row.findIndex(c => /^date$/i.test(c.trim()));
      vendorCol = row.findIndex(c => /vendor|payee/i.test(c.trim()));
      descCol = row.findIndex(c => /description|memo/i.test(c.trim()));
      glCol = row.findIndex(c => /recorded|gl|account/i.test(c.trim()));
      amountCol = row.findIndex(c => /^amount$/i.test(c.trim()));
      notesCol = row.findIndex(c => /notes|reason/i.test(c.trim()));
      break;
    }
  }
  if (headerIdx < 0) {
    // Try positional: row 5 with # | Date | Vendor | Description | GL | Amount | Notes
    headerIdx = 5;
  }

  const incomeToRemove: OneOffItem[] = [];
  const expensesToAddBack: OneOffItem[] = [];
  let itemIdx = 0;

  for (let i = headerIdx + 1; i < allRows.length; i++) {
    const row = allRows[i];
    const first = String(row[0] ?? "").trim();
    // Skip empty, subtotal, section header rows
    if (!first && !String(row[dateCol] ?? "").trim()) continue;
    if (/subtotal|total$/i.test(first)) continue;
    if (/^FY\s*\d|^Period|^Note:|^NON-RECURRING|^SECTION/i.test(first)) continue;
    if (/^#$/i.test(first)) continue; // header row echo

    const date = String(row[dateCol] ?? row[1] ?? "").trim();
    const amount = parseAmount(row[amountCol] ?? row[5]);
    if (amount === 0) continue;

    const vendor = String(row[vendorCol] ?? row[2] ?? "").trim();
    const description = String(row[descCol] ?? row[3] ?? "").trim();
    const glPath = String(row[glCol] ?? row[4] ?? "").trim();
    const notes = String(row[notesCol] ?? row[6] ?? "").trim();
    const month = parseDateToMonth(date);

    itemIdx++;
    const item: OneOffItem = { index: itemIdx, date, vendor, description, glPath, amount, notes, type: "expense-addback", month };

    // Classify: PPP, ERC, insurance settlements = income to remove
    if (/PPP|Paycheck Protection|Employee Retention|ERC|pandemic|forgiv/i.test(description + " " + notes + " " + glPath)) {
      item.type = "income-remove";
      incomeToRemove.push(item);
      console.log(`[One-Off] INCOME TO REMOVE: ${date} "${description}" $${amount}`);
    } else {
      expensesToAddBack.push(item);
      console.log(`[One-Off] EXPENSE ADD-BACK: ${date} "${description}" $${amount} (month=${month})`);
    }
  }

  const ttmIncome = incomeToRemove.filter(i => i.month && ttmMonths.includes(i.month)).reduce((s, i) => s + i.amount, 0);
  const ttmExpense = expensesToAddBack.filter(i => i.month && ttmMonths.includes(i.month)).reduce((s, i) => s + i.amount, 0);

  console.log(`[One-Off] Total: ${incomeToRemove.length} income items, ${expensesToAddBack.length} expense items. TTM income=$${ttmIncome.toFixed(0)}, TTM expense=$${ttmExpense.toFixed(0)}`);

  return { incomeToRemove, expensesToAddBack, ttmIncomeToRemove: ttmIncome, ttmExpensesToAddBack: ttmExpense };
}
