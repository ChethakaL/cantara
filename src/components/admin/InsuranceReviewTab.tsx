'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ShieldCheck,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
  Plus,
  Play,
  Clock,
  DollarSign,
  Calendar,
} from 'lucide-react'
import { Badge, Button, Card, cn } from '@/components/ui'
import { getAdminEmail, type DocumentStatus } from '@/lib/store'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import { AdvisorActions, ClientApprovedEmptyState } from '@/components/client-portal/AgentClientPortalFrame'
import { agentTabReadOnlyGate } from '@/hooks/useAgentTabReadOnly'
import { buildInsuranceReportHtml } from '@/lib/report-export/build-insurance-report'
import { useAgentAiProvider } from '@/hooks/useAgentAiProvider'
import { AgentRunToolbar } from '@/components/admin/AgentRunToolbar'
import { resolveAgentModelId } from '@/lib/agent-model-provider'
import { useGenericAgentRuns } from '@/hooks/useGenericAgentRuns'
import { AGENT_RUN_KEYS } from '@/lib/agent-run-keys'
import { saveAgentAnalysisRunClient } from '@/lib/agent-analysis-runs.client'
import type { AgentRunHistoryItem } from '@/components/admin/AgentRunHistoryPanel'
import {
  listClientDocuments,
  type ClientUploadedDoc,
} from '@/lib/client-documents-client'

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
  documentId?: string
  fileName: string
  createdAt?: string
  reviewStatus?: string | null
}

const REQUIRED_DOC = {
  id: 'insurance_policies',
  label: 'Insurance Policies (all active)',
  required: true,
  description:
    "All active business insurance policies (General Liability, Commercial Property, Workers' Compensation, Umbrella, Cyber, etc.).",
}

const OPTIONAL_DOC = {
  id: 'insurance_claims_12m',
  label: 'Insurance Claims (last 12 months)',
  required: false,
  description:
    'In the last 12 months have you claimed any insurance claims? If yes, upload the insurance claim document or loss run report as a PDF.',
}

function formatClaimStatus(status: string | null | undefined): {
  label: string
  color: string
  badgeColor: 'red' | 'gold' | 'blue' | 'green' | 'slate'
} {
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
    case 'active_no_claims':
      return { label: 'Active (No Claims)', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', badgeColor: 'green' }
    default:
      return { label: 'Unknown', color: 'text-slate-700 bg-slate-50 border-slate-200', badgeColor: 'slate' }
  }
}

