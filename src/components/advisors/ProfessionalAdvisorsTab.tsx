'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Users2 } from 'lucide-react'
import { Card, Button, Input, Select, Badge, cn } from '@/components/ui'

const SECTION_KEY = 'professionalAdvisors'

type WillingStatus = 'yes' | 'no' | 'unknown'

interface Advisor {
  id: string
  role: string
  name: string
  company: string
  email: string
  phone: string
  willingToParticipate: WillingStatus
  notes: string
}

const ROLE_OPTIONS = [
  { value: '', label: 'Select role...' },
  { value: 'Accountant', label: 'Accountant' },
  { value: 'Bookkeeper', label: 'Bookkeeper' },
  { value: 'Lawyer', label: 'Lawyer' },
  { value: 'Contractor', label: 'Contractor' },
  { value: 'Other', label: 'Other' },
]

const WILLING_OPTIONS = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
]

const emptyAdvisor = (): Advisor => ({
  id: crypto.randomUUID(),
  role: '',
  name: '',
  company: '',
  email: '',
  phone: '',
  willingToParticipate: 'unknown',
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

function WillingBadge({ status }: { status: WillingStatus }) {
  const map: Record<WillingStatus, { color: 'green' | 'red' | 'slate'; label: string }> = {
    yes: { color: 'green', label: 'Yes' },
    no: { color: 'red', label: 'No' },
    unknown: { color: 'slate', label: 'Unknown' },
  }
  const cfg = map[status]
  return <Badge color={cfg.color}>{cfg.label}</Badge>
}

export default function ProfessionalAdvisorsTab({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [advisors, setAdvisors] = useState<Advisor[]>([])
  const [loading, setLoading] = useState(true)
  const [addingNew, setAddingNew] = useState(false)
  const [newAdvisor, setNewAdvisor] = useState<Advisor>(emptyAdvisor())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Advisor | null>(null)

  useEffect(() => {
    loadAdvisors(clientId).then(d => { setAdvisors(d); setLoading(false) })
  }, [clientId])

  const persist = useCallback(async (updated: Advisor[]) => {
    setAdvisors(updated)
    await saveAdvisors(clientId, updated)
  }, [clientId])

  const handleAdd = async () => {
    if (!newAdvisor.name.trim()) return
    const updated = [...advisors, newAdvisor]
    await persist(updated)
    setNewAdvisor(emptyAdvisor())
    setAddingNew(false)
  }

  const handleDelete = async (id: string) => {
    await persist(advisors.filter(a => a.id !== id))
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
    if (!editDraft) return
    const updated = advisors.map(a => a.id === editDraft.id ? editDraft : a)
    await persist(updated)
    setEditingId(null)
    setEditDraft(null)
  }

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
            <Users2 className="w-5 h-5 text-amber-600" />
            Professional Advisors Directory
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Key professional contacts for {clientName}
          </p>
        </div>
        {!addingNew && (
          <Button size="sm" onClick={() => setAddingNew(true)}>
            <Plus className="w-3.5 h-3.5" /> Add Advisor
          </Button>
        )}
      </div>

      {/* Add form */}
      {addingNew && (
        <Card className="p-5 border-amber-200 bg-amber-50/30">
          <p className="text-sm font-semibold text-slate-700 mb-4">New Advisor</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="Role"
              options={ROLE_OPTIONS}
              value={newAdvisor.role}
              onChange={e => setNewAdvisor({ ...newAdvisor, role: e.target.value })}
            />
            <Input label="Name" placeholder="Full name" value={newAdvisor.name} onChange={e => setNewAdvisor({ ...newAdvisor, name: e.target.value })} />
            <Input label="Company" placeholder="Firm / company" value={newAdvisor.company} onChange={e => setNewAdvisor({ ...newAdvisor, company: e.target.value })} />
            <Input label="Email" type="email" placeholder="email@example.com" value={newAdvisor.email} onChange={e => setNewAdvisor({ ...newAdvisor, email: e.target.value })} />
            <Input label="Phone" placeholder="(555) 123-4567" value={newAdvisor.phone} onChange={e => setNewAdvisor({ ...newAdvisor, phone: e.target.value })} />
            <Select
              label="Willing to Participate"
              options={WILLING_OPTIONS}
              value={newAdvisor.willingToParticipate}
              onChange={e => setNewAdvisor({ ...newAdvisor, willingToParticipate: e.target.value as WillingStatus })}
            />
          </div>
          <div className="mt-4">
            <Input label="Notes" placeholder="Any relevant notes..." value={newAdvisor.notes} onChange={e => setNewAdvisor({ ...newAdvisor, notes: e.target.value })} />
          </div>
          <div className="flex items-center gap-3 mt-4">
            <Button size="sm" onClick={handleAdd}>Save Advisor</Button>
            <Button size="sm" variant="ghost" onClick={() => { setAddingNew(false); setNewAdvisor(emptyAdvisor()) }}>Cancel</Button>
          </div>
        </Card>
      )}

      {/* Table */}
      {advisors.length === 0 && !addingNew ? (
        <Card className="p-12 text-center">
          <Users2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">No professional advisors yet</p>
          <p className="text-xs text-slate-400 mt-1 mb-4">Add the client&apos;s accountant, lawyer, and other key contacts.</p>
          <Button size="sm" onClick={() => setAddingNew(true)}>
            <Plus className="w-3.5 h-3.5" /> Add First Advisor
          </Button>
        </Card>
      ) : advisors.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Company</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Willing</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {advisors.map(advisor => {
                  const isEditing = editingId === advisor.id && editDraft

                  if (isEditing) {
                    return (
                      <tr key={advisor.id} className="border-b border-slate-100 bg-amber-50/30">
                        <td className="px-4 py-2">
                          <Select
                            options={ROLE_OPTIONS}
                            value={editDraft.role}
                            onChange={e => setEditDraft({ ...editDraft, role: e.target.value })}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Input value={editDraft.name} onChange={e => setEditDraft({ ...editDraft, name: e.target.value })} />
                        </td>
                        <td className="px-4 py-2">
                          <Input value={editDraft.company} onChange={e => setEditDraft({ ...editDraft, company: e.target.value })} />
                        </td>
                        <td className="px-4 py-2">
                          <div className="space-y-1">
                            <Input placeholder="Email" value={editDraft.email} onChange={e => setEditDraft({ ...editDraft, email: e.target.value })} />
                            <Input placeholder="Phone" value={editDraft.phone} onChange={e => setEditDraft({ ...editDraft, phone: e.target.value })} />
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <Select
                            options={WILLING_OPTIONS}
                            value={editDraft.willingToParticipate}
                            onChange={e => setEditDraft({ ...editDraft, willingToParticipate: e.target.value as WillingStatus })}
                          />
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
                    <tr key={advisor.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <Badge color="blue">{advisor.role || '—'}</Badge>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{advisor.name}</td>
                      <td className="px-4 py-3 text-slate-600">{advisor.company || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {advisor.email && <div>{advisor.email}</div>}
                        {advisor.phone && <div>{advisor.phone}</div>}
                        {!advisor.email && !advisor.phone && '—'}
                      </td>
                      <td className="px-4 py-3">
                        <WillingBadge status={advisor.willingToParticipate} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => startEdit(advisor)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(advisor.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
