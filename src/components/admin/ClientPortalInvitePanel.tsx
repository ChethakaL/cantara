'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, Mail, RefreshCw, Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui'

type PortalInviteDraft = {
  clientId: string
  recipientEmail: string
  recipientName: string
  businessName: string
  password: string
  loginUrl: string
  fromEmail: string
  subject: string
  bodyHtml: string
  defaultSubject: string
  defaultBodyHtml: string
  status: 'NOT_SENT' | 'SENT' | 'FAILED'
  lastSentAt: string | null
  errorMessage: string | null
  mailConfigured: boolean
  connectedSenderEmail: string | null
}

function EditableEmailPreview({
  initialHtml,
  onChange,
  resetKey,
}: {
  initialHtml: string
  onChange: (html: string) => void
  resetKey: number
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const initialHtmlRef = useRef(initialHtml)
  initialHtmlRef.current = initialHtml
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Only re-write iframe content when resetKey changes (initial load or user clicks Reset)
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) return

    doc.open()
    doc.write(initialHtmlRef.current)
    doc.close()

    if (doc.body) {
      doc.body.contentEditable = 'true'
      doc.body.style.outline = 'none'
      doc.body.style.cursor = 'text'

      const style = doc.createElement('style')
      style.textContent = `
        body { outline: none; }
        [contenteditable]:focus { outline: none; }
      `
      doc.head.appendChild(style)

      const handleInput = () => {
        const fullHtml = `<!DOCTYPE html>\n<html>\n<head>${doc.head.innerHTML}</head>\n<body style="${doc.body.getAttribute('style') || ''}">${doc.body.innerHTML}</body>\n</html>`
        onChangeRef.current(fullHtml)
      }

      doc.body.addEventListener('input', handleInput)
    }
  }, [resetKey])

  return (
    <div className="rounded-xl border border-slate-200 bg-[#f8fafc] overflow-hidden shadow-inner">
      <iframe
        ref={iframeRef}
        title="Portal Invitation Email Preview"
        className="w-full h-[460px] border-0 bg-white"
        sandbox="allow-same-origin allow-popups allow-forms"
      />
    </div>
  )
}

export default function ClientPortalInvitePanel({ clientId }: { clientId: string }) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [draft, setDraft] = useState<PortalInviteDraft | null>(null)
  const [subject, setSubject] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [resetKey, setResetKey] = useState(0)

  const loadDraft = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/clients/${clientId}/portal-invite`, { cache: 'no-store' })
      if (!res.ok) throw new Error((await res.text()).trim() || 'Failed to load invitation')
      const data = (await res.json()) as PortalInviteDraft
      setDraft(data)
      setSubject(data.subject)
      setBodyHtml(data.bodyHtml)
      setResetKey(k => k + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load invitation')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    void loadDraft()
  }, [loadDraft])

  useEffect(() => {
    if (expanded && !draft && !loading) {
      void loadDraft()
    }
  }, [expanded, draft, loading, loadDraft])

  const handleOpen = () => {
    setExpanded(true)
    setSendError(null)
  }

  const handleReset = () => {
    if (!draft) return
    setSubject(draft.defaultSubject)
    setBodyHtml(draft.defaultBodyHtml)
    setResetKey(k => k + 1)
    setSendError(null)
  }

  const handleSend = async () => {
    if (!subject.trim() || !bodyHtml.trim()) {
      setSendError('Subject and email body are required.')
      return
    }
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch(`/api/clients/${clientId}/portal-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), bodyHtml: bodyHtml.trim() }),
      })
      const data = await res.json().catch(() => ({} as { errorMessage?: string }))
      if (!res.ok) {
        throw new Error(
          (typeof data.errorMessage === 'string' && data.errorMessage) ||
            'Failed to send invitation',
        )
      }
      await loadDraft()
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Failed to send invitation')
      await loadDraft()
    } finally {
      setSending(false)
    }
  }

  const statusBadge = () => {
    if (!draft) return null
    if (draft.status === 'SENT') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" />
          Sent{draft.lastSentAt ? ` · ${new Date(draft.lastSentAt).toLocaleString()}` : ''}
        </span>
      )
    }
    if (draft.status === 'FAILED') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 border border-rose-200">
          <AlertCircle className="w-3 h-3" />
          Failed to send
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 border border-slate-200">
        Not sent yet
      </span>
    )
  }

  return (
    <section className="rounded-2xl border border-[#F1E6BB]/60 bg-gradient-to-br from-[#FFFBF0] to-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#b8922a]" />
            <h4 className="text-sm font-semibold text-slate-800">Portal invitation email</h4>
          </div>
          <p className="mt-1 text-xs text-slate-500 max-w-xl">
            Review and edit the onboarding email before sending. Invitations are sent manually from your connected Gmail — they are not sent automatically when a client is created.
          </p>
          {draft && <div className="mt-2">{statusBadge()}</div>}
          {draft?.status === 'FAILED' && draft.errorMessage && (
            <p className="mt-2 text-xs text-rose-600">{draft.errorMessage}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!expanded ? (
            <Button size="sm" onClick={handleOpen}>
              Review &amp; send invitation
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setExpanded(false)}>
              Collapse
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-5 space-y-4 border-t border-[#F1E6BB]/50 pt-5">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading invitation draft…
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {draft && !loading && (
            <>
              {!draft.mailConfigured && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <p>Connect your Gmail before sending this invitation. It will be sent from your own connected Gmail account.</p>
                  <a href="/admin/settings" className="mt-1.5 inline-block font-semibold text-amber-900 underline underline-offset-2">
                    Connect Gmail in Advisor Settings →
                  </a>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">From</p>
                  <p className="font-medium text-slate-700">{draft.connectedSenderEmail || 'Connect your Gmail first'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">To</p>
                  <p className="font-medium text-slate-700">{draft.recipientName}</p>
                  <p className="text-slate-500">{draft.recipientEmail}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Subject</label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <label className="block text-xs font-semibold text-slate-700">Email body</label>
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-normal">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      Click anywhere inside the email to edit text
                    </span>
                  </div>
                  <button type="button" onClick={handleReset} className="text-[11px] text-slate-500 hover:text-slate-700 underline font-medium">
                    Reset to default template
                  </button>
                </div>

                <EditableEmailPreview
                  initialHtml={bodyHtml}
                  onChange={setBodyHtml}
                  resetKey={resetKey}
                />

                <p className="mt-2 text-[11px] text-slate-400">
                  Login URL:{' '}
                  <a href={draft.loginUrl} target="_blank" rel="noreferrer" className="text-[#b8922a] inline-flex items-center gap-1 font-medium hover:underline">
                    {draft.loginUrl}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  {' · '}
                  Password included in template: <code className="text-slate-700 font-semibold bg-slate-100 px-1 py-0.5 rounded">{draft.password}</code>
                </p>
              </div>

              {sendError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {sendError}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => void handleSend()} disabled={sending || !draft.mailConfigured}>
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {draft.status === 'SENT' ? 'Send again' : 'Send invitation'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => void loadDraft()} disabled={loading || sending}>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh status
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}
