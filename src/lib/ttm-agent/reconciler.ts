import {
  AnnualModel,
  AnnualModelYear,
  AnnualTrend,
  DataQualitySection,
  ParsedAccountantStatements,
  ParsedMonthlyWorkbook,
  SectionReportItem,
  StructuredFinancialModel,
  TtmSummary,
} from "@/lib/ttm-agent/types";
import { COGS_CODES, getCategoryLabel, OPEX_CODES, REVENUE_CODES, WORKING_CAPITAL_CODES } from "@/lib/ttm-agent/taxonomy";
import { MappedLedgerRow } from "@/lib/ttm-agent/types";

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function percent(numerator: number, denominator: number) {
  if (!denominator) return null;
  return (numerator / denominator) * 100;
}

function uniqueMonths(months: string[]) {
  return Array.from(new Set(months)).sort((a, b) => a.localeCompare(b));
}

function monthsBetween(start: string, end: string) {
  const result: string[] = [];
  let [year, month] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);

  while (year < endYear || (year === endYear && month <= endMonth)) {
    result.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }

  return result;
}

function sumRowsForMonths(rows: MappedLedgerRow[], months: string[], codes: string[]) {
  return rows
    .filter((row) => row.cantaraCode && codes.includes(row.cantaraCode))
    .reduce((grandTotal, row) => {
      const rowTotal = months.reduce((acc, month) => acc + (row.valuesByMonth[month] ?? 0), 0);
      return grandTotal + rowTotal;
    }, 0);
}

function buildBreakdown(rows: MappedLedgerRow[], months: string[], codes: string[]) {
  return codes.map((code) => ({
    code,
    category: getCategoryLabel(code),
    value: rows
      .filter((row) => row.cantaraCode === code)
      .reduce((total, row) => total + months.reduce((acc, month) => acc + (row.valuesByMonth[month] ?? 0), 0), 0),
  }));
}

function groupMonthsByFiscalYear(monthKeys: string[]) {
  const grouped = new Map<string, string[]>();

  for (const monthKey of monthKeys) {
    const fiscalYear = monthKey.slice(0, 4);
    grouped.set(fiscalYear, [...(grouped.get(fiscalYear) ?? []), monthKey]);
  }

  return Array.from(grouped.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([fiscalYear, months]) => ({ fiscalYear, months: months.sort((a, b) => a.localeCompare(b)) }));
}

function compareAgainstThreshold(actual: number, expected: number, absoluteThreshold: number, pctThreshold: number) {
  const variance = actual - expected;
  const variancePct = expected ? (variance / expected) * 100 : null;
  const overAbsolute = Math.abs(variance) > absoluteThreshold;
  const overPct = variancePct !== null && Math.abs(variancePct) > pctThreshold;
  return {
    variance,
    variancePct,
    isMaterial: overAbsolute || overPct,
  };
}

function toExcelColumnName(columnNumber: number) {
  let dividend = columnNumber;
  let columnName = "";
  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    columnName = String.fromCharCode(65 + modulo) + columnName;
    dividend = Math.floor((dividend - modulo) / 26);
  }
  return columnName;
}

