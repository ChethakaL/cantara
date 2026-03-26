import { CANTARA_TAXONOMY } from "@/lib/ttm-agent/taxonomy";
import type { TtmAnalysisView, Ws2DerivedAgentId, Ws2RecastView } from "@/lib/ttm-agent/types";
import type { WS23Output, WS24Output, WS25Output, TrafficLight } from "@/lib/ws2/ws2-types";

type RevenueCategoryRow = { code?: string; category?: string; value?: number };
type OpExCategoryRow = { code?: string; category?: string; value?: number };
type PeriodModel = {
  label: string;
  fiscalYearLabel?: string;
  periodStart?: string;
  periodEnd?: string;
  revenue: number;
  revenueRows: RevenueCategoryRow[];
  cogsRows?: RevenueCategoryRow[];
  opExRows: OpExCategoryRow[];
};

const REVENUE_VERTICALS = [
  { name: "Boarding", codes: ["REV-BOARD"] },
  { name: "Daycare", codes: ["REV-DAY"] },
  { name: "Grooming", codes: ["REV-GROOM"] },
  { name: "Training", codes: ["REV-TRAIN"] },
  { name: "Retail", codes: ["REV-RETAIL"] },
  { name: "Membership", codes: ["REV-MEM"] },
  { name: "Other (Tips)", codes: ["REV-TIPS", "REV-OTHER"] },
] as const;

const BENCHMARK_GROUPS = [
  { category: "COGS", glCodes: ["5000"], benchmarkLow: 0, benchmarkHigh: 0.05, flagLow: 0, flagHigh: 0.05, includeInOverall: true },
  { category: "Marketing", glCodes: ["6300", "6301", "6302"], benchmarkLow: 0.03, benchmarkHigh: 0.05, flagLow: 0.03, flagHigh: 0.05, includeInOverall: true },
  { category: "Direct Labor", glCodes: ["6000", "6010", "6011", "6030", "6031"], benchmarkLow: 0.35, benchmarkHigh: 0.45, flagLow: 0.35, flagHigh: 0.45, includeInOverall: true },
  { category: "Payroll Tax", glCodes: ["6040", "6041"], benchmarkLow: 0.02, benchmarkHigh: 0.05, flagLow: 0.02, flagHigh: 0.05, includeInOverall: true },
  { category: "Building Rent", glCodes: ["6100", "6101", "6102"], benchmarkLow: 0.1, benchmarkHigh: 0.15, flagLow: 0.1, flagHigh: 0.15, includeInOverall: true },
  { category: "Other Building", glCodes: ["6200", "6201", "6202", "6203", "6500", "6501", "6502", "6503"], benchmarkLow: 0.03, benchmarkHigh: 0.05, flagLow: 0.03, flagHigh: 0.05, includeInOverall: true },
  { category: "Business Operations", glCodes: ["6700", "6701", "6400", "6900", "6901", "6800", "6801", "6802"], benchmarkLow: 0.07, benchmarkHigh: 0.12, flagLow: 0.04, flagHigh: 0.12, includeInOverall: true },
  { category: "Supplies (ref)", glCodes: ["6600", "6601", "6602"], benchmarkLow: null, benchmarkHigh: null, flagLow: null, flagHigh: null, includeInOverall: false },
] as const;

const LABOR_BENCHMARK_LOW = 0.35;
const LABOR_BENCHMARK_HIGH = 0.45;

function sumByCodes(rows: Array<{ code?: string; value?: number }> | undefined, codes: readonly string[]) {
  return (rows ?? []).reduce((sum, row) => sum + (codes.includes(row.code ?? "") ? row.value ?? 0 : 0), 0);
}

function pct(amount: number, revenue: number) {
  return revenue > 0 ? amount / revenue : 0;
}

function yoy(prev: number, next: number) {
  return Math.abs(prev) > 0 ? (next - prev) / prev : 0;
}

function benchmarkFlag(value: number, low: number | null, high: number | null): TrafficLight {
  if (low == null || high == null) return "GREEN";
  if (value < low - 0.03 || value > high + 0.03) return "RED";
  if (value < low || value > high) return "YELLOW";
  return "GREEN";
}

