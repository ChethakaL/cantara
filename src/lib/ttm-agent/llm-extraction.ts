/**
 * LLM-first valuation pipeline for Cantara.
 *
 * Hybrid approach: Claude handles parsing / extraction / understanding of
 * messy financial data; deterministic TypeScript handles all arithmetic.
 */

import Anthropic from "@anthropic-ai/sdk";
import * as XLSX from "xlsx";
import { CANTARA_TAXONOMY, type TaxonomyEntry } from "@/lib/ttm-agent/taxonomy";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractedFinancials {
  periods: Array<{
    label: string; // "FY1 (Jan 2019 - Dec 2019)" etc
    startMonth: string; // "2019-01"
    endMonth: string; // "2019-12"
  }>;
  ttmPeriod: { startMonth: string; endMonth: string } | null;
  annualData: Array<{
    period: string; // "FY1", "FY2", "FY3"
    revenue: number;
    cogs: number;
    grossProfit: number;
    totalOpEx: number;
    netIncome: number;
    revenueBreakdown: Array<{ category: string; amount: number }>;
    expenseBreakdown: Array<{
      category: string;
      amount: number;
      cantaraCode: string | null;
    }>;
  }>;
  ttmData: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    totalOpEx: number;
    netIncome: number;
  } | null;
  glMapping: Array<{
    accountName: string;
    cantaraCode: string;
    confidence: number;
  }>;
  extraordinaryRevenue?: Array<{
    description: string;
    amount: number;
    period: string; // "FY1", "FY2", etc.
  }>;
  notes: string[];
}

export interface ExtractedAddbacks {
  sourceA: Array<{
    category: string;
    description: string;
    classification: "SOURCE_A";
    byPeriod: Record<string, number>;
  }>;
  sourceB: Array<{
    category: string;
    description: string;
    classification: "SOURCE_B";
    byPeriod: Record<string, number>;
  }>;
  sourceC: Array<{
    category: string;
    description: string;
    classification: "SOURCE_C";
    byPeriod: Record<string, number>;
  }>;
  notes: string[];
}

export interface ValuationResult {
  periods: string[]; // ["LTM", "FY3", "FY2", "FY1"]
  preRecast: Record<string, number>;
  sourceA: Record<string, number>;
  sourceB: Record<string, number>;
  sourceC: Record<string, number>;
  replacement: Record<string, number>;
  totalAdjustments: Record<string, number>;
  normalizedEbitda: Record<string, number>;
  fourWallEbitda: Record<string, number>;
  valuation: Record<string, { low: number; mid: number; high: number }>;
  normalizedMargin: Record<string, number>;
  revenue: Record<string, number>;
  normLines: Array<{
    id: string;
    description: string;
    source: string;
    byPeriod: Record<string, number>;
  }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LLM_MODEL = "claude-sonnet-4-20250514";
const LLM_TEMPERATURE = 0;
const LLM_MAX_TOKENS = 8192;

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set. Cannot run LLM extraction.");
  }
  return new Anthropic({ apiKey });
}

/**
 * Build a compact text summary of the Cantara taxonomy so Claude can map
 * GL account names to Cantara codes.
 */
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

/**
 * Convert an Excel file buffer to a plain text representation that Claude
 * can read. Outputs tab-separated values with clear headers.
 */
