'use client'

import { useEffect, useState } from 'react'
import { Calendar, FolderOpen, Loader2, LogOut, Mail, RefreshCw } from 'lucide-react'
import { Badge, Button, Card } from '@/components/ui'

type GoogleStatus = {
  gmail: boolean
  calendar: boolean
  drive: boolean
  connected: boolean
  email: string | null
}

export default function GoogleServicesCard({
  onManageFolders,
}: {
  onManageFolders?: () => void
}) {
  const [status, setStatus] = useState<GoogleStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/advisor/google-services', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load Google services')
      setStatus(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Google services')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    const params = new URLSearchParams(window.location.search)
    if (params.get('google') === 'connected') {
      setNotice('Google services connected. Gmail, Calendar, and Drive are ready.')
    }
    if (params.get('google') === 'error') {
      setError('Google connection did not finish. Click Connect to try again.')
    }
  }, [])

  const connect = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/advisor/google-services', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start Google connection')
      window.location.href = data.redirect_url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect Google services')
      setBusy(false)
    }
  }

  const disconnect = async () => {
    if (!window.confirm('Disconnect Gmail, Calendar, and Google Drive for this advisor?')) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/advisor/google-services', { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to disconnect')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to disconnect Google services')
    } finally {
      setBusy(false)
    }
  }

  const anyConnected = Boolean(status?.gmail || status?.calendar || status?.drive)
  const allConnected = Boolean(status?.connected)

  return (
    <Card className="p-5 mb-4 border-cantara-gold/20">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(202,161,95,0.08)' }}
          >
            <Mail className="w-5 h-5" style={{ color: '#CAA15F' }} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-slate-800">Connect your Google services</h3>
              {loading ? (
                <Badge color="slate">Checking...</Badge>
              ) : allConnected ? (
                <Badge color="green">Connected</Badge>
              ) : anyConnected ? (
                <Badge color="amber">Partial</Badge>
              ) : (
                <Badge color="slate">Not connected</Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              One Connect signs in Gmail, Calendar, and Drive in a single chain, then returns here.
              {status?.email ? (
                <> Emails send from <span className="font-semibold text-slate-700">{status.email}</span>.</>
              ) : (
                <> Use this for sales-lead mail, meeting lookup, and client Drive folders.</>
              )}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${status?.gmail ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                <Mail className="w-3 h-3" /> Gmail
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${status?.calendar ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                <Calendar className="w-3 h-3" /> Calendar
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${status?.drive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                <FolderOpen className="w-3 h-3" /> Drive
              </span>
            </div>
            {notice && <p className="mt-2 text-xs text-emerald-700">{notice}</p>}
            {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          {status?.drive && onManageFolders && (
            <Button size="sm" variant="outline" onClick={onManageFolders}>
              <FolderOpen className="w-3.5 h-3.5" />
              Manage folders
            </Button>
          )}
          <Button
            size="sm"
            variant={anyConnected ? 'outline' : 'primary'}
            onClick={() => void connect()}
            disabled={loading || busy}
            className={anyConnected ? 'border-amber-200 text-amber-800 hover:bg-amber-50' : ''}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {anyConnected ? 'Reconnect' : 'Connect'}
          </Button>
          {anyConnected && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void disconnect()}
              disabled={loading || busy}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            >
              <LogOut className="w-3.5 h-3.5" />
              Disconnect
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