function monthsBetween(start: string | undefined, end: string | undefined) {
  if (!start || !end) return [] as string[];
  const startMatch = start.match(/^(\d{4})-(\d{2})$/);
  const endMatch = end.match(/^(\d{4})-(\d{2})$/);
  if (!startMatch || !endMatch) return [] as string[];

  const result: string[] = [];
  let year = Number(startMatch[1]);
  let month = Number(startMatch[2]);
  const endYear = Number(endMatch[1]);
  const endMonth = Number(endMatch[2]);

  while (year < endYear || (year === endYear && month <= endMonth)) {
    result.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return result;
}

function buildPeriods(analysis: TtmAnalysisView) {
  const annual = (analysis.annualModel?.years ?? []).slice(0, 3).map<PeriodModel>((year) => ({
    label: year.periodStart?.slice(0, 4) ?? year.fiscalYear,
    fiscalYearLabel: year.fiscalYear,
    periodStart: year.periodStart,
    periodEnd: year.periodEnd,
    revenue: year.totalRevenue ?? 0,
    revenueRows: year.revenueByCategory ?? [],
    cogsRows: year.cogsByCategory ?? [],
    opExRows: year.opExByCategory ?? [],
  }));

  const ttm: PeriodModel = {
    label: "TTM",
    revenue: analysis.ttmSummary?.totalRevenue ?? 0,
    revenueRows: analysis.ttmSummary?.revenueByCategory ?? [],
    cogsRows: analysis.ttmSummary?.cogsByCategory ?? [],
    opExRows: analysis.ttmSummary?.opExByCategory ?? [],
  };

  return { annual, ttm };
}

function mappedPlRows(analysis: TtmAnalysisView) {
  return Array.isArray(analysis.normalizedData?.mappedPlRows)
    ? analysis.normalizedData.mappedPlRows as Array<{
        accountName?: string | null
        accountCode?: string | null
        cantaraCode?: string | null
        valuesByMonth?: Record<string, number>
      }>
    : []
}

function periodMonths(year: PeriodModel | undefined, fallback: string[]) {
  const explicitMonths = monthsBetween(year?.periodStart, year?.periodEnd);
  if (explicitMonths.length > 0) return explicitMonths;
  return year?.label && /^\d{4}$/.test(year.label)
    ? fallback.filter((month) => month.startsWith(`${year.label}-`))
    : fallback.slice(-12);
}

function revenueLabel(code: string) {
  return CANTARA_TAXONOMY.find((item) => item.code === code)?.category ?? code;
}

export function buildWs23StructuredOutput(analysis: TtmAnalysisView): WS23Output {
  const { annual, ttm } = buildPeriods(analysis);
  const [fy1, fy2, fy3] = annual;

  const verticals = REVENUE_VERTICALS.map((vertical) => {
    const fy1Dollar = sumByCodes(fy1?.revenueRows, vertical.codes);
    const fy2Dollar = sumByCodes(fy2?.revenueRows, vertical.codes);
    const fy3Dollar = sumByCodes(fy3?.revenueRows, vertical.codes);
    const ttmDollar = sumByCodes(ttm.revenueRows, vertical.codes);
    const fy1Pct = pct(fy1Dollar, fy1?.revenue ?? 0);
    const fy2Pct = pct(fy2Dollar, fy2?.revenue ?? 0);
    const fy3Pct = pct(fy3Dollar, fy3?.revenue ?? 0);
    const ttmPct = pct(ttmDollar, ttm.revenue);
    const yoyFy1toFy2 = yoy(fy1Dollar, fy2Dollar);
    const yoyFy2toFy3 = yoy(fy2Dollar, fy3Dollar);
    const health: TrafficLight =
      vertical.name === "Training"
        ? "RED"
        : yoyFy2toFy3 < -0.05
          ? "RED"
          : yoyFy2toFy3 < 0 || ttmPct < 0.03
            ? "YELLOW"
            : "GREEN";

    return {
      name: vertical.name,
      fy1Dollar,
      fy1Pct,
      fy2Dollar,
      fy2Pct,
      fy3Dollar,
      fy3Pct,
      ttmDollar,
      ttmPct,
      yoyFy1toFy2,
      yoyFy2toFy3,
      health,
      healthNote:
        health === "GREEN"
          ? "Healthy contribution and trend."
          : health === "YELLOW"
            ? "Meaningful vertical but trend or scale should be reviewed."
            : "Small or declining revenue stream.",
    };
  });

  const boardingPlusDaycareConcentration = {
    fy1: pct(sumByCodes(fy1?.revenueRows, ["REV-BOARD", "REV-DAY"]), fy1?.revenue ?? 0),
    fy2: pct(sumByCodes(fy2?.revenueRows, ["REV-BOARD", "REV-DAY"]), fy2?.revenue ?? 0),
    fy3: pct(sumByCodes(fy3?.revenueRows, ["REV-BOARD", "REV-DAY"]), fy3?.revenue ?? 0),
    ttm: pct(sumByCodes(ttm.revenueRows, ["REV-BOARD", "REV-DAY"]), ttm.revenue),
  };

  const concentrationFlags: string[] = [];
  if (boardingPlusDaycareConcentration.ttm < 0.7) {
    concentrationFlags.push(
      `Boarding + daycare combined is ${(boardingPlusDaycareConcentration.ttm * 100).toFixed(1)}%, below the 70.0% Cantara threshold.`,
    );
  }

  const groomingPct = pct(sumByCodes(ttm.revenueRows, ["REV-GROOM"]), ttm.revenue);
  const businessModelFlag =
    groomingPct >= 0.25
      ? `Grooming represents ${(groomingPct * 100).toFixed(1)}% of TTM revenue, which may create buyer transfer risk if production depends on specific groomers.`
      : undefined;

  const unmappedRevenue = (ttm.revenueRows ?? [])
    .filter((row) => !row.code || row.code === "REV-OTHER" || row.code === "REV-DISC")
    .map((row) => `${row.category ?? revenueLabel(row.code ?? "REV-OTHER")}: ${row.value ?? 0}`);

  return {
    status: "COMPLETE",
    generatedAt: new Date().toISOString(),
    verticals,
    boardingPlusDaycareConcentration,
    concentrationFlags,
    unmappedRevenue,
    businessModelFlag,
  };
}

export function buildWs24StructuredOutput(analysis: TtmAnalysisView): WS24Output {
  const { annual, ttm } = buildPeriods(analysis);
  const [fy1, fy2, fy3] = annual;
  const mappedRows = mappedPlRows(analysis);
  const monthKeys = mappedRows[0] ? Object.keys(mappedRows[0].valuesByMonth ?? {}).sort() : [];
  const yearMonths = [periodMonths(fy1, monthKeys), periodMonths(fy2, monthKeys), periodMonths(fy3, monthKeys), monthKeys.slice(-12)];

  const benchmarks = BENCHMARK_GROUPS.map((group) => {
    const rowAmount = (months: string[]) =>
      mappedRows
        .filter((row) => (group.glCodes as readonly string[]).includes(row.accountCode ?? ""))
        .reduce((sum, row) => sum + months.reduce((monthSum, month) => monthSum + Number(row.valuesByMonth?.[month] ?? 0), 0), 0);
    const fy1Dollar = rowAmount(yearMonths[0]);
    const fy2Dollar = rowAmount(yearMonths[1]);
    const fy3Dollar = rowAmount(yearMonths[2]);
    const ttmDollar = rowAmount(yearMonths[3]);
    const fy1Pct = pct(fy1Dollar, fy1?.revenue ?? 0);
    const fy2Pct = pct(fy2Dollar, fy2?.revenue ?? 0);
    const fy3Pct = pct(fy3Dollar, fy3?.revenue ?? 0);
    const ttmPct = pct(ttmDollar, ttm.revenue);
    const flag = benchmarkFlag(ttmPct, group.flagLow, group.flagHigh);

    return {
      category: group.category,
      benchmarkLow: group.benchmarkLow ?? 0,
      benchmarkHigh: group.benchmarkHigh ?? 0,
      fy1Dollar,
      fy1Pct,
      fy2Dollar,
      fy2Pct,
      fy3Dollar,
      fy3Pct,
      ttmDollar,
      ttmPct,
      flag,
      flagNote:
        group.benchmarkLow == null || group.benchmarkHigh == null
          ? "Reference-only category."
          : flag === "GREEN"
            ? group.category === "Business Operations" && ttmPct < group.benchmarkLow
              ? "Below the benchmark range, but not enough to trigger a flag."
              : "Within benchmark range."
            : flag === "YELLOW"
              ? "Near or modestly outside benchmark range."
              : "Materially outside benchmark range.",
      yoyFy1toFy2: yoy(fy1Pct, fy2Pct),
      yoyFy2toFy3: yoy(fy2Pct, fy3Pct),
    };
  });

  const overallBenchmarks = benchmarks.filter((item) =>
    BENCHMARK_GROUPS.find((group) => group.category === item.category)?.includeInOverall !== false,
  );
  const redCount = overallBenchmarks.filter((item) => item.flag === "RED").length;
  const yellowCount = overallBenchmarks.filter((item) => item.flag === "YELLOW").length;
  const overallHealth: TrafficLight = redCount > 0 ? "RED" : yellowCount > 1 ? "YELLOW" : "GREEN";

  return {
    status: "COMPLETE",
    generatedAt: new Date().toISOString(),
    benchmarks,
    overallHealth,
    overallHealthNote:
      overallHealth === "GREEN"
        ? "Expense mix is broadly aligned with benchmark ranges."
        : overallHealth === "YELLOW"
          ? "A few categories need review against benchmark ranges."
          : "One or more categories are materially outside benchmark ranges.",
    improvementOpportunities: benchmarks
      .filter((item) =>
        item.flag !== "GREEN" &&
        BENCHMARK_GROUPS.find((group) => group.category === item.category)?.includeInOverall !== false,
      )
      .map((item) => `${item.category} is ${(item.ttmPct * 100).toFixed(1)}% of revenue versus ${(item.benchmarkLow * 100).toFixed(1)}%–${(item.benchmarkHigh * 100).toFixed(1)}% benchmark.`),
  };
}

export function buildWs25StructuredOutput(analysis: TtmAnalysisView, recast: Ws2RecastView | null): WS25Output {
  const { annual, ttm } = buildPeriods(analysis);
  const [fy1, fy2, fy3] = annual;
  const replacementSalary = recast?.assumptions?.replacementSalary ?? 0;

  const periodLabor = (period: PeriodModel | undefined) => {
    const revenue = period?.revenue ?? 0;
    const opExRows = period?.opExRows ?? [];
    const staff = sumByCodes(opExRows, ["OPX-LABOR-STAFF"]);
    const management = sumByCodes(opExRows, ["OPX-LABOR-MGMT"]);
    const owner = sumByCodes(opExRows, ["OPX-LABOR-OWN"]);
    const payrollTaxesBenefits = sumByCodes(opExRows, ["OPX-LABOR-TAX"]);
    const tipsPaidOut = sumByCodes(opExRows, ["OPX-TIPS-OUT"]);
    const laborExcludingOwner = staff + management + payrollTaxesBenefits;
    const allInLabor = laborExcludingOwner + owner + tipsPaidOut;
    const buyerAdjustedLabor = staff + management + payrollTaxesBenefits + replacementSalary;

    return {
      revenue,
      staff,
      management,
      owner,
      payrollTaxesBenefits,
      tipsPaidOut,
      laborExcludingOwner,
      allInLabor,
      buyerAdjustedLabor,
    };
  };

  const fy1Labor = periodLabor(fy1);
  const fy2Labor = periodLabor(fy2);
  const fy3Labor = periodLabor(fy3);
  const ttmLabor = periodLabor(ttm);

  const laborRows: WS25Output["laborRows"] = ([
    ["Staff / Direct Labor", fy1Labor.staff, fy2Labor.staff, fy3Labor.staff, ttmLabor.staff],
    ["Management Labor", fy1Labor.management, fy2Labor.management, fy3Labor.management, ttmLabor.management],
    ["Owner Compensation", fy1Labor.owner, fy2Labor.owner, fy3Labor.owner, ttmLabor.owner],
    ["Payroll Taxes & Benefits", fy1Labor.payrollTaxesBenefits, fy2Labor.payrollTaxesBenefits, fy3Labor.payrollTaxesBenefits, ttmLabor.payrollTaxesBenefits],
    ["Tips Paid Out", fy1Labor.tipsPaidOut, fy2Labor.tipsPaidOut, fy3Labor.tipsPaidOut, ttmLabor.tipsPaidOut],
    ["Total All-In Labor", fy1Labor.allInLabor, fy2Labor.allInLabor, fy3Labor.allInLabor, ttmLabor.allInLabor],
    ["Buyer-Adjusted Labor", fy1Labor.laborExcludingOwner + replacementSalary, fy2Labor.laborExcludingOwner + replacementSalary, fy3Labor.laborExcludingOwner + replacementSalary, ttmLabor.buyerAdjustedLabor],
  ] as Array<[string, number, number, number, number]>).map(([category, fy1Amount, fy2Amount, fy3Amount, ttmAmount]) => ({
    category,
    ttmAmount,
    ttmPct: pct(ttmAmount, ttm.revenue),
    fy3Amount,
    fy3Pct: pct(fy3Amount, fy3?.revenue ?? 0),
    fy2Pct: pct(fy2Amount, fy2?.revenue ?? 0),
    fy1Pct: pct(fy1Amount, fy1?.revenue ?? 0),
  }));

  const directLaborPct = pct(ttmLabor.laborExcludingOwner, ttm.revenue);
  const buyerAdjustedLaborPct = pct(ttmLabor.buyerAdjustedLabor, ttm.revenue);
  const benchmarkStatus =
    directLaborPct > LABOR_BENCHMARK_HIGH ? "RED" :
    directLaborPct < LABOR_BENCHMARK_LOW ? "YELLOW" :
    "GREEN";
  const fy1TrendPct = pct(fy1Labor.laborExcludingOwner, fy1?.revenue ?? 0);
  const fy2TrendPct = pct(fy2Labor.laborExcludingOwner, fy2?.revenue ?? 0);
  const fy3TrendPct = pct(fy3Labor.laborExcludingOwner, fy3?.revenue ?? 0);
  const trendAssessment: TrafficLight =
    fy3TrendPct <= fy2TrendPct && fy2TrendPct <= fy1TrendPct ? "GREEN" :
    fy3TrendPct <= fy2TrendPct + 0.01 ? "YELLOW" :
    "RED";

  const flags: string[] = [];
  if (benchmarkStatus !== "GREEN") {
    flags.push(`Direct labor is ${(directLaborPct * 100).toFixed(1)}% of revenue versus ${(LABOR_BENCHMARK_LOW * 100).toFixed(1)}%–${(LABOR_BENCHMARK_HIGH * 100).toFixed(1)}% benchmark.`);
  }
  if (buyerAdjustedLaborPct > 0.5) {
    flags.push(`Buyer-adjusted labor is ${(buyerAdjustedLaborPct * 100).toFixed(1)}% of revenue and may pressure post-close margins.`);
  }

  return {
    status: "COMPLETE",
    generatedAt: new Date().toISOString(),
    laborRows,
    directLaborPct,
    buyerAdjustedLaborPct,
    benchmarkStatus,
    benchmarkNote:
      benchmarkStatus === "GREEN"
        ? "Labor excluding owner compensation is within Cantara's expected benchmark range."
        : benchmarkStatus === "YELLOW"
          ? "Labor excluding owner compensation is close to Cantara's benchmark limit."
          : "Labor excluding owner compensation is above Cantara's benchmark range and needs review.",
    trendAssessment,
    trendNote:
      trendAssessment === "GREEN"
        ? `Labor excluding owner compensation is improving over time: ${(fy1TrendPct * 100).toFixed(1)}% → ${(fy2TrendPct * 100).toFixed(1)}% → ${(fy3TrendPct * 100).toFixed(1)}%.`
        : trendAssessment === "YELLOW"
          ? `Labor excluding owner compensation is mixed over time: ${(fy1TrendPct * 100).toFixed(1)}% → ${(fy2TrendPct * 100).toFixed(1)}% → ${(fy3TrendPct * 100).toFixed(1)}%.`
          : `Labor excluding owner compensation has worsened over time: ${(fy1TrendPct * 100).toFixed(1)}% → ${(fy2TrendPct * 100).toFixed(1)}% → ${(fy3TrendPct * 100).toFixed(1)}%.`,
    flags,
  };
}

export function buildStructuredWs2DerivedReport(args: {
  agentId: Ws2DerivedAgentId;
  analysis: TtmAnalysisView;
  recast: Ws2RecastView | null;
}) {
  switch (args.agentId) {
    case "ws2_3_rev_vertical_v1":
      return buildWs23StructuredOutput(args.analysis);
    case "ws2_4_benchmark_v1":
      return buildWs24StructuredOutput(args.analysis);
    case "ws2_5_labor_v1":
      return buildWs25StructuredOutput(args.analysis, args.recast);
    default:
      return null;
  }
}
