'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Bot, CheckCircle, FileText, Loader2, RefreshCw, Trash2, Upload } from 'lucide-react'
import { Badge, Button } from '@/components/ui'
import { getAdminEmail } from '@/lib/store'

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

export default function InsuranceReviewTab({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [reviewPending, setReviewPending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [document, setDocument] = useState<InsuranceDoc | null>(null)
  const [summary, setSummary] = useState<InsuranceSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const adminEmail = getAdminEmail()

  const logDebug = (...args: unknown[]) => {
    console.debug('[InsuranceReviewTab]', ...args)
  }

  const mountedRef = useRef(true)
  const busyStartedRef = useRef<number | null>(null)
  const [, setBusyTick] = useState(0)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!uploading && !reviewPending) {
      busyStartedRef.current = null
      return
    }
    const id = window.setInterval(() => setBusyTick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [uploading, reviewPending])

  const pollUntilInsuranceReady = useCallback(async () => {
    const maxMs = 180_000
    const intervalMs = 2000
    const pollStarted = Date.now()
    let attempt = 0

    while (Date.now() - pollStarted < maxMs && mountedRef.current) {
      attempt += 1
      const elapsedSec = Math.round((Date.now() - pollStarted) / 1000)
      console.info('[InsuranceReviewTab] poll GET /api/insurance-review', {
        clientId,
        attempt,
        pollElapsedSec: elapsedSec,
        iso: new Date().toISOString(),
      })

      try {
        const res = await fetch(`/api/insurance-review?clientId=${encodeURIComponent(clientId)}`, {
          cache: 'no-store',
        })
        if (!res.ok) {
          console.warn('[InsuranceReviewTab] poll non-OK response', { status: res.status, attempt })
        } else {
          const data = await res.json()
          if (!mountedRef.current) return
          setDocument(data.document)
          setSummary(data.summary)

          const rs = data.document?.reviewStatus as string | null | undefined
          console.info('[InsuranceReviewTab] poll snapshot', {
            attempt,
            reviewStatus: rs ?? null,
            hasSummary: Boolean(data.summary?.summary),
          })

          if (rs !== 'processing') {
            console.info('[InsuranceReviewTab] poll done — review no longer processing, reloading page', {
              reviewStatus: rs,
              totalPollSec: elapsedSec,
            })
            window.location.reload()
            return
          }
        }
      } catch (err) {
        console.error('[InsuranceReviewTab] poll fetch error', { attempt, err })
      }

      await new Promise((r) => window.setTimeout(r, intervalMs))
    }

    if (mountedRef.current) {
      console.warn('[InsuranceReviewTab] poll timed out — reloading to sync with server', { clientId })
      window.location.reload()
    }
  }, [clientId])

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
      logDebug('Insurance review agent completed — reloading page')
      window.location.reload()
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
      logDebug('Insurance review reset complete — reloading page', { clientId })
      window.location.reload()
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (files) => {
      if (!files[0] || !adminEmail) return
      const file = files[0]
      busyStartedRef.current = Date.now()
      logDebug('Starting insurance PDF upload', {
        clientId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      })
      console.info('[InsuranceReviewTab] upload flow start', {
        clientId,
        fileName: file.name,
        iso: new Date().toISOString(),
      })
      setUploading(true)
      setReviewPending(false)
      setError(null)
      try {
        const form = new FormData()
        form.append('file', file)
        form.append('clientId', clientId)
        form.append('documentId', 'insurance_claims_12m')
        form.append('uploaderEmail', adminEmail)
        const postStarted = performance.now()
        const res = await fetch('/api/client-documents/upload', {
          method: 'POST',
          body: form,
          cache: 'no-store',
        })
        const postMs = Math.round(performance.now() - postStarted)
        console.info('[InsuranceReviewTab] upload POST settled', {
          status: res.status,
          postMs,
          ok: res.ok,
        })

        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(text || 'Failed to upload insurance claim PDF')
        }

        const body = (await res.json()) as {
          id: string
          fileName: string
          uploadedAt: string
          insuranceReviewPending?: boolean
        }
        logDebug('Insurance PDF upload response parsed', body)

        if (!mountedRef.current) return
        setUploading(false)

        if (body.insuranceReviewPending) {
          console.info('[InsuranceReviewTab] server returned quickly; AI runs in background — polling', {
            documentRecordId: body.id,
          })
          setDocument({
            id: body.id,
            fileName: body.fileName,
            createdAt: body.uploadedAt,
            reviewStatus: 'processing',
          })
          setReviewPending(true)
          await pollUntilInsuranceReady()
        } else {
          await load({ silent: true })
          console.info('[InsuranceReviewTab] upload done — reloading page')
          window.location.reload()
        }
      } catch (err: any) {
        console.error('[InsuranceReviewTab] Upload failed', err)
        if (mountedRef.current) {
          setError(err?.message ?? 'Failed to upload insurance claim PDF')
        }
      } finally {
        logDebug('Insurance PDF upload flow finished')
        if (mountedRef.current) {
          setUploading(false)
          setReviewPending(false)
        }
      }
    },
    multiple: false,
    disabled: uploading || reviewPending,
  })

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    )
  }

  const submissionBusy = uploading || reviewPending
  const busySec =
    submissionBusy && busyStartedRef.current !== null
      ? Math.max(0, Math.floor((Date.now() - busyStartedRef.current) / 1000))
      : 0

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
                <h3 className="text-sm font-semibold text-slate-800">Insurance Review Agent</h3>
                <p className="text-xs text-slate-400 mt-0.5">Summarizes uploaded insurance claim PDFs for advisor review.</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <div
                {...getRootProps()}
                className={`border border-dashed rounded-lg px-3 py-2 text-xs transition-all flex items-center gap-2 min-w-[148px] ${
                  submissionBusy
                    ? 'border-amber-300 bg-amber-50 text-amber-700 cursor-wait'
                    : document
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 cursor-pointer'
                    : isDragActive
                    ? 'border-amber-400 bg-amber-50 text-amber-600 cursor-pointer'
                    : 'border-slate-200 text-slate-400 hover:border-amber-300 hover:text-amber-500 cursor-pointer'
                }`}
              >
                <input {...getInputProps()} />
                {submissionBusy ? (
                  <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
                ) : document ? (
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <Upload className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="truncate">
                  {uploading
                    ? `Uploading… ${busySec}s`
                    : reviewPending
                    ? `AI review… ${busySec}s`
                    : document
                    ? 'Replace PDF'
                    : isDragActive
                    ? 'Drop PDF here'
                    : 'Upload PDF'}
                </span>
              </div>
              {document && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    void resetInsuranceReview()
                  }}
                  disabled={running || uploading || deleting || reviewPending}
                >
                  {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  {deleting ? 'Deleting...' : 'Delete'}
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => void runAgent()}
                disabled={!document || running || uploading || deleting || reviewPending}
              >
                {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {running ? 'Running...' : 'Run Agent'}
              </Button>
            </div>
            {submissionBusy && (
              <p className="text-[11px] text-slate-500 text-right max-w-xs leading-snug">
                {uploading
                  ? 'Uploading your PDF securely...'
                  : 'Reviewing your PDF with AI. This can take around 20-90 seconds depending on document size.'}
              </p>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {!document && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-400">
          No insurance claim PDF uploaded yet. The admin can upload it directly here, then run the Insurance Review Agent.
        </div>
      )}

      {document && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          {reviewPending && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              Automatic summary is running ({busySec}s). This step usually takes about one to two minutes.
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <FileText className="w-4 h-4 text-slate-400" />
            <span>{document.fileName}</span>
            {summary?.status && <Badge color="blue">{summary.status}</Badge>}
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
                <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium mb-1">
                  <CheckCircle className="w-4 h-4" />
                  Insurance claim summary
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{summary.summary}</p>
              </div>

              {hasStructuredFields ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