function buildCoverageSection(monthlyPl: ParsedMonthlyWorkbook, monthlyBs: ParsedMonthlyWorkbook) {
  const items: SectionReportItem[] = [];
  const plMonths = uniqueMonths(monthlyPl.monthKeys);
  const bsMonths = uniqueMonths(monthlyBs.monthKeys);

  if (plMonths.length) {
    const expectedMonths = monthsBetween(plMonths[0], plMonths[plMonths.length - 1]);
    const missingPlMonths = expectedMonths.filter((month) => !plMonths.includes(month));
    if (missingPlMonths.length) {
      items.push({
        title: "Missing months in monthly P&L",
        severity: "HIGH",
        description: `The monthly P&L is missing ${missingPlMonths.join(", ")}.`,
        payload: { missingMonths: missingPlMonths },
      });
    }
  }

  if (bsMonths.length) {
    const expectedMonths = monthsBetween(bsMonths[0], bsMonths[bsMonths.length - 1]);
    const missingBsMonths = expectedMonths.filter((month) => !bsMonths.includes(month));
    if (missingBsMonths.length) {
      items.push({
        title: "Missing months in monthly balance sheet",
        severity: "HIGH",
        description: `The monthly balance sheet is missing ${missingBsMonths.join(", ")}.`,
        payload: { missingMonths: missingBsMonths },
      });
    }
  }

  if (plMonths.length !== 36) {
    items.push({
      title: "Monthly P&L does not contain 36 consecutive months",
      severity: plMonths.length < 24 ? "HIGH" : "MEDIUM",
      description: `The monthly P&L contains ${plMonths.length} months.`,
      payload: { monthCount: plMonths.length },
    });
  }

  if (bsMonths.length !== 36) {
    items.push({
      title: "Monthly balance sheet does not contain 36 consecutive months",
      severity: bsMonths.length < 24 ? "HIGH" : "MEDIUM",
      description: `The monthly balance sheet contains ${bsMonths.length} months.`,
      payload: { monthCount: bsMonths.length },
    });
  }

  const zeroRevenueMonths = plMonths.filter((month) => {
    const totalRevenue = monthlyPl.rows
      .filter((row) => /revenue|sales|income/i.test(row.accountName))
      .reduce((acc, row) => acc + (row.valuesByMonth[month] ?? 0), 0);
    return totalRevenue === 0;
  });

  if (zeroRevenueMonths.length) {
    items.push({
      title: "Zero-revenue months require confirmation",
      severity: "MEDIUM",
      description: `Revenue is zero across all revenue lines for ${zeroRevenueMonths.join(", ")}.`,
      payload: { zeroRevenueMonths },
    });
  }

  const plYears = groupMonthsByFiscalYear(plMonths).map((entry) => entry.fiscalYear);
  const bsYears = groupMonthsByFiscalYear(bsMonths).map((entry) => entry.fiscalYear);
  if (plYears.join(",") !== bsYears.join(",")) {
    items.push({
      title: "Fiscal year alignment mismatch between P&L and balance sheet",
      severity: "MEDIUM",
      description: `P&L years: ${plYears.join(", ")}. Balance sheet years: ${bsYears.join(", ")}.`,
      payload: { plYears, bsYears },
    });
  }

  return items;
}

function buildStructuredModel(rows: MappedLedgerRow[], monthKeys: string[]): StructuredFinancialModel {
  const months = monthKeys.map((month) => {
    const revenue = sumRowsForMonths(rows, [month], REVENUE_CODES);
    const cogs = sumRowsForMonths(rows, [month], COGS_CODES);
    const grossProfit = revenue - cogs;
    const opEx = sumRowsForMonths(rows, [month], OPEX_CODES);
    const depreciation = sumRowsForMonths(rows, [month], ["OPX-DEPR"]);
    const ebitdaPreRecast = grossProfit - opEx + depreciation;

    return {
      month,
      revenue,
      cogs,
      grossProfit,
      grossMarginPct: percent(grossProfit, revenue),
      opEx,
      ebitdaPreRecast,
      breakdown: [
        ...buildBreakdown(rows, [month], REVENUE_CODES),
        ...buildBreakdown(rows, [month], COGS_CODES),
        ...buildBreakdown(rows, [month], OPEX_CODES),
      ],
    };
  });

  const confidence = monthKeys.length < 24 ? "LOW" : monthKeys.length < 36 ? "MEDIUM" : "HIGH";
  return { months, confidence };
}

function buildTtmSummary(rows: MappedLedgerRow[], monthKeys: string[]): TtmSummary {
  const ttmMonths = monthKeys.slice(-12);
  const totalRevenue = sumRowsForMonths(rows, ttmMonths, REVENUE_CODES);
  const totalCogs = sumRowsForMonths(rows, ttmMonths, COGS_CODES);
  const grossProfit = totalRevenue - totalCogs;
  const totalOpEx = sumRowsForMonths(rows, ttmMonths, OPEX_CODES);
  const depreciation = sumRowsForMonths(rows, ttmMonths, ["OPX-DEPR"]);
  const ebitdaPreRecast = grossProfit - totalOpEx + depreciation;

  return {
    startMonth: ttmMonths[0],
    endMonth: ttmMonths[ttmMonths.length - 1],
    revenueByCategory: buildBreakdown(rows, ttmMonths, REVENUE_CODES),
    cogsByCategory: buildBreakdown(rows, ttmMonths, COGS_CODES),
    opExByCategory: buildBreakdown(rows, ttmMonths, OPEX_CODES),
    totalRevenue,
    totalCogs,
    grossProfit,
    grossMarginPct: percent(grossProfit, totalRevenue),
    totalOpEx,
    ebitdaPreRecast,
    ebitdaMarginPct: percent(ebitdaPreRecast, totalRevenue),
  };
}

