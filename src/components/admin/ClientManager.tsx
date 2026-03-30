'use client'
import { useRef, useState } from 'react'
import { ExternalLink, FolderOpen, Plus, Trash2, Building2, Users, Briefcase, Upload, Image as ImageIcon, Loader2, CheckCircle2 } from 'lucide-react'
import { Button, Input, Select, Textarea, Badge, WorkstreamBadge } from '@/components/ui'
import { saveClient } from '@/lib/store'
import type { Client, Workstream, BusinessType } from '@/lib/store'

const WS_OPTIONS = [
  { value: '', label: '— Not provisioned —' },
  { value: 'ws1', label: 'Workstream 1 — Risk Mitigation' },
  { value: 'ws2', label: 'Workstream 2 — Profitability & Growth' },
  { value: 'both', label: 'Workstream 1 + 2 (Both)' },
  { value: 'ma', label: 'M&A Process' },
]

const STAGE_OPTIONS = [
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'collection', label: 'Collection' },
  { value: 'review', label: 'Review' },
  { value: 'final', label: 'Final Report' },
  { value: 'closed', label: 'Closed' },
]

export default function ClientManager({ client: initial, onSaved }: {
  client: Client
  onSaved: (c: Client) => void
}) {
  const [client, setClient] = useState(initial)
  const [saved, setSaved] = useState(false)
  const [newBranch, setNewBranch] = useState('')
  const [newMember, setNewMember] = useState({ name: '', email: '', role: '' })
  const [newAdvisor, setNewAdvisor] = useState({ name: '', imageUrl: '', previewUrl: '' })
  const [addingMember, setAddingMember] = useState(false)
  const [addingAdvisor, setAddingAdvisor] = useState(false)
  const [uploadingAdvisorImage, setUploadingAdvisorImage] = useState(false)
  const advisorImageInputRef = useRef<HTMLInputElement | null>(null)

  const update = <K extends keyof Client>(key: K, val: Client[K]) =>
    setClient(p => ({ ...p, [key]: val }))

  const handleSave = async () => {
    const now = new Date().toISOString()
    const isFirstProvision = client.workstream && !initial.provisionedAt
    
    let driveFolder = client.driveFolder
    if (!driveFolder && client.name) {
      // Call Drive API to create folder structure
      try {
        const grantId = typeof window !== 'undefined' ? document.cookie.match(/cantara_nylas_grant=([^;]+)/)?.[1] : null
        const res = await fetch('/api/drive/create-folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientName: client.name, clientId: client.id, grantId }),
        })
        if (res.ok) {
          const data = await res.json()
          driveFolder = data.folderUrl
        }
      } catch {
        // Non-fatal: Drive folder creation can be retried
        driveFolder = `https://drive.google.com/drive/folders/cantara_${client.id}`
      }
    }

    const updated = {
      ...client,
      provisionedAt: isFirstProvision ? now : client.provisionedAt,
      driveFolder,
    }
    saveClient(updated)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onSaved(updated)
  }

  const addBranch = () => {
    if (!newBranch.trim()) return
    update('branches', [...client.branches, { id: 'b' + Date.now(), name: newBranch.trim() }])
    setNewBranch('')
  }

  const removeBranch = (id: string) => update('branches', client.branches.filter(b => b.id !== id))

  const addMember = () => {
    if (!newMember.name || !newMember.email) return
    update('teamMembers', [...client.teamMembers, { id: 'tm' + Date.now(), ...newMember }])
    setNewMember({ name: '', email: '', role: '' })
    setAddingMember(false)
  }

  const removeMember = (id: string) => update('teamMembers', client.teamMembers.filter(m => m.id !== id))

  const addAdvisor = () => {
    if (!newAdvisor.name || !newAdvisor.imageUrl) return
    const nextAdvisors = [...client.advisors, { id: 'adv' + Date.now(), name: newAdvisor.name, imageUrl: newAdvisor.imageUrl }]
    const nextClient = { ...client, advisors: nextAdvisors }
    setClient(nextClient)
    void saveClient(nextClient).then((savedClient) => {
      if (savedClient) {
        setClient(savedClient)
        onSaved(savedClient)
      }
    })
    setNewAdvisor({ name: '', imageUrl: '', previewUrl: '' })
    setAddingAdvisor(false)
  }

  const removeAdvisor = (id: string) => {
    const nextClient = { ...client, advisors: client.advisors.filter(a => a.id !== id) }
    setClient(nextClient)
    void saveClient(nextClient).then((savedClient) => {
      if (savedClient) {
        setClient(savedClient)
        onSaved(savedClient)
      }
    })
  }

  const handleAdvisorImageUpload = async (file?: File | null) => {
    if (!file) return
    setUploadingAdvisorImage(true)
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Failed to read image'))
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read image'))
      reader.readAsDataURL(file)
    }).catch(() => '')

    if (dataUrl) {
      setNewAdvisor(p => ({ ...p, imageUrl: dataUrl, previewUrl: dataUrl }))
    }

    try {
      const form = new FormData()
      form.append('file', file)
      form.append('clientId', client.id)
      const res = await fetch('/api/advisor-images/upload', {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        throw new Error(await res.text())
      }
      await res.json()
    } catch (error) {
      console.error(error)
    } finally {
      setUploadingAdvisorImage(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Identity */}
      <section>
        <h4 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-100">Client Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Full name" value={client.name} onChange={e => update('name', e.target.value)} />
          <Input label="Email address" type="email" value={client.email} onChange={e => update('email', e.target.value)} />
          <Input label="Company / Business name" value={client.company} onChange={e => update('company', e.target.value)} />
          <Input label="Phone" value={client.phone} onChange={e => update('phone', e.target.value)} />
        </div>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-100">Business Market Profile</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Business category"
            placeholder="e.g. Chinese restaurant, veterinary clinic, hair salon"
            value={client.businessCategory}
            onChange={e => update('businessCategory', e.target.value)}
          />
          <Input
            label="Website URL"
            placeholder="https://www.example.com"
            value={client.websiteUrl}
            onChange={e => update('websiteUrl', e.target.value)}
          />
        </div>
        <div className="mt-4">
          <Textarea
            label="Primary business address"
            placeholder="123 Main St, Suite 200, Seattle, WA 98101"
            value={client.businessAddress}
            onChange={e => update('businessAddress', e.target.value)}
            rows={3}
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          These fields are used by the Competitor Analysis Agent to search nearby competing businesses and compare services, pricing, reputation, and hours.
        </p>
      </section>

      {/* Workstream provisioning (was Monday dropdown) */}
      <section>
        <h4 className="text-sm font-semibold text-slate-700 mb-1 pb-2 border-b border-slate-100 flex items-center gap-2">
          Workstream Provisioning
          <span className="text-xs font-normal text-slate-400">— controls what documents the client sees</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Select
            label="Workstream"
            value={client.workstream ?? ''}
            onChange={e => update('workstream', (e.target.value || null) as Workstream)}
            options={WS_OPTIONS}
          />
          <Select
            label="Stage"
            value={client.stage}
            onChange={e => update('stage', e.target.value as Client['stage'])}
            options={STAGE_OPTIONS}
          />
        </div>
        {client.workstream && (
          <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-700">
            ✓ Client is provisioned on <WorkstreamBadge ws={client.workstream} /> — their portal will show the corresponding document checklist.
          </div>
        )}
        {!client.workstream && (
          <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500">
            Workstream not yet assigned. The client portal will not show document requirements until a workstream is selected.
          </div>
        )}
      </section>

      {/* Business structure */}
      <section>
        <h4 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-100">Business Structure</h4>
        <div className="flex gap-3 mb-4">
          {(['single', 'multi', 'parent'] as BusinessType[]).map(type => (
            <button
              key={type}
              onClick={() => update('businessType', type)}
              className={`flex-1 py-3 px-4 rounded-xl border text-xs font-medium transition-all ${
                client.businessType === type
                  ? 'border-amber-400 bg-amber-50 text-amber-700'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              <Building2 className="w-4 h-4 mx-auto mb-1" />
              {type === 'single' ? 'Single Location' : type === 'multi' ? 'Multiple Locations' : 'Parent Company'}
            </button>
          ))}
        </div>

        {(client.businessType === 'multi' || client.businessType === 'parent') && (
          <div>
            <p className="text-xs text-slate-500 mb-3">
              {client.businessType === 'parent'
                ? 'Shareholders agreement sits at parent entity level. Financials, leases, and licenses are required per branch.'
                : 'All document requirements are duplicated per branch.'}
            </p>
            <div className="space-y-2 mb-3">
              {client.branches.map(b => (
                <div key={b.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="flex-1 text-sm text-slate-700">{b.name}</span>
                  <button onClick={() => removeBranch(b.id)} className="text-slate-300 hover:text-rose-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Branch name (e.g. Seattle – Capitol Hill)"
                value={newBranch}
                onChange={e => setNewBranch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addBranch() }}
              />
              <Button variant="outline" onClick={addBranch} disabled={!newBranch.trim()}>Add</Button>
            </div>
          </div>
        )}
      </section>

      {/* Advisors */}
      <section>
        <h4 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
          <Briefcase className="w-4 h-4" /> Advisor Team
        </h4>
        <div className="space-y-2 mb-3">
          {client.advisors.map(a => (
            <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <img src={a.imageUrl} alt={a.name} className="w-10 h-10 rounded-full object-cover bg-slate-200" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{a.name}</p>
                <p className="text-xs text-slate-400">Client-facing advisor</p>
              </div>
              <button onClick={() => removeAdvisor(a.id)} className="text-slate-300 hover:text-rose-400 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        {addingAdvisor ? (
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 space-y-3">
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-[minmax(0,1fr)_220px] gap-3 items-start">
                <Input
                  placeholder="Advisor name"
                  value={newAdvisor.name}
                  onChange={e => setNewAdvisor(p => ({ ...p, name: e.target.value }))}
                />
                <div className="flex items-center justify-end gap-2 pt-0.5">
                  <Button variant="ghost" size="sm" onClick={() => setAddingAdvisor(false)}>Cancel</Button>
                  <Button size="sm" onClick={addAdvisor} disabled={!newAdvisor.name || !newAdvisor.imageUrl || uploadingAdvisorImage}>Add Advisor</Button>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-white px-4 py-3">
                <input
                  ref={advisorImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={e => void handleAdvisorImageUpload(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden bg-amber-50 border border-amber-100 shrink-0 flex items-center justify-center">
                    {newAdvisor.previewUrl || newAdvisor.imageUrl ? (
                      <img src={newAdvisor.previewUrl || newAdvisor.imageUrl} alt="Advisor preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-amber-600" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700">
                      {uploadingAdvisorImage ? 'Uploading advisor image...' : newAdvisor.previewUrl || newAdvisor.imageUrl ? 'Advisor image selected' : 'Upload advisor image'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      JPG, PNG, or WebP. Maximum file size: 5MB. This image will appear in the client portal.
                    </p>
                    {uploadingAdvisorImage && (
                      <div className="mt-2 inline-flex items-center gap-2 text-xs text-amber-700">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Uploading...
                      </div>
                    )}
                    {!uploadingAdvisorImage && (newAdvisor.previewUrl || newAdvisor.imageUrl) && (
                      <div className="mt-2 inline-flex items-center gap-2 text-xs text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Image ready
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={uploadingAdvisorImage}
                    onClick={() => advisorImageInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 transition-all hover:bg-amber-100 shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {uploadingAdvisorImage ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    {uploadingAdvisorImage ? 'Uploading' : newAdvisor.previewUrl || newAdvisor.imageUrl ? 'Replace Image' : 'Choose File'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setAddingAdvisor(true)}>
            <Plus className="w-3.5 h-3.5" /> Add Advisor
          </Button>
        )}
      </section>

      {/* Team members */}
      <section>
        <h4 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
          <Users className="w-4 h-4" /> Client Team Members
        </h4>
        <div className="space-y-2 mb-3">
          {client.teamMembers.map(m => (
            <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600">
                {m.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{m.name}</p>
                <p className="text-xs text-slate-400">{m.email} · {m.role}</p>
              </div>
              <button onClick={() => removeMember(m.id)} className="text-slate-300 hover:text-rose-400 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        {addingMember ? (
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input placeholder="Name" value={newMember.name} onChange={e => setNewMember(p => ({ ...p, name: e.target.value }))} />
              <Input placeholder="Email" value={newMember.email} onChange={e => setNewMember(p => ({ ...p, email: e.target.value }))} />
              <Input placeholder="Role (e.g. Accountant)" value={newMember.role} onChange={e => setNewMember(p => ({ ...p, role: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setAddingMember(false)}>Cancel</Button>
              <Button size="sm" onClick={addMember} disabled={!newMember.name || !newMember.email}>Add Member</Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setAddingMember(true)}>
            <Plus className="w-3.5 h-3.5" /> Add Team Member
          </Button>
        )}
      </section>

      {/* Google Drive */}
      <section>
        <h4 className="text-sm font-semibold text-slate-700 mb-3 pb-2 border-b border-slate-100">Google Drive Folder</h4>
        {client.driveFolder ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-sm text-slate-600 flex-1 truncate">{client.driveFolder}</span>
            <a href={client.driveFolder} target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:text-amber-700 shrink-0">
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-sm text-slate-400 text-center">
            Google Drive folder will be auto-created when the client is provisioned (via Google Drive API).
          </div>
        )}
      </section>

      {/* Notes */}
      <section>
        <Textarea
          label="Internal advisor notes"
          placeholder="Notes visible to the advisor team only..."
          rows={4}
          value={client.notes}
          onChange={e => update('notes', e.target.value)}
        />
      </section>

      {/* Save */}
      <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
        <Button onClick={handleSave}>{saved ? '✓ Saved' : 'Save Changes'}</Button>
        <span className="text-xs text-slate-400">Changes update the client portal immediately.</span>
      </div>
    </div>
  )
}
