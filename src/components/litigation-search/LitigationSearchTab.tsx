'use client'
import type { AgentTabReadOnlyProps } from '@/types/agent-tab'
import { agentTabReadOnlyGate } from '@/hooks/useAgentTabReadOnly'

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { Card, Badge, Button, cn } from '@/components/ui'
import {
  Search, Upload, FileText, AlertTriangle, Shield, ShieldAlert, ShieldCheck,
  ChevronDown, ChevronUp, ExternalLink, Calendar, Loader2, X, FileUp,
  CheckCircle, CheckCircle2, AlertCircle, Plus, RefreshCw, Scale, Play, Edit3, Eye,
} from 'lucide-react'
import type { LitigationSearchResult } from '@/lib/litigation-search/search'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import { AdvisorActions } from '@/components/client-portal/AgentClientPortalFrame'
import { buildLitigationReportHtml } from '@/lib/report-export/build-litigation-report'
import { useAgentAiProvider } from '@/hooks/useAgentAiProvider'
import { AgentRunToolbar } from '@/components/admin/AgentRunToolbar'
import { resolveAgentModelId } from '@/lib/agent-model-provider'
import { useGenericAgentRuns } from '@/hooks/useGenericAgentRuns'
import { AGENT_RUN_KEYS } from '@/lib/agent-run-keys'
import { saveAgentAnalysisRunClient } from '@/lib/agent-analysis-runs.client'
import type { AgentRunHistoryItem } from '@/components/admin/AgentRunHistoryPanel'
import { getAdminEmail, type DocumentStatus } from '@/lib/store'
import {
  fetchClientDocumentFile,
  listClientDocuments,
  type ClientUploadedDoc,
} from '@/lib/client-documents-client'

// ── US States ────────────────────────────────────────────────────────────────

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire',
  'New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio',
  'Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
  'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
  'Wisconsin','Wyoming',
]

const STATE_ABBR_TO_FULL: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
}