function buildAnnualModel(rows: MappedLedgerRow[], monthKeys: string[]): AnnualModel {
  const groupedYears = groupMonthsByFiscalYear(monthKeys).slice(-3);
  const years: AnnualModelYear[] = groupedYears.map(({ fiscalYear, months }) => {
    const totalRevenue = sumRowsForMonths(rows, months, REVENUE_CODES);
    const totalCogs = sumRowsForMonths(rows, months, COGS_CODES);
    const grossProfit = totalRevenue - totalCogs;
    const totalOpEx = sumRowsForMonths(rows, months, OPEX_CODES);
    const depreciation = sumRowsForMonths(rows, months, ["OPX-DEPR"]);
    const ebitdaPreRecast = grossProfit - totalOpEx + depreciation;
    const netIncome: number | null = null;

    return {
      fiscalYear,
      revenueByCategory: buildBreakdown(rows, months, REVENUE_CODES),
      cogsByCategory: buildBreakdown(rows, months, COGS_CODES),
      opExByCategory: buildBreakdown(rows, months, OPEX_CODES),
      totalRevenue,
      totalCogs,
      grossProfit,
      grossMarginPct: percent(grossProfit, totalRevenue),
      totalOpEx,
      ebitdaPreRecast,
      netIncome,
    };
  });

  const trends: AnnualTrend[] = [];
  const anomalies: string[] = [];

  for (let index = 1; index < years.length; index += 1) {
    const previous = years[index - 1];
    const current = years[index];
    const revenueYoYPct = previous.totalRevenue
      ? ((current.totalRevenue - previous.totalRevenue) / previous.totalRevenue) * 100
      : null;
    const grossMarginPointChange =
      current.grossMarginPct !== null && previous.grossMarginPct !== null
        ? current.grossMarginPct - previous.grossMarginPct
        : null;
    const ebitdaYoYPct = previous.ebitdaPreRecast
      ? ((current.ebitdaPreRecast - previous.ebitdaPreRecast) / previous.ebitdaPreRecast) * 100
      : null;
    const opExPctByCode = Object.fromEntries(
      OPEX_CODES.map((code) => {
        const currentPct = percent(
          current.opExByCategory.find((item) => item.code === code)?.value ?? 0,
          current.totalRevenue,
        );
        return [code, currentPct];
      }),
    ) as Record<string, number | null>;

    trends.push({
      fromFiscalYear: previous.fiscalYear,
      toFiscalYear: current.fiscalYear,
      revenueYoYPct,
      grossMarginPointChange,
      ebitdaYoYPct,
      opExPctByCode,
    });

    if (grossMarginPointChange !== null && grossMarginPointChange < -3) {
      anomalies.push(
        `Gross margin compressed by ${Math.abs(grossMarginPointChange).toFixed(1)} points from ${previous.fiscalYear} to ${current.fiscalYear}.`,
      );
    }

    if (revenueYoYPct !== null && revenueYoYPct < -10) {
      anomalies.push(
        `Revenue declined ${Math.abs(revenueYoYPct).toFixed(1)}% from ${previous.fiscalYear} to ${current.fiscalYear}.`,
      );
    }

    for (const code of OPEX_CODES) {
      const previousValue = previous.opExByCategory.find((item) => item.code === code)?.value ?? 0;
      const currentValue = current.opExByCategory.find((item) => item.code === code)?.value ?? 0;
      const growthPct = previousValue ? ((currentValue - previousValue) / previousValue) * 100 : null;
      if (growthPct !== null && growthPct > 15 && (revenueYoYPct ?? 0) <= 2) {
        anomalies.push(
          `${getCategoryLabel(code)} grew ${growthPct.toFixed(1)}% while revenue was flat or declining from ${previous.fiscalYear} to ${current.fiscalYear}.`,
        );
      }
    }
  }

  return { years, trends, anomalies };
}

