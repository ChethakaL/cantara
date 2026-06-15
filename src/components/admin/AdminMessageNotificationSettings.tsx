'use client'

import { useEffect, useState } from 'react'
import { Loader2, MessageSquare } from 'lucide-react'
import { Button, Card, Input } from '@/components/ui'
import type { AdminMessageNotificationPreferences } from '@/lib/admin-message-notification-preferences'

export function AdminMessageNotificationSettings() {
  const [prefs, setPrefs] = useState<AdminMessageNotificationPreferences>({
    emailCantaraEnabled: true,
    cantaraNotificationEmail: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/settings/message-notifications', { cache: 'no-store' })
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
        setPrefs(data.preferences)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load message notification settings')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const save = async () => {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch('/api/admin/settings/message-notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setPrefs(data.preferences)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card className="p-5 flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading notification settings…
      </Card>
    )
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-slate-500" />
        <h2 className="text-sm font-semibold text-slate-800">Message email notifications</h2>
      </div>
      <p className="text-xs text-slate-500">
        Control whether Cantara receives email alerts when a client sends a portal message. Client-side message emails are managed in each client&apos;s portal settings. In-app chat always works regardless of this toggle.
      </p>

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-slate-700">Email Cantara team</p>
            <p className="text-xs text-slate-400 mt-0.5">When the client sends a portal message</p>
          </div>
          <button
            onClick={() => setPrefs(current => ({ ...current, emailCantaraEnabled: !current.emailCantaraEnabled }))}
            className={`relative w-11 h-6 rounded-full transition-all shrink-0 ${prefs.emailCantaraEnabled ? 'bg-amber-500' : 'bg-slate-200'}`}
            aria-label="Toggle Cantara message emails"
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${prefs.emailCantaraEnabled ? 'left-6' : 'left-1'}`} />
          </button>
        </div>

        <Input
          label="Cantara notification email"
          type="email"
          placeholder="advisors@cantarapet.com"
          value={prefs.cantaraNotificationEmail}
          onChange={e => setPrefs(current => ({ ...current, cantaraNotificationEmail: e.target.value }))}
        />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Button size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save notification settings'}
        </Button>
        {saved && <span className="text-xs text-emerald-600">Saved</span>}
        {error && <span className="text-xs text-rose-600">{error}</span>}
      </div>
    </Card>
  )
}
