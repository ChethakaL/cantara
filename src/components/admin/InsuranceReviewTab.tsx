'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot, CheckCircle, FileText, Loader2, RefreshCw, Trash2, Upload } from 'lucide-react'
import { Badge, Button } from '@/components/ui'
import { getAdminEmail } from '@/lib/store'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import { AdvisorActions } from '@/components/client-portal/AgentClientPortalFrame'
import { agentTabReadOnlyGate } from '@/hooks/useAgentTabReadOnly'
import { ClientApprovedEmptyState } from '@/components/client-portal/AgentClientPortalFrame'
import { buildInsuranceReportHtml } from '@/lib/report-export/build-insurance-report'
import { useAgentAiProvider } from '@/hooks/useAgentAiProvider'
import { AgentRunToolbar } from '@/components/admin/AgentRunToolbar'
import { resolveAgentModelId } from '@/lib/agent-model-provider'
import { useGenericAgentRuns } from '@/hooks/useGenericAgentRuns'
import { AGENT_RUN_KEYS } from '@/lib/agent-run-keys'
import { saveAgentAnalysisRunClient } from '@/lib/agent-analysis-runs.client'
import type { AgentRunHistoryItem } from '@/components/admin/AgentRunHistoryPanel'

interface InsuranceSummary {
  summary: string
  claimType?: string | null
  incidentDate?: string | null
  withinLast12Months?: boolean | null
  status?: string | null
  amountClaimed?: string | null
  amountRequested?: string | null
  incidentCause?: string | null
  flags?: string[]
  keyFacts?: string[]
  cached?: boolean
}

type InsuranceDoc = {
  id: string
  fileName: string
  createdAt?: string
  reviewStatus?: string | null
}

