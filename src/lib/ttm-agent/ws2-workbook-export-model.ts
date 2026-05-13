/**
 * Pure workbook numbers for PDF/export — mirrors Ws2WorkbookView defaults (no cell overrides).
 */

import type { TtmAnalysisView, Ws2RecastFlagView, Ws2RecastView } from '@/lib/ttm-agent/types'
import type { AddBackItem, WS2Report } from '@/lib/ws2/ws2-types'
import { buildWS2ReportAdapter } from '@/lib/ttm-agent/export-adapter'

export type PeriodKey = 'ltm' | 'fy3' | 'fy2' | 'fy1'

export type WorkbookPeriod = { key: PeriodKey; label: string; sublabel: string }

export type LlmValuationResult = {
  preRecast: Record<string, number>
  normalizedEbitda: Record<string, number>
  fourWallEbitda?: Record<string, number>
  valuation: Record<string, { low: number; mid: number; high: number }>
  normLines: Array<{ id?: string; description: string; source?: string; byPeriod?: Record<string, number> }>
}

export type WorkbookTotals = Record<
  PeriodKey,
  { addBacks: number; normalizedEbitda: number; revenue: number; valuation: number; fourWallEbitda: number }
>

export const ADD_BACK_CATEGORY_LABELS: Record<number, string> = {
  1: 'Owner / Officer Compensation',
  2: 'Personal Expenses',
  3: 'One-Off Non-Recurring Expenses',
  4: 'Tenant Improvements',
  5: 'Fair Market Rent Normalization',
}

export function buildWorkbookPeriods(analysis: TtmAnalysisView): WorkbookPeriod[] {
  const years = analysis.annualModel?.years ?? []
  const ttmStart = analysis.ttmSummary?.startMonth ?? ''
  const ttmEnd = analysis.ttmSummary?.endMonth ?? ''
  return [
    {
      key: 'ltm',
      label: 'LTM',
      sublabel: ttmStart && ttmEnd ? `${ttmStart} — ${ttmEnd}` : '',
    },
    ...years
      .map((y, i) => ({
        key: (['fy1', 'fy2', 'fy3'] as PeriodKey[])[i],
        label: y.fiscalYear ?? `FY${i + 1}`,
        sublabel: y.periodStart && y.periodEnd ? `${y.periodStart} — ${y.periodEnd}` : '',
      }))
      .reverse(),
  ]
}

function readLlmResult(recast: Ws2RecastView): LlmValuationResult | undefined {
  return (recast as { parsedReport?: { llmValuationResult?: LlmValuationResult } }).parsedReport?.llmValuationResult
}

