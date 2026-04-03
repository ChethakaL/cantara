/**
 * WS2-2 Deterministic Extraction — v4 (EBITDA + Valuation fixes)
 *
 * Reference files: Foothills Pet Resort + Grand Pet Hotel valuations
 *
 * METHODOLOGY:
 * Pre-Recast = Raw Net Income from the P&L (NOT "Net Ordinary Income" unless "Net Income" missing)
 *   - Uses the workbook's "Net Income" summary row
 *   - Includes pandemic relief (PPP/ERC)
 *   - LTM: uses TTM summary netIncome (now computed in reconciler), else last FY's netIncome
 *
 * Source A = Owner personal expenses (non-payroll) from Owner Expenses Transaction Report
 * Source B = ALL owner payroll from Owner Expenses Transaction Report (full scope)
 * Source C = One-off non-recurring expenses as NEGATIVE deductions per year (LTM = $0)
 * Owner Replacement Salary = negative deduction ($0 LTM, -$20K prior FY)
 *
 * Normalized EBITDA = Pre-Recast + Source A + Source B - Replacement - Source C
 * 4-Wall EBITDA = Normalized EBITDA + Owner Replacement Salary
 *   (adds back the replacement salary that was deducted in Normalized)
 * Valuation = Normalized EBITDA x Multiple (default 4.5x)
 */

import type { TtmAnalysisView, Ws2RecastAssumptions, PreparedDocumentInput } from "@/lib/ttm-agent/types";
import { parsePersonalExpenses } from "@/lib/ttm-agent/parsers/personal-expenses";
import { parseOneOffExpenses } from "@/lib/ttm-agent/parsers/one-off-expenses";
import { classifyCategories, type ClassificationResult } from "@/lib/ttm-agent/category-classifier";

// ── Types ──────────────────────────────────────────────────────────────────

export interface NormLine {
  id: string;
  category: string;
  description: string;
  glRef: string;
  ltm: number; fy3: number; fy2: number; fy1: number;
  status: string;
}

