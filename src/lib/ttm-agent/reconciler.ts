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
import {
  COGS_CODES,
  EBITDA_OPERATING_EXPENSE_CODES,
  getCategoryLabel,
  OPEX_CODES,
  REVENUE_CODES,
  WORKING_CAPITAL_CODES,
} from "@/lib/ttm-agent/taxonomy";
import { MappedLedgerRow } from "@/lib/ttm-agent/types";

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

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

function isCorporateOverheadRow(row: Pick<MappedLedgerRow, "accountName" | "categoryType">) {
  if (row.categoryType !== "opex") return false;
  return CORPORATE_OVERHEAD_PATTERNS.some((pattern) => pattern.test(row.accountName));
}

function filterFourWallRows(rows: MappedLedgerRow[]) {
  return rows.filter((row) => !isCorporateOverheadRow(row));
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
  const sorted = [...monthKeys].sort((a, b) => a.localeCompare(b));
  const buckets: Array<{ fiscalYear: string; months: string[]; periodStart: string; periodEnd: string; accountantYearKey: string | null }> = [];

  for (let index = 0; index < sorted.length; index += 12) {
    const months = sorted.slice(index, index + 12);
    if (!months.length) continue;
    buckets.push({
      fiscalYear: `FY${buckets.length + 1}`,
      months,
      periodStart: months[0],
      periodEnd: months[months.length - 1],
      accountantYearKey: months.length === 12 ? months[months.length - 1].slice(0, 4) : null,
    });
  }

  return buckets;
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

function buildCoverageSection(monthlyPl: ParsedMonthlyWorkbook, monthlyBs: ParsedMonthlyWorkbook, mappedPlRows: MappedLedgerRow[]) {
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
  if (plYears.length !== bsYears.length) {
    items.push({
      title: "Fiscal year alignment mismatch between P&L and balance sheet",
      severity: "MEDIUM",
      description: `P&L years: ${plYears.join(", ")}. Balance sheet years: ${bsYears.join(", ")}.`,
      payload: { plYears, bsYears },
    });
  }

  const corporateOverheadRows = mappedPlRows.filter(isCorporateOverheadRow);
  if (corporateOverheadRows.length) {
    items.push({
      title: "Potential corporate overhead allocations identified",
      severity: "MEDIUM",
      description: `Detected potential parent-company / corporate overhead allocations in the monthly P&L. These rows are excluded from 4-wall EBITDA and Craig should confirm the exclusion basis.`,
      payload: {
        accountNames: corporateOverheadRows.map((row) => row.accountName),
        rowCount: corporateOverheadRows.length,
      },
    });
  } else {
    items.push({
      title: "Corporate overhead not separately identifiable",
      severity: "MEDIUM",
      description: "No explicit parent-company or corporate overhead allocation lines were identified in the monthly P&L. Craig should confirm whether above-the-line corporate allocations are absent or embedded in other accounts.",
      payload: {
        reason: "No explicit corporate overhead allocation lines matched WS2-1 heuristics",
      },
    });
  }

  return items;
}

function buildStructuredModel(rows: MappedLedgerRow[], monthKeys: string[]): StructuredFinancialModel {
  const months = monthKeys.map((month) => {
    const revenue = sumRowsForMonths(rows, [month], REVENUE_CODES);
    const cogs = sumRowsForMonths(rows, [month], COGS_CODES);
    const grossProfit = revenue - cogs;
    const opEx = sumRowsForMonths(rows, [month], EBITDA_OPERATING_EXPENSE_CODES);
    const ebitdaPreRecast = grossProfit - opEx;

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
  const totalOpEx = sumRowsForMonths(rows, ttmMonths, EBITDA_OPERATING_EXPENSE_CODES);
  const ebitdaPreRecast = grossProfit - totalOpEx;

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
  const fourWallRows = filterFourWallRows(rows);
  const years: AnnualModelYear[] = groupedYears.map(({ fiscalYear, months, periodStart, periodEnd, accountantYearKey }) => {
    const totalRevenue = sumRowsForMonths(rows, months, REVENUE_CODES);
    const totalCogs = sumRowsForMonths(rows, months, COGS_CODES);
    const grossProfit = totalRevenue - totalCogs;
    const totalOpEx = sumRowsForMonths(fourWallRows, months, EBITDA_OPERATING_EXPENSE_CODES);
    const ebitdaPreRecast = grossProfit - totalOpEx;
    const netIncome = grossProfit - sumRowsForMonths(fourWallRows, months, OPEX_CODES);

    return {
      fiscalYear,
      periodStart,
      periodEnd,
      accountantYearKey,
      revenueByCategory: buildBreakdown(rows, months, REVENUE_CODES),
      cogsByCategory: buildBreakdown(rows, months, COGS_CODES),
      opExByCategory: buildBreakdown(fourWallRows, months, OPEX_CODES),
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
        // V3 Section 10: GL mapping confidence < 60% for a major account → HIGH SEVERITY
        severity: (row.mappingConfidence < 0.6 && row.isMajor)
          ? ("HIGH" as const)
          : row.isMajor ? ("HIGH" as const) : ("MEDIUM" as const),
        description: (row.mappingConfidence < 0.6 && row.isMajor)
          ? `HIGH: Confidence ${confidencePct}% for major account ${row.accountName}${row.accountCode ? ` (${row.accountCode})` : ""}. Do not auto-assign — Craig must classify manually.`
          : `Assign a Cantara code for ${row.accountName}${row.accountCode ? ` (${row.accountCode})` : ""}.`,
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
    const displayFiscalYear = `${year.fiscalYear} (${year.periodStart} — ${year.periodEnd})`;
    const accountant = year.accountantYearKey ? accountantByYear.get(year.accountantYearKey) : null;
    if (!accountant) {
      items.push({
        title: `Missing accountant totals for fiscal year ${displayFiscalYear}`,
        severity: "HIGH",
        description: `No accountant-prepared totals were found for fiscal year ${displayFiscalYear}.`,
        payload: { fiscalYear: displayFiscalYear },
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
        console.log(`[TTM] Section C: ${comparison.lineItem} unavailable from monthly rollup for ${displayFiscalYear}`);
        items.push({
          title: `${comparison.lineItem} is unavailable from monthly rollup`,
          severity: "MEDIUM",
          description: `${comparison.lineItem} could not be deterministically derived from the monthly P&L rollup for fiscal year ${displayFiscalYear}. This metric requires below-the-line items not present in the GL taxonomy.`,
          payload: { fiscalYear: displayFiscalYear, lineItem: comparison.lineItem, reason: "Not derivable from Cantara GL taxonomy" },
        });
        continue;
      }

      if (comparison.expected === null) {
        console.log(`[TTM] Section C: ${comparison.lineItem} missing from accountant statements for ${displayFiscalYear}`);
        items.push({
          title: `${comparison.lineItem} missing in accountant statements`,
          severity: "MEDIUM",
          description: `${comparison.lineItem} is not explicitly stated in the accountant-prepared financial statements for fiscal year ${displayFiscalYear}.`,
          payload: { fiscalYear: displayFiscalYear, lineItem: comparison.lineItem, reason: "Not present in accountant statements" },
        });
        continue;
      }

      const variance = compareAgainstThreshold(comparison.actual, comparison.expected, 1000, 1);
      if (variance.isMaterial) {
        console.log(`[TTM] Section C: ${comparison.lineItem} ${displayFiscalYear} variance=$${variance.variance.toFixed(2)} (rollup=$${comparison.actual}, accountant=$${comparison.expected})`);
        items.push({
          title: `${comparison.lineItem} variance for fiscal year ${displayFiscalYear}`,
          severity: Math.abs(variance.variance) > 5000 ? "HIGH" : "MEDIUM",
          description: `${comparison.lineItem} differs from accountant totals by $${variance.variance.toFixed(2)}.`,
          payload: {
            fiscalYear: displayFiscalYear,
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
  const fourWallPlRows = filterFourWallRows(args.mappedPlRows);
  console.log(`[TTM] Reconciling: ${monthKeys.length} months, ${args.mappedPlRows.length} P&L rows, ${args.mappedBsRows.length} BS rows`);
  const structuredModel = buildStructuredModel(fourWallPlRows, monthKeys);
  console.log(`[TTM] Structured model: ${structuredModel.months.length} months, confidence=${structuredModel.confidence}`);
  const ttmSummary = buildTtmSummary(fourWallPlRows, monthKeys);
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
    D: buildCoverageSection(args.monthlyPl, args.monthlyBs, args.mappedPlRows),
    E: [],
  };

  // V3 Section 10: Fewer than 24 months → flag in DQR; label all outputs as "PARTIAL DATA"
  const isPartialData = monthKeys.length < 24;
  if (isPartialData) {
    structuredModel.confidence = "LOW";
    sections.D.push({
      title: "PARTIAL DATA: Fewer than 24 months available",
      severity: "HIGH",
      description: `Only ${monthKeys.length} months of data are available (minimum 24 required for reliable analysis). All outputs from this analysis are labeled PARTIAL DATA. Proceed with caution.`,
      payload: { monthCount: monthKeys.length, label: "PARTIAL DATA" },
    });
  }

  const totalFlags = Object.values(sections).reduce((s, items) => s + items.length, 0);
  console.log(`[TTM] Quality sections: A=${sections.A.length} B=${sections.B.length} C=${sections.C.length} D=${sections.D.length} E=${sections.E.length} (total=${totalFlags})`);

  return {
    structuredModel,
    ttmSummary,
    annualModel,
    dataQualitySections: sections,
    normalizedData: {
      monthKeys,
      partialDataLabel: isPartialData ? "PARTIAL DATA" : null,
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
