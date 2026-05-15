/**
 * WS2 valuation PDF — same pipeline as lease analysis (`generateReportHtml`)
 * and same **tables** as the on-screen workbook (Valuation + P&L tabs, then WS2-3–5 summaries).
 * Cover title: **Valuation Report**; TTM Low/Mid/High cards appear first, then the valuation workbook grid.
 */

import type { AnnualModelYear, TtmAnalysisView, Ws2RecastView } from '@/lib/ttm-agent/types'
import { computeRevenueByVertical } from '@/lib/ttm-agent/ws3-revenue'
import { computeBenchmarks } from '@/lib/ttm-agent/ws4-benchmarks'
import { computeLaborAnalysis } from '@/lib/ttm-agent/ws5-labor'
import {
  computeWs2WorkbookExportModel,
  ADD_BACK_CATEGORY_LABELS,
  getBaseItemValue,
  type PeriodKey,
  type Ws2WorkbookExportModel,
} from '@/lib/ttm-agent/ws2-workbook-export-model'
import {
  generateReportHtml,
  buildHtmlTable,
  buildBulletList,
  type ReportConfig,
} from './generate-report-html'

function escapeHtml(str: string | number | null | undefined): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/** Match Ws2WorkbookView `acct` (parentheses for negatives). */
function acct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  const formatted = abs.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (value < 0) return `($${formatted})`
  return `$${formatted}`
}

function acctPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${(value * 100).toFixed(1)}%`
}

function acctMult(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value.toFixed(1)}x`
}

function fmtCurrencySummary(v: number | null | undefined) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 'n/a'
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function fmtPctSummary(v: number | null | undefined) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 'n/a'
  const normalized = Math.abs(v) <= 1 ? v * 100 : v
  return `${normalized.toFixed(1)}%`
}

function fmtMultSummary(v: number | null | undefined) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 'n/a'
  return `${v.toFixed(1)}x`
}

/** Calendar month ranges for PDF section titles (V6). */
function periodFootnote(analysis: TtmAnalysisView): string {
  const bits: string[] = []
  const ts = analysis.ttmSummary
  if (ts?.startMonth && ts?.endMonth) {
    bits.push(`LTM ${ts.startMonth}–${ts.endMonth}`)
  }
  for (const y of analysis.annualModel?.years ?? []) {
    if (y.fiscalYear && y.periodStart && y.periodEnd) {
      bits.push(`${y.fiscalYear}: ${y.periodStart}–${y.periodEnd}`)
    } else if (y.fiscalYear) {
      bits.push(y.fiscalYear)
    }
  }
  return bits.join(' · ')
}

function sectionTitleWithPeriods(base: string, analysis: TtmAnalysisView): string {
  const p = periodFootnote(analysis)
  return p ? `${base} · ${p}` : base
}

function fyTableHeader(y: AnnualModelYear | undefined, fiscalFallback: string): string {
  if (y?.fiscalYear && y.periodStart && y.periodEnd) {
    return `${y.fiscalYear}\n${y.periodStart}–${y.periodEnd}`
  }
  return y?.fiscalYear ?? fiscalFallback
}

function yoyRatio(prev: number, next: number): number | null {
  if (prev === 0) return next === 0 ? 0 : null
  return (next - prev) / Math.abs(prev)
}

function thPeriod(p: { label: string; sublabel: string }): string {
  return `<th style="text-align:right;padding:10px 12px;">
    <div style="font-size:11px;font-weight:700;color:#1e293b;">${escapeHtml(p.label)}</div>
    <div style="font-size:10px;font-weight:400;color:#94a3b8;">${escapeHtml(p.sublabel)}</div>
  </th>`
}

function sectionRow(colSpan: number, label: string): string {
  return `<tr><td colspan="${colSpan}" style="background:#fffbeb;padding:8px 12px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#92400e;border-bottom:1px solid #fde68a;">${escapeHtml(label)}</td></tr>`
}

