import type { BenchmarkRow, LaborRow, VerticalRow, WS2Report } from '@/lib/ws2/ws2-types'

type SeriesValues = {
  fy1?: number
  fy2?: number
  fy3?: number
  ttm?: number
}

type RecastItemOverride = SeriesValues & {
  description?: string
  status?: string
}

export type WorkbookOverrideSnapshot = {
  annualPL?: {
    revenueLines?: Record<string, SeriesValues>
    cogsLines?: Record<string, SeriesValues>
    expenseLines?: Record<string, SeriesValues>
    totals?: Record<string, SeriesValues>
  }
  recast?: {
    items?: Record<string, RecastItemOverride>
    totalAddBacks?: number
    normalizedEbitdaTTM?: number
    normalizedMarginTTM?: number
    valuation?: {
      multipleLow?: number
      multipleMid?: number
      multipleHigh?: number
      valuationLow?: number
      valuationMid?: number
      valuationHigh?: number
      replacementSalary?: number
      fmrAdjustment?: number | null
    }
  }
  ws23?: {
    verticals?: Record<string, {
      fy1Dollar?: number
      fy1Pct?: number
      fy2Dollar?: number
      fy2Pct?: number
      fy3Dollar?: number
      fy3Pct?: number
      ttmDollar?: number
      ttmPct?: number
    }>
  }
  ws24?: {
    benchmarks?: Record<string, {
      fy1Dollar?: number
      fy1Pct?: number
      fy2Dollar?: number
      fy2Pct?: number
      fy3Dollar?: number
      fy3Pct?: number
      ttmDollar?: number
      ttmPct?: number
      flag?: string
    }>
    overallHealth?: string
  }
  ws25?: {
    laborRows?: Record<string, {
      ttmAmount?: number
      ttmPct?: number
      fy3Amount?: number
      fy3Pct?: number
      fy2Pct?: number
      fy1Pct?: number
    }>
    directLaborPct?: number
    buyerAdjustedLaborPct?: number
    benchmarkStatus?: string
    benchmarkNote?: string
    trendNote?: string
  }
  workingCapital?: {
    cash?: number
    accountsReceivable?: number
    inventory?: number
    prepaidExpenses?: number
    totalCurrentAssets?: number
    accountsPayable?: number
    accruedLiabilities?: number
    deferredRevenue?: number
    totalCurrentLiabilities?: number
    netWorkingCapital?: number
    trailingThreeMonthAvgNWC?: number
  }
}

export type WorkbookChange = {
  section: string
  label: string
  field: string
  before: string
  after: string
}

function cloneReport<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function formatChangeValue(value: number | string | null | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const abs = Math.abs(value)
    const isPctField = abs > 0 && abs <= 1
    if (isPctField) return `${(value * 100).toFixed(1)}%`
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
  }
  if (value == null || value === '') return '—'
  return String(value)
}

function numbersDiffer(before: number | null | undefined, after: number | null | undefined) {
  if (typeof after !== 'number' || !Number.isFinite(after)) return false
  if (typeof before !== 'number' || !Number.isFinite(before)) return true

  const absDelta = Math.abs(before - after)
  if (absDelta < 1e-9) return false

  const scale = Math.max(Math.abs(before), Math.abs(after), 1)
  return absDelta / scale > 1e-9
}

function mapSeriesRows<T extends { label?: string; category?: string; fy1?: number; fy2?: number; fy3?: number; ttm?: number }>(
  rows: T[] | undefined,
  labelKey: 'label' | 'category',
) {
  return Object.fromEntries(
    (rows ?? []).map((row) => [
      String(row[labelKey] ?? ''),
      {
        fy1: row.fy1,
        fy2: row.fy2,
        fy3: row.fy3,
        ttm: row.ttm,
      },
    ]),
  )
}

