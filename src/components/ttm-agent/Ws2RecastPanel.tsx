'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { PremiumMarkdown } from '@/components/ttm-agent/PremiumMarkdown'
import { Badge, Button, Card, Input, Textarea, cn } from '@/components/ui'
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

function formatCurrency(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : 'Not available'
}

function formatMultiple(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)}x` : 'Not set'
}

type ScheduleRow = {
  index: string
  category: string
  description: string
  glReference: string
  ttmAmount: number | null
  status: string
}

const CATEGORY_LABELS: Record<string, string> = {
  'Owner / Officer Compensation': 'Category 1 · Owner / Officer Compensation',
  'Personal Expenses': 'Category 2 · Personal Expenses',
  'One-Off Expenses': 'Category 3 · One-Off Non-Recurring',
  'TI Add-Backs': 'Category 4 · Tenant Improvements',
  'Other / Admin Input': 'Category 5 · Other / Admin Input',
}

function parseCurrencyCell(raw: string) {
  const cleaned = raw.replace(/\*\*/g, '').trim()
  if (!cleaned) return null
  const negative = /^\(.*\)$/.test(cleaned) || cleaned.startsWith('-')
  const normalized = cleaned.replace(/[,$()*]/g, '').replace(/^\-/, '')
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return negative ? -parsed : parsed
}

function parseScheduleRows(reportMarkdown: string | null | undefined) {
  if (!reportMarkdown) return [] as ScheduleRow[]
  const match = reportMarkdown.match(/## EBITDA RECAST SCHEDULE[\s\S]*?\n(\| # \| Category \| Item Description \| GL Reference \| TTM Amount \| Status \|[\s\S]*?)(?:\n\*\*3-Year Normalized EBITDA Summary:|\n## FLAG LIST FOR ADMIN REVIEW|$)/i)
  if (!match) return [] as ScheduleRow[]

  return match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'))
    .filter((line) => !/^\|\s*-+/.test(line))
    .map((line) =>
      line
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim().replace(/\*\*/g, '')),
    )
    .filter((cells) => cells.length >= 6 && cells[0] !== '#' && cells[1] !== 'Category')
    .map((cells) => ({
      index: cells[0],
      category: cells[1],
      description: cells[2],
      glReference: cells[3],
      ttmAmount: parseCurrencyCell(cells[4]),
      status: cells[5],
    }))
}

function statusTone(status: string) {
  const upper = status.toUpperCase()
  if (upper.includes('FLAGGED') || upper.includes('MISSING')) return 'text-rose-700'
  if (upper.includes('DEFAULT') || upper.includes('OVERRIDE') || upper.includes('CRAIG')) return 'text-amber-700'
  if (upper.includes('VERIFIED') || upper.includes('CALCULATED')) return 'text-emerald-700'
  return 'text-slate-600'
}

export function Ws2RecastPanel({
  analysis,
  clientId,
  adminName,
  documentStatuses,
  onUpdated,
  collapsed = false,
  onToggleCollapse,
}: {
  analysis: TtmAnalysisView
  clientId: string
  adminName: string
  documentStatuses: Record<string, DocumentStatus>
  onUpdated: (analysis: TtmAnalysisView) => void
  collapsed?: boolean
  onToggleCollapse?: () => void
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
  const [showRawReport, setShowRawReport] = useState(false)
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({})

  const latestRecast = analysis.recastAnalyses?.[0] ?? null
  const unresolvedCount = latestRecast?.flags.filter((flag) => flag.resolutionStatus !== 'ACTIONED').length ?? 0
  const requiredReady = REQUIRED_RECAST_DOCS.every((doc) => Boolean(documentStatuses[doc.id]?.fileName))
  const leaseReady = Boolean(documentStatuses.leases?.fileName)
  const ownerAssessmentReady = Boolean(documentStatuses.owner_gm_assessment?.fileName)
  const recastDispatchTask = analysis.dispatchTasks.find((task) => task.agentId === 'ws2_2_recast_v1')
  const isApproved = latestRecast?.status === 'APPROVED'
  const derivedStatusByAgent = new Map((analysis.derivedReports ?? []).map((report) => [report.agentId, report.status]))
  const scheduleRows = useMemo(() => parseScheduleRows(latestRecast?.reportMarkdown), [latestRecast?.reportMarkdown])
  const preRecastRow = scheduleRows.find((row) => /4-Wall EBITDA/i.test(row.description))
  const totalAddBacksRow = scheduleRows.find((row) => /TOTAL ADD-BACKS/i.test(row.category) || /TOTAL ADD-BACKS/i.test(row.description))
  const normalizedRow = scheduleRows.find((row) => /NORMALIZED \/ RECAST EBITDA/i.test(row.category) || /NORMALIZED \/ RECAST EBITDA/i.test(row.description))
  const categoryRows = useMemo(() => {
    const groups = new Map<string, ScheduleRow[]>()
    for (const row of scheduleRows) {
      if (row.index === '—') continue
      const current = groups.get(row.category) ?? []
      current.push(row)
      groups.set(row.category, current)
    }
    return Array.from(groups.entries())
  }, [scheduleRows])

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
              Admin enters the valuation multiples here after WS2-1 approval. WS2-2 then verifies add-backs against the full WS2-1 model and produces the recast schedule.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge color={recastDispatchTask?.status === 'RELEASED' ? 'green' : 'gold'}>
              {recastDispatchTask?.status === 'RELEASED' ? 'Released from HITL' : 'Awaiting WS2-1 Approval'}
            </Badge>
            {onToggleCollapse && (
              <Button size="sm" variant="outline" onClick={onToggleCollapse}>
                {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {collapsed ? 'Expand WS2-2' : 'Collapse WS2-2'}
              </Button>
            )}
            <Button size="sm" onClick={() => void runRecast()} disabled={!canRun || running}>
              {running ? 'Running WS2-2...' : latestRecast ? 'Refresh WS2-2' : 'Run WS2-2'}
            </Button>
          </div>
        </div>

        {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        {collapsed ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Status</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">{latestRecast?.status ?? 'Not Run'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Open Flags</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">{unresolvedCount}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Normalized EBITDA</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">
                  {latestRecast?.normalizedEbitda?.toLocaleString() ?? 'n/a'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Workbook</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">
                  {latestRecast?.workbookUrl ? 'Available' : 'Not generated'}
                </p>
              </div>
            </div>
          </div>
        ) : isApproved ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              WS2-2 is approved. The EBITDA review controls are now hidden and the workflow moves into WS2-3, WS2-4, WS2-5, and the baseline report.
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Normalized EBITDA</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(latestRecast?.normalizedEbitda)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Low valuation</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(latestRecast?.valuationLow)}</p>
                <p className="mt-1 text-xs text-slate-500">{formatMultiple(latestRecast?.assumptions.multipleLow)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Mid valuation</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(latestRecast?.valuationMid)}</p>
                <p className="mt-1 text-xs text-slate-500">{formatMultiple(latestRecast?.assumptions.multipleMid)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">High valuation</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(latestRecast?.valuationHigh)}</p>
                <p className="mt-1 text-xs text-slate-500">{formatMultiple(latestRecast?.assumptions.multipleHigh)}</p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-2xl border border-slate-200 p-5">
                <h4 className="text-sm font-semibold text-slate-800">Assumptions used</h4>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Replacement salary</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{formatCurrency(latestRecast?.assumptions.replacementSalary ?? 65000)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Related-party rent</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{latestRecast?.assumptions.relatedPartyOwnership ? 'Yes' : 'No'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">FMR estimate</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {latestRecast?.assumptions.relatedPartyOwnership
                        ? formatCurrency(latestRecast?.assumptions.fmrEstimate)
                        : 'Not needed for this run'}
                    </p>
                  </div>
                </div>
                {latestRecast?.workbookUrl && (
                  <a href={latestRecast.workbookUrl} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-medium text-amber-700 underline">
                    Open approved WS2-2 workbook
                  </a>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 p-5">
                <h4 className="text-sm font-semibold text-slate-800">What happens next</h4>
                <div className="mt-4 space-y-3">
                  {[
                    ['WS2-3 Revenue', derivedStatusByAgent.get('ws2_3_rev_vertical_v1') ?? 'Not run'],
                    ['WS2-4 Benchmarks', derivedStatusByAgent.get('ws2_4_benchmark_v1') ?? 'Not run'],
                    ['WS2-5 Labor', derivedStatusByAgent.get('ws2_5_labor_v1') ?? 'Not run'],
                    ['Baseline report', derivedStatusByAgent.get('ws2_10_report_generator_v1') ?? 'Not run'],
                  ].map(([label, status]) => (
                    <div key={String(label)} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <span className="text-sm font-medium text-slate-800">{label}</span>
                      <Badge color={status === 'COMPLETE' ? 'green' : status === 'RUNNING' ? 'blue' : 'slate'}>
                        {status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-2xl border border-slate-200 p-5">
                <h4 className="text-sm font-semibold text-slate-800">Admin inputs</h4>
                <p className="mt-1 text-xs text-slate-500">Enter the EBITDA assumptions once, then run WS2-2. This becomes the working EBITDA and valuation range for the next stage.</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <Input label="Low multiple" value={assumptions.multipleLow} onChange={(event) => setAssumptions((current) => ({ ...current, multipleLow: event.target.value }))} placeholder="3.5" />
                  <Input label="Mid multiple" value={assumptions.multipleMid} onChange={(event) => setAssumptions((current) => ({ ...current, multipleMid: event.target.value }))} placeholder="4.5" />
                  <Input label="High multiple" value={assumptions.multipleHigh} onChange={(event) => setAssumptions((current) => ({ ...current, multipleHigh: event.target.value }))} placeholder="5.5" />
                  <Input label="Replacement salary" value={assumptions.replacementSalary} onChange={(event) => setAssumptions((current) => ({ ...current, replacementSalary: event.target.value }))} placeholder="Defaults to 65000 if blank" />
                  <Input
                    label="Related-party ownership"
                    value={assumptions.relatedPartyOwnership}
                    onChange={(event) => setAssumptions((current) => ({ ...current, relatedPartyOwnership: event.target.value.toLowerCase() === 'yes' ? 'yes' : 'no' }))}
                    placeholder="yes or no"
                  />
                  <Input label="FMR estimate" value={assumptions.fmrEstimate} onChange={(event) => setAssumptions((current) => ({ ...current, fmrEstimate: event.target.value }))} placeholder="Only if related-party rent applies" />
                </div>
                <div className="mt-3">
                  <Textarea label="Admin notes" rows={2} value={assumptions.notes} onChange={(event) => setAssumptions((current) => ({ ...current, notes: event.target.value }))} placeholder="Why this multiple range or any rent / replacement salary context." />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-5">
                <h4 className="text-sm font-semibold text-slate-800">Before you run</h4>
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {hasRequiredMultiples
                      ? 'Valuation multiples are set.'
                      : 'Enter low, mid, and high valuation multiples before running WS2-2.'}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {requiredReady ? 'The add-back disclosure is uploaded.' : 'The add-back disclosure is still missing.'}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {recastDispatchTask?.status === 'RELEASED' ? 'WS2-2 is released and ready to run.' : 'WS2-2 remains blocked until WS2-1 is approved.'}
                  </div>
                </div>
                <div className="mt-4 grid gap-3">
                  {[...REQUIRED_RECAST_DOCS, ...OPTIONAL_RECAST_DOCS].map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
                      <span className="text-sm text-slate-700">{doc.label}</span>
                      <Badge color={documentStatuses[doc.id]?.fileName ? 'green' : doc.id === 'addback_disclosure' ? 'red' : 'slate'}>
                        {documentStatuses[doc.id]?.fileName ? 'Uploaded' : doc.id === 'addback_disclosure' ? 'Missing' : 'Optional'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </Card>

      {!collapsed && latestRecast && !isApproved && (
        <>
          <Card className="p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h4 className="text-sm font-semibold text-slate-800">WS2-2 review report</h4>
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

            <div className="mt-4 space-y-4">
              {latestRecast.flags.length > 0 && (
                <div className="space-y-3">
                  {latestRecast.flags.map((flag) => (
                    <div key={flag.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-slate-900">{flag.title}</p>
                            <Badge color={flag.severity === 'HIGH' ? 'red' : flag.severity === 'MEDIUM' ? 'gold' : 'blue'}>{flag.severity}</Badge>
                          </div>
                          {flag.description && flag.description.trim() !== flag.title.trim() && (
                            <p className="mt-2 text-sm leading-6 text-slate-600">{flag.description}</p>
                          )}
                        </div>
                        {flag.resolutionStatus === 'ACTIONED' ? (
                          <Badge color="green">{flag.resolutionAction ?? 'Resolved'}</Badge>
                        ) : (
                          <Badge color="gold">Needs review</Badge>
                        )}
                      </div>

                      {flag.resolutionStatus !== 'ACTIONED' && (
                        <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                          <Input
                            label="Override amount (optional)"
                            value={overrideAmounts[flag.id] ?? ''}
                            onChange={(event) =>
                              setOverrideAmounts((current) => ({
                                ...current,
                                [flag.id]: event.target.value,
                              }))
                            }
                            placeholder="Only if you are changing the reported amount"
                          />
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
                          />
                          <div className="flex gap-2 flex-wrap">
                            <Button size="sm" variant="outline" disabled={savingFlagId === flag.id} onClick={() => void updateFlag(flag.id, 'RESOLVE')}>
                              Accept as shown
                            </Button>
                            <Button size="sm" variant="outline" disabled={savingFlagId === flag.id} onClick={() => void updateFlag(flag.id, 'OVERRIDE')}>
                              Override amount
                            </Button>
                            <Button size="sm" disabled={savingFlagId === flag.id} onClick={() => void updateFlag(flag.id, 'ESCALATE_CLIENT')}>
                              Remove item
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                  <h4 className="text-[13px] font-bold uppercase tracking-[0.2em] text-slate-700">Preliminary Valuation Range</h4>
                  <span className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Internal Only</span>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-5 text-center">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Low · {formatMultiple(latestRecast.assumptions.multipleLow)}</p>
                    <p className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 tabular-nums">{formatCurrency(latestRecast.valuationLow)}</p>
                    <p className="mt-2 text-sm text-slate-500">Conservative</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-800 px-6 py-5 text-center text-white shadow-lg">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">Mid · {formatMultiple(latestRecast.assumptions.multipleMid)}</p>
                    <p className="mt-4 text-4xl font-semibold tracking-tight text-amber-300 tabular-nums">{formatCurrency(latestRecast.valuationMid)}</p>
                    <p className="mt-2 text-sm text-slate-300">Most Likely</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-5 text-center">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">High · {formatMultiple(latestRecast.assumptions.multipleHigh)}</p>
                    <p className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 tabular-nums">{formatCurrency(latestRecast.valuationHigh)}</p>
                    <p className="mt-2 text-sm text-slate-500">Optimistic</p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">
                  Based on TTM normalized EBITDA of <span className="font-semibold text-slate-900">{formatCurrency(latestRecast.normalizedEbitda)}</span>. Pre-recast EBITDA was {formatCurrency(preRecastRow?.ttmAmount)}; total add-backs of {formatCurrency(totalAddBacksRow?.ttmAmount)}.
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl bg-[#1a2332] px-6 py-4 text-white shadow-lg">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-2xl font-semibold tracking-tight">Normalized EBITDA (TTM)</h3>
                  <span className="text-3xl font-semibold">{formatCurrency(normalizedRow?.ttmAmount ?? latestRecast.normalizedEbitda)}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                        <th className="px-4 py-3">Cat.</th>
                        <th className="px-4 py-3">Item</th>
                        <th className="px-4 py-3">GL Account</th>
                        <th className="px-4 py-3 text-right">TTM Amount</th>
                        <th className="px-4 py-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="px-4 py-4 font-semibold text-slate-900" colSpan={4}>4-Wall EBITDA (Pre-Recast)</td>
                        <td className="px-4 py-4 text-right font-semibold text-slate-900">{formatCurrency(preRecastRow?.ttmAmount)}</td>
                      </tr>
                    </tbody>
                    {categoryRows.map(([category, rows]) => {
                      const isOpen = openCategories[category] ?? false
                      return (
                        <tbody key={category} className="divide-y divide-slate-100">
                          <tr className="bg-slate-50/70">
                            <td colSpan={5} className="px-4 py-2">
                              <button
                                type="button"
                                className="flex w-full items-center justify-between gap-3 text-left"
                                onClick={() =>
                                  setOpenCategories((current) => ({
                                    ...current,
                                    [category]: !current[category],
                                  }))
                                }
                              >
                                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                  {CATEGORY_LABELS[category] ?? category}
                                </span>
                                <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
                                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                  {isOpen ? 'Hide detail' : `Show ${rows.length} items`}
                                </span>
                              </button>
                            </td>
                          </tr>
                          {isOpen &&
                            rows.map((row) => (
                              <tr key={`${category}-${row.index}-${row.description}`}>
                                <td className="px-4 py-3 text-slate-500">{row.index}</td>
                                <td className="px-4 py-3 text-slate-800">{row.description}</td>
                                <td className="px-4 py-3 text-slate-500">{row.glReference || '—'}</td>
                                <td className={cn('px-4 py-3 text-right tabular-nums font-medium', (row.ttmAmount ?? 0) < 0 ? 'text-rose-700' : 'text-slate-900')}>
                                  {formatCurrency(row.ttmAmount)}
                                </td>
                                <td className={cn('px-4 py-3 text-right text-xs font-bold uppercase tracking-[0.18em]', statusTone(row.status))}>
                                  {row.status}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      )
                    })}
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 flex-wrap rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-sm text-slate-600">
                  Resolve every flagged add-back item before approval. Approval stores the approved normalized EBITDA and unlocks the next report sections.
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={unresolvedCount === 0 ? 'green' : 'gold'}>{unresolvedCount} unresolved</Badge>
                  <Button size="sm" onClick={() => void approveRecast()} disabled={latestRecast.status === 'APPROVED' || unresolvedCount > 0 || approving}>
                    {approving ? 'Approving...' : 'Approve Recast'}
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {latestRecast.reportMarkdown && (
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">Full WS2-2 report</h4>
                  <p className="text-xs text-slate-400 mt-1">Hidden by default so the UI stays focused on the active review items.</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setShowRawReport((current) => !current)}>
                  {showRawReport ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  {showRawReport ? 'Hide report' : 'Show report'}
                </Button>
              </div>
              {showRawReport && (
                <div className="mt-4 text-sm">
                  <PremiumMarkdown>{latestRecast.reportMarkdown}</PremiumMarkdown>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  )
}
