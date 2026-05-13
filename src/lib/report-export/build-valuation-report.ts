import type { TtmAnalysisView, Ws2RecastView } from '@/lib/ttm-agent/types'
import { buildWS2ReportAdapter } from '@/lib/ttm-agent/export-adapter'
import { filterNormLinesExcludedByRemovedManualFlags } from '@/lib/ttm-agent/ws2-workbook-export-model'
import {
  generateReportHtml,
  buildHtmlTable,
  type ReportConfig,
} from './generate-report-html'

export function buildValuationReportHtml(
  analysis: TtmAnalysisView,
  recast: Ws2RecastView,
  clientName: string,
): string {
  const ws2Report = buildWS2ReportAdapter(clientName, analysis, recast, analysis.derivedReports ?? [])

  const fmtCurrency = (v: number | null | undefined) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return 'n/a'
    if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
    if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
    return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  }

  const fmtPct = (v: number | null | undefined) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return 'n/a'
    const normalized = Math.abs(v) <= 1 ? v * 100 : v
    return `${normalized.toFixed(1)}%`
  }

  const pl = ws2Report.ws21.annualPL
  const years = analysis.annualModel?.years ?? []
  const fy1 = years[0]?.fiscalYear ?? 'FY1'
  const fy2 = years[1]?.fiscalYear ?? 'FY2'
  const fy3 = years[2]?.fiscalYear ?? 'FY3'

  // P&L summary table
  const plRows = [
    ['Total Revenue', fmtCurrency(pl.totalRevenue.fy1), fmtCurrency(pl.totalRevenue.fy2), fmtCurrency(pl.totalRevenue.fy3), fmtCurrency(pl.totalRevenue.ttm)],
    ['Gross Profit', fmtCurrency(pl.grossProfit.fy1), fmtCurrency(pl.grossProfit.fy2), fmtCurrency(pl.grossProfit.fy3), fmtCurrency(pl.grossProfit.ttm)],
    ['Gross Margin', fmtPct(pl.grossMargin.fy1), fmtPct(pl.grossMargin.fy2), fmtPct(pl.grossMargin.fy3), fmtPct(pl.grossMargin.ttm)],
    ['4-Wall EBITDA', fmtCurrency(pl.ebitdaPreRecast.fy1), fmtCurrency(pl.ebitdaPreRecast.fy2), fmtCurrency(pl.ebitdaPreRecast.fy3), fmtCurrency(pl.ebitdaPreRecast.ttm)],
    ['EBITDA Margin', fmtPct(pl.ebitdaMargin.fy1), fmtPct(pl.ebitdaMargin.fy2), fmtPct(pl.ebitdaMargin.fy3), fmtPct(pl.ebitdaMargin.ttm)],
  ]
  const plTable = buildHtmlTable(['Metric', fy1, fy2, fy3, 'TTM'], plRows)

  const rawNormLines = ((recast as unknown as { parsedReport?: { llmValuationResult?: { normLines?: Array<{
    description?: string
    byPeriod?: Record<string, number>
  }> } } }).parsedReport?.llmValuationResult?.normLines ?? [])
  const llmNormLines = filterNormLinesExcludedByRemovedManualFlags(rawNormLines, recast.flags ?? [])

  // Add-backs summary. LLM-only recasts store accepted/kept items in parsedReport,
  // while deterministic adapter items can be empty.
  const addBacks = llmNormLines.length > 0
    ? llmNormLines.map((line) => ({
        description: line.description ?? 'Normalization item',
        ttmAmount: line.byPeriod?.LTM ?? line.byPeriod?.TTM ?? 0,
      }))
    : (ws2Report.ws22?.recastSchedule.addBackItems ?? [])
  const totalAddBacks = addBacks.reduce((sum, item) => sum + item.ttmAmount, 0)
  const addBackRows = addBacks
    .filter(item => item.ttmAmount !== 0)
    .slice(0, 10)
    .map(item => [item.description, fmtCurrency(item.ttmAmount)])
  if (addBackRows.length) {
    addBackRows.push(['Total Add-Backs', fmtCurrency(totalAddBacks)])
  }
  const addBackTable = addBackRows.length
    ? buildHtmlTable(['Add-Back Item', 'TTM Amount'], addBackRows, { totalRow: true })
    : '<p>No add-backs applied.</p>'

  // Valuation summary (overall, not per-year)
  const multiples = ws2Report.ws22?.valuation.multipleAssumptions
  const valSummaryRows = [
    ['Normalized EBITDA (TTM)', fmtCurrency(ws2Report.ws22?.valuation.normalizedEbitda)],
    ['Multiple Range', multiples ? `${multiples.low.toFixed(1)}x - ${multiples.high.toFixed(1)}x` : 'n/a'],
    ['Valuation (Low)', fmtCurrency(ws2Report.ws22?.valuation.valuationLow)],
    ['Valuation (Mid)', fmtCurrency(ws2Report.ws22?.valuation.valuationMid)],
    ['Valuation (High)', fmtCurrency(ws2Report.ws22?.valuation.valuationHigh)],
  ]
  const valTable = buildHtmlTable(['Metric', 'Value'], valSummaryRows)

  const normalizedEbitda = recast.normalizedEbitda ?? null

  const config: ReportConfig = {
    title: 'Financial Analysis & Valuation',
    subtitle: 'WS2 Business Sale Readiness Report',
    clientName,
    generatedAt: analysis.updatedAt,
    kpis: [
      { label: 'TTM Revenue', value: fmtCurrency(pl.totalRevenue.ttm) },
      { label: 'Normalized EBITDA', value: fmtCurrency(normalizedEbitda) },
      { label: 'EBITDA Margin', value: fmtPct(pl.ebitdaMargin.ttm) },
      { label: 'Valuation (Mid)', value: fmtCurrency(recast.valuationMid) },
    ],
    sections: [
      { title: 'P&L Summary', content: plTable },
      { title: 'EBITDA Recast / Add-Backs', content: addBackTable },
      ...(valTable ? [{ title: 'Valuation Range', content: valTable }] : []),
    ],
  }

  return generateReportHtml(config)
}