export function buildWorkbookOverrideSnapshot(report: WS2Report): WorkbookOverrideSnapshot {
  return {
    annualPL: {
      revenueLines: mapSeriesRows(report.ws21.annualPL.revenueLines, 'label'),
      cogsLines: mapSeriesRows(report.ws21.annualPL.cogsLines, 'label'),
      expenseLines: mapSeriesRows(report.ws21.annualPL.expenseLines, 'label'),
      totals: {
        'Total Revenue': report.ws21.annualPL.totalRevenue,
        'Total COGS': report.ws21.annualPL.totalCogs,
        'Gross Profit': report.ws21.annualPL.grossProfit,
        'Gross Margin': report.ws21.annualPL.grossMargin,
        'Total Operating Expenses': report.ws21.annualPL.totalOpex,
        '4-Wall EBITDA (Pre-Recast)': report.ws21.annualPL.ebitdaPreRecast,
        'EBITDA Margin': report.ws21.annualPL.ebitdaMargin,
      },
    },
    recast: report.ws22 ? {
      items: Object.fromEntries(report.ws22.recastSchedule.addBackItems.map((item) => [
        item.id,
        {
          description: item.description,
          status: item.status,
          fy1: item.fy1Amount,
          fy2: item.fy2Amount,
          fy3: item.fy3Amount,
          ttm: item.ttmAmount,
        },
      ])),
      totalAddBacks: report.ws22.recastSchedule.totalAddBacks,
      normalizedEbitdaTTM: report.ws22.recastSchedule.normalizedEbitdaTTM,
      normalizedMarginTTM: report.ws22.recastSchedule.normalizedMarginTTM,
      valuation: {
        multipleLow: report.ws22.valuation.multipleAssumptions.low,
        multipleMid: report.ws22.valuation.multipleAssumptions.mid,
        multipleHigh: report.ws22.valuation.multipleAssumptions.high,
        valuationLow: report.ws22.valuation.valuationLow,
        valuationMid: report.ws22.valuation.valuationMid,
        valuationHigh: report.ws22.valuation.valuationHigh,
        replacementSalary: report.ws22.valuation.replacementSalary,
        fmrAdjustment: report.ws22.valuation.fmrAdjustment ?? null,
      },
    } : undefined,
    ws23: report.ws23 ? {
      verticals: Object.fromEntries(report.ws23.verticals.map((row) => [
        row.name,
        {
          fy1Dollar: row.fy1Dollar,
          fy1Pct: row.fy1Pct,
          fy2Dollar: row.fy2Dollar,
          fy2Pct: row.fy2Pct,
          fy3Dollar: row.fy3Dollar,
          fy3Pct: row.fy3Pct,
          ttmDollar: row.ttmDollar,
          ttmPct: row.ttmPct,
        },
      ])),
    } : undefined,
    ws24: report.ws24 ? {
      benchmarks: Object.fromEntries(report.ws24.benchmarks.map((row) => [
        row.category,
        {
          fy1Dollar: row.fy1Dollar,
          fy1Pct: row.fy1Pct,
          fy2Dollar: row.fy2Dollar,
          fy2Pct: row.fy2Pct,
          fy3Dollar: row.fy3Dollar,
          fy3Pct: row.fy3Pct,
          ttmDollar: row.ttmDollar,
          ttmPct: row.ttmPct,
          flag: row.flag,
        },
      ])),
      overallHealth: report.ws24.overallHealth,
    } : undefined,
    ws25: report.ws25 ? {
      laborRows: Object.fromEntries(report.ws25.laborRows.map((row) => [
        row.category,
        {
          ttmAmount: row.ttmAmount,
          ttmPct: row.ttmPct,
          fy3Amount: row.fy3Amount,
          fy3Pct: row.fy3Pct,
          fy2Pct: row.fy2Pct,
          fy1Pct: row.fy1Pct,
        },
      ])),
      directLaborPct: report.ws25.directLaborPct,
      buyerAdjustedLaborPct: report.ws25.buyerAdjustedLaborPct,
      benchmarkStatus: report.ws25.benchmarkStatus,
      benchmarkNote: report.ws25.benchmarkNote,
      trendNote: report.ws25.trendNote,
    } : undefined,
    workingCapital: {
      cash: report.ws21.workingCapital.cash,
      accountsReceivable: report.ws21.workingCapital.accountsReceivable,
      inventory: report.ws21.workingCapital.inventory,
      prepaidExpenses: report.ws21.workingCapital.prepaidExpenses,
      totalCurrentAssets: report.ws21.workingCapital.totalCurrentAssets,
      accountsPayable: report.ws21.workingCapital.accountsPayable,
      accruedLiabilities: report.ws21.workingCapital.accruedLiabilities,
      deferredRevenue: report.ws21.workingCapital.deferredRevenue,
      totalCurrentLiabilities: report.ws21.workingCapital.totalCurrentLiabilities,
      netWorkingCapital: report.ws21.workingCapital.netWorkingCapital,
      trailingThreeMonthAvgNWC: report.ws21.workingCapital.trailingThreeMonthAvgNWC,
    },
  }
}

