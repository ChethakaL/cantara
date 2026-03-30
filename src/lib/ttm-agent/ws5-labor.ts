/**
 * WS2-5: Labor Expense Analysis — Deterministic Computation
 *
 * Breaks down labor costs by role category, computes buyer-adjusted labor,
 * compares to Cantara benchmarks, flags owner involvement issues.
 */

import type { TtmAnalysisView, Ws2RecastAssumptions } from "@/lib/ttm-agent/types";

export interface LaborCategoryRow {
  category: string;
  ltmDollar: number;
  ltmPct: number;
  fy3Dollar: number;
  fy3Pct: number;
  fy2Dollar: number;
  fy2Pct: number;
  fy1Dollar: number;
  fy1Pct: number;
  isTotal?: boolean;
}

export interface LaborFlag {
  type: "DEAL_RISK" | "UNDERCOMPENSATED_OWNER" | "LOW_OWNER_INVOLVEMENT" | "TREND";
  severity: "RED" | "YELLOW" | "GREEN";
  message: string;
}

export interface LaborAnalysisResult {
  rows: LaborCategoryRow[];
  directLaborPct: number;       // staff + mgmt as % of revenue (LTM)
  allInLaborPct: number;        // all labor as % of revenue (LTM)
  buyerAdjustedPct: number;     // buyer-adjusted as % of revenue (LTM)
  benchmarkStatus: "GREEN" | "YELLOW" | "RED";
  benchmarkNote: string;
  trendAssessment: "IMPROVING" | "STABLE" | "DETERIORATING";
  trendNote: string;
  flags: LaborFlag[];
}

function pct(part: number, total: number): number {
  return total !== 0 ? part / total : 0;
}

