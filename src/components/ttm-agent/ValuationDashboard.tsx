'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download } from 'lucide-react'
import { buildWS2ReportAdapter } from '@/lib/ttm-agent/export-adapter'
import type { AnnualModelYear, TtmAnalysisView, TtmFlagView, Ws2DerivedReportView, Ws2RecastView } from '@/lib/ttm-agent/types'
import type { WorkbookChange } from '@/lib/ttm-agent/workbook-overrides'
import type { AddBackItem, BenchmarkRow, LaborRow, TrafficLight, VerticalRow } from '@/lib/ws2/ws2-types'
import { PremiumMarkdown } from '@/components/ttm-agent/PremiumMarkdown'
import { Badge, Button, Card, Modal, cn } from '@/components/ui'

const ADD_BACK_CATEGORY_LABELS: Record<number, string> = {
  1: 'Category 1  -  Owner / Officer Compensation',
  2: 'Category 2  -  Personal Expenses',
  3: 'Category 3  -  One-Off Non-Recurring',
  4: 'Category 4  -  Tenant Improvements',
  5: 'Category 5  -  Fair Market Rent',
}

const SEVERITY_ORDER: Record<string, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
  INFO: 3,
}

type RevenueSummaryRow = {
  label: string
  fy1: number
  fy2: number
  fy3: number
  ttm: number
}

type PnlSummaryRow = {
  label: string
  fy1: number | null
  fy2: number | null
  fy3: number | null
  ttm: number | null
  kind?: 'section' | 'total' | 'currency' | 'percent'
}

type FlagGroup = {
  title: string
  section: string
  severity: string
  count: number
  description: string
  resolvedBy: string | null
}

function normalizePercent(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.abs(value) <= 1 ? value * 100 : value
}

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'n/a'
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function formatCurrencyCompact(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'n/a'
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return formatCurrency(value)
}

function formatPct(value: number | null | undefined, digits = 1) {
  const normalized = normalizePercent(value)
  return normalized === null ? 'n/a' : `${normalized.toFixed(digits)}%`
}

function formatSignedPct(value: number | null | undefined, digits = 1) {
  const normalized = normalizePercent(value)
  if (normalized === null) return '—'
  const sign = normalized > 0 ? '+' : ''
  return `${sign}${normalized.toFixed(digits)}%`
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Pending'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed)
}

function sanitizeReviewerCopy(value: string | null | undefined) {
  if (!value) return ''
  return value
    .replace(/\bCRAIG\b/g, 'ADMIN')
    .replace(/\bCraig\b/g, 'Admin')
    .replace(/\bcraig\b/g, 'admin')
}

function formatStatusLabel(status: string) {
  const upper = status.toUpperCase()
  if (upper.includes('CRAIG-CONFIRMED')) return 'Confirmed'
  if (upper.includes('CRAIG-OVERRIDE')) return 'Override Applied'
  if (upper === 'DEFAULT') return 'Default Assumption'
  if (upper === 'CALCULATED') return 'Calculated'
  if (upper === 'VERIFIED') return 'Verified'
  if (upper.includes('FLAGGED-SUSPICIOUS')) return 'Flagged for Review'
  if (upper.includes('FLAGGED-MAJOR')) return 'Major Flag'
  if (upper.includes('FLAGGED')) return 'Flagged'
  return sanitizeReviewerCopy(status)
}

function safeDiv(numerator: number | null | undefined, denominator: number | null | undefined) {
  return typeof numerator === 'number' && Number.isFinite(numerator) && typeof denominator === 'number' && Number.isFinite(denominator) && denominator !== 0
    ? numerator / denominator
    : null
}

function getTrafficTone(light: TrafficLight) {
  if (light === 'RED') return 'text-rose-700'
  if (light === 'YELLOW') return 'text-amber-700'
  return 'text-emerald-700'
}

