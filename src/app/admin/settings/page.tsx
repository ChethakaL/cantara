'use client'

import { useEffect, useState } from 'react'
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react'
import AdminNav from '@/components/admin/AdminNav'
import { Button, Input } from '@/components/ui'
import { getAdminName } from '@/lib/store'

type KeyStatus = {
  configured: boolean
  maskedKey: string | null
  source: 'database' | 'env'
}

export default function AdminSettingsPage() {
  const [status, setStatus] = useState<KeyStatus | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadStatus = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/settings/anthropic-key', { cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())
      setStatus(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadStatus()
  }, [])

  const saveKey = async () => {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/settings/anthropic-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      })
      if (!res.ok) throw new Error(await res.text())
      setStatus(await res.json())
      setApiKey('')
      setMessage('Claude API key saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save API key')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav name={getAdminName()} />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cantara-gold">Admin Settings</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">AI credentials</h1>
          <p className="mt-2 text-sm text-slate-500">
            Production uses AWS Bedrock when <code className="text-xs">AI_PROVIDER=bedrock</code> and AWS credentials are set on the server.
            The key below is only for direct Anthropic API fallback (local dev).
          </p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Anthropic credential</h2>
              {loading ? (
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                </div>
              ) : status?.configured ? (
                <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700">
                  <ShieldCheck className="h-4 w-4" />
                  {status.maskedKey} <span className="text-emerald-500">({status.source})</span>
                </div>
              ) : (
                <p className="mt-2 text-sm text-amber-700">No Claude API key configured.</p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <Input
              label="New Claude API key"
              type="password"
              autoComplete="off"
              placeholder="sk-ant-..."
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
            />
            {error && <p className="text-sm text-rose-600">{error}</p>}
            {message && <p className="text-sm text-emerald-700">{message}</p>}
            <Button onClick={() => void saveKey()} disabled={saving || !apiKey.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {saving ? 'Saving...' : 'Save API Key'}
            </Button>
          </div>
        </section>
      </main>
    </div>
  )
}