export function excelToText(buffer: Buffer, sheetName?: string): string {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

  // Fix QuickBooks formula exports where cells have formulas like =38579.70 but cached value is 0
  for (const wsName of workbook.SheetNames) {
    const ws = workbook.Sheets[wsName];
    const ref = ws?.['!ref'];
    if (!ref) continue;
    const range = XLSX.utils.decode_range(ref);
    const fixedCells = new Set<string>();
    // Pass 1: fix simple numeric formulas and clear stale formatted values
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (!cell || !cell.f) continue;
        delete cell.w;
        const f = cell.f.trim();
        const parsed = Number(f);
        if (!isNaN(parsed) && f !== '') {
          cell.v = parsed; cell.t = 'n'; fixedCells.add(addr);
        }
      }
    }
    // Multi-pass: resolve sum-of-references formulas
    if (fixedCells.size > 0) {
      for (let pass = 0; pass < 10; pass++) {
        let resolved = 0;
        for (let r = range.s.r; r <= range.e.r; r++) {
          for (let c = range.s.c; c <= range.e.c; c++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            const cell = ws[addr];
            if (!cell || !cell.f || fixedCells.has(addr)) continue;
            if (cell.v !== 0 && cell.v !== null && typeof cell.v === 'number' && cell.v !== 0) continue;
            const formula = cell.f.replace(/\s/g, '');
            const refs = formula.match(/[A-Z]+\d+/g);
            if (!refs) continue;
            const cleaned = formula.replace(/[A-Z]+\d+/g, '0').replace(/[()+-]/g, '').replace(/^0+$/, '');
            if (cleaned !== '' && cleaned !== '0') continue;
            let sum = 0; let valid = true;
            for (const cellRef of refs) {
              const refCell = ws[cellRef];
              if (!refCell || refCell.v === undefined || refCell.v === null) { sum += 0; continue; }
              if (typeof refCell.v !== 'number') { valid = false; break; }
              sum += refCell.v;
            }
            if (valid) { cell.v = sum; cell.t = 'n'; fixedCells.add(addr); resolved++; }
          }
        }
        if (resolved === 0) break;
      }
    }
  }

  const sheetsToProcess = sheetName
    ? [sheetName]
    : workbook.SheetNames;

  const sections: string[] = [];

  for (const name of sheetsToProcess) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      rawNumbers: true,
      blankrows: false,
    });

    if (rows.length === 0) continue;

    const lines: string[] = [`=== SHEET: ${name} ===`, ""];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = row.map((cell) => {
        if (cell === null || cell === undefined) return "";
        if (cell instanceof Date) {
          return cell.toISOString().slice(0, 10);
        }
        if (typeof cell === "number") {
          return Number.isInteger(cell) ? String(cell) : cell.toFixed(2);
        }
        return String(cell).trim();
      });
      lines.push(cells.join("\t"));
    }

    sections.push(lines.join("\n"));
  }

  return sections.join("\n\n");
}

// ---------------------------------------------------------------------------
// Function 1: Extract financials via LLM
// ---------------------------------------------------------------------------

const FINANCIALS_SYSTEM_PROMPT = `You are a senior M&A financial analyst at Cantara Pet Advisors.

METHODOLOGY (Craig's approach):
- Identify the most recent 3 complete fiscal years from the data. Label them FY1 (oldest), FY2, FY3 (most recent).
- If data contains monthly figures, aggregate into annual totals for each fiscal year.
- TTM (Trailing Twelve Months) = the most recent 12 consecutive months of data, which may span two fiscal years.
- Revenue = total top-line income.
- COGS = cost of goods sold / direct costs.
- Gross Profit = Revenue - COGS.
- Total OpEx = all operating expenses BELOW gross profit (salaries, rent, utilities, etc.).
- Net Income = bottom-line profit (or the figure labeled "Net Income", "Net Ordinary Income", or "Net Profit").

IMPORTANT RULES:
- Identify at most 3 fiscal years (the 3 most recent complete years).
- Each fiscal year is typically Jan-Dec or matches the company's fiscal calendar.
- For TTM: use the trailing 12 months from the latest month with data.
- Map every GL account name to a Cantara taxonomy code using the reference below.
- For accounts you cannot confidently map, use the closest match and set confidence < 0.7.
- Include ALL revenue in the total revenue figure — including extraordinary items such as PPP grants/loans forgiven, insurance proceeds, one-time government payments, EIDL grants, and any other non-recurring revenue.
- Flag extraordinary revenue items separately in the "extraordinaryRevenue" array. These are revenue items that inflate top-line revenue but would not recur under normal operations (PPP, EIDL, insurance payouts, legal settlements received, one-time government grants, etc.).

${buildTaxonomyReference()}

OUTPUT FORMAT:
Only return valid JSON matching the schema below. No markdown fences, no commentary.

{
  "periods": [
    { "label": "FY1 (Jan 2021 - Dec 2021)", "startMonth": "2021-01", "endMonth": "2021-12" }
  ],
  "ttmPeriod": { "startMonth": "2023-02", "endMonth": "2024-01" } | null,
  "annualData": [
    {
      "period": "FY1",
      "revenue": 0,
      "cogs": 0,
      "grossProfit": 0,
      "totalOpEx": 0,
      "netIncome": 0,
      "revenueBreakdown": [{ "category": "Boarding Revenue", "amount": 0 }],
      "expenseBreakdown": [{ "category": "Staff Wages", "amount": 0, "cantaraCode": "OPX-LABOR-STAFF" }]
    }
  ],
  "ttmData": { "revenue": 0, "cogs": 0, "grossProfit": 0, "totalOpEx": 0, "netIncome": 0 } | null,
  "glMapping": [{ "accountName": "Boarding Income", "cantaraCode": "REV-BOARD", "confidence": 0.95 }],
  "extraordinaryRevenue": [
    { "description": "PPP Loan Forgiveness", "amount": 150000, "period": "FY2" }
  ],
  "notes": ["any observations about data quality or assumptions made"]
}`;

