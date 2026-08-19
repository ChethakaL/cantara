'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Mail, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui'

export default function AdvisorGmailSettings() {
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/advisor/mail', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load Gmail status')
      setEmail(data.email || null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Gmail status')
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  const connect = async () => {
    setConnecting(true); setError(null)
    try {
      const res = await fetch('/api/advisor/mail', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start Gmail connection')
      window.location.href = data.redirect_url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect Gmail')
      setConnecting(false)
    }
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div className="flex gap-3">
        <Mail className="mt-1 h-5 w-5 text-[#b8922a]" />
        <div>
          <h2 className="font-semibold text-slate-800">Your Gmail</h2>
          <p className="mt-1 text-sm text-slate-500">Connect your own Gmail so client invitations and sales-lead emails are sent from your account. Sent messages appear in that Gmail Sent folder.</p>
          {email && <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" />{email}</p>}
          {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={connect} disabled={loading || connecting}>
        {connecting ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
        {email ? 'Reconnect Gmail' : 'Connect Gmail'}
      </Button>
    </div>
  </section>
}
