'use client'

import { useState, useEffect } from 'react'
import {
  CheckCircle2, ChevronDown, ExternalLink, Loader2,
  RefreshCw, Trello, AlertCircle, Link2, Search, ChevronRight, FolderOpen, Plus, FolderPlus
} from 'lucide-react'
import { Button, Card, Modal, cn } from '@/components/ui'

interface DrivePickerFolder {
  id: string
  name: string
  url: string
}

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

  // ── Google Drive Picker states ─────────────────────────────────────────────
  const [showDrivePicker, setShowDrivePicker] = useState(false)
  // 'create' = default quick-create tab; 'browse' = folder browser tab
  const [pickerTab, setPickerTab] = useState<'create' | 'browse'>('create')
  // Admin global parent folder (from /api/drive/settings)
  const [globalParentFolder, setGlobalParentFolder] = useState<string | null>(null)
  const [globalParentLoading, setGlobalParentLoading] = useState(false)
  // The resolved parent folder for creation (either global or overridden by user picking)
  // Stored as a DrivePickerFolder object when chosen from browser, or as raw URL string
  const [selectedParentFolder, setSelectedParentFolder] = useState<DrivePickerFolder | null>(null)
  // Browse-mode states
  const [drivePickerFolders, setDrivePickerFolders] = useState<DrivePickerFolder[]>([])
  const [drivePickerPath, setDrivePickerPath] = useState<DrivePickerFolder[]>([])
  const [drivePickerLoading, setDrivePickerLoading] = useState(false)
  const [drivePickerError, setDrivePickerError] = useState('')
  const [driveBusy, setDriveBusy] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  // Whether user is in "change parent" flow inside create tab
  const [choosingParent, setChoosingParent] = useState(false)

  const currentDrivePickerFolder = drivePickerPath[drivePickerPath.length - 1] || null

  const fetchGlobalParentFolder = async () => {
    setGlobalParentLoading(true)
    try {
      const res = await fetch('/api/drive/settings', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.parentFolder) {
        setGlobalParentFolder(data.parentFolder)
      } else {
        setGlobalParentFolder(null)
      }
    } catch {
      setGlobalParentFolder(null)
    } finally {
      setGlobalParentLoading(false)
    }
  }

  const loadDriveFolders = async (parent?: DrivePickerFolder | null, nextPath?: DrivePickerFolder[]) => {
    const parentId = parent?.id || 'root'
    setDrivePickerLoading(true)
    setDrivePickerError('')
    try {
      const res = await fetch(`/api/drive/folders?parentId=${encodeURIComponent(parentId)}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not load Google Drive folders')
      setDrivePickerFolders(Array.isArray(data.folders) ? data.folders : [])
      if (nextPath) setDrivePickerPath(nextPath)
    } catch (error) {
      setDrivePickerError(error instanceof Error ? error.message : 'Could not load Google Drive folders')
      setDrivePickerFolders([])
    } finally {
      setDrivePickerLoading(false)
    }
  }

  /** Sets the currently-browsed folder as the client folder directly (no new folder created) */
  const selectDrivePickerFolder = async () => {
    if (!currentDrivePickerFolder) return
    setDriveBusy(true)
    setDrivePickerError('')
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driveFolder: currentDrivePickerFolder.url }),
      })
      if (!res.ok) throw new Error('Failed to update client with selected drive folder')
      setShowDrivePicker(false)
      // Auto-retry save+link
      setSavingToDrive(true)
      const fileName = `${clientName.replace(/\s+/g, '-').toLowerCase()}-${reportType.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`
      const saveRes = await fetch('/api/drive/save-report', {
        method: 'POST',
        body: JSON.stringify({ clientId, fileName, html }),
      })
      if (!saveRes.ok) throw new Error(await saveRes.text() || 'Failed to save to Drive')
      const result = await saveRes.json()
      const driveUrl = result.result?.webViewLink
      if (!driveUrl) throw new Error('No Drive link returned')
      setFileUrl(driveUrl)
      await linkReport(driveUrl)
    } catch (err: any) {
      setDrivePickerError(err.message || 'Failed to associate folder and save')
    } finally {
      setDriveBusy(false)
    }
  }

  /** Uses the browsed folder as the parent for creation (inside "change parent" flow) */
  const useAsParentFolder = () => {
    if (!currentDrivePickerFolder) return
    setSelectedParentFolder(currentDrivePickerFolder)
    setChoosingParent(false)
    setPickerTab('create')
  }

  const closeDrivePicker = () => {
    setShowDrivePicker(false)
    setDrivePickerError('')
    setNewFolderName('')
    setChoosingParent(false)
    setSelectedParentFolder(null)
    setPickerTab('create')
  }

  /** Resolve the effective parent folder URL for folder creation */
  const effectiveParentUrl = selectedParentFolder?.url ?? globalParentFolder ?? null

  const createDriveFolder = async () => {
    const name = newFolderName.trim()
    if (!name || creatingFolder) return
    if (!effectiveParentUrl) {
      setDrivePickerError('Please set a parent folder first.')
      return
    }
    setCreatingFolder(true)
    setDrivePickerError('')
    try {
      const res = await fetch('/api/drive/create-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName: name, clientId, parentFolder: effectiveParentUrl }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to create folder')
      // The new folder is the client folder — patch client and retry save
      const folderUrl: string = data.folderUrl
      const patchRes = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driveFolder: folderUrl }),
      })
      if (!patchRes.ok) throw new Error('Folder created but failed to save to client profile')
      setShowDrivePicker(false)
      setNewFolderName('')
      // Auto-retry save+link
      setSavingToDrive(true)
      const fileName = `${clientName.replace(/\s+/g, '-').toLowerCase()}-${reportType.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`
      const saveRes = await fetch('/api/drive/save-report', {
        method: 'POST',
        body: JSON.stringify({ clientId, fileName, html }),
      })
      if (!saveRes.ok) throw new Error(await saveRes.text() || 'Failed to save to Drive')
      const result = await saveRes.json()
      const driveUrl = result.result?.webViewLink
      if (!driveUrl) throw new Error('No Drive link returned')
      setFileUrl(driveUrl)
      await linkReport(driveUrl)
    } catch (err: any) {
      setDrivePickerError(err.message || 'Failed to create folder')
    } finally {
      setCreatingFolder(false)
      setSavingToDrive(false)
    }
  }

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

  // ── Fetch boards & auto-select Closed Won ───────────────────────────────────
  const fetchBoards = async () => {
    setLoadingBoards(true)
    setError(null)
    try {
      // 1. First load global settings board ID
      let globalBoardId: string | null = null
      try {
        const mRes = await fetch('/api/admin/settings/monday')
        if (mRes.ok) {
          const mData = await mRes.json()
          if (mData.boardId) {
            globalBoardId = mData.boardId
          }
        }
      } catch (err) {}

      const res = await fetch('/api/composio/monday/boards')
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      const list = (data.boards ?? []) as Board[]
      setBoards(list)

      // Try to find configured board, or fallback to "Closed Won" by name, or first board
      const targetBoard = list.find(b => b.id === globalBoardId) || 
                          list.find(b => /closed\s*won/i.test(b.name)) || 
                          list[0]
      if (targetBoard) {
        setSelectedBoard(targetBoard)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load boards')
    } finally {
      setLoadingBoards(false)
    }
  }

  // ── Fetch items for selected board & Auto-select matching client ───────────
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
      const loadedItems = (data.items ?? []) as any[]
      setItems(loadedItems)

      // Try matching by multiple heuristics:
      // 1. Check if client notes contain 'Imported from Monday item <id>'
      let matched = null
      
      try {
        const clientRes = await fetch(`/api/clients/${clientId}`)
        if (clientRes.ok) {
          const clientData = await clientRes.json()
          if (clientData.notes) {
            const importedMatch = clientData.notes.match(/Imported from Monday item (\d+)/i)
            if (importedMatch && importedMatch[1]) {
              const targetId = importedMatch[1]
              matched = loadedItems.find(item => String(item.id) === String(targetId))
            }
          }

          if (!matched) {
            // 2. Exact match company name
            if (clientData.company) {
              matched = loadedItems.find(item => 
                item.name.toLowerCase().trim() === clientData.company.toLowerCase().trim()
              )
            }
            // 3. Exact email match
            if (!matched && clientData.email) {
              matched = loadedItems.find(item => 
                item.email && item.email.toLowerCase().trim() === clientData.email.toLowerCase().trim()
              )
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load client details for precise matching:', err)
      }

      if (!matched) {
        // 4. Default string heuristics fallback
        matched = loadedItems.find(item => 
          item.name.toLowerCase().trim() === clientName.toLowerCase().trim() ||
          item.name.toLowerCase().includes(clientName.toLowerCase()) ||
          clientName.toLowerCase().includes(item.name.toLowerCase())
        )
      }
      
      if (matched) {
        setSelectedItem(matched)
      }
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
      if (res.status === 409) {
        setSavingToDrive(false)
        setShowDrivePicker(true)
        setPickerTab('create')
        setDrivePickerPath([])
        setSelectedParentFolder(null)
        void fetchGlobalParentFolder()
        void loadDriveFolders(null, [])
        return
      }
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
              <h3 className="text-sm font-semibold text-slate-800">Monday.com Global Mapping</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically link this {reportType} to the corresponding deal in Monday.com.
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
            <div className="mt-4 space-y-4">
              {!fileUrl && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Generate and download the {reportType} first, then save to link it.
                </div>
              )}

              {/* Status Indicator */}
              <div className="text-xs bg-slate-50 rounded-xl p-3.5 border border-slate-100 space-y-1.5">
                <p className="text-slate-500 font-medium">Target Board: <strong className="text-slate-800 font-bold">{selectedBoard?.name || 'Closed Won'}</strong></p>
                <p className="text-slate-500 font-medium flex items-center gap-2 flex-wrap">
                  <span>Matching Deal:</span>
                  {loadingItems ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><Loader2 className="w-3 h-3 animate-spin" /> Searching deals...</span>
                  ) : selectedItem ? (
                    <strong className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">{selectedItem.name}</strong>
                  ) : (
                    <span className="text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">No matching deal found</span>
                  )}
                </p>
              </div>

              {/* Search & choose manually if missing or user wants to re-link */}
              {!loadingItems && items.length > 0 && (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Choose matching deal manually (optional)
                  </label>
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search deals..."
                        className="w-full text-xs rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    {searchTerm && (
                      <button onClick={() => setSearchTerm('')} className="text-[10px] text-slate-400 hover:text-slate-600 underline">
                        Clear
                      </button>
                    )}
                  </div>
                  
                  {filteredItems.length > 0 && searchTerm && (
                    <div className="border border-slate-100 rounded-lg max-h-32 overflow-y-auto bg-white divide-y divide-slate-50 shadow-sm">
                      {filteredItems.map((i) => (
                        <div
                          key={i.id}
                          onClick={() => {
                            setSelectedItem(i)
                            setSearchTerm('')
                            setLinked(false)
                          }}
                          className={cn(
                            "py-2 px-3 text-xs cursor-pointer transition-colors hover:bg-slate-50 flex items-center justify-between",
                            selectedItem?.id === i.id && "bg-amber-50/50 hover:bg-amber-50"
                          )}
                        >
                          <span className="font-medium text-slate-700">{i.name}</span>
                          {selectedItem?.id === i.id && <span className="text-[10px] text-amber-600 font-semibold">Active Match</span>}
                        </div>
                      ))}
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
                      Successfully linked to <span className="font-bold">{selectedItem.name}</span>! The {reportType} link has been saved to Monday.com.
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
      {/* Google Drive Picker Modal */}
      <Modal
        open={showDrivePicker}
        onClose={closeDrivePicker}
        title="Set Up Client Folder"
        sizeClassName="max-w-2xl"
      >
        <div className="space-y-4">
          {/* ── Tab switcher ── */}
          <div className="flex rounded-xl border border-slate-200 overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => setPickerTab('create')}
              className={cn(
                'flex-1 py-2.5 font-medium flex items-center justify-center gap-1.5 transition-colors',
                pickerTab === 'create'
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-500 hover:bg-slate-50'
              )}
            >
              <FolderPlus className="w-3.5 h-3.5" />
              Create New Folder
            </button>
            <button
              type="button"
              onClick={() => { setPickerTab('browse'); setChoosingParent(false) }}
              className={cn(
                'flex-1 py-2.5 font-medium flex items-center justify-center gap-1.5 transition-colors border-l border-slate-200',
                pickerTab === 'browse'
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-500 hover:bg-slate-50'
              )}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Select Existing Folder
            </button>
          </div>

          {/* ── CREATE TAB ── */}
          {pickerTab === 'create' && (
            <div className="space-y-4">
              {/* Folder name input */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-600 block">New folder name</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={`e.g. ${clientName}`}
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void createDriveFolder() }}
                    disabled={creatingFolder}
                    className="flex-1 text-sm rounded-lg border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all"
                  />
                  <Button
                    onClick={() => void createDriveFolder()}
                    disabled={!newFolderName.trim() || !effectiveParentUrl || creatingFolder}
                  >
                    {creatingFolder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {creatingFolder ? 'Creating...' : 'Create Folder'}
                  </Button>
                </div>
              </div>

              {/* Parent folder info */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <FolderOpen className="w-3 h-3" /> Parent folder
                </p>
                {globalParentLoading ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading admin setting...
                  </div>
                ) : effectiveParentUrl ? (
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-slate-600 break-all flex-1">
                      {selectedParentFolder
                        ? <><span className="font-medium text-slate-800">{selectedParentFolder.name}</span><span className="text-slate-400 ml-1">(selected from browser)</span></>
                        : <><span className="font-medium text-slate-800">Admin default</span><span className="text-slate-400 ml-1 truncate block">{globalParentFolder}</span></>
                      }
                    </p>
                    <button
                      type="button"
                      onClick={() => { setChoosingParent(true); setPickerTab('browse') }}
                      className="text-[11px] text-amber-600 hover:text-amber-800 underline shrink-0 font-medium"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                      No parent folder is configured yet. Browse and pick one below, or ask an admin to set a default in Google Drive settings.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setChoosingParent(true); setPickerTab('browse') }}
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      Browse & Pick Parent Folder
                    </Button>
                  </div>
                )}
              </div>

              {drivePickerError && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2.5 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {drivePickerError}
                </div>
              )}
            </div>
          )}

          {/* ── BROWSE TAB ── */}
          {pickerTab === 'browse' && (
            <div className="space-y-3">
              {choosingParent && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Navigate into a folder, then click <strong className="mx-0.5">"Use as Parent Folder"</strong> to set it as the parent for new folders.
                </div>
              )}

              {/* Breadcrumb path */}
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                <button
                  type="button"
                  onClick={() => void loadDriveFolders(null, [])}
                  className={cn('font-medium hover:text-amber-700', drivePickerPath.length === 0 ? 'text-slate-800' : 'text-slate-500')}
                >
                  My Drive
                </button>
                {drivePickerPath.map((folder, index) => (
                  <span key={folder.id} className="inline-flex items-center gap-2">
                    <ChevronRight className="h-3 w-3 text-slate-300" />
                    <button
                      type="button"
                      onClick={() => void loadDriveFolders(folder, drivePickerPath.slice(0, index + 1))}
                      className={cn('font-medium hover:text-amber-700', index === drivePickerPath.length - 1 ? 'text-slate-800' : 'text-slate-500')}
                    >
                      {folder.name}
                    </button>
                  </span>
                ))}
              </div>

              {/* Folder list */}
              <div className="min-h-[220px] max-h-[300px] overflow-y-auto rounded-xl border border-slate-200 bg-white">
                {drivePickerLoading ? (
                  <div className="flex h-32 items-center justify-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading folders...
                  </div>
                ) : drivePickerFolders.length === 0 ? (
                  <div className="p-4 text-sm text-slate-400">No folders found here.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {drivePickerFolders.map(folder => (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() => void loadDriveFolders(folder, [...drivePickerPath, folder])}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-amber-50"
                      >
                        <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
                        <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {drivePickerError && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2.5 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {drivePickerError}
                </div>
              )}

              {/* Footer actions — differ depending on mode */}
              <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  {currentDrivePickerFolder
                    ? <>Current folder: <span className="font-medium text-slate-700">{currentDrivePickerFolder.name}</span></>
                    : 'Navigate into a folder to select it.'}
                </p>
                <div className="flex gap-2">
                  {choosingParent ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => { setChoosingParent(false); setPickerTab('create') }}>
                        ← Back to Create
                      </Button>
                      <Button
                        size="sm"
                        onClick={useAsParentFolder}
                        disabled={!currentDrivePickerFolder}
                        style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', border: 'none' }}
                      >
                        <FolderPlus className="w-3.5 h-3.5" />
                        Use as Parent Folder
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" onClick={closeDrivePicker}>Cancel</Button>
                      <Button
                        onClick={() => void selectDrivePickerFolder()}
                        disabled={!currentDrivePickerFolder || driveBusy}
                      >
                        {driveBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        Set as Client Folder
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Cancel button always visible in create tab */}
          {pickerTab === 'create' && (
            <div className="flex justify-end border-t border-slate-100 pt-3">
              <Button variant="ghost" onClick={closeDrivePicker}>Cancel</Button>
            </div>
          )}
        </div>
      </Modal>
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
        Linked! The {reportType} link has been saved to Monday.com.
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
