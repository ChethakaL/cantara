import * as XLSX from 'xlsx'
import type { WorkbookOverrideSnapshot } from '@/lib/ttm-agent/workbook-overrides'

type SheetRows = Array<Array<string | number | null>>

function toRows(sheet: XLSX.WorkSheet | undefined): SheetRows {
  if (!sheet) return []
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
  }) as SheetRows
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim()
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null
  const cleaned = value
    .trim()
    .replace(/\$/g, '')
    .replace(/,/g, '')
    .replace(/%/g, '')
    .replace(/x$/i, '')
    .replace(/^\((.*)\)$/, '-$1')
  if (!cleaned) return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function findHeaderIndex(rows: SheetRows, firstCell: string) {
  return rows.findIndex((row) => asString(row[0]).toLowerCase() === firstCell.toLowerCase())
}

function normalizePlLabel(value: unknown) {
  return asString(value).replace(/^\s+/, '').trim()
}

function parsePlSection(rows: SheetRows, startLabel: string, endLabels: string[]) {
  const byLabel: Record<string, { fy1?: number; fy2?: number; fy3?: number; ttm?: number }> = {}
  const start = findHeaderIndex(rows, startLabel)
  if (start < 0) return byLabel

  for (let i = start + 1; i < rows.length; i += 1) {
    const row = rows[i] ?? []
    const label = normalizePlLabel(row[0])
    if (!label) continue
    if (endLabels.some((endLabel) => label.toLowerCase() === endLabel.toLowerCase())) break
    if (/^Total /i.test(label) || /^Gross Profit$/i.test(label) || /^Gross Margin %$/i.test(label) || /^4-Wall EBITDA/i.test(label) || /^EBITDA Margin %$/i.test(label) || /^Net Income$/i.test(label)) {
      continue
    }

    const fy1 = asNumber(row[1])
    const fy2 = asNumber(row[3])
    const fy3 = asNumber(row[5])
    const ttm = asNumber(row[6])
    if (fy1 == null && fy2 == null && fy3 == null && ttm == null) continue

    byLabel[label] = {
      fy1: fy1 ?? undefined,
      fy2: fy2 ?? undefined,
      fy3: fy3 ?? undefined,
      ttm: ttm ?? undefined,
    }
  }

  return byLabel
}

function parseRecastItems(rows: SheetRows) {
  const items: Record<string, { description?: string; status?: string; ttm?: number; fy3?: number; fy2?: number }> = {}
  for (const row of rows) {
    const id = asString(row[0])
    if (!id || !/^\d+$/.test(id)) continue
    items[id] = {
      description: asString(row[1]) || undefined,
      ttm: asNumber(row[3]) ?? undefined,
      fy3: asNumber(row[4]) ?? undefined,
      fy2: asNumber(row[5]) ?? undefined,
      status: asString(row[7]) || undefined,
    }
  }
  return items
}

function readSummarySeries(rows: SheetRows, label: string) {
  const row = rows.find((entry) => asString(entry[0]).toLowerCase() === label.toLowerCase())
  if (!row) return undefined
  const fy1 = asNumber(row[1])
  const fy2 = asNumber(row[2])
  const ttm = asNumber(row[3])
  if (fy1 == null && fy2 == null && ttm == null) return undefined
  return {
    fy1: fy1 ?? undefined,
    fy2: fy2 ?? undefined,
    ttm: ttm ?? undefined,
  }
}

