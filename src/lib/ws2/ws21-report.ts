import type {
  AnnualModel,
  CategoryBreakdown,
  DataQualityReport,
  MappedLedgerRow,
  TtmAgentSummary,
  TtmSummary,
  WorkingCapitalSummary,
} from "@/lib/ttm-agent/types";
import {
  EBITDA_EXCLUDED_OPEX_CODES,
  EBITDA_OPERATING_EXPENSE_CODES,
  getCategoryLabel,
  OPEX_CODES,
  REVENUE_CODES,
  COGS_CODES,
} from "@/lib/ttm-agent/taxonomy";

const CORPORATE_OVERHEAD_PATTERNS = [
  /corporate overhead/i,
  /head\s*office/i,
  /home\s*office/i,
  /parent company/i,
  /shared services/i,
  /allocated overhead/i,
  /overhead allocation/i,
  /corporate allocation/i,
  /allocation fee/i,
  /regional overhead/i,
  /franchise support/i,
];

function formatCurrency(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
    : "n/a";
}

function formatPct(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(1)}%` : "n/a";
}

function yearDisplayLabel(fiscalYear: string, periodStart: string, periodEnd: string) {
  return `${fiscalYear} (${periodStart} — ${periodEnd})`;
}

function monthLabel(value: string | null | undefined) {
  if (!value) return "n/a";
  const [year, month] = value.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(date);
}

function diffPct(current: number, prior: number) {
  if (!prior) return null;
  return ((current - prior) / prior) * 100;
}

function statusForRow(row: MappedLedgerRow) {
  if (!row.cantaraCode) return row.candidateCodes.length ? "FLAGGED-AMBIGUOUS" : "UNMAPPED";
  return "AUTO-MAPPED";
}

function isCorporateOverheadRow(row: Pick<MappedLedgerRow, "accountName" | "categoryType">) {
  if (row.categoryType !== "opex") return false;
  return CORPORATE_OVERHEAD_PATTERNS.some((pattern) => pattern.test(row.accountName));
}

function sumByMonths(row: MappedLedgerRow, months: string[]) {
  return months.reduce((sum, month) => sum + (row.valuesByMonth[month] ?? 0), 0);
}

function appendSectionTable(lines: string[], header: string[], rows: string[][]) {
  lines.push(`| ${header.join(" | ")} |`);
  lines.push(`| ${header.map((cell, index) => (index === 0 ? "---" : "---:")).join(" | ")} |`);
  for (const row of rows) {
    lines.push(`| ${row.join(" | ")} |`);
  }
  lines.push("");
}

function renderMappingSummary(rows: MappedLedgerRow[]) {
  const ordered = [...rows].sort((a, b) => a.accountName.localeCompare(b.accountName));
  return ordered.map((row) => [
    row.accountName,
    row.accountCode ?? "—",
    row.cantaraCode ?? (row.candidateCodes.join(", ") || "—"),
    statusForRow(row),
  ]);
}

function renderTtmPnlRows(mappedPlRows: MappedLedgerRow[], ttmSummary: TtmSummary) {
  const ttmMonths = mappedPlRows[0]
    ? Object.keys(mappedPlRows[0].valuesByMonth)
        .filter((month) => month >= ttmSummary.startMonth && month <= ttmSummary.endMonth)
        .sort((a, b) => a.localeCompare(b))
    : [];

  const lines: string[][] = [];
  const sections: Array<{ title: string; codes: string[]; type: "revenue" | "cogs" | "opex" }> = [
    { title: "Revenue", codes: REVENUE_CODES, type: "revenue" },
    { title: "COGS", codes: COGS_CODES, type: "cogs" },
    { title: "Operating Expenses", codes: EBITDA_OPERATING_EXPENSE_CODES, type: "opex" },
  ];

  for (const section of sections) {
    lines.push([`**${section.title}**`, "—", "—", "—"]);
    const sectionRows = mappedPlRows
      .filter((row) => !isCorporateOverheadRow(row))
      .filter((row) => row.cantaraCode && section.codes.includes(row.cantaraCode))
      .sort((a, b) => {
        const codeCompare = (a.cantaraCode ?? "").localeCompare(b.cantaraCode ?? "");
        return codeCompare || a.accountName.localeCompare(b.accountName);
      });

    for (const row of sectionRows) {
      const amount = sumByMonths(row, ttmMonths);
      lines.push([
        row.accountName,
        row.cantaraCode ?? "—",
        formatCurrency(amount),
        formatPct(ttmSummary.totalRevenue ? (amount / ttmSummary.totalRevenue) * 100 : null),
      ]);
    }

    const breakdown =
      section.type === "revenue"
        ? ttmSummary.revenueByCategory
        : section.type === "cogs"
          ? ttmSummary.cogsByCategory
          : ttmSummary.opExByCategory.filter((row) => EBITDA_OPERATING_EXPENSE_CODES.includes(row.code));

    for (const item of breakdown) {
      lines.push([
        `Subtotal - ${item.category}`,
        item.code,
        formatCurrency(item.value),
        formatPct(ttmSummary.totalRevenue ? (item.value / ttmSummary.totalRevenue) * 100 : null),
      ]);
    }
  }

  for (const code of EBITDA_EXCLUDED_OPEX_CODES) {
    const amount = mappedPlRows
      .filter((row) => !isCorporateOverheadRow(row))
      .filter((row) => row.cantaraCode === code)
      .reduce((sum, row) => sum + sumByMonths(row, ttmMonths), 0);
    lines.push([
      `${getCategoryLabel(code)} (excluded from EBITDA)`,
      code,
      formatCurrency(amount),
      formatPct(ttmSummary.totalRevenue ? (amount / ttmSummary.totalRevenue) * 100 : null),
    ]);
  }

  lines.push(["Total Revenue", "TOTAL", formatCurrency(ttmSummary.totalRevenue), "100.0%"]);
  lines.push(["Total COGS", "TOTAL", formatCurrency(ttmSummary.totalCogs), formatPct(ttmSummary.totalRevenue ? (ttmSummary.totalCogs / ttmSummary.totalRevenue) * 100 : null)]);
  lines.push(["Gross Profit", "TOTAL", formatCurrency(ttmSummary.grossProfit), formatPct(ttmSummary.grossMarginPct)]);
  lines.push(["Total Operating Expenses", "TOTAL", formatCurrency(ttmSummary.totalOpEx), formatPct(ttmSummary.totalRevenue ? (ttmSummary.totalOpEx / ttmSummary.totalRevenue) * 100 : null)]);
  lines.push(["4-Wall EBITDA (Pre-Recast)", "TOTAL", formatCurrency(ttmSummary.ebitdaPreRecast), formatPct(ttmSummary.ebitdaMarginPct)]);
  if (mappedPlRows.some(isCorporateOverheadRow)) {
    lines.push(["Corporate overhead allocations", "EXCLUDED", "Excluded from 4-wall EBITDA", "See Data Quality Report"]);
  }

  return lines;
}

function breakdownValue(rows: CategoryBreakdown[], code: string) {
  return rows.find((row) => row.code === code)?.value ?? 0;
}

function renderAnnualPnl(annualModel: AnnualModel) {
  const years = annualModel.years;
  const header = ["Line Item", ...years.map((year) => yearDisplayLabel(year.fiscalYear, year.periodStart, year.periodEnd)), "FY1→FY2", "FY2→FY3"];
  const rows: string[][] = [];

  const revenueCodes = new Set(years.flatMap((year) => year.revenueByCategory.map((row) => row.code)));
  rows.push(["**REVENUE**", ...years.map(() => "—"), "—", "—"]);
  for (const code of Array.from(revenueCodes).sort()) {
    const values = years.map((year) => breakdownValue(year.revenueByCategory, code));
    rows.push([
      getCategoryLabel(code),
      ...values.map((value) => formatCurrency(value)),
      formatPct(diffPct(values[1] ?? 0, values[0] ?? 0)),
      formatPct(diffPct(values[2] ?? 0, values[1] ?? 0)),
    ]);
  }

  rows.push([
    "Total Revenue",
    ...years.map((year) => formatCurrency(year.totalRevenue)),
    formatPct(diffPct(years[1]?.totalRevenue ?? 0, years[0]?.totalRevenue ?? 0)),
    formatPct(diffPct(years[2]?.totalRevenue ?? 0, years[1]?.totalRevenue ?? 0)),
  ]);
  rows.push([
    "Total COGS",
    ...years.map((year) => formatCurrency(year.totalCogs)),
    "—",
    "—",
  ]);
  rows.push([
    "Gross Profit",
    ...years.map((year) => formatCurrency(year.grossProfit)),
    "—",
    "—",
  ]);
  rows.push([
    "Gross Margin %",
    ...years.map((year) => formatPct(year.grossMarginPct)),
    annualModel.trends[0]?.grossMarginPointChange != null ? `${annualModel.trends[0].grossMarginPointChange.toFixed(1)} pts` : "n/a",
    annualModel.trends[1]?.grossMarginPointChange != null ? `${annualModel.trends[1].grossMarginPointChange.toFixed(1)} pts` : "n/a",
  ]);
  rows.push([
    "Total Operating Expenses",
    ...years.map((year) => formatCurrency(year.totalOpEx)),
    "—",
    "—",
  ]);
  rows.push([
    "4-Wall EBITDA (Pre-Recast)",
    ...years.map((year) => formatCurrency(year.ebitdaPreRecast)),
    formatPct(annualModel.trends[0]?.ebitdaYoYPct ?? null),
    formatPct(annualModel.trends[1]?.ebitdaYoYPct ?? null),
  ]);

  return { header, rows };
}

function renderWorkingCapital(summary: WorkingCapitalSummary | null) {
  if (!summary) return ["Working capital summary unavailable.", ""];

  const lines: string[] = [];
  lines.push(`Most recent month-end: ${monthLabel(summary.month)}`);
  lines.push("");
  appendSectionTable(
    lines,
    ["Line Item", "Amount"],
    [
      ...summary.currentAssets.map((item) => [item.category, formatCurrency(item.value)]),
      ["Total Current Assets", formatCurrency(summary.totalCurrentAssets)],
      ...summary.currentLiabilities.map((item) => [item.category, formatCurrency(item.value)]),
      ["Total Current Liabilities", formatCurrency(summary.totalCurrentLiabilities)],
    ],
  );
  lines.push(`Net Working Capital: ${formatCurrency(summary.netWorkingCapital)}`);
  lines.push(`3-Month Average NWC: ${formatCurrency(summary.trailingThreeMonthAverageNwc)}`);
  lines.push("");
  appendSectionTable(lines, ["AR Aging Bucket", "Amount", "% of AR"], [
    ["Current", formatCurrency(summary.arAging.current), formatPct(summary.arAging.pctCurrent)],
    ["1-30 days", formatCurrency(summary.arAging.days1To30), formatPct(summary.arAging.pct1To30)],
    ["31-60 days", formatCurrency(summary.arAging.days31To60), formatPct(summary.arAging.pct31To60)],
    ["61-90 days", formatCurrency(summary.arAging.days61To90), formatPct(summary.arAging.pct61To90)],
    ["90+ days", formatCurrency(summary.arAging.days90Plus), formatPct(summary.arAging.pct90Plus)],
    ["Total AR", formatCurrency(summary.arAging.totalAr), "100.0%"],
  ]);

  return lines;
}

function renderDataQuality(report: DataQualityReport, annualModel: AnnualModel) {
  const lines: string[] = [];

  for (const section of report.sectionOrder) {
    const sectionReport = report.sections[section];
    lines.push(`#### ${sectionReport.title}`);
    if (sectionReport.note) {
      lines.push(sectionReport.note);
      lines.push("");
    }
    if (!sectionReport.items.length) {
      lines.push("No issues.");
      lines.push("");
      continue;
    }

    if (section === "A") {
      appendSectionTable(lines, ["Title", "Severity", "Description"], sectionReport.items.map((item) => [item.title, item.severity, item.description]));
      continue;
    }

    if (section === "B" || section === "C") {
      appendSectionTable(lines, ["Fiscal Year / Month", "Line Item", "Your Rollup / Excel", "Accountant / QB", "Variance $", "Variance %", "Notes"], sectionReport.items.map((item) => [
        String(item.payload.fiscalYear ?? item.payload.month ?? "—"),
        String(item.payload.lineItem ?? item.title),
        formatCurrency((item.payload.monthlyRollup as number | null | undefined) ?? (item.payload.actual as number | null | undefined)),
        formatCurrency((item.payload.accountantStatement as number | null | undefined) ?? (item.payload.expected as number | null | undefined)),
        formatCurrency(item.payload.variance as number | null | undefined),
        formatPct(item.payload.variancePct as number | null | undefined),
        item.description,
      ]));
      continue;
    }

    if (section === "D" || section === "E") {
      appendSectionTable(lines, ["Title", "Severity", "Description"], sectionReport.items.map((item) => [item.title, item.severity, item.description]));
    }
  }

  if (annualModel.anomalies.length) {
    lines.push("#### Trend Anomalies");
    for (const anomaly of annualModel.anomalies) {
      lines.push(`- ${anomaly}`);
    }
    lines.push("");
  }

  return lines;
}

