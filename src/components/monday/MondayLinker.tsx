'use client'

import { useState, useEffect } from 'react'
import {
  CheckCircle2, ChevronDown, ExternalLink, Loader2,
  RefreshCw, Trello, AlertCircle, Link2, Search
} from 'lucide-react'
import { Button, Card, cn } from '@/components/ui'

interface Props {
  clientId: string
  clientName: string
  reportType: 'CIM' | 'Teaser'
  /** A URL if already exists. If null, we'll offer to save to Drive and link. */
  fileUrl?: string | null
  /** The generated HTML content of the report to be saved to Drive */
  html: string | null
}

type ConnectionState = 'loading' | 'connected' | 'disconnected' | 'error'

interface Board { id: string; name: string }
interface Item { id: string; name: string }

export default function MondayLinker({ clientId, clientName, reportType, fileUrl: initialFileUrl, html }: Props) {
  const [fileUrl, setFileUrl] = useState<string | null>(initialFileUrl || null)
  const [savingToDrive, setSavingToDrive] = useState(false)
  const [connState, setConnState] = useState<ConnectionState>('loading')
  const [connecting, setConnecting] = useState(false)

  const [boards, setBoards] = useState<Board[]>([])
  const [loadingBoards, setLoadingBoards] = useState(false)
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null)

  const [items, setItems] = useState<Item[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)

  const [linking, setLinking] = useState(false)
  const [linked, setLinked] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Check connection ────────────────────────────────────────────────────────
  useEffect(() => { void checkStatus() }, [])
  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const checkStatus = async () => {
    setConnState('loading')
    try {
      const res = await fetch('/api/composio/monday/status')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setConnState(data.connected ? 'connected' : 'disconnected')
      if (data.connected) void fetchBoards()
    } catch {
      setConnState('error')
    }
  }

  // ── Fetch boards ────────────────────────────────────────────────────────────
  const fetchBoards = async () => {
    setLoadingBoards(true)
    setError(null)
    try {
      const res = await fetch('/api/composio/monday/boards')
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setBoards(data.boards ?? [])
    } catch (err: any) {
      setError(err.message || 'Failed to load boards')
    } finally {
      setLoadingBoards(false)
    }
  }

  // ── Fetch items for selected board ─────────────────────────────────────────
  useEffect(() => {
    if (!selectedBoard) return
    void fetchItems(selectedBoard.id)
  }, [selectedBoard])

  const fetchItems = async (boardId: string) => {
    setLoadingItems(true)
    setSelectedItem(null)
    setError(null)
    try {
      const res = await fetch(`/api/composio/monday/items?boardId=${boardId}`)
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setItems(data.items ?? [])
    } catch (err: any) {
      setError(err.message || 'Failed to load board items')
    } finally {
      setLoadingItems(false)
    }
  }

  // ── Connect Monday.com ──────────────────────────────────────────────────────
  const connectMonday = async () => {
    setConnecting(true)
    setError(null)
    try {
      const res = await fetch('/api/composio/monday/connect', { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      if (data.redirect_url) {
        window.open(data.redirect_url, '_blank', 'noopener,noreferrer')
        // Poll status after redirect
        setTimeout(() => void checkStatus(), 4000)
        setTimeout(() => void checkStatus(), 10000)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start Monday.com connection')
    } finally {
      setConnecting(false)
    }
  }

  // ── Link report to Monday item ─────────────────────────────────────────────
  const saveToDriveAndLink = async () => {
    if (!selectedItem || !html) return
    setSavingToDrive(true)
    try {
      const fileName = `${clientName.replace(/\s+/g, '-').toLowerCase()}-${reportType.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`
      const res = await fetch('/api/drive/save-report', {
        method: 'POST',
        body: JSON.stringify({ clientId, fileName, html }),
      })
      if (!res.ok) throw new Error(await res.text() || 'Failed to save to Drive')
      const result = await res.json()
      const driveUrl = result.result?.webViewLink
      if (!driveUrl) throw new Error('No Drive link returned')
      
      setFileUrl(driveUrl)
      // Now link it
      await linkReport(driveUrl)
    } catch (err: any) {
      console.error('Save and link error:', err)
      alert(err.message || 'Failed to save to Drive and link to Monday')
    } finally {
      setSavingToDrive(false)
    }
  }

  const linkReport = async (overrideUrl?: string) => {
    const urlToUse = overrideUrl || fileUrl
    if (!selectedItem || !urlToUse) return
    setLinking(true)
    setError(null)
    try {
      const res = await fetch('/api/composio/monday/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: selectedItem.id,
          reportType,
          clientName,
          fileUrl: urlToUse,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      setLinked(true)
    } catch (err: any) {
      setError(err.message || 'Failed to link to Monday.com')
    } finally {
      setLinking(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Card className="p-5 border-[#FF3D57]/10 bg-gradient-to-br from-white to-[#FF3D57]/[0.02]">
      <div className="flex items-start gap-3">
        {/* Monday brand icon */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
          style={{ background: 'linear-gradient(135deg,#FF3D57,#FF9A3C)' }}
        >
          <Trello className="w-5 h-5 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Monday.com</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Link this {reportType} to a Monday board item so your team can track it.
              </p>
            </div>

            {/* Status badge */}
            {connState === 'loading' && (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            )}
            {connState === 'connected' && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                <CheckCircle2 className="w-3 h-3" /> Connected
              </span>
            )}
            {connState === 'disconnected' && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full">
                Not connected
              </span>
            )}
            {connState === 'error' && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
                <AlertCircle className="w-3 h-3" /> Error
              </span>
            )}
          </div>

          {/* ── DISCONNECTED state ── */}
          {(connState === 'disconnected' || connState === 'error') && (
            <div className="mt-4 flex items-center gap-2">
              <Button
                size="sm"
                onClick={connectMonday}
                disabled={connecting}
                style={{ background: 'linear-gradient(135deg,#FF3D57,#FF9A3C)', color: '#fff', border: 'none' }}
              >
                {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                Connect Monday.com
              </Button>
              {connState === 'error' && (
                <Button size="sm" variant="outline" onClick={checkStatus}>
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
                </Button>
              )}
            </div>
          )}

          {/* ── CONNECTED state ── */}
          {connState === 'connected' && (
            <div className="mt-4 space-y-3">
              {!fileUrl && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Generate and download the {reportType} first, then paste the file URL below to link it.
                </div>
              )}

              {/* Board selector */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
                  1. Select a Board
                </label>
                {loadingBoards ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading boards...
                  </div>
                ) : boards.length === 0 ? (
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    No boards found.{' '}
                    <button onClick={fetchBoards} className="underline text-amber-600 hover:text-amber-700">
                      Refresh
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      id="monday-board-select"
                      className="w-full text-xs rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 appearance-none outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all"
                      value={selectedBoard?.id ?? ''}
                      onChange={(e) => {
                        const board = boards.find((b) => b.id === e.target.value) ?? null
                        setSelectedBoard(board)
                        setLinked(false)
                      }}
                    >
                      <option value="">— Choose a board —</option>
                      {boards.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                )}
              </div>

              {/* Item selector (shown after board selected) */}
              {selectedBoard && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      2. Select an Item / Deal
                    </label>
                    {!loadingItems && (
                      <button 
                        onClick={() => selectedBoard && void fetchItems(selectedBoard.id)} 
                        className="text-[10px] text-amber-600 hover:underline flex items-center gap-1"
                      >
                        <RefreshCw className="w-2.5 h-2.5" /> Refresh
                      </button>
                    )}
                  </div>
                  
                  {loadingItems ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading deals from Monday...
                    </div>
                  ) : items.length === 0 ? (
                    <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2.5 border border-slate-200">
                      No items found on this board.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search deals..."
                          className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50/50 pl-8 pr-3 py-2 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                      
                      <div className="relative">
                        <select
                          id="monday-item-select"
                          className="w-full text-xs rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 appearance-none outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all max-h-40"
                          value={selectedItem?.id ?? ''}
                          onChange={(e) => {
                            const item = items.find((i) => i.id === e.target.value) ?? null
                            setSelectedItem(item)
                            setLinked(false)
                          }}
                          size={filteredItems.length > 0 ? Math.min(6, filteredItems.length + 1) : 1}
                        >
                          <option value="">— {filteredItems.length > 0 ? `Found ${filteredItems.length} matches` : 'No matches found'} —</option>
                          {filteredItems.map((i) => (
                            <option key={i.id} value={i.id} className="py-1.5 px-2 cursor-pointer hover:bg-amber-50">
                              {i.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}


              {/* Link button */}
              {selectedItem && (
                <div>
                  {linked ? (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-xs text-emerald-700 font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      Successfully linked to <span className="font-bold">{selectedItem.name}</span>! An update has been posted on Monday.com.
                    </div>
                  ) : fileUrl ? (
                    <Button
                      id="monday-link-btn"
                      size="sm"
                      onClick={() => linkReport()}
                      disabled={linking}
                      style={{ background: 'linear-gradient(135deg,#FF3D57,#FF9A3C)', color: '#fff', border: 'none' }}
                    >
                      {linking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                      {linking ? 'Linking...' : `Link ${reportType} to "${selectedItem.name}"`}
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <Button
                        id="monday-auto-link-btn"
                        size="sm"
                        onClick={saveToDriveAndLink}
                        disabled={savingToDrive || linking}
                        style={{ background: 'linear-gradient(135deg,#FF3D57,#FF9A3C)', color: '#fff', border: 'none' }}
                      >
                        {savingToDrive ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trello className="w-3.5 h-3.5" />}
                        {savingToDrive ? 'Saving to Drive...' : `Save to Drive & Link to "${selectedItem.name}"`}
                      </Button>
                      
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                          <div className="w-full border-t border-slate-100" />
                        </div>
                        <div className="relative flex justify-center text-[10px] uppercase tracking-widest text-slate-400">
                          <span className="bg-white px-2">Or paste manually</span>
                        </div>
                      </div>
                      
                      <FileUrlInput reportType={reportType} clientName={clientName} selectedItemId={selectedItem.id} />
                    </div>
                  )}
                </div>
              )}

              {/* Reconnect option */}
              <div className="pt-1">
                <button
                  onClick={connectMonday}
                  className="text-[10px] text-slate-400 hover:text-slate-600 underline transition-colors"
                >
                  Reconnect Monday.com account
                </button>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2.5 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

// ── Inline file URL sub-component (fallback when URL isn't generated yet) ────
function FileUrlInput({ reportType, clientName, selectedItemId }: {
  reportType: 'CIM' | 'Teaser'
  clientName: string
  selectedItemId: string
}) {
  const [url, setUrl] = useState('')
  const [linking, setLinking] = useState(false)
  const [linked, setLinked] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const link = async () => {
    if (!url.trim()) return
    setLinking(true)
    setError(null)
    try {
      const res = await fetch('/api/composio/monday/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: selectedItemId,
          reportType,
          clientName,
          fileUrl: url.trim(),
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      setLinked(true)
    } catch (err: any) {
      setError(err.message || 'Failed to link')
    } finally {
      setLinking(false)
    }
  }

  if (linked) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-xs text-emerald-700 font-semibold">
        <CheckCircle2 className="w-4 h-4" />
        Linked! An update has been posted on Monday.com.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
        3. Paste the File URL (from download)
      </label>
      <div className="flex gap-2">
        <input
          className="flex-1 text-xs rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all"
          placeholder={`https://... (${reportType} file URL)`}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button
          size="sm"
          onClick={link}
          disabled={!url.trim() || linking}
          style={{ background: 'linear-gradient(135deg,#FF3D57,#FF9A3C)', color: '#fff', border: 'none' }}
        >
          {linking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
          Link
        </Button>
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  )
}