function spacerRow(colSpan: number): string {
  return `<tr><td colspan="${colSpan}" style="height:6px;padding:0;border:none;"></td></tr>`
}

function moneyCells(periods: Ws2WorkbookExportModel['periods'], values: (number | null)[], opts?: { bold?: boolean; borderTop?: boolean }): string {
  const bg = opts?.bold ? 'background:#f8fafc;font-weight:700;' : ''
  const bt = opts?.borderTop ? 'border-top:2px solid #e2e8f0;' : ''
  return periods
    .map((_, i) => {
      const v = values[i]
      if (v == null || !Number.isFinite(v)) {
        return `<td style="text-align:right;padding:10px 12px;${bg}${bt}">—</td>`
      }
      const color = v < 0 ? 'color:#b91c1c;' : ''
      return `<td style="text-align:right;padding:10px 12px;${bg}${bt}${color}">${acct(v)}</td>`
    })
    .join('')
}

function labelCell(text: string, opts?: { bold?: boolean; indent?: boolean; borderTop?: boolean }): string {
  const bg = opts?.bold ? 'background:#f8fafc;font-weight:700;color:#0f172a;' : 'color:#334155;'
  const pl = opts?.indent ? 'padding-left:20px;' : ''
  const bt = opts?.borderTop ? 'border-top:2px solid #e2e8f0;' : ''
  return `<td style="text-align:left;padding:10px 12px;${bg}${pl}${bt}">${escapeHtml(text)}</td>`
}

function pctCells(periods: Ws2WorkbookExportModel['periods'], values: (number | null)[]): string {
  return periods
    .map((_, i) => {
      const v = values[i]
      return `<td style="text-align:right;padding:6px 12px;font-size:12px;color:#64748b;">${acctPct(v)}</td>`
    })
    .join('')
}

