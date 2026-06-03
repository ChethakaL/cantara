'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, Mail, PlugZap, RefreshCw, Unplug } from 'lucide-react'
import { Button, Input } from '@/components/ui'

type Status = {
  configured: boolean
  accountId: string | null
  connectedEmail?: string | null
  accountStatus?: string | null
  source: 'database' | 'env' | null
  apiConfigured: boolean
}

type ReminderScheduleStatus = {
  schedule: { timeZone: string; hour: number }
  zoned: { calendarDate: string; hour: number; timeZone: string }
  wouldRunNow: boolean
  skipReason: string | null
  lastRun: { calendarDate: string; ranAt: string } | null
}

type ReminderRunResult = {
  ok: boolean
  triggered: boolean
  reason: string
  summary?: {
    clientsScanned: number
    emailsSent: number
    emailsPlanned?: number
    emailsSkippedAlreadySent: number
    emailsFailed: number
    remindersQueued: number
    dryRun?: boolean
    errors: string[]
  }
}

export default function DeveloperMailSettingsPage() {
  const [secret, setSecret] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reminderStatus, setReminderStatus] = useState<ReminderScheduleStatus | null>(null)
  const [reminderRunResult, setReminderRunResult] = useState<ReminderRunResult | null>(null)
  const [runningReminders, setRunningReminders] = useState(false)

  useEffect(() => {
    const saved = sessionStorage.getItem('cantara_developer_secret') || ''
    if (saved) {
      setSecret(saved)
      const params = new URLSearchParams(window.location.search)
      const accountId = params.get('account_id')
      if (params.get('unipile') === 'connected' && accountId) {
        void saveReturnedAccountId(saved, accountId)
      } else {
        void loadStatus(saved)
      }
    }
  }, [])

  const apiHeaders = (value = secret) => ({
    'Content-Type': 'application/json',
    'x-developer-secret': value,
  })

  const loadStatus = async (secretValue = secret) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/developer/unipile-mail/status', {
        headers: apiHeaders(secretValue),
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(await res.text())
      setStatus(await res.json())
      setUnlocked(true)
      sessionStorage.setItem('cantara_developer_secret', secretValue)
      await loadReminderStatus(secretValue)
    } catch (err) {
      setUnlocked(false)
      setError(err instanceof Error ? err.message : 'Could not load mail status')
    } finally {
      setLoading(false)
    }
  }

  const connectMailbox = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/developer/unipile-mail/connect', {
        method: 'POST',
        headers: apiHeaders(),
        body: '{}',
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      if (!data.url) throw new Error('Unipile did not return a connect URL.')
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Unipile connection')
      setLoading(false)
    }
  }

  const saveReturnedAccountId = async (secretValue: string, accountId: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/developer/unipile-mail/status', {
        method: 'POST',
        headers: apiHeaders(secretValue),
        body: JSON.stringify({ accountId }),
      })
      if (!res.ok) throw new Error(await res.text())
      setStatus(await res.json())
      setUnlocked(true)
      sessionStorage.setItem('cantara_developer_secret', secretValue)
      window.history.replaceState({}, '', '/developer/mail-settings')
      await loadStatus(secretValue)
    } catch (err) {
      setUnlocked(true)
      setError(err instanceof Error ? err.message : 'Could not save connected sender')
    } finally {
      setLoading(false)
    }
  }

  const loadReminderStatus = async (secretValue = secret) => {
    try {
      const res = await fetch('/api/developer/document-deadline-reminders', {
        headers: apiHeaders(secretValue),
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(await res.text())
      setReminderStatus(await res.json())
    } catch (err) {
      setReminderStatus(null)
      setError(err instanceof Error ? err.message : 'Could not load reminder schedule')
    }
  }

  const runDeadlineReminders = async (opts: { force?: boolean; dryRun?: boolean }) => {
    setRunningReminders(true)
    setError(null)
    setReminderRunResult(null)
    try {
      const params = new URLSearchParams()
      if (opts.force) params.set('force', 'true')
      if (opts.dryRun) params.set('dryRun', 'true')
      const res = await fetch(`/api/developer/document-deadline-reminders?${params.toString()}`, {
        method: 'POST',
        headers: apiHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || await res.text())
      setReminderRunResult(data)
      await loadReminderStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not run deadline reminders')
    } finally {
      setRunningReminders(false)
    }
  }

  const disconnectMailbox = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/developer/unipile-mail/status', {
        method: 'DELETE',
        headers: apiHeaders(),
      })
      if (!res.ok) throw new Error(await res.text())
      setStatus(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disconnect sender')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <main className="mx-auto max-w-2xl">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-600">Developer Mail</p>
          <h1 className="mt-2 text-2xl font-semibold">Invitation Sender</h1>
          <p className="mt-2 text-sm text-slate-500">Mailbox used to send team member login invitations.</p>
        </div>

        {!unlocked ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <Input
              label="Developer password"
              type="password"
              autoComplete="off"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && secret) void loadStatus() }}
            />
            <div className="mt-4">
              <Button onClick={() => void loadStatus()} disabled={loading || !secret}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                Unlock
              </Button>
            </div>
            {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
          </section>
        ) : (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${status?.configured ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                  {status?.configured ? <CheckCircle2 className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
                </div>
                <div>
                  <h2 className="text-base font-semibold">
                    {status?.configured ? 'Connected' : 'Not connected'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {status?.configured
                      ? `Sending from ${status.connectedEmail || status.accountId || 'selected Unipile account'}`
                      : 'Connect aliya@cantarapet.com to send invitations.'}
                  </p>
                  {status?.accountStatus && <p className="mt-1 text-xs text-slate-400">Unipile status: {status.accountStatus}</p>}
                  {status?.source === 'env' && <p className="mt-1 text-xs text-slate-400">Configured from env.</p>}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => void loadStatus()} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {!status?.apiConfigured && (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Set UNIPILE_DSN and UNIPILE_ACCESS_TOKEN in .env before connecting.
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => void connectMailbox()} disabled={loading || !status?.apiConfigured}>
                <Mail className="h-4 w-4" />
                {status?.configured ? 'Change Sender' : 'Connect Sender'}
              </Button>
              {status?.configured && (
                <Button variant="danger" onClick={() => void disconnectMailbox()} disabled={loading || status.source === 'env'}>
                  <Unplug className="h-4 w-4" />
                  Disconnect
                </Button>
              )}
            </div>

            {status?.source === 'env' && (
              <p className="mt-3 text-xs text-slate-400">Env sender cannot be disconnected here. Remove UNIPILE_ACCOUNT_ID from .env or connect a new sender to override it.</p>
            )}
            {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
          </section>
        )}

        {unlocked && (
          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">Document deadline reminders</h2>
            <p className="mt-1 text-sm text-slate-500">
              Runs automatically once per day after 9:00 AM US Eastern when someone opens the admin dashboard or client portal (no server crontab).
            </p>
            {reminderStatus && (
              <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600 space-y-1">
                <p>Timezone: {reminderStatus.schedule.timeZone} · window starts {reminderStatus.schedule.hour}:00</p>
                <p>Now: {reminderStatus.zoned.calendarDate} {reminderStatus.zoned.hour}:00 local</p>
                <p>Would auto-run now: {reminderStatus.wouldRunNow ? 'Yes' : `No (${reminderStatus.skipReason})`}</p>
                {reminderStatus.lastRun && (
                  <p>Last run: {reminderStatus.lastRun.calendarDate} at {new Date(reminderStatus.lastRun.ranAt).toLocaleString()}</p>
                )}
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void loadReminderStatus()} disabled={runningReminders}>
                <RefreshCw className={`h-4 w-4 ${runningReminders ? 'animate-spin' : ''}`} />
                Refresh status
              </Button>
              <Button variant="outline" onClick={() => void runDeadlineReminders({ dryRun: true, force: true })} disabled={runningReminders}>
                Preview (dry run)
              </Button>
              <Button onClick={() => void runDeadlineReminders({ force: true })} disabled={runningReminders || !status?.configured}>
                {runningReminders ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Send reminders now
              </Button>
            </div>
            {reminderRunResult?.summary && (
              <pre className="mt-3 max-h-48 overflow-auto rounded-lg border border-slate-100 bg-slate-50 p-3 text-[11px] text-slate-700">
                {JSON.stringify(reminderRunResult.summary, null, 2)}
              </pre>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
