'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Package } from 'lucide-react'
import { Card, Button, Input, Select, Badge, cn } from '@/components/ui'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import { buildVendorReportHtml } from '@/lib/report-export/build-vendor-report'

const SECTION_KEY = 'vendorDirectory'

type TransferStatus = 'yes' | 'no' | 'unknown'

interface VendorItem {
  id: string
  name: string
  vendor: string
  category: string
  annualCost: number
  contractStatus: string
  transferable: TransferStatus
  loginAccess: string
  notes: string
}

const CATEGORY_OPTIONS = [
  { value: '', label: 'Select category...' },
  { value: 'Booking/POS', label: 'Booking/POS' },
  { value: 'CRM', label: 'CRM' },
  { value: 'Accounting', label: 'Accounting' },
  { value: 'Payroll', label: 'Payroll' },
  { value: 'Marketing', label: 'Marketing' },
  { value: 'Communication', label: 'Communication' },
  { value: 'Security/Cameras', label: 'Security/Cameras' },
  { value: 'Other', label: 'Other' },
]

const CONTRACT_OPTIONS = [
  { value: '', label: 'Select status...' },
  { value: 'Active', label: 'Active' },
  { value: 'Month-to-month', label: 'Month-to-month' },
  { value: 'Expiring Soon', label: 'Expiring Soon' },
  { value: 'Expired', label: 'Expired' },
]

const TRANSFER_OPTIONS = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
]

const LOGIN_OPTIONS = [
  { value: '', label: 'Select access...' },
  { value: 'Owner Only', label: 'Owner Only' },
  { value: 'Shared', label: 'Shared' },
  { value: 'Manager Access', label: 'Manager Access' },
  { value: 'Unknown', label: 'Unknown' },
]

const emptyItem = (): VendorItem => ({
  id: crypto.randomUUID(),
  name: '',
  vendor: '',
  category: '',
  annualCost: 0,
  contractStatus: '',
  transferable: 'unknown',
  loginAccess: '',
  notes: '',
})