export function parseWorkbookOverrideSnapshotFromXlsx(buffer: Buffer): WorkbookOverrideSnapshot {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: true })
  const summaryRows = toRows(wb.Sheets['Summary'] ?? wb.Sheets['Export Summary'])
  const plRows = toRows(wb.Sheets['TTM & 3-Year P&L'])
  const recastRows = toRows(wb.Sheets['Normalization Items'])
  const valuationRows = toRows(wb.Sheets['Valuation'])
  const verticalRows = toRows(wb.Sheets['Revenue by Vertical'])
  const benchmarkRows = toRows(wb.Sheets['Expense Benchmarks'])
  const laborRows = toRows(wb.Sheets['Labor Analysis'])
  const wcRows = toRows(wb.Sheets['Working Capital'])

  const revenueLines = parsePlSection(plRows, 'REVENUE', ['COST OF GOODS SOLD'])
  const cogsLines = parsePlSection(plRows, 'COST OF GOODS SOLD', ['Gross Profit'])
  const expenseLines = parsePlSection(plRows, 'OPERATING EXPENSES', ['4-Wall EBITDA (Pre-Recast)'])

  const totals: Record<string, { fy1?: number; fy2?: number; fy3?: number; ttm?: number }> = {}
  for (const [sheetLabel, snapshotLabel] of [
    ['Total Revenue', 'Total Revenue'],
    ['Total COGS', 'Total COGS'],
    ['Gross Profit', 'Gross Profit'],
    ['Gross Margin %', 'Gross Margin'],
    ['Total Operating Expenses', 'Total Operating Expenses'],
    ['4-Wall EBITDA (Pre-Recast)', '4-Wall EBITDA (Pre-Recast)'],
    ['EBITDA Margin %', 'EBITDA Margin'],
  ] as const) {
    const row = plRows.find((r) => normalizePlLabel(r[0]).toLowerCase() === sheetLabel.toLowerCase())
    if (!row) continue
    totals[snapshotLabel] = {
      fy1: asNumber(row[1]) ?? undefined,
      fy2: asNumber(row[3]) ?? undefined,
      fy3: asNumber(row[5]) ?? undefined,
      ttm: asNumber(row[6]) ?? undefined,
    }
  }

  const recastItems = parseRecastItems(recastRows)
  const totalAddBacksRow = recastRows.find((row) => /TOTAL ADD-BACKS/i.test(asString(row[0])))
  const normalizedRow = recastRows.find((row) => /NORMALIZED EBITDA \(TTM\)/i.test(asString(row[0])))
  const marginRow = recastRows.find((row) => /Margin/i.test(asString(row[7])))
  const multiRow = valuationRows.find((row) => /Multiple Applied/i.test(asString(row[0])))
  const rangeRow = valuationRows.find((row) => /^Valuation$/i.test(asString(row[0])))

  const verticals: Record<string, { fy1Dollar?: number; fy1Pct?: number; fy2Dollar?: number; fy2Pct?: number; ttmDollar?: number; ttmPct?: number }> = {}
  for (const row of verticalRows) {
    const name = asString(row[0])
    if (!name || /^Vertical$/i.test(name) || /^BOARDING \+ DAYCARE/i.test(name)) continue
    const fy1Dollar = asNumber(row[1])
    const fy1Pct = asNumber(row[2])
    const fy2Dollar = asNumber(row[3])
    const fy2Pct = asNumber(row[4])
    const ttmDollar = asNumber(row[5])
    const ttmPct = asNumber(row[6])
    if ([fy1Dollar, fy1Pct, fy2Dollar, fy2Pct, ttmDollar, ttmPct].every((v) => v == null)) continue
    verticals[name] = {
      fy1Dollar: fy1Dollar ?? undefined,
      fy1Pct: fy1Pct ?? undefined,
      fy2Dollar: fy2Dollar ?? undefined,
      fy2Pct: fy2Pct ?? undefined,
      ttmDollar: ttmDollar ?? undefined,
      ttmPct: ttmPct ?? undefined,
    }
  }

  const benchmarks: Record<string, { fy1Dollar?: number; fy1Pct?: number; fy2Dollar?: number; fy2Pct?: number; ttmDollar?: number; ttmPct?: number; flag?: string }> = {}
  for (const row of benchmarkRows) {
    const category = asString(row[0])
    if (!category || /^Category$/i.test(category) || /^Overall Expense Health/i.test(category) || /^IMPROVEMENT OPPORTUNITIES/i.test(category)) continue
    const fy1Dollar = asNumber(row[3])
    const fy1Pct = asNumber(row[4])
    const fy2Dollar = asNumber(row[5])
    const fy2Pct = asNumber(row[6])
    const ttmDollar = asNumber(row[7])
    const ttmPct = asNumber(row[8])
    const flag = asString(row[9]) || undefined
    if ([fy1Dollar, fy1Pct, fy2Dollar, fy2Pct, ttmDollar, ttmPct].every((v) => v == null) && !flag) continue
    benchmarks[category] = {
      fy1Dollar: fy1Dollar ?? undefined,
      fy1Pct: fy1Pct ?? undefined,
      fy2Dollar: fy2Dollar ?? undefined,
      fy2Pct: fy2Pct ?? undefined,
      ttmDollar: ttmDollar ?? undefined,
      ttmPct: ttmPct ?? undefined,
      flag,
    }
  }

  const labor: Record<string, { ttmAmount?: number; ttmPct?: number; fy3Pct?: number; fy2Pct?: number; fy1Pct?: number }> = {}
  for (const row of laborRows) {
    const label = asString(row[0])
    if (!label || /^Category$/i.test(label) || /^BENCHMARK COMPARISON$/i.test(label) || /^3-YEAR LABOR TREND$/i.test(label) || /^FLAGS$/i.test(label)) continue
    const ttmAmount = asNumber(row[1])
    const ttmPct = asNumber(row[2])
    const fy3Pct = asNumber(row[3])
    const fy2Pct = asNumber(row[4])
    const fy1Pct = asNumber(row[5])
    if ([ttmAmount, ttmPct, fy3Pct, fy2Pct, fy1Pct].every((v) => v == null)) continue
    labor[label] = {
      ttmAmount: ttmAmount ?? undefined,
      ttmPct: ttmPct ?? undefined,
      fy3Pct: fy3Pct ?? undefined,
      fy2Pct: fy2Pct ?? undefined,
      fy1Pct: fy1Pct ?? undefined,
    }
  }

  const wcLookup = (label: string) => asNumber(wcRows.find((row) => asString(row[0]).toLowerCase() === label.toLowerCase())?.[1]) ?? undefined
  const wcLookupIndented = (label: string) => {
    const match = wcRows.find((row) => normalizePlLabel(row[0]).toLowerCase() === label.toLowerCase())
    return asNumber(match?.[1]) ?? undefined
  }
  const directLaborRow = laborRows.find((row) => /Direct Labor \(ex-owner\)/i.test(asString(row[0])))
  const benchmarkSectionIndex = findHeaderIndex(laborRows, 'BENCHMARK COMPARISON')
  const benchmarkNote = benchmarkSectionIndex >= 0 ? asString(laborRows[benchmarkSectionIndex + 2]?.[0]) || undefined : undefined
  const trendSectionIndex = findHeaderIndex(laborRows, '3-YEAR LABOR TREND')
  const trendNote = trendSectionIndex >= 0 ? asString(laborRows[trendSectionIndex + 1]?.[0]) || undefined : undefined
  const overallHealth = asString(benchmarkRows.find((row) => /^Overall Expense Health:/i.test(asString(row[0])))?.[0]).split(':')[1]?.trim()
  const summaryTotalRevenue = readSummarySeries(summaryRows, 'Total Revenue')
  const summaryGrossProfit = readSummarySeries(summaryRows, 'Gross Profit')
  const summaryTotalOpex = readSummarySeries(summaryRows, 'Total Operating Expenses')
  const summaryEbitda = readSummarySeries(summaryRows, '4-Wall EBITDA (Pre-Recast)')

  return {
    annualPL: {
      revenueLines,
      cogsLines,
      expenseLines,
      totals: {
        ...totals,
        ...(summaryTotalRevenue ? { 'Total Revenue': { ...totals['Total Revenue'], ...summaryTotalRevenue } } : {}),
        ...(summaryGrossProfit ? { 'Gross Profit': { ...totals['Gross Profit'], ...summaryGrossProfit } } : {}),
        ...(summaryTotalOpex ? { 'Total Operating Expenses': { ...totals['Total Operating Expenses'], ...summaryTotalOpex } } : {}),
        ...(summaryEbitda ? { '4-Wall EBITDA (Pre-Recast)': { ...totals['4-Wall EBITDA (Pre-Recast)'], ...summaryEbitda } } : {}),
      },
    },
    recast: {
      items: recastItems,
      totalAddBacks: asNumber(totalAddBacksRow?.[3]) ?? undefined,
      normalizedEbitdaTTM: asNumber(normalizedRow?.[3]) ?? undefined,
      normalizedMarginTTM: asNumber(marginRow?.[7]) ?? undefined,
      valuation: {
        multipleLow: asNumber(multiRow?.[1]) ?? undefined,
        multipleMid: asNumber(multiRow?.[2]) ?? undefined,
        multipleHigh: asNumber(multiRow?.[3]) ?? undefined,
        valuationLow: asNumber(rangeRow?.[1]) ?? undefined,
        valuationMid: asNumber(rangeRow?.[2]) ?? undefined,
        valuationHigh: asNumber(rangeRow?.[3]) ?? undefined,
      },
    },
    ws23: { verticals },
    ws24: { benchmarks, overallHealth: overallHealth || undefined },
    ws25: {
      laborRows: labor,
      directLaborPct: asNumber(directLaborRow?.[1]) ?? undefined,
      benchmarkStatus: benchmarkNote && /below benchmark/i.test(benchmarkNote)
        ? 'RED'
        : benchmarkNote && /within benchmark/i.test(benchmarkNote)
          ? 'GREEN'
          : benchmarkNote && /slightly above|above benchmark/i.test(benchmarkNote)
            ? 'YELLOW'
            : undefined,
      benchmarkNote,
      trendNote,
    },
    workingCapital: {
      cash: wcLookupIndented('Cash & Equivalents'),
      accountsReceivable: wcLookupIndented('Accounts Receivable'),
      inventory: wcLookupIndented('Inventory'),
      prepaidExpenses: wcLookupIndented('Prepaid Expenses'),
      totalCurrentAssets: wcLookup('Total Current Assets'),
      accountsPayable: wcLookupIndented('Accounts Payable'),
      accruedLiabilities: wcLookupIndented('Accrued Liabilities'),
      deferredRevenue: wcLookupIndented('Deferred Revenue'),
      totalCurrentLiabilities: wcLookup('Total Current Liabilities'),
      netWorkingCapital: wcLookup('Net Working Capital (Point-in-time)'),
      trailingThreeMonthAvgNWC: wcLookup('3-Month Trailing Average NWC'),
    },
  }
}
