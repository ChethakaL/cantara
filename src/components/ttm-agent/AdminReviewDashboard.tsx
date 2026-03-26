'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Clock3, Send } from 'lucide-react'
import { Badge, Button, Card, Select, Textarea, cn } from '@/components/ui'
import { logWs2ClientEvent, logWs2Error, logWs2Response } from '@/lib/ttm-agent/browser-debug'
import type { FlagResolutionAction, TtmAnalysisView, TtmFlagView } from '@/lib/ttm-agent/types'
import { CANTARA_TAXONOMY } from '@/lib/ttm-agent/taxonomy'

function severityColor(severity: TtmFlagView['severity']) {
  if (severity === 'HIGH') return 'red' as const
  if (severity === 'MEDIUM') return 'gold' as const
  if (severity === 'LOW') return 'blue' as const
  return 'slate' as const
}

function formatCurrency(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? `$${value.toLocaleString()}` : 'n/a'
}

function formatPct(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)}%` : 'n/a'
}

function labelize(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function describeCantaraCode(code: string | null | undefined) {
  if (!code) return 'Not assigned'
  const match = CANTARA_TAXONOMY.find((entry) => entry.code === code)
  if (!match) return code
  return `${match.code} — ${match.category}`
}

function describeCantaraCodeMeaning(code: string | null | undefined) {
  if (!code) return null
  const match = CANTARA_TAXONOMY.find((entry) => entry.code === code)
  if (!match) return null
  const aliasPreview = match.aliases.slice(0, 3).join(', ')
  return aliasPreview ? `${match.category}. Typical matches: ${aliasPreview}.` : match.category
}

function getDispatchLabel(agentId: string) {
  const labels: Record<string, string> = {
    ws2_2_recast_v1: 'WS2-2 EBITDA Recast',
    ws2_3_rev_vertical_v1: 'WS2-3 Revenue by Vertical',
    ws2_4_benchmark_v1: 'WS2-4 P&L Expense Benchmark',
    ws2_5_labor_v1: 'WS2-5 Labor Expense Analysis',
    ws2_8_seller_net_proceeds_v1: 'WS2-8 Seller Net Proceeds',
    ws2_10_report_generator_v1: 'WS2-10 Report Generator',
  }

  return labels[agentId] ?? labelize(agentId)
}

function renderPayloadSummary(section: string, payload: Record<string, unknown>) {
  if (section === 'A') {
    const candidates = Array.isArray(payload.candidateCodes) ? payload.candidateCodes.filter((value): value is string => typeof value === 'string') : []
    const monthlyRange = payload.monthlyRange && typeof payload.monthlyRange === 'object' ? (payload.monthlyRange as Record<string, unknown>) : null
    const confidencePct =
      typeof payload.mappingConfidencePct === 'number'
        ? payload.mappingConfidencePct
        : typeof payload.mappingConfidence === 'number'
          ? Math.round(payload.mappingConfidence * 1000) / 10
          : null

    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <PayloadMetric label="Source Account" value={String(payload.accountName ?? 'Unknown account')} />
        <PayloadMetric label="Account Code" value={String(payload.accountCode ?? 'Not provided')} />
        {payload.assignedCantaraCode && (
          <>
            <PayloadMetric label="Admin Assignment" value={describeCantaraCode(String(payload.assignedCantaraCode))} />
            <PayloadMetric label="Code Meaning" value={describeCantaraCodeMeaning(String(payload.assignedCantaraCode)) ?? 'Meaning not available'} />
          </>
        )}
        <PayloadMetric label="Mapping Confidence" value={confidencePct === null ? 'n/a' : `${confidencePct}%`} />
        <PayloadMetric label="Candidate Codes" value={candidates.length ? candidates.map((code) => describeCantaraCode(code)).join(' | ') : 'No candidates suggested'} />
        {monthlyRange && (
          <>
            <PayloadMetric label="Monthly Low" value={formatCurrency(monthlyRange.min)} />
            <PayloadMetric label="Monthly High" value={formatCurrency(monthlyRange.max)} />
          </>
        )}
        <PayloadMetric label="Source File" value={String(payload.sourceDocument ?? 'n/a')} />
        <PayloadMetric label="Source Sheet" value={String(payload.sourceSheet ?? 'n/a')} />
        <PayloadMetric label="Source Row" value={String(payload.sourceRow ?? 'n/a')} />
        <PayloadMetric label="Source Cell" value={String(payload.sourceCell ?? 'n/a')} />
        <PayloadMetric label="How to resolve" value={String(payload.reviewerGuidance ?? 'Assign one Cantara code or escalate.')} />
      </div>
    )
  }

  if (section === 'B' || section === 'C') {
    const metric = payload.lineItem ?? payload.metric ?? payload.accountName ?? 'Variance item'
    const rollupValue = payload.monthlyRollup ?? payload.actual
    const accountantValue = payload.accountantStatement ?? payload.expected
    const period = payload.fiscalYear ?? payload.period

    if (rollupValue === undefined && accountantValue === undefined) {
      return (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PayloadMetric label="Line Item" value={String(metric)} />
          <PayloadMetric label="Fiscal Year" value={String(period ?? 'n/a')} />
          <PayloadMetric label="Status" value={String(payload.reason ?? 'Not derivable from source data')} />
        </div>
      )
    }

    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <PayloadMetric label="Line Item" value={String(metric)} />
        <PayloadMetric label={section === 'C' ? 'Monthly Rollup' : 'Observed'} value={formatCurrency(rollupValue)} />
        <PayloadMetric label={section === 'C' ? 'Accountant Statement' : 'Expected'} value={formatCurrency(accountantValue)} />
        <PayloadMetric label="Variance" value={formatCurrency(payload.variance)} />
        <PayloadMetric label="Variance %" value={formatPct(payload.variancePct)} />
        <PayloadMetric label="Fiscal Year" value={String(period ?? 'n/a')} />
        {payload.sourceMonthly && <PayloadMetric label="Rollup Source" value={String(payload.sourceMonthly)} />}
        {payload.sourceAccountant && <PayloadMetric label="Accountant Source" value={String(payload.sourceAccountant)} />}
      </div>
    )
  }

  if (section === 'D') {
    if (Array.isArray(payload.missingMonths) && payload.missingMonths.length > 0) {
      const months = payload.missingMonths.filter((v): v is string => typeof v === 'string')
      return (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PayloadMetric label="Missing Months" value={months.join(', ')} />
        </div>
      )
    }
    if (typeof payload.monthCount === 'number') {
      return (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PayloadMetric label="Months Present" value={String(payload.monthCount)} />
          <PayloadMetric label="Expected" value="36" />
        </div>
      )
    }
    if (Array.isArray(payload.zeroRevenueMonths)) {
      const months = payload.zeroRevenueMonths.filter((v): v is string => typeof v === 'string')
      return (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PayloadMetric label="Zero-Revenue Months" value={months.join(', ')} />
        </div>
      )
    }
    if (Array.isArray(payload.plYears) || Array.isArray(payload.bsYears)) {
      return (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PayloadMetric label="P&L Fiscal Years" value={Array.isArray(payload.plYears) ? payload.plYears.join(', ') : 'n/a'} />
          <PayloadMetric label="Balance Sheet Fiscal Years" value={Array.isArray(payload.bsYears) ? payload.bsYears.join(', ') : 'n/a'} />
        </div>
      )
    }
    return null
  }

  if (section === 'E') {
    if ('customerName' in payload && 'pctOfTotal' in payload) {
      return (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PayloadMetric label="Customer" value={String(payload.customerName)} />
          <PayloadMetric label="Customer Balance" value={formatCurrency(payload.total)} />
          <PayloadMetric label="% of Total AR" value={formatPct(payload.pctOfTotal)} />
          <PayloadMetric label="Total AR Pool" value={formatCurrency(payload.totalAr)} />
          {payload.source && <PayloadMetric label="Source File" value={String(payload.source)} />}
        </div>
      )
    }
    if ('balanceSheetAr' in payload) {
      return (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PayloadMetric label="AR Aging Total" value={formatCurrency(payload.totalAr)} />
          <PayloadMetric label="Balance Sheet AR" value={formatCurrency(payload.balanceSheetAr)} />
          <PayloadMetric label="Variance" value={formatCurrency(payload.varianceToBalanceSheetAr)} />
          {payload.sourceAging && <PayloadMetric label="Aging Source" value={String(payload.sourceAging)} />}
          {payload.sourceBalanceSheet && <PayloadMetric label="BS Source" value={String(payload.sourceBalanceSheet)} />}
        </div>
      )
    }
    if ('pct90Plus' in payload) {
      return (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PayloadMetric label="Total AR" value={formatCurrency(payload.totalAr)} />
          <PayloadMetric label="90+ Days Amount" value={formatCurrency(payload.days90Plus)} />
          <PayloadMetric label="90+ Days %" value={formatPct(payload.pct90Plus)} />
          {payload.source && <PayloadMetric label="Source File" value={String(payload.source)} />}
        </div>
      )
    }
    return null
  }

  const entries = Object.entries(payload).slice(0, 6)
  if (entries.length === 0) return null

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {entries.map(([key, value]) => (
        <PayloadMetric key={key} label={labelize(key)} value={formatPayloadValue(value)} />
      ))}
    </div>
  )
}

function formatPayloadValue(value: unknown) {
  if (value === null || value === undefined) return 'n/a'
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toLocaleString() : 'n/a'
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return 'Structured detail available'
  return String(value)
}

function PayloadMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-700">{value}</p>
    </div>
  )
}

export function AdminReviewDashboard({
  analysis,
  actorName,
  onUpdated,
  collapsed = false,
  onToggleCollapse,
}: {
  analysis: TtmAnalysisView
  actorName: string
  onUpdated: (analysis: TtmAnalysisView) => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}) {
  const [notesByFlagId, setNotesByFlagId] = useState<Record<string, string>>({})
  const [assignedCodesByFlagId, setAssignedCodesByFlagId] = useState<Record<string, string>>({})
  const [savingFlagId, setSavingFlagId] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [detailsOpenByKey, setDetailsOpenByKey] = useState<Record<string, boolean>>({})
  const [dispatchOpen, setDispatchOpen] = useState(false)
  const unresolvedCount = analysis.flags.filter((flag) => flag.resolutionStatus !== 'ACTIONED').length
  const sectionOrder = analysis.dataQualityReport?.sectionOrder ?? []
  const cantaraOptions = useMemo(
    () => [
      { value: '', label: 'Select Cantara code' },
      ...CANTARA_TAXONOMY.map((entry) => ({
        value: entry.code,
        label: `${entry.code} — ${entry.category}`,
      })),
    ],
    [],
  )

  const sectionEntries = useMemo(() => {
    const report = analysis.dataQualityReport
    if (!report) return {} as Record<string, Array<{ item: (typeof report.sections.A.items)[number]; flag: TtmFlagView | null }>>

    return Object.fromEntries(
      sectionOrder.map((section) => {
        const reportSection = report.sections[section]
        const sectionFlags = analysis.flags.filter((flag) => flag.section === section)
        const unmatchedFlags = [...sectionFlags]
        const entries = reportSection.items.map((item) => {
          const matchIndex = unmatchedFlags.findIndex(
            (flag) =>
              flag.title === item.title &&
              (flag.description ?? '') === item.description &&
              flag.severity === item.severity,
          )

          const flag = matchIndex >= 0 ? unmatchedFlags.splice(matchIndex, 1)[0] : null
          return { item, flag }
        })

        unmatchedFlags.forEach((flag) => {
          entries.push({
            item: {
              title: flag.title,
              description: flag.description ?? 'Persisted flag detail available.',
              severity: flag.severity,
              payload: flag.payload,
            },
            flag,
          })
        })

        return [section, entries]
      }),
    ) as Record<string, Array<{ item: (typeof report.sections.A.items)[number]; flag: TtmFlagView | null }>>
  }, [analysis.dataQualityReport, analysis.flags, sectionOrder])

  const reviewSections = useMemo(
    () =>
      sectionOrder
        .map((section) => {
          const reportSection = analysis.dataQualityReport?.sections[section]
          const entries = sectionEntries[section] ?? []
          const openEntries = entries.filter((entry) => entry.flag?.resolutionStatus !== 'ACTIONED')
          const resolvedEntries = entries.filter((entry) => entry.flag?.resolutionStatus === 'ACTIONED')

          return {
            section,
            reportSection,
            entries,
            openEntries,
            resolvedEntries,
            visibleEntries: openEntries.length > 0 ? openEntries : entries,
          }
        })
        .filter(({ reportSection }) => Boolean(reportSection))
        .filter(({ reportSection, entries, openEntries }) => {
          if (!reportSection) return false
          return openEntries.length > 0 || entries.length > 0 || reportSection.status === 'skipped'
        }),
    [analysis.dataQualityReport, sectionEntries, sectionOrder],
  )

  useEffect(() => {
    const preferredSection = reviewSections.find(({ openEntries }) => openEntries.length > 0)?.section ?? reviewSections[0]?.section ?? null
    setActiveSection((current) => {
      if (current && reviewSections.some((section) => section.section === current)) return current
      return preferredSection
    })
  }, [analysis.id, reviewSections])

  const submitFlagAction = async (flagId: string, resolutionAction: FlagResolutionAction, payloadPatch?: Record<string, unknown>) => {
    setSavingFlagId(flagId)
    try {
      logWs2ClientEvent('WS2-1 HITL flag action request', {
        analysisId: analysis.id,
        flagId,
        resolutionAction,
        resolutionNotes: notesByFlagId[flagId] || '',
        payloadPatch,
      })
      const res = await fetch('/api/ttm-agent/hitl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'flag',
          analysisId: analysis.id,
          flagId,
          resolutionAction,
          resolutionNotes: notesByFlagId[flagId] || '',
          actorName,
          payloadPatch,
        }),
      })
      await logWs2Response('WS2-1 HITL flag action response', res)

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || 'Failed to update flag')
      }

      onUpdated(await res.json())
    } catch (error) {
      logWs2Error('WS2-1 HITL flag action', error, {
        analysisId: analysis.id,
        flagId,
        resolutionAction,
      })
      alert(error instanceof Error ? error.message : 'Failed to update flag')
    } finally {
      setSavingFlagId(null)
    }
  }

  const approveAnalysis = async () => {
    setApproving(true)
    try {
      logWs2ClientEvent('WS2-1 approve request', {
        analysisId: analysis.id,
        actorName,
      })
      const res = await fetch('/api/ttm-agent/hitl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'approve',
          analysisId: analysis.id,
          actorName,
        }),
      })
      await logWs2Response('WS2-1 approve response', res)

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || 'Failed to approve analysis')
      }

      onUpdated(await res.json())
    } catch (error) {
      logWs2Error('WS2-1 approve', error, {
        analysisId: analysis.id,
      })
      alert(error instanceof Error ? error.message : 'Failed to approve analysis')
    } finally {
      setApproving(false)
    }
  }

  const currentSection =
    reviewSections.find((section) => section.section === activeSection) ??
    reviewSections[0] ??
    null

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h4 className="text-sm font-semibold text-slate-800">Review Queue</h4>
            <p className="text-xs text-slate-400 mt-1">
              Work through the active review sections, then approve WS2-1 to unlock WS2-2.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {analysis.status === 'APPROVED' ? (
              <Badge color="green">Approved</Badge>
            ) : unresolvedCount === 0 ? (
              <Badge color="green">Ready for Approval</Badge>
            ) : (
              <Badge color="gold">{unresolvedCount} unresolved</Badge>
            )}
            {onToggleCollapse && (
              <Button size="sm" variant="outline" onClick={onToggleCollapse}>
                {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {collapsed ? 'Expand Review' : 'Collapse Review'}
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => void approveAnalysis()}
              disabled={analysis.status === 'APPROVED' || unresolvedCount > 0 || approving}
            >
              {approving ? 'Approving...' : 'Approve & Release to WS2-2'}
            </Button>
          </div>
        </div>

        {collapsed ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            {analysis.status === 'APPROVED'
              ? 'WS2-1 review is approved and collapsed.'
              : unresolvedCount > 0
                ? `${unresolvedCount} review item${unresolvedCount === 1 ? '' : 's'} still need action.`
                : 'All review items are actioned. Approval is ready.'}
          </div>
        ) : (
          <>
            {reviewSections.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {reviewSections.map(({ section, reportSection, openEntries, resolvedEntries, entries }) => (
                  <button
                    key={section}
                    type="button"
                    onClick={() => setActiveSection(section)}
                    className={cn(
                      'min-w-[220px] rounded-2xl border px-4 py-3 text-left transition',
                      activeSection === section
                        ? 'border-slate-800 bg-slate-800 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className={cn('text-[11px] font-bold uppercase tracking-[0.16em]', activeSection === section ? 'text-slate-300' : 'text-slate-400')}>
                        Section {section}
                      </span>
                      <span className={cn(
                        'rounded-full px-2 py-1 text-xs font-semibold',
                        activeSection === section ? 'bg-white/15 text-white' : 'bg-amber-50 text-amber-700',
                      )}>
                        {openEntries.length > 0 ? openEntries.length : entries.length} {openEntries.length === 1 || (openEntries.length === 0 && entries.length === 1) ? 'item' : 'items'}
                      </span>
                    </div>
                    <p className={cn('mt-3 text-sm font-semibold leading-6', activeSection === section ? 'text-white' : 'text-slate-900')}>
                      {reportSection?.title.replace(/^Section [A-E] - /, '')}
                    </p>
                    {resolvedEntries.length > 0 && openEntries.length === 0 && (
                      <p className={cn('mt-1 text-xs', activeSection === section ? 'text-slate-300' : 'text-slate-500')}>
                        Reviewed
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      {!collapsed && (
        <>
          {currentSection ? (
            <Card className="p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Section {currentSection.section}</p>
                  <h4 className="mt-2 text-lg font-semibold text-slate-900">{currentSection.reportSection?.title.replace(/^Section [A-E] - /, '')}</h4>
                  {currentSection.reportSection?.note && <p className="mt-1 text-sm text-slate-500">{currentSection.reportSection.note}</p>}
                </div>
                {currentSection.reportSection?.status === 'issues' ? (
                  <Badge color="gold">{currentSection.openEntries.length || currentSection.entries.length} to review</Badge>
                ) : currentSection.reportSection?.status === 'skipped' ? (
                  <Badge color="slate">Skipped</Badge>
                ) : (
                  <Badge color="green">Reviewed</Badge>
                )}
              </div>

              <div className="mt-4 space-y-4">
                {currentSection.resolvedEntries.length > 0 && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {currentSection.resolvedEntries.length} {currentSection.resolvedEntries.length === 1 ? 'item has' : 'items have'} already been actioned in this section.
                    {currentSection.openEntries.length > 0 ? ' The remaining item(s) are shown below.' : ' This section is ready.'}
                  </div>
                )}

                {currentSection.visibleEntries.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    {currentSection.reportSection?.status === 'skipped'
                      ? 'This section is present but not active because QuickBooks is not connected.'
                      : 'No review items are open in this section.'}
                  </div>
                ) : (
                  currentSection.visibleEntries.map(({ item, flag }, itemIndex) => {
                    const itemKey = flag?.id ?? `${currentSection.section}-${itemIndex}-${item.title}`
                    const showDetails = detailsOpenByKey[itemKey] ?? false
                    const assignedCode = assignedCodesByFlagId[flag?.id ?? ''] ?? String(flag?.payload.assignedCantaraCode ?? '')

                    return (
                      <div key={itemKey} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                              <Badge color={severityColor(item.severity)}>{item.severity}</Badge>
                              {flag?.resolutionStatus === 'ACTIONED' && flag.resolutionAction && (
                                <Badge color="green">{flag.resolutionAction.replace('_', ' ')}</Badge>
                              )}
                            </div>
                            <p className="text-sm leading-6 text-slate-600">{item.description}</p>
                          </div>
                          {flag?.resolutionStatus === 'ACTIONED' ? (
                            <div className="inline-flex items-center gap-2 text-xs text-emerald-600">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {flag.resolvedByName || actorName}
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2 text-xs text-amber-600">
                              <Clock3 className="w-3.5 h-3.5" />
                              Needs decision
                            </div>
                          )}
                        </div>

                        {currentSection.section === 'A' && flag?.resolutionStatus !== 'ACTIONED' && (
                          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                            Choose the best Cantara category for this GL account. The code meaning is shown in plain language below before you confirm it.
                          </div>
                        )}

                        {item.payload && Object.keys(item.payload).length > 0 && (
                          <div className="mt-4">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setDetailsOpenByKey((current) => ({
                                  ...current,
                                  [itemKey]: !current[itemKey],
                                }))
                              }
                            >
                              {showDetails ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                              {showDetails ? 'Hide supporting detail' : 'Show supporting detail'}
                            </Button>
                            {showDetails && (
                              <div className="mt-3 space-y-3">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Supporting detail</p>
                                  <Badge color="slate">Section {currentSection.section}</Badge>
                                </div>
                                {renderPayloadSummary(currentSection.section, item.payload)}
                              </div>
                            )}
                          </div>
                        )}

                        {flag && flag.resolutionStatus !== 'ACTIONED' && (
                          <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                            {currentSection.section === 'A' && (
                              <Select
                                label="Cantara category"
                                options={cantaraOptions}
                                value={assignedCode}
                                onChange={(event) =>
                                  setAssignedCodesByFlagId((current) => ({
                                    ...current,
                                    [flag.id]: event.target.value,
                                  }))
                                }
                              />
                            )}
                            <Textarea
                              rows={2}
                              label="Reviewer note"
                              value={notesByFlagId[flag.id] ?? ''}
                              onChange={(event) =>
                                setNotesByFlagId((current) => ({
                                  ...current,
                                  [flag.id]: event.target.value,
                                }))
                              }
                              placeholder="Add approval context, override rationale, or client follow-up."
                            />
                            <div className="flex gap-2 flex-wrap">
                              {currentSection.section === 'A' ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={savingFlagId === flag.id || !assignedCode}
                                    onClick={() =>
                                      void submitFlagAction(flag.id, 'RESOLVE', {
                                        assignedCantaraCode: assignedCode,
                                      })
                                    }
                                  >
                                    Confirm Mapping
                                  </Button>
                                  <Button
                                    size="sm"
                                    disabled={savingFlagId === flag.id}
                                    onClick={() => void submitFlagAction(flag.id, 'ESCALATE_CLIENT')}
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    Send to Client
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={savingFlagId === flag.id}
                                    onClick={() => void submitFlagAction(flag.id, 'RESOLVE')}
                                  >
                                    {currentSection.section === 'B' || currentSection.section === 'C' ? 'Mark Reviewed' : 'Resolve'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={savingFlagId === flag.id}
                                    onClick={() => void submitFlagAction(flag.id, 'OVERRIDE')}
                                  >
                                    Override
                                  </Button>
                                  <Button
                                    size="sm"
                                    disabled={savingFlagId === flag.id}
                                    onClick={() => void submitFlagAction(flag.id, 'ESCALATE_CLIENT')}
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    Send to Client
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {flag?.resolutionStatus === 'ACTIONED' && flag.resolutionNotes && (
                          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                            <p className="font-medium text-slate-700 mb-1">Reviewer note</p>
                            {flag.resolutionNotes}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </Card>
          ) : (
            <Card className="p-5">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                No review sections are active. This run is ready for approval.
              </div>
            </Card>
          )}

          <Card className="p-5">
            <button
              type="button"
              onClick={() => setDispatchOpen((current) => !current)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                What Unlocks After Approval
              </div>
              <div className="inline-flex items-center gap-2 text-xs text-slate-500">
                {dispatchOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                {dispatchOpen ? 'Hide' : 'Show'}
              </div>
            </button>
            {dispatchOpen && (
              <div className="mt-4 space-y-2">
                {analysis.dispatchTasks.map((task) => (
                  <div key={task.id} className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{getDispatchLabel(task.agentId)}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {task.releasedAt ? `Released ${new Date(task.releasedAt).toLocaleString()}` : 'This stage stays locked until WS2-1 is approved.'}
                      </p>
                    </div>
                    <Badge color={task.status === 'RELEASED' ? 'green' : task.status === 'READY' ? 'blue' : 'gold'}>
                      {task.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