export async function extractFinancialsWithLLM(
  plData: string,
  bsData: string | null,
): Promise<ExtractedFinancials> {
  const client = getClient();

  const userContent = [
    "Here is the Profit & Loss data:\n\n" + plData,
    bsData
      ? "\n\nHere is the Balance Sheet data:\n\n" + bsData
      : "\n\n(No Balance Sheet data provided.)",
    "\n\nPlease extract the structured financial data as JSON.",
  ].join("");

  try {
    const response = await client.messages.create({
      model: LLM_MODEL,
      temperature: LLM_TEMPERATURE,
      max_tokens: LLM_MAX_TOKENS,
      system: FINANCIALS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Strip any accidental markdown fences
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    const parsed: ExtractedFinancials = JSON.parse(cleaned);

    // Basic validation
    if (!Array.isArray(parsed.periods) || !Array.isArray(parsed.annualData)) {
      throw new Error(
        "LLM response missing required arrays: periods, annualData",
      );
    }

    return parsed;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown LLM error";
    throw new Error(`extractFinancialsWithLLM failed: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Function 2: Extract addbacks via LLM
// ---------------------------------------------------------------------------

const ADDBACKS_SYSTEM_PROMPT = `You are a senior M&A financial analyst at Cantara Pet Advisors classifying owner addback expenses.

CRAIG'S ADDBACK METHODOLOGY:

SOURCE A — Personal Expenses Run Through the Business
These are personal/owner expenses that were booked to the business P&L but are NOT true operating costs.
Examples: owner meals, personal travel, personal vet bills, donations, gifts, home utilities, home repairs, personal office supplies, personal professional fees.
These are added BACK to EBITDA because a new owner would not incur them.

SOURCE B — Owner Payroll / Compensation
Owner draws, officer wages, S-corp distributions, owner health insurance, owner payroll taxes.
These are added back because a new owner replaces owner comp with a market-rate replacement salary.
IMPORTANT: Shareholder draws/payments are absolute values — both positive and negative entries represent owner compensation. Always use absolute values for Source B.

SOURCE C — One-Off Non-Recurring Expenses
Extraordinary, non-recurring charges that won't repeat under normal operations: leasehold improvements, legal settlements, one-time equipment purchases, buildout costs, exchange gains/losses.
These are SUBTRACTED (negative) from normalized EBITDA because they inflate historical costs artificially.

RULES:
- Only include addback entries within the fiscal year periods provided. Ignore entries after the last fiscal year end date.
- For Retained Earnings closing entries, use them as fiscal year totals.
- Each entry must have amounts for each fiscal year period (FY1, FY2, FY3) and optionally TTM.
- If an entry has no amount for a given period, use 0.
- ALSO scan the P&L expense breakdown (if provided) for personal/owner expenses that should be Source A addbacks: donations, gifts, personal meals, personal travel, personal vet, home office, personal repairs, personal utilities, personal professional fees, etc.
- CRITICAL: Do NOT double-count. If an expense appears in BOTH the Owner Expenses file AND the P&L, include it ONCE (prefer the Owner Expenses file amount). Only add P&L items that are NOT already covered by the Owner Expenses file.

OUTPUT FORMAT:
Only return valid JSON. No markdown fences, no commentary.

{
  "sourceA": [
    { "category": "Personal Meals", "description": "Owner dining expenses", "classification": "SOURCE_A", "byPeriod": { "FY1": 1200, "FY2": 1500, "FY3": 800, "TTM": 900 } }
  ],
  "sourceB": [
    { "category": "Owner Draws", "description": "Shareholder distributions", "classification": "SOURCE_B", "byPeriod": { "FY1": 50000, "FY2": 55000, "FY3": 60000, "TTM": 62000 } }
  ],
  "sourceC": [
    { "category": "Buildout Costs", "description": "One-time leasehold improvements", "classification": "SOURCE_C", "byPeriod": { "FY1": -15000, "FY2": 0, "FY3": 0, "TTM": 0 } }
  ],
  "notes": ["any observations"]
}`;

export async function extractAddbacksWithLLM(
  ownerExpensesData: string,
  oneOffData: string | null,
  periods: ExtractedFinancials["periods"],
  plExpenseData?: string | null,
): Promise<ExtractedAddbacks> {
  const client = getClient();

  const periodContext = periods
    .map((p) => `${p.label} — ${p.startMonth} to ${p.endMonth}`)
    .join("\n");

  const userContent = [
    `FISCAL YEAR PERIODS:\n${periodContext}\n\n`,
    "OWNER / PERSONAL EXPENSES DATA:\n\n" + ownerExpensesData,
    oneOffData
      ? "\n\nONE-OFF / NON-RECURRING EXPENSES DATA:\n\n" + oneOffData
      : "\n\n(No one-off expense data provided.)",
    plExpenseData
      ? "\n\nP&L EXPENSE BREAKDOWN (scan for additional personal/owner expenses not in the Owner Expenses file above):\n\n" + plExpenseData + "\n\nIMPORTANT: Only add P&L items as Source A if they are clearly personal/owner expenses (e.g., personal meals, personal travel, donations, gifts, home office). Do NOT double-count items that already appear in the Owner Expenses data above. If an expense category appears in BOTH the P&L and the Owner Expenses file, only include it once (use the Owner Expenses amount as it has more detail)."
      : "",
    "\n\nClassify all addback items into Source A, B, and C and return JSON.",
  ].join("");

  try {
    const response = await client.messages.create({
      model: LLM_MODEL,
      temperature: LLM_TEMPERATURE,
      max_tokens: LLM_MAX_TOKENS,
      system: ADDBACKS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    const parsed: ExtractedAddbacks = JSON.parse(cleaned);

    // Validate structure
    if (
      !Array.isArray(parsed.sourceA) ||
      !Array.isArray(parsed.sourceB) ||
      !Array.isArray(parsed.sourceC)
    ) {
      throw new Error(
        "LLM response missing required arrays: sourceA, sourceB, sourceC",
      );
    }

    // Ensure Source B amounts are absolute values
    for (const item of parsed.sourceB) {
      for (const key of Object.keys(item.byPeriod)) {
        item.byPeriod[key] = Math.abs(item.byPeriod[key]);
      }
    }

    // Ensure Source C amounts are negative
    for (const item of parsed.sourceC) {
      for (const key of Object.keys(item.byPeriod)) {
        if (item.byPeriod[key] > 0) {
          item.byPeriod[key] = -item.byPeriod[key];
        }
      }
    }

    return parsed;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown LLM error";
    throw new Error(`extractAddbacksWithLLM failed: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Function 3: Deterministic valuation computation (NO LLM)
// ---------------------------------------------------------------------------

export function computeValuation(
  financials: ExtractedFinancials,
  addbacks: ExtractedAddbacks,
  assumptions: {
    multipleLow: number;
    multipleMid: number;
    multipleHigh: number;
    replacementSalary?: number;
  },
): ValuationResult {
  const replacementSalary = assumptions.replacementSalary ?? 20_000;

  // Build period list: LTM first if available, then FY3, FY2, FY1
  const fyPeriods = financials.annualData
    .map((d) => d.period)
    .sort()
    .reverse(); // FY3, FY2, FY1

  const periods: string[] = [];
  if (financials.ttmData) periods.push("LTM");
  periods.push(...fyPeriods);

  // Helpers to sum addback items for a period key
  function sumSource(
    items: Array<{ byPeriod: Record<string, number> }>,
    periodKey: string,
  ): number {
    return items.reduce((acc, item) => acc + (item.byPeriod[periodKey] ?? 0), 0);
  }

  function mapPeriodToAddbackKey(period: string): string {
    if (period === "LTM") return "TTM";
    return period; // "FY1", "FY2", "FY3"
  }

  // Initialize result records
  const preRecast: Record<string, number> = {};
  const sourceA: Record<string, number> = {};
  const sourceB: Record<string, number> = {};
  const sourceC: Record<string, number> = {};
  const replacement: Record<string, number> = {};
  const totalAdjustments: Record<string, number> = {};
  const normalizedEbitda: Record<string, number> = {};
  const fourWallEbitda: Record<string, number> = {};
  const valuation: Record<string, { low: number; mid: number; high: number }> = {};
  const normalizedMargin: Record<string, number> = {};
  const revenue: Record<string, number> = {};

  // Build norm lines (individual addback line items)
  const normLines: ValuationResult["normLines"] = [];

  // Collect all individual addback entries as normLines
  let lineIdx = 0;
  for (const item of addbacks.sourceA) {
    normLines.push({
      id: `A-${lineIdx++}`,
      description: item.description || item.category,
      source: "SOURCE_A",
      byPeriod: { ...item.byPeriod },
    });
  }
  for (const item of addbacks.sourceB) {
    normLines.push({
      id: `B-${lineIdx++}`,
      description: item.description || item.category,
      source: "SOURCE_B",
      byPeriod: { ...item.byPeriod },
    });
  }
  for (const item of addbacks.sourceC) {
    normLines.push({
      id: `C-${lineIdx++}`,
      description: item.description || item.category,
      source: "SOURCE_C",
      byPeriod: { ...item.byPeriod },
    });
  }

  // Add extraordinary revenue items as Source C deductions (they inflate revenue and need normalizing out)
  if (financials.extraordinaryRevenue && financials.extraordinaryRevenue.length > 0) {
    for (const item of financials.extraordinaryRevenue) {
      const byPeriod: Record<string, number> = {};
      for (const period of periods) {
        const addbackKey = mapPeriodToAddbackKey(period);
        // Match the period label (e.g. "FY2") to the extraordinary item's period
        byPeriod[addbackKey] = item.period === addbackKey ? -Math.abs(item.amount) : 0;
      }
      addbacks.sourceC.push({
        category: "Extraordinary Revenue",
        description: item.description,
        classification: "SOURCE_C",
        byPeriod,
      });
      normLines.push({
        id: `C-EXTREV-${lineIdx++}`,
        description: `Extraordinary Revenue: ${item.description}`,
        source: "SOURCE_C",
        byPeriod,
      });
    }
  }

  // Add Owner Replacement Salary as a normLine
  const replacementLine: Record<string, number> = {};
  for (const period of periods) {
    replacementLine[period] = period === "LTM" ? 0 : -replacementSalary;
  }
  normLines.push({
    id: "REPL",
    description: "Owner Replacement Salary",
    source: "REPLACEMENT",
    byPeriod: replacementLine,
  });

  // Compute per-period
  for (const period of periods) {
    const addbackKey = mapPeriodToAddbackKey(period);

    // Revenue and Pre-Recast (Net Income)
    if (period === "LTM" && financials.ttmData) {
      revenue[period] = financials.ttmData.revenue;
      preRecast[period] = financials.ttmData.netIncome;
    } else {
      const annualEntry = financials.annualData.find(
        (d) => d.period === period,
      );
      revenue[period] = annualEntry?.revenue ?? 0;
      preRecast[period] = annualEntry?.netIncome ?? 0;
    }

    // Addback totals
    sourceA[period] = sumSource(addbacks.sourceA, addbackKey);
    sourceB[period] = sumSource(addbacks.sourceB, addbackKey);
    sourceC[period] = sumSource(addbacks.sourceC, addbackKey); // already negative

    // Replacement salary: $0 for LTM, negative for FY periods
    replacement[period] = period === "LTM" ? 0 : -replacementSalary;

    // Total Adjustments = A + B + Replacement + C
    totalAdjustments[period] =
      sourceA[period] + sourceB[period] + replacement[period] + sourceC[period];

    // Normalized EBITDA = Pre-Recast + Total Adjustments
    normalizedEbitda[period] = preRecast[period] + totalAdjustments[period];

    // 4-Wall EBITDA = Normalized - Replacement (subtracting a negative = adding back)
    fourWallEbitda[period] = normalizedEbitda[period] - replacement[period];

    // Valuation = Normalized EBITDA * multiples
    valuation[period] = {
      low: normalizedEbitda[period] * assumptions.multipleLow,
      mid: normalizedEbitda[period] * assumptions.multipleMid,
      high: normalizedEbitda[period] * assumptions.multipleHigh,
    };

    // Normalized margin = Normalized EBITDA / Revenue
    normalizedMargin[period] =
      revenue[period] !== 0
        ? normalizedEbitda[period] / revenue[period]
        : 0;
  }

  return {
    periods,
    preRecast,
    sourceA,
    sourceB,
    sourceC,
    replacement,
    totalAdjustments,
    normalizedEbitda,
    fourWallEbitda,
    valuation,
    normalizedMargin,
    revenue,
    normLines,
  };
}
