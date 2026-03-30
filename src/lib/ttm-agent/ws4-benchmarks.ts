/**
 * WS2-4: P&L Expense Benchmark — Deterministic Computation
 *
 * Compares expense categories against Cantara pet resort industry benchmarks.
 * Flags outliers (RED/YELLOW) and identifies improvement opportunities.
 */

import type { TtmAnalysisView } from "@/lib/ttm-agent/types";

// ── Cantara Benchmark Ranges (as % of revenue) ────────────────────────────

interface BenchmarkDef {
  category: string;
  codes: string[];
  low: number;  // % as decimal (0.03 = 3%)
  high: number;
  notes: string;
}

const BENCHMARKS: BenchmarkDef[] = [
  { category: "COGS", codes: ["COGS-SUPPLY", "COGS-RETAIL", "COGS-OTHER"], low: 0, high: 0.05, notes: "Very low in pet service businesses" },
  { category: "Marketing", codes: ["OPX-MKTG"], low: 0.03, high: 0.05, notes: "" },
  { category: "Direct Labor", codes: ["OPX-LABOR-STAFF", "OPX-LABOR-MGMT"], low: 0.35, high: 0.45, notes: "Excludes owner comp. Above 45% is deal risk." },
  { category: "Payroll Taxes and Benefits", codes: ["OPX-LABOR-TAX"], low: 0.02, high: 0.05, notes: "" },
  { category: "Building Rent", codes: ["OPX-RENT", "OPX-RENT-NNN"], low: 0.10, high: 0.15, notes: "Base rent + NNN/CAM combined" },
  { category: "Other Building", codes: ["OPX-UTIL", "OPX-UTIL-OWNER", "OPX-REPAIR", "OPX-REPAIR-OWNER", "OPX-SUPPLY", "OPX-SUPPLY-OWNER"], low: 0.03, high: 0.05, notes: "Utilities + repairs + janitorial + supplies" },
  { category: "Business Operations", codes: ["OPX-SOFT", "OPX-INSUR", "OPX-BANK", "OPX-PROF", "OPX-PROF-OWNER"], low: 0.07, high: 0.12, notes: "Software + insurance + bank fees + professional fees" },
];

// ── Types ──────────────────────────────────────────────────────────────────

export interface BenchmarkResult {
  category: string;
  benchmarkLow: number;
  benchmarkHigh: number;
  notes: string;
  ltmDollar: number;
  ltmPct: number;
  fy3Dollar: number;
  fy3Pct: number;
  fy2Dollar: number;
  fy2Pct: number;
  fy1Dollar: number;
  fy1Pct: number;
  yoyFy1toFy2: number | null;
  yoyFy2toFy3: number | null;
  flag: "GREEN" | "YELLOW" | "RED";
  flagNote: string;
}

export interface BenchmarkAnalysis {
  benchmarks: BenchmarkResult[];
  overallHealth: "GREEN" | "YELLOW" | "RED";
  overallNote: string;
  improvementOpportunities: Array<{ category: string; currentPct: number; benchmarkHigh: number; savingsDollar: number }>;
}

// ── Computation ────────────────────────────────────────────────────────────

function pctOfRev(amount: number, revenue: number): number {
  return revenue !== 0 ? amount / revenue : 0;
}

function yoy(prev: number, next: number): number | null {
  if (prev === 0) return next === 0 ? 0 : null;
  return (next - prev) / Math.abs(prev);
}

