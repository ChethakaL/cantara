'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  FileText,
  ArrowRight,
  ExternalLink,
  Check,
  Clock,
  RotateCw,
  Info,
  X,
} from 'lucide-react'
import { Card, Button, Input, Select, Badge, cn } from '@/components/ui'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import { AdvisorActions } from '@/components/client-portal/AgentClientPortalFrame'
import { buildVendorReportHtml } from '@/lib/report-export/build-vendor-report'

const SECTION_KEY = 'vendorDirectory'

export type TransferStatus = 'yes' | 'no' | 'unknown'

export interface VendorItem {
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
  { value: 'Software', label: 'Software / SaaS' },
  { value: 'Booking/POS', label: 'Booking / POS' },
  { value: 'CRM', label: 'CRM / Customer Management' },
  { value: 'Accounting', label: 'Accounting / Finance' },
  { value: 'Payroll', label: 'Payroll & HR' },
  { value: 'Marketing', label: 'Marketing & Advertising' },
  { value: 'Communication', label: 'Communication / Phones' },
  { value: 'Security/Cameras', label: 'Security & Surveillance' },
  { value: 'Service', label: 'Professional Service' },
  { value: 'Supplier', label: 'Supplier / Inventory' },
  { value: 'Equipment', label: 'Equipment Lease' },
  { value: 'Maintenance', label: 'Maintenance & Repairs' },
  { value: 'Staffing', label: 'Staffing Agency' },
  { value: 'Other', label: 'Other' },
]