function buildValuationWorkbookTable(m: Ws2WorkbookExportModel): string {
  const { periods, totals, groupedItems, llmResult, recast, multiple } = m
  const colSpan = periods.length + 1
  const getPre = (pk: PeriodKey) => {
    if (llmResult?.preRecast) {
      const lk = pk === 'ltm' ? 'LTM' : pk.toUpperCase()
      const v = llmResult.preRecast[lk] ?? (llmResult.preRecast as Record<string, number>)[pk]
      if (v != null) return v
    }
    const years = m.years
    switch (pk) {
      case 'ltm':
        return (years[2] as { netIncome?: number })?.netIncome ?? m.analysis.ttmSummary?.ebitdaPreRecast ?? 0
      case 'fy3':
        return (years[2] as { netIncome?: number })?.netIncome ?? years[2]?.ebitdaPreRecast ?? 0
      case 'fy2':
        return (years[1] as { netIncome?: number })?.netIncome ?? years[1]?.ebitdaPreRecast ?? 0
      case 'fy1':
        return (years[0] as { netIncome?: number })?.netIncome ?? years[0]?.ebitdaPreRecast ?? 0
      default:
        return 0
    }
  }

  const headerRow = `<tr>
    <th style="text-align:left;padding:10px 12px;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;">All figures in USD</th>
    ${periods.map(thPeriod).join('')}
  </tr>`

  const normRows: string[] = []
  for (const [cat, items] of groupedItems) {
    normRows.push(sectionRow(colSpan, ADD_BACK_CATEGORY_LABELS[cat] ?? `Category ${cat}`))
    for (const item of items) {
      const sub = [item.glCode ? `GL: ${item.glCode}` : '', item.status || ''].filter(Boolean).join(' · ')
      normRows.push(`<tr>
        ${labelCell(item.description, { indent: true })}
        ${periods.map((p) => {
          const v = getBaseItemValue(item, p.key)
          const color = v < 0 ? 'color:#b91c1c;' : ''
          return `<td style="text-align:right;padding:8px 12px;${color}">${acct(v)}</td>`
        }).join('')}
      </tr>`)
      if (sub) {
        normRows.push(`<tr><td colspan="${colSpan}" style="padding:0 12px 6px 28px;font-size:10px;color:#94a3b8;">${escapeHtml(sub)}</td></tr>`)
      }
    }
  }

  const low = recast.assumptions?.multipleLow
  const high = recast.assumptions?.multipleHigh
  const multipleRow = periods
    .map(() => {
      const rangeStr = low != null && high != null ? `${Number(low).toFixed(1)}x – ${Number(high).toFixed(1)}x` : acctMult(multiple)
      return `<td style="text-align:right;padding:8px 12px;font-weight:700;background:#f8fafc;">${escapeHtml(rangeStr)}</td>`
    })
    .join('')

  const valuationRow = periods
    .map((p) => {
      const lk = p.key === 'ltm' ? 'LTM' : p.key.toUpperCase()
      const llmVal = llmResult?.valuation?.[lk]
      let inner: string
      if (llmVal) {
        inner = `${acct(llmVal.low)} – ${acct(llmVal.high)}`
      } else {
        const norm = totals[p.key].normalizedEbitda
        if (low != null && high != null) {
          inner = `${acct(norm * Number(low))} – ${acct(norm * Number(high))}`
        } else {
          inner = acct(totals[p.key].valuation)
        }
      }
      return `<td style="text-align:right;padding:12px;font-weight:700;font-size:13px;color:#fbbf24;background:#1e293b;white-space:nowrap;">${inner}</td>`
    })
    .join('')

  const marginRow = periods
    .map((p) => {
      const margin = totals[p.key].revenue ? totals[p.key].normalizedEbitda / totals[p.key].revenue : null
      return `<td style="text-align:right;padding:6px 12px;font-size:11px;color:#94a3b8;">${acctPct(margin)}</td>`
    })
    .join('')

  return `<table class="report-table" style="margin-bottom:20px;">
  <thead>${headerRow}</thead>
  <tbody>
    ${sectionRow(colSpan, 'Valuation Summary')}
    <tr>${labelCell('Revenue')}${moneyCells(periods, periods.map(p => totals[p.key].revenue))}</tr>
    ${spacerRow(colSpan)}
    <tr>${labelCell('Net Income / EBITDA (Pre-Normalized)')}${moneyCells(periods, periods.map(p => getPre(p.key)))}</tr>
    ${spacerRow(colSpan)}
    ${sectionRow(colSpan, 'Normalization Items')}
    ${normRows.join('\n')}
    ${spacerRow(colSpan)}
    <tr>${labelCell('Total Adjustments', { bold: true, borderTop: true })}${moneyCells(periods, periods.map(p => totals[p.key].addBacks), { bold: true, borderTop: true })}</tr>
    ${spacerRow(colSpan)}
    <tr>${labelCell('Revised Net Income / EBITDA', { bold: true, borderTop: true })}${moneyCells(periods, periods.map(p => totals[p.key].normalizedEbitda), { bold: true, borderTop: true })}</tr>
    <tr>${labelCell('4-Wall EBITDA', { bold: true })}${moneyCells(periods, periods.map(p => totals[p.key].fourWallEbitda), { bold: true })}</tr>
    ${spacerRow(colSpan)}
    <tr>${labelCell('Multiple', { bold: true })}${multipleRow}</tr>
    <tr>
      <td style="text-align:left;padding:12px;font-weight:700;background:#1e293b;color:#fff;">Valuation</td>
      ${valuationRow}
    </tr>
    <tr>
      ${labelCell('Normalized EBITDA Margin')}
      ${marginRow}
    </tr>
  </tbody>
</table>`
}