function toFiniteLocal(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const n = Number(value.trim().replace(/,/g, ''))
    return Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * Manual add-backs append a norm line and create a WS2-2 flag. "Remove" (ESCALATE_CLIENT) adjusts EBITDA via
 * `resolveWs2RecastMetrics` but does not remove the row from `parsedReport.llmValuationResult.normLines`.
 * Filter those out so workbook / PDF match what was removed in review.
 */
export function filterNormLinesExcludedByRemovedManualFlags<T extends { description?: string; byPeriod?: Record<string, number> }>(
  normLines: T[],
  flags: Ws2RecastFlagView[] | undefined,
): T[] {
  if (!normLines.length || !flags?.length) return normLines
  const removedKeys = new Set<string>()
  for (const f of flags) {
    if (f.resolutionStatus !== 'ACTIONED' || f.resolutionAction !== 'ESCALATE_CLIENT') continue
    const p = f.payload
    if (p?.source !== 'MANUAL_ADDBACK') continue
    const desc = String(p.description ?? '').trim().toLowerCase()
    const impact = toFiniteLocal(p.dollarImpact)
    if (!desc || impact === null) continue
    removedKeys.add(`${desc}|${impact}`)
  }
  if (!removedKeys.size) return normLines
  return normLines.filter((line) => {
    const desc = String(line.description ?? '').trim().toLowerCase()
    const ltm = toFiniteLocal(line.byPeriod?.['LTM'] ?? line.byPeriod?.['TTM'])
    if (ltm === null) return true
    return !removedKeys.has(`${desc}|${ltm}`)
  })
}

function guessCategoryFromDescription(name: string): AddBackItem['category'] {
  if (/Insurance|Consulting|Draw|Salary|Replacement|Owner|Officer/i.test(name)) return 1
  if (/Donation|Gift|Meal|Travel|Church/i.test(name)) return 2
  if (/Non-Recurring|Repair|One-Off/i.test(name)) return 3
  if (/Tenant|TI|Leasehold/i.test(name)) return 4
  if (/Rent|FMR/i.test(name)) return 5
  return 2
}

/** Same priority order as Ws2WorkbookView `addBackItems` useMemo (no overrides). */
export function parseWorkbookAddBackItems(ws2Report: WS2Report, recast: Ws2RecastView): AddBackItem[] {
  const llmResult = readLlmResult(recast)
  if (llmResult?.normLines?.length) {
    const lines = filterNormLinesExcludedByRemovedManualFlags(llmResult.normLines, recast.flags)
    return lines.map((line, i) => {
      const description = line.description || 'Unknown'
      return {
        id: line.id || `llm-${i}`,
        description,
        glCode: line.source || '',
        ttmAmount: line.byPeriod?.['LTM'] ?? line.byPeriod?.['TTM'] ?? 0,
        fy3Amount: line.byPeriod?.['FY3'] ?? 0,
        fy2Amount: line.byPeriod?.['FY2'] ?? 0,
        fy1Amount: line.byPeriod?.['FY1'] ?? 0,
        category: guessCategoryFromDescription(description),
        status: 'VERIFIED' as AddBackItem['status'],
      }
    })
  }

  const fromAdapter = ws2Report.ws22?.recastSchedule.addBackItems ?? []
  if (fromAdapter.length > 0) return fromAdapter

  const md = recast.reportMarkdown
  if (!md) return []

  function parseCur(raw: string): number {
    const cleaned = raw.replace(/\*\*/g, '').replace(/\$/g, '').replace(/,/g, '').trim().replace(/^\((.*)\)$/, '-$1')
    const n = Number(cleaned)
    return Number.isFinite(n) ? n : 0
  }

  const sectionMatch = md.match(/## EBITDA RECAST SCHEDULE([\s\S]*?)(?:\n## 3-YEAR|\n## FLAG LIST|\n## PRELIMINARY|$)/i)
  if (!sectionMatch) return []

  const tableLines = sectionMatch[1]
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('|'))
    .filter(l => !/^\|\s*-+/.test(l))
    .map(l => l.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim().replace(/\*\*/g, '')))

  if (tableLines.length < 2) return []

  const header = tableLines[0]
  const dataRows = tableLines.slice(1)

  let nameCol = 0
  let ttmCol = -1
  let fy3Col = -1
  let fy2Col = -1
  let fy1Col = -1
  for (let i = 0; i < header.length; i++) {
    const h = header[i].toLowerCase()
    if (/normalization items|item description/i.test(header[i])) nameCol = i
    if (/^(ttm|ltm)/.test(h) || h === 'ttm amount') ttmCol = i
    if (/^fy3|^fy\s*3/.test(h) || /fy3\s*\(/i.test(header[i])) fy3Col = i
    if (/^fy2|^fy\s*2/.test(h) || /fy2\s*\(/i.test(header[i])) fy2Col = i
    if (/^fy1|^fy\s*1/.test(h) || /fy1\s*\(/i.test(header[i])) fy1Col = i
  }

  if (ttmCol === -1) {
    ttmCol = nameCol + 1
    if (header.length > ttmCol + 3) {
      fy3Col = ttmCol + 1
      fy2Col = ttmCol + 2
      fy1Col = ttmCol + 3
    }
  }

  let itemIndex = 0
  return dataRows
    .filter(c => {
      const name = c[nameCol] ?? ''
      return !/Total Adjustments|Revised Net Income|Revenue|Net Income\/EBITDA|^Multiple$|^Valuation$|^—$|^-$/i.test(name) &&
        !/Total Adjustments|Revised|Multiple|Valuation/i.test(name)
    })
    .map(c => {
      itemIndex++
      const name = c[nameCol] ?? ''
      const catGuess = guessCategoryFromDescription(name)
      return {
        id: String(itemIndex),
        category: catGuess,
        description: name,
        glCode: undefined,
        ttmAmount: ttmCol >= 0 ? parseCur(c[ttmCol] ?? '0') : 0,
        fy3Amount: fy3Col >= 0 ? parseCur(c[fy3Col] ?? '0') : undefined,
        fy2Amount: fy2Col >= 0 ? parseCur(c[fy2Col] ?? '0') : undefined,
        fy1Amount: fy1Col >= 0 ? parseCur(c[fy1Col] ?? '0') : undefined,
        status: 'VERIFIED' as AddBackItem['status'],
      }
    })
}

export function getBaseItemValue(item: AddBackItem, periodKey: PeriodKey): number {
  switch (periodKey) {
    case 'ltm':
      return item.ttmAmount
    case 'fy3':
      return item.fy3Amount ?? 0
    case 'fy2':
      return item.fy2Amount ?? 0
    case 'fy1':
      return item.fy1Amount ?? 0
    default:
      return 0
  }
}

export function groupAddBackItems(addBackItems: AddBackItem[]): Array<[number, AddBackItem[]]> {
  const groups = new Map<number, AddBackItem[]>()
  for (const item of addBackItems) {
    const list = groups.get(item.category) ?? []
    list.push(item)
    groups.set(item.category, list)
  }
  return Array.from(groups.entries()).sort((a, b) => a[0] - b[0])
}

export function getPreRecastExport(
  periodKey: PeriodKey,
  analysis: TtmAnalysisView,
  years: TtmAnalysisView['annualModel'] extends { years: infer Y } | undefined ? Y : never,
  llmResult: LlmValuationResult | undefined,
): number {
  if (llmResult?.preRecast) {
    const llmKey = periodKey === 'ltm' ? 'LTM' : periodKey.toUpperCase()
    const llmVal = llmResult.preRecast[llmKey] ?? (llmResult.preRecast as Record<string, number>)[periodKey]
    if (llmVal != null) return llmVal
  }
  switch (periodKey) {
    case 'ltm':
      return (years[2] as { netIncome?: number })?.netIncome ?? analysis.ttmSummary?.ebitdaPreRecast ?? 0
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

export function getRevenueExport(periodKey: PeriodKey, analysis: TtmAnalysisView, years: NonNullable<TtmAnalysisView['annualModel']>['years']): number {
  switch (periodKey) {
    case 'ltm':
      return analysis.ttmSummary?.totalRevenue ?? 0
    case 'fy3':
      return years[2]?.totalRevenue ?? 0
    case 'fy2':
      return years[1]?.totalRevenue ?? 0
    case 'fy1':
      return years[0]?.totalRevenue ?? 0
    default:
      return 0
  }
}

export function computeWorkbookTotalsExport(args: {
  addBackItems: AddBackItem[]
  analysis: TtmAnalysisView
  years: NonNullable<TtmAnalysisView['annualModel']>['years']
  recast: Ws2RecastView
  multiple: number
}): WorkbookTotals {
  const { addBackItems, analysis, years, multiple } = args
  const llmResult = readLlmResult(args.recast)
  const result: WorkbookTotals = {
    ltm: { addBacks: 0, normalizedEbitda: 0, revenue: 0, valuation: 0, fourWallEbitda: 0 },
    fy3: { addBacks: 0, normalizedEbitda: 0, revenue: 0, valuation: 0, fourWallEbitda: 0 },
    fy2: { addBacks: 0, normalizedEbitda: 0, revenue: 0, valuation: 0, fourWallEbitda: 0 },
    fy1: { addBacks: 0, normalizedEbitda: 0, revenue: 0, valuation: 0, fourWallEbitda: 0 },
  }
  const toLlmKey = (key: PeriodKey): string => (key === 'ltm' ? 'LTM' : key.toUpperCase())

  for (const key of ['ltm', 'fy3', 'fy2', 'fy1'] as PeriodKey[]) {
    const totalAB = addBackItems.reduce((sum, item) => sum + getBaseItemValue(item, key), 0)
    const preRecast = getPreRecastExport(key, analysis, years, llmResult)
    const revenue = getRevenueExport(key, analysis, years)
    const normalized = preRecast + totalAB
    const lk = toLlmKey(key)
    const llmNormEbitda = llmResult?.normalizedEbitda?.[lk]
    const llmFourWall = llmResult?.fourWallEbitda?.[lk]
    const llmValuation = llmResult?.valuation?.[lk]
    const replacementItem = addBackItems.find(item => /replacement salary/i.test(item.description))
    const replacementAmount = replacementItem ? getBaseItemValue(replacementItem, key) : key === 'ltm' ? 0 : -20000
    const finalNormEbitda = llmNormEbitda ?? normalized
    const finalFourWall = llmFourWall ?? (normalized - replacementAmount)
    result[key] = {
      addBacks: totalAB,
      normalizedEbitda: finalNormEbitda,
      revenue,
      valuation: llmValuation?.mid ?? finalNormEbitda * multiple,
      fourWallEbitda: finalFourWall,
    }
  }
  return result
}

export type Ws2WorkbookExportModel = {
  clientName: string
  analysis: TtmAnalysisView
  recast: Ws2RecastView
  ws2Report: WS2Report
  years: NonNullable<TtmAnalysisView['annualModel']>['years']
  periods: WorkbookPeriod[]
  addBackItems: AddBackItem[]
  groupedItems: Array<[number, AddBackItem[]]>
  totals: WorkbookTotals
  llmResult: LlmValuationResult | undefined
  multiple: number
}

export function computeWs2WorkbookExportModel(
  clientName: string,
  analysis: TtmAnalysisView,
  recast: Ws2RecastView,
): Ws2WorkbookExportModel {
  const ws2Report = buildWS2ReportAdapter(clientName, analysis, recast, analysis.derivedReports ?? [])
  const years = analysis.annualModel?.years ?? []
  const periods = buildWorkbookPeriods(analysis)
  const addBackItems = parseWorkbookAddBackItems(ws2Report, recast)
  const llmResult = readLlmResult(recast)
  const multiple = recast.assumptions?.multipleMid ?? 0
  const totals = computeWorkbookTotalsExport({ addBackItems, analysis, years, recast, multiple })
  const groupedItems = groupAddBackItems(addBackItems)
  return {
    clientName,
    analysis,
    recast,
    ws2Report,
    years,
    periods,
    addBackItems,
    groupedItems,
    totals,
    llmResult,
    multiple,
  }
}