export interface DeterministicSchedule {
  normLines: NormLine[];
  totalLtm: number; totalFy3: number; totalFy2: number; totalFy1: number;
  preRecastLtm: number; preRecastFy3: number; preRecastFy2: number; preRecastFy1: number;
  normEbitdaLtm: number; normEbitdaFy3: number; normEbitdaFy2: number; normEbitdaFy1: number;
  fourWallLtm: number; fourWallFy3: number; fourWallFy2: number; fourWallFy1: number;
  valuationLtm: number; valuationFy3: number; valuationFy2: number; valuationFy1: number;
  scheduleMarkdown: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildMonthRange(start: string, end: string): string[] {
  const months: string[] = [];
  if (!start || !end) return months;
  let [y, m] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return months;
}

const fmt$ = (v: number) => v < 0
  ? `($${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 })})`
  : `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

// ── Category Classification ────────────────────────────────────────────────

// Category classification is handled dynamically by the LLM classifier
// (see category-classifier.ts). No hardcoded category sets.

// ── Main Function ──────────────────────────────────────────────────────────

export async function buildDeterministicSchedule(args: {
  analysis: TtmAnalysisView;
  assumptions: Ws2RecastAssumptions;
  personalExpensesDoc: PreparedDocumentInput | undefined;
  shareholderDoc?: PreparedDocumentInput | undefined;
  oneOffDoc: PreparedDocumentInput | undefined;
}): Promise<DeterministicSchedule> {
  const { analysis, assumptions } = args;

  // ── STEP 1: Periods ──────────────────────────────────────────────────
  const ttmMonths = analysis.ttmSummary
    ? buildMonthRange(analysis.ttmSummary.startMonth, analysis.ttmSummary.endMonth)
    : [];
  const annualYears = analysis.annualModel?.years ?? [];
  const fyMonthRanges = annualYears.map(y =>
    y.periodStart && y.periodEnd ? buildMonthRange(y.periodStart, y.periodEnd) : []
  );
  const fyRanges = annualYears.map((y, i) => ({
    label: y.fiscalYear ?? `FY${i + 1}`,
    months: fyMonthRanges[i] ?? [],
  }));
  const fyLabels = annualYears.map(y => y.fiscalYear ?? y.periodStart?.slice(0, 4) ?? "FY");

  // ── Parse inputs ─────────────────────────────────────────────────────
  const pe = parsePersonalExpenses(args.personalExpensesDoc, ttmMonths, fyRanges);

  // If a separate shareholder remuneration doc is provided, parse it and merge
  if (args.shareholderDoc?.textBlocks?.length) {
    const shPe = parsePersonalExpenses(args.shareholderDoc, ttmMonths, fyRanges);
    if (shPe.categories.length > 0) {
      console.log(`[WS2-2] Merging ${shPe.categories.length} shareholder categories into personal expenses`);
      pe.categories.push(...shPe.categories);
      pe.totalTtm += shPe.totalTtm;
      pe.totalFy3 += shPe.totalFy3;
      pe.totalFy2 += shPe.totalFy2;
      pe.totalFy1 += shPe.totalFy1;
      if (shPe.dateRange.earliest && (!pe.dateRange.earliest || shPe.dateRange.earliest < pe.dateRange.earliest)) {
        pe.dateRange.earliest = shPe.dateRange.earliest;
      }
      if (shPe.dateRange.latest && (!pe.dateRange.latest || shPe.dateRange.latest > pe.dateRange.latest)) {
        pe.dateRange.latest = shPe.dateRange.latest;
      }
    }
  }

  const oo = parseOneOffExpenses(args.oneOffDoc, ttmMonths);

  // ── Classify categories using LLM (with fallback) ───────────────────
  const classification = await classifyCategories(pe.categories);
  console.log(`[WS2-2] Classification: ${classification.sourceBCategories.size} Source B, ${classification.sourceACategories.size} Source A, ${classification.skipCategories.size} Skip`);

  // ── STEP 2: Pre-Recast = Raw Net Income from P&L ──────────────────────
  // Use the NET INCOME row from the P&L (includes Other Income like PPP/ERC).
  // WS2-1's reconciler computes `netIncome` for each annual year AND for the
  // TTM summary from the workbook's "Net Income" row (preferred) or
  // "Net Ordinary Income" row (fallback).
  //
  // FY Pre-Recast: use netIncome directly from the annual model year.
  // netIncome is already typed on AnnualModelYear — no `as any` cast needed.
  // If netIncome is null, fall back to ebitdaPreRecast (approximation).
  const preRecastFy1 = annualYears[0]?.netIncome ?? annualYears[0]?.ebitdaPreRecast ?? 0;
  const preRecastFy2 = annualYears[1]?.netIncome ?? annualYears[1]?.ebitdaPreRecast ?? 0;
  const preRecastFy3 = annualYears[2]?.netIncome ?? annualYears[2]?.ebitdaPreRecast ?? 0;

  // LTM Pre-Recast: prefer the TTM summary's netIncome (computed consistently
  // with the annual model in reconciler.ts). Fall back to the last available
  // fiscal year's netIncome. When there are fewer than 3 fiscal years, this
  // correctly uses whatever is available (e.g. FY1 if only 1 year of data).
  const lastYear = annualYears[annualYears.length - 1];
  const preRecastLtm =
    analysis.ttmSummary?.netIncome ??
    lastYear?.netIncome ??
    lastYear?.ebitdaPreRecast ??
    0;

  console.log(`[WS2-2] Pre-Recast (Net Income): LTM=${fmt$(preRecastLtm)} FY3=${fmt$(preRecastFy3)} FY2=${fmt$(preRecastFy2)} FY1=${fmt$(preRecastFy1)}`);
  console.log(`[WS2-2] (Used netIncome: LTM=${analysis.ttmSummary?.netIncome != null} FY1=${annualYears[0]?.netIncome != null} FY2=${annualYears[1]?.netIncome != null} FY3=${annualYears[2]?.netIncome != null})`);

  // ── BUILD NORMALIZATION LINES ────────────────────────────────────────
  const normLines: NormLine[] = [];

  // ── SOURCE B: Total Payroll (from Owner Expenses file) ───────────────
  let bLtm = 0, bFy3 = 0, bFy2 = 0, bFy1 = 0;
  for (const cat of pe.categories) {
    if (classification.sourceBCategories.has(cat.category)) {
      bLtm += cat.ttmAmount;
      bFy3 += cat.fy3Amount;
      bFy2 += cat.fy2Amount;
      bFy1 += cat.fy1Amount;
    }
  }
  console.log(`[WS2-2] Source B: LTM=${fmt$(bLtm)} FY3=${fmt$(bFy3)} FY2=${fmt$(bFy2)} FY1=${fmt$(bFy1)}`);
  // Log components
  for (const cat of pe.categories) {
    if (classification.sourceBCategories.has(cat.category) && (cat.ttmAmount || cat.fy1Amount || cat.fy2Amount || cat.fy3Amount)) {
      console.log(`[WS2-2]   B: ${cat.category}: FY3=${fmt$(cat.fy3Amount)} FY2=${fmt$(cat.fy2Amount)} FY1=${fmt$(cat.fy1Amount)}`);
    }
  }

  if (bLtm || bFy3 || bFy2 || bFy1) {
    normLines.push({ id: "1a", category: "Owner Compensation", description: "Total Payroll Expenses", glRef: "Source B", ltm: bLtm, fy3: bFy3, fy2: bFy2, fy1: bFy1, status: "FROM-DISCLOSURE" });
  }

  // Owner Replacement Salary
  const repl = assumptions.replacementSalary ?? 0;
  const priorRepl = repl > 0 ? -repl : -20000;
  normLines.push({ id: "1b", category: "Owner Compensation", description: "Owner Replacement Salary", glRef: "—", ltm: 0, fy3: priorRepl, fy2: priorRepl, fy1: priorRepl, status: "DEFAULT" });

  // ── SOURCE A: Personal Expenses (non-payroll) ────────────────────────
  let idx = 0;
  for (const cat of pe.categories) {
    if (classification.sourceBCategories.has(cat.category)) continue;
    if (classification.skipCategories.has(cat.category)) continue;
    if (!cat.ttmAmount && !cat.fy1Amount && !cat.fy2Amount && !cat.fy3Amount) continue;
    idx++;
    normLines.push({
      id: `2${String.fromCharCode(96 + Math.min(idx, 26))}`,
      category: "Personal Expenses",
      description: cat.category,
      glRef: "Source A",
      ltm: cat.ttmAmount, fy3: cat.fy3Amount, fy2: cat.fy2Amount, fy1: cat.fy1Amount,
      status: "FROM-DISCLOSURE",
    });
  }

  // ── SOURCE C: One-Off Deductions (NEGATIVE, per year, LTM = $0) ──────
  const cByYear = { fy3: 0, fy2: 0, fy1: 0 };
  for (const item of oo.expensesToAddBack) {
    if (!item.month) continue;
    // Negative = deduction from normalized EBITDA
    if (fyMonthRanges[2]?.includes(item.month)) cByYear.fy3 -= item.amount;
    if (fyMonthRanges[1]?.includes(item.month)) cByYear.fy2 -= item.amount;
    if (fyMonthRanges[0]?.includes(item.month)) cByYear.fy1 -= item.amount;
  }

  // Log each item for verification
  for (const item of oo.expensesToAddBack) {
    console.log(`[WS2-2] Source C item: ${item.date} "${item.description.slice(0, 50)}" $${item.amount} [${item.glPath}] month=${item.month}`);
  }

  if (cByYear.fy3 || cByYear.fy2 || cByYear.fy1) {
    normLines.push({
      id: "3a", category: "One-Off Expenses", description: "One-Off Non-Recurring", glRef: "Source C",
      ltm: 0, fy3: cByYear.fy3, fy2: cByYear.fy2, fy1: cByYear.fy1, // LTM hardcoded to $0
      status: "VERIFIED",
    });
    console.log(`[WS2-2] Source C: LTM=$0 FY3=${fmt$(cByYear.fy3)} FY2=${fmt$(cByYear.fy2)} FY1=${fmt$(cByYear.fy1)}`);
  }

  // ── STEP 4: Totals ──────────────────────────────────────────────────
  const totalLtm = normLines.reduce((s, l) => s + l.ltm, 0);
  const totalFy3 = normLines.reduce((s, l) => s + l.fy3, 0);
  const totalFy2 = normLines.reduce((s, l) => s + l.fy2, 0);
  const totalFy1 = normLines.reduce((s, l) => s + l.fy1, 0);

  // Normalized EBITDA = Pre-Recast + Total Adjustments
  // (Adjustments include Source A + Source B - Replacement - Source C)
  const normEbitdaLtm = preRecastLtm + totalLtm;
  const normEbitdaFy3 = preRecastFy3 + totalFy3;
  const normEbitdaFy2 = preRecastFy2 + totalFy2;
  const normEbitdaFy1 = preRecastFy1 + totalFy1;

  // 4-Wall EBITDA = Normalized EBITDA + Owner Replacement Salary
  // This adds back the replacement salary that was deducted in Normalized.
  // LTM replacement is $0, so 4-Wall LTM = Normalized LTM.
  // For prior FYs, replacement was deducted as priorRepl (negative), so
  // adding it back means subtracting that negative value.
  const fourWallLtm = normEbitdaLtm; // LTM replacement = $0, so 4-Wall = Normalized
  const fourWallFy3 = normEbitdaFy3 - priorRepl; // subtract the negative = add back
  const fourWallFy2 = normEbitdaFy2 - priorRepl;
  const fourWallFy1 = normEbitdaFy1 - priorRepl;

  // Valuation = Normalized EBITDA x Multiple
  const multLow = assumptions.multipleLow ?? 0;
  const multMid = assumptions.multipleMid ?? 0;
  const multHigh = assumptions.multipleHigh ?? 0;
  const mult = multMid; // keep for backward compat
  const valuationLtm = normEbitdaLtm * mult;
  const valuationFy3 = normEbitdaFy3 * mult;
  const valuationFy2 = normEbitdaFy2 * mult;
  const valuationFy1 = normEbitdaFy1 * mult;
  // Range valuations
  const valRangeLtm = { low: normEbitdaLtm * multLow, mid: normEbitdaLtm * multMid, high: normEbitdaLtm * multHigh };
  const valRangeFy3 = { low: normEbitdaFy3 * multLow, mid: normEbitdaFy3 * multMid, high: normEbitdaFy3 * multHigh };
  const valRangeFy2 = { low: normEbitdaFy2 * multLow, mid: normEbitdaFy2 * multMid, high: normEbitdaFy2 * multHigh };
  const valRangeFy1 = { low: normEbitdaFy1 * multLow, mid: normEbitdaFy1 * multMid, high: normEbitdaFy1 * multHigh };
  const fmtRange = (r: { low: number; mid: number; high: number }) => `${fmt$(r.low)} – ${fmt$(r.high)}`;
  const multRange = multLow > 0 && multHigh > 0 ? `${multLow.toFixed(1)}x – ${multHigh.toFixed(1)}x` : `${mult.toFixed(1)}x`;

  console.log(`[WS2-2] ═══════════════════════════════════════════════`);
  console.log(`[WS2-2] Pre-Recast:  LTM=${fmt$(preRecastLtm)} | ${fyLabels[2] ?? "FY3"}=${fmt$(preRecastFy3)} | ${fyLabels[1] ?? "FY2"}=${fmt$(preRecastFy2)} | ${fyLabels[0] ?? "FY1"}=${fmt$(preRecastFy1)}`);
  console.log(`[WS2-2] Adjustments: LTM=${fmt$(totalLtm)} | ${fyLabels[2] ?? "FY3"}=${fmt$(totalFy3)} | ${fyLabels[1] ?? "FY2"}=${fmt$(totalFy2)} | ${fyLabels[0] ?? "FY1"}=${fmt$(totalFy1)}`);
  console.log(`[WS2-2] Normalized:  LTM=${fmt$(normEbitdaLtm)} | ${fyLabels[2] ?? "FY3"}=${fmt$(normEbitdaFy3)} | ${fyLabels[1] ?? "FY2"}=${fmt$(normEbitdaFy2)} | ${fyLabels[0] ?? "FY1"}=${fmt$(normEbitdaFy1)}`);
  console.log(`[WS2-2] 4-Wall:      LTM=${fmt$(fourWallLtm)} | ${fyLabels[2] ?? "FY3"}=${fmt$(fourWallFy3)} | ${fyLabels[1] ?? "FY2"}=${fmt$(fourWallFy2)} | ${fyLabels[0] ?? "FY1"}=${fmt$(fourWallFy1)}`);
  console.log(`[WS2-2] Valuation:   LTM=${fmt$(valuationLtm)} | ${fyLabels[2] ?? "FY3"}=${fmt$(valuationFy3)} | ${fyLabels[1] ?? "FY2"}=${fmt$(valuationFy2)} | ${fyLabels[0] ?? "FY1"}=${fmt$(valuationFy1)}`);
  console.log(`[WS2-2] ═══════════════════════════════════════════════`);
  for (const l of normLines) {
    console.log(`[WS2-2]   ${l.id} ${l.description}: LTM=${fmt$(l.ltm)} ${fyLabels[2] ?? "FY3"}=${fmt$(l.fy3)} ${fyLabels[1] ?? "FY2"}=${fmt$(l.fy2)} ${fyLabels[0] ?? "FY1"}=${fmt$(l.fy1)}`);
  }

  // ── STEP 9: Format ──────────────────────────────────────────────────
  const md = [
    `| # | Category | Item | Source | LTM | ${fyLabels[2] ?? "FY3"} | ${fyLabels[1] ?? "FY2"} | ${fyLabels[0] ?? "FY1"} | Status |`,
    `|---|---|---|---|---|---|---|---|---|`,
    `| — | — | Revenue | P&L | ${fmt$(analysis.ttmSummary?.totalRevenue ?? 0)} | ${fmt$(annualYears[2]?.totalRevenue ?? 0)} | ${fmt$(annualYears[1]?.totalRevenue ?? 0)} | ${fmt$(annualYears[0]?.totalRevenue ?? 0)} | — |`,
    `| — | — | Net Income (Pre-Recast) | P&L | ${fmt$(preRecastLtm)} | ${fmt$(preRecastFy3)} | ${fmt$(preRecastFy2)} | ${fmt$(preRecastFy1)} | — |`,
    ...normLines.map(l => `| ${l.id} | ${l.category} | ${l.description} | ${l.glRef} | ${fmt$(l.ltm)} | ${fmt$(l.fy3)} | ${fmt$(l.fy2)} | ${fmt$(l.fy1)} | ${l.status} |`),
    `| — | **TOTAL ADJUSTMENTS** | | | **${fmt$(totalLtm)}** | **${fmt$(totalFy3)}** | **${fmt$(totalFy2)}** | **${fmt$(totalFy1)}** | |`,
    `| — | **Normalized EBITDA** | | | **${fmt$(normEbitdaLtm)}** | **${fmt$(normEbitdaFy3)}** | **${fmt$(normEbitdaFy2)}** | **${fmt$(normEbitdaFy1)}** | |`,
    `| — | **4-Wall EBITDA** | | | **${fmt$(fourWallLtm)}** | **${fmt$(fourWallFy3)}** | **${fmt$(fourWallFy2)}** | **${fmt$(fourWallFy1)}** | |`,
    `| — | Multiple | | | ${multRange} | ${multRange} | ${multRange} | ${multRange} | |`,
    `| — | **Valuation** | | | **${fmtRange(valRangeLtm)}** | **${fmtRange(valRangeFy3)}** | **${fmtRange(valRangeFy2)}** | **${fmtRange(valRangeFy1)}** | |`,
  ].join("\n");

  return {
    normLines, totalLtm, totalFy3, totalFy2, totalFy1,
    preRecastLtm, preRecastFy3, preRecastFy2, preRecastFy1,
    normEbitdaLtm, normEbitdaFy3, normEbitdaFy2, normEbitdaFy1,
    fourWallLtm, fourWallFy3, fourWallFy2, fourWallFy1,
    valuationLtm, valuationFy3, valuationFy2, valuationFy1,
    scheduleMarkdown: md,
  };
}
