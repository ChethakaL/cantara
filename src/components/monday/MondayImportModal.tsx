'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Search, Loader2, Users, ChevronRight, CheckCircle2, AlertCircle,
  UserPlus, Mail, ArrowLeft, RefreshCw, Trello, Download, Copy, Check,
  Building2, Filter
} from 'lucide-react'

type Board = { id: string; name: string }
type MondayItem = { id: string; name: string; email?: string }

type ImportClient = {
  mondayItemId: string
  name: string
  email: string
  company: string
  emailMissing: boolean
}

type ImportResult = {
  name: string
  email: string
  status: 'created' | 'skipped'
  reason?: string
  password?: string
  clientId?: string
}

type Step = 'board' | 'items' | 'review' | 'importing' | 'done'

function StepIndicator({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'board', label: 'Select Board' },
    { key: 'items', label: 'Pick Clients' },
    { key: 'review', label: 'Review & Email' },
    { key: 'done', label: 'Complete' },
  ]
  const order: Step[] = ['board', 'items', 'review', 'importing', 'done']
  const currentIdx = order.indexOf(current)

  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((step, i) => {
        const stepIdx = order.indexOf(step.key)
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
              <span className="text-[10px] mt-1 font-medium" style={{ color: active ? '#FF3D57' : done ? '#10b981' : '#94a3b8' }}>
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

export default function MondayImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [step, setStep] = useState<Step>('board')
  const [boards, setBoards] = useState<Board[]>([])
  const [loadingBoards, setLoadingBoards] = useState(true)
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null)
  const [boardSearch, setBoardSearch] = useState('')

  const [items, setItems] = useState<MondayItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [itemSearch, setItemSearch] = useState('')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  const [clients, setClients] = useState<ImportClient[]>([])
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<ImportResult[]>([])
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load boards on mount
  useEffect(() => {
    setLoadingBoards(true)
    fetch('/api/composio/monday/boards')
      .then(r => r.json())
      .then(d => setBoards(d.boards ?? []))
      .catch(() => setError('Failed to load Monday.com boards'))
      .finally(() => setLoadingBoards(false))
  }, [])

  const fetchItems = useCallback(async (board: Board) => {
    setLoadingItems(true)
    setError(null)
    try {
      const res = await fetch(`/api/composio/monday/items?boardId=${board.id}`)
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setItems(data.items ?? [])
    } catch (e: any) {
      setError(e.message || 'Failed to load board items')
    } finally {
      setLoadingItems(false)
    }
  }, [])

  const handleSelectBoard = (board: Board) => {
    setSelectedBoard(board)
    setSelectedItems(new Set())
    setStep('items')
    void fetchItems(board)
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
    const mapped: ImportClient[] = picked.map(item => ({
      mondayItemId: item.id,
      name: item.name,
      email: item.email || '',
      company: '',
      emailMissing: !(item.email?.trim()),
    }))
    setClients(mapped)
    setStep('review')
  }

  const updateClient = (idx: number, field: 'email' | 'company', value: string) => {
    setClients(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value, emailMissing: field === 'email' ? !value.trim() : c.emailMissing } : c))
  }

  const handleImport = async () => {
    const missingEmails = clients.filter(c => !c.email.trim())
    if (missingEmails.length > 0) {
      setError(`Please fill in emails for: ${missingEmails.map(c => c.name).join(', ')}`)
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
            name: c.name,
            email: c.email.trim().toLowerCase(),
            company: c.company || c.name,
            mondayItemId: c.mondayItemId,
          }))
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setResults(data.results ?? [])
      setStep('done')
      onImported()
    } catch (e: any) {
      setError(e.message || 'Import failed')
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
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,rgba(255,61,87,0.1),rgba(255,154,60,0.1))' }}
            >
              <Trello className="w-4.5 h-4.5" style={{ color: '#FF3D57' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Import Clients from Monday.com</h2>
              <p className="text-xs text-slate-400">Select board items to create client profiles automatically</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 pt-5 shrink-0">
          <StepIndicator current={step} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 min-h-0">
          <AnimatePresence mode="wait">

            {/* STEP 1: Board Selection */}
            {step === 'board' && (
              <motion.div key="board" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <p className="text-xs text-slate-500 mb-3">Choose a Monday.com board to fetch clients from.</p>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search boards..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20 transition-all"
                    value={boardSearch}
                    onChange={e => setBoardSearch(e.target.value)}
                  />
                </div>
                {loadingBoards ? (
                  <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs">Loading boards...</span>
                  </div>
                ) : filteredBoards.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">No boards found. Make sure Monday.com is connected.</div>
                ) : (
                  <div className="space-y-2">
                    {filteredBoards.map(board => (
                      <button
                        key={board.id}
                        onClick={() => handleSelectBoard(board)}
                        className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:border-red-300 hover:bg-red-50/30 transition-all text-left group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 group-hover:bg-red-100 transition-colors">
                            <Filter className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-500 transition-colors" />
                          </div>
                          <span className="text-sm font-medium text-slate-700">{board.name}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-red-400 transition-colors" />
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 2: Item Selection */}
            {step === 'items' && (
              <motion.div key="items" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center gap-2 mb-3">
                  <button onClick={() => setStep('board')} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-slate-400">Board:</span>
                    <span className="text-xs font-semibold text-slate-700 truncate">{selectedBoard?.name}</span>
                  </div>
                  <button onClick={() => selectedBoard && void fetchItems(selectedBoard)} className="ml-auto p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>

                {loadingItems ? (
                  <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs">Fetching items from Monday...</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search items..."
                          className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20 transition-all"
                          value={itemSearch}
                          onChange={e => setItemSearch(e.target.value)}
                        />
                      </div>
                      <button
                        onClick={handleSelectAll}
                        className="px-3 py-2 text-xs rounded-xl border border-slate-200 hover:border-red-300 hover:bg-red-50 transition-all text-slate-600 whitespace-nowrap"
                      >
                        {selectedItems.size === filteredItems.length && filteredItems.length > 0 ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>

                    {filteredItems.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 text-xs">No items found on this board.</div>
                    ) : (
                      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                        {filteredItems.map(item => {
                          const selected = selectedItems.has(item.id)
                          return (
                            <label
                              key={item.id}
                              className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all"
                              style={{
                                borderColor: selected ? 'rgba(255,61,87,0.4)' : 'hsl(220,18%,92%)',
                                background: selected ? 'rgba(255,61,87,0.04)' : '#fff',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => handleToggleItem(item.id)}
                                className="hidden"
                              />
                              <div
                                className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all"
                                style={{
                                  background: selected ? 'linear-gradient(135deg,#FF3D57,#FF9A3C)' : 'transparent',
                                  border: selected ? 'none' : '1.5px solid #cbd5e1',
                                }}
                              >
                                {selected && <Check className="w-2.5 h-2.5 text-white" />}
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs font-medium text-slate-700 truncate block">{item.name}</span>
                                <span className="text-[10px] text-slate-400">ID: {item.id}</span>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xs text-slate-400">{selectedItems.size} of {filteredItems.length} selected</span>
                      <button
                        onClick={handleProceedToReview}
                        disabled={selectedItems.size === 0}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: selectedItems.size > 0 ? 'linear-gradient(135deg,#FF3D57,#FF9A3C)' : '#e2e8f0' }}
                      >
                        Continue <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* STEP 3: Review & Enter Emails */}
            {step === 'review' && (
              <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <p className="text-xs text-slate-500 mb-4">
                  Fill in email addresses for each client. Company name is optional. Passwords will be auto-generated.
                </p>

                {error && (
                  <div className="mb-3 flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5 text-xs text-rose-700">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {error}
                  </div>
                )}

                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {clients.map((client, idx) => (
                    <div key={client.mondayItemId} className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/50">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-400 to-orange-400 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-white">{client.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <span className="text-xs font-semibold text-slate-700 truncate">{client.name}</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div>
                          <label className="block text-[10px] font-medium text-slate-500 mb-1 ml-0.5">Email *</label>
                          <div className="relative">
                            <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                            <input
                              type="email"
                              placeholder="client@email.com"
                              value={client.email}
                              onChange={e => updateClient(idx, 'email', e.target.value)}
                              className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border outline-none transition-all"
                              style={{
                                borderColor: !client.email.trim() ? '#fca5a5' : '#e2e8f0',
                                background: '#fff',
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-slate-500 mb-1 ml-0.5">Company (optional)</label>
                          <div className="relative">
                            <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                            <input
                              type="text"
                              placeholder={client.name}
                              value={client.company}
                              onChange={e => updateClient(idx, 'company', e.target.value)}
                              className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 outline-none focus:border-red-400 transition-all bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <button
                    onClick={() => { setError(null); setStep('items') }}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <button
                    onClick={() => void handleImport()}
                    disabled={clients.some(c => !c.email.trim())}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg,#FF3D57,#FF9A3C)' }}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Import {clients.length} Client{clients.length !== 1 ? 's' : ''}
                  </button>
                </div>
              </motion.div>
            )}

            {/* IMPORTING */}
            {step === 'importing' && (
              <motion.div key="importing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 flex flex-col items-center gap-4">
                <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,rgba(255,61,87,0.1),rgba(255,154,60,0.1))' }}>
                  <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#FF3D57' }} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-700">Creating client profiles…</p>
                  <p className="text-xs text-slate-400 mt-1">Generating passwords and setting up accounts</p>
                </div>
              </motion.div>
            )}

            {/* STEP 4: Done */}
            {step === 'done' && (
              <motion.div key="done" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Import complete!</p>
                    <p className="text-xs text-slate-400">
                      {created.length} created, {skipped.length} skipped
                    </p>
                  </div>
                </div>

                {created.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">✅ Created — Save these credentials!</p>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {created.map((r, idx) => (
                        <div key={idx} className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-700 truncate">{r.name}</p>
                              <p className="text-[10px] text-slate-500">{r.email}</p>
                            </div>
                            <span className="px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-100 rounded-full shrink-0">NEW</span>
                          </div>
                          <div className="mt-2 flex items-center gap-2 bg-white rounded-lg border border-emerald-100 px-2.5 py-1.5">
                            <span className="text-[10px] text-slate-400 shrink-0">Password:</span>
                            <code className="text-xs font-mono text-slate-700 flex-1">{r.password}</code>
                            <button
                              onClick={() => copyPassword(idx, r.password!)}
                              className="shrink-0 p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                              {copiedIdx === idx ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {skipped.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">⚠️ Skipped</p>
                    <div className="space-y-1.5">
                      {skipped.map((r, idx) => (
                        <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 flex items-start gap-2">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-600 truncate">{r.name} <span className="font-normal text-slate-400">({r.email})</span></p>
                            <p className="text-[10px] text-slate-400">{r.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-5 flex justify-end">
                  <button
                    onClick={onClose}
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
