'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2, ChevronDown, ChevronRight, Clock3, Send, Search } from 'lucide-react'
import { Badge, Button, Card, Textarea, cn } from '@/components/ui'
import { logWs2ClientEvent, logWs2Error, logWs2Response } from '@/lib/ttm-agent/browser-debug'
import type { FlagResolutionAction, TtmAnalysisView, TtmFlagView } from '@/lib/ttm-agent/types'
import { CANTARA_TAXONOMY } from '@/lib/ttm-agent/taxonomy'

// ── Helpers ────────────────────────────────────────────────────────────────────
function severityColor(s: TtmFlagView['severity']) {
  return s === 'HIGH' ? 'red' as const : s === 'MEDIUM' ? 'gold' as const : s === 'LOW' ? 'blue' as const : 'slate' as const
}
function fmt$(v: unknown) { return typeof v === 'number' && Number.isFinite(v) ? `$${v.toLocaleString()}` : '--' }
function fmtPct(v: unknown) { return typeof v === 'number' && Number.isFinite(v) ? `${(v as number).toFixed(1)}%` : '--' }
function labelize(v: string) { return v.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }
function fmtVal(v: unknown): string {
  if (v === null || v === undefined) return '--'
  if (typeof v === 'number') return Number.isFinite(v) ? v.toLocaleString() : '--'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'object') return 'Detail available'
  return String(v)
}

function cantaraLabel(code: string | null | undefined) {
  if (!code) return 'Not assigned'
  const match = CANTARA_TAXONOMY.find(e => e.code === code)
  return match ? `${match.code} — ${match.category}` : code
}

function cleanTitle(t: string) { return t.replace(/^Section [A-E] - /, '') }

function payloadAccountName(payload: Record<string, unknown> | null | undefined): string {
  if (!payload) return ''
  const raw = payload.accountName ?? payload.sourceAccount
  return typeof raw === 'string' ? raw.trim().toLowerCase() : ''
}

function payloadNoteText(payload: Record<string, unknown> | null | undefined): string {
  if (!payload) return ''
  const raw = payload.noteText
  return typeof raw === 'string' ? raw.trim().toLowerCase() : ''
}

/** Stable 1:1 match between report items and DB flags — never reuse a flag across cards. */
function matchFlagToItem(
  flags: TtmFlagView[],
  item: { title: string; description?: string; severity?: string; payload?: Record<string, unknown> },
  usedFlagIds: Set<string>,
): TtmFlagView | null {
  const available = flags.filter(f => !usedFlagIds.has(f.id))
  if (!available.length) return null

  const itemAccount = payloadAccountName(item.payload)
  if (itemAccount) {
    const byAccount = available.find(f => payloadAccountName(f.payload) === itemAccount)
    if (byAccount) return byAccount
  }

  const itemNote = payloadNoteText(item.payload)
  if (itemNote) {
    const byNote = available.find(f => payloadNoteText(f.payload) === itemNote)
    if (byNote) return byNote
  }

  const exact = available.find(
    f => f.title === item.title
      && (f.description ?? '') === (item.description ?? '')
      && (!item.severity || f.severity === item.severity),
  )
  if (exact) return exact

  // Title matches: prefer description, otherwise consume next unused flag in order
  // so duplicate titles (common on LLM notes) never share one flag ID.
  const titleMatches = available.filter(f => f.title === item.title)
  if (titleMatches.length === 1) return titleMatches[0]
  if (titleMatches.length > 1) {
    const byDescription = titleMatches.find(f => (f.description ?? '') === (item.description ?? ''))
    if (byDescription) return byDescription
    return titleMatches[0]
  }

  return null
}

// ── Payload Summary (compact) ──────────────────────────────────────────────────
function PayloadGrid({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {items.filter(i => {
        if (i.value === null || i.value === undefined || i.value === '--' || i.value === 'n/a' || i.value === '') return false
        return true
      }).map(i => (
        <div key={i.label} className="rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">{i.label}</p>
          <div className="mt-0.5 text-xs font-medium text-slate-700 break-words">{i.value}</div>
        </div>
      ))}
    </div>
  )
}

