'use client'
import { agentTabReadOnlyGate } from '@/hooks/useAgentTabReadOnly'
import type { AgentTabReadOnlyProps } from '@/types/agent-tab'

import {
  Bot,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Loader2,
  Printer,
  RotateCcw,
  RotateCw,
  Save,
  Sparkles,
  Circle,
  AlertCircle,
  Clock,
  ExternalLink,
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { Card, Button, Input, Badge, Textarea, cn } from '@/components/ui'
import { TeaserInputData, DEFAULT_TEASER_INPUT } from '@/lib/teaser/types'
import { generateTeaserHtml } from '@/lib/teaser/generate-html'
import MondayLinker from '@/components/monday/MondayLinker'
import { useAgentAiProvider } from '@/hooks/useAgentAiProvider'
import { AgentRunToolbar } from '@/components/admin/AgentRunToolbar'
import { resolveAgentModelId } from '@/lib/agent-model-provider'
import { useGenericAgentRuns } from '@/hooks/useGenericAgentRuns'
import { AGENT_RUN_KEYS } from '@/lib/agent-run-keys'
import { saveAgentAnalysisRunClient } from '@/lib/agent-analysis-runs.client'
import type { AgentRunHistoryItem } from '@/components/admin/AgentRunHistoryPanel'
import { AdvisorActions } from '@/components/client-portal/AgentClientPortalFrame'

interface Props extends AgentTabReadOnlyProps {
  clientId: string
  clientName: string
  onOpenAgent?: (tabKey: string) => void
}

interface PrerequisiteItem {
  key: string
  tabKey: string
  label: string
  note: string
}

const TEASER_PREREQUISITES: PrerequisiteItem[] = [
  {
    key: 'ttmAnalysis',
    tabKey: 'ttm',
    label: 'Financial Analysis & Valuation',
    note: 'Historical revenue, gross margin, TTM summary, plus Recast add-backs / normalized EBITDA / valuation band when completed on the Valuation tab.',
  },
  {
    key: 'lease',
    tabKey: 'lease',
    label: 'Commercial Lease Analysis',
    note: 'Facility profile, square footage, lease term, rent, and renewal options.',
  },
  {
    key: 'competitor',
    tabKey: 'competitor',
    label: 'Competitor & Market Analysis',
    note: 'Competitive positioning, market landscape, and market advantages.',
  },
  {
    key: 'employeeObligations',
    tabKey: 'employee-obligations',
    label: 'Employee Obligations (WS1-6)',
    note: 'Workforce overview, key team members, and operational staffing.',
  },
  {
    key: 'digitalPresence',
    tabKey: 'digital',
    label: 'Digital Presence & Brand Report',
    note: 'Website performance, Google reviews, and online brand footprint.',
  },
  {
    key: 'insuranceReview',
    tabKey: 'insurance',
    label: 'Insurance Review',
    note: 'Insurance claims history and coverage context used when drafting teaser risk notes.',
  },
]

export default function TeaserGeneratorTab({ clientId, clientName, readOnly = false, onOpenAgent }: Props) {
  const [status, setStatus] = useState<'idle' | 'auto-filling' | 'editing' | 'preview'>('idle')
  const [data, setData] = useState<TeaserInputData>(DEFAULT_TEASER_INPUT)
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [teaserFileUrl, setTeaserFileUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [prereqs, setPrereqs] = useState<Record<string, boolean> | null>(null)
  const [draftLoaded, setDraftLoaded] = useState(false)
  const { provider, setProvider } = useAgentAiProvider()
  const {
    runs,
    historyItems,
    activeRun,
    activeId,
    setActiveId,
    reload: reloadRuns,
    loading: loadingRuns,
  } = useGenericAgentRuns(clientId, AGENT_RUN_KEYS.teaser)

  const [refreshing, setRefreshing] = useState(false)

  const handleOpenAgent = useCallback(
    (tabKey: string) => {
      if (onOpenAgent) {
        onOpenAgent(tabKey)
      } else {
        window.location.href = `/admin/client/${clientId}?tab=${tabKey}`
      }
    },
    [onOpenAgent, clientId],
  )

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const res = await fetch(`/api/agent-status?clientId=${clientId}`, { cache: 'no-store' })
      if (res.ok) {
        const d = await res.json()
        setPrereqs(d)
      }
    } catch {
      // ignore
    } finally {
      setRefreshing(false)
    }
  }

  // ── Load prerequisite agent status ──────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/agent-status?clientId=${clientId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setPrereqs(data) })
      .catch(() => {})
  }, [clientId])

  // ── Load Draft ─────────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadDraft() {
      try {
        const res = await fetch(`/api/teaser/draft?clientId=${clientId}`)
        if (res.ok) {
          const { draft } = await res.json()
          if (draft) {
            const merged = { ...DEFAULT_TEASER_INPUT, ...draft } as TeaserInputData
            if (!Array.isArray(merged.investmentHighlights) || merged.investmentHighlights.length !== 5) {
              merged.investmentHighlights = DEFAULT_TEASER_INPUT.investmentHighlights
            }
            setData(merged)
            setStatus('editing')
          }
        }
      } catch (e) {
        console.error('Failed to load Teaser draft:', e)
      } finally {
        setDraftLoaded(true)
      }
    }
    void loadDraft()
  }, [clientId])

  useEffect(() => {
    if (loadingRuns) return
    if (!activeRun?.report) return
    const payload = activeRun.report as { data?: TeaserInputData; generatedHtml?: string }
    if (payload.data) {
      const merged = { ...DEFAULT_TEASER_INPUT, ...payload.data } as TeaserInputData
      if (!Array.isArray(merged.investmentHighlights) || merged.investmentHighlights.length !== 5) {
        merged.investmentHighlights = DEFAULT_TEASER_INPUT.investmentHighlights
      }
      setData(merged)
      setStatus(payload.generatedHtml ? 'preview' : 'editing')
    }
    if (payload.generatedHtml) setGeneratedHtml(payload.generatedHtml)
  }, [activeRun, loadingRuns])

  function selectRun(run: AgentRunHistoryItem) {
    setActiveId(run.id)
    const full = runs.find((item) => item.id === run.id)
    const payload = (full?.report ?? null) as { data?: TeaserInputData; generatedHtml?: string } | null
    if (payload?.data) {
      const merged = { ...DEFAULT_TEASER_INPUT, ...payload.data } as TeaserInputData
      if (!Array.isArray(merged.investmentHighlights) || merged.investmentHighlights.length !== 5) {
        merged.investmentHighlights = DEFAULT_TEASER_INPUT.investmentHighlights
      }
      setData(merged)
      setStatus(payload.generatedHtml ? 'preview' : 'editing')
    }
    if (payload?.generatedHtml) setGeneratedHtml(payload.generatedHtml)
  }

  const hasOutput = status === 'editing' || status === 'preview' || Boolean(data.businessOverview?.trim() || data.annualRevenue?.trim())
  const readOnlyGate = agentTabReadOnlyGate(readOnly, !draftLoaded, hasOutput, 'Deal Teaser Generator')
  if (readOnlyGate) return readOnlyGate

  if (readOnly) {
    const html = generatedHtml ?? generateTeaserHtml(data)
    return (
      <div className="space-y-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
              <Eye className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Deal Teaser</h3>
              <p className="text-xs text-slate-400">Approved teaser for {clientName}</p>
            </div>
          </div>
        </Card>
        <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-lg">
          <iframe
            srcDoc={html}
            className="w-full border-0"
            style={{ height: '80vh' }}
            title="Teaser Preview"
          />
        </div>
      </div>
    )
  }

  const saveDraft = async (payload?: TeaserInputData) => {
    const toSave = payload ?? data
    setSaving(true)
    setSaveSuccess(false)
    try {
      const res = await fetch('/api/teaser/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, data: toSave }),
      })
      if (!res.ok) throw new Error('Failed to save draft')
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function set<K extends keyof TeaserInputData>(key: K, value: TeaserInputData[K]) {
    setData(prev => ({ ...prev, [key]: value }))
  }

  function setHighlight(index: number, field: 'title' | 'description', value: string) {
    setData(prev => {
      const updated = [...prev.investmentHighlights]
      updated[index] = { ...updated[index], [field]: value }
      return { ...prev, investmentHighlights: updated }
    })
  }

  const autoFill = async () => {
    setStatus('auto-filling')
    setError(null)
    try {
      const res = await fetch('/api/teaser/auto-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, provider, modelId: resolveAgentModelId(provider) }),
      })
      if (!res.ok) throw new Error(await res.text() || 'Failed to auto-fill')
      const filled = await res.json()
      // The response may have a nested structure with autoFilled key or be flat
      const raw = filled.autoFilled || filled
      const inputData = { ...DEFAULT_TEASER_INPUT, ...raw } as TeaserInputData
      if (!Array.isArray(inputData.investmentHighlights) || inputData.investmentHighlights.length !== 5) {
        inputData.investmentHighlights = DEFAULT_TEASER_INPUT.investmentHighlights
      }
      setData(inputData)
      await saveDraft(inputData)
      setStatus('editing')
    } catch (err: any) {
      setError(err.message || 'Auto-fill failed')
      setStatus('idle')
    }
  }

  const generate = async () => {
    console.log('[Teaser] Generating with data:', data)
    try {
      setError(null)
      const html = generateTeaserHtml(data)
      console.log('[Teaser] HTML generated successfully, length:', html.length)
      setGeneratedHtml(html)
      setStatus('preview')
      await saveAgentAnalysisRunClient({
        clientId,
        agentKey: AGENT_RUN_KEYS.teaser,
        fileName: `${clientName} — Teaser`,
        report: { data, generatedHtml: html },
        aiProvider: provider,
        aiModel: resolveAgentModelId(provider),
      })
      await reloadRuns({ selectNewest: true })
    } catch (err: any) {
      console.error('[Teaser] Generation error:', err)
      setError(err.message || 'Failed to generate teaser')
    }
  }

  const downloadHtml = () => {
    if (!generatedHtml) return
    const blob = new Blob([generatedHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const safeName = (clientName || 'client').replace(/\s+/g, '-').toLowerCase()
    a.download = `${safeName}-teaser-${new Date().toISOString().slice(0, 10)}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const printTeaser = () => {
    if (!generatedHtml) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(generatedHtml)
    win.document.close()
    setTimeout(() => win.print(), 500)
  }

  const runToolbar = (
    <AgentRunToolbar
      provider={provider}
      onProviderChange={setProvider}
      disabled={status === 'auto-filling'}
      historyItems={historyItems}
      activeId={activeId}
      onSelectRun={selectRun}
      activeProvider={activeRun?.aiProvider}
      activeModel={activeRun?.aiModel}
      activeVersion={activeRun?.version}
    />
  )

  // ---------- IDLE STATE ----------
  if (status === 'idle') {
    const completedCount = prereqs ? TEASER_PREREQUISITES.filter(p => prereqs[p.key]).length : 0
    const allComplete = prereqs ? TEASER_PREREQUISITES.every(p => prereqs[p.key]) : false

    return (
      <div className="space-y-6">
        {runToolbar}

        {/* Unified Serif Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200">
          <div>
            <h3 className="font-serif text-xl font-bold text-slate-900 tracking-tight">Deal Teaser Generator</h3>
            <p className="text-xs text-slate-500 mt-0.5">Generate a professional 2-page blind investment teaser from client data across upstream agents.</p>
          </div>
          <AdvisorActions>
            <a
              href="/samples/Cantara_Deal_Teaser_v2.docx"
              download="Cantara_Deal_Teaser_v2.docx"
              className="inline-flex items-center gap-2 font-medium transition-all rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 px-3 py-1.5 text-xs bg-white shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              Download sample teaser
            </a>
          </AdvisorActions>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        {/* Prerequisite agent checklist */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Optional Context Agent Outputs
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Teaser generation synthesizes these optional agent outputs (plus insurance claims context when available) into a blind 2-page investment profile. Missing agents leave empty sections you can edit manually.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge color={allComplete ? 'green' : completedCount > 0 ? 'gold' : 'slate'} className="text-xs px-2.5 py-1">
                {completedCount} of {TEASER_PREREQUISITES.length} complete
              </Badge>
              <button
                type="button"
                onClick={() => void handleRefresh()}
                disabled={refreshing}
                title="Refresh live agent status"
                className="inline-flex items-center justify-center p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50"
              >
                <RotateCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin text-amber-600')} />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {TEASER_PREREQUISITES.map(p => {
              const isReady = prereqs?.[p.key] ?? false
              return (
                <div
                  key={p.key}
                  className={cn(
                    'flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border transition-all',
                    isReady
                      ? 'border-emerald-200/80 bg-emerald-50/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  )}
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className={cn(
                        'p-2.5 rounded-lg border shrink-0',
                        isReady
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                          : 'bg-slate-50 border-slate-200 text-slate-400'
                      )}
                    >
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900">
                          {p.label}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          Optional
                        </span>
                        {isReady ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Not generated
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{p.note}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenAgent(p.tabKey)}
                      className="text-xs text-slate-700 border-slate-200 hover:bg-slate-100 h-8 px-3"
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                      Open Agent
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Status alert */}
          {allComplete ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h5 className="text-xs font-semibold text-emerald-900">All Prerequisite Agents Ready</h5>
                <p className="text-xs text-emerald-700 mt-0.5">
                  All upstream agents have completed analysis runs. The auto-fill engine will pull available financial, operational, competitive, and insurance context into the teaser draft.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h5 className="text-xs font-semibold text-amber-900">Incomplete Prerequisite Agents</h5>
                <p className="text-xs text-amber-700 mt-0.5">
                  Some agents have not been run yet. You can still auto-fill the teaser with available data, but pending chapters will leave corresponding fields empty for manual completion.
                </p>
              </div>
            </div>
          )}

          {/* Acknowledgment checkbox */}
          {!allComplete && (
            <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/50 text-xs text-slate-600 cursor-pointer hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={e => setAcknowledged(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span>
                I understand that some prerequisite agents are not complete and wish to proceed with partial data auto-fill.
              </span>
            </label>
          )}

          {/* Readiness Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              {completedCount > 0 ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{completedCount} of {TEASER_PREREQUISITES.length} agent outputs ready for synthesis</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>No prerequisite outputs yet. Auto-fill will populate defaults.</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                size="lg"
                onClick={autoFill}
                disabled={!allComplete && !acknowledged}
                className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs px-6 py-2.5 h-auto shadow-sm"
              >
                <Sparkles className="w-4 h-4 mr-2 text-amber-400" />
                Auto-Fill Teaser
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ---------- AUTO-FILLING STATE ----------
  if (status === 'auto-filling') {
    return (
      <div className="space-y-6">
        {runToolbar}
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-2xs flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
          </div>
          <div className="space-y-1">
            <h4 className="text-base font-semibold text-slate-900">Auto-Filling Deal Teaser...</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Synthesizing financial performance, commercial lease highlights, competitive landscape, staffing model, and digital authority into teaser draft...
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ---------- PREVIEW STATE ----------
  if (status === 'preview' && generatedHtml) {
    return (
      <div className="space-y-6">
        {runToolbar}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200">
          <div>
            <h3 className="font-serif text-xl font-bold text-slate-900 tracking-tight">Deal Teaser Preview</h3>
            <p className="text-xs text-slate-500 mt-0.5">Review the generated teaser below. Print, download as HTML, or edit fields as needed.</p>
          </div>
          <AdvisorActions>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatus('editing')}
              className="text-xs h-8"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Back to Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadHtml}
              className="text-xs h-8"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              Download HTML
            </Button>
            <Button
              size="sm"
              onClick={printTeaser}
              className="text-xs h-8 bg-slate-900 hover:bg-slate-800 text-white"
            >
              <Printer className="w-3.5 h-3.5 mr-1" />
              Print / Save PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatus('idle')
                setGeneratedHtml(null)
              }}
              className="text-xs h-8 text-slate-600 hover:text-slate-900"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              + New Analysis
            </Button>
          </AdvisorActions>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        <MondayLinker clientId={clientId} clientName={clientName} reportType="Teaser" fileUrl={teaserFileUrl} html={generatedHtml} />

        <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-lg">
          <iframe
            srcDoc={generatedHtml}
            className="w-full border-0"
            style={{ height: '80vh' }}
            title="Deal Teaser Preview"
          />
        </div>
      </div>
    )
  }

  // ---------- EDITING STATE ----------
  const OVERVIEW_FIELDS = [
    { key: 'facilityProfile' as const, label: 'Facility Profile (teaser PDF: one bullet per line)' },
    { key: 'ownershipManagement' as const, label: 'Ownership & Management (teaser PDF: one bullet per line)' },
    { key: 'clientProfile' as const, label: 'Client Profile (teaser PDF: one bullet per line)' },
    { key: 'staffOperations' as const, label: 'Staff & Operations (teaser PDF: one bullet per line)' },
    { key: 'realEstate' as const, label: 'Real Estate (teaser PDF: one bullet per line)' },
    { key: 'technology' as const, label: 'Technology (teaser PDF: one bullet per line)' },
    { key: 'permitsZoning' as const, label: 'Permits & Zoning (teaser PDF: one bullet per line)' },
  ]

  return (
    <div className="space-y-6">
      {runToolbar}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h3 className="font-serif text-xl font-bold text-slate-900 tracking-tight">Deal Teaser — Edit & Review</h3>
          <p className="text-xs text-slate-500 mt-0.5">Review the auto-filled data below. Edit any fields, then generate the teaser.</p>
        </div>
        <AdvisorActions>
          <a
            href="/samples/Cantara_Deal_Teaser_v2.docx"
            download="Cantara_Deal_Teaser_v2.docx"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            Download sample teaser
          </a>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void saveDraft()}
            disabled={saving}
            className="text-xs h-8"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
            ) : saveSuccess ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mr-1" />
            ) : (
              <Save className="w-3.5 h-3.5 mr-1" />
            )}
            {saveSuccess ? (
              <span className="text-emerald-600 font-semibold flex items-center gap-1 animate-pulse">Saved</span>
            ) : (
              'Save Draft'
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={autoFill}
            className="text-xs h-8"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-500" />
            Re-fill
          </Button>
          <Button
            size="sm"
            onClick={() => void generate()}
            className="text-xs h-8 bg-slate-900 hover:bg-slate-800 text-white"
          >
            <Bot className="w-3.5 h-3.5 mr-1 text-amber-400" />
            Generate Teaser
          </Button>
        </AdvisorActions>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {/* Section 1: Branding */}
      <Card className="p-5 space-y-4">
        <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest">Cover & Branding</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input label="Business Display Name" value={data.businessDisplayName} onChange={e => set('businessDisplayName', e.target.value)} />
          <Input label="Subtitle" value={data.teaserSubtitle} onChange={e => set('teaserSubtitle', e.target.value)} />
          <Input label="Region" value={data.regionLabel} onChange={e => set('regionLabel', e.target.value)} />
        </div>
        <Input
          label="Cantara deal reference #"
          value={data.dealReference ?? ''}
          onChange={e => set('dealReference', e.target.value)}
          placeholder="e.g. CD-2026-0142"
        />
        <p className="text-[11px] text-slate-500">When filled in, this reference is printed on the teaser cover (exported PDF).</p>
      </Card>

      {/* Section 2: Transaction Snapshot */}
      <Card className="p-5 space-y-4">
        <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest">Transaction Snapshot</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Input label="Deal Type" value={data.dealType} onChange={e => set('dealType', e.target.value)} />
          <Input label="Location" value={data.location} onChange={e => set('location', e.target.value)} />
          <Input label="Revenue Range" value={data.revenueRange} onChange={e => set('revenueRange', e.target.value)} />
          <Input label="Service Model" value={data.serviceModel} onChange={e => set('serviceModel', e.target.value)} />
          <Input label="Facility Capacity" value={data.facilityCapacity} onChange={e => set('facilityCapacity', e.target.value)} />
          <Input label="Process Stage" value={data.processStage} onChange={e => set('processStage', e.target.value)} />
        </div>
      </Card>

      {/* Section 3: Business narrative (PDF sections 01 & 02) */}
      <Card className="p-5 space-y-4">
        <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest">Section 01 — Transaction snapshot</p>
        <Textarea
          label="Deal at a glance"
          value={data.businessOverview}
          onChange={e => set('businessOverview', e.target.value)}
          rows={3}
        />

        <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest pt-2">Section 02 — Business overview (Deal Teaser PDF only)</p>
        <p className="text-[11px] text-slate-500 -mt-1">
          These fields control <span className="font-medium text-slate-600">02 — Business overview</span> in the <span className="font-medium text-slate-600">Deal Teaser</span> export only. The CIM uses its own template.
        </p>
        <Input
          label='Headline under "Business Overview"'
          value={data.overviewHeadline}
          onChange={e => set('overviewHeadline', e.target.value)}
          placeholder="e.g. A Purpose-Built Premium Pet Resort"
        />
        <Textarea
          label="Summary under headline"
          value={data.section02LeadSummary}
          onChange={e => set('section02LeadSummary', e.target.value)}
          rows={3}
          placeholder="One paragraph as a single line — or several lines; each line becomes its own bullet in the teaser PDF."
        />
        <p className="text-[11px] text-slate-500">
          The labeled boxes below map to the teaser reference layout: each line becomes one bullet in the PDF (Facility Profile, Ownership &amp; Management, etc.).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {OVERVIEW_FIELDS.map(({ key, label }) => (
            <Textarea key={key} label={label} value={data[key]} onChange={e => set(key, e.target.value)} rows={4} />
          ))}
        </div>
      </Card>

      {/* Section 4: Financial Highlights */}
      <Card className="p-5 space-y-4">
        <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest">Financial Highlights</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Input label="Annual Revenue" value={data.annualRevenue} onChange={e => set('annualRevenue', e.target.value)} />
          <Input label="Revenue Growth" value={data.revenueGrowth} onChange={e => set('revenueGrowth', e.target.value)} />
          <Input label="Normalized EBITDA" value={data.normalizedEbitda} onChange={e => set('normalizedEbitda', e.target.value)} />
          <Input label="EBITDA Margin" value={data.ebitdaMargin} onChange={e => set('ebitdaMargin', e.target.value)} />
          <Input label="Revenue Mix" value={data.revenueMix} onChange={e => set('revenueMix', e.target.value)} />
          <Input label="Buyer Capex" value={data.buyerCapex} onChange={e => set('buyerCapex', e.target.value)} />
        </div>
      </Card>

      {/* Section 5: Investment Highlights */}
      <Card className="p-5 space-y-4">
        <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest">Investment Highlights</p>

        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pt-2">Business Strengths (1-2)</p>
        <div className="space-y-4">
          {data.investmentHighlights.slice(0, 2).map((h, i) => (
            <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-slate-800 text-amber-400 flex items-center justify-center text-xs font-bold">0{i + 1}</span>
                <Input label="" placeholder="Strength title" value={h.title} onChange={e => setHighlight(i, 'title', e.target.value)} className="flex-1" />
              </div>
              <Textarea placeholder="Description..." value={h.description} onChange={e => setHighlight(i, 'description', e.target.value)} rows={2} />
            </div>
          ))}
        </div>

        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pt-2">Growth Opportunities (3-5)</p>
        <div className="space-y-4">
          {data.investmentHighlights.slice(2).map((h, i) => (
            <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-slate-800 text-amber-400 flex items-center justify-center text-xs font-bold">0{i + 3}</span>
                <Input label="" placeholder="Opportunity title" value={h.title} onChange={e => setHighlight(i + 2, 'title', e.target.value)} className="flex-1" />
              </div>
              <Textarea placeholder="Description..." value={h.description} onChange={e => setHighlight(i + 2, 'description', e.target.value)} rows={2} />
            </div>
          ))}
        </div>
      </Card>

      {/* Section 6: Contact */}
      <Card className="p-5 space-y-4">
        <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest">Contact & NDA Information</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Input label="Contact Name" value={data.contactName} onChange={e => set('contactName', e.target.value)} />
          <Input label="Title" value={data.contactTitle} onChange={e => set('contactTitle', e.target.value)} />
          <Input label="Email" value={data.contactEmail} onChange={e => set('contactEmail', e.target.value)} />
          <Input label="Buyer NDA Link" placeholder="https://..." value={data.ndaLink || ''} onChange={e => set('ndaLink', e.target.value)} />
        </div>
      </Card>

      {/* Generate Button */}
      <div className="flex justify-end pt-4 border-t border-slate-200">
        <Button
          size="lg"
          onClick={() => void generate()}
          className="bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs px-6 py-2.5 h-auto shadow-sm"
        >
          <Bot className="w-4 h-4 mr-2 text-amber-400" />
          Generate Teaser
        </Button>
      </div>
    </div>
  )
}
