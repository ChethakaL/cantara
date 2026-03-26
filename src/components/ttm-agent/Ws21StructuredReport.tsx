'use client'

import { Badge, Card } from '@/components/ui'
import { TAXONOMY_BY_CODE } from '@/lib/ttm-agent/taxonomy'
import type { DataQualitySection, MappedLedgerRow, TtmAnalysisView } from '@/lib/ttm-agent/types'

function formatCurrency(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value)
    ? `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    : 'n/a'
}

function formatPct(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)}%` : 'n/a'
}

function monthLabel(value: string | null | undefined) {
  if (!value) return 'n/a'
  const [year, month] = value.split('-').map(Number)
  if (!year || !month) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(new Date(year, month - 1, 1))
}

function isMonthKey(value: string | null | undefined) {
  return typeof value === 'string' && /^\d{4}-\d{2}$/.test(value)
}

function titleCase(value: string | null | undefined) {
  if (!value) return 'n/a'
  return value.charAt(0) + value.slice(1).toLowerCase()
}

function asMappedRows(value: unknown) {
  return Array.isArray(value)
    ? (value as MappedLedgerRow[])
    : []
}

function mappingStatus(row: MappedLedgerRow) {
  if (!row.cantaraCode) return row.candidateCodes.length ? 'Needs review' : 'Unmapped'
  if (row.mappingMethod === 'claude' || row.mappingMethod === 'fuzzy') return 'Needs review'
  return 'Auto-mapped'
}

function mappingTone(row: MappedLedgerRow) {
  const status = mappingStatus(row)
  if (status === 'Auto-mapped') return 'green' as const
  if (status === 'Needs review') return 'gold' as const
  return 'red' as const
}

function cantaraLabel(code: string | null | undefined) {
  if (!code) return 'Not assigned'
  const entry = TAXONOMY_BY_CODE[code]
  return entry ? `${entry.code} · ${entry.category}` : code
}

function cantaraMeaning(code: string | null | undefined) {
  if (!code) return 'No Cantara category has been assigned yet.'
  const entry = TAXONOMY_BY_CODE[code]
  if (!entry) return 'Cantara meaning not available.'
  const aliases = entry.aliases.slice(0, 3).join(', ')
  return aliases ? `Usually used for ${aliases}.` : entry.category
}

function cleanSectionTitle(title: string) {
  return title.replace(/^Section [A-E] - /, '')
}

function qualityTone(status: 'clear' | 'issues' | 'skipped') {
  if (status === 'issues') return 'gold' as const
  if (status === 'skipped') return 'slate' as const
  return 'green' as const
}

function qualityStatusLabel(status: 'clear' | 'issues' | 'skipped', count: number) {
  if (status === 'issues') return `${count} ${count === 1 ? 'item' : 'items'}`
  if (status === 'skipped') return 'Skipped'
  return 'Clear'
}