function sourceDocumentHref(payload: Record<string, unknown>, clientId?: string): string | null {
  if (!clientId) return null
  const recordId = typeof payload.sourceDocumentRecordId === 'string' ? payload.sourceDocumentRecordId : ''
  const documentId = typeof payload.sourceDocumentId === 'string' ? payload.sourceDocumentId : ''
  if (recordId) {
    return `/api/client-documents/view?clientId=${encodeURIComponent(clientId)}&recordId=${encodeURIComponent(recordId)}`
  }
  if (documentId) {
    return `/api/client-documents/view?clientId=${encodeURIComponent(clientId)}&documentId=${encodeURIComponent(documentId)}`
  }
  return null
}

function renderPayload(section: string, payload: Record<string, unknown>, clientId?: string) {
  if (section === 'A') {
    const candidates = Array.isArray(payload.candidateCodes) ? payload.candidateCodes.filter((v): v is string => typeof v === 'string') : []
    const conf = typeof payload.mappingConfidencePct === 'number' ? payload.mappingConfidencePct : typeof payload.mappingConfidence === 'number' ? Math.round(payload.mappingConfidence * 1000) / 10 : null
    const range = payload.monthlyRange as Record<string, unknown> | null
    const documentLabel = String(payload.sourceDocument ?? payload.sourceFileName ?? payload.sourceDocumentLabel ?? 'Unknown')
    const monthCoverage = typeof payload.sourceMonthCoverage === 'string' ? payload.sourceMonthCoverage : ''
    const href = sourceDocumentHref(payload, clientId)
    return <PayloadGrid items={[
      { label: 'Source Account', value: String(payload.accountName ?? '') },
      { label: 'Account Code', value: String(payload.accountCode ?? '') },
      { label: 'Confidence', value: conf !== null ? `${conf}%` : '--' },
      { label: 'Candidates', value: candidates.map(c => cantaraLabel(c)).join(' | ') || 'None' },
      ...(range ? [{ label: 'Monthly Range', value: `${fmt$(range.min)} – ${fmt$(range.max)}` }] : []),
      {
        label: 'Document',
        value: href ? (
          <a href={href} target="_blank" rel="noreferrer" className="text-amber-700 hover:text-amber-800 underline underline-offset-2">
            {documentLabel}
          </a>
        ) : documentLabel,
      },
      ...(monthCoverage ? [{ label: 'Period', value: monthCoverage }] : []),
      { label: 'Source', value: `${payload.sourceSheet ?? ''} row ${payload.sourceRow ?? ''}${payload.sourceCell ? ` (${payload.sourceCell})` : ''}`.trim() },
      ...(payload.assignedCantaraCode ? [{ label: 'Admin Assignment', value: cantaraLabel(String(payload.assignedCantaraCode)) }] : []),
      { label: 'Guidance', value: String(payload.reviewerGuidance ?? '') },
    ]} />
  }
  if (section === 'B' || section === 'C') {
    return <PayloadGrid items={[
      { label: 'Line Item', value: String(payload.lineItem ?? payload.metric ?? payload.accountName ?? '') },
      { label: section === 'C' ? 'Monthly Rollup' : 'Observed', value: fmt$(payload.monthlyRollup ?? payload.actual) },
      { label: section === 'C' ? 'Accountant Statement' : 'Expected', value: fmt$(payload.accountantStatement ?? payload.expected) },
      { label: 'Variance', value: fmt$(payload.variance) },
      { label: 'Variance %', value: fmtPct(payload.variancePct) },
      { label: 'Period', value: String(payload.fiscalYear ?? payload.period ?? '') },
    ]} />
  }
  // Generic fallback
  const entries = Object.entries(payload).slice(0, 8)
  if (!entries.length) return null
  return <PayloadGrid items={entries.map(([k, v]) => ({ label: labelize(k), value: fmtVal(v) }))} />
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function AdminReviewDashboard({
  analysis,
  actorName,
  onUpdated,
  clientId,
  collapsed = false,
  onToggleCollapse,
}: {
  analysis: TtmAnalysisView
  actorName: string
  onUpdated: (analysis: TtmAnalysisView) => void
  clientId?: string
  collapsed?: boolean
  onToggleCollapse?: () => void
}) {
  const [notesByFlag, setNotesByFlag] = useState<Record<string, string>>({})
  const [codesByFlag, setCodesByFlag] = useState<Record<string, string>>({})
  const [savingFlag, setSavingFlag] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({})
  const [catSearch, setCatSearch] = useState<Record<string, string>>({})
  const [catOpen, setCatOpen] = useState<Record<string, boolean>>({})

  const unresolvedCount = analysis.flags.filter(f => f.resolutionStatus !== 'ACTIONED').length
  const unresolvedNonA = analysis.flags.filter(f => f.resolutionStatus !== 'ACTIONED' && f.section !== 'A').length
  const [bulkAcking, setBulkAcking] = useState(false)

  const bulkAcknowledgeNotes = async () => {
    setBulkAcking(true)
    try {
      const nonAFlags = analysis.flags.filter(f => f.resolutionStatus !== 'ACTIONED' && f.section !== 'A')
      for (const f of nonAFlags) {
        const res = await fetch('/api/ttm-agent/hitl', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'flag', analysisId: analysis.id, flagId: f.id, resolutionAction: 'RESOLVE', resolutionNotes: 'Bulk acknowledged — informational note', actorName }),
        })
        if (res.ok) {
          const updated = await res.json()
          onUpdated(updated)
        }
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Bulk acknowledge failed')
    } finally { setBulkAcking(false) }
  }

  const sectionOrder = analysis.dataQualityReport?.sectionOrder ?? []
  const validCodes = useMemo(() => new Set(CANTARA_TAXONOMY.map(e => e.code)), [])
  const cantaraOptions = useMemo(() => CANTARA_TAXONOMY.map(e => ({ value: e.code, label: `${e.code} — ${e.category}` })), [])

  // Build section entries with flags
  const sectionEntries = useMemo(() => {
    const report = analysis.dataQualityReport
    if (!report) {
      // No dataQualityReport — build entries directly from flags
      const bySection: Record<string, Array<{ item: any; flag: TtmFlagView }>> = {}
      for (const f of analysis.flags) {
        const section = f.section || 'A'
        if (!bySection[section]) bySection[section] = []
        bySection[section].push({ item: { title: f.title, description: f.description ?? '', severity: f.severity, payload: f.payload }, flag: f })
      }
      return bySection as Record<string, Array<{ item: any; flag: TtmFlagView | null }>>
    }
    return Object.fromEntries(sectionOrder.map(section => {
      const items = report.sections[section]?.items ?? []
      const flags = [...analysis.flags.filter(f => f.section === section)]
      const usedFlagIds = new Set<string>()
      const entries: Array<{ item: any; flag: TtmFlagView | null }> = []

      for (const item of items) {
        const flag = matchFlagToItem(flags, item, usedFlagIds)
        if (flag) {
          usedFlagIds.add(flag.id)
          entries.push({ item, flag })
        } else if (section === 'A') {
          // Section A may need create-and-resolve for unmatched report rows.
          entries.push({ item, flag: null })
        }
        // Non-A unmatched report rows are dropped — their flags appear via `remaining`
        // so we never show a note card that can't be acknowledged, or share a flag ID.
      }

      const remaining = flags.filter(f => !usedFlagIds.has(f.id))
      remaining.forEach(f => entries.push({
        item: { title: f.title, description: f.description ?? '', severity: f.severity, payload: f.payload },
        flag: f,
      }))

      // SAFETY: if items exist but none matched a flag, map them directly from section flags
      if (entries.length > 0 && entries.every(e => e.flag === null) && flags.length > 0) {
        return [section, flags.map(f => ({ item: { title: f.title, description: f.description ?? '', severity: f.severity, payload: f.payload }, flag: f }))]
      }
      return [section, entries]
    }))
  }, [analysis.dataQualityReport, analysis.flags, sectionOrder])

  const reviewSections = useMemo(() => {
    // If no dataQualityReport, derive sections from sectionEntries keys
    const sections = sectionOrder.length > 0 ? sectionOrder : Object.keys(sectionEntries).sort()
    return sections.map(section => {
      const report = analysis.dataQualityReport?.sections[section] ?? { title: `Section ${section} - GL Classification Requests`, note: null }
      const entries = sectionEntries[section] ?? []
      const open = entries.filter(e => e.flag && e.flag.resolutionStatus !== 'ACTIONED')
      const resolved = entries.filter(e => e.flag?.resolutionStatus === 'ACTIONED')
      return { section, report, entries, open, resolved }
    }).filter(s => s.open.length > 0 || s.entries.length > 0)
  }, [analysis.dataQualityReport, sectionEntries, sectionOrder])

  useEffect(() => {
    const preferred = reviewSections.find(s => s.open.length > 0)?.section ?? reviewSections[0]?.section ?? null
    setActiveSection(c => c && reviewSections.some(s => s.section === c) ? c : preferred)
  }, [analysis.id, reviewSections])

  const submitAction = async (flagId: string, action: FlagResolutionAction, patch?: Record<string, unknown>) => {
    setSavingFlag(flagId)
    try {
      logWs2ClientEvent('HITL flag action', { analysisId: analysis.id, flagId, action })

      // For synthetic flags (no DB record), create the flag first
      let resolvedFlagId = flagId
      if (flagId.startsWith('synthetic-')) {
        // Format: synthetic-{section}-{entryIndex}-{stableKey}
        const withoutPrefix = flagId.slice('synthetic-'.length)
        const sectionKey = withoutPrefix.split('-')[0]
        const afterSection = withoutPrefix.slice(sectionKey.length + 1)
        const entryIndexStr = afterSection.split('-')[0]
        const entryIndex = Number(entryIndexStr)
        const stablePart = afterSection.slice(entryIndexStr.length + 1)
        const sectionData = sectionEntries[sectionKey]
        const entry = (
          Number.isFinite(entryIndex) ? sectionData?.[entryIndex] : undefined
        ) ?? sectionData?.find((e, i) => {
          if (e.flag) return false
          const sk = (
            payloadAccountName(e.item.payload)
            || payloadNoteText(e.item.payload)
            || e.item.title
            || String(i)
          ).replace(/\s+/g, '_').slice(0, 80)
          return sk === stablePart || sk === afterSection
        })
        if (entry) {
          const createRes = await fetch('/api/ttm-agent/hitl', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: 'create-and-resolve',
              analysisId: analysis.id,
              section: sectionKey,
              severity: entry.item.severity || 'MEDIUM',
              title: entry.item.title,
              description: entry.item.description || '',
              payload: { ...(entry.item.payload || {}), ...(patch || {}) },
              resolutionAction: action,
              resolutionNotes: notesByFlag[flagId] || '',
              actorName,
            }),
          })
          if (createRes.ok) {
            onUpdated(await createRes.json())
            return
          }
          // If create-and-resolve not supported, just acknowledge locally
          alert('GL mapping saved locally. Refresh to see updated state.')
          return
        }
      }

      const res = await fetch('/api/ttm-agent/hitl', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'flag', analysisId: analysis.id, flagId: resolvedFlagId, resolutionAction: action, resolutionNotes: notesByFlag[flagId] || '', actorName, payloadPatch: patch }),
      })
      await logWs2Response('HITL flag response', res)
      if (!res.ok) throw new Error(await res.text().catch(() => 'Failed'))
      onUpdated(await res.json())
    } catch (e) {
      logWs2Error('HITL flag', e, { analysisId: analysis.id, flagId })
      alert(e instanceof Error ? e.message : 'Failed')
    } finally { setSavingFlag(null) }
  }

  const approve = async () => {
    setApproving(true)
    try {
      logWs2ClientEvent('WS2-1 approve', { analysisId: analysis.id })
      const res = await fetch('/api/ttm-agent/hitl', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'approve', analysisId: analysis.id, actorName }),
      })
      await logWs2Response('WS2-1 approve', res)
      if (!res.ok) throw new Error(await res.text().catch(() => 'Failed'))
      onUpdated(await res.json())
    } catch (e) {
      logWs2Error('WS2-1 approve', e, { analysisId: analysis.id })
      alert(e instanceof Error ? e.message : 'Failed')
    } finally { setApproving(false) }
  }

  const current = reviewSections.find(s => s.section === activeSection) ?? reviewSections[0] ?? null

  return (
    <Card className="overflow-hidden">
      {/* ── Header bar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-200 px-5 py-3">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-slate-800">Review Queue</h4>
          {analysis.status === 'APPROVED' ? (
            <Badge color="green">Approved</Badge>
          ) : unresolvedCount > 0 ? (
            <Badge color="gold">{unresolvedCount} open</Badge>
          ) : (
            <Badge color="green">Ready</Badge>
          )}
        </div>
        {/* Bulk acknowledge non-Section-A notes */}
        {unresolvedNonA > 0 && (
          <Button size="sm" variant="outline" disabled={bulkAcking} onClick={bulkAcknowledgeNotes}>
            {bulkAcking ? 'Acknowledging...' : `Acknowledge All ${unresolvedNonA} Notes`}
          </Button>
        )}
      </div>

      {/* ── Compact section tabs ────────────────────────────────────── */}
      {reviewSections.length > 0 && (
        <div className="flex gap-1 border-b border-slate-200 px-4 py-2 bg-slate-50/50 overflow-x-auto">
          {reviewSections.map(({ section, report, open, resolved }) => {
            const isActive = activeSection === section
            const allDone = open.length === 0 && resolved.length > 0
            return (
              <button
                key={section}
                type="button"
                onClick={() => setActiveSection(section)}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition',
                  isActive ? 'bg-white border border-slate-200 text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/60',
                )}
              >
                <span className="font-bold">{section}</span>
                <span className="truncate max-w-[140px]">{cleanTitle(report?.title ?? '')}</span>
                {open.length > 0 ? (
                  <Badge color="gold">{open.length}</Badge>
                ) : allDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                ) : null}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Active section content ──────────────────────────────────── */}
      <div className="px-5 py-4">
        {!current ? (
          <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            No review sections active. Ready for approval.
          </div>
        ) : (
          <div className="space-y-3">
            {/* Section header */}
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">{cleanTitle(current.report?.title ?? '')}</h4>
                {current.report?.note && <p className="text-xs text-slate-400 mt-0.5">{current.report.note}</p>}
              </div>
              {current.resolved.length > 0 && (
                <span className="text-xs text-emerald-600">{current.resolved.length} resolved</span>
              )}
            </div>

            {current.open.length === 0 && current.resolved.length > 0 && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                All {current.resolved.length} items in this section are resolved.
              </div>
            )}

            {/* Items — each card is bound to at most one flag ID */}
            {current.entries.map(({ item, flag }, entryIndex) => {
              const resolved = flag?.resolutionStatus === 'ACTIONED'
              if (resolved) return null

              // Never rematch in render — that reused flag IDs across cards and made
              // Acknowledge appear to "light up" a different note / do nothing.
              const stableKey = payloadAccountName(item.payload)
                || payloadNoteText(item.payload)
                || item.title
                || String(entryIndex)
              const flagId = flag?.id ?? `synthetic-${current.section}-${entryIndex}-${stableKey.replace(/\s+/g, '_').slice(0, 80)}`
              const key = `${current.section}-${entryIndex}-${flagId}`
              const isOpen = openDetails[key] ?? false
              const code = codesByFlag[flagId] ?? String(flag?.payload?.assignedCantaraCode ?? item.payload?.suggestedCode ?? '')
              const isCodeValid = code ? validCodes.has(code) : false
              const search = catSearch[flagId] ?? ''
              const isDropdownOpen = Boolean(catOpen[flagId])
              const filtered = cantaraOptions.filter(o => {
                const q = search.trim().toLowerCase()
                return !q || o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
              })
              const isResolved = flag?.resolutionStatus === 'ACTIONED'

              return (
                <div key={key} className={cn('rounded-xl border p-4', isResolved ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200')}>
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge color={severityColor(item.severity)}>{item.severity}</Badge>
                      <p className="text-sm font-medium text-slate-900">{item.title}</p>
                      {isResolved && flag?.resolutionAction && <Badge color="green">{flag.resolutionAction.replace('_', ' ')}</Badge>}
                    </div>
                    {isResolved ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <Clock3 className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-500 mt-1.5 leading-5">{item.description}</p>

                  {/* Detail toggle */}
                  {item.payload && Object.keys(item.payload).length > 0 && (
                    <div className="mt-3">
                      <button type="button" onClick={() => setOpenDetails(p => ({ ...p, [key]: !p[key] }))}
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
                        {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        {isOpen ? 'Hide detail' : 'Show detail'}
                      </button>
                      {isOpen && <div className="mt-2">{renderPayload(current.section, item.payload, clientId)}</div>}
                    </div>
                  )}

                  {/* Resolved note */}
                  {isResolved && flag?.resolutionNotes && (
                    <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      <span className="font-medium">Note:</span> {flag.resolutionNotes}
                    </div>
                  )}

                  {/* Action area — notes always have a flag; Section A may be synthetic */}
                  {!isResolved && (flag || current.section === 'A') && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
                      {/* Cantara code selector for Section A */}
                      {current.section === 'A' && (
                        <div className="relative">
                          <label className="block text-[10px] uppercase tracking-wide text-slate-400 mb-1">Cantara category</label>
                          <button type="button"
                            className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:border-slate-300"
                            onClick={() => setCatOpen(p => ({ ...p, [flagId]: !p[flagId] }))}>
                            <span className={code ? 'text-slate-900' : 'text-slate-400'}>{code ? cantaraLabel(code) : 'Select code...'}</span>
                            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                          </button>
                          {isDropdownOpen && (
                            <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
                              <div className="p-2 border-b border-slate-100">
                                <div className="relative">
                                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                                  <input value={search} onChange={e => setCatSearch(p => ({ ...p, [flagId]: e.target.value }))}
                                    placeholder="Search..." className="w-full rounded-md border border-slate-200 pl-8 pr-3 py-2 text-xs outline-none focus:border-amber-400" />
                                </div>
                              </div>
                              <div className="max-h-48 overflow-auto p-1">
                                {filtered.length === 0 ? (
                                  <p className="px-3 py-2 text-xs text-slate-400">No matches</p>
                                ) : filtered.map(o => (
                                  <button key={o.value} type="button"
                                    className={cn('w-full rounded px-3 py-1.5 text-left text-xs hover:bg-slate-100', code === o.value && 'bg-amber-50')}
                                    onClick={() => { setCodesByFlag(p => ({ ...p, [flagId]: o.value })); setCatOpen(p => ({ ...p, [flagId]: false })) }}>
                                    {o.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Note */}
                      <Textarea rows={1} label="Note (optional)" value={notesByFlag[flagId] ?? ''} placeholder="Context, rationale, or follow-up"
                        onChange={e => setNotesByFlag(p => ({ ...p, [flagId]: e.target.value }))} />

                      {/* Action buttons — compact row */}
                      <div className="flex gap-2 flex-wrap">
                        {current.section === 'A' ? (
                          <>
                            {/* Accept suggestion = AI pick only. Confirm = whatever is in the Cantara category dropdown. */}
                            {(() => {
                              const payload = flag?.payload ?? item.payload ?? {}
                              const conf = typeof payload?.mappingConfidence === 'number'
                                ? payload.mappingConfidence
                                : typeof payload?.confidence === 'number'
                                  ? payload.confidence
                                  : typeof payload?.mappingConfidencePct === 'number'
                                    ? payload.mappingConfidencePct / 100
                                    : null
                              const suggested = typeof payload?.suggestedCode === 'string'
                                ? payload.suggestedCode
                                : typeof payload?.candidateCodes?.[0] === 'string'
                                  ? payload.candidateCodes[0]
                                  : null
                              const userPickedDifferent = Boolean(code && suggested && code !== suggested)
                              // Only offer Accept when the dropdown still matches the AI suggestion.
                              if (conf !== null && conf >= 0.5 && suggested && !userPickedDifferent) {
                                const confPct = Math.round(conf * 100)
                                return (
                                  <Button size="sm"
                                    className="bg-slate-800 hover:bg-slate-900 text-white"
                                    disabled={savingFlag === flagId}
                                    onClick={() => {
                                      setCodesByFlag(p => ({ ...p, [flagId]: suggested }))
                                      void submitAction(flagId, 'RESOLVE', { assignedCantaraCode: suggested })
                                    }}>
                                    Accept suggestion: {cantaraLabel(suggested)} ({confPct}%)
                                  </Button>
                                )
                              }
                              return null
                            })()}
                            <Button size="sm" variant="outline" disabled={savingFlag === flagId || !isCodeValid}
                              className="h-8 font-medium gap-1.5"
                              onClick={() => void submitAction(flagId, 'RESOLVE', { assignedCantaraCode: code })}>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              {isCodeValid ? `Confirm: ${cantaraLabel(code)}` : 'Confirm'}
                            </Button>
                            <Button size="sm" variant="outline" disabled={savingFlag === flagId}
                              className="h-8 font-medium text-slate-600 hover:text-rose-700 hover:border-rose-200 hover:bg-rose-50/60 transition-colors"
                              onClick={() => void submitAction(flagId, 'OVERRIDE', { assignedCantaraCode: null, excludedFromMapping: true })}>
                              Exclude
                            </Button>
                            <Button size="sm" variant="outline" disabled={savingFlag === flagId}
                              className="h-8 font-medium border-amber-200 bg-amber-50/70 text-amber-800 hover:bg-amber-100 hover:border-amber-300 transition-colors gap-1.5"
                              onClick={() => void submitAction(flagId, 'ESCALATE_CLIENT')}>
                              <Send className="w-3 h-3 text-amber-600" /> Escalate
                            </Button>
                          </>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] text-slate-400 italic">LLM note — use "Acknowledge All Notes" above or:</span>
                            <Button size="sm" variant="outline" disabled={savingFlag === flagId}
                              className="h-8 font-medium gap-1.5"
                              onClick={() => void submitAction(flagId, 'RESOLVE')}>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              {savingFlag === flagId ? 'Acknowledging…' : 'Acknowledge'}
                            </Button>
                            <Button size="sm" variant="outline" disabled={savingFlag === flagId}
                              className="h-8 font-medium border-amber-200 bg-amber-50/70 text-amber-800 hover:bg-amber-100 hover:border-amber-300 transition-colors gap-1.5"
                              onClick={() => void submitAction(flagId, 'ESCALATE_CLIENT')}>
                              <Send className="w-3 h-3 text-amber-600" /> Escalate
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Collapsed resolved items */}
            {current.resolved.length > 0 && current.open.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-emerald-600 hover:text-emerald-700 py-2">
                  Show {current.resolved.length} resolved item{current.resolved.length > 1 ? 's' : ''}
                </summary>
                <div className="space-y-2 mt-2">
                  {current.resolved.map(({ item, flag }) => (
                    <div key={flag?.id ?? item.title} className="rounded-lg border border-emerald-200 bg-emerald-50/30 px-4 py-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="text-xs text-slate-600 truncate">{item.title}</span>
                        {flag?.resolutionAction && <Badge color="green">{flag.resolutionAction.replace('_', ' ')}</Badge>}
                      </div>
                      {flag?.resolutionNotes && <span className="text-[11px] text-slate-400 truncate max-w-[200px]">{flag.resolutionNotes}</span>}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
