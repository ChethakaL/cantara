import type {
  AnnualModelYear,
  CategoryBreakdown,
  TtmAnalysisView,
  Ws2DerivedReportView,
  Ws2RecastView,
} from "@/lib/ttm-agent/types";

const BOARDING_CODES = new Set(["REV-BOARD"]);
const DAYCARE_CODES = new Set(["REV-DAY"]);
const LABOR_CODES = new Set(["OPX-LABOR-STAFF", "OPX-LABOR-MGMT", "OPX-LABOR-OWN", "OPX-LABOR-TAX"]);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatCurrency(value: number | null | undefined) {
  return isFiniteNumber(value)
    ? `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
    : "n/a";
}

function formatPct(value: number | null | undefined) {
  return isFiniteNumber(value) ? `${value.toFixed(1)}%` : "n/a";
}

function formatMultiple(value: number | null | undefined) {
  return isFiniteNumber(value) ? `${value.toFixed(1)}x` : "n/a";
}

function formatReportDate(value: string | null | undefined) {
  if (!value) return "Pending";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function safeDiv(numerator: number | null | undefined, denominator: number | null | undefined) {
  return isFiniteNumber(numerator) && isFiniteNumber(denominator) && denominator !== 0
    ? numerator / denominator
    : null;
}

function findBreakdownValue(
  rows: CategoryBreakdown[] | null | undefined,
  predicate: (row: CategoryBreakdown) => boolean,
) {
  return (rows ?? []).reduce((sum, row) => (predicate(row) ? sum + row.value : sum), 0);
}

function getBoardingDaycarePct(rows: CategoryBreakdown[] | null | undefined, totalRevenue: number | null | undefined) {
  const combined = findBreakdownValue(rows, (row) => BOARDING_CODES.has(row.code) || DAYCARE_CODES.has(row.code));
  return safeDiv(combined, totalRevenue);
}

function getTopRevenueCategory(rows: CategoryBreakdown[] | null | undefined, totalRevenue: number | null | undefined) {
  const sorted = [...(rows ?? [])].sort((a, b) => b.value - a.value);
  const top = sorted[0] ?? null;
  if (!top) return null;

  return {
    category: top.category,
    value: top.value,
    pct: safeDiv(top.value, totalRevenue),
  };
}

function getTotalLaborValue(analysis: TtmAnalysisView) {
  return findBreakdownValue(
    analysis.ttmSummary?.opExByCategory,
    (row) => LABOR_CODES.has(row.code),
  );
}

function buildRevenueMixTable(years: AnnualModelYear[], analysis: TtmAnalysisView) {
  const ttmRevenue = analysis.ttmSummary?.totalRevenue ?? null;
  const categoryMap = new Map<string, string>();

  for (const year of years) {
    for (const row of year.revenueByCategory) {
      if (!categoryMap.has(row.code)) categoryMap.set(row.code, row.category);
    }
  }

  for (const row of analysis.ttmSummary?.revenueByCategory ?? []) {
    if (!categoryMap.has(row.code)) categoryMap.set(row.code, row.category);
  }

  const categories = Array.from(categoryMap.entries())
    .map(([code, category]) => ({
      code,
      category,
      ttmValue: findBreakdownValue(analysis.ttmSummary?.revenueByCategory, (row) => row.code === code),
    }))
    .sort((a, b) => b.ttmValue - a.ttmValue || a.category.localeCompare(b.category));

  const header = [
    "| Service Line |",
    ...years.flatMap((year) => [` ${year.fiscalYear} |`, ` ${year.fiscalYear} % |`]),
    " TTM |",
    " TTM % |",
  ].join("");

  const divider = [
    "| --- |",
    ...years.flatMap(() => [" ---: |", " ---: |"]),
    " ---: |",
    " ---: |",
  ].join("");

  const rows = categories.map((category) => {
    const yearCells = years.flatMap((year) => {
      const value = findBreakdownValue(year.revenueByCategory, (row) => row.code === category.code);
      return [formatCurrency(value), formatPct(safeDiv(value, year.totalRevenue))];
    });
    return `| ${category.category} | ${[...yearCells, formatCurrency(category.ttmValue), formatPct(safeDiv(category.ttmValue, ttmRevenue))].join(" | ")} |`;
  });

  return [header, divider, ...rows].join("\n");
}

function buildEmbeddedReportSection(title: string, report: Ws2DerivedReportView | null, fallback: string) {
  return [
    "---",
    "",
    `## ${title}`,
    "",
    `> Section break: You are now viewing ${title}.`,
    "",
    report?.reportMarkdown?.trim() || fallback,
    "",
    `> End of ${title}.`,
    "",
  ].join("\n");
}

