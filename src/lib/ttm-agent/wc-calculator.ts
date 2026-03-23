import { ParsedArAging, SectionReportItem, WorkingCapitalSummary } from "@/lib/ttm-agent/types";
import { getCategoryLabel } from "@/lib/ttm-agent/taxonomy";
import { MappedLedgerRow } from "@/lib/ttm-agent/types";

const WC_ASSET_CODES = ["WC-CASH", "WC-AR", "WC-INV", "WC-PREPAID"] as const;
const WC_LIABILITY_CODES = ["WC-AP", "WC-ACCR", "WC-DREV"] as const;

function safeNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function valueForCodeAtMonth(rows: MappedLedgerRow[], code: string, month: string) {
  return safeNumber(
    rows
    .filter((row) => row.cantaraCode === code)
    .reduce((sum, row) => sum + safeNumber(row.valuesByMonth[month] ?? 0), 0),
  );
}

function ratio(value: number, total: number) {
  if (!total) return null;
  return (value / total) * 100;
}

export function buildWorkingCapitalSummary(args: {
  mappedBalanceSheetRows: MappedLedgerRow[];
  balanceSheetMonths: string[];
  arAging: ParsedArAging;
}) {
  const latestMonth = args.balanceSheetMonths[args.balanceSheetMonths.length - 1];
  if (!latestMonth) {
    throw new Error("Balance sheet has no usable month columns.");
  }

  const trailingMonths = args.balanceSheetMonths.slice(-3);
  const currentAssets = WC_ASSET_CODES.map((code) => ({
    code,
    category: getCategoryLabel(code),
    value: valueForCodeAtMonth(args.mappedBalanceSheetRows, code, latestMonth),
  }));
  const currentLiabilities = WC_LIABILITY_CODES.map((code) => ({
    code,
    category: getCategoryLabel(code),
    value: valueForCodeAtMonth(args.mappedBalanceSheetRows, code, latestMonth),
  }));

  const totalCurrentAssets = safeNumber(currentAssets.reduce((sum, item) => sum + safeNumber(item.value), 0));
  const totalCurrentLiabilities = safeNumber(
    currentLiabilities.reduce((sum, item) => sum + safeNumber(item.value), 0),
  );
  const netWorkingCapital = safeNumber(totalCurrentAssets - totalCurrentLiabilities);

  const trailingValues = trailingMonths.map((month) => {
    const assets = WC_ASSET_CODES.reduce(
      (sum, code) => sum + valueForCodeAtMonth(args.mappedBalanceSheetRows, code, month),
      0,
    );
    const liabilities = WC_LIABILITY_CODES.reduce(
      (sum, code) => sum + valueForCodeAtMonth(args.mappedBalanceSheetRows, code, month),
      0,
    );
    return safeNumber(assets - liabilities);
  });

  const totalAr = safeNumber(args.arAging.entries.reduce((sum, entry) => sum + safeNumber(entry.total), 0));
  const current = safeNumber(args.arAging.entries.reduce((sum, entry) => sum + safeNumber(entry.current), 0));
  const days1To30 = safeNumber(args.arAging.entries.reduce((sum, entry) => sum + safeNumber(entry.days1To30), 0));
  const days31To60 = safeNumber(args.arAging.entries.reduce((sum, entry) => sum + safeNumber(entry.days31To60), 0));
  const days61To90 = safeNumber(args.arAging.entries.reduce((sum, entry) => sum + safeNumber(entry.days61To90), 0));
  const days90Plus = safeNumber(args.arAging.entries.reduce((sum, entry) => sum + safeNumber(entry.days90Plus), 0));
  const balanceSheetAr = valueForCodeAtMonth(args.mappedBalanceSheetRows, "WC-AR", latestMonth);
  const varianceToBalanceSheetAr = safeNumber(totalAr - balanceSheetAr);

  const topCustomers = [...args.arAging.entries]
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map((entry) => ({
      customerName: entry.customerName,
      total: safeNumber(entry.total),
      pctOfTotal: ratio(entry.total, totalAr),
    }));

  const qualityItems: SectionReportItem[] = [];

  if (ratio(days90Plus, totalAr) !== null && ratio(days90Plus, totalAr)! > 15) {
    console.log(`[TTM] Section E: 90+ day AR = ${ratio(days90Plus, totalAr)!.toFixed(1)}% of total (threshold 15%)`);
    qualityItems.push({
      title: "90+ day AR concentration exceeds 15%",
      severity: "HIGH",
      description: `The 90+ day AR bucket is ${ratio(days90Plus, totalAr)!.toFixed(1)}% of total AR ($${days90Plus.toLocaleString()} of $${totalAr.toLocaleString()}).`,
      payload: { totalAr, days90Plus, pct90Plus: ratio(days90Plus, totalAr), source: "AR Aging Detail" },
    });
  }

  if (Math.abs(varianceToBalanceSheetAr) > 500) {
    console.log(`[TTM] Section E: AR aging variance=$${varianceToBalanceSheetAr.toFixed(2)} (aging=$${totalAr.toLocaleString()}, BS=$${balanceSheetAr.toLocaleString()})`);
    qualityItems.push({
      title: "AR aging does not reconcile to balance sheet AR",
      severity: "HIGH",
      description: `AR aging total ($${totalAr.toLocaleString()}) differs from balance sheet AR ($${balanceSheetAr.toLocaleString()}) by $${varianceToBalanceSheetAr.toFixed(2)}.`,
      payload: { totalAr, balanceSheetAr, varianceToBalanceSheetAr, sourceAging: "AR Aging Detail", sourceBalanceSheet: "Monthly Balance Sheet Excel" },
    });
  }

  for (const customer of topCustomers) {
    if ((customer.pctOfTotal ?? 0) > 20) {
      console.log(`[TTM] Section E: customer concentration ${customer.customerName} = ${customer.pctOfTotal!.toFixed(1)}% ($${customer.total.toLocaleString()} of $${totalAr.toLocaleString()})`);
      qualityItems.push({
        title: `Customer concentration: ${customer.customerName} exceeds 20% of total AR`,
        severity: "MEDIUM",
        description: `${customer.customerName} represents ${customer.pctOfTotal!.toFixed(1)}% of total AR ($${customer.total.toLocaleString()} of $${totalAr.toLocaleString()}).`,
        payload: { ...customer, totalAr, source: "AR Aging Detail" },
      });
    }
  }

  console.log(`[TTM] Working capital: NWC=$${netWorkingCapital.toLocaleString()}, AR=$${totalAr.toLocaleString()}, ${qualityItems.length} quality flags`);

  return {
    workingCapital: {
      month: latestMonth,
      currentAssets,
      currentLiabilities,
      totalCurrentAssets,
      totalCurrentLiabilities,
      netWorkingCapital,
      trailingThreeMonthAverageNwc: trailingValues.length
        ? safeNumber(trailingValues.reduce((sum, value) => sum + safeNumber(value), 0) / trailingValues.length)
        : null,
      arAging: {
        totalAr,
        current,
        days1To30,
        days31To60,
        days61To90,
        days90Plus,
        pctCurrent: ratio(current, totalAr),
        pct1To30: ratio(days1To30, totalAr),
        pct31To60: ratio(days31To60, totalAr),
        pct61To90: ratio(days61To90, totalAr),
        pct90Plus: ratio(days90Plus, totalAr),
        topCustomers,
        reconcilesToBalanceSheet: Math.abs(varianceToBalanceSheetAr) <= 500,
        varianceToBalanceSheetAr,
      },
    } satisfies WorkingCapitalSummary,
    qualityItems,
  };
}
