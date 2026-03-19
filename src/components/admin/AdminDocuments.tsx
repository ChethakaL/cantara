'use client'
import { useState } from 'react'
import { CheckCircle, Clock, AlertTriangle, FileText, MessageSquareMore } from 'lucide-react'
import { Badge, Button, Input, Modal, Select, Textarea } from '@/components/ui'
import { VALUATION_DOCS, getDocsForWorkstream } from '@/lib/documentData'
import { saveRequirement } from '@/lib/store'
import type { Client } from '@/lib/store'

const EMPTY_FOLLOW_UP = {
  title: '',
  description: '',
  question: '',
  requestUpload: true,
  priority: 'medium' as 'high' | 'medium' | 'low',
  sourceDocumentId: '',
  sourceDocumentName: '',
  sourceUploadedFileName: '',
}

export default function AdminDocumentsView({ client }: { client: Client }) {
  const { workstream, businessType, documentStatuses, uploadedDocuments } = client
  const categories = getDocsForWorkstream(workstream, businessType)
  const [followUpOpen, setFollowUpOpen] = useState(false)
  const [savingFollowUp, setSavingFollowUp] = useState(false)
  const [followUpForm, setFollowUpForm] = useState(EMPTY_FOLLOW_UP)

  const getStatus = (docId: string) => documentStatuses[docId]

  const openFollowUp = (docId: string, docName: string) => {
    const status = getStatus(docId)
    const uploaded = client.uploadedDocuments[docId]
    setFollowUpForm({
      title: `Follow-up for ${docName}`,
      description: '',
      question: '',
      requestUpload: true,
      priority: 'medium',
      sourceDocumentId: docId,
      sourceDocumentName: docName,
      sourceUploadedFileName: status?.fileName || uploaded?.fileName || '',
    })
    setFollowUpOpen(true)
  }

  const createFollowUp = async () => {
    if (!followUpForm.title.trim()) return
    setSavingFollowUp(true)
    try {
      await saveRequirement({
        clientId: client.id,
        title: followUpForm.title.trim(),
        description: followUpForm.description.trim(),
        question: followUpForm.question.trim() || null,
        requestUpload: followUpForm.requestUpload,
        sourceDocumentId: followUpForm.sourceDocumentId || null,
        sourceDocumentName: followUpForm.sourceDocumentName || null,
        sourceUploadedFileName: followUpForm.sourceUploadedFileName || null,
        priority: followUpForm.priority,
        status: 'open',
        clientResponse: null,
        responseFileName: null,
        responseFileUrl: null,
        respondedAt: null,
        createdAt: new Date().toISOString(),
      })
      setFollowUpOpen(false)
      setFollowUpForm(EMPTY_FOLLOW_UP)
    } finally {
      setSavingFollowUp(false)
    }
  }

  const renderStatus = (docId: string) => {
    const s = getStatus(docId)
    const uploaded = uploadedDocuments[docId]
    if (!s && uploaded?.fileName) {
      return (
        <a
          href={`/api/client-documents/view?clientId=${client.id}&documentId=${docId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 underline underline-offset-2"
        >
          <CheckCircle className="w-3 h-3" />
          {uploaded.fileName}
        </a>
      )
    }
    if (!s) return <span className="inline-flex items-center gap-1 text-xs text-slate-300"><Clock className="w-3 h-3" /> Awaiting</span>
    if (s.notApplicable) return <Badge color="slate">N/A</Badge>
    if (uploaded?.fileName) {
      return (
        <a
          href={`/api/client-documents/view?clientId=${client.id}&documentId=${docId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 underline underline-offset-2"
        >
          <CheckCircle className="w-3 h-3" />
          {uploaded.fileName}
        </a>
      )
    }
    if (s.hasDoc === false) return <Badge color="red">Client said: No</Badge>
    if (s.hasDoc === true && s.fileName) {
      return (
        <a
          href={`/api/client-documents/view?clientId=${client.id}&documentId=${docId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 underline underline-offset-2"
        >
          <CheckCircle className="w-3 h-3" />
          {s.fileName}
        </a>
      )
    }
    if (s.hasDoc === true && !s.fileName) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-amber-600">
          <Clock className="w-3 h-3" /> Confirmed, awaiting upload
        </span>
      )
    }
    if (s.assignedTo) return <Badge color="gold">Assigned to {s.assignedTo}</Badge>
    return uploaded?.fileName ? (
      <a
        href={`/api/client-documents/view?clientId=${client.id}&documentId=${docId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 underline underline-offset-2"
      >
        <CheckCircle className="w-3 h-3" />
        {uploaded.fileName}
      </a>
    ) : (
      <Badge color="slate">Unanswered</Badge>
    )
  }

  const renderRow = (doc: { id: string; name: string; description?: string; flagged?: boolean; flagNote?: string }) => (
    <div key={doc.id} className={`flex items-center gap-3 px-4 py-3 ${doc.flagged ? 'bg-amber-50' : ''}`}>
      {doc.flagged ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" /> : <FileText className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-800">{doc.name}</p>
        {'description' in doc && doc.description && <p className="text-xs text-slate-400 mt-0.5">{doc.description}</p>}
        {doc.flagged && doc.flagNote && <p className="text-xs text-amber-600 mt-0.5">{doc.flagNote}</p>}
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {renderStatus(doc.id)}
        <Button size="sm" variant="outline" onClick={() => openFollowUp(doc.id, doc.name)}>
          <MessageSquareMore className="w-3.5 h-3.5" />
          Follow-up Question
        </Button>
      </div>
    </div>
  )

  if (!workstream) {
    return (
      <div className="py-12 text-center text-sm text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
        <AlertTriangle className="w-8 h-8 text-slate-200 mx-auto mb-3" />
        No workstream assigned. Provision a workstream in Client Management to see document requirements.
      </div>
    )
  }

  const submitted = Object.values(documentStatuses).filter(s => s.fileName || s.notApplicable).length
  const total = VALUATION_DOCS.length + categories.flatMap(c => c.documents).length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Submitted', value: submitted, color: 'text-emerald-600' },
          { label: 'Pending', value: total - submitted, color: 'text-amber-600' },
          { label: 'Total Required', value: total, color: 'text-slate-700' },
        ].map(s => (
          <div key={s.label} className="text-center p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <h4 className="text-sm font-semibold text-slate-700">Business Valuation Documents</h4>
          <Badge color="gold">First Priority</Badge>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-50">
          {VALUATION_DOCS.map(renderRow)}
        </div>
      </section>

      {categories.map(cat => (
        <section key={cat.id}>
          <h4 className="text-sm font-semibold text-slate-700 mb-3">{cat.title}</h4>
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-50">
            {cat.documents.map(renderRow)}
          </div>
        </section>
      ))}

      <Modal open={followUpOpen} onClose={() => setFollowUpOpen(false)} title="Create Follow-up Requirement">
        <div className="space-y-4">
          <Input
            label="Requirement title"
            value={followUpForm.title}
            onChange={e => setFollowUpForm(p => ({ ...p, title: e.target.value }))}
          />
          <Input
            label="Related document"
            value={followUpForm.sourceDocumentName}
            onChange={e => setFollowUpForm(p => ({ ...p, sourceDocumentName: e.target.value }))}
          />
          <Input
            label="Uploaded file"
            value={followUpForm.sourceUploadedFileName}
            onChange={e => setFollowUpForm(p => ({ ...p, sourceUploadedFileName: e.target.value }))}
          />
          <Textarea
            label="Question for client"
            rows={3}
            value={followUpForm.question}
            onChange={e => setFollowUpForm(p => ({ ...p, question: e.target.value }))}
          />
          <Textarea
            label="Instructions / context"
            rows={3}
            value={followUpForm.description}
            onChange={e => setFollowUpForm(p => ({ ...p, description: e.target.value }))}
          />
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={followUpForm.requestUpload}
                onChange={e => setFollowUpForm(p => ({ ...p, requestUpload: e.target.checked }))}
              />
              Ask the client to upload a supporting document
            </label>
          </div>
          <Select
            label="Priority"
            value={followUpForm.priority}
            onChange={e => setFollowUpForm(p => ({ ...p, priority: e.target.value as 'high' | 'medium' | 'low' }))}
            options={[
              { value: 'high', label: '🔴 High — Blocking' },
              { value: 'medium', label: '🟡 Medium — Important' },
              { value: 'low', label: '🟢 Low — When possible' },
            ]}
          />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => setFollowUpOpen(false)}>Cancel</Button>
            <Button onClick={() => void createFollowUp()} disabled={savingFollowUp || !followUpForm.title.trim()}>
              {savingFollowUp ? 'Creating...' : 'Create Follow-up'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