function formatClaimStatus(status: string | null | undefined): { label: string; color: string; badgeColor: 'red' | 'gold' | 'blue' | 'green' | 'slate' } {
  switch (status?.toLowerCase()) {
    case 'denied':
      return { label: 'Denied', color: 'text-red-700 bg-red-50 border-red-200', badgeColor: 'red' }
    case 'in_process':
      return { label: 'In Process', color: 'text-amber-700 bg-amber-50 border-amber-200', badgeColor: 'gold' }
    case 'paid_in_part':
      return { label: 'Paid in Part', color: 'text-blue-700 bg-blue-50 border-blue-200', badgeColor: 'blue' }
    case 'paid_in_full':
      return { label: 'Paid in Full', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', badgeColor: 'green' }
    case 'pending':
      return { label: 'Pending', color: 'text-slate-700 bg-slate-50 border-slate-200', badgeColor: 'slate' }
    default:
      return { label: 'Unknown', color: 'text-slate-700 bg-slate-50 border-slate-200', badgeColor: 'slate' }
  }
}

export default function InsuranceReviewTab({ clientId, clientName = 'Client', readOnly = false }: { clientId: string; clientName?: string; readOnly?: boolean }) {
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [document, setDocument] = useState<InsuranceDoc | null>(null)
  const [summary, setSummary] = useState<InsuranceSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [draftSummary, setDraftSummary] = useState<InsuranceSummary | null>(null)
  const [saving, setSaving] = useState(false)
  const { provider, setProvider } = useAgentAiProvider()
  const {
    runs,
    historyItems,
    activeRun,
    activeId,
    setActiveId,
    reload: reloadRuns,
    loading: loadingRuns,
  } = useGenericAgentRuns(clientId, AGENT_RUN_KEYS.insuranceReview)

  const saveChanges = async () => {
    if (!draftSummary) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/insurance-review', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, summary: draftSummary }),
        cache: 'no-store',
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || 'Failed to update insurance review')
      }
      const data = await res.json()
      setSummary(data.summary)
      setIsEditing(false)
    } catch (err: any) {
      console.error('[InsuranceReviewTab] Update failed', err)
      setError(err?.message ?? 'Failed to save edits')
    } finally {
      setSaving(false)
    }
  }

  const startEditing = () => {
    setDraftSummary(summary)
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setDraftSummary(null)
  }

  const logDebug = (...args: unknown[]) => {
    console.debug('[InsuranceReviewTab]', ...args)
  }

  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = Boolean(opts?.silent)
      logDebug('Loading insurance review state', { clientId, silent })
      if (!silent) setLoading(true)
      if (!silent) setError(null)
      try {
        const res = await fetch(`/api/insurance-review?clientId=${encodeURIComponent(clientId)}`, {
          cache: 'no-store',
        })
        if (!res.ok) throw new Error('Failed to load insurance review')
        const data = await res.json()
        logDebug('Loaded insurance review state', data)
        if (!mountedRef.current) return
        setDocument(data.document)
        setSummary(data.summary)
      } catch (err: any) {
        console.error('[InsuranceReviewTab] Load failed', err)
        if (!mountedRef.current) return
        setError(err?.message ?? 'Failed to load insurance review')
      } finally {
        if (!silent && mountedRef.current) setLoading(false)
      }
    },
    [clientId],
  )

  const runAgent = async () => {
    logDebug('Running insurance review agent', { clientId })
    setRunning(true)
    setError(null)
    try {
      const res = await fetch('/api/insurance-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          provider,
          modelId: resolveAgentModelId(provider, 'opus'),
        }),
        cache: 'no-store',
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || 'Insurance Review Agent failed')
      }
      const data = await res.json()
      logDebug('Insurance review agent completed — refreshing component')
      if (mountedRef.current) {
        setDocument(data.document ?? null)
        setSummary(data.summary ?? null)
      }
      await saveAgentAnalysisRunClient({
        clientId,
        agentKey: AGENT_RUN_KEYS.insuranceReview,
        fileName: data.document?.fileName ?? `${clientName} — Insurance Review`,
        report: { summary: data.summary, document: data.document },
        aiProvider: provider,
        aiModel: resolveAgentModelId(provider, 'opus'),
      })
      await reloadRuns({ selectNewest: true })
    } catch (err: any) {
      console.error('[InsuranceReviewTab] Agent run failed', err)
      setError(err?.message ?? 'Insurance Review Agent failed')
    } finally {
      setRunning(false)
    }
  }

  const resetInsuranceReview = async () => {
    logDebug('Resetting insurance review', { clientId })
    setDeleting(true)
    setError(null)
    setDocument(null)
    setSummary(null)
    console.info('[InsuranceReviewTab] DELETE insurance review — optimistic clear, sending request', {
      clientId,
      iso: new Date().toISOString(),
    })
    try {
      const delStarted = performance.now()
      const res = await fetch(`/api/insurance-review?clientId=${encodeURIComponent(clientId)}`, {
        method: 'DELETE',
        cache: 'no-store',
      })
      const delMs = Math.round(performance.now() - delStarted)
      console.info('[InsuranceReviewTab] DELETE response', { status: res.status, delMs, ok: res.ok })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || 'Failed to reset insurance review')
      }

      await res.json().catch(() => ({}))
      logDebug('Insurance review reset complete — refreshing component', { clientId })
      await load({ silent: true })
    } catch (err: any) {
      console.error('[InsuranceReviewTab] Reset failed — re-fetching from server', err)
      await load({ silent: true })
      if (mountedRef.current) {
        setError(err?.message ?? 'Failed to reset insurance review. Your view was synced from the server.')
      }
    } finally {
      if (mountedRef.current) setDeleting(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('clientId', clientId)
      formData.append('documentId', 'insurance_claims_12m')
      formData.append('uploaderEmail', getAdminEmail())
      const res = await fetch('/api/client-documents/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error(await res.text() || 'Upload failed')
      await load()
    } catch (err: any) {
      setError(err?.message ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  useEffect(() => {
    if (loadingRuns) return
    if (activeRun?.report) {
      const payload = activeRun.report as { summary?: InsuranceSummary; document?: InsuranceDoc }
      if (payload.summary) setSummary(payload.summary)
      if (payload.document) setDocument(payload.document)
      setLoading(false)
      return
    }
    void load()
  }, [activeRun, loadingRuns, load])

  function selectRun(run: AgentRunHistoryItem) {
    setActiveId(run.id)
    const full = runs.find((item) => item.id === run.id)
    const payload = (full?.report ?? null) as { summary?: InsuranceSummary; document?: InsuranceDoc } | null
    if (payload?.summary) setSummary(payload.summary)
    if (payload?.document) setDocument(payload.document)
  }

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    )
  }

  if (readOnly && !summary && !document) {
    return <ClientApprovedEmptyState agentName="Insurance Review" />
  }

  const hasStructuredFields = Boolean(
    summary && (
      summary.incidentDate && summary.incidentDate !== 'Unknown' ||
      summary.withinLast12Months !== null && summary.withinLast12Months !== undefined ||
      summary.incidentCause && summary.incidentCause !== 'Unknown' ||
      summary.amountRequested && summary.amountRequested !== 'Unknown' ||
      summary.amountClaimed && summary.amountClaimed !== 'Unknown' ||
      summary.keyFacts && summary.keyFacts.length > 0
    )
  )

  return (
    <div className="space-y-5">
      {!readOnly && (
        <AgentRunToolbar
          provider={provider}
          onProviderChange={setProvider}
          disabled={running || deleting}
          historyItems={historyItems}
          activeId={activeId}
          onSelectRun={selectRun}
          activeProvider={activeRun?.aiProvider}
          activeModel={activeRun?.aiModel}
          activeVersion={activeRun?.version}
        />
      )}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 shrink-0">
              <Bot className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Insurance Claim Review</h3>
              <p className="text-xs text-slate-400 mt-0.5">Review insurance claims from the last 24 months. Upload claim documents in the Documents tab for AI-powered summary and resolution status.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {document && (
              <Button
                size="sm"
                variant="danger"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  void resetInsuranceReview()
                }}
                disabled={running || deleting}
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => void runAgent()}
              disabled={!document || running || deleting}
              className="gap-1.5 font-medium"
            >
              {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {running ? 'Running...' : 'Run Agent'}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {!document && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center space-y-3">
          <FileText className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-medium text-slate-600">No insurance claim document uploaded</p>
          <p className="text-xs text-slate-400">Upload insurance claim documents in the <strong>Documents</strong> tab to enable AI-powered review.</p>
          <div className="mt-4 text-center">
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-xs font-medium cursor-pointer hover:bg-amber-100 transition-colors">
              <Upload className="w-3.5 h-3.5" />
              {uploading ? 'Uploading...' : 'Or upload here'}
              <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} disabled={uploading} />
            </label>
          </div>
        </div>
      )}

      {document && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <FileText className="w-4 h-4 text-slate-400" />
            <span>{document.fileName}</span>
            {summary?.status && <Badge color={formatClaimStatus(summary.status).badgeColor}>{formatClaimStatus(summary.status).label}</Badge>}
          </div>
          {summary ? (
            <div className="space-y-4">
              {summary.withinLast12Months === false && summary.flags && summary.flags.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-2">Flag</p>
                  <div className="space-y-1">
                    {summary.flags.map((flag, index) => (
                      <p key={`${flag}-${index}`} className="text-sm text-amber-800">{flag}</p>
                    ))}
                  </div>
                </div>
              )}

              <AdvisorActions className="flex justify-end gap-2 mb-2">
                {isEditing ? (
                  <>
                    <Button size="sm" variant="outline" onClick={cancelEditing} disabled={saving}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={saveChanges} disabled={saving}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="outline" onClick={startEditing}>
                      Edit Report
                    </Button>
                    <ExportReportButton
                      html={buildInsuranceReportHtml(summary, document?.fileName ?? 'insurance-claim', clientName)}
                      fileName={`insurance-review-${clientName.replace(/\s+/g, '-').toLowerCase()}`}
                    />
                  </>
                )}
              </AdvisorActions>

              {isEditing && !readOnly ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Insurance claim summary
                    </label>
                    <textarea
                      className="w-full rounded-lg border border-slate-200 p-2 text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                      rows={4}
                      value={draftSummary?.summary || ''}
                      onChange={(e) => setDraftSummary(prev => prev ? { ...prev, summary: e.target.value } : null)}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 p-3">
                      <label className="block text-[11px] uppercase tracking-wide text-slate-400">Claim Status</label>
                      <select
                        className="rounded-lg border border-slate-200 p-2 text-sm w-full mt-1 bg-white"
                        value={draftSummary?.status || 'unknown'}
                        onChange={(e) => setDraftSummary(prev => prev ? { ...prev, status: e.target.value } : null)}
                      >
                        <option value="denied">Denied</option>
                        <option value="in_process">In Process</option>
                        <option value="paid_in_part">Paid in Part</option>
                        <option value="paid_in_full">Paid in Full</option>
                        <option value="pending">Pending</option>
                        <option value="unknown">Unknown</option>
                      </select>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <label className="block text-[11px] uppercase tracking-wide text-slate-400">Incident Date</label>
                      <input
                        type="text"
                        className="rounded-lg border border-slate-200 p-2 text-sm w-full mt-1"
                        value={draftSummary?.incidentDate || ''}
                        onChange={(e) => setDraftSummary(prev => prev ? { ...prev, incidentDate: e.target.value } : null)}
                      />
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <label className="block text-[11px] uppercase tracking-wide text-slate-400">Claim Type</label>
                      <input
                        type="text"
                        className="rounded-lg border border-slate-200 p-2 text-sm w-full mt-1"
                        value={draftSummary?.claimType || ''}
                        onChange={(e) => setDraftSummary(prev => prev ? { ...prev, claimType: e.target.value } : null)}
                      />
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <label className="block text-[11px] uppercase tracking-wide text-slate-400">Cause</label>
                      <input
                        type="text"
                        className="rounded-lg border border-slate-200 p-2 text-sm w-full mt-1"
                        value={draftSummary?.incidentCause || ''}
                        onChange={(e) => setDraftSummary(prev => prev ? { ...prev, incidentCause: e.target.value } : null)}
                      />
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <label className="block text-[11px] uppercase tracking-wide text-slate-400">Amount Requested</label>
                      <input
                        type="text"
                        className="rounded-lg border border-slate-200 p-2 text-sm w-full mt-1"
                        value={draftSummary?.amountRequested || ''}
                        onChange={(e) => setDraftSummary(prev => prev ? { ...prev, amountRequested: e.target.value } : null)}
                      />
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <label className="block text-[11px] uppercase tracking-wide text-slate-400">Amount Claimed</label>
                      <input
                        type="text"
                        className="rounded-lg border border-slate-200 p-2 text-sm w-full mt-1"
                        value={draftSummary?.amountClaimed || ''}
                        onChange={(e) => setDraftSummary(prev => prev ? { ...prev, amountClaimed: e.target.value } : null)}
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                      Key Facts (one per line)
                    </label>
                    <textarea
                      className="w-full rounded-lg border border-slate-200 p-2 text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                      rows={4}
                      placeholder="One fact per line..."
                      value={draftSummary?.keyFacts?.join('\n') || ''}
                      onChange={(e) => setDraftSummary(prev => prev ? { ...prev, keyFacts: e.target.value.split('\n').filter(Boolean) } : null)}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium">
                        <CheckCircle className="w-4 h-4" />
                        Insurance claim summary
                      </div>
                      {summary.status && (
                        <Badge color={formatClaimStatus(summary.status).badgeColor}>
                          {formatClaimStatus(summary.status).label}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">{summary.summary}</p>
                    {summary.status && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Claim Status:</span>
                        <Badge color={formatClaimStatus(summary.status).badgeColor} className="text-sm px-3 py-1">
                          {formatClaimStatus(summary.status).label}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {hasStructuredFields ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className={`rounded-xl border p-3 ${formatClaimStatus(summary.status).color}`}>
                          <p className="text-[11px] uppercase tracking-wide opacity-70">Claim Status</p>
                          <p className="text-sm font-semibold mt-1">{formatClaimStatus(summary.status).label}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-[11px] uppercase tracking-wide text-slate-400">Incident Date</p>
                          <p className="text-sm text-slate-700 mt-1">{summary.incidentDate || 'Unknown'}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-[11px] uppercase tracking-wide text-slate-400">Claim Type</p>
                          <p className="text-sm text-slate-700 mt-1">{summary.claimType || 'Unknown'}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-[11px] uppercase tracking-wide text-slate-400">Cause</p>
                          <p className="text-sm text-slate-700 mt-1">{summary.incidentCause || 'Unknown'}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-[11px] uppercase tracking-wide text-slate-400">Amount Requested</p>
                          <p className="text-sm text-slate-700 mt-1">{summary.amountRequested || 'Unknown'}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-[11px] uppercase tracking-wide text-slate-400">Amount Claimed</p>
                          <p className="text-sm text-slate-700 mt-1">{summary.amountClaimed || 'Unknown'}</p>
                        </div>
                      </div>

                      {summary.keyFacts && summary.keyFacts.length > 0 && (
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Key Facts</p>
                          <div className="space-y-2">
                            {summary.keyFacts.map((fact, index) => (
                              <p key={`${fact}-${index}`} className="text-sm text-slate-700">{fact}</p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-sm text-slate-600">
                        Structured fields have not been extracted for this cached review yet. Run the Insurance Review Agent to populate incident date, cause, and claim amounts.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              No summary cached yet. Run the Insurance Review Agent to generate one.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
