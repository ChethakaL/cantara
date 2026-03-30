import { getCategoryLabel, TAXONOMY_BY_CODE } from '@/lib/ttm-agent/taxonomy'
import type { AnnualModelYear, DataQualitySection, TtmAnalysisView, TtmFlagView, Ws2DerivedReportView, Ws2RecastView } from '@/lib/ttm-agent/types'
import { WS2Report, AddBackItem, DQFlag, GLMappingRow, PeriodCoverage, PLLine } from '@/lib/ws2/ws2-types'
import { buildStructuredWs2DerivedReport } from '@/lib/ws2/derived-report-structure'
import { applyWorkbookOverrideSnapshot, WorkbookOverrideSnapshot } from '@/lib/ttm-agent/workbook-overrides'

type MappedPlRow = {
  accountName: string
  accountCode: string | null
  cantaraCode: string | null
  valuesByMonth: Record<string, number>
  mappingMethod?: string
}

type ParsedScheduleItem = {
  index: string
  category: string
  description: string
  glReference: string
  ttmAmount: number
  fy3Amount: number | null
  fy2Amount: number | null
  fy1Amount: number | null
  status: string
  sourcePeriod: string | null
  sourceAmount: number | null
}

function toPctDecimal(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value / 100 : 0
}

function yoy(prev: number, next: number) {
  return prev ? (next - prev) / Math.abs(prev) : 0
}

function asMappedRows(value: unknown) {
  return Array.isArray(value) ? value as MappedPlRow[] : []
}

function monthKeysFromRows(rows: Array<{ valuesByMonth: Record<string, number> }>) {
  return rows[0] ? Object.keys(rows[0].valuesByMonth).sort() : []
}

function normalizeMonthRef(value: string | null | undefined) {
  if (!value) return null
  if (/^\d{4}-\d{2}$/.test(value)) return value
  const match = value.match(/^(\d{4}-\d{2})/)
  return match ? match[1] : null
}

function monthsBetween(start: string | null | undefined, end: string | null | undefined) {
  const normalizedStart = normalizeMonthRef(start)
  const normalizedEnd = normalizeMonthRef(end)
  if (!normalizedStart || !normalizedEnd) return []

  const result: string[] = []
  let [year, month] = normalizedStart.split('-').map(Number)
  const [endYear, endMonth] = normalizedEnd.split('-').map(Number)

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(endYear) || !Number.isFinite(endMonth)) {
    return []
  }

  while (year < endYear || (year === endYear && month <= endMonth)) {
    result.push(`${year}-${String(month).padStart(2, '0')}`)
    month += 1
    if (month === 13) {
      month = 1
      year += 1
    }
  }

  return result
}

function sumRowMonths(valuesByMonth: Record<string, number>, months: string[]) {
  return months.reduce((sum, month) => sum + (valuesByMonth[month] ?? 0), 0)
}

function buildCoverage(analysis: TtmAnalysisView): PeriodCoverage {
  const years = analysis.annualModel?.years ?? []
  const [fy1, fy2, fy3] = years
  const yearLabel = (year: AnnualModelYear | undefined, fallback: string) =>
    year?.periodStart?.slice(0, 4) ? `FY ${year.periodStart.slice(0, 4)}` : fallback
  return {
    fy1Label: yearLabel(fy1, 'FY 1'),
    fy1Range: fy1 ? `${fy1.periodStart} — ${fy1.periodEnd}` : '—',
    fy2Label: yearLabel(fy2, 'FY 2'),
    fy2Range: fy2 ? `${fy2.periodStart} — ${fy2.periodEnd}` : '—',
    fy3Label: yearLabel(fy3, 'FY 3'),
    fy3Range: fy3 ? `${fy3.periodStart} — ${fy3.periodEnd}` : '—',
    ttmLabel: analysis.ttmSummary?.startMonth && analysis.ttmSummary?.endMonth ? `${analysis.ttmSummary.startMonth} — ${analysis.ttmSummary.endMonth}` : 'TTM',
    confidence: analysis.structuredModel?.confidence ?? 'MEDIUM',
  }
}

