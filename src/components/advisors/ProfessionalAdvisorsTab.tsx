'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Users2, Info, UserPlus, X, Check } from 'lucide-react'
import { Card, Button, Input, cn } from '@/components/ui'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import { AdvisorActions } from '@/components/client-portal/AgentClientPortalFrame'
import { buildAdvisorsReportHtml } from '@/lib/report-export/build-advisors-report'

const SECTION_KEY = 'professionalAdvisors'

export interface Advisor {
  id: string
  role: string
  name: string
  company: string
  email: string
  phone: string
  notes: string
}

const COMMON_ROLES = [
  'CPA',
  'Accountant',
  'Bookkeeper',
  'Lawyer',
  'Attorney',
  'Benefits',
  'Insurance Agent',
  'Financial Advisor',
  'Contractor',
  'Other',
]

const emptyAdvisor = (): Advisor => ({
  id: crypto.randomUUID(),
  role: '',
  name: '',
  company: '',
  email: '',
  phone: '',
  notes: '',
})

async function loadAdvisors(clientId: string): Promise<Advisor[]> {
  const res = await fetch(`/api/client-data/${clientId}?section=${SECTION_KEY}`)
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

async function saveAdvisors(clientId: string, advisors: Advisor[]) {
  await fetch(`/api/client-data/${clientId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ section: SECTION_KEY, data: advisors }),
  })
}

function getRoleBadgeStyle(role: string): string {
  const r = (role || '').toLowerCase().trim()
  if (r.includes('cpa') || r.includes('accountant') || r.includes('tax')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }
  if (r.includes('lawyer') || r.includes('attorney') || r.includes('legal') || r.includes('counsel')) {
    return 'bg-purple-50 text-purple-700 border-purple-200'
  }
  if (r.includes('bookkeeper') || r.includes('accounting')) {
    return 'bg-blue-50 text-blue-700 border-blue-200'
  }
  if (r.includes('benefit') || r.includes('insurance') || r.includes('broker')) {
    return 'bg-amber-50 text-amber-700 border-amber-200'
  }
  return 'bg-slate-100 text-slate-700 border-slate-200'
}

function DeleteConfirmModal({
  isOpen,
  advisorName,
  onClose,
  onConfirm,
}: {
  isOpen: boolean
  advisorName: string
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
            <h3 className="text-base font-semibold text-slate-900">Remove Advisor Contact?</h3>
            <p className="text-xs text-slate-500">
              Are you sure you want to remove <strong className="text-slate-800">{advisorName}</strong> from this client&apos;s directory?
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

export default function ProfessionalAdvisorsTab({
  clientId,
  clientName,
  readOnly = false,
}: {
  clientId: string
  clientName: string
  readOnly?: boolean
}) {
  const [advisors, setAdvisors] = useState<Advisor[]>([])
  const [loading, setLoading] = useState(true)
  const [addingNew, setAddingNew] = useState(false)
  const [newAdvisor, setNewAdvisor] = useState<Advisor>(emptyAdvisor())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Advisor | null>(null)
  const [deletingAdvisor, setDeletingAdvisor] = useState<Advisor | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => setToast({ message, type })

  useEffect(() => {
    loadAdvisors(clientId).then(d => {
      setAdvisors(d)
      setLoading(false)
    })
  }, [clientId])

  const persist = useCallback(
    async (updated: Advisor[]) => {
      setAdvisors(updated)
      try {
        await saveAdvisors(clientId, updated)
      } catch (err) {
        console.error('Failed to save advisors:', err)
        showToast('Failed to save advisor directory', 'error')
      }
    },
    [clientId],
  )

  const handleAdd = async () => {
    if (!newAdvisor.name.trim()) return
    const updated = [...advisors, newAdvisor]
    await persist(updated)
    setNewAdvisor(emptyAdvisor())
    setAddingNew(false)
    showToast(`Added ${newAdvisor.name} to directory`)
  }

  const handleDeleteConfirmed = async () => {
    if (!deletingAdvisor) return
    const updated = advisors.filter(a => a.id !== deletingAdvisor.id)
    await persist(updated)
    showToast(`Removed ${deletingAdvisor.name}`)
    setDeletingAdvisor(null)
  }

  const startEdit = (advisor: Advisor) => {
    setEditingId(advisor.id)
    setEditDraft({ ...advisor })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditDraft(null)
  }

  const saveEdit = async () => {
    if (!editDraft || !editDraft.name.trim()) return
    const updated = advisors.map(a => (a.id === editDraft.id ? editDraft : a))
    await persist(updated)
    showToast(`Updated ${editDraft.name}`)
    setEditingId(null)
    setEditDraft(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-xs text-slate-400">Loading professional advisors…</p>
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
            Professional Advisors Directory
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Key professional contacts, accountants, lawyers, and business consultants for {clientName}
          </p>
        </div>

        <AdvisorActions className="flex items-center gap-2 shrink-0">
          {advisors.length > 0 && (
            <ExportReportButton
              html={buildAdvisorsReportHtml(advisors, clientName)}
              fileName={`advisors-report-${clientName.replace(/\s+/g, '-').toLowerCase()}`}
              label="Export Advisors Report"
            />
          )}
        </AdvisorActions>
      </div>

      {/* Workspace Container Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6">
        {/* Sector Header: Synchronized Client Portal Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Client Portal Synchronized Directory
              </h4>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {advisors.length} {advisors.length === 1 ? 'contact' : 'contacts'}
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            No document upload required. This directory is automatically populated when the client completes their onboarding form under <strong className="text-slate-700 font-semibold">Required Info</strong> in the Client Portal. You can also add or edit advisors manually below.
          </p>
        </div>

        {/* Valuation-style Source Row Card */}
        <div className="p-4 rounded-xl border border-slate-200/80 bg-white transition-all shadow-2xs">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div
                className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                  advisors.length > 0
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-slate-100 text-slate-400',
                )}
              >
                <Users2 className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-800">
                    Professional Advisors List
                  </p>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                    Client Portal Form
                  </span>
                  {advisors.length > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <Check className="w-3 h-3 text-emerald-600" /> {advisors.length} Provided
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200">
                      Awaiting client input or manual entry
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  CPA, corporate attorney, bookkeeper, benefits coordinator, financial advisors, or external consultants associated with {clientName}.
                </p>
              </div>
            </div>

            {/* Single clean Add Advisor action button */}
            {!readOnly && (
              <div className="shrink-0 pt-0.5">
                <Button
                  type="button"
                  variant={addingNew ? 'outline' : 'outline'}
                  size="sm"
                  onClick={() => setAddingNew(!addingNew)}
                  className="gap-1.5 h-8 text-xs font-medium text-slate-700 hover:text-slate-900 border-slate-200 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-slate-500" />
                  {addingNew ? 'Cancel' : 'Add Advisor'}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Add Advisor Form */}
        {!readOnly && addingNew && (
          <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-slate-700" />
                Add Professional Advisor
              </h4>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAddingNew(false)
                  setNewAdvisor(emptyAdvisor())
                }}
                className="h-7 px-2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Role / Specialty <span className="text-rose-500">*</span>
                </label>
                <Input
                  list="advisor-roles-list"
                  placeholder="e.g. CPA, Lawyer, Bookkeeper"
                  value={newAdvisor.role}
                  onChange={e => setNewAdvisor({ ...newAdvisor, role: e.target.value })}
                  className="bg-white"
                />
                <datalist id="advisor-roles-list">
                  {COMMON_ROLES.map(r => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="e.g. Sarah Jenkins"
                  value={newAdvisor.name}
                  onChange={e => setNewAdvisor({ ...newAdvisor, name: e.target.value })}
                  className="bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Company / Firm
                </label>
                <Input
                  placeholder="e.g. Jenkins & Co. CPAs"
                  value={newAdvisor.company}
                  onChange={e => setNewAdvisor({ ...newAdvisor, company: e.target.value })}
                  className="bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <Input
                  type="email"
                  placeholder="sarah@example.com"
                  value={newAdvisor.email}
                  onChange={e => setNewAdvisor({ ...newAdvisor, email: e.target.value })}
                  className="bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Phone Number
                </label>
                <Input
                  placeholder="(555) 000-0000"
                  value={newAdvisor.phone}
                  onChange={e => setNewAdvisor({ ...newAdvisor, phone: e.target.value })}
                  className="bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Notes / Relationship
                </label>
                <Input
                  placeholder="e.g. 3 years, primary tax contact"
                  value={newAdvisor.notes}
                  onChange={e => setNewAdvisor({ ...newAdvisor, notes: e.target.value })}
                  className="bg-white"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={!newAdvisor.name.trim()}
                className="gap-1.5 h-8 text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                Save Advisor
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setAddingNew(false)
                  setNewAdvisor(emptyAdvisor())
                }}
                className="h-8 text-xs cursor-pointer"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Directory Table or Clean Informational State */}
        {advisors.length === 0 && !addingNew ? (
          <div className="py-10 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
            <p className="text-xs text-slate-500 font-medium">No professional advisors listed yet</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
              When the client fills out their onboarding form under Required Info, their advisor contacts will appear here automatically. You can also click <strong className="text-slate-600 font-medium">&quot;Add Advisor&quot;</strong> above to record one manually.
            </p>
          </div>
        ) : advisors.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Advisor Contacts
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                  {advisors.length} {advisors.length === 1 ? 'contact' : 'contacts'}
                </span>
              </div>
              {!readOnly && (
                <p className="text-xs text-slate-500">
                  Click the pencil icon to modify contact details
                </p>
              )}
            </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/30">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[130px]">
                    Role
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Notes
                  </th>
                  {!readOnly && (
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[90px]">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {advisors.map(advisor => {
                  const isEditing = editingId === advisor.id && editDraft

                  if (isEditing) {
                    return (
                      <tr key={advisor.id} className="bg-amber-50/40">
                        <td className="px-5 py-2.5">
                          <Input
                            list="advisor-roles-list"
                            value={editDraft.role}
                            onChange={e => setEditDraft({ ...editDraft, role: e.target.value })}
                            className="bg-white text-xs h-8"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <Input
                            value={editDraft.name}
                            onChange={e => setEditDraft({ ...editDraft, name: e.target.value })}
                            className="bg-white text-xs h-8 font-medium"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <Input
                            value={editDraft.company}
                            onChange={e => setEditDraft({ ...editDraft, company: e.target.value })}
                            className="bg-white text-xs h-8"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <Input
                            type="email"
                            placeholder="Email"
                            value={editDraft.email}
                            onChange={e => setEditDraft({ ...editDraft, email: e.target.value })}
                            className="bg-white text-xs h-8"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <Input
                            placeholder="Phone"
                            value={editDraft.phone}
                            onChange={e => setEditDraft({ ...editDraft, phone: e.target.value })}
                            className="bg-white text-xs h-8"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <Input
                            placeholder="Notes"
                            value={editDraft.notes}
                            onChange={e => setEditDraft({ ...editDraft, notes: e.target.value })}
                            className="bg-white text-xs h-8"
                          />
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              onClick={saveEdit}
                              className="h-7 px-2.5 text-xs bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" /> Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={cancelEdit}
                              className="h-7 px-2 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr key={advisor.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <span
                          className={cn(
                            'inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md border',
                            getRoleBadgeStyle(advisor.role),
                          )}
                        >
                          {advisor.role || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-900">{advisor.name}</td>
                      <td className="px-4 py-3.5 text-slate-700">{advisor.company || '—'}</td>
                      <td className="px-4 py-3.5 text-slate-600 text-xs">
                        {advisor.email ? (
                          <a
                            href={`mailto:${advisor.email}`}
                            className="text-slate-600 hover:text-indigo-600 hover:underline transition-colors"
                          >
                            {advisor.email}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 text-xs">
                        {advisor.phone ? (
                          <a
                            href={`tel:${advisor.phone}`}
                            className="text-slate-600 hover:text-indigo-600 hover:underline transition-colors"
                          >
                            {advisor.phone}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td
                        className="px-4 py-3.5 text-slate-500 text-xs max-w-[240px] truncate"
                        title={advisor.notes || undefined}
                      >
                        {advisor.notes || '—'}
                      </td>
                      {!readOnly && (
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => startEdit(advisor)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                              title="Edit advisor"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeletingAdvisor(advisor)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Delete advisor"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(deletingAdvisor)}
        advisorName={deletingAdvisor?.name || ''}
        onClose={() => setDeletingAdvisor(null)}
        onConfirm={handleDeleteConfirmed}
      />

      {/* Status Toast */}
      {toast && <StatusToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
