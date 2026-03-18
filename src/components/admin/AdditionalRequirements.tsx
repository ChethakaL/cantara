'use client'
import { useState, useEffect } from 'react'
import { Plus, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { Button, Badge, Textarea, Select, Input, Modal } from '@/components/ui'
import { getRequirements, saveRequirement, updateRequirement } from '@/lib/store'
import type { AdditionalRequirement } from '@/lib/store'

export default function AdditionalRequirementsAdmin({ clientId }: { clientId: string }) {
  const [reqs, setReqs] = useState<AdditionalRequirement[]>([])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium' as 'high' | 'medium' | 'low' })

  const load = async () => {
    const data = await getRequirements(clientId)
    setReqs(data)
  }
  useEffect(() => { load() }, [clientId])

  const submit = async () => {
    if (!form.title.trim()) return
    await saveRequirement({
      clientId,
      title: form.title.trim(),
      description: form.description.trim(),
      priority: form.priority,
      status: 'open',
      createdAt: new Date().toISOString(),
    })
    setForm({ title: '', description: '', priority: 'medium' })
    setAdding(false)
    await load()
  }

  const resolve = async (id: string) => {
    await updateRequirement(id, { status: 'resolved' })
    await load()
  }

  const open = reqs.filter(r => r.status === 'open')
  const resolved = reqs.filter(r => r.status === 'resolved')

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Additional Requirements</h3>
          <p className="text-xs text-slate-400 mt-0.5">Flag documents or information needed from the client</p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="w-3.5 h-3.5" /> Add Requirement
        </Button>
      </div>

      {open.length === 0 && resolved.length === 0 && (
        <div className="py-12 text-center text-sm text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <AlertCircle className="w-8 h-8 text-slate-200 mx-auto mb-3" />
          No requirements flagged yet. Add one to notify the client.
        </div>
      )}

      {open.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Open ({open.length})</p>
          {open.map(req => (
            <div key={req.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3">
              <div className="mt-0.5">
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800">{req.title}</p>
                  <Badge color={req.priority === 'high' ? 'red' : req.priority === 'medium' ? 'gold' : 'slate'}>
                    {req.priority}
                  </Badge>
                </div>
                {req.description && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{req.description}</p>}
                <p className="text-xs text-slate-300 mt-2">{new Date(req.createdAt).toLocaleDateString()}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => resolve(req.id)}>
                <CheckCircle className="w-3.5 h-3.5" /> Resolve
              </Button>
            </div>
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Resolved ({resolved.length})</p>
          {resolved.map(req => (
            <div key={req.id} className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-start gap-3 opacity-70">
              <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-700 line-through">{req.title}</p>
                {req.description && <p className="text-xs text-slate-400 mt-1">{req.description}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add Additional Requirement">
        <div className="space-y-4">
          <Input
            label="Requirement title"
            placeholder="e.g. Missing 2023 tax return"
            value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
          />
          <Textarea
            label="Description / instructions for client"
            placeholder="Describe what is needed and why..."
            rows={4}
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          />
          <Select
            label="Priority"
            value={form.priority}
            onChange={e => setForm(p => ({ ...p, priority: e.target.value as 'high' | 'medium' | 'low' }))}
            options={[
              { value: 'high', label: '🔴 High — Blocking' },
              { value: 'medium', label: '🟡 Medium — Important' },
              { value: 'low', label: '🟢 Low — When possible' },
            ]}
          />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            <Button onClick={submit} disabled={!form.title.trim()}>Add Requirement</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