async function loadItems(clientId: string): Promise<VendorItem[]> {
  const res = await fetch(`/api/client-data/${clientId}?section=${SECTION_KEY}`)
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

async function saveItems(clientId: string, items: VendorItem[]) {
  await fetch(`/api/client-data/${clientId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ section: SECTION_KEY, data: items }),
  })
}

function ContractBadge({ status }: { status: string }) {
  const colorMap: Record<string, 'green' | 'blue' | 'gold' | 'red' | 'slate'> = {
    'Active': 'green',
    'Month-to-month': 'blue',
    'Expiring Soon': 'gold',
    'Expired': 'red',
  }
  return <Badge color={colorMap[status] ?? 'slate'}>{status || '—'}</Badge>
}

function TransferBadge({ status }: { status: TransferStatus }) {
  const map: Record<TransferStatus, { color: 'green' | 'red' | 'slate'; label: string }> = {
    yes: { color: 'green', label: 'Yes' },
    no: { color: 'red', label: 'No' },
    unknown: { color: 'slate', label: 'Unknown' },
  }
  const cfg = map[status]
  return <Badge color={cfg.color}>{cfg.label}</Badge>
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

export default function VendorDirectoryTab({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [items, setItems] = useState<VendorItem[]>([])
  const [loading, setLoading] = useState(true)
  const [addingNew, setAddingNew] = useState(false)
  const [newItem, setNewItem] = useState<VendorItem>(emptyItem())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<VendorItem | null>(null)

  useEffect(() => {
    loadItems(clientId).then(d => { setItems(d); setLoading(false) })
  }, [clientId])

  const persist = useCallback(async (updated: VendorItem[]) => {
    setItems(updated)
    await saveItems(clientId, updated)
  }, [clientId])

  const handleAdd = async () => {
    if (!newItem.name.trim()) return
    const updated = [...items, newItem]
    await persist(updated)
    setNewItem(emptyItem())
    setAddingNew(false)
  }

  const handleDelete = async (id: string) => {
    await persist(items.filter(i => i.id !== id))
  }

  const startEdit = (item: VendorItem) => {
    setEditingId(item.id)
    setEditDraft({ ...item })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditDraft(null)
  }

  const saveEdit = async () => {
    if (!editDraft) return
    const updated = items.map(i => i.id === editDraft.id ? editDraft : i)
    await persist(updated)
    setEditingId(null)
    setEditDraft(null)
  }

  const totalCost = items.reduce((sum, i) => sum + (Number(i.annualCost) || 0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-600" />
            Software &amp; Vendor Directory
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Software, tools, and vendor subscriptions for {clientName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {items.length > 0 && (
            <ExportReportButton
              html={buildVendorReportHtml(items, clientName)}
              fileName={`vendor-report-${clientName.replace(/\s+/g, '-').toLowerCase()}`}
              label="Export Vendor Report"
            />
          )}
          {!addingNew && (
            <Button size="sm" onClick={() => setAddingNew(true)}>
              <Plus className="w-3.5 h-3.5" /> Add Item
            </Button>
          )}
        </div>
      </div>

      {/* Add form */}
      {addingNew && (
        <Card className="p-5 border-amber-200 bg-amber-50/30">
          <p className="text-sm font-semibold text-slate-700 mb-4">New Software / Vendor</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Name" placeholder="Software / tool name" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
            <Input label="Vendor" placeholder="Vendor company" value={newItem.vendor} onChange={e => setNewItem({ ...newItem, vendor: e.target.value })} />
            <Select
              label="Category"
              options={CATEGORY_OPTIONS}
              value={newItem.category}
              onChange={e => setNewItem({ ...newItem, category: e.target.value })}
            />
            <Input
              label="Annual Cost ($)"
              type="number"
              placeholder="0"
              value={newItem.annualCost || ''}
              onChange={e => setNewItem({ ...newItem, annualCost: Number(e.target.value) || 0 })}
            />
            <Select
              label="Contract Status"
              options={CONTRACT_OPTIONS}
              value={newItem.contractStatus}
              onChange={e => setNewItem({ ...newItem, contractStatus: e.target.value })}
            />
            <Select
              label="Transferable"
              options={TRANSFER_OPTIONS}
              value={newItem.transferable}
              onChange={e => setNewItem({ ...newItem, transferable: e.target.value as TransferStatus })}
            />
            <Select
              label="Login Access"
              options={LOGIN_OPTIONS}
              value={newItem.loginAccess}
              onChange={e => setNewItem({ ...newItem, loginAccess: e.target.value })}
            />
          </div>
          <div className="mt-4">
            <Input label="Notes" placeholder="Any relevant notes..." value={newItem.notes} onChange={e => setNewItem({ ...newItem, notes: e.target.value })} />
          </div>
          <div className="flex items-center gap-3 mt-4">
            <Button size="sm" onClick={handleAdd}>Save Item</Button>
            <Button size="sm" variant="ghost" onClick={() => { setAddingNew(false); setNewItem(emptyItem()) }}>Cancel</Button>
          </div>
        </Card>
      )}

      {/* Table */}
      {items.length === 0 && !addingNew ? (
        <Card className="p-12 text-center">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">No software or vendor items yet</p>
          <p className="text-xs text-slate-400 mt-1 mb-4">Track the client&apos;s software subscriptions, tools, and vendor contracts.</p>
          <Button size="sm" onClick={() => setAddingNew(true)}>
            <Plus className="w-3.5 h-3.5" /> Add First Item
          </Button>
        </Card>
      ) : items.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Vendor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Annual Cost</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contract</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Transferable</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const isEditing = editingId === item.id && editDraft

                  if (isEditing) {
                    return (
                      <tr key={item.id} className="border-b border-slate-100 bg-amber-50/30">
                        <td className="px-4 py-2">
                          <Input value={editDraft.name} onChange={e => setEditDraft({ ...editDraft, name: e.target.value })} />
                        </td>
                        <td className="px-4 py-2">
                          <Input value={editDraft.vendor} onChange={e => setEditDraft({ ...editDraft, vendor: e.target.value })} />
                        </td>
                        <td className="px-4 py-2">
                          <Select options={CATEGORY_OPTIONS} value={editDraft.category} onChange={e => setEditDraft({ ...editDraft, category: e.target.value })} />
                        </td>
                        <td className="px-4 py-2">
                          <Input type="number" value={editDraft.annualCost || ''} onChange={e => setEditDraft({ ...editDraft, annualCost: Number(e.target.value) || 0 })} />
                        </td>
                        <td className="px-4 py-2">
                          <Select options={CONTRACT_OPTIONS} value={editDraft.contractStatus} onChange={e => setEditDraft({ ...editDraft, contractStatus: e.target.value })} />
                        </td>
                        <td className="px-4 py-2">
                          <Select options={TRANSFER_OPTIONS} value={editDraft.transferable} onChange={e => setEditDraft({ ...editDraft, transferable: e.target.value as TransferStatus })} />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" onClick={saveEdit}>Save</Button>
                            <Button size="sm" variant="ghost" onClick={cancelEdit}>Cancel</Button>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                      <td className="px-4 py-3 text-slate-600">{item.vendor || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge color="blue">{item.category || '—'}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 font-medium">{formatCurrency(item.annualCost)}</td>
                      <td className="px-4 py-3">
                        <ContractBadge status={item.contractStatus} />
                      </td>
                      <td className="px-4 py-3">
                        <TransferBadge status={item.transferable} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => startEdit(item)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}

                {/* Total row */}
                <tr className="bg-slate-50/80">
                  <td colSpan={3} className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Total Annual Cost
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">
                    {formatCurrency(totalCost)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
