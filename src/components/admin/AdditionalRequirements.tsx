'use client'
import { useState, useEffect } from 'react'
import { Plus, CheckCircle, AlertCircle, Clock, MessageSquareMore, UploadCloud, FileText } from 'lucide-react'
import { Button, Badge, Textarea, Select, Input, Modal } from '@/components/ui'
import { getClient, getRequirements, saveRequirement, updateRequirement } from '@/lib/store'
import type { AdditionalRequirement, Client } from '@/lib/store'

const EMPTY_FORM = {
  title: '',
  description: '',
  question: '',
  requestUpload: false,
  assignedTo: '',
  sourceDocumentId: '',
  sourceDocumentName: '',
  priority: 'medium' as 'high' | 'medium' | 'low',
}

function isRequirementStillOpen(req: AdditionalRequirement) {
  return req.status === 'open' && !req.respondedAt && !req.clientResponse && !req.responseFileName && !req.responseFileUrl
}

export default function AdditionalRequirementsAdmin({ clientId }: { clientId: string }) {
  const [reqs, setReqs] = useState<AdditionalRequirement[]>([])
  const [client, setClient] = useState<Client | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const load = async () => {
    const [data, loadedClient] = await Promise.all([getRequirements(clientId), getClient(clientId)])
    setReqs(data)
    setClient(loadedClient)
  }
  useEffect(() => { void load() }, [clientId])

  const submit = async () => {
    if (!form.title.trim()) return
    await saveRequirement({
      clientId,
      title: form.title.trim(),
      description: form.description.trim(),
      question: form.question.trim() || null,
      requestUpload: form.requestUpload,
      assignedTo: form.assignedTo || null,
      sourceDocumentId: form.sourceDocumentId || null,
      sourceDocumentName: form.sourceDocumentName || null,
      sourceUploadedFileName: null,
      priority: form.priority,
      status: 'open',
      clientResponse: null,
      responseFileName: null,
      responseFileUrl: null,
      respondedAt: null,
      createdAt: new Date().toISOString(),
    })
    setForm(EMPTY_FORM)
    setAdding(false)
    await load()
  }

  const resolve = async (id: string) => {
    await updateRequirement(id, { status: 'resolved' })
    await load()
  }

  const open = reqs.filter(isRequirementStillOpen)
  const resolved = reqs.filter(r => !isRequirementStillOpen(r))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Additional Requirements</h3>
          <p className="text-xs text-slate-400 mt-0.5">Ask follow-up questions, request uploads, or do both from one requirement.</p>
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
                  <div>
                    <p className="text-sm font-medium text-slate-800">{req.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge color={req.priority === 'high' ? 'red' : req.priority === 'medium' ? 'gold' : 'slate'}>
                        {req.priority}
                      </Badge>
                      {req.question && <Badge color="blue">Question</Badge>}
                      {req.requestUpload && <Badge color="gold">Upload Requested</Badge>}
                      {req.assignedTo && (
                        <Badge color="slate">
                          Assigned to{' '}
                          {req.assignedTo.trim().toLowerCase() === 'me' || req.assignedTo.trim().toLowerCase() === 'self'
                            ? 'Client'
                            : req.assignedTo}
                        </Badge>
                      )}
                      {req.sourceDocumentName && <Badge color="slate">{req.sourceDocumentName}</Badge>}
                    </div>
                  </div>
                </div>
                {req.sourceUploadedFileName && (
                  <p className="text-xs text-slate-400 mt-2">Uploaded file: {req.sourceUploadedFileName}</p>
                )}
                {req.description && <p className="text-xs text-slate-500 mt-3 leading-relaxed">{req.description}</p>}
                {req.question && (
                  <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-slate-700">
                    <span className="font-medium text-blue-700">Follow-up question:</span> {req.question}
                  </div>
                )}
                {req.clientResponse && (
                  <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-slate-700">
                    <span className="font-medium text-emerald-700">Client response:</span> {req.clientResponse}
                  </div>
                )}
                {req.responseFileName && (
                  <div className="mt-2">
                    {req.responseFileUrl ? (
                      <a
                        href={req.responseFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-xs text-emerald-700 underline underline-offset-2"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        {req.responseFileName}
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-2 text-xs text-emerald-700">
                        <FileText className="w-3.5 h-3.5" />
                        {req.responseFileName}
                      </span>
                    )}
                  </div>
                )}
                <p className="text-xs text-slate-300 mt-3">{new Date(req.createdAt).toLocaleDateString()}</p>
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
            placeholder="e.g. Clarify 2023 P&L adjustments"
            value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
          />
          <Textarea
            label="Context / instructions"
            placeholder="Explain what you need the client to clarify or upload..."
            rows={3}
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          />
          <Textarea
            label="Follow-up question"
            placeholder="Ask a specific question the client should answer..."
            rows={3}
            value={form.question}
            onChange={e => setForm(p => ({ ...p, question: e.target.value }))}
          />
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.requestUpload}
                onChange={e => setForm(p => ({ ...p, requestUpload: e.target.checked }))}
              />
              Ask the client to upload a supporting file
            </label>
          </div>
          <Select
            label="Assign to"
            value={form.assignedTo}
            onChange={e => setForm(p => ({ ...p, assignedTo: e.target.value }))}
            options={[
              { value: '', label: 'Owner / main client only' },
              ...(client?.teamMembers ?? []).map(member => ({
                value: member.name,
                label: `${member.name}${member.role ? ` · ${member.role}` : ''}`,
              })),
            ]}
          />
          <Input
            label="Related document name (optional)"
            placeholder="e.g. P&L — Current Year to Date"
            value={form.sourceDocumentName}
            onChange={e => setForm(p => ({ ...p, sourceDocumentName: e.target.value }))}
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
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
              <div className="flex items-center gap-2 text-slate-700 font-medium mb-1">
                <MessageSquareMore className="w-3.5 h-3.5" /> Question
              </div>
              Use this when you need clarification or a written response.
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
              <div className="flex items-center gap-2 text-slate-700 font-medium mb-1">
                <UploadCloud className="w-3.5 h-3.5" /> Upload request
              </div>
              Use this when the client needs to attach a supporting document.
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            <Button onClick={submit} disabled={!form.title.trim()}>Add Requirement</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