export function computeBenchmarks(analysis: TtmAnalysisView): BenchmarkAnalysis {
  const years = analysis.annualModel?.years ?? [];
  const ttm = analysis.ttmSummary;

  const revLtm = ttm?.totalRevenue ?? years[2]?.totalRevenue ?? 0;
  const revFy3 = years[2]?.totalRevenue ?? 0;
  const revFy2 = years[1]?.totalRevenue ?? 0;
  const revFy1 = years[0]?.totalRevenue ?? 0;

  // Sum expense amounts by cantara code per period
  const sumCodes = (codes: string[], period: "ltm" | "fy3" | "fy2" | "fy1"): number => {
    const categories =
      period === "ltm" ? (ttm?.opExByCategory ?? ttm?.cogsByCategory ?? []).concat(ttm?.cogsByCategory ?? [])
      : period === "fy3" ? [...(years[2]?.opExByCategory ?? []), ...(years[2]?.cogsByCategory ?? [])]
      : period === "fy2" ? [...(years[1]?.opExByCategory ?? []), ...(years[1]?.cogsByCategory ?? [])]
      : [...(years[0]?.opExByCategory ?? []), ...(years[0]?.cogsByCategory ?? [])];

    return categories
      .filter(c => codes.includes(c.code))
      .reduce((s, c) => s + c.value, 0);
  };

  // For LTM, handle the case where ttm categories might not have COGS
  const sumCodesAll = (codes: string[], period: "ltm" | "fy3" | "fy2" | "fy1"): number => {
    const allCategories: Array<{ code: string; value: number }> = [];
    if (period === "ltm") {
      allCategories.push(...(ttm?.revenueByCategory ?? []), ...(ttm?.cogsByCategory ?? []), ...(ttm?.opExByCategory ?? []));
    } else {
      const y = period === "fy3" ? years[2] : period === "fy2" ? years[1] : years[0];
      if (y) {
        allCategories.push(...(y.revenueByCategory ?? []), ...(y.cogsByCategory ?? []), ...(y.opExByCategory ?? []));
      }
    }
    return allCategories.filter(c => codes.includes(c.code)).reduce((s, c) => s + c.value, 0);
  };

  const benchmarks: BenchmarkResult[] = [];
  let redCount = 0, yellowCount = 0;

  for (const def of BENCHMARKS) {
    const ltmDollar = sumCodesAll(def.codes, "ltm");
    const fy3Dollar = sumCodesAll(def.codes, "fy3");
    const fy2Dollar = sumCodesAll(def.codes, "fy2");
    const fy1Dollar = sumCodesAll(def.codes, "fy1");

    const ltmPct = pctOfRev(ltmDollar, revLtm);
    const fy3Pct = pctOfRev(fy3Dollar, revFy3);
    const fy2Pct = pctOfRev(fy2Dollar, revFy2);
    const fy1Pct = pctOfRev(fy1Dollar, revFy1);

    const yoy12 = yoy(fy1Dollar, fy2Dollar);
    const yoy23 = yoy(fy2Dollar, fy3Dollar);

    // Flag logic (using LTM %)
    let flag: "GREEN" | "YELLOW" | "RED" = "GREEN";
    let flagNote = "Within range";

    if (ltmPct > def.high + 0.03) {
      flag = "RED";
      flagNote = `${(ltmPct * 100).toFixed(1)}% is more than 3 points above the ${(def.high * 100).toFixed(0)}% benchmark high`;
      redCount++;
    } else if (ltmPct > def.high + 0.01) {
      flag = "YELLOW";
      flagNote = `${(ltmPct * 100).toFixed(1)}% is 1-3 points above the ${(def.high * 100).toFixed(0)}% benchmark high`;
      yellowCount++;
    } else if (ltmPct < def.low - 0.03 && def.low > 0) {
      flag = "YELLOW";
      flagNote = `${(ltmPct * 100).toFixed(1)}% is more than 3 points below the ${(def.low * 100).toFixed(0)}% benchmark low — potential underinvestment`;
      yellowCount++;
    }

    // Special: Direct Labor above 45% is always RED
    if (def.category === "Direct Labor" && ltmPct > 0.45) {
      flag = "RED";
      flagNote = `Direct labor at ${(ltmPct * 100).toFixed(1)}% exceeds the 45% Cantara deal-risk threshold`;
      redCount++;
    }

    // Flag YoY increase >15% while revenue flat/declining
    const revYoy23 = yoy(revFy2, revFy3);
    if (yoy23 !== null && yoy23 > 0.15 && revYoy23 !== null && revYoy23 <= 0.02) {
      if (flag === "GREEN") {
        flag = "YELLOW";
        yellowCount++;
      }
      flagNote += `. Also: ${(yoy23 * 100).toFixed(0)}% YoY increase while revenue ${revYoy23 > 0 ? 'grew only ' + (revYoy23 * 100).toFixed(0) + '%' : 'declined'}`;
    }

    benchmarks.push({
      category: def.category,
      benchmarkLow: def.low,
      benchmarkHigh: def.high,
      notes: def.notes,
      ltmDollar, ltmPct, fy3Dollar, fy3Pct, fy2Dollar, fy2Pct, fy1Dollar, fy1Pct,
      yoyFy1toFy2: yoy12,
      yoyFy2toFy3: yoy23,
      flag, flagNote,
    });
  }

  // Overall health
  let overallHealth: "GREEN" | "YELLOW" | "RED" = "GREEN";
  let overallNote = "Expense structure is within Cantara benchmarks.";
  if (redCount >= 2) {
    overallHealth = "RED";
    overallNote = `${redCount} expense categories are significantly above benchmark. This expense structure needs attention before proceeding.`;
  } else if (redCount === 1 || yellowCount >= 2) {
    overallHealth = "YELLOW";
    overallNote = `${redCount} red and ${yellowCount} yellow flags. Some expense categories are above benchmark and should be reviewed.`;
  }

  // Improvement opportunities (categories above benchmark high)
  const improvementOpportunities = benchmarks
    .filter(b => b.ltmPct > b.benchmarkHigh)
    .map(b => ({
      category: b.category,
      currentPct: b.ltmPct,
      benchmarkHigh: b.benchmarkHigh,
      savingsDollar: (b.ltmPct - b.benchmarkHigh) * revLtm,
    }))
    .sort((a, b) => b.savingsDollar - a.savingsDollar);

  console.log(`[WS2-4] Benchmarks: ${benchmarks.length} categories, ${redCount} RED, ${yellowCount} YELLOW, overall=${overallHealth}`);

  return { benchmarks, overallHealth, overallNote, improvementOpportunities };
}