function getTrafficBadge(light: TrafficLight) {
  if (light === 'RED') return 'border-rose-200 bg-rose-50 text-rose-700'
  if (light === 'YELLOW') return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

function getTrafficLabel(light: TrafficLight) {
  if (light === 'RED') return 'Needs Review'
  if (light === 'YELLOW') return 'Watch'
  return 'Within Range'
}

function getSeverityBadge(severity: string) {
  if (severity === 'HIGH') return 'border-rose-200 bg-rose-700 text-white'
  if (severity === 'MEDIUM') return 'border-amber-200 bg-amber-600 text-white'
  return 'border-slate-200 bg-slate-100 text-slate-700'
}

function getSeverityCardTone(severity: string) {
  if (severity === 'HIGH') return 'border-rose-200 bg-[#fef2f2]'
  if (severity === 'MEDIUM') return 'border-amber-200 bg-[#fffbeb]'
  if (severity === 'LOW') return 'border-slate-200 bg-slate-50'
  return 'border-slate-200 bg-slate-50'
}

function getSeverityTitleTone(severity: string) {
  if (severity === 'HIGH') return 'text-[#8a2f2c]'
  if (severity === 'MEDIUM') return 'text-[#a6542f]'
  if (severity === 'LOW') return 'text-slate-800'
  return 'text-slate-700'
}

function getSeverityPillTone(severity: string) {
  if (severity === 'HIGH') return 'bg-[#8a2f2c] text-white'
  if (severity === 'MEDIUM') return 'bg-[#a6542f] text-white'
  return 'bg-slate-600 text-white'
}

function getStatusTone(status: string) {
  const upper = status.toUpperCase()
  if (upper.includes('VERIFIED') || upper.includes('CALCULATED')) return 'text-emerald-700'
  if (upper.includes('DEFAULT') || upper.includes('OVERRIDE') || upper.includes('CONFIRMED')) return 'text-amber-700'
  if (upper.includes('FLAGGED')) return 'text-rose-700'
  return 'text-slate-600'
}

function sumVerticals(rows: VerticalRow[], names: string[]) {
  return rows
    .filter((row) => names.includes(row.name))
    .reduce(
      (acc, row) => ({
        label: acc.label,
        fy1: acc.fy1 + row.fy1Dollar,
        fy2: acc.fy2 + row.fy2Dollar,
        fy3: acc.fy3 + row.fy3Dollar,
        ttm: acc.ttm + row.ttmDollar,
      }),
      { label: 'Retail + Other', fy1: 0, fy2: 0, fy3: 0, ttm: 0 },
    )
}

function buildRevenueSummaryRows(verticals: VerticalRow[]) {
  const byName = new Map(verticals.map((row) => [row.name, row]))
  const rows: RevenueSummaryRow[] = []

  for (const name of ['Boarding', 'Daycare', 'Grooming']) {
    const row = byName.get(name)
    if (!row) continue
    rows.push({
      label: row.name,
      fy1: row.fy1Dollar,
      fy2: row.fy2Dollar,
      fy3: row.fy3Dollar,
      ttm: row.ttmDollar,
    })
  }

  const combinedOther = sumVerticals(verticals, ['Retail', 'Training', 'Membership', 'Other'])
  if (combinedOther.fy1 || combinedOther.fy2 || combinedOther.fy3 || combinedOther.ttm) {
    rows.push(combinedOther)
  }

  return rows
}

function buildProfitabilityRows(report: ReturnType<typeof buildWS2ReportAdapter>): PnlSummaryRow[] {
  const annualPL = report.ws21.annualPL

  return [
    { label: 'Profitability', fy1: null, fy2: null, fy3: null, ttm: null, kind: 'section' },
    { label: 'Gross Profit', fy1: annualPL.grossProfit.fy1 ?? null, fy2: annualPL.grossProfit.fy2 ?? null, fy3: annualPL.grossProfit.fy3 ?? null, ttm: annualPL.grossProfit.ttm ?? null, kind: 'currency' },
    { label: 'Gross Margin', fy1: annualPL.grossMargin.fy1 ?? null, fy2: annualPL.grossMargin.fy2 ?? null, fy3: annualPL.grossMargin.fy3 ?? null, ttm: annualPL.grossMargin.ttm ?? null, kind: 'percent' },
    { label: 'Total OpEx', fy1: annualPL.totalOpex.fy1 ?? null, fy2: annualPL.totalOpex.fy2 ?? null, fy3: annualPL.totalOpex.fy3 ?? null, ttm: annualPL.totalOpex.ttm ?? null, kind: 'currency' },
    { label: '4-Wall EBITDA (Pre-Normalized)', fy1: annualPL.ebitdaPreRecast.fy1 ?? null, fy2: annualPL.ebitdaPreRecast.fy2 ?? null, fy3: annualPL.ebitdaPreRecast.fy3 ?? null, ttm: annualPL.ebitdaPreRecast.ttm ?? null, kind: 'currency' },
    { label: 'EBITDA Margin', fy1: annualPL.ebitdaMargin.fy1 ?? null, fy2: annualPL.ebitdaMargin.fy2 ?? null, fy3: annualPL.ebitdaMargin.fy3 ?? null, ttm: annualPL.ebitdaMargin.ttm ?? null, kind: 'percent' },
  ]
}

function groupAddBackItems(items: AddBackItem[]) {
  return items.reduce<Record<number, AddBackItem[]>>((acc, item) => {
    const key = item.category
    acc[key] = [...(acc[key] ?? []), item]
    return acc
  }, {})
}

function groupFlags(flags: TtmFlagView[]): FlagGroup[] {
  const groups = new Map<string, FlagGroup>()

  for (const flag of flags) {
    const key = `${flag.section}::${flag.title}`
    const current = groups.get(key)
    if (current) {
      current.count += 1
      if (!current.description && flag.description) current.description = flag.description
      if (!current.resolvedBy && flag.resolvedByName) current.resolvedBy = flag.resolvedByName
      continue
    }

    groups.set(key, {
      title: flag.title,
      section: flag.section,
      severity: flag.severity,
      count: 1,
      description: flag.resolutionNotes || flag.description || '',
      resolvedBy: flag.resolvedByName,
    })
  }

  return Array.from(groups.values()).sort((a, b) => {
    const severityCompare = (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99)
    if (severityCompare !== 0) return severityCompare
    if (b.count !== a.count) return b.count - a.count
    return a.title.localeCompare(b.title)
  })
}

function TableCell({
  value,
  kind = 'currency',
  emphasize = false,
  negativeAccent = false,
}: {
  value: number | null
  kind?: 'currency' | 'percent'
  emphasize?: boolean
  negativeAccent?: boolean
}) {
  const formatted = kind === 'percent' ? formatPct(value) : formatCurrency(value)
  const isNegative = typeof value === 'number' && value < 0

  return (
    <td
      className={cn(
        'px-4 py-3 text-right tabular-nums',
        emphasize ? 'font-semibold text-slate-900' : 'text-slate-700',
        isNegative && negativeAccent ? 'text-rose-700' : '',
        !isNegative && negativeAccent && typeof value === 'number' && value > 0 ? 'text-emerald-700' : '',
      )}
    >
      {formatted}
    </td>
  )
}

function YoYCell({
  current,
  previous,
  kind = 'currency',
}: {
  current: number | null
  previous: number | null
  kind?: 'currency' | 'percent'
}) {
  if (kind === 'percent') {
    return <td className="px-4 py-3 text-right text-slate-400">—</td>
  }

  if (typeof current !== 'number' || typeof previous !== 'number' || !Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    return <td className="px-4 py-3 text-right text-slate-400">—</td>
  }

  const change = ((current - previous) / Math.abs(previous)) * 100
  const tone = change > 0 ? 'text-emerald-700' : change < 0 ? 'text-rose-700' : 'text-slate-500'

  return (
    <td className={cn('px-4 py-3 text-right tabular-nums', tone)}>
      {change > 0 ? '+' : ''}
      {change.toFixed(1)}%
    </td>
  )
}

function ReportCard({
  id,
  title,
  badge,
  headerRight,
  children,
}: {
  id: string
  title: string
  badge?: React.ReactNode
  headerRight?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <Card className="border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <h3 className="text-[13px] font-bold uppercase tracking-[0.2em] text-slate-700">{title}</h3>
          <div className="flex items-center gap-2">
            {headerRight}
            {badge}
          </div>
        </div>
        <div className="pt-5">{children}</div>
      </Card>
    </section>
  )
}

export function ValuationDashboard({
  analysis,
  recast,
  clientName,
  report,
  onExportXlsx,
  recentWorkbookChanges = [],
}: {
  analysis: TtmAnalysisView
  recast: Ws2RecastView
  clientName: string
  report: Ws2DerivedReportView | null
  onExportXlsx?: () => void
  recentWorkbookChanges?: WorkbookChange[]
}) {
  const [expandedReportId, setExpandedReportId] = useState<'ws23' | 'ws24' | 'ws25' | null>(null)
  const ws2Report = buildWS2ReportAdapter(clientName, analysis, recast, analysis.derivedReports ?? [])
  const years = analysis.annualModel?.years ?? []
  const yearLabels = {
    fy1: years[0]?.fiscalYear ?? 'FY1',
    fy2: years[1]?.fiscalYear ?? 'FY2',
    fy3: years[2]?.fiscalYear ?? 'FY3',
  }
  const laborYearLabels = {
    ttm: analysis.ttmSummary?.endMonth ? `Latest 12 Months (through ${analysis.ttmSummary.endMonth})` : 'Latest 12 Months',
    fy3: years[2]?.fiscalYear ? `${years[2].fiscalYear} Actual` : 'Most Recent Full Year',
    fy2: years[1]?.fiscalYear ? `${years[1].fiscalYear} Actual` : 'Previous Year',
    fy1: years[0]?.fiscalYear ? `${years[0].fiscalYear} Actual` : 'Earlier Year',
  }

  const ws23 = ws2Report.ws23
  const ws24 = ws2Report.ws24
  const ws25 = ws2Report.ws25
  const fullReports = useMemo(
    () => ({
      ws23: analysis.derivedReports?.find((item) => item.agentId === 'ws2_3_rev_vertical_v1') ?? null,
      ws24: analysis.derivedReports?.find((item) => item.agentId === 'ws2_4_benchmark_v1') ?? null,
      ws25: analysis.derivedReports?.find((item) => item.agentId === 'ws2_5_labor_v1') ?? null,
    }),
    [analysis.derivedReports],
  )
  const expandedReport = expandedReportId ? fullReports[expandedReportId] : null
  const expandedReportTitle =
    expandedReportId === 'ws23'
      ? 'WS2-3 Revenue by Vertical'
      : expandedReportId === 'ws24'
        ? 'WS2-4 Expense Benchmarks'
        : expandedReportId === 'ws25'
          ? 'WS2-5 Labor Analysis'
          : ''
  const addBackItems = ws2Report.ws22?.recastSchedule.addBackItems ?? []
  const addBackGroups = groupAddBackItems(addBackItems)
  const hasMultiYearAddBacks = addBackItems.some((item) => item.fy1Amount != null || item.fy2Amount != null || item.fy3Amount != null)
  const valByYear = ws2Report.ws22?.valuation.byYear ?? []
  const revenueRows = buildRevenueSummaryRows(ws23?.verticals ?? [])
  const profitabilityRows = buildProfitabilityRows(ws2Report)
  const dataQualityGroups = groupFlags(analysis.flags)

  const ttmRevenue = ws2Report.ws21.annualPL.totalRevenue.ttm ?? null
  const grossMargin = ws2Report.ws21.annualPL.grossMargin.ttm ?? null
  const preRecastEbitda = ws2Report.ws21.annualPL.ebitdaPreRecast.ttm ?? null
  const normalizedEbitda = recast.normalizedEbitda ?? null
  const normalizedMargin = safeDiv(normalizedEbitda, ttmRevenue)
  const totalAddBacks = addBackItems.reduce((sum, item) => sum + item.ttmAmount, 0)

  const latestTrend = analysis.annualModel?.trends?.[analysis.annualModel.trends.length - 1] ?? null
  const approvedLabel = (recast.approvedByName ?? 'Admin').toUpperCase()
  const resolvedCount = analysis.flags.filter((flag) => flag.resolutionStatus === 'ACTIONED').length
  const allWs21Cleared = analysis.flags.every((flag) => flag.resolutionStatus === 'ACTIONED')
  const benchmarkFlagCount = (ws24?.benchmarks ?? []).filter((item) => item.flag !== 'GREEN').length
  const topBenchmarks = (ws24?.benchmarks ?? []).slice(0, 6)
  const topLaborRows = (ws25?.laborRows ?? []).slice(0, 6)
  const allInLaborRow = ws25?.laborRows.find((row) => row.category === 'Total All-In Labor') ?? null
  const buyerAdjustedLaborRow = ws25?.laborRows.find((row) => row.category === 'Buyer-Adjusted Labor') ?? null
  const laborTrendSummary = allInLaborRow
    ? `${formatPct(allInLaborRow.fy1Pct)} → ${formatPct(allInLaborRow.fy2Pct)} → ${formatPct(allInLaborRow.fy3Pct)}`
    : null
  const recentChangeLabels = new Set(recentWorkbookChanges.map((change) => change.label))
  const recentChangeSummary = recentWorkbookChanges.length
    ? recentWorkbookChanges.map((change) => `${change.label} ${change.field}: ${change.after}`).join(' · ')
    : null
  const revenueTouched = recentWorkbookChanges.some((change) => change.label === 'Total Revenue')
  const grossMarginTouched = recentWorkbookChanges.some((change) => change.label === 'Gross Margin')
  const ebitdaTouched = recentWorkbookChanges.some((change) => change.label === '4-Wall EBITDA (Pre-Normalized)' || change.label === 'EBITDA Margin')

  return (
    <div className="space-y-6">
      {recentWorkbookChanges.length > 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
          <p className="font-semibold">Workbook changes applied to the web report.</p>
          <p className="mt-1 text-emerald-800">{recentChangeSummary}</p>
        </div>
      )}
      <section id="ws210-report-detail" className="scroll-mt-24">
        <div className="overflow-hidden rounded-[28px] border border-slate-700 bg-[#1a2332] text-white">
          <div className="flex flex-wrap items-start justify-between gap-6 px-6 py-6 md:px-8">
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-300">Cantara Pet Advisors · WS2 Financial Analysis</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight">{clientName}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">Business Sale Readiness — Financial Performance & Valuation Report</p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                {approvedLabel} Approved · {formatDate(recast.approvedAt)}
              </div>
            </div>

            <div className="text-sm text-slate-200">
              <div className="grid gap-2">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-400">Period</span>
                  <span className="font-medium">Jan 2022 — Dec 2024</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-400">TTM</span>
                  <span className="font-medium">{analysis.ttmSummary?.startMonth ?? 'n/a'} — {analysis.ttmSummary?.endMonth ?? 'n/a'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-400">Run</span>
                  <span className="font-medium">#{analysis.version} · {formatDate(report?.updatedAt ?? analysis.updatedAt)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-400">Status</span>
                  <span className="font-medium">Internal Only</span>
                </div>
              </div>
              {onExportXlsx && (
                <div className="mt-4 flex justify-end">
                  <Button size="sm" variant="outline" className="border-white/10 bg-white text-slate-900 hover:bg-slate-100" onClick={onExportXlsx}>
                    <Download className="h-3.5 w-3.5" />
                    Export XLSX
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="grid divide-y divide-slate-700 bg-white text-slate-900 md:grid-cols-4 md:divide-x md:divide-y-0">
            <div className={cn('p-5', revenueTouched && 'bg-emerald-50 ring-1 ring-inset ring-emerald-300')}>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">TTM Revenue</p>
              <p className="mt-2 text-2xl font-semibold">{formatCurrencyCompact(ttmRevenue)}</p>
              <p className="mt-1 text-sm text-slate-500">{latestTrend?.revenueYoYPct != null ? `${formatSignedPct(latestTrend.revenueYoYPct)} YoY` : 'Trend unavailable'}</p>
            </div>
            <div className={cn('p-5', grossMarginTouched && 'bg-emerald-50 ring-1 ring-inset ring-emerald-300')}>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Gross Margin</p>
              <p className="mt-2 text-2xl font-semibold">{formatPct(grossMargin)}</p>
              <p className="mt-1 text-sm text-slate-500">Stable 3-year</p>
            </div>
            <div className={cn('p-5', ebitdaTouched && 'bg-emerald-50 ring-1 ring-inset ring-emerald-300')}>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">4-Wall EBITDA (Pre-Normalized)</p>
              <p className="mt-2 text-2xl font-semibold">{formatCurrency(preRecastEbitda)}</p>
              <p className="mt-1 text-sm text-slate-500">{formatPct(ws2Report.ws21.annualPL.ebitdaMargin.ttm ?? null)} margin</p>
            </div>
            <div className="p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">WS2-1 Clearance</p>
              <p className="mt-2 text-2xl font-semibold">{resolvedCount}/{analysis.flags.length}</p>
              <p className="mt-1 text-sm text-slate-500">
                {allWs21Cleared ? 'All data-quality items cleared' : 'Pending review items'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6">
        <ReportCard
          id="ws210-pl-summary"
          title="3-Year Annual P&L Summary (Pre-Normalized)"
          badge={<span className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">WS2-1 Approved</span>}
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-4 py-3">Line Item</th>
                  <th className="px-4 py-3 text-right">FY {yearLabels.fy1}</th>
                  <th className="px-4 py-3 text-right">YoY</th>
                  <th className="px-4 py-3 text-right">FY {yearLabels.fy2}</th>
                  <th className="px-4 py-3 text-right">YoY</th>
                  <th className="px-4 py-3 text-right">FY {yearLabels.fy3} / TTM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="bg-slate-50/70">
                  <td colSpan={6} className="px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Revenue</td>
                </tr>
                {revenueRows.map((row) => (
                  <tr key={row.label}>
                    <td className="px-4 py-3 text-slate-800">{row.label}</td>
                    <TableCell value={row.fy1} />
                    <YoYCell previous={row.fy1} current={row.fy2} />
                    <TableCell value={row.fy2} />
                    <YoYCell previous={row.fy2} current={row.fy3} />
                    <TableCell value={row.ttm} emphasize />
                  </tr>
                ))}
                <tr className={cn('bg-[#1a2332] text-white', revenueTouched && 'ring-2 ring-inset ring-emerald-300')}>
                  <td className="px-4 py-3 font-semibold">Total Revenue</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(ws2Report.ws21.annualPL.totalRevenue.fy1 ?? null)}</td>
                  <YoYCell previous={ws2Report.ws21.annualPL.totalRevenue.fy1 ?? null} current={ws2Report.ws21.annualPL.totalRevenue.fy2 ?? null} />
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(ws2Report.ws21.annualPL.totalRevenue.fy2 ?? null)}</td>
                  <YoYCell previous={ws2Report.ws21.annualPL.totalRevenue.fy2 ?? null} current={ws2Report.ws21.annualPL.totalRevenue.fy3 ?? null} />
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(ttmRevenue)}</td>
                </tr>
                {profitabilityRows.map((row) =>
                  row.kind === 'section' ? (
                    <tr key={row.label} className="bg-slate-50/70">
                      <td colSpan={6} className="px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{row.label}</td>
                    </tr>
                  ) : (
                    <tr key={row.label} className={cn(recentChangeLabels.has(row.label) && 'bg-emerald-50')}>
                      <td className="px-4 py-3 text-slate-800">{row.label}</td>
                      <TableCell value={row.fy1} kind={row.kind === 'percent' ? 'percent' : 'currency'} negativeAccent={row.label.includes('EBITDA')} />
                      <YoYCell previous={row.fy1} current={row.fy2} kind={row.kind === 'percent' ? 'percent' : 'currency'} />
                      <TableCell value={row.fy2} kind={row.kind === 'percent' ? 'percent' : 'currency'} negativeAccent={row.label.includes('EBITDA')} />
                      <YoYCell previous={row.fy2} current={row.fy3} kind={row.kind === 'percent' ? 'percent' : 'currency'} />
                      <TableCell value={row.ttm} kind={row.kind === 'percent' ? 'percent' : 'currency'} emphasize negativeAccent={row.label.includes('EBITDA')} />
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </ReportCard>
      </div>

      <ReportCard
        id="ws210-ebitda"
        title="WS2-2 EBITDA Normalization & LTM Valuation"
        badge={<span className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">WS2-2 Admin Approved</span>}
      >
        <div className="rounded-2xl border border-slate-200 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <h4 className="text-[13px] font-bold uppercase tracking-[0.2em] text-slate-700">LTM Valuation — Preliminary Range</h4>
            <span className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Internal Only</span>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-5 text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Low · {recast.assumptions.multipleLow?.toFixed(1) ?? 'n/a'}x</p>
              <p className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 tabular-nums">{formatCurrency(recast.valuationLow)}</p>
              <p className="mt-2 text-sm text-slate-500">Conservative</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-800 px-6 py-5 text-center text-white">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">Mid · {recast.assumptions.multipleMid?.toFixed(1) ?? 'n/a'}x</p>
              <p className="mt-4 text-4xl font-semibold tracking-tight text-amber-300 tabular-nums">{formatCurrency(recast.valuationMid)}</p>
              <p className="mt-2 text-sm text-slate-300">Most Likely</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-5 text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">High · {recast.assumptions.multipleHigh?.toFixed(1) ?? 'n/a'}x</p>
              <p className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 tabular-nums">{formatCurrency(recast.valuationHigh)}</p>
              <p className="mt-2 text-sm text-slate-500">Optimistic</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">
            Based on LTM Normalized EBITDA of <span className="font-semibold text-slate-900">{formatCurrency(normalizedEbitda)}</span>. Revenue changing {latestTrend?.revenueYoYPct != null ? formatSignedPct(latestTrend.revenueYoYPct) : 'n/a'} YoY. Pre-normalized EBITDA was {formatCurrency(preRecastEbitda)} ({formatPct(ws2Report.ws21.annualPL.ebitdaMargin.ttm ?? null)}); total add-backs of {formatCurrency(totalAddBacks)}.
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl bg-[#1a2332] px-6 py-4 text-white">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-2xl font-semibold tracking-tight">Normalized EBITDA (LTM)</h3>
            <div className="flex items-center gap-4 text-right">
              <span className="text-3xl font-semibold">{formatCurrency(normalizedEbitda)}</span>
              <span className="text-lg text-slate-300">{formatPct(normalizedMargin)} Margin</span>
            </div>
          </div>
          {valByYear.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-4 border-t border-white/20 pt-3">
              {[...valByYear].reverse().map((vy) => (
                <div key={vy.fiscalYear} className="text-center">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">FY {vy.fiscalYear}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{formatCurrency(vy.normalizedEbitda)}</p>
                  <p className="mt-0.5 text-xs text-slate-400">Val: {formatCurrency(vy.valuationMid)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                <th className="px-4 py-3">Cat.</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">GL Account</th>
                <th className="px-4 py-3 text-right">LTM</th>
                {hasMultiYearAddBacks && valByYear.slice().reverse().map((vy) => (
                  <th key={vy.fiscalYear} className="px-4 py-3 text-right">FY {vy.fiscalYear}</th>
                ))}
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-4 py-4 font-semibold text-slate-900" colSpan={3}>EBITDA (Pre-Normalized)</td>
                <td className="px-4 py-4 text-right font-semibold text-slate-900">{formatCurrency(preRecastEbitda)}</td>
                {hasMultiYearAddBacks && (
                  <>
                    <td className="px-4 py-4 text-right font-semibold text-slate-900">{formatCurrency(ws2Report.ws21.annualPL.ebitdaPreRecast.fy3)}</td>
                    <td className="px-4 py-4 text-right font-semibold text-slate-900">{formatCurrency(ws2Report.ws21.annualPL.ebitdaPreRecast.fy2)}</td>
                    <td className="px-4 py-4 text-right font-semibold text-slate-900">{formatCurrency(ws2Report.ws21.annualPL.ebitdaPreRecast.fy1)}</td>
                  </>
                )}
                <td className="px-4 py-4" />
              </tr>
            </tbody>
            {Object.entries(addBackGroups)
              .sort((a, b) => Number(a[0]) - Number(b[0]))
              .map(([category, items]) => (
                <tbody key={category} className="divide-y divide-slate-100">
                  <tr className="bg-slate-50/70">
                    <td colSpan={hasMultiYearAddBacks ? 8 : 5} className="px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      {ADD_BACK_CATEGORY_LABELS[Number(category)]}
                    </td>
                  </tr>
                  {items.map((item: AddBackItem) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-slate-500">{item.id}</td>
                      <td className="px-4 py-3 text-slate-800">{item.description}</td>
                      <td className="px-4 py-3 text-slate-500">{item.glAccount ?? item.glCode ?? '—'}</td>
                      <td className={cn('px-4 py-3 text-right tabular-nums font-medium', item.ttmAmount < 0 ? 'text-rose-700' : 'text-slate-900')}>
                        {formatCurrency(item.ttmAmount)}
                      </td>
                      {hasMultiYearAddBacks && (
                        <>
                          <td className={cn('px-4 py-3 text-right tabular-nums font-medium', (item.fy3Amount ?? 0) < 0 ? 'text-rose-700' : 'text-slate-900')}>
                            {formatCurrency(item.fy3Amount ?? 0)}
                          </td>
                          <td className={cn('px-4 py-3 text-right tabular-nums font-medium', (item.fy2Amount ?? 0) < 0 ? 'text-rose-700' : 'text-slate-900')}>
                            {formatCurrency(item.fy2Amount ?? 0)}
                          </td>
                          <td className={cn('px-4 py-3 text-right tabular-nums font-medium', (item.fy1Amount ?? 0) < 0 ? 'text-rose-700' : 'text-slate-900')}>
                            {formatCurrency(item.fy1Amount ?? 0)}
                          </td>
                        </>
                      )}
                      <td className={cn('px-4 py-3 text-right text-xs font-bold uppercase tracking-[0.18em]', getStatusTone(item.status))}>
                        {formatStatusLabel(item.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              ))}
          </table>
        </div>
      </ReportCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <ReportCard
          id="ws210-revenue"
          title="Revenue by Vertical · TTM"
          badge={
            ws23 ? (
              <div className="flex items-center gap-3">
                {fullReports.ws23?.reportMarkdown && (
                  <Button size="sm" variant="outline" onClick={() => setExpandedReportId('ws23')}>
                    Show More
                  </Button>
                )}
              <span className="text-sm font-semibold text-amber-700">
                B+D: {formatPct(ws23.boardingPlusDaycareConcentration.ttm)} <AlertTriangle className="ml-1 inline h-4 w-4 -translate-y-0.5" />
              </span>
              </div>
            ) : undefined
          }
        >
          {ws23 ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {ws23.verticals.slice(0, 4).map((vertical: VerticalRow) => {
                  // If concentration >70%, health should be at least YELLOW
                  const effectiveHealth: TrafficLight = vertical.ttmPct > 0.70 && vertical.health === 'GREEN' ? 'YELLOW' : vertical.health
                  return (
                  <div key={vertical.name} className="border-b border-slate-200 pb-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{vertical.name}</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900">{formatPct(vertical.ttmPct)}</p>
                    <p className="mt-1 text-sm text-slate-700">{formatCurrency(vertical.ttmDollar)}</p>
                    <p className={cn('mt-1 text-sm', getTrafficTone(effectiveHealth))}>
                      FY2→FY3: {formatSignedPct(vertical.yoyFy2toFy3)}
                    </p>
                  </div>
                  )
                })}
              </div>
              {(ws23.concentrationFlags[0] || ws23.businessModelFlag) && (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900">
                  <AlertTriangle className="mr-2 inline h-4 w-4 -translate-y-0.5 text-amber-600" />
                  {ws23.concentrationFlags[0] ?? ws23.businessModelFlag}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500">WS2-3 has not been generated yet.</p>
          )}
        </ReportCard>

        <ReportCard
          id="ws210-benchmarks"
          title="Expense Benchmarks · TTM"
          badge={
            <div className="flex items-center gap-3">
              {fullReports.ws24?.reportMarkdown && (
                <Button size="sm" variant="outline" onClick={() => setExpandedReportId('ws24')}>
                  Show More
                </Button>
              )}
              <span className="rounded border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">{benchmarkFlagCount} Flags</span>
            </div>
          }
        >
          {ws24 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-right">Vs. Benchmark</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topBenchmarks.map((benchmark: BenchmarkRow) => (
                    <tr key={benchmark.category}>
                      <td className="px-4 py-3 text-slate-800">{benchmark.category}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-800">{formatPct(benchmark.ttmPct)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]', getTrafficBadge(benchmark.flag))}>
                          {getTrafficLabel(benchmark.flag)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">WS2-4 has not been generated yet.</p>
          )}
        </ReportCard>
      </div>

      <ReportCard
        id="ws210-data-quality"
        title={`Data Quality Report — ${analysis.flags.length} Items · ${analysis.flags.every((flag) => flag.resolutionStatus === 'ACTIONED') ? 'All Resolved' : 'Review Required'}`}
        badge={
          <span className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
            {analysis.flags.every((flag) => flag.resolutionStatus === 'ACTIONED') ? '✓ Admin Cleared' : `${resolvedCount}/${analysis.flags.length} Cleared`}
          </span>
        }
      >
        <div className="space-y-4">
          {dataQualityGroups.length === 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              No WS2-1 data quality items were raised.
            </div>
          ) : (
            dataQualityGroups.map((group) => (
              <div
                key={`${group.section}-${group.title}`}
                className={cn('rounded-sm border p-4', getSeverityCardTone(group.severity))}
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                  <div className="min-w-0">
                    <div className="flex items-start gap-4">
                      {group.severity === 'HIGH' ? (
                        <AlertTriangle className="mt-1 h-[18px] w-[18px] shrink-0 text-[#8a2f2c]" strokeWidth={2.5} />
                      ) : (
                        <div className="mt-[11px] h-2 w-2 shrink-0 rounded-full bg-[#a6542f]" />
                      )}
                      <div>
                        <h4 className={cn('text-[15px] font-bold leading-tight tracking-tight', getSeverityTitleTone(group.severity))}>
                          {group.count > 1 ? `${group.title} — ${group.count} Items` : group.title}
                        </h4>
                        <p className="mt-2 text-[15px] leading-relaxed text-slate-700/90 font-medium">
                          {sanitizeReviewerCopy(group.description) || 'Reviewed and cleared during HITL.'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <span className={cn('justify-self-end whitespace-nowrap rounded-sm px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em]', getSeverityPillTone(group.severity))}>
                    {group.severity === 'MEDIUM' ? 'MED' : group.severity} • SECTION {group.section}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </ReportCard>

      <ReportCard
        id="ws210-labor"
        title="Labor Analysis · TTM"
        badge={
          ws25 ? (
            <div className="flex items-center gap-3">
              {fullReports.ws25?.reportMarkdown && (
                <Button size="sm" variant="outline" onClick={() => setExpandedReportId('ws25')}>
                  Show More
                </Button>
              )}
              <span className={cn('rounded border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]', getTrafficBadge(ws25.benchmarkStatus))}>
                {getTrafficLabel(ws25.benchmarkStatus)}
              </span>
            </div>
          ) : undefined
        }
      >
        {ws25 ? (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Direct Labor</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{formatPct(ws25.directLaborPct)}</p>
                <p className="mt-1 text-sm text-slate-500">{sanitizeReviewerCopy(ws25.benchmarkNote)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Buyer-Adjusted Labor</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{formatPct(ws25.buyerAdjustedLaborPct)}</p>
                <p className="mt-1 text-sm text-slate-500">Post-owner normalization view</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">3-Year Labor Trend</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{laborTrendSummary ?? 'See detail below'}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {allInLaborRow
                    ? `This shows how total labor moved as a percent of revenue across ${laborYearLabels.fy1}, ${laborYearLabels.fy2}, and ${laborYearLabels.fy3}.`
                    : sanitizeReviewerCopy(ws25.trendNote)}
                </p>
              </div>
            </div>

            {buyerAdjustedLaborRow && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                Buyer-adjusted labor is <span className="font-semibold text-slate-900">{formatPct(buyerAdjustedLaborRow.ttmPct)}</span> of revenue in the latest 12 months after replacing owner-dependent labor with a buyer-adjusted view.
              </div>
            )}

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-right">{laborYearLabels.ttm}</th>
                    <th className="px-4 py-3 text-right">{laborYearLabels.fy3}</th>
                    <th className="px-4 py-3 text-right">{laborYearLabels.fy2}</th>
                    <th className="px-4 py-3 text-right">{laborYearLabels.fy1}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topLaborRows.map((row: LaborRow) => (
                    <tr key={row.category}>
                      <td className="px-4 py-3 text-slate-800">{row.category}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        <div>{formatPct(row.ttmPct)} of revenue</div>
                        <div className="text-xs text-slate-500">{formatCurrency(row.ttmAmount)}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        <div>{formatPct(row.fy3Pct)} of revenue</div>
                        <div className="text-xs text-slate-500">{formatCurrency(row.fy3Amount)}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">{formatPct(row.fy2Pct)} of revenue</td>
                      <td className="px-4 py-3 text-right text-slate-700">{formatPct(row.fy1Pct)} of revenue</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500">WS2-5 has not been generated yet.</p>
        )}
      </ReportCard>

      <Modal
        open={Boolean(expandedReportId)}
        onClose={() => setExpandedReportId(null)}
        title={expandedReportTitle}
        sizeClassName="max-w-6xl"
      >
        {expandedReport?.reportMarkdown ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Full source report from the derived WS2 stage. Use this for deeper review without leaving the baseline report.
            </div>
            <div className="text-sm">
              <PremiumMarkdown>{expandedReport.reportMarkdown}</PremiumMarkdown>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No full report output is available for this section yet.</p>
        )}
      </Modal>
    </div>
  )
}