export default function InsuranceReviewTab({
  clientId,
  clientName = 'Client',
  documentStatuses,
  readOnly = false,
}: {
  clientId: string
  clientName?: string
  documentStatuses?: Record<string, DocumentStatus>
  readOnly?: boolean
}) {
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null)
  const [document, setDocument] = useState<InsuranceDoc | null>(null)
  const [summary, setSummary] = useState<InsuranceSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [draftSummary, setDraftSummary] = useState<InsuranceSummary | null>(null)
  const [saving, setSaving] = useState(false)
  const [composingNew, setComposingNew] = useState(false)
  const [portalDocs, setPortalDocs] = useState<ClientUploadedDoc[]>([])
  const [loadingPortalDocs, setLoadingPortalDocs] = useState(false)

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

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const loadPortalDocuments = useCallback(async () => {
    setLoadingPortalDocs(true)
    try {
      const docs = await listClientDocuments(clientId, ['insurance_policies', 'insurance_claims_12m'])
      if (mountedRef.current) {
        setPortalDocs(docs)
      }
      return docs
    } catch {
      return []
    } finally {
      if (mountedRef.current) setLoadingPortalDocs(false)
    }
  }, [clientId])

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = Boolean(opts?.silent)
      if (!silent) setLoading(true)
      if (!silent) setError(null)
      try {
        const res = await fetch(`/api/insurance-review?clientId=${encodeURIComponent(clientId)}`, {
          cache: 'no-store',
        })
        if (!res.ok) throw new Error('Failed to load insurance review')
        const data = await res.json()
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

  useEffect(() => {
    void loadPortalDocuments()
  }, [loadPortalDocuments])

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

  const policyDocs = portalDocs.filter(d => d.documentId === 'insurance_policies')
  const claimDocs = portalDocs.filter(d => d.documentId === 'insurance_claims_12m')

  const policyStatus = documentStatuses?.['insurance_policies']
  const claimStatus = documentStatuses?.['insurance_claims_12m']

  const hasPolicyFiles = policyDocs.length > 0 || Boolean(policyStatus?.fileName) || policyStatus?.hasDoc === true
  const isPolicyUnavailable = !hasPolicyFiles && (policyStatus?.hasDoc === false || Boolean(policyStatus?.notApplicable))

  const hasClaimFiles = claimDocs.length > 0 || Boolean(claimStatus?.fileName) || claimStatus?.hasDoc === true
  const isClaimUnavailable = !hasClaimFiles && (claimStatus?.hasDoc === false || Boolean(claimStatus?.notApplicable))

  const canRun = hasPolicyFiles || hasClaimFiles

  const runAgent = async () => {
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
      if (mountedRef.current) {
        setDocument(data.document ?? null)
        setSummary(data.summary ?? null)
        setComposingNew(false)
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
      await loadPortalDocuments()
    } catch (err: any) {
      console.error('[InsuranceReviewTab] Agent run failed', err)
      setError(err?.message ?? 'Insurance Review Agent failed')
    } finally {
      if (mountedRef.current) setRunning(false)
    }
  }

  const handleFileUpload = async (documentId: 'insurance_policies' | 'insurance_claims_12m', file: File) => {
    setUploadingSlot(documentId)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('clientId', clientId)
      formData.append('documentId', documentId)
      formData.append('uploaderEmail', getAdminEmail())
      const res = await fetch('/api/client-documents/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error((await res.text()) || 'Upload failed')
      await Promise.all([load({ silent: true }), loadPortalDocuments()])
    } catch (err: any) {
      setError(err?.message ?? 'Upload failed')
    } finally {
      setUploadingSlot(null)
    }
  }

  const resetInsuranceReview = async () => {
    if (!window.confirm('Reset this insurance review analysis? Uploaded documents in portal will not be deleted.')) {
      return
    }
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/insurance-review?clientId=${encodeURIComponent(clientId)}`, {
        method: 'DELETE',
        cache: 'no-store',
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || 'Failed to reset insurance review')
      }
      setDocument(null)
      setSummary(null)
      setComposingNew(false)
      await load({ silent: true })
      await loadPortalDocuments()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to reset insurance review.')
    } finally {
      if (mountedRef.current) setDeleting(false)
    }
  }

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

  function selectRun(run: AgentRunHistoryItem) {
    setActiveId(run.id)
    setComposingNew(false)
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

  const readOnlyGate = agentTabReadOnlyGate(readOnly, !loading, Boolean(summary || document), 'Insurance Review')
  if (readOnlyGate) return readOnlyGate

  const hasStructuredFields = Boolean(
    summary &&
      ((summary.incidentDate && summary.incidentDate !== 'Unknown' && summary.incidentDate !== 'None') ||
        summary.withinLast12Months !== null && summary.withinLast12Months !== undefined ||
        (summary.incidentCause && summary.incidentCause !== 'Unknown' && summary.incidentCause !== 'None') ||
        (summary.amountRequested && summary.amountRequested !== 'Unknown' && summary.amountRequested !== 'None') ||
        (summary.amountClaimed && summary.amountClaimed !== 'Unknown' && summary.amountClaimed !== 'None') ||
        (summary.keyFacts && summary.keyFacts.length > 0)),
  )

  const showActiveReport = Boolean(summary && !composingNew)

  return (
    <div className="space-y-6">
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

      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="font-serif text-xl font-bold text-slate-900 tracking-tight">
            {showActiveReport
              ? 'Insurance Review Report'
              : composingNew
                ? 'New Insurance Analysis'
                : 'Insurance Review Analysis'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {showActiveReport
              ? `Insurance coverage, liability limits & claim risk assessment for ${clientName}`
              : `Review active insurance policies and claims history for ${clientName}`}
          </p>
        </div>

        {!readOnly && (
          <div className="flex items-center gap-2 shrink-0">
            {showActiveReport && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setComposingNew(true)
                    setError(null)
                  }}
                  className="gap-1.5 h-8 text-xs font-medium text-slate-700 hover:text-slate-900 border-slate-200"
                >
                  <Plus className="w-3.5 h-3.5 text-slate-500" />
                  New Analysis
                </Button>
                <Button
                  size="sm"
                  onClick={() => void runAgent()}
                  disabled={running || deleting}
                  className="gap-1.5 h-8 text-xs font-medium bg-slate-900 text-white hover:bg-slate-800"
                >
                  {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  {running ? 'Re-running…' : 'Re-run Analysis'}
                </Button>
              </>
            )}
            {composingNew && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setComposingNew(false)
                  setError(null)
                }}
                className="h-8 text-xs font-medium text-slate-700"
              >
                Cancel
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Inline running notification if re-running while existing report is shown */}
      {running && showActiveReport && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50/60 text-amber-900 text-xs">
          <Loader2 className="w-4 h-4 animate-spin text-amber-600 shrink-0" />
          <span className="font-medium">Analyzing insurance documents in the background…</span>
        </div>
      )}

      {/* Document Configuration Workspace: Shown when no report yet, or when composing new run */}
      {(!showActiveReport || composingNew) && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6">
          {/* Sector 1: Required Document */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Required Insurance Document
                </h4>
                <span
                  className={cn(
                    'text-[11px] font-semibold px-2 py-0.5 rounded-full',
                    hasPolicyFiles ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800',
                  )}
                >
                  {hasPolicyFiles ? '1 of 1 ready' : '0 of 1 ready'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void loadPortalDocuments()}
                disabled={loadingPortalDocs}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn('w-3 h-3', loadingPortalDocs && 'animate-spin')} />
                Refresh
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Active business insurance policies must be provided to evaluate liability coverage, coverage limits, and insurable risks.
            </p>

            <InsuranceDocRow
              docDef={REQUIRED_DOC}
              clientId={clientId}
              files={policyDocs}
              status={policyStatus}
              hasFiles={hasPolicyFiles}
              isUnavailable={isPolicyUnavailable}
              isUploading={uploadingSlot === REQUIRED_DOC.id}
              onUpload={(file) => void handleFileUpload('insurance_policies', file)}
              readOnly={readOnly}
            />
          </div>

          {/* Sector 2: Optional Document */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Optional Insurance Document
                </h4>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {hasClaimFiles ? '1 of 1 uploaded' : '0 of 1 uploaded'}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Upload claims documents if the business has filed any insurance claims in the last 12–24 months. If no claims were made, this document can be omitted.
            </p>

            <InsuranceDocRow
              docDef={OPTIONAL_DOC}
              clientId={clientId}
              files={claimDocs}
              status={claimStatus}
              hasFiles={hasClaimFiles}
              isUnavailable={isClaimUnavailable}
              isUploading={uploadingSlot === OPTIONAL_DOC.id}
              onUpload={(file) => void handleFileUpload('insurance_claims_12m', file)}
              readOnly={readOnly}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-lg">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Bottom Readiness & Action Footer */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-xs">
              {canRun ? (
                <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  Insurance documents ready. You can run the insurance review.
                </span>
              ) : (
                <span className="text-amber-800 font-medium flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  Upload required insurance policies to run the review.
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {composingNew && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setComposingNew(false)
                    setError(null)
                  }}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => void runAgent()}
                disabled={!canRun || running || deleting}
                className="gap-1.5 h-8 text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {running ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Analyzing Insurance…
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    Run Insurance Review
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Active Report View ────────────────────────────────────────────── */}
      {showActiveReport && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 bg-white border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500">Coverage / Claim Status</p>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl font-bold text-slate-900 mt-2">
                {summary?.status ? formatClaimStatus(summary.status).label : 'Reviewed'}
              </p>
              <p className="text-xs text-slate-400 mt-1">Resolution / Standing</p>
            </Card>

            <Card className="p-4 bg-white border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500">Within Last 12 Mo</p>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl font-bold text-slate-900 mt-2">
                {summary?.withinLast12Months === true
                  ? 'Yes'
                  : summary?.withinLast12Months === false
                    ? 'No (>12 mo)'
                    : 'None'}
              </p>
              <p className="text-xs text-slate-400 mt-1">Claim recency window</p>
            </Card>

            <Card className="p-4 bg-white border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500">Amount Claimed</p>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl font-bold text-slate-900 mt-2 truncate">
                {summary?.amountClaimed && summary.amountClaimed !== 'Unknown' && summary.amountClaimed !== 'None'
                  ? summary.amountClaimed
                  : summary?.amountRequested && summary.amountRequested !== 'Unknown' && summary.amountRequested !== 'None'
                    ? summary.amountRequested
                    : 'None'}
              </p>
              <p className="text-xs text-slate-400 mt-1">Claimed exposure</p>
            </Card>

            <Card className="p-4 bg-white border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500">Incident Date</p>
                <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl font-bold text-slate-900 mt-2 truncate">
                {summary?.incidentDate && summary.incidentDate !== 'Unknown' ? summary.incidentDate : 'None'}
              </p>
              <p className="text-xs text-slate-400 mt-1">Occurrence record</p>
            </Card>
          </div>

          {/* Flags Banner */}
          {summary?.withinLast12Months === false && summary.flags && summary.flags.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
              <div className="flex items-center gap-2 text-amber-800 text-xs font-semibold uppercase tracking-wider mb-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Diligence Flag
              </div>
              <div className="space-y-1">
                {summary.flags.map((flag, index) => (
                  <p key={`${flag}-${index}`} className="text-sm text-amber-900">
                    {flag}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Action Toolbar */}
          <AdvisorActions className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {document && (
                <span className="text-xs text-slate-500 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  Source: <strong className="text-slate-700">{document.fileName}</strong>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button size="sm" variant="outline" onClick={cancelEditing} disabled={saving} className="h-8 text-xs">
                    Cancel
                  </Button>
                  <Button size="sm" onClick={saveChanges} disabled={saving} className="h-8 text-xs font-medium">
                    {saving ? 'Saving…' : 'Save Changes'}
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={startEditing} className="h-8 text-xs font-medium">
                    Edit Report
                  </Button>
                  <ExportReportButton
                    html={buildInsuranceReportHtml(summary!, document?.fileName ?? 'insurance-review', clientName)}
                    fileName={`insurance-review-${clientName.replace(/\s+/g, '-').toLowerCase()}`}
                    label="Export PDF"
                  />
                </>
              )}
            </div>
          </AdvisorActions>

          {/* Editing Mode or Display Mode */}
          {isEditing && !readOnly ? (
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-2xs">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Insurance Summary
                </label>
                <textarea
                  className="w-full rounded-lg border border-slate-200 p-3 text-sm focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none"
                  rows={4}
                  value={draftSummary?.summary || ''}
                  onChange={(e) => setDraftSummary((prev) => (prev ? { ...prev, summary: e.target.value } : null))}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-200 p-3">
                  <label className="block text-[11px] uppercase tracking-wide font-semibold text-slate-400">
                    Status
                  </label>
                  <select
                    className="rounded-md border border-slate-200 p-1.5 text-xs w-full mt-1 bg-white"
                    value={draftSummary?.status || 'unknown'}
                    onChange={(e) => setDraftSummary((prev) => (prev ? { ...prev, status: e.target.value } : null))}
                  >
                    <option value="active_no_claims">Active (No Claims)</option>
                    <option value="paid_in_full">Paid in Full</option>
                    <option value="paid_in_part">Paid in Part</option>
                    <option value="in_process">In Process</option>
                    <option value="pending">Pending</option>
                    <option value="denied">Denied</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>

                <div className="rounded-lg border border-slate-200 p-3">
                  <label className="block text-[11px] uppercase tracking-wide font-semibold text-slate-400">
                    Incident Date
                  </label>
                  <input
                    type="text"
                    className="rounded-md border border-slate-200 p-1.5 text-xs w-full mt-1"
                    value={draftSummary?.incidentDate || ''}
                    onChange={(e) => setDraftSummary((prev) => (prev ? { ...prev, incidentDate: e.target.value } : null))}
                  />
                </div>

                <div className="rounded-lg border border-slate-200 p-3">
                  <label className="block text-[11px] uppercase tracking-wide font-semibold text-slate-400">
                    Claim / Policy Type
                  </label>
                  <input
                    type="text"
                    className="rounded-md border border-slate-200 p-1.5 text-xs w-full mt-1"
                    value={draftSummary?.claimType || ''}
                    onChange={(e) => setDraftSummary((prev) => (prev ? { ...prev, claimType: e.target.value } : null))}
                  />
                </div>

                <div className="rounded-lg border border-slate-200 p-3">
                  <label className="block text-[11px] uppercase tracking-wide font-semibold text-slate-400">Cause</label>
                  <input
                    type="text"
                    className="rounded-md border border-slate-200 p-1.5 text-xs w-full mt-1"
                    value={draftSummary?.incidentCause || ''}
                    onChange={(e) => setDraftSummary((prev) => (prev ? { ...prev, incidentCause: e.target.value } : null))}
                  />
                </div>

                <div className="rounded-lg border border-slate-200 p-3">
                  <label className="block text-[11px] uppercase tracking-wide font-semibold text-slate-400">
                    Amount Requested
                  </label>
                  <input
                    type="text"
                    className="rounded-md border border-slate-200 p-1.5 text-xs w-full mt-1"
                    value={draftSummary?.amountRequested || ''}
                    onChange={(e) => setDraftSummary((prev) => (prev ? { ...prev, amountRequested: e.target.value } : null))}
                  />
                </div>

                <div className="rounded-lg border border-slate-200 p-3">
                  <label className="block text-[11px] uppercase tracking-wide font-semibold text-slate-400">
                    Amount Claimed
                  </label>
                  <input
                    type="text"
                    className="rounded-md border border-slate-200 p-1.5 text-xs w-full mt-1"
                    value={draftSummary?.amountClaimed || ''}
                    onChange={(e) => setDraftSummary((prev) => (prev ? { ...prev, amountClaimed: e.target.value } : null))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Key Facts (one per line)
                </label>
                <textarea
                  className="w-full rounded-lg border border-slate-200 p-3 text-xs focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none font-mono"
                  rows={4}
                  value={draftSummary?.keyFacts?.join('\n') || ''}
                  onChange={(e) =>
                    setDraftSummary((prev) =>
                      prev ? { ...prev, keyFacts: e.target.value.split('\n').filter(Boolean) } : null,
                    )
                  }
                />
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Summary Card */}
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-emerald-800 text-sm font-semibold">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    Insurance Assessment Summary
                  </div>
                  {summary?.status && (
                    <Badge color={formatClaimStatus(summary.status).badgeColor}>
                      {formatClaimStatus(summary.status).label}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{summary?.summary}</p>
              </div>

              {/* Structured Fields Grid */}
              {hasStructuredFields && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className={cn('rounded-xl border p-3.5', formatClaimStatus(summary?.status).color)}>
                    <p className="text-[11px] uppercase tracking-wide opacity-75 font-medium">Resolution Status</p>
                    <p className="text-sm font-semibold mt-1">{formatClaimStatus(summary?.status).label}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400 font-medium">Incident Date</p>
                    <p className="text-sm text-slate-800 font-semibold mt-1">
                      {summary?.incidentDate && summary.incidentDate !== 'Unknown' ? summary.incidentDate : 'None'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400 font-medium">Coverage / Claim Type</p>
                    <p className="text-sm text-slate-800 font-semibold mt-1">
                      {summary?.claimType && summary.claimType !== 'Unknown' ? summary.claimType : 'General Policy'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400 font-medium">Cause</p>
                    <p className="text-sm text-slate-800 font-semibold mt-1">
                      {summary?.incidentCause && summary.incidentCause !== 'Unknown' ? summary.incidentCause : 'None'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400 font-medium">Amount Requested</p>
                    <p className="text-sm text-slate-800 font-semibold mt-1">
                      {summary?.amountRequested && summary.amountRequested !== 'Unknown' ? summary.amountRequested : 'None'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400 font-medium">Amount Claimed</p>
                    <p className="text-sm text-slate-800 font-semibold mt-1">
                      {summary?.amountClaimed && summary.amountClaimed !== 'Unknown' ? summary.amountClaimed : 'None'}
                    </p>
                  </div>
                </div>
              )}

              {/* Key Facts */}
              {summary?.keyFacts && summary.keyFacts.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                    Key Diligence Facts &amp; Coverage Details
                  </h4>
                  <ul className="space-y-2">
                    {summary.keyFacts.map((fact, index) => (
                      <li key={`${fact}-${index}`} className="text-xs text-slate-700 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                        <span>{fact}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Reset / Delete button */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => void resetInsuranceReview()}
              disabled={deleting || running}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors inline-flex items-center gap-1.5"
            >
              {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              Clear &amp; Start Over
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function InsuranceDocRow({
  docDef,
  clientId,
  files,
  status,
  hasFiles,
  isUnavailable,
  isUploading,
  onUpload,
  readOnly,
}: {
  docDef: { id: string; label: string; required: boolean; description: string }
  clientId: string
  files: ClientUploadedDoc[]
  status?: DocumentStatus
  hasFiles: boolean
  isUnavailable: boolean
  isUploading: boolean
  onUpload: (file: File) => void
  readOnly?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-all shadow-2xs',
        hasFiles
          ? 'border-emerald-200 bg-emerald-50/40'
          : isUnavailable
            ? 'border-amber-200 bg-amber-50/40'
            : docDef.required
              ? 'border-amber-200/90 bg-amber-50/20'
              : 'border-slate-200/80 bg-white hover:border-slate-300',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                hasFiles
                  ? 'bg-emerald-50 text-emerald-600'
                  : isUnavailable
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-slate-100 text-slate-400',
              )}
            >
              <FileText className="w-4.5 h-4.5" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-slate-800">{docDef.label}</p>
                {docDef.required ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                    Required
                  </span>
                ) : (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                    Optional
                  </span>
                )}

                {hasFiles ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Uploaded
                  </span>
                ) : isUnavailable ? (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                    {docDef.required ? 'Not available with client' : 'No claims / Not applicable'}
                  </span>
                ) : (
                  <span
                    className={cn(
                      'text-[10px] font-medium px-2 py-0.5 rounded-md',
                      docDef.required
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-slate-50 text-slate-400 border border-slate-200',
                    )}
                  >
                    {docDef.required ? 'Missing' : 'Not provided'}
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{docDef.description}</p>

              {/* Uploaded file chips */}
              {hasFiles && files.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2.5">
                  {files.map((file, idx) => (
                    <a
                      key={file.id || idx}
                      href={`/api/client-documents/view?clientId=${encodeURIComponent(clientId)}&documentId=${encodeURIComponent(docDef.id)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-emerald-200 text-emerald-900 shadow-2xs hover:bg-emerald-50 transition-colors"
                      title="Click to view file in new tab"
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate max-w-[240px] font-medium">{file.fileName}</span>
                      {file.uploadedAt && (
                        <span className="text-[10px] text-slate-400 font-normal">
                          · {new Date(file.uploadedAt).toLocaleDateString()}
                        </span>
                      )}
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-semibold">
                        Active
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Upload / Replace action button */}
        {!readOnly && (
          <div className="shrink-0 pt-0.5">
            <input
              ref={inputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onUpload(f)
                e.target.value = ''
              }}
              disabled={isUploading}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  {hasFiles ? 'Replace' : 'Upload'}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
