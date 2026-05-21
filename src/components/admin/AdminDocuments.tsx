'use client'
import { useState } from 'react'
import { CheckCircle, Clock, AlertTriangle, FileText, Loader2, MessageSquareMore, Trash2 } from 'lucide-react'
import { Badge, Button, Input, Modal, Select, Textarea } from '@/components/ui'
import { ClientDocumentUpload } from '@/components/documents/ClientDocumentUpload'
import { VALUATION_DOCS, getDocsForAgentSelections, getDocsForWorkstream, mergeDocumentCategories } from '@/lib/documentData'
import { VALUATION_SECTION_ID } from '@/lib/document-deadlines'
import { DocumentDeadlineField, SectionDeadlineField } from '@/components/admin/DocumentDeadlineControls'
import { parseStoredInsuranceReview } from '@/lib/insurance-review-shared'
import { getAdminEmail, saveRequirement } from '@/lib/store'
import type { Client } from '@/lib/store'

function AdminDocumentDelete({ clientId, documentId, fileName, onDeleted }: {
  clientId: string
  documentId: string
  fileName?: string | null
  onDeleted: () => Promise<void> | void
}) {
  const [deleting, setDeleting] = useState(false)

  const removeDocument = async () => {
    if (!fileName || deleting) return
    const confirmed = window.confirm(`Delete "${fileName}" from this admin checklist item?`)
    if (!confirmed) return

    setDeleting(true)
    try {
      const res = await fetch('/api/client-documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, documentId }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || 'Failed to delete document')
      }
      await onDeleted()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Failed to delete document')
    } finally {
      setDeleting(false)
    }
  }

  if (!fileName) return null

  return (
    <Button size="sm" variant="outline" onClick={() => void removeDocument()} disabled={deleting}>
      {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
      {deleting ? 'Deleting...' : 'Delete'}
    </Button>
  )
}

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

export default function AdminDocumentsView({ client, onClientUpdated }: { client: Client; onClientUpdated?: (client: Client) => void }) {
  const { workstream, businessType, documentStatuses, uploadedDocuments } = client
  const categories = mergeDocumentCategories([
    ...(client.customWorkstream
      ? getDocsForAgentSelections(client.customWorkstream.agents)
      : getDocsForWorkstream(workstream, businessType)),
    ...getDocsForAgentSelections(client.workstreamAgents ?? []),
  ])
  const [followUpOpen, setFollowUpOpen] = useState(false)
  const [savingFollowUp, setSavingFollowUp] = useState(false)
  const [followUpForm, setFollowUpForm] = useState(EMPTY_FOLLOW_UP)
  const [refreshKey, setRefreshKey] = useState(0)

  const getStatus = (docId: string) => documentStatuses[docId]
  const refreshClientView = async () => {
    const res = await fetch(`/api/clients/${client.id}`, { cache: 'no-store' })
    if (!res.ok) {
      setRefreshKey(prev => prev + 1)
      return
    }
    const refreshed = (await res.json()) as Client
    onClientUpdated?.(refreshed)
    setRefreshKey(prev => prev + 1)
  }

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

  const renderInsuranceSummary = (docId: string) => {
    const uploaded = uploadedDocuments[docId]
    if (!uploaded?.aiReviewSummary && (!uploaded?.aiReviewFlags || uploaded.aiReviewFlags.length === 0)) return null
    const parsedReview = parseStoredInsuranceReview(uploaded?.aiReviewSummary)
    return (
      <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Insurance Review Agent</p>
        {parsedReview?.summary && <p className="text-xs text-slate-700 mt-1 leading-relaxed">{parsedReview.summary}</p>}
        {parsedReview?.withinLast12Months === false && uploaded.aiReviewFlags && uploaded.aiReviewFlags.length > 0 && (
          <div className="mt-2 space-y-1">
            {uploaded.aiReviewFlags.map((flag, index) => (
              <p key={`${flag}-${index}`} className="text-xs text-amber-700">{flag}</p>
            ))}
          </div>
        )}
      </div>
    )
  }

  const refreshFromSave = (saved: Client) => onClientUpdated?.(saved)

  const renderRow = (doc: { id: string; name: string; description?: string; flagged?: boolean; flagNote?: string }, sectionId: string) => (
    <div key={`${doc.id}-${refreshKey}`} className={`flex items-start gap-3 px-4 py-3 ${doc.flagged ? 'bg-amber-50' : ''}`}>
      {doc.flagged ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" /> : <FileText className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-800">{doc.name}</p>
        {'description' in doc && doc.description && <p className="text-xs text-slate-400 mt-0.5">{doc.description}</p>}
        {doc.flagged && doc.flagNote && <p className="text-xs text-amber-600 mt-0.5">{doc.flagNote}</p>}
        {doc.id === 'insurance_claims_12m' && renderInsuranceSummary(doc.id)}
      </div>
      <div className="shrink-0 flex flex-col items-end gap-2">
        <DocumentDeadlineField
          client={client}
          documentId={doc.id}
          sectionId={sectionId}
          onSaved={refreshFromSave}
        />
        <div className="flex items-center gap-2">
          {renderStatus(doc.id)}
          {getAdminEmail() && (
            <ClientDocumentUpload
              clientId={client.id}
              documentId={doc.id}
              uploaderEmail={getAdminEmail()}
              currentFileName={uploadedDocuments[doc.id]?.fileName || getStatus(doc.id)?.fileName}
              label="Admin upload"
              onUploaded={async () => {
                await refreshClientView()
              }}
            />
          )}
          <AdminDocumentDelete
            clientId={client.id}
            documentId={doc.id}
            fileName={uploadedDocuments[doc.id]?.fileName || getStatus(doc.id)?.fileName}
            onDeleted={refreshClientView}
          />
          <Button size="sm" variant="outline" onClick={() => openFollowUp(doc.id, doc.name)}>
            <MessageSquareMore className="w-3.5 h-3.5" />
            Follow-up Question
          </Button>
        </div>
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

      <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        Set target upload deadlines per section or per document. Clients see these in their portal; only admins can edit them here.
      </div>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <h4 className="text-sm font-semibold text-slate-700">Business Valuation Documents</h4>
          <Badge color="gold">First Priority</Badge>
        </div>
        <SectionDeadlineField
          client={client}
          sectionId={VALUATION_SECTION_ID}
          sectionLabel="Valuation documents"
          documentIds={VALUATION_DOCS.map(doc => doc.id)}
          onSaved={refreshFromSave}
        />
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-50">
          {VALUATION_DOCS.map(doc => renderRow(doc, VALUATION_SECTION_ID))}
        </div>
      </section>

      {categories.map(cat => (
        <section key={cat.id}>
          <h4 className="text-sm font-semibold text-slate-700 mb-3">{cat.title}</h4>
          <SectionDeadlineField
            client={client}
            sectionId={cat.id}
            sectionLabel={cat.title}
            documentIds={cat.documents.map(doc => doc.id)}
            onSaved={refreshFromSave}
          />
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-50">
            {cat.documents.map(doc => renderRow(doc, cat.id))}
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