function buildMappingSection(
  rows: MappedLedgerRow[],
  source: {
    documentId: "monthly_pl_excel" | "monthly_bs_excel";
    documentLabel: string;
    accountColumnIndex: number;
  },
) {
  return rows
    .filter((row) => {
      const normalized = row.accountName.toLowerCase();
      if (/(cash|checking|petty cash|savings)/.test(normalized)) return false;
      if (/(net income|gross profit|subtotal|pre-recast|pre recast|ebitda)/.test(normalized)) return false;
      return !row.cantaraCode || row.mappingConfidence < 0.7;
    })
    .map((row) => {
      const monthlyValues = Object.values(row.valuesByMonth);
      const minValue = Math.min(...monthlyValues, 0);
      const maxValue = Math.max(...monthlyValues, 0);
      const confidencePct = Math.round(row.mappingConfidence * 1000) / 10;
      const sourceRow = row.rowIndex + 1;
      const sourceCol = toExcelColumnName(source.accountColumnIndex + 1);
      return {
        title: `Mapping request for ${row.accountName}`,
        severity: row.isMajor ? ("HIGH" as const) : ("MEDIUM" as const),
        description: `Assign a Cantara code for ${row.accountName}${row.accountCode ? ` (${row.accountCode})` : ""}.`,
        payload: {
          accountName: row.accountName,
          accountCode: row.accountCode,
          candidateCodes: row.candidateCodes,
          monthlyRange: { min: minValue, max: maxValue },
          mappingConfidence: row.mappingConfidence,
          mappingConfidencePct: confidencePct,
          sourceDocumentId: source.documentId,
          sourceDocument: source.documentLabel,
          sourceSheet: row.sourceSheet,
          sourceRow,
          sourceCell: `${sourceCol}${sourceRow}`,
          reviewerGuidance:
            "Open the source workbook at this location, validate the account intent, then assign one Cantara code or escalate to client for clarification.",
        },
      };
    });
}

function buildAccountantVarianceSection(args: {
  monthlyAnnualModel: AnnualModel;
  accountantStatements: ParsedAccountantStatements;
}) {
  const items: SectionReportItem[] = [];
  const accountantByYear = new Map(args.accountantStatements.years.map((year) => [year.fiscalYear, year]));

  for (const year of args.monthlyAnnualModel.years) {
    const accountant = accountantByYear.get(year.fiscalYear);
    if (!accountant) {
      items.push({
        title: `Missing accountant totals for fiscal year ${year.fiscalYear}`,
        severity: "HIGH",
        description: `No accountant-prepared totals were found for fiscal year ${year.fiscalYear}.`,
        payload: { fiscalYear: year.fiscalYear },
      });
      continue;
    }

    const comparisons = [
      { lineItem: "Total Revenue", actual: year.totalRevenue, expected: accountant.revenue },
      { lineItem: "Total COGS", actual: year.totalCogs, expected: accountant.cogs },
      { lineItem: "Gross Profit", actual: year.grossProfit, expected: accountant.grossProfit },
      { lineItem: "Total OpEx", actual: year.totalOpEx, expected: accountant.opEx },
      { lineItem: "Net Income", actual: year.netIncome, expected: accountant.netIncome },
    ];

    for (const comparison of comparisons) {
      if (comparison.actual === null) {
        console.log(`[TTM] Section C: ${comparison.lineItem} unavailable from monthly rollup for FY${year.fiscalYear}`);
        items.push({
          title: `${comparison.lineItem} is unavailable from monthly rollup`,
          severity: "MEDIUM",
          description: `${comparison.lineItem} could not be deterministically derived from the monthly P&L rollup for fiscal year ${year.fiscalYear}. This metric requires below-the-line items not present in the GL taxonomy.`,
          payload: { fiscalYear: year.fiscalYear, lineItem: comparison.lineItem, reason: "Not derivable from Cantara GL taxonomy" },
        });
        continue;
      }

      if (comparison.expected === null) {
        console.log(`[TTM] Section C: ${comparison.lineItem} missing from accountant statements for FY${year.fiscalYear}`);
        items.push({
          title: `${comparison.lineItem} missing in accountant statements`,
          severity: "MEDIUM",
          description: `${comparison.lineItem} is not explicitly stated in the accountant-prepared financial statements for fiscal year ${year.fiscalYear}.`,
          payload: { fiscalYear: year.fiscalYear, lineItem: comparison.lineItem, reason: "Not present in accountant statements" },
        });
        continue;
      }

      const variance = compareAgainstThreshold(comparison.actual, comparison.expected, 1000, 1);
      if (variance.isMaterial) {
        console.log(`[TTM] Section C: ${comparison.lineItem} FY${year.fiscalYear} variance=$${variance.variance.toFixed(2)} (rollup=$${comparison.actual}, accountant=$${comparison.expected})`);
        items.push({
          title: `${comparison.lineItem} variance for fiscal year ${year.fiscalYear}`,
          severity: Math.abs(variance.variance) > 5000 ? "HIGH" : "MEDIUM",
          description: `${comparison.lineItem} differs from accountant totals by $${variance.variance.toFixed(2)}.`,
          payload: {
            fiscalYear: year.fiscalYear,
            lineItem: comparison.lineItem,
            monthlyRollup: comparison.actual,
            accountantStatement: comparison.expected,
            variance: variance.variance,
            variancePct: variance.variancePct,
            sourceMonthly: "Monthly P&L Excel (aggregated to annual)",
            sourceAccountant: "Accountant-Prepared Statements",
          },
        });
      }
    }
  }

  return items;
}

