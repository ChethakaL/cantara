import { getCategoryLabel, TAXONOMY_BY_CODE } from '@/lib/ttm-agent/taxonomy'
import type { AnnualModelYear, DataQualitySection, TtmAnalysisView, TtmFlagView, Ws2DerivedReportView, Ws2RecastView } from '@/lib/ttm-agent/types'
import { WS2Report, AddBackItem, DQFlag, GLMappingRow, PeriodCoverage, PLLine } from '@/lib/ws2/ws2-types'
import { buildStructuredWs2DerivedReport } from '@/lib/ws2/derived-report-structure'

function toPctDecimal(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value / 100 : 0
}

function yoy(prev: number, next: number) {
  return prev ? (next - prev) / Math.abs(prev) : 0
}

function asMappedRows(value: unknown) {
  return Array.isArray(value) ? value as Array<{
    accountName: string
    accountCode: string | null
    cantaraCode: string | null
    valuesByMonth: Record<string, number>
    mappingMethod?: string
  }> : []
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
  return {
    fy1Label: fy1?.fiscalYear ? `FY ${fy1.fiscalYear}` : 'FY 1',
    fy1Range: fy1 ? `${fy1.periodStart} — ${fy1.periodEnd}` : '—',
    fy2Label: fy2?.fiscalYear ? `FY ${fy2.fiscalYear}` : 'FY 2',
    fy2Range: fy2 ? `${fy2.periodStart} — ${fy2.periodEnd}` : '—',
    fy3Label: fy3?.fiscalYear ? `FY ${fy3.fiscalYear}` : 'FY 3',
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

function parseRecastSchedule(reportMarkdown: string | null | undefined): AddBackItem[] {
  if (!reportMarkdown) return []

  const match = reportMarkdown.match(/## EBITDA RECAST SCHEDULE[\s\S]*?\n(\| # \| Category \| Item Description \| GL Reference \| TTM Amount \| Status \|[\s\S]*?)(?:\n\*\*3-Year Normalized EBITDA Summary:|\n## FLAG LIST FOR ADMIN REVIEW|$)/i)
  if (!match) return []

  const categoryMap: Record<string, AddBackItem['category']> = {
    'Owner / Officer Compensation': 1,
    'Personal Expenses': 2,
    'One-Off Expenses': 3,
    'TI Add-Backs': 4,
    'Fair Market Rent': 5,
  }

  const parseAmount = (raw: string) => {
    const normalized = raw.replace(/\$/g, '').replace(/,/g, '').replace(/^\((.*)\)$/, '-$1')
    const value = Number(normalized)
    return Number.isFinite(value) ? value : 0
  }

  return match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'))
    .filter((line) => !/^\|\s*-+/.test(line))
    .map((line) => line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim().replace(/\*\*/g, '')))
    .filter((cells) => cells.length >= 6 && cells[0] !== '#' && cells[1] !== 'Category')
    .filter((cells) => !/TOTAL ADD-BACKS|NORMALIZED \/ RECAST EBITDA|NORMALIZED EBITDA MARGIN/i.test(cells[2]))
    .map<AddBackItem>((cells) => ({
      id: cells[0],
      category: categoryMap[cells[1]] ?? 3,
      description: cells[2],
      glCode: cells[3] === '—' ? undefined : cells[3],
      glAccount: cells[3] === '—' ? undefined : cells[3],
      ttmAmount: parseAmount(cells[4]),
      status: (cells[5] || 'CALCULATED') as AddBackItem['status'],
    }))
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
  return [...mappedPlRows, ...mappedBsRows].map((row) => ({
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
  return {
    asOfDate: wc?.month ?? 'Current',
    cash: byCode['WC-CASH'] ?? 0,
    accountsReceivable: byCode['WC-AR'] ?? 0,
    inventory: byCode['WC-INV'] ?? 0,
    prepaidExpenses: byCode['WC-PREPAID'] ?? 0,
    totalCurrentAssets: wc?.totalCurrentAssets ?? 0,
    accountsPayable: byCode['WC-AP'] ?? 0,
    accruedLiabilities: byCode['WC-ACCR'] ?? 0,
    deferredRevenue: byCode['WC-DREV'] ?? 0,
    totalCurrentLiabilities: wc?.totalCurrentLiabilities ?? 0,
    netWorkingCapital: wc?.netWorkingCapital ?? 0,
    trailingThreeMonthAvgNWC: wc?.trailingThreeMonthAverageNwc ?? 0,
    arAgingBuckets: {
      current: wc?.arAging.current ?? 0,
      days1to30: wc?.arAging.days1To30 ?? 0,
      days31to60: wc?.arAging.days31To60 ?? 0,
      days61to90: wc?.arAging.days61To90 ?? 0,
      days90plus: wc?.arAging.days90Plus ?? 0,
      total: wc?.arAging.totalAr ?? 0,
    },
    arVarianceToBalanceSheet: wc?.arAging.varianceToBalanceSheetAr ?? 0,
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
  const fyMonths = years.map((year) => monthsBetween(year.periodStart, year.periodEnd))

  const revenueCodes = Object.values(TAXONOMY_BY_CODE).filter((row) => row.type === 'revenue' && row.code !== 'REV-DISC').map((row) => row.code)
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

  const addBackItems = parseRecastSchedule(recast?.reportMarkdown)
  const ttmRevenue = sum?.totalRevenue ?? 0
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
      normalizedMarginTTM: recast.normalizedEbitda && ttmRevenue ? recast.normalizedEbitda / ttmRevenue : 0,
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
      replacementSalary: recast.assumptions.replacementSalary ?? 65000,
      replacementSalaryIsDefault: recast.assumptions.replacementSalary == null,
      relatedPartyOwnership: Boolean(recast.assumptions.relatedPartyOwnership),
      fmrAdjustment: recast.assumptions.relatedPartyOwnership && recast.assumptions.fmrEstimate != null
        ? recast.assumptions.fmrEstimate - mappedPlRows.filter((row) => ['OPX-RENT', 'OPX-RENT-NNN'].includes(row.cantaraCode ?? '')).reduce((sumRent, row) => sumRent + sumRowMonths(row.valuesByMonth, plMonthKeys.slice(-12)), 0)
        : undefined,
    },
    craigInputs: {
      multipleRangeLow: recast.assumptions.multipleLow ?? 0,
      multipleRangeMid: recast.assumptions.multipleMid ?? 0,
      multipleRangeHigh: recast.assumptions.multipleHigh ?? 0,
      replacementSalary: recast.assumptions.replacementSalary ?? 65000,
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

  return {
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
}