export function buildWs21DeterministicReport(args: {
  structuredModelConfidence: string;
  mappedPlRows: MappedLedgerRow[];
  mappedBsRows: MappedLedgerRow[];
  ttmSummary: TtmSummary;
  annualModel: AnnualModel;
  workingCapital: WorkingCapitalSummary | null;
  dataQualityReport: DataQualityReport;
  summary: TtmAgentSummary;
}) {
  const lines: string[] = [];
  const allMappedRows = [...args.mappedPlRows, ...args.mappedBsRows];
  const mappingRows = renderMappingSummary(allMappedRows);
  const ttmPnlRows = renderTtmPnlRows(args.mappedPlRows, args.ttmSummary);
  const annualPnl = renderAnnualPnl(args.annualModel);
  const workingCapitalLines = renderWorkingCapital(args.workingCapital);
  const dataQualityLines = renderDataQuality(args.dataQualityReport, args.annualModel);
  const years = args.annualModel.years;

  lines.push("## TTM FINANCIAL ANALYSIS REPORT", "");
  lines.push("### PERIOD COVERAGE");
  lines.push(`Dataset coverage: ${monthLabel(args.ttmSummary.startMonth)} through ${monthLabel(args.ttmSummary.endMonth)}.`);
  if (years.length === 3) {
    lines.push(`Fiscal years: FY1 = ${years[0].periodStart} — ${years[0].periodEnd} (oldest 12 months), FY2 = ${years[1].periodStart} — ${years[1].periodEnd}, FY3 = ${years[2].periodStart} — ${years[2].periodEnd} (most recent 12 months).`);
  }
  lines.push(`TTM period: ${monthLabel(args.ttmSummary.startMonth)} through ${monthLabel(args.ttmSummary.endMonth)}.`);
  lines.push(`Structured model confidence: ${args.structuredModelConfidence}.`, "");

  lines.push("### GL MAPPING SUMMARY");
  appendSectionTable(lines, ["Account Name", "Original GL Code", "Cantara Code", "Status"], mappingRows);

  lines.push("### TTM P&L SUMMARY (Pre-Recast)");
  appendSectionTable(lines, ["Line Item", "Cantara Code", "TTM Amount", "% of Revenue"], ttmPnlRows);
  lines.push(`TTM 4-Wall EBITDA (Pre-Recast) = ${formatCurrency(args.ttmSummary.ebitdaPreRecast)} | Margin = ${formatPct(args.ttmSummary.ebitdaMarginPct)}`);
  lines.push("THIS IS PRE-RECAST. ADD-BACKS HAVE NOT BEEN APPLIED.", "");

  lines.push("### 3-YEAR ANNUAL P&L (Pre-Recast)");
  appendSectionTable(lines, annualPnl.header, annualPnl.rows);

  lines.push("### WORKING CAPITAL BASELINE");
  lines.push(...workingCapitalLines);

  lines.push("### DATA QUALITY REPORT");
  lines.push(...dataQualityLines);

  lines.push("### SUMMARY FOR CRAIG");
  lines.push(args.summary.overview);
  if (args.summary.qualitySummary) lines.push(args.summary.qualitySummary);
  for (const note of [...args.summary.mappingNotes, ...args.summary.anomalyNotes].slice(0, 4)) {
    lines.push(`- ${note}`);
  }
  lines.push("");

  return lines.join("\n");
}