const CONTRACT_OPTIONS = [
  { value: '', label: 'Select status...' },
  { value: 'Active', label: 'Active' },
  { value: 'Month-to-month', label: 'Month-to-month' },
  { value: 'Expiring Soon', label: 'Expiring Soon' },
  { value: 'Expired', label: 'Expired' },
  { value: 'Terminated', label: 'Terminated' },
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
  try {
    const res = await fetch(`/api/client-data/${clientId}?section=${SECTION_KEY}`)
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch (err) {
    console.error('Failed to load vendor directory items:', err)
    return []
  }
}

async function checkContractReports(clientId: string): Promise<{ count: number; hasRun: boolean }> {
  try {
    const res = await fetch(`/api/contract-analysis/reports?clientId=${clientId}`)
    if (!res.ok) return { count: 0, hasRun: false }
    const data = await res.json()
    const isArray = Array.isArray(data)
    const count = isArray ? data.length : 0
    return { count, hasRun: count > 0 }
  } catch (err) {
    console.error('Failed to check contract reports:', err)
    return { count: 0, hasRun: false }
  }
}

async function saveItems(clientId: string, items: VendorItem[]) {
  await fetch(`/api/client-data/${clientId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ section: SECTION_KEY, data: items }),
  })
}

function ContractBadge({ status }: { status: string }) {
  const s = (status || '').toLowerCase().trim()
  let color: 'green' | 'blue' | 'gold' | 'red' | 'slate' = 'slate'
  if (s.includes('active')) color = 'green'
  else if (s.includes('month')) color = 'blue'
  else if (s.includes('expir') || s.includes('soon')) color = 'gold'
  else if (s.includes('terminat') || s.includes('cancel')) color = 'red'

  return <Badge color={color}>{status || '—'}</Badge>
}

function TransferBadge({ status }: { status: TransferStatus }) {
  const map: Record<TransferStatus, { color: 'green' | 'red' | 'slate'; label: string }> = {
    yes: { color: 'green', label: 'Yes' },
    no: { color: 'red', label: 'No' },
    unknown: { color: 'slate', label: 'Unknown' },
  }
  const cfg = map[status] ?? map.unknown
  return <Badge color={cfg.color}>{cfg.label}</Badge>
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

function DeleteConfirmModal({
  isOpen,
  itemName,
  onClose,
  onConfirm,
}: {
  isOpen: boolean
  itemName: string
  onClose: () => void
  onConfirm: () => void
}) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 text-center space-y-3">
          <div className="mx-auto w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center font-bold text-lg">
            !
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-900">Remove Vendor Item?</h3>
            <p className="text-xs text-slate-500">
              Are you sure you want to remove <strong className="text-slate-800">{itemName}</strong> from this client&apos;s directory?
            </p>
          </div>
        </div>
        <div className="flex border-t border-slate-100 p-3 gap-2 bg-slate-50/50 justify-end">
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs cursor-pointer">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            className="h-8 text-xs bg-rose-600 text-white hover:bg-rose-700 border-none cursor-pointer"
          >
            Confirm Remove
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatusToast({
  message,
  type,
  onClose,
}: {
  message: string
  type: 'success' | 'error'
  onClose: () => void
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div
      className={cn(
        'fixed bottom-8 right-8 z-[100] px-5 py-3 rounded-xl shadow-lg border flex items-center gap-2.5 animate-in slide-in-from-right-8 duration-300',
        type === 'success' ? 'bg-slate-900 text-white border-slate-800' : 'bg-rose-50 text-rose-700 border-rose-200'
      )}
    >
      <div className={cn('w-2 h-2 rounded-full', type === 'success' ? 'bg-emerald-400' : 'bg-rose-500')} />
      <p className="text-xs font-medium">{message}</p>
      <button onClick={onClose} className="ml-3 opacity-60 hover:opacity-100 transition-opacity cursor-pointer">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export default function VendorDirectoryTab({
  clientId,
  clientName,
  readOnly = false,
  onOpenMaterialContracts,
}: {
  clientId: string
  clientName: string
  readOnly?: boolean
  onOpenMaterialContracts?: () => void
}) {
  const [items, setItems] = useState<VendorItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [hasRunContracts, setHasRunContracts] = useState(false)
  const [contractReportsCount, setContractReportsCount] = useState(0)

  const [addingNew, setAddingNew] = useState(false)
  const [newItem, setNewItem] = useState<VendorItem>(emptyItem())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<VendorItem | null>(null)
  const [deletingItem, setDeletingItem] = useState<VendorItem | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
  }

  const loadAll = useCallback(async () => {
    try {
      const [vendorData, contractStatus] = await Promise.all([
        loadItems(clientId),
        checkContractReports(clientId),
      ])
      setItems(vendorData)
      setHasRunContracts(contractStatus.hasRun)
      setContractReportsCount(contractStatus.count)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [clientId])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadAll()
    showToast('Software & Vendor Directory refreshed')
  }

  const persist = useCallback(
    async (updated: VendorItem[]) => {
      setItems(updated)
      await saveItems(clientId, updated)
    },
    [clientId],
  )

  const handleAdd = async () => {
    if (!newItem.name.trim()) {
      showToast('Please enter a software or item name', 'error')
      return
    }
    const updated = [...items, newItem]
    await persist(updated)
    showToast(`Added ${newItem.name}`)
    setNewItem(emptyItem())
    setAddingNew(false)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingItem) return
    const updated = items.filter(i => i.id !== deletingItem.id)
    await persist(updated)
    showToast(`Removed ${deletingItem.name}`)
    setDeletingItem(null)
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
    if (!editDraft || !editDraft.name.trim()) return
    const updated = items.map(i => (i.id === editDraft.id ? editDraft : i))
    await persist(updated)
    showToast(`Updated ${editDraft.name}`)
    setEditingId(null)
    setEditDraft(null)
  }

  const totalCost = items.reduce((sum, i) => sum + (Number(i.annualCost) || 0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
          <p className="text-xs text-slate-400">Loading software &amp; vendor directory…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="font-serif text-xl font-bold text-slate-900 tracking-tight">
            Software &amp; Vendor Directory
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Software subscriptions, IT infrastructure, SaaS tools, and critical vendor contracts for {clientName}
          </p>
        </div>

        <AdvisorActions className="flex items-center gap-2 shrink-0">
          {items.length > 0 && (
            <ExportReportButton
              html={buildVendorReportHtml(items, clientName)}
              fileName={`vendor-report-${clientName.replace(/\s+/g, '-').toLowerCase()}`}
              label="Export Vendor Report"
            />
          )}
        </AdvisorActions>
      </div>

      {/* Workspace Container Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Software &amp; Vendor Directory
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Review vendor contracts and software subscriptions auto-extracted from Material Contracts, or manage them manually.
          </p>
        </div>

        {/* Sector Header */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                SOFTWARE &amp; VENDOR DIRECTORY
              </h4>
              <span
                className={cn(
                  'text-[11px] font-semibold px-2 py-0.5 rounded-full',
                  hasRunContracts
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-600',
                )}
              >
                {hasRunContracts ? '1 of 1 contracts ready' : '0 of 1 ready'}
              </span>
              {items.length > 0 && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {items.length} {items.length === 1 ? 'item' : 'items'}
                </span>
              )}
              {totalCost > 0 && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {formatCurrency(totalCost)} / yr
                </span>
              )}
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-[11px] text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCw className={cn('w-3 h-3', refreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>

          <p className="text-xs text-slate-500">
            {!hasRunContracts
              ? 'No document upload required. This directory is automatically populated with software subscriptions, vendor names, and annual costs once the Material Contracts Agent is run. You can open Material Contracts or manually add vendor items below.'
              : `Synchronized with Material Contracts (${contractReportsCount} ${contractReportsCount === 1 ? 'report' : 'reports'} on file). You can also add or edit items manually below.`}
          </p>
        </div>

        {/* Sector Cards List */}
        <div className="space-y-3">
          {/* Card 1: Material Contracts (Required) */}
          <div
            className={cn(
              'rounded-xl border p-4 transition-all shadow-2xs',
              hasRunContracts
                ? 'border-emerald-200 bg-emerald-50/20'
                : 'border-slate-200/80 bg-white',
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div
                  className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                    hasRunContracts
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-amber-50 text-amber-600',
                  )}
                >
                  <FileText className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800">
                      Material Contracts Review
                    </p>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                      Required
                    </span>
                    {hasRunContracts ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <Check className="w-3 h-3 text-emerald-600" /> Completed ({contractReportsCount} {contractReportsCount === 1 ? 'report' : 'reports'})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                        <Clock className="w-3 h-3 text-slate-500" /> Not run yet
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Vendor agreements, SaaS contracts, and customer agreements. Running Material Contracts automatically discovers and extracts vendor terms into this directory.
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    {hasRunContracts
                      ? `Analysis complete — ${items.length} vendor ${items.length === 1 ? 'entry' : 'entries'} synchronized to directory`
                      : 'Not run yet (required to auto-populate vendor subscriptions)'}
                  </p>
                </div>
              </div>

              {onOpenMaterialContracts && (
                <div className="shrink-0 pt-0.5">
                  <Button
                    type="button"
                    size="sm"
                    onClick={onOpenMaterialContracts}
                    className={cn(
                      'gap-1.5 h-8 text-xs font-medium cursor-pointer',
                      hasRunContracts
                        ? 'border-slate-200 text-slate-700 hover:text-slate-900 bg-white'
                        : 'bg-slate-900 text-white hover:bg-slate-800 border-none',
                    )}
                    variant={hasRunContracts ? 'outline' : 'default'}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {hasRunContracts ? 'View Contracts' : 'Open Material Contracts'}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Software & Vendor Subscriptions (Directory & Manual Override) */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 transition-all shadow-2xs">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div
                  className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                    items.length > 0
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-slate-100 text-slate-400',
                  )}
                >
                  <Package className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800">
                      Software &amp; Vendor Subscriptions
                    </p>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                      Directory
                    </span>
                    {items.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <Check className="w-3 h-3 text-emerald-600" /> {items.length} {items.length === 1 ? 'Item' : 'Items'} Ready
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200">
                        0 Items Recorded
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    SaaS tools, POS/booking systems, cloud hosting, equipment leases, and vendor supplier contracts.
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    {items.length > 0
                      ? `${items.length} ${items.length === 1 ? 'item' : 'items'} recorded (${formatCurrency(totalCost)}/yr total)`
                      : 'No items recorded yet (will auto-populate once Material Contracts is run or add manually)'}
                  </p>
                </div>
              </div>

              {!readOnly && (
                <div className="shrink-0 pt-0.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (addingNew) {
                        setAddingNew(false)
                        setNewItem(emptyItem())
                      } else {
                        setAddingNew(true)
                      }
                    }}
                    className="gap-1.5 h-8 text-xs font-medium text-slate-700 hover:text-slate-900 border-slate-200 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-slate-500" />
                    {addingNew ? 'Cancel' : (items.length === 0 ? 'Add First Item' : 'Add Item')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Add New Item Form Card */}
        {!readOnly && addingNew && (
          <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/60 shadow-2xs space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-700" />
                Add Software / Vendor Item
              </h4>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAddingNew(false)
                  setNewItem(emptyItem())
                }}
                className="h-7 px-2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Software / Item Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="e.g. QuickBooks Online, Shopify, AWS"
                  value={newItem.name}
                  onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                  className="bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Vendor / Counterparty
                </label>
                <Input
                  placeholder="e.g. Intuit Inc., Amazon Web Services"
                  value={newItem.vendor}
                  onChange={e => setNewItem({ ...newItem, vendor: e.target.value })}
                  className="bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Category
                </label>
                <Select
                  options={CATEGORY_OPTIONS}
                  value={newItem.category}
                  onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                  className="bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Annual Cost ($)
                </label>
                <Input
                  type="number"
                  placeholder="0"
                  value={newItem.annualCost || ''}
                  onChange={e => setNewItem({ ...newItem, annualCost: Number(e.target.value) || 0 })}
                  className="bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Contract Status
                </label>
                <Select
                  options={CONTRACT_OPTIONS}
                  value={newItem.contractStatus}
                  onChange={e => setNewItem({ ...newItem, contractStatus: e.target.value })}
                  className="bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Transferable to Buyer
                </label>
                <Select
                  options={TRANSFER_OPTIONS}
                  value={newItem.transferable}
                  onChange={e => setNewItem({ ...newItem, transferable: e.target.value as TransferStatus })}
                  className="bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Login &amp; Admin Access
                </label>
                <Select
                  options={LOGIN_OPTIONS}
                  value={newItem.loginAccess}
                  onChange={e => setNewItem({ ...newItem, loginAccess: e.target.value })}
                  className="bg-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Notes &amp; Contract Details
                </label>
                <Input
                  placeholder="e.g. 12-month auto-renewing license, 5 seats included"
                  value={newItem.notes}
                  onChange={e => setNewItem({ ...newItem, notes: e.target.value })}
                  className="bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setAddingNew(false)
                  setNewItem(emptyItem())
                }}
                className="h-8 text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAdd}
                className="h-8 text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 border-none cursor-pointer"
              >
                Save Item
              </Button>
            </div>
          </div>
        )}

        {/* Table View (shown when items exist) */}
        {items.length > 0 && (
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Software / Tool</th>
                    <th className="py-3 px-4">Vendor</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Annual Cost</th>
                    <th className="py-3 px-4">Contract Status</th>
                    <th className="py-3 px-4">Transferable</th>
                    <th className="py-3 px-4">Login Access</th>
                    {!readOnly && <th className="py-3 px-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map(item => {
                    const isEditing = editingId === item.id && editDraft

                    if (isEditing) {
                      return (
                        <tr key={item.id} className="bg-amber-50/40 border-b border-amber-200">
                          <td className="p-3">
                            <Input
                              value={editDraft.name}
                              onChange={e => setEditDraft({ ...editDraft, name: e.target.value })}
                              className="bg-white text-xs h-8"
                            />
                            <Input
                              placeholder="Notes..."
                              value={editDraft.notes}
                              onChange={e => setEditDraft({ ...editDraft, notes: e.target.value })}
                              className="bg-white text-xs h-7 mt-1.5"
                            />
                          </td>
                          <td className="p-3">
                            <Input
                              value={editDraft.vendor}
                              onChange={e => setEditDraft({ ...editDraft, vendor: e.target.value })}
                              className="bg-white text-xs h-8"
                            />
                          </td>
                          <td className="p-3">
                            <Select
                              options={CATEGORY_OPTIONS}
                              value={editDraft.category}
                              onChange={e => setEditDraft({ ...editDraft, category: e.target.value })}
                              className="bg-white text-xs h-8"
                            />
                          </td>
                          <td className="p-3 text-right">
                            <Input
                              type="number"
                              value={editDraft.annualCost || ''}
                              onChange={e =>
                                setEditDraft({ ...editDraft, annualCost: Number(e.target.value) || 0 })
                              }
                              className="bg-white text-xs h-8 text-right"
                            />
                          </td>
                          <td className="p-3">
                            <Select
                              options={CONTRACT_OPTIONS}
                              value={editDraft.contractStatus}
                              onChange={e => setEditDraft({ ...editDraft, contractStatus: e.target.value })}
                              className="bg-white text-xs h-8"
                            />
                          </td>
                          <td className="p-3">
                            <Select
                              options={TRANSFER_OPTIONS}
                              value={editDraft.transferable}
                              onChange={e =>
                                setEditDraft({
                                  ...editDraft,
                                  transferable: e.target.value as TransferStatus,
                                })
                              }
                              className="bg-white text-xs h-8"
                            />
                          </td>
                          <td className="p-3">
                            <Select
                              options={LOGIN_OPTIONS}
                              value={editDraft.loginAccess}
                              onChange={e => setEditDraft({ ...editDraft, loginAccess: e.target.value })}
                              className="bg-white text-xs h-8"
                            />
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                onClick={saveEdit}
                                className="h-7 text-xs bg-slate-900 text-white hover:bg-slate-800"
                              >
                                Save
                              </Button>
                              <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-7 text-xs">
                                Cancel
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    }

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{item.name}</div>
                          {item.notes && <p className="text-[11px] text-slate-500 mt-0.5">{item.notes}</p>}
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium">{item.vendor || '—'}</td>
                        <td className="py-3 px-4">
                          <Badge color="blue">{item.category || 'Other'}</Badge>
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-800">
                          {formatCurrency(item.annualCost)}
                        </td>
                        <td className="py-3 px-4">
                          <ContractBadge status={item.contractStatus} />
                        </td>
                        <td className="py-3 px-4">
                          <TransferBadge status={item.transferable} />
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-[11px]">
                          {item.loginAccess || '—'}
                        </td>
                        {!readOnly && (
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => startEdit(item)}
                                title="Edit item"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeletingItem(item)}
                                title="Remove item"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}

                  {/* Summary Footer Row */}
                  <tr className="bg-slate-50/80 border-t border-slate-200 font-semibold">
                    <td colSpan={3} className="py-3 px-4 text-right text-[11px] text-slate-500 uppercase tracking-wider">
                      Total Annual Cost
                    </td>
                    <td className="py-3 px-4 text-right text-xs font-bold text-slate-900">
                      {formatCurrency(totalCost)}
                    </td>
                    <td colSpan={readOnly ? 3 : 4} />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingItem && (
        <DeleteConfirmModal
          isOpen={Boolean(deletingItem)}
          itemName={deletingItem.name}
          onClose={() => setDeletingItem(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}

      {/* Toast Feedback */}
      {toast && (
        <StatusToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