function applySeriesOverride<T extends { label?: string; category?: string; fy1?: number; fy2?: number; fy3?: number; ttm?: number }>(
  rows: T[],
  overrides: Record<string, SeriesValues> | undefined,
  labelKey: 'label' | 'category',
) {
  if (!overrides) return rows
  return rows.map((row) => {
    const key = String(row[labelKey] ?? '')
    const override = overrides[key]
    if (!override) return row
    return {
      ...row,
      fy1: override.fy1 ?? row.fy1,
      fy2: override.fy2 ?? row.fy2,
      fy3: override.fy3 ?? row.fy3,
      ttm: override.ttm ?? row.ttm,
    }
  })
}

export function applyWorkbookOverrideSnapshot(report: WS2Report, snapshot: WorkbookOverrideSnapshot | null | undefined): WS2Report {
  if (!snapshot) return report

  const next = cloneReport(report)

  if (snapshot.annualPL) {
    next.ws21.annualPL.revenueLines = applySeriesOverride(next.ws21.annualPL.revenueLines, snapshot.annualPL.revenueLines, 'label')
    next.ws21.annualPL.cogsLines = applySeriesOverride(next.ws21.annualPL.cogsLines, snapshot.annualPL.cogsLines, 'label')
    next.ws21.annualPL.expenseLines = applySeriesOverride(next.ws21.annualPL.expenseLines, snapshot.annualPL.expenseLines, 'label')

    const totals = snapshot.annualPL.totals
    if (totals?.['Total Revenue']) next.ws21.annualPL.totalRevenue = { ...next.ws21.annualPL.totalRevenue, ...totals['Total Revenue'] }
    if (totals?.['Total COGS']) next.ws21.annualPL.totalCogs = { ...next.ws21.annualPL.totalCogs, ...totals['Total COGS'] }
    if (totals?.['Gross Profit']) next.ws21.annualPL.grossProfit = { ...next.ws21.annualPL.grossProfit, ...totals['Gross Profit'] }
    if (totals?.['Gross Margin']) next.ws21.annualPL.grossMargin = { ...next.ws21.annualPL.grossMargin, ...totals['Gross Margin'] }
    if (totals?.['Total Operating Expenses']) next.ws21.annualPL.totalOpex = { ...next.ws21.annualPL.totalOpex, ...totals['Total Operating Expenses'] }
    if (totals?.['4-Wall EBITDA (Pre-Recast)']) next.ws21.annualPL.ebitdaPreRecast = { ...next.ws21.annualPL.ebitdaPreRecast, ...totals['4-Wall EBITDA (Pre-Recast)'] }
    if (totals?.['EBITDA Margin']) next.ws21.annualPL.ebitdaMargin = { ...next.ws21.annualPL.ebitdaMargin, ...totals['EBITDA Margin'] }
  }

  if (next.ws22 && snapshot.recast) {
    if (snapshot.recast.items) {
      next.ws22.recastSchedule.addBackItems = next.ws22.recastSchedule.addBackItems.map((item) => {
        const override = snapshot.recast?.items?.[item.id]
        if (!override) return item
        return {
          ...item,
          description: override.description ?? item.description,
          status: (override.status as typeof item.status | undefined) ?? item.status,
          fy1Amount: override.fy1 ?? item.fy1Amount,
          fy2Amount: override.fy2 ?? item.fy2Amount,
          fy3Amount: override.fy3 ?? item.fy3Amount,
          ttmAmount: override.ttm ?? item.ttmAmount,
        }
      })
    }
    next.ws22.recastSchedule.totalAddBacks = snapshot.recast.totalAddBacks ?? next.ws22.recastSchedule.addBackItems.reduce((sum, item) => sum + item.ttmAmount, 0)
    next.ws22.recastSchedule.normalizedEbitdaTTM = snapshot.recast.normalizedEbitdaTTM ?? next.ws22.recastSchedule.normalizedEbitdaTTM
    next.ws22.recastSchedule.normalizedMarginTTM = snapshot.recast.normalizedMarginTTM ?? next.ws22.recastSchedule.normalizedMarginTTM
    if (snapshot.recast.valuation) {
      next.ws22.valuation = {
        ...next.ws22.valuation,
        multipleAssumptions: {
          low: snapshot.recast.valuation.multipleLow ?? next.ws22.valuation.multipleAssumptions.low,
          mid: snapshot.recast.valuation.multipleMid ?? next.ws22.valuation.multipleAssumptions.mid,
          high: snapshot.recast.valuation.multipleHigh ?? next.ws22.valuation.multipleAssumptions.high,
        },
        valuationLow: snapshot.recast.valuation.valuationLow ?? next.ws22.valuation.valuationLow,
        valuationMid: snapshot.recast.valuation.valuationMid ?? next.ws22.valuation.valuationMid,
        valuationHigh: snapshot.recast.valuation.valuationHigh ?? next.ws22.valuation.valuationHigh,
        replacementSalary: snapshot.recast.valuation.replacementSalary ?? next.ws22.valuation.replacementSalary,
        fmrAdjustment: snapshot.recast.valuation.fmrAdjustment ?? next.ws22.valuation.fmrAdjustment,
      }
    }
  }

  if (next.ws23?.verticals && snapshot.ws23?.verticals) {
    next.ws23.verticals = next.ws23.verticals.map((row: VerticalRow) => ({
      ...row,
      ...snapshot.ws23?.verticals?.[row.name],
    }))
  }

  if (next.ws24?.benchmarks && snapshot.ws24?.benchmarks) {
    next.ws24.benchmarks = next.ws24.benchmarks.map((row: BenchmarkRow) => ({
      ...row,
      ...snapshot.ws24?.benchmarks?.[row.category],
      flag: (snapshot.ws24?.benchmarks?.[row.category]?.flag as BenchmarkRow['flag'] | undefined) ?? row.flag,
    }))
    next.ws24.overallHealth = (snapshot.ws24.overallHealth as typeof next.ws24.overallHealth | undefined) ?? next.ws24.overallHealth
  }

  if (next.ws25?.laborRows && snapshot.ws25) {
    next.ws25.laborRows = next.ws25.laborRows.map((row: LaborRow) => ({
      ...row,
      ...snapshot.ws25?.laborRows?.[row.category],
    }))
    next.ws25.directLaborPct = snapshot.ws25.directLaborPct ?? next.ws25.directLaborPct
    next.ws25.buyerAdjustedLaborPct = snapshot.ws25.buyerAdjustedLaborPct ?? next.ws25.buyerAdjustedLaborPct
    next.ws25.benchmarkStatus = (snapshot.ws25.benchmarkStatus as typeof next.ws25.benchmarkStatus | undefined) ?? next.ws25.benchmarkStatus
    next.ws25.benchmarkNote = snapshot.ws25.benchmarkNote ?? next.ws25.benchmarkNote
    next.ws25.trendNote = snapshot.ws25.trendNote ?? next.ws25.trendNote
  }

  if (snapshot.workingCapital) {
    next.ws21.workingCapital = {
      ...next.ws21.workingCapital,
      ...snapshot.workingCapital,
    }
  }

  return next
}