function buildCategoryLines(args: {
  codes: string[]
  years: AnnualModelYear[]
  ttmRows: Array<{ code: string; category: string; value: number }>
}) {
  return args.codes
    .map<PLLine>((code) => ({
      label: getCategoryLabel(code),
      cantaraCode: code,
      fy1: args.years[0]?.['revenueByCategory'].find?.(() => false) ? 0 : 0,
      fy2: 0,
      fy3: 0,
      ttm: 0,
    }))
    .map((line) => {
      const readYearValue = (year: AnnualModelYear | undefined) => {
        const pools = [year?.revenueByCategory ?? [], year?.cogsByCategory ?? [], year?.opExByCategory ?? []]
        return pools.flat().find((row) => row.code === line.cantaraCode)?.value ?? 0
      }
      const ttmValue = args.ttmRows.find((row) => row.code === line.cantaraCode)?.value ?? 0
      return {
        ...line,
        fy1: readYearValue(args.years[0]),
        fy2: readYearValue(args.years[1]),
        fy3: readYearValue(args.years[2]),
        ttm: ttmValue,
      }
    })
    .filter((line) => line.fy1 !== 0 || line.fy2 !== 0 || line.fy3 !== 0 || line.ttm !== 0)
}

function parseCurrency(raw: string | null | undefined) {
  if (!raw) return null
  const normalized = raw.replace(/\$/g, '').replace(/,/g, '').replace(/^\((.*)\)$/, '-$1')
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

function normalizeDescriptionKey(value: string | null | undefined) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function parsePeriodReference(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed
  const monthYear = trimmed.match(/([A-Za-z]{3,9})[\s-]+(\d{4})/)
  if (monthYear) {
    const parsed = new Date(`${monthYear[1]} 1, ${monthYear[2]}`)
    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`
    }
  }
  const yearOnly = trimmed.match(/\b(20\d{2})\b/)
  return yearOnly ? `${yearOnly[1]}-01` : null
}

function parseCategoryPeriodItems(reportMarkdown: string, heading: string) {
  const sectionMatch = reportMarkdown.match(new RegExp(`## ${heading}([\\s\\S]*?)(?=\\n## |$)`, 'i'))
  if (!sectionMatch) return [] as Array<{ description: string; sourcePeriod: string | null; amount: number | null; glReference: string | null }>

  return Array.from(sectionMatch[1].matchAll(/\*\*Item\s+\d+:[^\n]*\*\*[\s\S]*?(?=(?:\n\*\*Item\s+\d+:)|$)/g)).map((match) => {
    const block = match[0]
    const description = (block.match(/- Description:\s*([^\n]+)/i)?.[1] ?? '').trim()
    const sourcePeriod = parsePeriodReference(block.match(/- Year:\s*([^\n]+)/i)?.[1] ?? null)
    const amount = parseCurrency(block.match(/- Amount:\s*(\$[0-9,().-]+)/i)?.[1] ?? null)
    const glReference = (block.match(/- GL Account:\s*.*?\(([^)]+)\)/i)?.[1] ?? block.match(/- GL Account:\s*([^\n]+)/i)?.[1] ?? '').trim()
    return {
      description,
      sourcePeriod,
      amount,
      glReference: glReference || null,
    }
  })
}

function parseRecastScheduleRows(reportMarkdown: string | null | undefined): ParsedScheduleItem[] {
  if (!reportMarkdown) return []
  // Match multi-year format (9 columns: # | Category | Item Description | GL Reference | LTM | FY3 | FY2 | FY1 | Status)
  const multiYearMatch = reportMarkdown.match(/## EBITDA RECAST SCHEDULE[\s\S]*?\n(\|[^\n]*#[^\n]*Category[^\n]*LTM[^\n]*FY3[^\n]*FY2[^\n]*FY1[^\n]*Status[^\n]*\|[\s\S]*?)(?:\n## FLAG LIST|$)/i)
  // Fall back to legacy format
  const legacyMatch = reportMarkdown.match(/## EBITDA RECAST SCHEDULE[\s\S]*?\n(\| # \| Category \| Item Description \| GL Reference \| TTM Amount \| Status \|[\s\S]*?)(?:\n\*\*3-Year Normalized EBITDA Summary:|\n## FLAG LIST FOR ADMIN REVIEW|$)/i)
  const match = multiYearMatch ?? legacyMatch
  const isMultiYear = Boolean(multiYearMatch)
  if (!match) return []

  const category3Items = parseCategoryPeriodItems(reportMarkdown, 'CATEGORY 3: ONE-OFF NON-RECURRING EXPENSES')
  const category4Items = parseCategoryPeriodItems(reportMarkdown, 'CATEGORY 4: TENANT IMPROVEMENT ADD-BACKS')
  const periodByDescription = new Map<string, string | null>()
  const amountByDescription = new Map<string, number | null>()

  for (const item of [...category3Items, ...category4Items]) {
    periodByDescription.set(normalizeDescriptionKey(item.description), item.sourcePeriod)
    amountByDescription.set(normalizeDescriptionKey(item.description), item.amount)
  }

  return match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'))
    .filter((line) => !/^\|\s*-+/.test(line))
    .map((line) => line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim().replace(/\*\*/g, '')))
    .filter((cells) => cells.length >= 6 && cells[0] !== '#' && cells[1] !== 'Category')
    .map((cells) => {
      if (isMultiYear && cells.length >= 9) {
        return {
          index: cells[0],
          category: cells[1],
          description: cells[2],
          glReference: cells[3],
          ttmAmount: parseCurrency(cells[4]) ?? 0,
          fy3Amount: parseCurrency(cells[5]),
          fy2Amount: parseCurrency(cells[6]),
          fy1Amount: parseCurrency(cells[7]),
          status: cells[8] || 'CALCULATED',
          sourcePeriod: periodByDescription.get(normalizeDescriptionKey(cells[2])) ?? null,
          sourceAmount: amountByDescription.get(normalizeDescriptionKey(cells[2])) ?? null,
        }
      }
      return {
        index: cells[0],
        category: cells[1],
        description: cells[2],
        glReference: cells[3],
        ttmAmount: parseCurrency(cells[4]) ?? 0,
        fy3Amount: null,
        fy2Amount: null,
        fy1Amount: null,
        status: cells[5] || 'CALCULATED',
        sourcePeriod: periodByDescription.get(normalizeDescriptionKey(cells[2])) ?? null,
        sourceAmount: amountByDescription.get(normalizeDescriptionKey(cells[2])) ?? null,
      }
    })
    .filter((item) =>
      item.index !== '—' &&
      !/TOTAL ADD-BACKS|NORMALIZED \/ RECAST EBITDA|NORMALIZED EBITDA MARGIN|Multiple|Valuation|Revenue|Net Income/i.test(item.description) &&
      !/TOTAL ADD-BACKS|NORMALIZED \/ RECAST EBITDA|NORMALIZED EBITDA MARGIN|Multiple|Valuation/i.test(item.category),
    )
}

function sumGlForMonths(rows: MappedPlRow[], glCode: string, months: string[]) {
  return rows
    .filter((row) => row.accountCode === glCode)
    .reduce((sum, row) => sum + sumRowMonths(row.valuesByMonth, months), 0)
}

function toAddBackCategory(category: string): AddBackItem['category'] {
  if (/Owner Compensation/i.test(category)) return 1
  if (/Personal Expenses/i.test(category)) return 2
  if (/One-Off Expenses/i.test(category)) return 3
  if (/TI Add-Backs/i.test(category)) return 4
  return 5
}

function buildRecastSchedule(
  reportMarkdown: string | null | undefined,
  mappedPlRows: MappedPlRow[],
  annualYears: AnnualModelYear[],
  ttmMonths: string[],
  replacementSalary: number,
) {
  const parsedItems = parseRecastScheduleRows(reportMarkdown)
  if (parsedItems.length === 0) return []

  const fyMonths = annualYears.map((year) => monthsBetween(year.periodStart, year.periodEnd))

  const periodAmount = (item: ParsedScheduleItem, months: string[], yearIndex: number | null) => {
    if (/Replacement.*Salary/i.test(item.description)) {
      // LTM uses $0 per Cantara methodology; prior years use -$20K default or Craig's input
      if (yearIndex === null) return 0 // TTM/LTM
      const priorYearSalary = replacementSalary > 0 ? replacementSalary : 20000
      return -((priorYearSalary * months.length) / 12)
    }
    if (/Employer FICA on owner wages/i.test(item.description)) {
      return sumGlForMonths(mappedPlRows, '6020', months) * 0.0765
    }
    if (/One-Off Expenses|TI Add-Backs/i.test(item.category)) {
      // If we have parsed per-year amounts, use them directly
      if (yearIndex === 0 && item.fy1Amount !== null) return item.fy1Amount
      if (yearIndex === 1 && item.fy2Amount !== null) return item.fy2Amount
      if (yearIndex === 2 && item.fy3Amount !== null) return item.fy3Amount
      if (!item.sourcePeriod) return item.ttmAmount
      return months.includes(item.sourcePeriod) ? (item.sourceAmount ?? item.ttmAmount) : 0
    }
    if (/^\d+$/.test(item.glReference)) {
      return sumGlForMonths(mappedPlRows, item.glReference, months)
    }
    // If we have parsed per-year amounts from multi-year prompt output, use them
    if (yearIndex === 0 && item.fy1Amount !== null) return item.fy1Amount
    if (yearIndex === 1 && item.fy2Amount !== null) return item.fy2Amount
    if (yearIndex === 2 && item.fy3Amount !== null) return item.fy3Amount
    return item.ttmAmount
  }

  return parsedItems.map<AddBackItem>((item) => {
    const ttmAmount = periodAmount(item, ttmMonths, null)
    const fy1Amount = periodAmount(item, fyMonths[0] ?? [], 0)
    const fy2Amount = periodAmount(item, fyMonths[1] ?? [], 1)
    const fy3Amount = periodAmount(item, fyMonths[2] ?? [], 2)
    const outOfPeriod = (/One-Off Expenses|TI Add-Backs/i.test(item.category) && item.sourcePeriod && !ttmMonths.includes(item.sourcePeriod) && ttmAmount === 0)
    const status = outOfPeriod && !/OUT-OF-PERIOD FOR TTM/i.test(item.status) ? `${item.status} · OUT-OF-PERIOD FOR TTM` : item.status
    return {
      id: item.index,
      category: toAddBackCategory(item.category),
      description: item.description,
      glCode: item.glReference === '—' ? undefined : item.glReference,
      glAccount: item.glReference === '—' ? undefined : item.glReference,
      ttmAmount,
      fy1Amount,
      fy2Amount,
      fy3Amount,
      status: (status || 'CALCULATED') as AddBackItem['status'],
    }
  })
}

function mapFlags(flags: TtmFlagView[]): DQFlag[] {
  return flags.map((flag) => ({
    section: flag.section,
    severity: flag.severity === 'INFO' ? 'LOW' : flag.severity,
    title: flag.title,
    description: flag.description || '',
    resolution: flag.resolutionNotes || undefined,
    resolved: flag.resolutionStatus === 'ACTIONED',
  }))
}

function mapGlClassificationRequests(analysis: TtmAnalysisView): GLMappingRow[] {
  const mappedPlRows = asMappedRows(analysis.normalizedData?.mappedPlRows)
  const mappedBsRows = asMappedRows(analysis.normalizedData?.mappedBsRows)
  return [...mappedPlRows, ...mappedBsRows]
    .filter((row) => row.accountCode)
    .map((row) => ({
      accountName: row.accountName,
      glCode: row.accountCode ?? '—',
      cantaraCode: row.cantaraCode ?? 'UNMAPPED',
      status:
        row.cantaraCode
          ? row.mappingMethod === 'claude' || row.mappingMethod === 'fuzzy'
            ? 'FLAGGED-AMBIGUOUS'
            : 'AUTO-MAPPED'
          : 'UNMAPPED',
    }))
}

function mapAccountantDiscrepancies(analysis: TtmAnalysisView) {
  const sectionC = analysis.dataQualityReport?.sections.C?.items ?? []
  return sectionC.map((item) => ({
    fiscalYear: String(item.payload.fiscalYear ?? '—'),
    lineItem: String(item.payload.lineItem ?? item.title),
    rollup: Number(item.payload.monthlyRollup ?? item.payload.actual ?? 0),
    accountant: Number(item.payload.accountantStatement ?? item.payload.expected ?? 0),
    varianceDollar: Number(item.payload.variance ?? 0),
    variancePct: toPctDecimal(Number(item.payload.variancePct ?? 0)),
  }))
}

function mapWorkingCapital(analysis: TtmAnalysisView) {
  const wc = analysis.workingCapital
  const byCode = Object.fromEntries((wc?.currentAssets ?? []).concat(wc?.currentLiabilities ?? []).map((row) => [row.code, row.value])) as Record<string, number>
  const rounded61To90 = Math.round(wc?.arAging.days61To90 ?? 0)
  const rounded90Plus = Math.round(wc?.arAging.days90Plus ?? 0)
  const looksLikeLegacyBucketShift = rounded90Plus === 0 && (wc?.arAging.days61To90 ?? 0) % 1 !== 0 && rounded61To90 > 0
  const ar61To90 = looksLikeLegacyBucketShift ? 0 : rounded61To90
  const ar90Plus = looksLikeLegacyBucketShift ? rounded61To90 : rounded90Plus
  return {
    asOfDate: wc?.month ?? 'Current',
    cash: Math.round(byCode['WC-CASH'] ?? 0),
    accountsReceivable: Math.round(byCode['WC-AR'] ?? 0),
    inventory: Math.round(byCode['WC-INV'] ?? 0),
    prepaidExpenses: Math.round(byCode['WC-PREPAID'] ?? 0),
    totalCurrentAssets: Math.round(wc?.totalCurrentAssets ?? 0),
    accountsPayable: Math.round(byCode['WC-AP'] ?? 0),
    accruedLiabilities: Math.round(byCode['WC-ACCR'] ?? 0),
    deferredRevenue: Math.round(byCode['WC-DREV'] ?? 0),
    totalCurrentLiabilities: Math.round(wc?.totalCurrentLiabilities ?? 0),
    netWorkingCapital: Math.round(wc?.netWorkingCapital ?? 0),
    trailingThreeMonthAvgNWC: Math.round(wc?.trailingThreeMonthAverageNwc ?? 0),
    arAgingBuckets: {
      current: Math.round(wc?.arAging.current ?? 0),
      days1to30: Math.round(wc?.arAging.days1To30 ?? 0),
      days31to60: Math.round(wc?.arAging.days31To60 ?? 0),
      days61to90: ar61To90,
      days90plus: ar90Plus,
      total: Math.round(wc?.arAging.totalAr ?? 0),
    },
    arVarianceToBalanceSheet: Math.round(wc?.arAging.varianceToBalanceSheetAr ?? 0),
  }
}

export function buildWS2ReportAdapter(
  clientName: string,
  analysis: TtmAnalysisView,
  recast: Ws2RecastView | null,
  derivedReports: Ws2DerivedReportView[]
): WS2Report {
  const years = analysis.annualModel?.years ?? []
  const sum = analysis.ttmSummary
  const mappedPlRows = asMappedRows(analysis.normalizedData?.mappedPlRows)
  const plMonthKeys = monthKeysFromRows(mappedPlRows)
  const ttmMonths = plMonthKeys.slice(-12)

  const revenueCodes = Object.values(TAXONOMY_BY_CODE).filter((row) => row.type === 'revenue').map((row) => row.code)
  const cogsCodes = Object.values(TAXONOMY_BY_CODE).filter((row) => row.type === 'cogs').map((row) => row.code)
  const opexCodes = Object.values(TAXONOMY_BY_CODE).filter((row) => row.type === 'opex').map((row) => row.code)

  const revenueLines = buildCategoryLines({ codes: revenueCodes, years, ttmRows: sum?.revenueByCategory ?? [] })
  const cogsLines = buildCategoryLines({ codes: cogsCodes, years, ttmRows: sum?.cogsByCategory ?? [] })
  const expenseLines = buildCategoryLines({ codes: opexCodes, years, ttmRows: sum?.opExByCategory ?? [] }).map((line) => ({
    ...line,
    excludedFromEbitda: line.cantaraCode === 'OPX-DEPR' || line.cantaraCode === 'OPX-INT',
  }))

  const ws21 = {
    status: analysis.status as any,
    runId: String(analysis.version),
    generatedAt: analysis.createdAt,
    approvedAt: analysis.approvedAt ?? undefined,
    approvedBy: analysis.approvedByName ?? undefined,
    glMapping: mapGlClassificationRequests(analysis),
    annualPL: {
      periodCoverage: buildCoverage(analysis),
      revenueLines,
      cogsLines,
      expenseLines,
      totalRevenue: {
        fy1: years[0]?.totalRevenue ?? 0,
        fy2: years[1]?.totalRevenue ?? 0,
        fy3: years[2]?.totalRevenue ?? 0,
        ttm: sum?.totalRevenue ?? 0,
      },
      totalCogs: {
        fy1: years[0]?.totalCogs ?? 0,
        fy2: years[1]?.totalCogs ?? 0,
        fy3: years[2]?.totalCogs ?? 0,
        ttm: sum?.totalCogs ?? 0,
      },
      grossProfit: {
        fy1: years[0]?.grossProfit ?? 0,
        fy2: years[1]?.grossProfit ?? 0,
        fy3: years[2]?.grossProfit ?? 0,
        ttm: sum?.grossProfit ?? 0,
      },
      grossMargin: {
        fy1: toPctDecimal(years[0]?.grossMarginPct),
        fy2: toPctDecimal(years[1]?.grossMarginPct),
        fy3: toPctDecimal(years[2]?.grossMarginPct),
        ttm: toPctDecimal(sum?.grossMarginPct),
      },
      totalOpex: {
        fy1: years[0]?.totalOpEx ?? 0,
        fy2: years[1]?.totalOpEx ?? 0,
        fy3: years[2]?.totalOpEx ?? 0,
        ttm: sum?.totalOpEx ?? 0,
      },
      ebitdaPreRecast: {
        fy1: years[0]?.ebitdaPreRecast ?? 0,
        fy2: years[1]?.ebitdaPreRecast ?? 0,
        fy3: years[2]?.ebitdaPreRecast ?? 0,
        ttm: sum?.ebitdaPreRecast ?? 0,
      },
      ebitdaMargin: {
        fy1: toPctDecimal(years[0]?.totalRevenue ? (years[0].ebitdaPreRecast / years[0].totalRevenue) * 100 : null),
        fy2: toPctDecimal(years[1]?.totalRevenue ? (years[1].ebitdaPreRecast / years[1].totalRevenue) * 100 : null),
        fy3: toPctDecimal(years[2]?.totalRevenue ? (years[2].ebitdaPreRecast / years[2].totalRevenue) * 100 : null),
        ttm: toPctDecimal(sum?.ebitdaMarginPct),
      },
      yoyRevenueGrowth: {
        fy1toFy2: years[0] && years[1] ? yoy(years[0].totalRevenue, years[1].totalRevenue) : 0,
        fy2toFy3: years[1] && years[2] ? yoy(years[1].totalRevenue, years[2].totalRevenue) : 0,
      },
      netIncome: {
        fy1: years[0]?.netIncome ?? 0,
        fy2: years[1]?.netIncome ?? 0,
        fy3: years[2]?.netIncome ?? 0,
        ttm: years[2]?.netIncome ?? 0,
      },
    },
    workingCapital: mapWorkingCapital(analysis),
    dataQuality: {
      flags: mapFlags(analysis.flags),
      totalFlags: analysis.flags.length,
      resolvedFlags: analysis.flags.filter((flag) => flag.resolutionStatus === 'ACTIONED').length,
      sectionCounts: analysis.dataQualityReport?.counts ?? {},
      glClassificationRequests: mapGlClassificationRequests(analysis).filter((row) => row.status !== 'AUTO-MAPPED'),
      accountantDiscrepancies: mapAccountantDiscrepancies(analysis),
    },
    summaryText: analysis.summary?.overview ?? 'Summary Generated',
  }

  const replacementSalary = recast?.assumptions?.replacementSalary ?? 0
  console.log('[WS2-DEBUG] reportMarkdown present:', !!recast?.reportMarkdown, 'length:', recast?.reportMarkdown?.length ?? 0)
  const addBackItems = buildRecastSchedule(recast?.reportMarkdown, mappedPlRows, years, ttmMonths, replacementSalary)
  console.log('[WS2-DEBUG] addBackItems count:', addBackItems.length, addBackItems.map(i => i.description))
  const ttmRevenue = sum?.totalRevenue ?? 0
  const totalAddBacksFY1 = addBackItems.reduce((acc, item) => acc + (item.fy1Amount ?? 0), 0)
  const totalAddBacksFY2 = addBackItems.reduce((acc, item) => acc + (item.fy2Amount ?? 0), 0)
  const totalAddBacksFY3 = addBackItems.reduce((acc, item) => acc + (item.fy3Amount ?? 0), 0)
  const normalizedEbitdaFY1 = (years[0]?.ebitdaPreRecast ?? 0) + totalAddBacksFY1
  const normalizedEbitdaFY2 = (years[1]?.ebitdaPreRecast ?? 0) + totalAddBacksFY2
  const normalizedEbitdaFY3 = (years[2]?.ebitdaPreRecast ?? 0) + totalAddBacksFY3
  const midMultiple = recast?.assumptions?.multipleMid ?? 0

  // Build per-year valuation data
  const byYear = years.map((year, i) => {
    const normEbitda = i === 0 ? normalizedEbitdaFY1 : i === 1 ? normalizedEbitdaFY2 : normalizedEbitdaFY3
    return {
      fiscalYear: year.fiscalYear ?? year.periodStart?.slice(0, 4) ?? `FY${i + 1}`,
      normalizedEbitda: normEbitda,
      margin: year.totalRevenue ? normEbitda / year.totalRevenue : null,
      valuationMid: normEbitda * midMultiple,
    }
  })

  const ws22 = recast ? {
    status: recast.status as any,
    runId: String(recast.version),
    generatedAt: recast.createdAt,
    approvedAt: recast.approvedAt ?? undefined,
    recastSchedule: {
      ttmEbitdaPreRecast: sum?.ebitdaPreRecast ?? 0,
      addBackItems,
      totalAddBacks: addBackItems.reduce((acc, item) => acc + item.ttmAmount, 0),
      normalizedEbitdaTTM: recast.normalizedEbitda ?? 0,
      normalizedEbitdaFY3,
      normalizedEbitdaFY2,
      normalizedEbitdaFY1,
      normalizedMarginTTM: recast.normalizedEbitda && ttmRevenue ? recast.normalizedEbitda / ttmRevenue : 0,
      totalAddBacksFY3,
      totalAddBacksFY2,
      totalAddBacksFY1,
      flagsForCraig: recast.flags.map((flag) => ({
        itemId: flag.id,
        issue: flag.title,
        dollarImpact: Number(flag.overrideAmount ?? flag.payload.dollarImpact ?? 0),
      })),
    },
    valuation: {
      normalizedEbitda: recast.normalizedEbitda ?? 0,
      multipleAssumptions: {
        low: recast.assumptions.multipleLow ?? 0,
        mid: recast.assumptions.multipleMid ?? 0,
        high: recast.assumptions.multipleHigh ?? 0,
      },
      valuationLow: recast.valuationLow ?? 0,
      valuationMid: recast.valuationMid ?? 0,
      valuationHigh: recast.valuationHigh ?? 0,
      revenueMultipleLow: ttmRevenue ? (recast.valuationLow ?? 0) / ttmRevenue : 0,
      revenueMultipleMid: ttmRevenue ? (recast.valuationMid ?? 0) / ttmRevenue : 0,
      revenueMultipleHigh: ttmRevenue ? (recast.valuationHigh ?? 0) / ttmRevenue : 0,
      replacementSalary: recast.assumptions.replacementSalary ?? 0,
      replacementSalaryIsDefault: recast.assumptions.replacementSalary == null,
      relatedPartyOwnership: Boolean(recast.assumptions.relatedPartyOwnership),
      byYear,
      fmrAdjustment: recast.assumptions.relatedPartyOwnership && recast.assumptions.fmrEstimate != null
        ? recast.assumptions.fmrEstimate - mappedPlRows.filter((row) => ['OPX-RENT', 'OPX-RENT-NNN'].includes(row.cantaraCode ?? '')).reduce((sumRent, row) => sumRent + sumRowMonths(row.valuesByMonth, plMonthKeys.slice(-12)), 0)
        : undefined,
    },
    craigInputs: {
      multipleRangeLow: recast.assumptions.multipleLow ?? 0,
      multipleRangeMid: recast.assumptions.multipleMid ?? 0,
      multipleRangeHigh: recast.assumptions.multipleHigh ?? 0,
      replacementSalary: recast.assumptions.replacementSalary ?? 0,
      relatedPartyOwnership: Boolean(recast.assumptions.relatedPartyOwnership),
      fmrEstimate: recast.assumptions.fmrEstimate ?? undefined,
      enteredAt: recast.createdAt,
    },
  } : undefined

  const derived23 = derivedReports.find((row) => String(row.agentId).includes('ws2_3'))
  const derived24 = derivedReports.find((row) => String(row.agentId).includes('ws2_4'))
  const derived25 = derivedReports.find((row) => String(row.agentId).includes('ws2_5'))
  const ws23Data = (derived23?.parsedReport ?? buildStructuredWs2DerivedReport({ agentId: 'ws2_3_rev_vertical_v1', analysis, recast }) ?? {}) as any
  const ws24Data = (derived24?.parsedReport ?? buildStructuredWs2DerivedReport({ agentId: 'ws2_4_benchmark_v1', analysis, recast }) ?? {}) as any
  const ws25Data = (derived25?.parsedReport ?? buildStructuredWs2DerivedReport({ agentId: 'ws2_5_labor_v1', analysis, recast }) ?? {}) as any

  const report: WS2Report = {
    clientName,
    clientId: analysis.clientId,
    engagementId: analysis.id,
    reportGeneratedAt: analysis.createdAt,
    ws21,
    ws22,
    ws23: derived23 ? {
      status: derived23.status as any,
      generatedAt: derived23.createdAt,
      verticals: ws23Data.verticals ?? [],
      boardingPlusDaycareConcentration: ws23Data.boardingPlusDaycareConcentration ?? { fy1: 0, fy2: 0, fy3: 0, ttm: 0 },
      concentrationFlags: ws23Data.concentrationFlags ?? [],
      unmappedRevenue: ws23Data.unmappedRevenue ?? [],
      businessModelFlag: ws23Data.businessModelFlag,
    } : undefined,
    ws24: derived24 ? {
      status: derived24.status as any,
      generatedAt: derived24.createdAt,
      benchmarks: ws24Data.benchmarks ?? [],
      overallHealth: ws24Data.overallHealth ?? 'GREEN',
      overallHealthNote: ws24Data.overallHealthNote ?? '',
      improvementOpportunities: ws24Data.improvementOpportunities ?? [],
    } : undefined,
    ws25: derived25 ? {
      status: derived25.status as any,
      generatedAt: derived25.createdAt,
      laborRows: ws25Data.laborRows ?? [],
      directLaborPct: ws25Data.directLaborPct ?? 0,
      buyerAdjustedLaborPct: ws25Data.buyerAdjustedLaborPct ?? 0,
      benchmarkStatus: ws25Data.benchmarkStatus ?? 'GREEN',
      benchmarkNote: ws25Data.benchmarkNote ?? '',
      ownerWeeklyHours: ws25Data.ownerWeeklyHours,
      ownerInvolvementFlag: ws25Data.ownerInvolvementFlag,
      trendAssessment: ws25Data.trendAssessment ?? 'GREEN',
      trendNote: ws25Data.trendNote ?? '',
      flags: ws25Data.flags ?? [],
    } : undefined,
    rawAnalysis: analysis,
    rawRecast: recast,
    rawDerivedReports: derivedReports,
  }

  const baseline = derivedReports.find((row) => String(row.agentId).includes('ws2_10_report_generator_v1'))
  const workbookOverrideSnapshot = (baseline?.parsedReport as Record<string, unknown> | null | undefined)?.workbookOverrideSnapshot as
    | WorkbookOverrideSnapshot
    | undefined

  return applyWorkbookOverrideSnapshot(report, workbookOverrideSnapshot)
}