export function Ws21StructuredReport({ analysis }: { analysis: TtmAnalysisView }) {
  const years = analysis.annualModel?.years ?? []
  const firstYear = years[0] ?? null
  const lastYear = years[years.length - 1] ?? null
  const hasAnnualCoverage = isMonthKey(firstYear?.periodStart) && isMonthKey(lastYear?.periodEnd)
  const coverageLabel = hasAnnualCoverage
    ? `${monthLabel(firstYear.periodStart)} to ${monthLabel(lastYear?.periodEnd)}`
    : analysis.ttmSummary
      ? `${monthLabel(analysis.ttmSummary.startMonth)} to ${monthLabel(analysis.ttmSummary.endMonth)}`
      : 'Coverage not available'
  const ttmLabel = analysis.ttmSummary
    ? `${monthLabel(analysis.ttmSummary.startMonth)} to ${monthLabel(analysis.ttmSummary.endMonth)}`
    : 'TTM not available'
  const mappedPlRows = asMappedRows(analysis.normalizedData?.mappedPlRows)
  const mappedBsRows = asMappedRows(analysis.normalizedData?.mappedBsRows)
  const mappingRows = [...mappedPlRows, ...mappedBsRows].sort((a, b) => a.accountName.localeCompare(b.accountName))
  const autoMappedCount = mappingRows.filter((row) => mappingStatus(row) === 'Auto-mapped').length
  const reviewMappingCount = mappingRows.filter((row) => mappingStatus(row) === 'Needs review').length
  const unmappedCount = mappingRows.filter((row) => mappingStatus(row) === 'Unmapped').length
  const qualitySections = (analysis.dataQualityReport?.sectionOrder ?? [])
    .map((section) => ({
      section,
      report: analysis.dataQualityReport?.sections[section],
      count: analysis.dataQualityReport?.counts[section] ?? 0,
    }))
    .filter((item): item is { section: DataQualitySection; report: NonNullable<TtmAnalysisView['dataQualityReport']>['sections'][DataQualitySection]; count: number } => Boolean(item.report))
  const qualityDetails = qualitySections.filter(({ report, count }) => count > 0 || report.status === 'skipped')

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-200">
        <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">WS2-1 financial analysis report</p>
          <h4 className="mt-2 text-xl font-semibold text-slate-900">Structured review summary</h4>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            This view organizes the WS2-1 model output into the core items a reviewer needs: coverage, financial snapshot, GL mapping, working capital, and data-quality review.
          </p>
        </div>

        <div className="px-5 py-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Dataset coverage</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{coverageLabel}</p>
              <p className="mt-1 text-xs text-slate-500">Available WS2-1 source period</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Fiscal years</p>
              <div className="mt-2 space-y-2">
                {years.length > 0 ? (
                  years.map((year) => (
                    <div key={year.fiscalYear} className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-sm font-semibold text-slate-900">{year.fiscalYear}</p>
                      {/* <p className="mt-1 text-xs text-slate-500">
                        {isMonthKey(year.periodStart) && isMonthKey(year.periodEnd)
                          ? `${monthLabel(year.periodStart)} to ${monthLabel(year.periodEnd)}`
                          : 'Date range not available'}
                      </p> */}
                    </div>
                  ))
                ) : (
                  <p className="text-sm font-semibold text-slate-900">TTM only</p>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">TTM period</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{ttmLabel}</p>
              <p className="mt-1 text-xs text-slate-500">Most recent 12 months</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Model confidence</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{titleCase(analysis.structuredModel?.confidence)}</p>
              <p className="mt-1 text-xs text-slate-500">Structured output quality</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Financial snapshot</h4>
            <p className="mt-1 text-xs text-slate-500">A quick read of the pre-recast business performance before WS2-2 add-backs.</p>
          </div>
          {analysis.normalizedData?.partialDataLabel ? <Badge color="gold">{String(analysis.normalizedData.partialDataLabel)}</Badge> : null}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">TTM revenue</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(analysis.ttmSummary?.totalRevenue)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Gross profit</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(analysis.ttmSummary?.grossProfit)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Gross margin</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatPct(analysis.ttmSummary?.grossMarginPct)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">4-wall EBITDA</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(analysis.ttmSummary?.ebitdaPreRecast)}</p>
            <p className="mt-1 text-xs text-slate-500">{formatPct(analysis.ttmSummary?.ebitdaMarginPct)} margin</p>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          4-wall EBITDA is shown in pre-recast form. Add-backs have not been applied yet and will be evaluated in WS2-2.
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">GL mapping summary</h4>
            <p className="mt-1 text-xs text-slate-500">Each source account is paired with a plain-English Cantara category so a reviewer can understand the mapping at a glance.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Auto-mapped</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{autoMappedCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Needs review</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{reviewMappingCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Unmapped</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{unmappedCount}</p>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.18em]">Account</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.18em]">GL code</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.18em]">Cantara category</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.18em]">Meaning</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.18em]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {mappingRows.map((row) => (
                  <tr key={`${row.accountName}-${row.accountCode ?? 'na'}`}>
                    <td className="px-4 py-3 align-top text-slate-800">{row.accountName}</td>
                    <td className="px-4 py-3 align-top text-slate-600">{row.accountCode ?? '—'}</td>
                    <td className="px-4 py-3 align-top text-slate-800">{cantaraLabel(row.cantaraCode)}</td>
                    <td className="px-4 py-3 align-top text-slate-500">{cantaraMeaning(row.cantaraCode)}</td>
                    <td className="px-4 py-3 align-top">
                      <Badge color={mappingTone(row)}>{mappingStatus(row)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {analysis.workingCapital && (
        <Card className="p-5">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Working capital and AR aging</h4>
            <p className="mt-1 text-xs text-slate-500">Month-end working capital baseline and receivables quality for the latest available period.</p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Most recent month</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{monthLabel(analysis.workingCapital.month)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Net working capital</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{formatCurrency(analysis.workingCapital.netWorkingCapital)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">3-month average</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{formatCurrency(analysis.workingCapital.trailingThreeMonthAverageNwc)}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold text-slate-700">Current assets and liabilities</p>
              </div>
              <div className="divide-y divide-slate-200">
                {analysis.workingCapital.currentAssets.map((item) => (
                  <div key={`asset-${item.code}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="text-slate-700">{item.category}</span>
                    <span className="font-medium text-slate-900">{formatCurrency(item.value)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-sm font-semibold">
                  <span className="text-slate-800">Total current assets</span>
                  <span className="text-slate-900">{formatCurrency(analysis.workingCapital.totalCurrentAssets)}</span>
                </div>
                {analysis.workingCapital.currentLiabilities.map((item) => (
                  <div key={`liability-${item.code}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="text-slate-700">{item.category}</span>
                    <span className="font-medium text-slate-900">{formatCurrency(item.value)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-sm font-semibold">
                  <span className="text-slate-800">Total current liabilities</span>
                  <span className="text-slate-900">{formatCurrency(analysis.workingCapital.totalCurrentLiabilities)}</span>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold text-slate-700">AR aging</p>
              </div>
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.18em]">Bucket</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.18em]">Amount</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.18em]">% of AR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {[
                    ['Current', analysis.workingCapital.arAging.current, analysis.workingCapital.arAging.pctCurrent],
                    ['1-30 days', analysis.workingCapital.arAging.days1To30, analysis.workingCapital.arAging.pct1To30],
                    ['31-60 days', analysis.workingCapital.arAging.days31To60, analysis.workingCapital.arAging.pct31To60],
                    ['61-90 days', analysis.workingCapital.arAging.days61To90, analysis.workingCapital.arAging.pct61To90],
                    ['90+ days', analysis.workingCapital.arAging.days90Plus, analysis.workingCapital.arAging.pct90Plus],
                    ['Total AR', analysis.workingCapital.arAging.totalAr, 100],
                  ].map(([label, value, pct]) => (
                    <tr key={String(label)}>
                      <td className="px-4 py-3 text-slate-800">{label}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">{formatCurrency(Number(value))}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{formatPct(Number(pct))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Data quality review</h4>
          <p className="mt-1 text-xs text-slate-500">Only the parts that matter are called out below. Clear sections stay in the summary row and do not interrupt the review.</p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {qualitySections.map(({ section, report, count }) => (
            <div key={section} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{section}</p>
                <Badge color={qualityTone(report.status)}>{qualityStatusLabel(report.status, count)}</Badge>
              </div>
              <p className="mt-3 text-sm font-medium text-slate-800">{cleanSectionTitle(report.title)}</p>
              {report.note ? <p className="mt-2 text-xs leading-5 text-slate-500">{report.note}</p> : null}
            </div>
          ))}
        </div>

        {qualityDetails.length > 0 && (
          <div className="mt-5 space-y-3">
            {qualityDetails.map(({ section, report }) => (
              <div key={section} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Section {section}</p>
                    <h5 className="mt-1 text-sm font-semibold text-slate-900">{cleanSectionTitle(report.title)}</h5>
                  </div>
                  <Badge color={qualityTone(report.status)}>{qualityStatusLabel(report.status, report.items.length)}</Badge>
                </div>

                {report.status === 'skipped' ? (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    {report.note || 'This check was skipped because the required source is not connected.'}
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {report.items.map((item, index) => (
                      <div key={`${section}-${index}-${item.title}`} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                          <Badge color={item.severity === 'HIGH' ? 'red' : item.severity === 'MEDIUM' ? 'gold' : item.severity === 'LOW' ? 'blue' : 'slate'}>
                            {titleCase(item.severity)}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