export function diffWorkbookOverrideSnapshots(current: WorkbookOverrideSnapshot, next: WorkbookOverrideSnapshot) {
  const changes: WorkbookChange[] = []
  const pushNumber = (section: string, label: string, field: string, before: number | null | undefined, after: number | null | undefined) => {
    if (!numbersDiffer(before, after)) return
    changes.push({
      section,
      label,
      field,
      before: formatChangeValue(before),
      after: formatChangeValue(after),
    })
  }
  const pushText = (section: string, label: string, field: string, before: string | null | undefined, after: string | null | undefined) => {
    if (!after || before === after) return
    changes.push({
      section,
      label,
      field,
      before: formatChangeValue(before),
      after: formatChangeValue(after),
    })
  }

  const compareSeries = (section: string, currentMap: Record<string, SeriesValues> | undefined, nextMap: Record<string, SeriesValues> | undefined) => {
    for (const [label, values] of Object.entries(nextMap ?? {})) {
      const previous = currentMap?.[label] ?? {}
      pushNumber(section, label, 'FY 2022', previous.fy1, values.fy1)
      pushNumber(section, label, 'FY 2023', previous.fy2, values.fy2)
      pushNumber(section, label, 'FY 2024', previous.fy3, values.fy3)
      pushNumber(section, label, 'TTM', previous.ttm, values.ttm)
    }
  }

  compareSeries('3-Year P&L', current.annualPL?.revenueLines, next.annualPL?.revenueLines)
  compareSeries('3-Year P&L', current.annualPL?.cogsLines, next.annualPL?.cogsLines)
  compareSeries('3-Year P&L', current.annualPL?.expenseLines, next.annualPL?.expenseLines)

  const currentTotals = { ...(current.annualPL?.totals ?? {}) }
  const nextTotals = { ...(next.annualPL?.totals ?? {}) }
  delete currentTotals['Gross Margin']
  delete currentTotals['EBITDA Margin']
  delete nextTotals['Gross Margin']
  delete nextTotals['EBITDA Margin']
  compareSeries('3-Year P&L Totals', currentTotals, nextTotals)

  for (const [id, item] of Object.entries(next.recast?.items ?? {})) {
    const previous = current.recast?.items?.[id] ?? {}
    pushNumber('EBITDA Recast', id, 'FY 2022', previous.fy1, item.fy1)
    pushNumber('EBITDA Recast', id, 'FY 2023', previous.fy2, item.fy2)
    pushNumber('EBITDA Recast', id, 'FY 2024', previous.fy3, item.fy3)
    pushNumber('EBITDA Recast', id, 'TTM', previous.ttm, item.ttm)
    pushText('EBITDA Recast', id, 'Status', previous.status, item.status)
  }

  pushNumber('EBITDA Recast', 'Schedule', 'Total Add-Backs', current.recast?.totalAddBacks, next.recast?.totalAddBacks)
  pushNumber('EBITDA Recast', 'Schedule', 'Normalized EBITDA', current.recast?.normalizedEbitdaTTM, next.recast?.normalizedEbitdaTTM)
  pushNumber('Valuation', 'Multiples', 'Low', current.recast?.valuation?.multipleLow, next.recast?.valuation?.multipleLow)
  pushNumber('Valuation', 'Multiples', 'Mid', current.recast?.valuation?.multipleMid, next.recast?.valuation?.multipleMid)
  pushNumber('Valuation', 'Multiples', 'High', current.recast?.valuation?.multipleHigh, next.recast?.valuation?.multipleHigh)
  pushNumber('Valuation', 'Range', 'Low', current.recast?.valuation?.valuationLow, next.recast?.valuation?.valuationLow)
  pushNumber('Valuation', 'Range', 'Mid', current.recast?.valuation?.valuationMid, next.recast?.valuation?.valuationMid)
  pushNumber('Valuation', 'Range', 'High', current.recast?.valuation?.valuationHigh, next.recast?.valuation?.valuationHigh)
  pushNumber('Valuation', 'Inputs', 'Replacement Salary', current.recast?.valuation?.replacementSalary, next.recast?.valuation?.replacementSalary)

  for (const [label, values] of Object.entries(next.ws23?.verticals ?? {})) {
    const previous = current.ws23?.verticals?.[label] ?? {}
    pushNumber('Revenue by Vertical', label, 'FY 2022 $', previous.fy1Dollar, values.fy1Dollar)
    pushNumber('Revenue by Vertical', label, 'FY 2023 $', previous.fy2Dollar, values.fy2Dollar)
    pushNumber('Revenue by Vertical', label, 'FY 2024 $', previous.fy3Dollar, values.fy3Dollar)
    pushNumber('Revenue by Vertical', label, 'TTM $', previous.ttmDollar, values.ttmDollar)
  }

  for (const [label, values] of Object.entries(next.ws24?.benchmarks ?? {})) {
    const previous = current.ws24?.benchmarks?.[label] ?? {}
    pushNumber('Expense Benchmarks', label, 'FY 2022 $', previous.fy1Dollar, values.fy1Dollar)
    pushNumber('Expense Benchmarks', label, 'FY 2023 $', previous.fy2Dollar, values.fy2Dollar)
    pushNumber('Expense Benchmarks', label, 'FY 2024 $', previous.fy3Dollar, values.fy3Dollar)
    pushNumber('Expense Benchmarks', label, 'TTM $', previous.ttmDollar, values.ttmDollar)
    pushText('Expense Benchmarks', label, 'Flag', previous.flag, values.flag)
  }

  for (const [label, values] of Object.entries(next.ws25?.laborRows ?? {})) {
    const previous = current.ws25?.laborRows?.[label] ?? {}
    pushNumber('Labor Analysis', label, 'TTM amount', previous.ttmAmount, values.ttmAmount)
    pushNumber('Labor Analysis', label, 'TTM %', previous.ttmPct, values.ttmPct)
  }

  pushNumber('Labor Analysis', 'Summary', 'Direct labor %', current.ws25?.directLaborPct, next.ws25?.directLaborPct)
  pushNumber('Labor Analysis', 'Summary', 'Buyer-adjusted labor %', current.ws25?.buyerAdjustedLaborPct, next.ws25?.buyerAdjustedLaborPct)

  for (const [field, value] of Object.entries(next.workingCapital ?? {})) {
    if (typeof value !== 'number') continue
    pushNumber('Working Capital', 'Current balance sheet', field, (current.workingCapital as Record<string, unknown> | undefined)?.[field] as number | undefined, value)
  }

  return changes
}
