'use client'

import { useEffect, useState } from 'react'
import { KeyRound, Loader2, ShieldCheck, Database, Sliders, CheckCircle2, Lock } from 'lucide-react'
import { AdminPortalHeader } from '@/components/admin/AdminPortalHeader'
import { Button, Input } from '@/components/ui'
import { useAdminInboxUnread } from '@/hooks/useChatRoom'
import GoogleServicesCard from '@/components/admin/GoogleServicesCard'
import { DataPrivacySecurityPolicy } from '@/components/settings/DataPrivacySecurityPolicy'
import { MONDAY_ITEM_NAME_COLUMN_ID, MONDAY_ITEM_NAME_COLUMN_LABEL } from '@/lib/monday-client-import'
import { getAdminEmail } from '@/lib/store'
import {
  emptyMondayGlobalMappingForm,
  MONDAY_GLOBAL_MAPPING_FIELDS,
  type MondayGlobalMappingKey,
} from '@/lib/monday-settings'
import {
  emptySalesLeadMondayMapping,
  SALES_LEAD_MONDAY_MAPPING_FIELDS,
  type SalesLeadMondayMappingForm,
  type SalesLeadMondayMappingKey,
} from '@/lib/sales-leads/monday-settings'

type KeyStatus = {
  configured: boolean
  maskedKey: string | null
  source: 'database' | 'env'
}

type MondayBoard = {
  id: string
  name: string
}

type MondayColumn = {
  id: string
  title: string
  type: string
}

type MondayMappingState = Record<MondayGlobalMappingKey, string>

const EMPTY_MONDAY_MAPPING = emptyMondayGlobalMappingForm()

