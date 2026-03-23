'use client'

import { useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Badge, Button, Card, Input, Textarea } from '@/components/ui'
import { logWs2ClientEvent, logWs2Error, logWs2PreparedDocuments, logWs2Response } from '@/lib/ttm-agent/browser-debug'
import { prepareWs2DocumentFromServer } from '@/lib/ttm-agent/browser-documents'
import type { DocumentStatus } from '@/lib/store'
import type { TtmAnalysisView, Ws2RecastAssumptions } from '@/lib/ttm-agent/types'

const REQUIRED_RECAST_DOCS = [
  { id: 'addback_disclosure', label: 'File 5 — Add-Back Disclosure' },
] as const

const OPTIONAL_RECAST_DOCS = [
  { id: 'leases', label: 'Lease from WS1' },
  { id: 'owner_gm_assessment', label: 'Owner & GM Assessment from WS1' },
] as const

function parseNumberInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed.replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

export function Ws2RecastPanel({
  analysis,
  clientId,
  adminName,
  documentStatuses,
  onUpdated,
}: {
  analysis: TtmAnalysisView
  clientId: string
  adminName: string
  documentStatuses: Record<string, DocumentStatus>
  onUpdated: (analysis: TtmAnalysisView) => void
}) {
  const [assumptions, setAssumptions] = useState({
    multipleLow: '',
    multipleMid: '',
    multipleHigh: '',
    replacementSalary: '',
    relatedPartyOwnership: 'no',
    fmrEstimate: '',
    notes: '',
  })
  const [notesByFlagId, setNotesByFlagId] = useState<Record<string, string>>({})
  const [overrideAmounts, setOverrideAmounts] = useState<Record<string, string>>({})
  const [running, setRunning] = useState(false)
  const [savingFlagId, setSavingFlagId] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const latestRecast = analysis.recastAnalyses?.[0] ?? null
  const unresolvedCount = latestRecast?.flags.filter((flag) => flag.resolutionStatus !== 'ACTIONED').length ?? 0
  const requiredReady = REQUIRED_RECAST_DOCS.every((doc) => Boolean(documentStatuses[doc.id]?.fileName))
  const leaseReady = Boolean(documentStatuses.leases?.fileName)
  const ownerAssessmentReady = Boolean(documentStatuses.owner_gm_assessment?.fileName)
  const recastDispatchTask = analysis.dispatchTasks.find((task) => task.agentId === 'ws2_2_recast_v1')

  const recastAssumptions = useMemo(
    () =>
      ({
        multipleLow: parseNumberInput(assumptions.multipleLow),
        multipleMid: parseNumberInput(assumptions.multipleMid),
        multipleHigh: parseNumberInput(assumptions.multipleHigh),
        replacementSalary: parseNumberInput(assumptions.replacementSalary),
        relatedPartyOwnership: assumptions.relatedPartyOwnership === 'yes',
        fmrEstimate: parseNumberInput(assumptions.fmrEstimate),
        notes: assumptions.notes || null,
      }) satisfies Ws2RecastAssumptions,
    [assumptions],
  )
  const hasRequiredMultiples =
    recastAssumptions.multipleLow !== null &&
    recastAssumptions.multipleMid !== null &&
    recastAssumptions.multipleHigh !== null
  const canRun =
    analysis.status === 'APPROVED' &&
    requiredReady &&
    hasRequiredMultiples &&
    (!recastDispatchTask || recastDispatchTask.status === 'RELEASED')

  const runRecast = async () => {
    setRunning(true)
    setError(null)
    try {
      const preparedDocuments = await Promise.all(
        [
          ...REQUIRED_RECAST_DOCS,
          ...(leaseReady ? [{ id: 'leases', label: 'Lease(s)' } as const] : []),
          ...(ownerAssessmentReady ? [{ id: 'owner_gm_assessment', label: 'Owner & GM Assessment' } as const] : []),
        ].map((doc) =>
          prepareWs2DocumentFromServer({
            clientId,
            documentId: doc.id,
            fileName: documentStatuses[doc.id]?.fileName || doc.label,
          }),
        ),
      )
      logWs2PreparedDocuments('WS2-2 prepared documents', preparedDocuments)
      logWs2ClientEvent('WS2-2 run request', {
        analysisId: analysis.id,
        assumptions: recastAssumptions,
      })

      const res = await fetch('/api/ttm-agent/recast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'run',
          analysisId: analysis.id,
          assumptions: recastAssumptions,
          preparedDocuments,
        }),
      })
      await logWs2Response('WS2-2 run response', res)

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || 'Failed to run WS2-2')
      }

      onUpdated(await res.json())
    } catch (runError) {
      logWs2Error('WS2-2 run', runError, {
        analysisId: analysis.id,
        assumptions: recastAssumptions,
      })
      setError(runError instanceof Error ? runError.message : 'Failed to run WS2-2')
    } finally {
      setRunning(false)
    }
  }

  const updateFlag = async (flagId: string, resolutionAction: 'RESOLVE' | 'OVERRIDE' | 'ESCALATE_CLIENT') => {
    if (!latestRecast) return
    setSavingFlagId(flagId)
    setError(null)
    try {
      const overrideAmount = parseNumberInput(overrideAmounts[flagId] ?? '')
      logWs2ClientEvent('WS2-2 flag action request', {
        recastAnalysisId: latestRecast.id,
        flagId,
        resolutionAction,
        overrideAmount,
        notes: notesByFlagId[flagId] ?? '',
      })
      const res = await fetch('/api/ttm-agent/recast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'flag',
          recastAnalysisId: latestRecast.id,
          flagId,
          resolutionAction,
          resolutionNotes: notesByFlagId[flagId] || '',
          actorName: adminName,
          overrideAmount,
        }),
      })
      await logWs2Response('WS2-2 flag action response', res)

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || 'Failed to update WS2-2 flag')
      }

      onUpdated(await res.json())
    } catch (flagError) {
      logWs2Error('WS2-2 flag action', flagError, {
        recastAnalysisId: latestRecast.id,
        flagId,
        resolutionAction,
      })
      setError(flagError instanceof Error ? flagError.message : 'Failed to update WS2-2 flag')
    } finally {
      setSavingFlagId(null)
    }
  }

  const approveRecast = async () => {
    if (!latestRecast) return
    setApproving(true)
    setError(null)
    try {
      logWs2ClientEvent('WS2-2 approve request', {
        recastAnalysisId: latestRecast.id,
        actorName: adminName,
      })
      const res = await fetch('/api/ttm-agent/recast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'approve',
          recastAnalysisId: latestRecast.id,
          actorName: adminName,
        }),
      })
      await logWs2Response('WS2-2 approve response', res)

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || 'Failed to approve WS2-2')
      }

      onUpdated(await res.json())
    } catch (approveError) {
      logWs2Error('WS2-2 approve', approveError, {
        recastAnalysisId: latestRecast.id,
      })
      setError(approveError instanceof Error ? approveError.message : 'Failed to approve WS2-2')
    } finally {
      setApproving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h4 className="text-sm font-semibold text-slate-800">WS2-2 EBITDA Recast</h4>
            <p className="text-xs text-slate-400 mt-1">
              Craig enters the valuation multiples here after WS2-1 approval. WS2-2 then verifies add-backs against the full WS2-1 model and produces the recast schedule.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge color={recastDispatchTask?.status === 'RELEASED' ? 'green' : 'gold'}>
              {recastDispatchTask?.status === 'RELEASED' ? 'Released from HITL' : 'Awaiting WS2-1 Approval'}
            </Badge>
            <Button size="sm" onClick={() => void runRecast()} disabled={!canRun || running}>
              {running ? 'Running WS2-2...' : 'Run WS2-2'}
            </Button>
          </div>
        </div>

        {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 mt-4">
          <Input label="Multiple Low" value={assumptions.multipleLow} onChange={(event) => setAssumptions((current) => ({ ...current, multipleLow: event.target.value }))} placeholder="3.5" />
          <Input label="Multiple Mid" value={assumptions.multipleMid} onChange={(event) => setAssumptions((current) => ({ ...current, multipleMid: event.target.value }))} placeholder="4.5" />
          <Input label="Multiple High" value={assumptions.multipleHigh} onChange={(event) => setAssumptions((current) => ({ ...current, multipleHigh: event.target.value }))} placeholder="5.5" />
          <Input label="Replacement Salary" value={assumptions.replacementSalary} onChange={(event) => setAssumptions((current) => ({ ...current, replacementSalary: event.target.value }))} placeholder="65000 (defaults to $65,000 if blank)" />
          <Input
            label="Related-Party Ownership? (yes/no)"
            value={assumptions.relatedPartyOwnership}
            onChange={(event) => setAssumptions((current) => ({ ...current, relatedPartyOwnership: event.target.value.toLowerCase() === 'yes' ? 'yes' : 'no' }))}
            placeholder="no"
          />
          <Input label="FMR Estimate" value={assumptions.fmrEstimate} onChange={(event) => setAssumptions((current) => ({ ...current, fmrEstimate: event.target.value }))} placeholder="Optional unless related-party rent" />
        </div>
        <div className="mt-3">
          <Textarea label="Craig Notes" rows={2} value={assumptions.notes} onChange={(event) => setAssumptions((current) => ({ ...current, notes: event.target.value }))} placeholder="Basis for multiple range, replacement salary, or rent normalization assumptions..." />
        </div>

        {!hasRequiredMultiples && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Enter the low, mid, and high valuation multiples before running WS2-2.
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5 mt-4">
          {REQUIRED_RECAST_DOCS.map((doc) => (
            <div key={doc.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-700">{doc.label}</p>
              <p className="text-[11px] text-slate-400 mt-1">{documentStatuses[doc.id]?.fileName || 'Missing'}</p>
            </div>
          ))}
          {OPTIONAL_RECAST_DOCS.map((doc) => (
            <div key={doc.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-700">{doc.label}</p>
              <p className="text-[11px] text-slate-400 mt-1">{documentStatuses[doc.id]?.fileName || 'Optional / not uploaded'}</p>
            </div>
          ))}
        </div>
      </Card>

      {latestRecast && (
        <>
          <Card className="p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h4 className="text-sm font-semibold text-slate-800">Latest WS2-2 Run</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Run #{latestRecast.version} · {new Date(latestRecast.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge color={latestRecast.status === 'APPROVED' ? 'green' : latestRecast.status === 'FAILED' ? 'red' : 'gold'}>
                  {latestRecast.status}
                </Badge>
                <Badge color="blue">{latestRecast.hitlStatus}</Badge>
                {latestRecast.workbookUrl && (
                  <a href={latestRecast.workbookUrl} target="_blank" rel="noreferrer" className="text-xs text-amber-700 underline">
                    Workbook
                  </a>
                )}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4 mt-4">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Normalized EBITDA</p>
                <p className="mt-2 text-lg font-semibold text-slate-800">{latestRecast.normalizedEbitda?.toLocaleString() ?? 'n/a'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Valuation Low</p>
                <p className="mt-2 text-lg font-semibold text-slate-800">{latestRecast.valuationLow?.toLocaleString() ?? 'n/a'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Valuation Mid</p>
                <p className="mt-2 text-lg font-semibold text-slate-800">{latestRecast.valuationMid?.toLocaleString() ?? 'n/a'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Valuation High</p>
                <p className="mt-2 text-lg font-semibold text-slate-800">{latestRecast.valuationHigh?.toLocaleString() ?? 'n/a'}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h4 className="text-sm font-semibold text-slate-800">WS2-2 Craig Review</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Resolve every flagged add-back item before approval. Approval generates the WS2 workbook and stores approved normalized EBITDA.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge color={unresolvedCount === 0 ? 'green' : 'gold'}>{unresolvedCount} unresolved</Badge>
                <Button size="sm" onClick={() => void approveRecast()} disabled={latestRecast.status === 'APPROVED' || unresolvedCount > 0 || approving}>
                  {approving ? 'Approving...' : 'Approve Recast'}
                </Button>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {latestRecast.flags.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  No explicit WS2-2 flags were extracted from the report.
                </div>
              ) : (
                latestRecast.flags.map((flag) => (
                  <div key={flag.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-slate-800">{flag.title}</p>
                          <Badge color={flag.severity === 'HIGH' ? 'red' : flag.severity === 'MEDIUM' ? 'gold' : 'blue'}>{flag.severity}</Badge>
                        </div>
                        {flag.description && flag.description.trim() !== flag.title.trim() && (
                          <p className="text-sm text-slate-600 mt-2">{flag.description}</p>
                        )}
                      </div>
                      {flag.resolutionStatus === 'ACTIONED' && (
                        <Badge color="green">{flag.resolutionAction ?? 'Resolved'}</Badge>
                      )}
                    </div>

                    {flag.resolutionStatus !== 'ACTIONED' && (
                      <div className="mt-4 space-y-3">
                        <Input
                          label="Override Amount (optional)"
                          value={overrideAmounts[flag.id] ?? ''}
                          onChange={(event) =>
                            setOverrideAmounts((current) => ({
                              ...current,
                              [flag.id]: event.target.value,
                            }))
                          }
                          placeholder="Only if Craig is overriding the amount"
                        />
                        <Textarea
                          rows={2}
                          label="Reviewer Notes"
                          value={notesByFlagId[flag.id] ?? ''}
                          onChange={(event) =>
                            setNotesByFlagId((current) => ({
                              ...current,
                              [flag.id]: event.target.value,
                            }))
                          }
                        />
                        <div className="flex gap-2 flex-wrap">
                          <Button size="sm" variant="outline" disabled={savingFlagId === flag.id} onClick={() => void updateFlag(flag.id, 'RESOLVE')}>
                            Accept As-Is
                          </Button>
                          <Button size="sm" variant="outline" disabled={savingFlagId === flag.id} onClick={() => void updateFlag(flag.id, 'OVERRIDE')}>
                            Override Amount
                          </Button>
                          <Button size="sm" disabled={savingFlagId === flag.id} onClick={() => void updateFlag(flag.id, 'ESCALATE_CLIENT')}>
                            Remove Item
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>

          {latestRecast.reportMarkdown && (
            <Card className="p-5">
              <h4 className="text-sm font-semibold text-slate-800">Exact WS2-2 Report</h4>
              <div className="prose prose-slate max-w-none mt-4 text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{latestRecast.reportMarkdown}</ReactMarkdown>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