export function computeLaborAnalysis(
  analysis: TtmAnalysisView,
  replacementSalary: number,
): LaborAnalysisResult {
  const years = analysis.annualModel?.years ?? [];
  const ttm = analysis.ttmSummary;

  const revLtm = ttm?.totalRevenue ?? years[2]?.totalRevenue ?? 0;
  const revFy3 = years[2]?.totalRevenue ?? 0;
  const revFy2 = years[1]?.totalRevenue ?? 0;
  const revFy1 = years[0]?.totalRevenue ?? 0;

  // Sum by Cantara code per period
  const sumCode = (code: string, period: "ltm" | "fy3" | "fy2" | "fy1"): number => {
    const cats =
      period === "ltm" ? (ttm?.opExByCategory ?? [])
      : period === "fy3" ? (years[2]?.opExByCategory ?? [])
      : period === "fy2" ? (years[1]?.opExByCategory ?? [])
      : (years[0]?.opExByCategory ?? []);
    return cats.filter(c => c.code === code).reduce((s, c) => s + c.value, 0);
  };

  const sumCodes = (codes: string[], period: "ltm" | "fy3" | "fy2" | "fy1"): number =>
    codes.reduce((s, code) => s + sumCode(code, period), 0);

  // Labor sub-categories
  const staffCodes = ["OPX-LABOR-STAFF"];
  const mgmtCodes = ["OPX-LABOR-MGMT"];
  const ownerCodes = ["OPX-LABOR-OWN"];
  const taxCodes = ["OPX-LABOR-TAX"];
  const tipsCodes = ["OPX-TIPS-OUT"];

  const buildRow = (category: string, codes: string[], isTotal?: boolean): LaborCategoryRow => {
    const ltm = sumCodes(codes, "ltm");
    const fy3 = sumCodes(codes, "fy3");
    const fy2 = sumCodes(codes, "fy2");
    const fy1 = sumCodes(codes, "fy1");
    return {
      category, isTotal,
      ltmDollar: ltm, ltmPct: pct(ltm, revLtm),
      fy3Dollar: fy3, fy3Pct: pct(fy3, revFy3),
      fy2Dollar: fy2, fy2Pct: pct(fy2, revFy2),
      fy1Dollar: fy1, fy1Pct: pct(fy1, revFy1),
    };
  };

  const staffRow = buildRow("Staff and Direct Labor", staffCodes);
  const mgmtRow = buildRow("Management Labor", mgmtCodes);
  const ownerRow = buildRow("Owner Compensation", ownerCodes);
  const taxRow = buildRow("Payroll Taxes and Benefits", taxCodes);
  const tipsRow = buildRow("Tips Paid Out", tipsCodes);

  // All-in labor
  const allInCodes = [...staffCodes, ...mgmtCodes, ...ownerCodes, ...taxCodes, ...tipsCodes];
  const allInRow = buildRow("Total All-In Labor", allInCodes, true);

  // Buyer-adjusted labor = Staff + Mgmt + Replacement Salary + Taxes (no owner, no tips)
  const buyerAdjCodes = [...staffCodes, ...mgmtCodes, ...taxCodes];
  const buyerAdjBase = buildRow("Buyer-Adjusted Labor", buyerAdjCodes, true);
  // Add replacement salary
  buyerAdjBase.ltmDollar += replacementSalary;
  buyerAdjBase.ltmPct = pct(buyerAdjBase.ltmDollar, revLtm);
  buyerAdjBase.fy3Dollar += replacementSalary;
  buyerAdjBase.fy3Pct = pct(buyerAdjBase.fy3Dollar, revFy3);
  buyerAdjBase.fy2Dollar += replacementSalary;
  buyerAdjBase.fy2Pct = pct(buyerAdjBase.fy2Dollar, revFy2);
  buyerAdjBase.fy1Dollar += replacementSalary;
  buyerAdjBase.fy1Pct = pct(buyerAdjBase.fy1Dollar, revFy1);

  const rows = [staffRow, mgmtRow, ownerRow, taxRow, tipsRow, allInRow, buyerAdjBase];

  // Direct labor = staff + mgmt (excl owner) as % of revenue
  const directLaborLtm = sumCodes([...staffCodes, ...mgmtCodes], "ltm");
  const directLaborPct = pct(directLaborLtm, revLtm);

  // Benchmark comparison (Direct Labor 35%-45%)
  let benchmarkStatus: "GREEN" | "YELLOW" | "RED" = "GREEN";
  let benchmarkNote = `Direct labor (staff + management) at ${(directLaborPct * 100).toFixed(1)}% of revenue is within the 35%-45% Cantara benchmark.`;
  if (directLaborPct > 0.45) {
    benchmarkStatus = "RED";
    benchmarkNote = `Direct labor at ${(directLaborPct * 100).toFixed(1)}% exceeds the 45% Cantara deal-risk threshold.`;
  } else if (directLaborPct > 0.42) {
    benchmarkStatus = "YELLOW";
    benchmarkNote = `Direct labor at ${(directLaborPct * 100).toFixed(1)}% is approaching the 45% deal-risk threshold.`;
  } else if (directLaborPct < 0.35) {
    benchmarkStatus = "YELLOW";
    benchmarkNote = `Direct labor at ${(directLaborPct * 100).toFixed(1)}% is below the 35% benchmark — may indicate understaffing.`;
  }

  // Trend assessment (all-in labor % across years)
  const allInPctFy1 = pct(sumCodes(allInCodes, "fy1"), revFy1);
  const allInPctFy2 = pct(sumCodes(allInCodes, "fy2"), revFy2);
  const allInPctFy3 = pct(sumCodes(allInCodes, "fy3"), revFy3);

  let trendAssessment: "IMPROVING" | "STABLE" | "DETERIORATING" = "STABLE";
  let trendNote = `All-in labor: ${(allInPctFy1 * 100).toFixed(1)}% → ${(allInPctFy2 * 100).toFixed(1)}% → ${(allInPctFy3 * 100).toFixed(1)}% of revenue across FY1, FY2, FY3.`;

  if (allInPctFy3 < allInPctFy1 - 0.03) {
    trendAssessment = "IMPROVING";
    trendNote += " Labor efficiency is improving.";
  } else if (allInPctFy3 > allInPctFy1 + 0.03) {
    trendAssessment = "DETERIORATING";
    trendNote += " Labor costs are growing faster than revenue.";
  } else {
    trendNote += " Labor costs are stable relative to revenue.";
  }

  // Flags
  const flags: LaborFlag[] = [];

  if (directLaborPct > 0.45) {
    flags.push({
      type: "DEAL_RISK",
      severity: "RED",
      message: `Direct labor (excluding owner) at ${(directLaborPct * 100).toFixed(1)}% exceeds the 45% Cantara deal-risk threshold. This is the single most important expense metric for a buyer.`,
    });
  }

  if (trendAssessment === "DETERIORATING") {
    flags.push({
      type: "TREND",
      severity: "YELLOW",
      message: trendNote,
    });
  }

  console.log(`[WS2-5] Labor: direct=${(directLaborPct * 100).toFixed(1)}%, all-in=${(allInRow.ltmPct * 100).toFixed(1)}%, buyer-adj=${(buyerAdjBase.ltmPct * 100).toFixed(1)}%, benchmark=${benchmarkStatus}`);

  return {
    rows,
    directLaborPct,
    allInLaborPct: allInRow.ltmPct,
    buyerAdjustedPct: buyerAdjBase.ltmPct,
    benchmarkStatus,
    benchmarkNote,
    trendAssessment,
    trendNote,
    flags,
  };
}
