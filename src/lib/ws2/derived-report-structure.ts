import { CANTARA_TAXONOMY } from "@/lib/ttm-agent/taxonomy";
import type { TtmAnalysisView, Ws2DerivedAgentId, Ws2RecastView } from "@/lib/ttm-agent/types";
import type { WS23Output, WS24Output, WS25Output, TrafficLight } from "@/lib/ws2/ws2-types";

type RevenueCategoryRow = { code?: string; category?: string; value?: number };
type OpExCategoryRow = { code?: string; category?: string; value?: number };
type PeriodModel = {
  label: string;
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
  { name: "Other", codes: ["REV-TIPS", "REV-OTHER", "REV-DISC"] },
] as const;

const BENCHMARK_GROUPS = [
  { category: "COGS", codes: ["COGS-SUPPLY", "COGS-RETAIL", "COGS-OTHER"], low: 0, high: 0.05 },
  { category: "Marketing", codes: ["OPX-MKTG"], low: 0.03, high: 0.05 },
  { category: "Direct Labor", codes: ["OPX-LABOR-STAFF", "OPX-LABOR-MGMT"], low: 0.35, high: 0.45 },
  { category: "Payroll Taxes & Benefits", codes: ["OPX-LABOR-TAX"], low: 0.02, high: 0.05 },
  { category: "Building Rent", codes: ["OPX-RENT", "OPX-RENT-NNN"], low: 0.1, high: 0.15 },
  { category: "Other Building", codes: ["OPX-UTIL", "OPX-REPAIR"], low: 0.03, high: 0.05 },
  { category: "Business Operations", codes: ["OPX-SOFT", "OPX-INSUR", "OPX-BANK", "OPX-PROF"], low: 0.07, high: 0.12 },
  { category: "Other", codes: ["OPX-MEALS", "OPX-TRAVEL", "OPX-DONAT", "OPX-GIFTS", "OPX-VET", "OPX-OTHER"], low: null, high: null },
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
  if (value < low * 0.85 || value > high * 1.15) return "RED";
  if (value < low || value > high) return "YELLOW";
  return "GREEN";
}

function buildPeriods(analysis: TtmAnalysisView) {
  const annual = (analysis.annualModel?.years ?? []).slice(0, 3).map<PeriodModel>((year) => ({
    label: year.fiscalYear,
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
  return year?.label && /^\d{4}$/.test(year.label)
    ? fallback.filter((month) => month.startsWith(`${year.label}-`))
    : fallback.slice(-12)
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
        .filter((row) => {
          if (group.category === "Building Rent" && row.accountCode === "6102") return true;
          return (group.codes as readonly string[]).includes(row.cantaraCode ?? "");
        })
        .reduce((sum, row) => sum + months.reduce((monthSum, month) => monthSum + Number(row.valuesByMonth?.[month] ?? 0), 0), 0);
    const fy1Dollar = rowAmount(yearMonths[0]);
    const fy2Dollar = rowAmount(yearMonths[1]);
    const fy3Dollar = rowAmount(yearMonths[2]);
    const ttmDollar = rowAmount(yearMonths[3]);
    const fy1Pct = pct(fy1Dollar, fy1?.revenue ?? 0);
    const fy2Pct = pct(fy2Dollar, fy2?.revenue ?? 0);
    const fy3Pct = pct(fy3Dollar, fy3?.revenue ?? 0);
    const ttmPct = pct(ttmDollar, ttm.revenue);
    const flag = benchmarkFlag(ttmPct, group.low, group.high);

    return {
      category: group.category,
      benchmarkLow: group.low ?? 0,
      benchmarkHigh: group.high ?? 0,
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
        group.low == null || group.high == null
          ? "No benchmark range defined."
          : flag === "GREEN"
            ? "Within benchmark range."
            : flag === "YELLOW"
              ? "Near or modestly outside benchmark range."
              : "Materially outside benchmark range.",
      yoyFy1toFy2: yoy(fy1Pct, fy2Pct),
      yoyFy2toFy3: yoy(fy2Pct, fy3Pct),
    };
  });

  const redCount = benchmarks.filter((item) => item.flag === "RED").length;
  const yellowCount = benchmarks.filter((item) => item.flag === "YELLOW").length;
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
      .filter((item) => item.flag !== "GREEN")
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
    const directLabor = staff + management;
    const allInLabor = directLabor + owner + payrollTaxesBenefits + tipsPaidOut;
    const buyerAdjustedLabor = directLabor + payrollTaxesBenefits + replacementSalary;

    return {
      revenue,
      staff,
      management,
      owner,
      payrollTaxesBenefits,
      tipsPaidOut,
      directLabor,
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
    ["Buyer-Adjusted Labor", fy1Labor.directLabor + fy1Labor.payrollTaxesBenefits + replacementSalary, fy2Labor.directLabor + fy2Labor.payrollTaxesBenefits + replacementSalary, fy3Labor.directLabor + fy3Labor.payrollTaxesBenefits + replacementSalary, ttmLabor.buyerAdjustedLabor],
  ] as Array<[string, number, number, number, number]>).map(([category, fy1Amount, fy2Amount, fy3Amount, ttmAmount]) => ({
    category,
    ttmAmount,
    ttmPct: pct(ttmAmount, ttm.revenue),
    fy3Amount,
    fy3Pct: pct(fy3Amount, fy3?.revenue ?? 0),
    fy2Pct: pct(fy2Amount, fy2?.revenue ?? 0),
    fy1Pct: pct(fy1Amount, fy1?.revenue ?? 0),
  }));

  const directLaborPct = pct(ttmLabor.directLabor, ttm.revenue);
  const buyerAdjustedLaborPct = pct(ttmLabor.buyerAdjustedLabor, ttm.revenue);
  const benchmarkStatus =
    directLaborPct > LABOR_BENCHMARK_HIGH ? "RED" :
    directLaborPct < LABOR_BENCHMARK_LOW ? "YELLOW" :
    "GREEN";
  const trendAssessment: TrafficLight =
    directLaborPct <= pct(fy3Labor.directLabor, fy3?.revenue ?? 0) + 0.01 ? "GREEN" :
    directLaborPct <= pct(fy3Labor.directLabor, fy3?.revenue ?? 0) + 0.03 ? "YELLOW" :
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
        ? "Direct labor is within Cantara's expected benchmark range."
        : benchmarkStatus === "YELLOW"
          ? "Direct labor is close to the edge of Cantara's benchmark range."
          : "Direct labor is above Cantara's benchmark range and needs review.",
    trendAssessment,
    trendNote:
      trendAssessment === "GREEN"
        ? "Labor costs are moving in a favorable direction compared with prior years."
        : trendAssessment === "YELLOW"
          ? "Labor costs are slightly less favorable than the prior-year pattern."
          : "Labor costs have worsened versus prior years and should be reviewed.",
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
