'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, Save, Settings2, X } from 'lucide-react'
import { Button, Card, SearchableSelect } from '@/components/ui'

const MONDAY_COLUMNS: Array<{ key: string; label: string; number: number }> = [
  { number: 1, key: 'businessName', label: 'Business Name (Item Name)' },
  { number: 2, key: 'assignedCaller', label: 'Assigned Lead (People)' },
  { number: 3, key: 'currentStage', label: 'Current Stage (Status)' },
  { number: 4, key: 'lastCallResult', label: 'Last Stage Result (Status)' },
  { number: 5, key: 'nextActionDate', label: 'Next Stage Date (Date)' },
  { number: 6, key: 'stageStartDate', label: 'Stage Start Date (Date)' },
  { number: 7, key: 'lastContactDate', label: 'Last Contact Date (Date)' },
  { number: 7, key: 'state', label: 'State' },
  { number: 8, key: 'city', label: 'City' },
  { number: 9, key: 'websiteUrl', label: 'Website URL' },
  { number: 10, key: 'googleRating', label: 'Google Rating' },
  { number: 11, key: 'reviewCount', label: 'Review Count' },
  { number: 12, key: 'sqftIndoor', label: 'Square Footage (Indoor)' },
  { number: 13, key: 'sqftOutdoor', label: 'Square Footage (Outdoor)' },
  { number: 14, key: 'sqftCombined', label: 'Square Footage (Combined)' },
  { number: 15, key: 'locationType', label: 'Location Type' },
  { number: 16, key: 'preCallBriefUrl', label: 'Pre-Call Brief' },
  { number: 17, key: 'ownerFirstName', label: 'Owner First Name' },
  { number: 18, key: 'ownerLastName', label: 'Owner Last Name' },
  { number: 19, key: 'ownerPhone', label: 'Owner Phone' },
  { number: 20, key: 'sourceLinkPhone', label: 'Source Link (Phone)' },
  { number: 21, key: 'ownerEmail', label: 'Owner Email' },
  { number: 22, key: 'sourceLinkEmail', label: 'Source Link (Email)' },
  { number: 23, key: 'bookingDateTime', label: 'Booking Date/Time' },
  { number: 24, key: 'notes', label: 'Notes' },
  { number: 25, key: 'email1Draft', label: 'Email 1 Draft' },
  { number: 26, key: 'call1Script', label: 'Call 1 Script' },
  { number: 27, key: 'email2Draft', label: 'Email 2 Draft' },
  { number: 28, key: 'call2Script', label: 'Call 2 Script' },
  { number: 29, key: 'resortAddress', label: 'Resort Address' },
  { number: 30, key: 'locationCount', label: '# of Locations' },
  { number: 31, key: 'generalEmail', label: 'General Email' },
  { number: 32, key: 'generalPhone', label: 'General Phone' },
]

type Board = { id: string; name: string }
type Column = { id: string; title: string; type: string }

