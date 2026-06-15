'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Search, Loader2, ChevronRight, CheckCircle2, AlertCircle,
  UserPlus, Mail, ArrowLeft, RefreshCw, Trello, Copy, Check,
  Building2, Filter, Phone, Globe2, Columns3, Sparkles,
} from 'lucide-react'
import {
  applyColumnMapping,
  collectBoardColumns,
  loadStoredMapping,
  mappingConfidence,
  MONDAY_CLIENT_FIELDS,
  MONDAY_ITEM_NAME_COLUMN_ID,
  MONDAY_ITEM_NAME_COLUMN_LABEL,
  preferLeadsBoard,
  saveStoredMapping,
  suggestColumnMapping,
  type MondayBoardItemRaw,
  type MondayClientField,
  type MondayColumnMapping,
  type MondayColumnRef,
  type ParsedMondayClient,
} from '@/lib/monday-client-import'
import { SearchableSelect } from '@/components/ui'

type Board = { id: string; name: string }

type ImportResult = {
  name: string
  email: string
  status: 'created' | 'skipped'
  reason?: string
  password?: string
  clientId?: string
}

type Step = 'board' | 'mapping' | 'items' | 'review' | 'importing' | 'done'

const STEP_ORDER: Step[] = ['board', 'mapping', 'items', 'review', 'importing', 'done']