function resolveUsState(stateProp?: string, address?: string): string {
  if (stateProp) {
    const trimmed = stateProp.trim()
    if (US_STATES.includes(trimmed)) return trimmed
    const upper = trimmed.toUpperCase()
    if (STATE_ABBR_TO_FULL[upper]) return STATE_ABBR_TO_FULL[upper]
  }
  if (address) {
    for (const [abbr, full] of Object.entries(STATE_ABBR_TO_FULL)) {
      const regex = new RegExp(`\\b${abbr}\\b`, 'i')
      if (regex.test(address)) return full
    }
    for (const full of US_STATES) {
      if (address.toLowerCase().includes(full.toLowerCase())) return full
    }
  }
  return ''
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const RISK_CONFIG = {
  high:   { color: 'red'   as const, icon: ShieldAlert, label: 'High Risk',  bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700' },
  medium: { color: 'gold'  as const, icon: AlertTriangle, label: 'Medium Risk', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  low:    { color: 'blue'  as const, icon: Shield, label: 'Low Risk',    bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700' },
  clear:  { color: 'green' as const, icon: ShieldCheck, label: 'Clear',       bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
}

const TYPE_LABELS: Record<string, { label: string; color: 'red' | 'gold' | 'blue' | 'slate' }> = {
  litigation: { label: 'Litigation', color: 'red' },
  lien:       { label: 'Lien',       color: 'gold' },
  judgment:   { label: 'Judgment',   color: 'red' },
  ucc_filing: { label: 'UCC Filing', color: 'blue' },
  bankruptcy: { label: 'Bankruptcy', color: 'red' },
  other:      { label: 'Other',      color: 'slate' },
}

// ── Finding card ─────────────────────────────────────────────────────────────

function FindingCard({ finding }: { finding: LitigationSearchResult['findings'][number] }) {
  const typeInfo = TYPE_LABELS[finding.type] || TYPE_LABELS.other
  const sevInfo = RISK_CONFIG[finding.severity] || RISK_CONFIG.low

  return (
    <div className="border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge color={typeInfo.color}>{typeInfo.label}</Badge>
          <Badge color={sevInfo.color}>{sevInfo.label}</Badge>
        </div>
        {finding.date && (
          <span className="flex items-center gap-1 text-xs text-slate-400 whitespace-nowrap">
            <Calendar className="w-3 h-3" />
            {finding.date}
          </span>
        )}
      </div>
      <h4 className="text-sm font-semibold text-slate-800 mb-1">{finding.title}</h4>
      <p className="text-xs text-slate-500 leading-relaxed mb-2">{finding.description}</p>
      {finding.source && (
        <div className="flex items-center gap-1 text-xs text-blue-600">
          <ExternalLink className="w-3 h-3" />
          {finding.source.startsWith('http') ? (
            <a href={finding.source} target="_blank" rel="noopener noreferrer" className="hover:underline truncate max-w-[300px]">
              {finding.source}
            </a>
          ) : (
            <span className="text-slate-400">{finding.source}</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Results section ──────────────────────────────────────────────────────────

function ResultsSection({ title, result }: { title: string; result: LitigationSearchResult }) {
  const [showSearches, setShowSearches] = useState(false)
  const risk = RISK_CONFIG[result.riskLevel] || RISK_CONFIG.low
  const RiskIcon = risk.icon

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 tracking-tight">{title}</h3>
        <span className="text-[10px] text-slate-400">
          {new Date(result.generatedAt).toLocaleString()}
        </span>
      </div>

      {/* Risk badge */}
      <div className={cn('flex items-center gap-3 p-4 rounded-xl border', risk.bg, risk.border)}>
        <RiskIcon className={cn('w-5 h-5', risk.text)} />
        <div>
          <p className={cn('text-sm font-bold', risk.text)}>{risk.label}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {result.findings.length === 0 ? 'No public records found' : `${result.findings.length} finding${result.findings.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
        <p className="text-xs text-slate-600 leading-relaxed">{result.summary}</p>
      </div>

      {/* Findings */}
      {result.findings.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Findings</h4>
          {result.findings.map((f, i) => (
            <FindingCard key={i} finding={f} />
          ))}
        </div>
      )}

      {/* Searches performed */}
      {result.searchesPerformed.length > 0 && (
        <div>
          <button
            onClick={() => setShowSearches(!showSearches)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showSearches ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {result.searchesPerformed.length} searches performed
          </button>
          {showSearches && (
            <ul className="mt-2 space-y-1 pl-4">
              {result.searchesPerformed.map((s, i) => (
                <li key={i} className="text-xs text-slate-400 list-disc">{s}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function LitigationResultsEditor({
  title,
  result,
  onChange,
}: {
  title: string
  result: LitigationSearchResult
  onChange: (result: LitigationSearchResult) => void
}) {
  const patch = (updates: Partial<LitigationSearchResult>) => onChange({ ...result, ...updates })
  const updateFinding = (index: number, updates: Partial<LitigationSearchResult['findings'][number]>) => {
    patch({ findings: result.findings.map((finding, i) => (i === index ? { ...finding, ...updates } : finding)) })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-800 tracking-tight">{title}</h3>
        <select
          value={result.riskLevel}
          onChange={event => patch({ riskLevel: event.target.value as LitigationSearchResult['riskLevel'] })}
          className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-amber-100"
        >
          <option value="clear">Clear</option>
          <option value="low">Low Risk</option>
          <option value="medium">Medium Risk</option>
          <option value="high">High Risk</option>
        </select>
      </div>

      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Summary</p>
        <textarea
          value={result.summary}
          onChange={event => patch({ summary: event.target.value })}
          className="min-h-[110px] w-full rounded-xl border border-amber-300 bg-white p-3 text-xs leading-relaxed text-slate-700 outline-none focus:ring-2 focus:ring-amber-100"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Findings</p>
          <button
            className="text-xs font-semibold text-amber-700 hover:text-amber-800"
            onClick={() => patch({
              findings: [
                ...result.findings,
                { type: 'other', title: '', description: '', severity: 'low', source: '', date: '' },
              ],
            })}
          >
            + Add finding
          </button>
        </div>

        {result.findings.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
            No findings listed. Use Add finding if counsel identifies one manually.
          </div>
        ) : (
          result.findings.map((finding, index) => (
            <div key={index} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-4">
                <select
                  value={finding.type}
                  onChange={event => updateFinding(index, { type: event.target.value as any })}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs"
                >
                  {Object.keys(TYPE_LABELS).map(type => <option key={type} value={type}>{TYPE_LABELS[type].label}</option>)}
                </select>
                <select
                  value={finding.severity}
                  onChange={event => updateFinding(index, { severity: event.target.value as any })}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="clear">Clear</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <input
                  value={finding.date ?? ''}
                  onChange={event => updateFinding(index, { date: event.target.value })}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs"
                  placeholder="Date"
                />
                <button
                  className="justify-self-start text-xs text-red-500 hover:text-red-700 md:justify-self-end"
                  onClick={() => patch({ findings: result.findings.filter((_, i) => i !== index) })}
                >
                  Remove
                </button>
              </div>
              <input
                value={finding.title}
                onChange={event => updateFinding(index, { title: event.target.value })}
                className="mb-2 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold"
                placeholder="Finding title"
              />
              <textarea
                value={finding.description}
                onChange={event => updateFinding(index, { description: event.target.value })}
                className="mb-2 min-h-[80px] w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs leading-relaxed"
                placeholder="Description"
              />
              <input
                value={finding.source}
                onChange={event => updateFinding(index, { source: event.target.value })}
                className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs"
                placeholder="Source or URL"
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

interface LitigationSearchTabProps extends AgentTabReadOnlyProps {
  clientId: string
  clientName: string
  businessAddress?: string
  state?: string
  documentStatuses?: Record<string, DocumentStatus>
}

export default function LitigationSearchTab({
  clientId,
  clientName,
  businessAddress,
  state: initialState,
  documentStatuses,
  readOnly = false,
}: LitigationSearchTabProps) {
  // Search form state
  const [businessName, setBusinessName] = useState(clientName)
  const [ownerName, setOwnerName] = useState('')
  const [state, setState] = useState(() => resolveUsState(initialState, businessAddress))
  const [county, setCounty] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResult, setSearchResult] = useState<LitigationSearchResult | null>(null)
  const [searchError, setSearchError] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [composingNew, setComposingNew] = useState(false)

  // Portal documents state
  const [portalDocs, setPortalDocs] = useState<ClientUploadedDoc[]>([])
  const [loadingPortalDocs, setLoadingPortalDocs] = useState(false)
  const [isUploadingFile, setIsUploadingFile] = useState(false)

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [docResult, setDocResult] = useState<LitigationSearchResult | null>(null)
  const [docError, setDocError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [hydrated, setHydrated] = useState(false)
  const { provider, setProvider } = useAgentAiProvider()
  const {
    runs,
    historyItems,
    activeRun,
    activeId,
    setActiveId,
    reload: reloadRuns,
    loading: loadingRuns,
  } = useGenericAgentRuns(clientId, AGENT_RUN_KEYS.litigationSearch)

  useEffect(() => {
    if (!state) {
      const resolved = resolveUsState(initialState, businessAddress)
      if (resolved) setState(resolved)
    }
  }, [initialState, businessAddress, state])

  const loadPortalDocs = useCallback(async () => {
    setLoadingPortalDocs(true)
    try {
      const docs = await listClientDocuments(clientId, ['pending_litigation'])
      setPortalDocs(docs)
    } catch {
      /* ignore */
    } finally {
      setLoadingPortalDocs(false)
    }
  }, [clientId])

  useEffect(() => {
    void loadPortalDocs()
  }, [loadPortalDocs])

  useEffect(() => {
    let cancelled = false
    async function loadSaved() {
      if (loadingRuns) return
      if (activeRun?.report) {
        const payload = activeRun.report as { searchResult?: LitigationSearchResult; docResult?: LitigationSearchResult }
        if (payload.searchResult) setSearchResult(payload.searchResult)
        if (payload.docResult) setDocResult(payload.docResult)
        if (!cancelled) setHydrated(true)
        return
      }
      try {
        const res = await fetch(`/api/client-data/${clientId}?section=litigationSearch`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const savedSearch = data?.searchResult as LitigationSearchResult | undefined
        const savedDoc = data?.docResult as LitigationSearchResult | undefined
        if (cancelled) return
        if (savedSearch) setSearchResult(savedSearch)
        if (savedDoc) setDocResult(savedDoc)
      } catch {
        // Saved litigation output is optional.
      } finally {
        if (!cancelled) setHydrated(true)
      }
    }
    void loadSaved()
    return () => { cancelled = true }
  }, [clientId, activeRun, loadingRuns])

  function selectRun(run: AgentRunHistoryItem) {
    setActiveId(run.id)
    setComposingNew(false)
    const full = runs.find((item) => item.id === run.id)
    const payload = (full?.report ?? null) as { searchResult?: LitigationSearchResult; docResult?: LitigationSearchResult } | null
    if (payload?.searchResult) setSearchResult(payload.searchResult)
    if (payload?.docResult) setDocResult(payload.docResult)
  }

  const persistLitigationRun = async (nextSearch: LitigationSearchResult | null, nextDoc: LitigationSearchResult | null) => {
    await saveAgentAnalysisRunClient({
      clientId,
      agentKey: AGENT_RUN_KEYS.litigationSearch,
      fileName: `${clientName} — Litigation Search`,
      report: { searchResult: nextSearch, docResult: nextDoc },
      aiProvider: provider,
      aiModel: resolveAgentModelId(provider),
    })
    await reloadRuns({ selectNewest: true })
  }

  useEffect(() => {
    if (!searchResult && !docResult) return
    const timeout = window.setTimeout(() => {
      void saveResults()
    }, 500)
    return () => window.clearTimeout(timeout)
  }, [searchResult, docResult])

  const saveResults = useCallback(async () => {
    if (!searchResult && !docResult) return
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch(`/api/client-data/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'litigationSearch',
          data: {
            searchResult,
            docResult,
            generatedAt: new Date().toISOString(),
          },
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    } catch (err: any) {
      setSearchError(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [clientId, searchResult, docResult])

  // ── Search handler ─────────────────────────────────────────────────────────

  const handleSearch = useCallback(async () => {
    if (!businessName.trim() || !state) return
    setSearching(true)
    setSearchError('')
    setSearchResult(null)

    try {
      const res = await fetch('/api/litigation-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: businessName.trim(),
          ownerName: ownerName.trim(),
          state,
          county: county.trim(),
          provider,
          modelId: resolveAgentModelId(provider),
        }),
      })
      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || `Error ${res.status}`)
      }
      const data: LitigationSearchResult = await res.json()
      setSearchResult(data)
      setEditMode(false)
      setComposingNew(false)
      await persistLitigationRun(data, docResult)
    } catch (err: any) {
      setSearchError(err.message || 'Search failed')
    } finally {
      setSearching(false)
    }
  }, [businessName, ownerName, state, county, provider, docResult])

  // ── Document upload & analysis handler ──────────────────────────────────────

  const handleFileUpload = async (file: File) => {
    setIsUploadingFile(true)
    setDocError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('clientId', clientId)
      formData.append('documentId', 'pending_litigation')
      formData.append('uploaderEmail', getAdminEmail())
      const res = await fetch('/api/client-documents/upload', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        console.warn('Failed to upload file to portal docs:', await res.text())
      }
      setUploadFile(file)
      await loadPortalDocs()
    } catch (err: any) {
      setDocError(err?.message || 'File upload failed')
    } finally {
      setIsUploadingFile(false)
    }
  }

  const handleAnalyze = useCallback(async () => {
    let fileToAnalyze = uploadFile
    if (!fileToAnalyze && portalDocs.length > 0) {
      const doc = portalDocs[0]
      try {
        setAnalyzing(true)
        setDocError('')
        fileToAnalyze = await fetchClientDocumentFile({
          clientId,
          documentId: doc.documentId,
          recordId: doc.id,
          fileName: doc.fileName,
          mimeType: doc.mimeType,
        })
      } catch (err: any) {
        setDocError(err?.message || 'Failed to download disclosure document')
        setAnalyzing(false)
        return
      }
    }

    if (!fileToAnalyze) {
      setDocError('Please upload or select a document to analyze.')
      return
    }

    setAnalyzing(true)
    setDocError('')
    setDocResult(null)

    try {
      const formData = new FormData()
      formData.append('file', fileToAnalyze)
      formData.append('provider', provider)
      formData.append('modelId', resolveAgentModelId(provider))

      const res = await fetch('/api/litigation-search', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || `Error ${res.status}`)
      }
      const data: LitigationSearchResult = await res.json()
      setDocResult(data)
      setEditMode(false)
      setComposingNew(false)
      await persistLitigationRun(searchResult, data)
    } catch (err: any) {
      setDocError(err.message || 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }, [uploadFile, portalDocs, clientId, provider, searchResult])

  // ── Document readiness & calculations ───────────────────────────────────────

  const litigationStatus = documentStatuses?.['pending_litigation']
  const hasLitigationFiles =
    portalDocs.length > 0 ||
    Boolean(litigationStatus?.fileName) ||
    litigationStatus?.hasDoc === true ||
    Boolean(uploadFile)
  const isLitigationUnavailable =
    !hasLitigationFiles &&
    (litigationStatus?.hasDoc === false || Boolean(litigationStatus?.notApplicable))

  const hasExistingReport = Boolean(searchResult || docResult)
  const showActiveReport = Boolean(hasExistingReport && !composingNew)

  const combinedRisk = useMemo<'high' | 'medium' | 'low' | 'clear'>(() => {
    if (searchResult?.riskLevel === 'high' || docResult?.riskLevel === 'high') return 'high'
    if (searchResult?.riskLevel === 'medium' || docResult?.riskLevel === 'medium') return 'medium'
    if (searchResult?.riskLevel === 'low' || docResult?.riskLevel === 'low') return 'low'
    return 'clear'
  }, [searchResult, docResult])

  const totalFindings = (searchResult?.findings?.length ?? 0) + (docResult?.findings?.length ?? 0)
  const litigationCount = [
    ...(searchResult?.findings ?? []),
    ...(docResult?.findings ?? []),
  ].filter((f) => f.type === 'litigation' || f.type === 'judgment').length
  const lienCount = [
    ...(searchResult?.findings ?? []),
    ...(docResult?.findings ?? []),
  ].filter((f) => f.type === 'lien' || f.type === 'ucc_filing' || f.type === 'bankruptcy').length

  const combinedResult = useMemo<LitigationSearchResult | null>(() => {
    if (!searchResult && !docResult) return null
    if (searchResult && !docResult) return searchResult
    if (!searchResult && docResult) return docResult
    return {
      riskLevel: combinedRisk,
      summary: `Public Records Search: ${searchResult!.summary}\n\nDocument Analysis: ${docResult!.summary}`,
      findings: [...(searchResult!.findings || []), ...(docResult!.findings || [])],
      searchesPerformed: [
        ...(searchResult!.searchesPerformed || []),
        ...(docResult!.searchesPerformed || []),
      ],
      generatedAt: docResult!.generatedAt || searchResult!.generatedAt,
    }
  }, [searchResult, docResult, combinedRisk])

  const reportHtml = useMemo(() => {
    return combinedResult ? buildLitigationReportHtml(combinedResult, clientName) : ''
  }, [clientName, combinedResult])

  // ── Render ─────────────────────────────────────────────────────────────────

  const readOnlyGate = agentTabReadOnlyGate(
    readOnly,
    !hydrated,
    Boolean(searchResult || docResult),
    'Litigation & Liens',
  )
  if (readOnlyGate) return readOnlyGate

  return (
    <div className="space-y-6">
      {!readOnly && (
        <AgentRunToolbar
          provider={provider}
          onProviderChange={setProvider}
          disabled={searching || analyzing}
          historyItems={historyItems}
          activeId={activeId}
          onSelectRun={selectRun}
          activeProvider={activeRun?.aiProvider}
          activeModel={activeRun?.aiModel}
          activeVersion={activeRun?.version}
        />
      )}

      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="font-serif text-xl font-bold text-slate-900 tracking-tight">
            {showActiveReport
              ? 'Litigation & Lien Search Report'
              : composingNew
                ? 'New Litigation & Lien Search'
                : 'Litigation & Lien Search'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {showActiveReport
              ? `Public records, lien filings, court judgments & legal disclosures for ${clientName}`
              : `Search public records and analyze legal dispute disclosures for ${clientName}`}
          </p>
        </div>

        {!readOnly && (
          <div className="flex items-center gap-2 shrink-0">
            {showActiveReport && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setComposingNew(true)}
                  className="gap-1.5 h-8 text-xs font-medium text-slate-700 hover:text-slate-900 border-slate-200"
                >
                  <Plus className="w-3.5 h-3.5 text-slate-500" />
                  New Search
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditMode(!editMode)}
                  className="gap-1.5 h-8 text-xs font-medium text-slate-700"
                >
                  {editMode ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                  {editMode ? 'Preview Output' : 'Edit Output'}
                </Button>
                <ExportReportButton
                  html={reportHtml}
                  fileName={`litigation-report-${clientName.replace(/\s+/g, '-').toLowerCase()}`}
                  label="Export PDF"
                />
              </>
            )}
            {composingNew && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setComposingNew(false)}
                className="h-8 text-xs font-medium text-slate-700"
              >
                Cancel
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Active Report View ── */}
      {showActiveReport && (
        <div className="space-y-6">
          {/* 4 Executive KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className={cn('p-4 border', RISK_CONFIG[combinedRisk].bg, RISK_CONFIG[combinedRisk].border)}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Risk Level
                </span>
                {React.createElement(RISK_CONFIG[combinedRisk].icon, {
                  className: cn('w-4 h-4', RISK_CONFIG[combinedRisk].text),
                })}
              </div>
              <p className={cn('text-lg font-bold', RISK_CONFIG[combinedRisk].text)}>
                {RISK_CONFIG[combinedRisk].label}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {totalFindings === 0 ? 'No adverse records found' : `${totalFindings} total finding${totalFindings !== 1 ? 's' : ''}`}
              </p>
            </Card>

            <Card className="p-4 border border-slate-200 bg-white">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Public Records
                </span>
                <Search className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-lg font-bold text-slate-800">
                {searchResult ? `${searchResult.findings.length} Record${searchResult.findings.length !== 1 ? 's' : ''}` : 'Not Run'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {searchResult ? `${searchResult.searchesPerformed.length} queries executed` : 'Registry query'}
              </p>
            </Card>

            <Card className="p-4 border border-slate-200 bg-white">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Litigation & Liens
                </span>
                <Scale className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-lg font-bold text-slate-800">
                {litigationCount} Court / {lienCount} Lien
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {litigationCount + lienCount === 0 ? 'Clear public docket' : 'Recorded filings'}
              </p>
            </Card>

            <Card className="p-4 border border-slate-200 bg-white">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Client Disclosure
                </span>
                <FileText className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-lg font-bold text-slate-800 truncate">
                {hasLitigationFiles
                  ? `${portalDocs.length + (uploadFile ? 1 : 0)} Disclosed`
                  : isLitigationUnavailable
                    ? 'No Disputes'
                    : 'None Provided'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                {docResult
                  ? 'AI analysis complete'
                  : hasLitigationFiles
                    ? 'Document attached'
                    : 'Client portal disclosure'}
              </p>
            </Card>
          </div>

          {/* Diligence Findings & Search Results */}
          <Card className="p-6 space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Diligence Findings & Search Results</h3>
              <div className="flex items-center gap-2">
                {saving && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-slate-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving…
                  </span>
                )}
                {saved && !saving && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Saved
                  </span>
                )}
              </div>
            </div>

            {editMode && !readOnly ? (
              <div className="space-y-8">
                {searchResult && (
                  <LitigationResultsEditor title="Web Search Results" result={searchResult} onChange={setSearchResult} />
                )}
                {searchResult && docResult && <hr className="border-slate-100" />}
                {docResult && (
                  <LitigationResultsEditor title="Document Analysis Results" result={docResult} onChange={setDocResult} />
                )}
              </div>
            ) : (
              <>
                {searchResult && (
                  <ResultsSection title="Web Search Results" result={searchResult} />
                )}
                {searchResult && docResult && (
                  <hr className="border-slate-100" />
                )}
                {docResult && (
                  <ResultsSection title="Document Analysis Results" result={docResult} />
                )}
              </>
            )}
          </Card>
        </div>
      )}

      {/* ── Search & Document Workspace (Shown when no report or composing new) ── */}
      {(!showActiveReport || composingNew) && (
        <div className="space-y-6">
          {/* Sector 1: Optional Client Disclosure Document */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Optional Legal Disclosure Document
                </h4>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {hasLitigationFiles
                    ? `${portalDocs.length + (uploadFile ? 1 : 0)} uploaded`
                    : '0 of 1 uploaded'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void loadPortalDocs()}
                disabled={loadingPortalDocs}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn('w-3 h-3', loadingPortalDocs && 'animate-spin')} />
                Refresh
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Disclosure of any active, pending, or threatened litigation, arbitrations, regulatory proceedings, or formal disputes from the client portal.
            </p>

            {/* Valuation-consistent card row */}
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                const file = e.dataTransfer.files?.[0]
                if (file) void handleFileUpload(file)
              }}
              className={cn(
                'p-4 rounded-xl border transition-all',
                dragOver
                  ? 'border-amber-400 bg-amber-50/50'
                  : hasLitigationFiles
                    ? 'border-slate-200 bg-white hover:border-slate-300'
                    : 'border-slate-200 bg-slate-50/50 hover:border-amber-200 hover:bg-amber-50/20',
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                        hasLitigationFiles
                          ? 'bg-emerald-50 text-emerald-600'
                          : isLitigationUnavailable
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-slate-100 text-slate-400',
                      )}
                    >
                      <FileText className="w-4.5 h-4.5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-800">
                          Pending Litigation / Legal Disputes
                        </p>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                          Optional
                        </span>

                        {hasLitigationFiles ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Uploaded
                          </span>
                        ) : isLitigationUnavailable ? (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                            No active litigation / Not applicable
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-50 text-slate-400 border border-slate-200">
                            Not provided
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Disclosure of any active, pending, or threatened litigation, court judgments, or legal dispute documents.
                      </p>

                      {/* Uploaded file chips */}
                      {hasLitigationFiles && (
                        <div className="flex flex-wrap gap-2 mt-2.5">
                          {portalDocs.map((doc, idx) => (
                            <a
                              key={doc.id || idx}
                              href={`/api/client-documents/view?clientId=${encodeURIComponent(clientId)}&documentId=pending_litigation&recordId=${encodeURIComponent(doc.id)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-emerald-200 text-emerald-900 shadow-2xs hover:bg-emerald-50 transition-colors"
                              title="Click to view file in new tab"
                            >
                              <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="truncate max-w-[240px] font-medium">{doc.fileName}</span>
                              {doc.uploadedAt && (
                                <span className="text-[10px] text-slate-400 font-normal">
                                  · {new Date(doc.uploadedAt).toLocaleDateString()}
                                </span>
                              )}
                              <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-semibold">
                                Active
                              </span>
                            </a>
                          ))}

                          {uploadFile && !portalDocs.some((d) => d.fileName === uploadFile.name) && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-amber-200 text-slate-800 shadow-2xs">
                              <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span className="truncate max-w-[220px] font-medium">{uploadFile.name}</span>
                              <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-semibold">
                                Local
                              </span>
                              {!readOnly && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUploadFile(null)
                                    setDocResult(null)
                                  }}
                                  className="text-slate-400 hover:text-rose-500 transition-colors ml-0.5"
                                  title="Remove file"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                {!readOnly && (
                  <div className="flex items-center gap-2 shrink-0 pt-0.5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) void handleFileUpload(f)
                        e.target.value = ''
                      }}
                      disabled={isUploadingFile || analyzing}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingFile || analyzing}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                    >
                      {isUploadingFile ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Uploading…
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5 text-slate-500" />
                          {hasLitigationFiles ? 'Replace' : 'Upload'}
                        </>
                      )}
                    </button>

                    {hasLitigationFiles && (
                      <Button
                        size="sm"
                        onClick={() => void handleAnalyze()}
                        disabled={analyzing || isUploadingFile}
                        className="gap-1.5 h-8 text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        {analyzing ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Analyzing…
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5" />
                            Analyze Document
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {docError && (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-lg">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{docError}</span>
              </div>
            )}
          </div>

          {/* Sector 2: Public Records & Lien Search */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Public Records & Lien Search
              </h4>
            </div>
            <p className="text-xs text-slate-500">
              Search state and county public records, UCC lien registries, civil court judgments, and bankruptcy dockets.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Legal Business Name */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Legal Business Name
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 bg-white"
                  placeholder="e.g. Downtown Dog Lounge LLC"
                  disabled={searching}
                />
              </div>

              {/* Owner Name */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Owner Name(s)
                </label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 bg-white"
                  placeholder="e.g. John Smith"
                  disabled={searching}
                />
              </div>

              {/* State */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">State</label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 bg-white"
                  disabled={searching}
                >
                  <option value="">Select state...</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* County */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  County <span className="text-slate-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={county}
                  onChange={(e) => setCounty(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 bg-white"
                  placeholder="e.g. Los Angeles"
                  disabled={searching}
                />
              </div>
            </div>

            {searchError && (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-lg">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{searchError}</span>
              </div>
            )}

            {/* Action Footer */}
            <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-xs">
                {businessName.trim() && state ? (
                  <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    Search parameters ready. You can query public records.
                  </span>
                ) : (
                  <span className="text-amber-800 font-medium flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    Enter business name and select state to search public records.
                  </span>
                )}
              </div>

              <Button
                size="sm"
                onClick={handleSearch}
                disabled={searching || !businessName.trim() || !state}
                className="gap-1.5 h-8 text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {searching ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Searching Public Records…
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    Search Public Records
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
