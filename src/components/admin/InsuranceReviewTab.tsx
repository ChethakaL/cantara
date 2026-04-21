'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot, CheckCircle, FileText, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { Badge, Button } from '@/components/ui'

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

export default function InsuranceReviewTab({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [document, setDocument] = useState<InsuranceDoc | null>(null)
  const [summary, setSummary] = useState<InsuranceSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

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
        body: JSON.stringify({ clientId }),
        cache: 'no-store',
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || 'Insurance Review Agent failed')
      }
      await res.json()
      logDebug('Insurance review agent completed — refreshing component')
      await load({ silent: true })
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

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    )
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
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-50 border border-amber-200">
                <Bot className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Insurance Claim Review</h3>
                <p className="text-xs text-slate-400 mt-0.5">Review insurance claims from the last 24 months. Upload claim documents in the Documents tab for AI-powered summary and resolution status.</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
