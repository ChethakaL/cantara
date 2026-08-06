'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronRight, Folder, Loader2, X } from 'lucide-react'
import { Button, Card } from '@/components/ui'

type FolderRow = { id: string; name: string; url: string }

export default function GoogleDriveBriefConfigModal({
  isOpen,
  onClose,
  onSaved,
}: {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [connected, setConnected] = useState(false)
  const [selected, setSelected] = useState<FolderRow | null>(null)
  const [folders, setFolders] = useState<FolderRow[]>([])
  const [path, setPath] = useState<FolderRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const current = path[path.length - 1]

  const load = async (parentId = 'root', nextPath: FolderRow[] = []) => {
    setLoading(true)
    setError('')
    try {
      const [statusRes, foldersRes, settingsRes] = await Promise.all([
        fetch('/api/composio/google-drive/status', { cache: 'no-store' }),
        fetch(`/api/drive/folders?parentId=${encodeURIComponent(parentId)}`, { cache: 'no-store' }),
        fetch('/api/drive/settings', { cache: 'no-store' }),
      ])
      const status = await statusRes.json()
      const folderData = await foldersRes.json()
      const settings = await settingsRes.json()
      if (!status.connected) throw new Error('Connect Google Drive before choosing a folder.')
      setConnected(true)
      setFolders(folderData.folders || [])
      setPath(nextPath)
      if (settings.parentFolder) {
        const match = (folderData.folders || []).find((folder: FolderRow) => folder.url === settings.parentFolder)
        if (match) setSelected(match)
      }
    } catch (err: any) {
      setConnected(false)
      setError(err.message || 'Unable to load Google Drive folders.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) void load()
  }, [isOpen])

  const connect = async () => {
    const res = await fetch('/api/composio/google-drive/connect', { method: 'POST' })
    const data = await res.json()
    if (data.redirect_url) window.location.href = data.redirect_url
    else setError(data.error || 'Could not start Google Drive connection.')
  }

  const save = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const res = await fetch('/api/drive/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentFolder: selected.url }),
      })
      if (!res.ok) throw new Error('Could not save the folder.')
      onSaved()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Could not save Google Drive configuration.')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <Card className="relative w-full max-w-xl max-h-[85vh] overflow-hidden p-6 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b pb-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Google Drive Brief Configuration</h2>
            <p className="text-xs text-slate-500 mt-1">Choose where Pre-Call Briefs will be stored.</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        {error && <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">{error}</div>}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-cantara-gold" />
            <p className="text-sm text-slate-500">Checking Google Drive connection...</p>
          </div>
        ) : !connected ? (
          <div className="py-8 text-center">
            <p className="text-sm text-slate-600 mb-4">Google Drive is not connected for this workspace.</p>
            <Button onClick={() => void connect()}>Connect Google Drive</Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1 text-xs text-slate-500 mb-3">
              <button onClick={() => void load()} className="hover:text-slate-800">My Drive</button>
              {path.map(folder => <span key={folder.id} className="flex items-center gap-1"><ChevronRight className="w-3 h-3" />{folder.name}</span>)}
            </div>
            <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 divide-y">
              {folders.map(folder => (
                <div key={folder.id} className={`flex items-center justify-between px-3 py-2 ${selected?.id === folder.id ? 'bg-amber-50' : ''}`}>
                  <button className="flex items-center gap-2 text-sm text-slate-700" onClick={() => setSelected(folder)}>
                    <Folder className="w-4 h-4 text-amber-600" />{folder.name}{selected?.id === folder.id && <Check className="w-4 h-4 text-green-600" />}
                  </button>
                  <button className="p-1 text-slate-400" onClick={() => void load(folder.id, [...path, folder])}><ChevronRight className="w-4 h-4" /></button>
                </div>
              ))}
              {!folders.length && <p className="p-4 text-sm text-slate-400">No folders found here.</p>}
            </div>
            <p className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">Pre-Call Brief files created here will be shared publicly so anyone with the link can view them.</p>
            <div className="flex justify-end gap-2 mt-5"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => void save()} disabled={!selected || saving}>{saving ? 'Saving...' : 'Save Folder'}</Button></div>
          </>
        )}
      </Card>
    </div>
  )
}