export function reconcileFinancials(args: {
  monthlyPl: ParsedMonthlyWorkbook;
  monthlyBs: ParsedMonthlyWorkbook;
  mappedPlRows: MappedLedgerRow[];
  mappedBsRows: MappedLedgerRow[];
  accountantStatements: ParsedAccountantStatements;
}) {
  const monthKeys = uniqueMonths(args.monthlyPl.monthKeys);
  console.log(`[TTM] Reconciling: ${monthKeys.length} months, ${args.mappedPlRows.length} P&L rows, ${args.mappedBsRows.length} BS rows`);
  const structuredModel = buildStructuredModel(args.mappedPlRows, monthKeys);
  console.log(`[TTM] Structured model: ${structuredModel.months.length} months, confidence=${structuredModel.confidence}`);
  const ttmSummary = buildTtmSummary(args.mappedPlRows, monthKeys);
  console.log(`[TTM] TTM summary: revenue=$${ttmSummary.totalRevenue.toLocaleString()}, GM=${ttmSummary.grossMarginPct?.toFixed(1) ?? "n/a"}%, EBITDA=$${ttmSummary.ebitdaPreRecast.toLocaleString()}`);
  const annualModel = buildAnnualModel(args.mappedPlRows, monthKeys);
  console.log(`[TTM] Annual model: ${annualModel.years.length} years, ${annualModel.anomalies.length} anomalies`);

  const sections: Record<DataQualitySection, SectionReportItem[]> = {
    A: [
      ...buildMappingSection(args.mappedPlRows, {
        documentId: "monthly_pl_excel",
        documentLabel: "Monthly P&L Excel",
        accountColumnIndex: args.monthlyPl.accountColumnIndex,
      }),
      ...buildMappingSection(args.mappedBsRows, {
        documentId: "monthly_bs_excel",
        documentLabel: "Monthly Balance Sheet Excel",
        accountColumnIndex: args.monthlyBs.accountColumnIndex,
      }),
    ],
    B: [],
    C: buildAccountantVarianceSection({
      monthlyAnnualModel: annualModel,
      accountantStatements: args.accountantStatements,
    }),
    D: buildCoverageSection(args.monthlyPl, args.monthlyBs),
    E: [],
  };

  const totalFlags = Object.values(sections).reduce((s, items) => s + items.length, 0);
  console.log(`[TTM] Quality sections: A=${sections.A.length} B=${sections.B.length} C=${sections.C.length} D=${sections.D.length} E=${sections.E.length} (total=${totalFlags})`);

  return {
    structuredModel,
    ttmSummary,
    annualModel,
    dataQualitySections: sections,
    normalizedData: {
      monthKeys,
      monthlyPl: {
        format: args.monthlyPl.format,
        notes: args.monthlyPl.notes,
        rowCount: args.monthlyPl.rows.length,
      },
      monthlyBs: {
        format: args.monthlyBs.format,
        notes: args.monthlyBs.notes,
        rowCount: args.monthlyBs.rows.length,
      },
      accountantStatements: args.accountantStatements,
      mappedPlRows: args.mappedPlRows,
      mappedBsRows: args.mappedBsRows,
      skippedQuickBooks: true,
      quickBooksReason: "Skipped - QuickBooks not connected",
      workingCapitalCodes: WORKING_CAPITAL_CODES,
    },
  };
}