export function buildBaselineValuationReport(args: {
  clientName: string;
  analysis: TtmAnalysisView;
  recast: Ws2RecastView;
  ws23: Ws2DerivedReportView | null;
  ws24: Ws2DerivedReportView | null;
  ws25: Ws2DerivedReportView | null;
}) {
  const { analysis, recast, ws23, ws24, ws25 } = args;
  const years = analysis.annualModel?.years ?? [];
  const trends = analysis.annualModel?.trends ?? [];
  const latestTrend = trends[trends.length - 1] ?? null;
  const ttmRevenue = analysis.ttmSummary?.totalRevenue ?? null;
  const laborValue = getTotalLaborValue(analysis);
  const laborPct = safeDiv(laborValue, ttmRevenue);
  const normalizedMarginPct = safeDiv(recast.normalizedEbitda, ttmRevenue);
  const topServiceLine = getTopRevenueCategory(analysis.ttmSummary?.revenueByCategory, ttmRevenue);
  const ttmBoardingDaycarePct = getBoardingDaycarePct(analysis.ttmSummary?.revenueByCategory, ttmRevenue);
  const ws21Resolved = analysis.flags.filter((flag) => flag.resolutionStatus === "ACTIONED").length;
  const ws22Resolved = recast.flags.filter((flag) => flag.resolutionStatus === "ACTIONED").length;
  const allFlagsResolved =
    analysis.flags.every((flag) => flag.resolutionStatus === "ACTIONED") &&
    recast.flags.every((flag) => flag.resolutionStatus === "ACTIONED");

  const revenueTrend =
    latestTrend?.revenueYoYPct == null
      ? "Revenue trend unavailable from the structured annual model."
      : latestTrend.revenueYoYPct > 0
        ? `Revenue is growing YoY at ${formatPct(latestTrend.revenueYoYPct)}.`
        : latestTrend.revenueYoYPct < 0
          ? `Revenue is declining YoY at ${formatPct(Math.abs(latestTrend.revenueYoYPct))}.`
          : "Revenue is flat YoY.";

  const ebitdaTrend =
    latestTrend?.ebitdaYoYPct == null
      ? "EBITDA trend unavailable from the structured annual model."
      : latestTrend.ebitdaYoYPct > 0
        ? `Pre-recast EBITDA is improving YoY at ${formatPct(latestTrend.ebitdaYoYPct)}.`
        : latestTrend.ebitdaYoYPct < 0
          ? `Pre-recast EBITDA is declining YoY at ${formatPct(Math.abs(latestTrend.ebitdaYoYPct))}.`
          : "Pre-recast EBITDA is flat YoY.";

  const boardingDaycareLines = [
    ...years.map((year) => `${year.fiscalYear}: ${formatPct(getBoardingDaycarePct(year.revenueByCategory, year.totalRevenue))}`),
    `TTM: ${formatPct(ttmBoardingDaycarePct)}`,
  ];
  const boardingDaycareStatus =
    ttmBoardingDaycarePct == null
      ? "Boarding + daycare concentration could not be calculated from the current model."
      : ttmBoardingDaycarePct >= 0.7
        ? `Boarding + daycare concentration is above Cantara's 70% threshold at ${formatPct(ttmBoardingDaycarePct)} TTM.`
        : `Boarding + daycare concentration is below Cantara's 70% threshold at ${formatPct(ttmBoardingDaycarePct)} TTM and requires attention.`;

  const reportMarkdown = [
    `# ${args.clientName} - Baseline Valuation Range Report`,
    "",
    `Prepared by Cantara Pet Advisors | Generated ${new Date().toISOString().slice(0, 10)}`,
    `Admin HITL approval: ${formatReportDate(recast.approvedAt)}${recast.approvedByName ? ` | ${recast.approvedByName}` : ""}`,
    "Seller delivery status: BLOCKED - internal use only until Admin approves client release.",
    "",
    "## Executive Snapshot",
    "",
    `- TTM revenue: ${formatCurrency(ttmRevenue)}`,
    `- TTM gross margin: ${formatPct(analysis.ttmSummary?.grossMarginPct)}`,
    `- TTM 4-wall EBITDA (pre-recast): ${formatCurrency(analysis.ttmSummary?.ebitdaPreRecast)} (${formatPct(analysis.ttmSummary?.ebitdaMarginPct)})`,
    `- Normalized EBITDA (TTM): ${formatCurrency(recast.normalizedEbitda)} (${formatPct(normalizedMarginPct)})`,
    `- Preliminary valuation range: ${formatCurrency(recast.valuationLow)} to ${formatCurrency(recast.valuationHigh)}`,
    `- Five-category add-back schedule applied and approved in WS2-2: owner compensation, personal expenses, non-recurring expenses, tenant improvements, and fair market rent.`,
    "",
    "## Baseline Valuation Range",
    "",
    "| Metric | Low | Mid | High |",
    "| --- | ---: | ---: | ---: |",
    `| Multiple | ${formatMultiple(recast.assumptions.multipleLow)} | ${formatMultiple(recast.assumptions.multipleMid)} | ${formatMultiple(recast.assumptions.multipleHigh)} |`,
    `| Valuation | ${formatCurrency(recast.valuationLow)} | ${formatCurrency(recast.valuationMid)} | ${formatCurrency(recast.valuationHigh)} |`,
    "",
    `Revenue trend assessment: ${revenueTrend}`,
    `EBITDA trend assessment: ${ebitdaTrend}`,
    "",
    "## Revenue Mix Overview",
    "",
    topServiceLine
      ? `Largest TTM service line: ${topServiceLine.category} at ${formatCurrency(topServiceLine.value)} (${formatPct(topServiceLine.pct)} of revenue).`
      : "Largest TTM service line could not be determined from the structured model.",
    boardingDaycareStatus,
    `Boarding + daycare combined by period: ${boardingDaycareLines.join(" | ")}`,
    "",
    buildRevenueMixTable(years, analysis),
    "",
    buildEmbeddedReportSection(
      "WS2-3 Revenue by Vertical Detail",
      ws23,
      "WS2-3 detail report is not available.",
    ).trimEnd(),
    "",
    "## Expense Benchmark Overview",
    "",
    "WS2-4 benchmark findings are assembled below for review alongside the baseline valuation range.",
    "",
    "---",
    "",
    "# WS2-4 Expense Benchmarks",
    "",
    buildEmbeddedReportSection(
      "WS2-4 Expense Benchmark Detail",
      ws24,
      "WS2-4 detail report is not available.",
    ).trimEnd(),
    "",
    "## Labor Overview",
    "",
    `Raw TTM labor cost from the WS2 model: ${formatCurrency(laborValue)} (${formatPct(laborPct)} of TTM revenue).`,
    "WS2-5 includes the role-level breakdown, industry benchmark comparison, and owner-labor normalization details assembled below.",
    "",
    "---",
    "",
    "# WS2-5 Labor Analysis",
    "",
    buildEmbeddedReportSection(
      "WS2-5 Labor Analysis Detail",
      ws25,
      "WS2-5 detail report is not available.",
    ).trimEnd(),
    "",
    "## Data Quality and HITL Status",
    "",
    `- WS2-1 data-quality items resolved: ${ws21Resolved} of ${analysis.flags.length}`,
    `- WS2-2 add-back review items resolved: ${ws22Resolved} of ${recast.flags.length}`,
    `- All WS2-1 / WS2-2 flags actioned: ${allFlagsResolved ? "YES" : "NO"}`,
    `- Admin recast approval timestamp: ${formatReportDate(recast.approvedAt)}`,
    "",
    "## Required Disclaimer",
    "",
    "This Baseline Valuation Range Report is preliminary and for internal Cantara planning only.",
    "It has not been reviewed by legal or tax counsel and must not be shared",
    "with the seller until Admin approves it for client release.",
  ].join("\n");

  return {
    reportMarkdown,
    parsedReport: {
      generatedAt: new Date().toISOString(),
      clientName: args.clientName,
      sellerDeliveryBlocked: true,
      adminHitlApproved: Boolean(recast.approvedAt),
      prerequisites: {
        ws21Approved: analysis.status === "APPROVED",
        ws22Approved: recast.status === "APPROVED",
        ws23Complete: ws23?.status === "COMPLETE",
        ws24Complete: ws24?.status === "COMPLETE",
        ws25Complete: ws25?.status === "COMPLETE",
      },
      metrics: {
        totalRevenue: ttmRevenue,
        grossMarginPct: analysis.ttmSummary?.grossMarginPct ?? null,
        ebitdaPreRecast: analysis.ttmSummary?.ebitdaPreRecast ?? null,
        normalizedEbitda: recast.normalizedEbitda ?? null,
        normalizedEbitdaMarginPct: normalizedMarginPct,
        valuationLow: recast.valuationLow ?? null,
        valuationMid: recast.valuationMid ?? null,
        valuationHigh: recast.valuationHigh ?? null,
        laborPct,
        boardingDaycarePctTtm: ttmBoardingDaycarePct,
      },
    } as Record<string, unknown>,
  };
}