function buildValuationRangeCards(m: Ws2WorkbookExportModel): string {
  const { totals, llmResult, recast } = m
  const llmLtm = llmResult?.valuation?.['LTM']
  const rows = [
    { label: 'Low', mult: recast.assumptions?.multipleLow, llmField: 'low' as const },
    { label: 'Mid', mult: recast.assumptions?.multipleMid, llmField: 'mid' as const },
    { label: 'High', mult: recast.assumptions?.multipleHigh, llmField: 'high' as const },
  ]
  const cells = rows.map(({ label, mult, llmField }) => {
    const val = llmLtm ? llmLtm[llmField] : totals.ltm.normalizedEbitda * (mult ?? 0)
    const isMid = label === 'Mid'
    const bg = isMid ? 'background:#1e293b;border:1px solid #334155;color:#fff;' : 'background:#f8fafc;border:1px solid #e2e8f0;'
    const amtColor = isMid ? 'color:#fbbf24;' : 'color:#0f172a;'
    const lblColor = isMid ? 'color:#cbd5e1;' : 'color:#64748b;'
    return `<td style="width:33%;padding:16px;text-align:center;vertical-align:top;${bg}">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;${lblColor}">${escapeHtml(label)} · ${acctMult(mult)}</div>
      <div style="margin-top:10px;font-size:22px;font-weight:700;${amtColor}">${acct(val)}</div>
    </td>`
  })
  return `<table style="width:100%;max-width:720px;margin:0 auto 8px;border-collapse:separate;border-spacing:10px;"><tr>${cells.join('')}</tr></table>`
}

function buildPlWorkbookTable(m: Ws2WorkbookExportModel): string {
  const pl = m.ws2Report.ws21.annualPL
  const { periods, totals } = m
  const years = m.years
  const revLines = pl.revenueLines ?? []
  const cogsLines = pl.cogsLines ?? []
  const expLines = (pl.expenseLines ?? []).filter((l) => !l.excludedFromEbitda && l.cantaraCode !== 'OPX-ONEOFF')
  const netIncome = {
    ttm: (years[2] as { netIncome?: number })?.netIncome ?? pl.netIncome?.ttm ?? 0,
    fy3: (years[2] as { netIncome?: number })?.netIncome ?? pl.netIncome?.fy3 ?? 0,
    fy2: (years[1] as { netIncome?: number })?.netIncome ?? pl.netIncome?.fy2 ?? 0,
    fy1: (years[0] as { netIncome?: number })?.netIncome ?? pl.netIncome?.fy1 ?? 0,
  }
  const fourWall = periods.map((p) => totals[p.key].fourWallEbitda)
  const colSpan = periods.length + 1

  type Row =
    | { kind: 'section'; label: string }
    | { kind: 'blank' }
    | { kind: 'pct'; label: string; values: (number | null)[] }
    | { kind: 'data'; label: string; values: (number | null)[]; bold?: boolean; borderTop?: boolean; indent?: boolean }

  const rows: Row[] = [
    { kind: 'section', label: 'Revenue' },
    ...revLines.map((l) => ({ kind: 'data' as const, label: l.label, values: [l.ttm, l.fy3, l.fy2, l.fy1], indent: true })),
    { kind: 'data', label: 'Total Revenue', values: [pl.totalRevenue.ttm, pl.totalRevenue.fy3, pl.totalRevenue.fy2, pl.totalRevenue.fy1], bold: true, borderTop: true },
    { kind: 'blank' },
    { kind: 'section', label: 'Cost of Goods Sold' },
    ...cogsLines.map((l) => ({ kind: 'data' as const, label: l.label, values: [l.ttm, l.fy3, l.fy2, l.fy1], indent: true })),
    { kind: 'data', label: 'Total COGS', values: [pl.totalCogs.ttm, pl.totalCogs.fy3, pl.totalCogs.fy2, pl.totalCogs.fy1], bold: true, borderTop: true },
    { kind: 'blank' },
    { kind: 'data', label: 'Gross Profit', values: [pl.grossProfit.ttm, pl.grossProfit.fy3, pl.grossProfit.fy2, pl.grossProfit.fy1], bold: true, borderTop: true },
    { kind: 'pct', label: 'Gross Margin %', values: [pl.grossMargin.ttm, pl.grossMargin.fy3, pl.grossMargin.fy2, pl.grossMargin.fy1] },
    { kind: 'blank' },
    { kind: 'section', label: 'Operating Expenses' },
    ...expLines.map((l) => ({ kind: 'data' as const, label: l.label, values: [l.ttm, l.fy3, l.fy2, l.fy1], indent: true })),
    { kind: 'data', label: 'Total OpEx', values: [pl.totalOpex.ttm, pl.totalOpex.fy3, pl.totalOpex.fy2, pl.totalOpex.fy1], bold: true, borderTop: true },
    { kind: 'blank' },
    { kind: 'data', label: 'Net Income', values: [netIncome.ttm, netIncome.fy3, netIncome.fy2, netIncome.fy1], bold: true, borderTop: true },
    { kind: 'blank' },
    { kind: 'data', label: 'Normalized EBITDA', values: periods.map((p) => totals[p.key].normalizedEbitda), bold: true, borderTop: true },
    { kind: 'pct', label: 'Normalized Margin %', values: periods.map((p) => (totals[p.key].revenue ? totals[p.key].normalizedEbitda / totals[p.key].revenue : null)) },
    { kind: 'blank' },
    { kind: 'data', label: '4-Wall EBITDA', values: fourWall, bold: true, borderTop: true },
    {
      kind: 'pct',
      label: '4-Wall Margin %',
      values: periods.map((p, i) => (totals[p.key].revenue ? (fourWall[i] ?? 0) / totals[p.key].revenue : null)),
    },
  ]

  const headerRow = `<tr>
    <th style="text-align:left;padding:10px 12px;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;">All figures in USD</th>
    ${periods.map(thPeriod).join('')}
  </tr>`

  const body = rows
    .map((row) => {
      if (row.kind === 'blank') return spacerRow(colSpan)
      if (row.kind === 'section') return sectionRow(colSpan, row.label)
      if (row.kind === 'pct') {
        return `<tr>${labelCell(row.label)}${pctCells(periods, row.values)}</tr>`
      }
      return `<tr>
        ${labelCell(row.label, { bold: row.bold, indent: row.indent, borderTop: row.borderTop })}
        ${moneyCells(periods, row.values, { bold: row.bold, borderTop: row.borderTop })}
      </tr>`
    })
    .join('\n')

  return `<table class="report-table">
  <thead>${headerRow}</thead>
  <tbody>${body}</tbody>
</table>`
}