export default function AdminSettingsPage() {
  const { total: unreadCount } = useAdminInboxUnread()
  const [status, setStatus] = useState<KeyStatus | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Monday.com configs
  const [mondayBoardId, setMondayBoardId] = useState('')
  const [mondayMapping, setMondayMapping] = useState<MondayMappingState>(EMPTY_MONDAY_MAPPING)
  const [availableBoards, setAvailableBoards] = useState<MondayBoard[]>([])
  const [availableColumns, setAvailableColumns] = useState<MondayColumn[]>([])
  const [loadingMondayMeta, setLoadingMondayMeta] = useState(false)
  const [mondayStatusMessage, setMondayStatusMessage] = useState<string | null>(null)
  const [salesLeadBoardId, setSalesLeadBoardId] = useState('')
  const [salesLeadMapping, setSalesLeadMapping] = useState<SalesLeadMondayMappingForm>(
    emptySalesLeadMondayMapping(),
  )
  const [salesLeadColumns, setSalesLeadColumns] = useState<MondayColumn[]>([])
  const [salesLeadMappingMessage, setSalesLeadMappingMessage] = useState<string | null>(null)
  const [savingSalesLeadMapping, setSavingSalesLeadMapping] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpSending, setOtpSending] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [passwordSaving, setPasswordSaving] = useState(false)

  const loadStatus = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/settings/anthropic-key', { cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())
      setStatus(await res.json())

      // Load Monday Settings
      const mRes = await fetch('/api/admin/settings/monday', { cache: 'no-store' })
      if (mRes.ok) {
        const mData = await mRes.json()
        if (mData.boardId) setMondayBoardId(mData.boardId)
        if (mData.columnMapping) {
          setMondayMapping(prev => ({ ...prev, ...mData.columnMapping }))
        }
      }
      const salesLeadRes = await fetch('/api/admin/settings/sales-leads-monday', { cache: 'no-store' })
      if (salesLeadRes.ok) {
        const salesLeadData = await salesLeadRes.json()
        if (salesLeadData.boardId) setSalesLeadBoardId(salesLeadData.boardId)
        if (salesLeadData.columnMapping) {
          setSalesLeadMapping(previous => ({ ...previous, ...salesLeadData.columnMapping }))
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  // Load Boards list from Monday integration
  const loadMondayMetadata = async () => {
    setLoadingMondayMeta(true)
    try {
      const res = await fetch('/api/composio/monday/boards')
      if (res.ok) {
        const d = await res.json()
        setAvailableBoards(d.boards ?? [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingMondayMeta(false)
    }
  };

  // Fetch columns when Board ID changes
  useEffect(() => {
    if (!mondayBoardId || mondayBoardId === 'undefined') return
    const fetchCols = async () => {
      try {
        const res = await fetch(`/api/composio/monday/columns?boardId=${mondayBoardId}`)
        if (res.ok) {
          const d = await res.json()
          const columns = d.columns ?? []
          const colsMap = new Map<string, MondayColumn>()
          for (const col of columns) {
            if (col.id) {
              colsMap.set(col.id, {
                id: col.id,
                title: col.title || col.id,
                type: col.type || 'text',
              })
            }
          }
          // Include item name mapping helper
          colsMap.set(MONDAY_ITEM_NAME_COLUMN_ID, {
            id: MONDAY_ITEM_NAME_COLUMN_ID,
            title: MONDAY_ITEM_NAME_COLUMN_LABEL,
            type: 'name',
          })
          setAvailableColumns(Array.from(colsMap.values()))
        }
      } catch (e) {
        console.error(e)
      }
    }
    void fetchCols()
  }, [mondayBoardId])

  useEffect(() => {
    if (!salesLeadBoardId) {
      setSalesLeadColumns([])
      return
    }
    let active = true
    ;(async () => {
      try {
        const response = await fetch(
          `/api/composio/monday/columns?boardId=${encodeURIComponent(salesLeadBoardId)}`,
          { cache: 'no-store' },
        )
        if (!response.ok) throw new Error(await response.text())
        const data = await response.json()
        if (!active) return
        const columns = Array.isArray(data.columns) ? data.columns : []
        setSalesLeadColumns(columns.map((column: MondayColumn) => ({
          id: column.id,
          title: column.title || column.id,
          type: column.type || 'text',
        })))
      } catch (fetchError) {
        if (active) setError(fetchError instanceof Error ? fetchError.message : 'Failed to load Sales Lead columns')
      }
    })()
    return () => { active = false }
  }, [salesLeadBoardId])

  useEffect(() => {
    setAdminEmail(getAdminEmail())
    void loadStatus()
    void loadMondayMetadata()
  }, [])

  const requestOtp = async () => {
    if (!adminEmail) return
    setOtpSending(true)
    setPasswordMessage(null)
    try {
      const res = await fetch('/api/auth/admin/request-password-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail }),
      })
      if (!res.ok) throw new Error(await res.text())
      setOtpSent(true)
      setPasswordMessage('Verification code sent to your email.')
    } catch (err) {
      setPasswordMessage(err instanceof Error ? err.message : 'Failed to send verification code.')
    } finally {
      setOtpSending(false)
    }
  }

  const verifyOtpAndReset = async () => {
    if (!adminEmail) return
    if (newPassword !== confirmPassword) {
      setPasswordMessage('Passwords do not match.')
      return
    }
    setPasswordSaving(true)
    setPasswordMessage(null)
    try {
      const res = await fetch('/api/auth/admin/verify-password-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, code: otpCode, newPassword }),
      })
      if (!res.ok) throw new Error(await res.text())
      setOtpCode('')
      setNewPassword('')
      setConfirmPassword('')
      setOtpSent(false)
      setPasswordMessage('Password updated successfully.')
    } catch (err) {
      setPasswordMessage(err instanceof Error ? err.message : 'Failed to update password.')
    } finally {
      setPasswordSaving(false)
    }
  }

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

  const saveMondaySettings = async () => {
    setSaving(true)
    setMondayStatusMessage(null)
    try {
      const res = await fetch('/api/admin/settings/monday', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardId: mondayBoardId,
          columnMapping: mondayMapping,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      setMondayStatusMessage('Monday.com mapping saved successfully.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save Monday configurations')
    } finally {
      setSaving(false)
    }
  }

  const handleMappingChange = (field: MondayGlobalMappingKey, val: string) => {
    setMondayMapping(prev => ({ ...prev, [field]: val }))
  }

  const saveSalesLeadMondaySettings = async () => {
    setSavingSalesLeadMapping(true)
    setSalesLeadMappingMessage(null)
    try {
      const response = await fetch('/api/admin/settings/sales-leads-monday', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardId: salesLeadBoardId,
          columnMapping: salesLeadMapping,
        }),
      })
      if (!response.ok) throw new Error(await response.text())
      setSalesLeadMappingMessage('Sales Leads mapping saved successfully.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save Sales Leads mapping')
    } finally {
      setSavingSalesLeadMapping(false)
    }
  }

  const handleSalesLeadMappingChange = (field: SalesLeadMondayMappingKey, value: string) => {
    setSalesLeadMapping(previous => ({ ...previous, [field]: value }))
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminPortalHeader pageLabel="Settings" unreadCount={unreadCount} active="settings" />
      <main className="mx-auto max-w-3xl px-4 md:px-6 py-10 space-y-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cantara-gold">Admin Settings</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Credentials & Integrations</h1>
          <p className="mt-2 text-sm text-slate-500">
            Configure system-wide integrations, credentials, and custom entity mappings.
          </p>
        </div>

        <GoogleServicesCard />

        {/* Anthropic Section */}
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

        {/* Monday.com Section */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Monday.com Global Mapping</h2>
              <p className="text-xs text-slate-400 mt-1">Specify which board and column mappings to enforce globally for all users.</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Target Monday Board</label>
              {loadingMondayMeta ? (
                <div className="flex items-center gap-2 text-xs text-slate-400"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading boards...</div>
              ) : (
                <select
                  className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20"
                  value={mondayBoardId}
                  onChange={e => setMondayBoardId(e.target.value)}
                >
                  <option value="">— Select a Board —</option>
                  {availableBoards.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.id})</option>
                  ))}
                </select>
              )}
            </div>

            {mondayBoardId && (
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <Sliders className="w-3.5 h-3.5 text-slate-400" /> Custom Field Mappings
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {MONDAY_GLOBAL_MAPPING_FIELDS.map(field => (
                    <div key={field.key}>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1.5">{field.label}</label>
                      <select
                        className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-1.5 outline-none focus:border-red-400"
                        value={mondayMapping[field.key] || ''}
                        onChange={e => handleMappingChange(field.key, e.target.value)}
                      >
                        <option value="">— Not Mapped / Auto Detect —</option>
                        {availableColumns.map(col => (
                          <option key={col.id} value={col.id}>{col.title} ({col.type})</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mondayStatusMessage && (
              <p className="text-xs text-emerald-700 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> {mondayStatusMessage}</p>
            )}

            <Button onClick={() => void saveMondaySettings()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {saving ? 'Saving...' : 'Save Monday Mapping'}
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Sales Leads Monday mapping</h2>
              <p className="text-xs text-slate-400 mt-1">
                Map the internal Sales Leads workflow fields to the selected Monday board. Reading and saving this
                configuration does not modify the Monday board.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Sales Leads Board
              </label>
              <select
                className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
                value={salesLeadBoardId}
                onChange={event => setSalesLeadBoardId(event.target.value)}
              >
                <option value="">Select a board</option>
                {availableBoards.map(board => (
                  <option key={board.id} value={board.id}>{board.name} ({board.id})</option>
                ))}
              </select>
            </div>

            {salesLeadBoardId && (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600">Workflow column mappings</span>
                  <span className="text-slate-400">{salesLeadColumns.length} Monday columns found</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {SALES_LEAD_MONDAY_MAPPING_FIELDS.map(field => (
                    <div key={field.key}>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1.5">{field.label}</label>
                      <select
                        className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-1.5 outline-none focus:border-blue-400"
                        value={salesLeadMapping[field.key]}
                        onChange={event => handleSalesLeadMappingChange(field.key, event.target.value)}
                      >
                        <option value="">Not mapped</option>
                        {salesLeadColumns.map(column => (
                          <option key={column.id} value={column.id}>
                            {column.title} ({column.type}) - {column.id}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </>
            )}

            {salesLeadMappingMessage && (
              <p className="text-xs text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> {salesLeadMappingMessage}
              </p>
            )}
            <Button
              onClick={() => void saveSalesLeadMondaySettings()}
              disabled={savingSalesLeadMapping || !salesLeadBoardId}
            >
              {savingSalesLeadMapping
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <ShieldCheck className="h-4 w-4" />}
              {savingSalesLeadMapping ? 'Saving...' : 'Save Sales Leads Mapping'}
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Change password</h2>
              <p className="text-xs text-slate-400 mt-1">
                Send a one-time verification code and update your advisor portal password.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              We&apos;ll email a one-time verification code to <span className="font-medium text-slate-700">{adminEmail || 'your advisor email'}</span>.
            </p>
            {!otpSent ? (
              <Button size="sm" variant="outline" onClick={() => void requestOtp()} disabled={otpSending || !adminEmail}>
                {otpSending ? 'Sending code…' : 'Send verification code'}
              </Button>
            ) : (
              <div className="space-y-3">
                <Input label="Verification code" value={otpCode} onChange={e => setOtpCode(e.target.value)} placeholder="6-digit code" />
                <Input label="New password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                <Input label="Confirm new password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                <div className="flex items-center gap-3">
                  <Button size="sm" onClick={() => void verifyOtpAndReset()} disabled={passwordSaving || !otpCode || !newPassword}>
                    {passwordSaving ? 'Updating…' : 'Update password'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void requestOtp()} disabled={otpSending}>
                    Resend code
                  </Button>
                </div>
              </div>
            )}
            {passwordMessage && (
              <p className={`text-xs ${passwordMessage.includes('success') ? 'text-emerald-600' : 'text-slate-600'}`}>{passwordMessage}</p>
            )}
          </div>
        </section>

        <DataPrivacySecurityPolicy defaultOpen={false} />
      </main>
    </div>
  )
}
