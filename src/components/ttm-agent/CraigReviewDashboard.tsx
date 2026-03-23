'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, Send } from 'lucide-react'
import { Badge, Button, Card, Select, Textarea } from '@/components/ui'
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
        {payload.assignedCantaraCode && <PayloadMetric label="Craig Assignment" value={String(payload.assignedCantaraCode)} />}
        <PayloadMetric label="Mapping Confidence" value={confidencePct === null ? 'n/a' : `${confidencePct}%`} />
        <PayloadMetric label="Candidate Codes" value={candidates.length ? candidates.join(', ') : 'No candidates suggested'} />
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

export function CraigReviewDashboard({
  analysis,
  actorName,
  onUpdated,
}: {
  analysis: TtmAnalysisView
  actorName: string
  onUpdated: (analysis: TtmAnalysisView) => void
}) {
  const [notesByFlagId, setNotesByFlagId] = useState<Record<string, string>>({})
  const [assignedCodesByFlagId, setAssignedCodesByFlagId] = useState<Record<string, string>>({})
  const [savingFlagId, setSavingFlagId] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)
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

  const summaryCards = useMemo(
    () =>
      sectionOrder.map((section) => ({
        section,
        title: analysis.dataQualityReport?.sections[section].title ?? section,
        count: analysis.dataQualityReport?.counts[section] ?? 0,
        status: analysis.dataQualityReport?.sections[section].status ?? 'clear',
      })),
    [analysis.dataQualityReport, sectionOrder],
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

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h4 className="text-sm font-semibold text-slate-800">HITL Review Task</h4>
            <p className="text-xs text-slate-400 mt-1">
              Resolve, override, or escalate each flagged issue before releasing the TTM output to WS2-2.
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
            <Button
              size="sm"
              onClick={() => void approveAnalysis()}
              disabled={analysis.status === 'APPROVED' || unresolvedCount > 0 || approving}
            >
              {approving ? 'Approving...' : 'Approve & Release to WS2-2'}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-5 mt-4">
          {summaryCards.map((card) => (
            <div key={card.section} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">{card.section}</p>
              <p className="text-sm font-medium text-slate-700 mt-2">{card.title.replace(/^Section [A-E] - /, '')}</p>
              <p className="text-xl font-semibold text-slate-900 mt-3">{card.count}</p>
              <p className="text-xs text-slate-500 mt-1 capitalize">{card.status}</p>
            </div>
          ))}
        </div>
      </Card>

      {sectionOrder.map((section) => {
        const reportSection = analysis.dataQualityReport?.sections[section]
        if (!reportSection) return null
        const entries = sectionEntries[section] ?? []
        const openEntries = entries.filter((entry) => entry.flag?.resolutionStatus !== 'ACTIONED')
        const resolvedEntries = entries.filter((entry) => entry.flag?.resolutionStatus === 'ACTIONED')
        const visibleEntries = openEntries.length > 0 ? openEntries : entries

        return (
          <Card key={section} className="p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h4 className="text-sm font-semibold text-slate-800">{reportSection.title}</h4>
                {reportSection.note && <p className="text-xs text-slate-400 mt-1">{reportSection.note}</p>}
              </div>
              {reportSection.status === 'issues' ? (
                <Badge color="gold">{reportSection.items.length} items</Badge>
              ) : reportSection.status === 'skipped' ? (
                <Badge color="slate">Skipped</Badge>
              ) : (
                <Badge color="green">Clear</Badge>
              )}
            </div>

            <div className="mt-4 space-y-4">
              {resolvedEntries.length > 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {resolvedEntries.length} {resolvedEntries.length === 1 ? 'item has' : 'items have'} been actioned in this section.
                  {openEntries.length > 0 ? ' The next unresolved issue is shown below.' : ' This section is ready.'}
                </div>
              )}

              {visibleEntries.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  {reportSection.status === 'skipped'
                    ? 'This section is present but not active because QuickBooks is not connected.'
                    : resolvedEntries.length > 0
                      ? 'All items in this section have been actioned.'
                      : 'No open items in this section.'}
                </div>
              ) : (
                visibleEntries.map(({ item, flag }, itemIndex) => {
                  return (
                    <div key={`${section}-${itemIndex}-${item.title}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-slate-800">{item.title}</p>
                            <Badge color={severityColor(item.severity)}>{item.severity}</Badge>
                            {flag?.resolutionStatus === 'ACTIONED' && (
                              <Badge color="green">{flag.resolutionAction?.replace('_', ' ')}</Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-600">{item.description}</p>
                        </div>
                        {flag?.resolutionStatus === 'ACTIONED' ? (
                          <div className="inline-flex items-center gap-2 text-xs text-emerald-600">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {flag.resolvedByName || actorName}
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2 text-xs text-amber-600">
                            <Clock3 className="w-3.5 h-3.5" />
                            Awaiting reviewer action
                          </div>
                        )}
                      </div>

                      {item.payload && Object.keys(item.payload).length > 0 && (
                        <div className="mt-4 space-y-3">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Flag detail</p>
                            <Badge color="slate">Section {section}</Badge>
                          </div>
                          {renderPayloadSummary(section, item.payload)}
                        </div>
                      )}

                      {flag && flag.resolutionStatus !== 'ACTIONED' && (
                        <div className="mt-4 space-y-3">
                          {section === 'A' && (
                            <Select
                              label="Assign Cantara Code"
                              options={cantaraOptions}
                              value={assignedCodesByFlagId[flag.id] ?? String(flag.payload.assignedCantaraCode ?? '')}
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
                            label="Reviewer notes"
                            value={notesByFlagId[flag.id] ?? ''}
                            onChange={(event) =>
                              setNotesByFlagId((current) => ({
                                ...current,
                                [flag.id]: event.target.value,
                              }))
                            }
                            placeholder="Add context, override rationale, or client follow-up instructions..."
                          />
                          <div className="flex gap-2 flex-wrap">
                            {section === 'A' ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={savingFlagId === flag.id || !(assignedCodesByFlagId[flag.id] ?? String(flag.payload.assignedCantaraCode ?? ''))}
                                  onClick={() =>
                                    void submitFlagAction(flag.id, 'RESOLVE', {
                                      assignedCantaraCode: assignedCodesByFlagId[flag.id] ?? String(flag.payload.assignedCantaraCode ?? ''),
                                    })
                                  }
                                >
                                  Assign Cantara Code
                                </Button>
                                <Button
                                  size="sm"
                                  disabled={savingFlagId === flag.id}
                                  onClick={() => void submitFlagAction(flag.id, 'ESCALATE_CLIENT')}
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  Escalate to Client
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
                                  {section === 'B' || section === 'C' ? 'Acknowledge' : 'Resolve'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={savingFlagId === flag.id}
                                  onClick={() => void submitFlagAction(flag.id, 'OVERRIDE')}
                                >
                                  {section === 'B' || section === 'C' ? 'Investigate' : 'Override'}
                                </Button>
                                <Button
                                  size="sm"
                                  disabled={savingFlagId === flag.id}
                                  onClick={() => void submitFlagAction(flag.id, 'ESCALATE_CLIENT')}
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  Escalate to Client
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {flag?.resolutionStatus === 'ACTIONED' && flag.resolutionNotes && (
                        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                          <p className="font-medium text-slate-700 mb-1">Reviewer notes</p>
                          {flag.resolutionNotes}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </Card>
        )
      })}

      <Card className="p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Downstream Dispatch Tasks
        </div>
        <div className="mt-4 space-y-2">
          {analysis.dispatchTasks.map((task) => (
            <div key={task.id} className="rounded-xl border border-slate-200 p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">{getDispatchLabel(task.agentId)}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {task.releasedAt ? `Released ${new Date(task.releasedAt).toLocaleString()}` : 'Awaiting downstream orchestration'}
                </p>
              </div>
              <Badge color={task.status === 'RELEASED' ? 'green' : task.status === 'READY' ? 'blue' : 'gold'}>
                {task.status}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