function StepIndicator({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'board', label: 'Board' },
    { key: 'mapping', label: 'Map columns' },
    { key: 'items', label: 'Pick leads' },
    { key: 'review', label: 'Review' },
    { key: 'done', label: 'Done' },
  ]
  const currentIdx = STEP_ORDER.indexOf(current)

  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((step, i) => {
        const stepIdx = STEP_ORDER.indexOf(step.key)
        const done = currentIdx > stepIdx
        const active = current === step.key || (current === 'importing' && step.key === 'review')
        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
                style={{
                  background: done ? '#10b981' : active ? 'linear-gradient(135deg,#FF3D57,#FF9A3C)' : 'hsl(220,18%,93%)',
                  color: done || active ? '#fff' : '#94a3b8',
                }}
              >
                {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className="text-[10px] mt-1 font-medium text-center" style={{ color: active ? '#FF3D57' : done ? '#10b981' : '#94a3b8' }}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="h-0.5 flex-1 mx-1 mb-4 rounded-full transition-all duration-500"
                style={{ background: done ? '#10b981' : 'hsl(220,18%,90%)' }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

const FIELD_ICONS: Record<MondayClientField, typeof Mail> = {
  firstName: UserPlus,
  lastName: UserPlus,
  email: Mail,
  phone: Phone,
  company: Building2,
  website: Globe2,
  businessCategory: Filter,
  propertyOwnership: Building2,
  businessAddress: Building2,
}

export default function MondayImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [step, setStep] = useState<Step>('board')
  const [boards, setBoards] = useState<Board[]>([])
  const [loadingBoards, setLoadingBoards] = useState(true)
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null)
  const [boardSearch, setBoardSearch] = useState('')
  const suggestedLeadsBoard = useMemo(() => preferLeadsBoard(boards), [boards])

  const [items, setItems] = useState<MondayBoardItemRaw[]>([])
  const [boardColumns, setBoardColumns] = useState<MondayColumnRef[]>([])
  const [columnMapping, setColumnMapping] = useState<MondayColumnMapping>({
    firstName: null,
    lastName: null,
    email: null,
    phone: null,
    company: null,
    website: null,
    businessCategory: null,
    propertyOwnership: null,
    businessAddress: null,
  })
  const [loadingItems, setLoadingItems] = useState(false)
  const [itemSearch, setItemSearch] = useState('')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  const [clients, setClients] = useState<ParsedMondayClient[]>([])
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<ImportResult[]>([])
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoadingBoards(true)
    fetch('/api/composio/monday/boards')
      .then(r => r.json())
      .then(d => setBoards(d.boards ?? []))
      .catch(() => setError('Failed to load Monday.com boards'))
      .finally(() => setLoadingBoards(false))
  }, [])

  const fetchBoardItems = useCallback(async (board: Board) => {
    setLoadingItems(true)
    setError(null)
    try {
      const res = await fetch(`/api/composio/monday/items?boardId=${board.id}`)
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      const loaded = (data.items ?? []) as MondayBoardItemRaw[]
      setItems(loaded)
      const columns = collectBoardColumns(loaded)
      setBoardColumns(columns)
      const stored = loadStoredMapping(board.id)
      const suggested = suggestColumnMapping(columns)
      setColumnMapping(stored ?? suggested)
      return loaded
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load board items'
      setError(message)
      return []
    } finally {
      setLoadingItems(false)
    }
  }, [])

  const handleSelectBoard = async (board: Board) => {
    setSelectedBoard(board)
    setSelectedItems(new Set())
    setStep('mapping')
    await fetchBoardItems(board)
  }

  const handleSaveMappingAndContinue = () => {
    if (!selectedBoard) return
    saveStoredMapping(selectedBoard.id, columnMapping)
    setStep('items')
  }

  const handleToggleItem = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(filteredItems.map(i => i.id)))
    }
  }

  const handleProceedToReview = () => {
    const picked = items.filter(i => selectedItems.has(i.id))
    const mapped = picked.map(item => applyColumnMapping(item, columnMapping))
    setClients(mapped)
    setStep('review')
  }

  const updateClient = (idx: number, field: keyof ParsedMondayClient, value: string) => {
    setClients(prev =>
      prev.map((client, i) => {
        if (i !== idx) return client
        const next = { ...client, [field]: value }
        if (field === 'firstName' || field === 'lastName') {
          next.fullName = [next.firstName, next.lastName].filter(Boolean).join(' ').trim() || next.itemName
        }
        if (field === 'email') {
          next.emailMissing = !value.trim()
        }
        return next
      }),
    )
  }

  const handleImport = async () => {
    const missingEmails = clients.filter(c => !c.email.trim())
    if (missingEmails.length > 0) {
      setError(`Please fill in emails for: ${missingEmails.map(c => c.fullName || c.itemName).join(', ')}`)
      return
    }
    setError(null)
    setImporting(true)
    setStep('importing')
    try {
      const res = await fetch('/api/monday/import-clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clients: clients.map(c => ({
            firstName: c.firstName,
            lastName: c.lastName,
            name: c.fullName || c.itemName,
            email: c.email.trim().toLowerCase(),
            phone: c.phone,
            company: c.company,
            website: c.website,
            mondayItemId: c.mondayItemId,
            businessCategory: c.businessCategory,
            propertyOwnership: c.propertyOwnership,
            businessAddress: c.businessAddress,
          })),
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setResults(data.results ?? [])
      setStep('done')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Import failed')
      setStep('review')
    } finally {
      setImporting(false)
    }
  }

  const copyPassword = (idx: number, password: string) => {
    navigator.clipboard.writeText(password)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  const filteredBoards = boards.filter(b => b.name.toLowerCase().includes(boardSearch.toLowerCase()))
  const filteredItems = items.filter(i => i.name.toLowerCase().includes(itemSearch.toLowerCase()))
  const confidence = mappingConfidence(boardColumns, columnMapping)

  const columnOptions = useMemo(
    () =>
      boardColumns.map(column => ({
        value: column.id,
        label: column.id === MONDAY_ITEM_NAME_COLUMN_ID ? MONDAY_ITEM_NAME_COLUMN_LABEL : column.title,
        hint: column.id === MONDAY_ITEM_NAME_COLUMN_ID ? 'Primary Monday column' : column.type,
      })),
    [boardColumns],
  )

  const previewClient = useMemo(() => {
    const sample = items[0]
    if (!sample) return null
    return applyColumnMapping(sample, columnMapping)
  }, [items, columnMapping])

  const created = results.filter(r => r.status === 'created')
  const skipped = results.filter(r => r.status === 'skipped')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,20,40,0.6)', backdropFilter: 'blur(8px)' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,rgba(255,61,87,0.1),rgba(255,154,60,0.1))' }}
            >
              <Trello className="w-4.5 h-4.5" style={{ color: '#FF3D57' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Import clients from Monday.com</h2>
              <p className="text-xs text-slate-400">Map leads board columns → Cantara client fields</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pt-5 shrink-0">
          <StepIndicator current={step} />
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 min-h-0">
          <AnimatePresence mode="wait">
            {step === 'board' && (
              <motion.div key="board" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
                <p className="text-xs text-slate-500 mb-3">
                  Choose your leads board. Column mapping is auto-detected and can be adjusted on the next step.
                </p>
                {suggestedLeadsBoard && (
                  <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    Suggested: <button type="button" className="font-semibold underline" onClick={() => void handleSelectBoard(suggestedLeadsBoard)}>{suggestedLeadsBoard.name}</button>
                  </div>
                )}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search boards..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20"
                    value={boardSearch}
                    onChange={e => setBoardSearch(e.target.value)}
                  />
                </div>
                {loadingBoards ? (
                  <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs">Loading boards...</span>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {filteredBoards.map(board => (
                      <button
                        key={board.id}
                        onClick={() => void handleSelectBoard(board)}
                        className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:border-red-300 hover:bg-red-50/30 transition-all text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="text-sm font-medium text-slate-700 truncate">{board.name}</span>
                          {suggestedLeadsBoard?.id === board.id && (
                            <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">Leads</span>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {step === 'mapping' && (
              <motion.div key="mapping" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
                <div className="flex items-center gap-2 mb-3">
                  <button type="button" onClick={() => setStep('board')} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs text-slate-500 truncate">Board: <strong className="text-slate-700">{selectedBoard?.name}</strong></span>
                  <button type="button" onClick={() => selectedBoard && void fetchBoardItems(selectedBoard)} className="ml-auto p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                    <RefreshCw className={`w-3 h-3 ${loadingItems ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {loadingItems ? (
                  <div className="py-12 flex justify-center text-slate-400 gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs">Reading board columns...</span>
                  </div>
                ) : (
                  <>
                    <div className={`mb-4 rounded-xl border px-3 py-2.5 text-xs flex items-start gap-2 ${
                      confidence === 'high' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' :
                      confidence === 'medium' ? 'border-amber-200 bg-amber-50 text-amber-800' :
                      'border-slate-200 bg-slate-50 text-slate-600'
                    }`}>
                      <Columns3 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <div>
                        {confidence === 'high' && <p><strong>Auto-mapped.</strong> We matched Monday columns to Cantara fields. Confirm below or change any mapping.</p>}
                        {confidence === 'medium' && <p><strong>Partial auto-map.</strong> Some fields were guessed — please verify email and business name columns.</p>}
                        {confidence === 'low' && <p><strong>Manual mapping needed.</strong> Pick which Monday column feeds each Cantara field.</p>}
                        <p className="mt-1 text-[10px] opacity-80">
                          Use <strong>{MONDAY_ITEM_NAME_COLUMN_LABEL}</strong> for Monday&apos;s first column (e.g. Client). Mapping is saved per board in this browser.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {MONDAY_CLIENT_FIELDS.map(field => {
                        const Icon = FIELD_ICONS[field.key]
                        return (
                          <div key={field.key} className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                            <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                              <Icon className="w-3 h-3" />
                              {field.label}
                              {field.required && <span className="text-red-500">*</span>}
                            </label>
                            <SearchableSelect
                              options={columnOptions}
                              value={columnMapping[field.key] ?? ''}
                              onChange={nextValue =>
                                setColumnMapping(prev => ({ ...prev, [field.key]: nextValue || null }))
                              }
                              placeholder="Search Monday columns…"
                              emptyLabel="— Not mapped —"
                            />
                          </div>
                        )
                      })}
                    </div>

                    {previewClient && (
                      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Preview (first row)</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                          <span>Name: <strong className="text-slate-800">{previewClient.fullName || '—'}</strong></span>
                          <span>Email: <strong className="text-slate-800">{previewClient.email || '—'}</strong></span>
                          <span>Phone: <strong className="text-slate-800">{previewClient.phone || '—'}</strong></span>
                          <span>Company: <strong className="text-slate-800">{previewClient.company || '—'}</strong></span>
                          <span className="col-span-2">Website: <strong className="text-slate-800">{previewClient.website || '—'}</strong></span>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={handleSaveMappingAndContinue}
                        disabled={!columnMapping.email}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg,#FF3D57,#FF9A3C)' }}
                      >
                        Continue to pick leads <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {step === 'items' && (
              <motion.div key="items" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
                <div className="flex items-center gap-2 mb-3">
                  <button type="button" onClick={() => setStep('mapping')} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs text-slate-500">{items.length} items on board</span>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search leads..."
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-red-400"
                      value={itemSearch}
                      onChange={e => setItemSearch(e.target.value)}
                    />
                  </div>
                  <button type="button" onClick={handleSelectAll} className="px-3 py-2 text-xs rounded-xl border border-slate-200 hover:bg-slate-50 whitespace-nowrap">
                    {selectedItems.size === filteredItems.length && filteredItems.length > 0 ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {filteredItems.map(item => {
                    const selected = selectedItems.has(item.id)
                    const parsed = applyColumnMapping(item, columnMapping)
                    return (
                      <label
                        key={item.id}
                        className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all"
                        style={{
                          borderColor: selected ? 'rgba(255,61,87,0.4)' : 'hsl(220,18%,92%)',
                          background: selected ? 'rgba(255,61,87,0.04)' : '#fff',
                        }}
                      >
                        <input type="checkbox" checked={selected} onChange={() => handleToggleItem(item.id)} className="mt-1" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-800">{parsed.fullName || item.name}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {[parsed.email, parsed.phone, parsed.company].filter(Boolean).join(' · ') || 'No mapped fields yet'}
                          </p>
                        </div>
                      </label>
                    )
                  })}
                </div>
                <div className="mt-4 flex justify-between items-center">
                  <span className="text-xs text-slate-400">{selectedItems.size} selected</span>
                  <button
                    type="button"
                    disabled={selectedItems.size === 0}
                    onClick={handleProceedToReview}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg,#FF3D57,#FF9A3C)' }}
                  >
                    Review {selectedItems.size} lead{selectedItems.size === 1 ? '' : 's'} <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'review' && (
              <motion.div key="review" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
                <p className="text-xs text-slate-500 mb-3">Edit any field before creating client accounts. Passwords are auto-generated.</p>
                {error && (
                  <div className="mb-3 flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5 text-xs text-rose-700">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {error}
                  </div>
                )}
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {clients.map((client, idx) => (
                    <div key={client.mondayItemId} className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/50">
                      <p className="text-xs font-semibold text-slate-700 mb-3">{client.itemName}</p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" placeholder="First name" value={client.firstName} onChange={e => updateClient(idx, 'firstName', e.target.value)} />
                        <input className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" placeholder="Last name" value={client.lastName} onChange={e => updateClient(idx, 'lastName', e.target.value)} />
                        <input className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs sm:col-span-2" type="email" placeholder="Email *" value={client.email} onChange={e => updateClient(idx, 'email', e.target.value)} />
                        <input className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" placeholder="Phone" value={client.phone} onChange={e => updateClient(idx, 'phone', e.target.value)} />
                        <input className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" placeholder="Business name" value={client.company} onChange={e => updateClient(idx, 'company', e.target.value)} />
                        <input className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs sm:col-span-2" placeholder="Website" value={client.website} onChange={e => updateClient(idx, 'website', e.target.value)} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-between">
                  <button type="button" onClick={() => { setError(null); setStep('items') }} className="text-xs text-slate-500 flex items-center gap-1">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleImport()}
                    disabled={clients.some(c => !c.email.trim())}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg,#FF3D57,#FF9A3C)' }}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Import {clients.length} client{clients.length === 1 ? '' : 's'}
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'importing' && (
              <motion.div key="importing" className="py-12 flex flex-col items-center gap-4">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#FF3D57' }} />
                <p className="text-sm font-semibold text-slate-700">Creating client profiles…</p>
              </motion.div>
            )}

            {step === 'done' && (
              <motion.div key="done" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
                <div className="flex items-center gap-3 mb-5">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Import complete</p>
                    <p className="text-xs text-slate-400">{created.length} created, {skipped.length} skipped</p>
                  </div>
                </div>
                {created.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                    {created.map((r, idx) => (
                      <div key={idx} className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                        <p className="text-xs font-semibold text-slate-700">{r.name}</p>
                        <p className="text-[10px] text-slate-500">{r.email}</p>
                        <div className="mt-2 flex items-center gap-2 bg-white rounded-lg border px-2 py-1">
                          <code className="text-xs flex-1">{r.password}</code>
                          <button type="button" onClick={() => copyPassword(idx, r.password!)} className="p-1">
                            {copiedIdx === idx ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => { onImported(); onClose() }}
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg,#FF3D57,#FF9A3C)' }}
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
