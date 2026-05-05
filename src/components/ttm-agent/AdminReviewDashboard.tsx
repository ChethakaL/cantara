'use client'

import { useEffect, useMemo, useState } from 'react'
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

// ── Payload Summary (compact) ──────────────────────────────────────────────────
function PayloadGrid({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {items.filter(i => i.value && i.value !== '--' && i.value !== 'n/a').map(i => (
        <div key={i.label} className="rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">{i.label}</p>
          <p className="mt-0.5 text-xs font-medium text-slate-700 break-words">{i.value}</p>
        </div>
      ))}
    </div>
  )
}

function renderPayload(section: string, payload: Record<string, unknown>) {
  if (section === 'A') {
    const candidates = Array.isArray(payload.candidateCodes) ? payload.candidateCodes.filter((v): v is string => typeof v === 'string') : []
    const conf = typeof payload.mappingConfidencePct === 'number' ? payload.mappingConfidencePct : typeof payload.mappingConfidence === 'number' ? Math.round(payload.mappingConfidence * 1000) / 10 : null
    const range = payload.monthlyRange as Record<string, unknown> | null
    return <PayloadGrid items={[
      { label: 'Source Account', value: String(payload.accountName ?? '') },
      { label: 'Account Code', value: String(payload.accountCode ?? '') },
      { label: 'Confidence', value: conf !== null ? `${conf}%` : '--' },
      { label: 'Candidates', value: candidates.map(c => cantaraLabel(c)).join(' | ') || 'None' },
      ...(range ? [{ label: 'Monthly Range', value: `${fmt$(range.min)} – ${fmt$(range.max)}` }] : []),
      { label: 'Document', value: String(payload.sourceDocument ?? 'Unknown') },
      { label: 'Source', value: `${payload.sourceSheet ?? ''} row ${payload.sourceRow ?? ''}` },
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
  collapsed = false,
  onToggleCollapse,
  normOverrides,
}: {
  analysis: TtmAnalysisView
  actorName: string
  onUpdated: (analysis: TtmAnalysisView) => void
  collapsed?: boolean
  onToggleCollapse?: () => void
  normOverrides?: Record<string, number>
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
      const entries = items.map(item => {
        // Lenient matching: match on title only if exact match fails
        let idx = flags.findIndex(f => !usedFlagIds.has(f.id) && f.title === item.title && (f.description ?? '') === item.description && f.severity === item.severity)
        if (idx < 0) idx = flags.findIndex(f => !usedFlagIds.has(f.id) && f.title === item.title)
        if (idx < 0) idx = flags.findIndex(f => !usedFlagIds.has(f.id) && item.title.includes(f.title.split(' ').slice(-1)[0]))
        const flag = idx >= 0 ? flags[idx] : null
        if (flag) usedFlagIds.add(flag.id)
        return { item, flag }
      })
      // Add any remaining unmatched flags as entries WITH their flag reference
      const remaining = flags.filter(f => !usedFlagIds.has(f.id))
      remaining.forEach(f => entries.push({ item: { title: f.title, description: f.description ?? '', severity: f.severity, payload: f.payload }, flag: f }))

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
      const open = entries.filter(e => e.flag?.resolutionStatus !== 'ACTIONED')
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
        // Find the item to get its details for flag creation
        const sectionKey = flagId.split('-')[1]
        const itemIndex = parseInt(flagId.split('-')[2], 10)
        const sectionData = sectionEntries[sectionKey]
        const entry = sectionData?.[itemIndex]
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
        body: JSON.stringify({ mode: 'approve', analysisId: analysis.id, actorName, userOverrides: normOverrides && Object.keys(normOverrides).length > 0 ? normOverrides : undefined }),
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
        {/* Approve button removed — approval handled in the wizard step */}
      </div>

      {/* ── Compact section tabs ────────────────────────────────────── */}
      {reviewSections.length > 0 && (
        <div className="flex gap-1 border-b border-slate-200 px-4 py-2 bg-slate-50/50 overflow-x-auto">
          {reviewSections.map(({ section, report, open, entries }) => {
            const isActive = activeSection === section
            const count = open.length || entries.length
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
                {count > 0 && (
                  <span className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                    open.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700',
                  )}>
                    {count}
                  </span>
                )}
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

            {/* Items */}
            {current.entries.map(({ item, flag: rawFlag }, i) => {
              // If flag is null, try to find a matching one by title (check unresolved first, then resolved)
              const flag = rawFlag
                ?? analysis.flags.find(f => f.section === current.section && f.title === item.title && f.resolutionStatus !== 'ACTIONED')
                ?? analysis.flags.find(f => f.section === current.section && f.title === item.title)
                ?? null
              const flagId = flag?.id ?? `synthetic-${current.section}-${i}`
              const key = flagId
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
                      {isOpen && <div className="mt-2">{renderPayload(current.section, item.payload)}</div>}
                    </div>
                  )}

                  {/* Resolved note */}
                  {isResolved && flag?.resolutionNotes && (
                    <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      <span className="font-medium">Note:</span> {flag.resolutionNotes}
                    </div>
                  )}

                  {/* Action area — show for all unresolved items (with or without a DB flag) */}
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
                            {/* Accept Suggestion — one-click approve for LLM-suggested mappings */}
                            {(() => {
                              const payload = flag?.payload ?? item.payload ?? {}
                              const conf = typeof payload?.mappingConfidence === 'number' ? payload.mappingConfidence : typeof payload?.confidence === 'number' ? payload.confidence : typeof payload?.mappingConfidencePct === 'number' ? payload.mappingConfidencePct / 100 : null
                              const suggested = typeof payload?.suggestedCode === 'string' ? payload.suggestedCode : typeof payload?.candidateCodes?.[0] === 'string' ? payload.candidateCodes[0] : null
                              if (conf !== null && conf >= 0.5 && suggested) {
                                const suggestedEntry = CANTARA_TAXONOMY.find(e => e.code === suggested)
                                const suggestedLabel = suggestedEntry ? suggestedEntry.code.split('-').pop() ?? suggestedEntry.code : suggested
                                const confPct = Math.round(conf * 100)
                                return (
                                  <Button size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                    disabled={savingFlag === flagId}
                                    onClick={() => {
                                      setCodesByFlag(p => ({ ...p, [flagId]: suggested }))
                                      void submitAction(flagId, 'RESOLVE', { assignedCantaraCode: suggested })
                                    }}>
                                    Accept: {suggestedLabel} ({confPct}%)
                                  </Button>
                                )
                              }
                              return null
                            })()}
                            <Button size="sm" variant="outline" disabled={savingFlag === flagId || !isCodeValid}
                              onClick={() => void submitAction(flagId, 'RESOLVE', { assignedCantaraCode: code })}>
                              Confirm
                            </Button>
                            <Button size="sm" variant="outline" disabled={savingFlag === flagId}
                              onClick={() => void submitAction(flagId, 'OVERRIDE', { assignedCantaraCode: null, excludedFromMapping: true })}>
                              Exclude
                            </Button>
                            <Button size="sm" disabled={savingFlag === flagId}
                              onClick={() => void submitAction(flagId, 'ESCALATE_CLIENT')}>
                              <Send className="w-3 h-3" /> Escalate
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" disabled={savingFlag === flagId}
                              onClick={() => void submitAction(flagId, 'RESOLVE')}>
                              Acknowledge
                            </Button>
                            <Button size="sm" disabled={savingFlag === flagId}
                              onClick={() => void submitAction(flagId, 'ESCALATE_CLIENT')}>
                              <Send className="w-3 h-3" /> Escalate to Client
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Card>
  )
}