export default function MondayBoardConfigModal({
  isOpen,
  onClose,
  onSaved,
}: {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [fetchingCols, setFetchingCols] = useState(false)
  const [saving, setSaving] = useState(false)
  const [boards, setBoards] = useState<Board[]>([])
  const [columns, setColumns] = useState<Column[]>([])
  const [selectedBoardId, setSelectedBoardId] = useState('')
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [configured, setConfigured] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const fetchConfig = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/sales-leads/monday-config')
      if (!res.ok) throw new Error('Failed to load Monday settings')
      const data = await res.json()
      setBoards(data.boards || [])
      setColumns(data.columns || [])
      setSelectedBoardId(data.boardId || '')
      setMapping(data.mapping || {})
      setConfigured(data.configured || false)
    } catch (err: any) {
      setError(err.message || 'Unable to connect to Monday.com settings')
    } finally {
      setLoading(false)
    }
  }

  const fetchColumnsForBoard = async (boardId: string) => {
    if (!boardId) {
      setColumns([])
      return
    }
    setFetchingCols(true)
    setError('')
    try {
      const res = await fetch(`/api/sales-leads/monday-config?boardId=${boardId}`)
      if (!res.ok) throw new Error('Failed to load columns for selected board')
      const data = await res.json()
      const newCols: Column[] = data.columns || []
      setColumns(newCols)
      if (newCols.length > 0) {
        autoMap(newCols, mapping)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch board columns')
    } finally {
      setFetchingCols(false)
    }
  }

  useEffect(() => {
    if (isOpen) void fetchConfig()
  }, [isOpen])

  const handleBoardSelect = (boardId: string) => {
    setSelectedBoardId(boardId)
    if (boardId) {
      void fetchColumnsForBoard(boardId)
    } else {
      setColumns([])
    }
  }

  const autoMap = (boardCols: Column[], baseMapping?: Record<string, string>) => {
    const current = baseMapping || mapping || {}
    const nextMapping: Record<string, string> = { ...current }

    for (const colDef of MONDAY_COLUMNS) {
      if (nextMapping[colDef.key]) continue

      if (colDef.key === 'businessName') {
        const nameMatch = boardCols.find(
          c =>
            c.type === 'name' ||
            c.id === 'name' ||
            c.title.toLowerCase().trim() === 'name' ||
            c.title.toLowerCase().includes('business') ||
            c.title.toLowerCase().includes('lead'),
        )
        if (nameMatch) {
          nextMapping[colDef.key] = nameMatch.id
          continue
        }
      }

      const match = boardCols.find(
        c =>
          c.title.toLowerCase().trim() === colDef.label.toLowerCase().split(' (')[0].trim() ||
          c.title.toLowerCase().includes(colDef.label.toLowerCase().split(' (')[0]) ||
          c.title.toLowerCase().includes(colDef.key.toLowerCase()),
      )
      if (match) nextMapping[colDef.key] = match.id
    }
    setMapping(nextMapping)
  }

  const handleSave = async () => {
    if (!selectedBoardId) {
      setError('Please select a Monday.com Board first')
      return
    }
    setSaving(true)
    setError('')
    setSuccessMsg('')
    try {
      const res = await fetch('/api/sales-leads/monday-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId: selectedBoardId, mapping }),
      })
      if (!res.ok) throw new Error('Failed to save configuration')
      setSuccessMsg('Monday.com Board and Sales Lead column mapping saved successfully!')
      setConfigured(true)
      onSaved()
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const columnOptions = columns.map(c => ({
    value: c.id,
    label: `${c.title} (${c.type})`,
    hint: c.id,
  }))

  const boardOptions = boards.map(b => ({
    value: b.id,
    label: b.name,
    hint: `ID: ${b.id}`,
  }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={onClose} />
      <Card className="relative w-full max-w-3xl max-h-[90vh] flex flex-col p-6 overflow-hidden bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b pb-4 mb-4">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-cantara-gold" />
            <h2 className="text-lg font-semibold text-slate-800">
              Monday.com Board & 24-Column Mapping Configuration
            </h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            Loading Monday.com boards and column settings...
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-2 space-y-6">
            {error && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                {error}
              </div>
            )}
            {successMsg && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700 flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                {successMsg}
              </div>
            )}

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase text-slate-500 tracking-wider">
                  1. Target Monday Board
                </label>
                {fetchingCols && (
                  <span className="text-xs text-blue-600 font-medium flex items-center gap-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Fetching columns from Monday.com...
                  </span>
                )}
              </div>
              <SearchableSelect
                options={boardOptions}
                value={selectedBoardId}
                onChange={handleBoardSelect}
                placeholder="Search your Monday boards..."
                emptyLabel="-- Select Target Monday Board --"
              />
              {configured && (
                <p className="text-[11px] text-emerald-600 flex items-center gap-1 pt-1">
                  <Check className="w-3 h-3" /> Configured and active in database. Edits will update the stored mapping.
                </p>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                    2. Sales Lead Column Mapping
                  </h3>
                  {columns.length > 0 && (
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      {columns.length} columns loaded
                    </span>
                  )}
                </div>
                {columns.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => autoMap(columns)}
                    className="text-xs py-1 h-7 bg-white"
                  >
                    Auto-Match Columns
                  </Button>
                )}
              </div>

              {fetchingCols ? (
                <div className="p-12 text-center text-xs text-slate-500 border rounded-xl bg-slate-50 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  Fetching column list from Monday.com...
                </div>
              ) : columns.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-400 border rounded-xl bg-slate-50">
                  Select a Monday board above to fetch its columns.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto p-1 border rounded-xl">
                  {MONDAY_COLUMNS.map(col => (
                    <div
                      key={col.key}
                      className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 flex flex-col gap-1.5 text-xs"
                    >
                      <div className="flex justify-between font-medium text-slate-700">
                        <span>#{col.number}. {col.label}</span>
                        <span className="text-[10px] font-mono text-slate-400">{col.key}</span>
                      </div>
                      <SearchableSelect
                        options={columnOptions}
                        value={mapping[col.key] || ''}
                        onChange={val =>
                          setMapping(prev => ({ ...prev, [col.key]: val }))
                        }
                        placeholder={`Search Monday column for ${col.label}...`}
                        emptyLabel="-- Unmapped --"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="border-t pt-4 mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading || fetchingCols} className="gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Settings to Database
          </Button>
        </div>
      </Card>
    </div>
  )
}