export function buildWs2WorkbookReportHtml(
  analysis: TtmAnalysisView,
  recast: Ws2RecastView,
  clientName: string,
): string {
  const m = computeWs2WorkbookExportModel(clientName, analysis, recast)
  const { recast: r, analysis: a } = m

  const multipleMid = r.assumptions?.multipleMid
  const periodLine = periodFootnote(a)
  const subtitleParts: string[] = ['WS2 financial analysis']
  if (periodLine) subtitleParts.push(periodLine)
  if (multipleMid != null && Number.isFinite(multipleMid)) {
    subtitleParts.push(`Multiple (mid): ${fmtMultSummary(multipleMid)}`)
  }
  const subtitle = subtitleParts.join(' · ')

  const ttmValuationSection = `<p style="font-size:13px;color:#475569;line-height:1.65;margin-bottom:14px;">
    <strong>TTM valuation range.</strong> Implied enterprise value from <strong>TTM normalized EBITDA</strong>
    (${acct(m.totals.ltm.normalizedEbitda)}) times the low, mid, and high EBITDA multiple assumptions (same inputs as the valuation workbook below).
  </p>
  ${buildValuationRangeCards(m)}`

  const valuationWorkbookTableOnly = buildValuationWorkbookTable(m)

  const plSection = buildPlWorkbookTable(m)

  const fy1 = m.years[0]?.fiscalYear ?? 'FY1'
  const fy2 = m.years[1]?.fiscalYear ?? 'FY2'
  const fy3 = m.years[2]?.fiscalYear ?? 'FY3'
  const y1 = m.years[0]
  const y2 = m.years[1]
  const y3 = m.years[2]
  const rng = (y: AnnualModelYear | undefined) => (y?.periodStart && y?.periodEnd ? `${y.periodStart}–${y.periodEnd}` : '')
  const y1range = rng(y1)
  const y2range = rng(y2)
  const y3range = rng(y3)
  const ltmRng =
    a.ttmSummary?.startMonth && a.ttmSummary?.endMonth ? `${a.ttmSummary.startMonth}–${a.ttmSummary.endMonth}` : ''
  const ltmHdrMoney = ltmRng ? `LTM $\n${ltmRng}` : 'LTM $'

  const rev = computeRevenueByVertical(a)
  const tr = rev.totalRevenue
  const hasRevTotals = [tr.ltm, tr.fy3, tr.fy2, tr.fy1].some((x) => typeof x === 'number' && Number.isFinite(x) && x !== 0)
  const totalYoy23 = yoyRatio(tr.fy2, tr.fy3)
  const totalYoy12 = yoyRatio(tr.fy1, tr.fy2)

  const revRows =
    rev.verticals.length > 0
      ? rev.verticals.map((v) => [
          v.name,
          v.health,
          fmtCurrencySummary(Number(v.ltm)),
          fmtCurrencySummary(Number(v.fy3)),
          fmtCurrencySummary(Number(v.fy2)),
          fmtCurrencySummary(Number(v.fy1)),
          v.yoyFy2toFy3 != null ? fmtPctSummary(v.yoyFy2toFy3) : '—',
          v.yoyFy1toFy2 != null ? fmtPctSummary(v.yoyFy1toFy2) : '—',
        ])
      : hasRevTotals
        ? [
            [
              'Total revenue (map GL lines to Cantara REV-* codes for a vertical breakdown)',
              '—',
              fmtCurrencySummary(tr.ltm),
              fmtCurrencySummary(tr.fy3),
              fmtCurrencySummary(tr.fy2),
              fmtCurrencySummary(tr.fy1),
              totalYoy23 != null ? fmtPctSummary(totalYoy23) : '—',
              totalYoy12 != null ? fmtPctSummary(totalYoy12) : '—',
            ],
          ]
        : [
            [
              'No mapped vertical revenue',
              '—',
              '—',
              '—',
              '—',
              '—',
              '—',
              '—',
            ],
          ]

  const ltmRevHdr = ltmRng ? `LTM\n${ltmRng}` : 'LTM'
  const revTable = buildHtmlTable(
    [
      'Vertical',
      'Health',
      ltmRevHdr,
      fyTableHeader(y3, fy3),
      fyTableHeader(y2, fy2),
      fyTableHeader(y1, fy1),
      `YoY (${fy2}→${fy3})`,
      `YoY (${fy1}→${fy2})`,
    ],
    revRows,
    { prelineHeaders: true },
  )
  const revFlags =
    rev.concentrationFlags.length > 0
      ? `<p style="font-weight:700;margin-top:12px;color:#21263C;">Concentration notes</p>${buildBulletList(rev.concentrationFlags.map(f => `${f.severity}: ${f.message}`))}`
      : ''
  const revUnmapped =
    rev.unmappedRevenue.length > 0
      ? `<p style="font-weight:700;margin-top:12px;color:#92400E;">Unmapped revenue</p>${buildBulletList(rev.unmappedRevenue.map(u => `${u.name} (${u.code}): ${fmtCurrencySummary(u.ltm)}`))}`
      : ''
  const revSection = `${revTable}${revFlags}${revUnmapped}`

  const bm = computeBenchmarks(a)
  const bmRows = bm.benchmarks.map(b => [
    b.category,
    b.flag,
    fmtCurrencySummary(b.ltmDollar),
    fmtPctSummary(b.ltmPct),
    fmtPctSummary(b.fy3Pct),
    fmtPctSummary(b.fy2Pct),
    fmtPctSummary(b.fy1Pct),
  ])
  const bmTable = buildHtmlTable(
    [
      'Category',
      'Flag',
      ltmHdrMoney,
      ltmRng ? `LTM % rev\n${ltmRng}` : 'LTM % rev',
      y3range ? `${fy3} %\n${y3range}` : `${fy3} %`,
      y2range ? `${fy2} %\n${y2range}` : `${fy2} %`,
      y1range ? `${fy1} %\n${y1range}` : `${fy1} %`,
    ],
    bmRows,
    { prelineHeaders: true },
  )
  const bmNote = `<p style="margin-top:12px;color:#475569;font-size:13px;line-height:1.6;"><strong>Overall:</strong> ${bm.overallHealth} — ${bm.overallNote}</p>`
  const bmOpps =
    bm.improvementOpportunities.length > 0
      ? `<p style="font-weight:700;margin-top:12px;">Improvement opportunities</p>${buildBulletList(
          bm.improvementOpportunities.map(
            o => `${o.category}: ${fmtPctSummary(o.currentPct)} of revenue vs benchmark high ${fmtPctSummary(o.benchmarkHigh)} (${fmtCurrencySummary(o.savingsDollar)} opportunity).`,
          ),
        )}`
      : ''
  const bmSection = `${bmTable}${bmNote}${bmOpps}`

  const replSalary = r.assumptions?.replacementSalary ?? 20000
  const labor = computeLaborAnalysis(a, replSalary)
  const laborRows = labor.rows.map(row => [
    row.category + (row.isTotal ? ' (total)' : ''),
    fmtCurrencySummary(row.ltmDollar),
    fmtPctSummary(row.ltmPct),
    fmtCurrencySummary(row.fy3Dollar),
    fmtPctSummary(row.fy3Pct),
  ])
  const laborTable = buildHtmlTable(
    [
      'Labor category',
      ltmHdrMoney,
      ltmRng ? `LTM % rev\n${ltmRng}` : 'LTM % rev',
      y3range ? `FY3 $\n${y3range}` : 'FY3 $',
      y3range ? `FY3 % rev\n${y3range}` : 'FY3 % rev',
    ],
    laborRows,
    { prelineHeaders: true },
  )
  const laborSummary = `<p style="margin-top:0;color:#475569;font-size:13px;line-height:1.6;">
    Direct labor (staff + mgmt) LTM: ${fmtPctSummary(labor.directLaborPct)} of revenue. All-in labor: ${fmtPctSummary(labor.allInLaborPct)}.
    Buyer-adjusted view: ${fmtPctSummary(labor.buyerAdjustedPct)}. Benchmark: ${labor.benchmarkStatus} — ${labor.benchmarkNote}
    <br/>Trend: ${labor.trendAssessment} — ${labor.trendNote}
  </p>`
  const laborFlags =
    labor.flags.length > 0
      ? `${buildBulletList(labor.flags.map(f => `${f.severity} (${f.type}): ${f.message}`))}`
      : ''
  const laborSection = `${laborSummary}${laborTable}${laborFlags ? `<div style="margin-top:12px">${laborFlags}</div>` : ''}`

  const config: ReportConfig = {
    title: 'Valuation Report',
    subtitle,
    clientName,
    generatedAt: a.updatedAt,
    /* No `kpis` here: the lease-style KPI strip used `recast.valuation*` which can disagree with the
       workbook table + Low/Mid/High cards (those use LLM or normalized EBITDA × multiples). One summary only. */
    sections: [
      { title: sectionTitleWithPeriods('TTM valuation range', a), content: ttmValuationSection },
      { title: sectionTitleWithPeriods('Valuation workbook', a), content: valuationWorkbookTableOnly },
      { title: sectionTitleWithPeriods('P&L / 4-Wall EBITDA', a), content: plSection },
      { title: sectionTitleWithPeriods('Revenue by Vertical', a), content: revSection },
      { title: sectionTitleWithPeriods('Expense Benchmarks', a), content: bmSection },
      { title: sectionTitleWithPeriods('Labor Analysis', a), content: laborSection },
    ],
  }

  return generateReportHtml(config)
}
