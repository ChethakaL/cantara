import { SectionReportItem, WorkingCapitalSummary } from "@/lib/ttm-agent/types";
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

export function buildWorkingCapitalSummary(args: {
  mappedBalanceSheetRows: MappedLedgerRow[];
  balanceSheetMonths: string[];
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

  const qualityItems: SectionReportItem[] = [];

  console.log(`[TTM] Working capital: NWC=$${netWorkingCapital.toLocaleString()}, 0 quality flags`);

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
    } satisfies WorkingCapitalSummary,
    qualityItems,
  };
}
