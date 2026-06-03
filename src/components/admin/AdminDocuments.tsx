'use client'
import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, Loader2, MessageSquareMore, Trash2 } from 'lucide-react'
import { DocumentUploadAccordion } from '@/components/documents/DocumentUploadAccordion'
import { Badge, Button, Input, Modal, Select, Textarea } from '@/components/ui'
import { ClientDocumentUpload } from '@/components/documents/ClientDocumentUpload'
import { AdminDocumentFileList } from '@/components/admin/AdminDocumentFileList'
import { fetchClientDocumentsBatch, mergeUploadedFiles, type FilesByDocumentId } from '@/lib/client-document-files'
import type { ClientUploadedFile } from '@/lib/client-document-upload'
import { VALUATION_DOCS, getDocsForAgentSelections, getDocsForWorkstream, mergeDocumentCategories } from '@/lib/documentData'
import {
  MULTI_YEAR_UPLOAD_SLOTS,
  getMultiYearCombinedId,
  getMultiYearUploadProgress,
  isMultiYearParentDocId,
} from '@/lib/client-portal-documents'
import { VALUATION_SECTION_ID } from '@/lib/document-deadlines'
import { DocumentDeadlineField, SectionDeadlineField } from '@/components/admin/DocumentDeadlineControls'
import { parseStoredInsuranceReview } from '@/lib/insurance-review-shared'
import { getAdminEmail, saveRequirement } from '@/lib/store'
import type { Client, DocumentStatus } from '@/lib/store'

function AdminDocumentDelete({ clientId, documentId, recordId, fileName, onDeleted }: {
  clientId: string
  documentId: string
  recordId?: string
  fileName?: string | null
  onDeleted: () => Promise<void> | void
}) {
  const [deleting, setDeleting] = useState(false)

  const removeDocument = async () => {
    if (!fileName || deleting) return
    const confirmed = window.confirm(
      recordId
        ? `Remove "${fileName}"?`
        : `Delete all files for this checklist item${fileName ? ` (including "${fileName}")` : ''}?`,
    )
    if (!confirmed) return

    setDeleting(true)
    try {
      const res = await fetch('/api/client-documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordId ? { clientId, recordId } : { clientId, documentId }),
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
    <Button size="sm" variant="outline" onClick={() => void removeDocument()} disabled={deleting} className="text-rose-600 border-rose-200 hover:bg-rose-50">
      {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
      {deleting ? 'Deleting…' : 'Delete'}
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
  const [filesByDocId, setFilesByDocId] = useState<FilesByDocumentId>({})
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null)

  const loadFileCatalog = useCallback(async () => {
    try {
      setFilesByDocId(await fetchClientDocumentsBatch(client.id))
    } catch {
      setFilesByDocId({})
    }
  }, [client.id])

  useEffect(() => {
    void loadFileCatalog()
  }, [loadFileCatalog, refreshKey])

  const getStatus = (docId: string) => documentStatuses[docId]

  const getFilesForSlot = (documentId: string, aliasIds: string[] = []): ClientUploadedFile[] => {
    const ids = aliasIds.length ? aliasIds : [documentId]
    const fromBatch = mergeUploadedFiles(ids, filesByDocId)
    if (fromBatch.length) return fromBatch
    const uploaded = uploadedDocuments[documentId]
    return (uploaded?.files ?? []).map(file => ({
      id: file.id,
      fileName: file.fileName,
      uploadedAt: file.uploadedAt,
    }))
  }

  const deleteOneFile = async (file: ClientUploadedFile) => {
    const confirmed = window.confirm(`Remove "${file.fileName}"?`)
    if (!confirmed) return
    setDeletingFileId(file.id)
    try {
      const res = await fetch('/api/client-documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, recordId: file.id }),
      })
      if (!res.ok) throw new Error(await res.text())
      await refreshClientView()
      await loadFileCatalog()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Failed to remove file')
    } finally {
      setDeletingFileId(null)
    }
  }

  const fileNameFromCatalog = (documentId: string, aliasIds: string[] = []) => {
    const files = getFilesForSlot(documentId, aliasIds)
    if (!files.length) return null
    return files.length === 1 ? files[0].fileName : `${files.length} files uploaded`
  }

  const getResolvedStatus = (docId: string): DocumentStatus => {
    const status = getStatus(docId)
    const uploaded = uploadedDocuments[docId]
    let catalogFileName = fileNameFromCatalog(docId)
    if (docId.endsWith('__combined')) {
      const parentId = docId.slice(0, -'__combined'.length)
      if (isMultiYearParentDocId(parentId)) {
        catalogFileName = fileNameFromCatalog(docId, [docId, parentId]) ?? catalogFileName
      }
    }
    return {
      id: docId,
      hasDoc: status?.hasDoc ?? (uploaded?.fileName || catalogFileName ? true : null),
      assignedTo: status?.assignedTo ?? null,
      uploadedAt: status?.uploadedAt ?? uploaded?.uploadedAt ?? null,
      fileName: status?.fileName ?? uploaded?.fileName ?? catalogFileName ?? null,
      fileUrl: status?.fileUrl ?? uploaded?.fileUrl ?? null,
      notApplicable: status?.notApplicable ?? false,
    }
  }

  const refreshClientView = async () => {
    const res = await fetch(`/api/clients/${client.id}`, { cache: 'no-store' })
    if (!res.ok) {
      setRefreshKey(prev => prev + 1)
      await loadFileCatalog()
      return
    }
    const refreshed = (await res.json()) as Client
    onClientUpdated?.(refreshed)
    setRefreshKey(prev => prev + 1)
    await loadFileCatalog()
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

  const countFiles = (docId: string, aliasIds?: string[]) => getFilesForSlot(docId, aliasIds).length

  const renderAdminStatusBadge = (docId: string) => {
    const s = getResolvedStatus(docId)
    const hasFiles = countFiles(docId) > 0
    if (s.notApplicable) return <Badge color="slate">N/A</Badge>
    if (s.hasDoc === false) return <Badge color="red">Client: No</Badge>
    if (hasFiles) return null
    if (s.hasDoc === true && !s.fileName) return <Badge color="gold">Awaiting upload</Badge>
    if (s.assignedTo) return <Badge color="gold">{s.assignedTo}</Badge>
    return <Badge color="gray">Not started</Badge>
  }

  const renderAdminToolbar = (
    doc: { id: string; name: string },
    opts?: { uploadDocumentId?: string; layout?: 'header' | 'panel' },
  ) => {
    const slotId = opts?.uploadDocumentId ?? doc.id
    const adminEmail = getAdminEmail()
    const files = getFilesForSlot(slotId)
    const resolved = getResolvedStatus(slotId)
    const hasFiles = files.length > 0 || Boolean(resolved.fileName)
    const isHeader = opts?.layout === 'header'

    return (
      <div
        className={`flex flex-wrap items-center gap-2 ${isHeader ? '' : 'border-t border-slate-200/80 pt-3'}`}
      >
        {!isHeader && (
          <p className="w-full text-[10px] font-semibold uppercase tracking-wide text-slate-400">Advisor actions</p>
        )}
        {adminEmail ? (
          <ClientDocumentUpload
            clientId={client.id}
            documentId={slotId}
            uploaderEmail={adminEmail}
            currentFileName={resolved.fileName}
            label="Admin upload"
            variant="button"
            onUploaded={async () => { await refreshClientView() }}
          />
        ) : (
          <span className="text-[11px] text-amber-700">Sign in as admin to upload</span>
        )}
        <Button size="sm" variant="outline" onClick={() => openFollowUp(doc.id, doc.name)}>
          <MessageSquareMore className="w-3.5 h-3.5" />
          Follow-up Question
        </Button>
        {hasFiles && (
          <AdminDocumentDelete
            clientId={client.id}
            documentId={slotId}
            fileName={resolved.fileName ?? `${files.length} file(s)`}
            onDeleted={refreshClientView}
          />
        )}
      </div>
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

  const renderMultiYearRow = (
    doc: { id: string; name: string; description?: string; flagged?: boolean; flagNote?: string },
    sectionId: string,
  ) => {
    const progress = getMultiYearUploadProgress(doc.id, id => getResolvedStatus(id))
    const combinedId = getMultiYearCombinedId(doc.id)
    const labels = MULTI_YEAR_UPLOAD_SLOTS[doc.id] ?? []
    const adminEmail = getAdminEmail()
    const totalFiles =
      countFiles(combinedId, [combinedId, doc.id]) +
      labels.reduce((sum, _, index) => sum + countFiles(`${doc.id}__year_${index + 1}`), 0)

    return (
      <DocumentUploadAccordion
        key={`${doc.id}-multi-${refreshKey}`}
        tone="admin"
        title={doc.name}
        description={doc.description}
        fileCount={totalFiles}
        isComplete={progress.completed === progress.total && progress.total > 0}
        statusBadge={
          <Badge color={progress.completed === progress.total ? 'green' : progress.completed > 0 ? 'gold' : 'slate'}>
            {progress.completed === progress.total ? 'All years' : `${progress.completed}/${progress.total} years`}
          </Badge>
        }
        headerActions={renderAdminToolbar(doc, { layout: 'header' })}
      >
        {doc.flagged && doc.flagNote && (
          <p className="mb-3 flex items-start gap-2 text-xs text-amber-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {doc.flagNote}
          </p>
        )}
        {doc.description && (
          <p className="mb-3 text-xs leading-relaxed text-slate-600">{doc.description}</p>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Target deadline</span>
          <DocumentDeadlineField client={client} documentId={doc.id} sectionId={sectionId} onSaved={refreshFromSave} />
        </div>

        <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
          Clients may upload one combined file or one file per year. You can add files on their behalf if needed.
        </p>

        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold text-slate-800">All years in one file</p>
            <p className="mt-0.5 mb-2 text-[11px] text-slate-500">PDF or ZIP covering every required year.</p>
            <AdminDocumentFileList
              clientId={client.id}
              files={getFilesForSlot(combinedId, [combinedId, doc.id])}
              onDeleteFile={deleteOneFile}
              deletingId={deletingFileId}
            />
            {adminEmail && (
              <div className="mt-2 flex flex-wrap gap-2">
                <ClientDocumentUpload
                  clientId={client.id}
                  documentId={combinedId}
                  uploaderEmail={adminEmail}
                  currentFileName={getResolvedStatus(combinedId).fileName}
                  label="Upload combined file"
                  variant="button"
                  onUploaded={async () => { await refreshClientView() }}
                />
                {countFiles(combinedId, [combinedId, doc.id]) > 0 && (
                  <AdminDocumentDelete
                    clientId={client.id}
                    documentId={combinedId}
                    fileName={getResolvedStatus(combinedId).fileName}
                    onDeleted={refreshClientView}
                  />
                )}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold text-slate-800 mb-2">One file per year</p>
            <div className="space-y-3">
              {labels.map((label, index) => {
                const slotId = `${doc.id}__year_${index + 1}`
                return (
                  <div key={slotId} className="rounded-md border border-slate-100 bg-slate-50/80 p-2.5">
                    <p className="text-xs font-medium text-slate-700 mb-1.5">{label}</p>
                    <AdminDocumentFileList
                      clientId={client.id}
                      files={getFilesForSlot(slotId)}
                      onDeleteFile={deleteOneFile}
                      deletingId={deletingFileId}
                    />
                    {adminEmail && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <ClientDocumentUpload
                          clientId={client.id}
                          documentId={slotId}
                          uploaderEmail={adminEmail}
                          currentFileName={getResolvedStatus(slotId).fileName}
                          label="Upload for this year"
                          variant="button"
                          onUploaded={async () => { await refreshClientView() }}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {renderAdminToolbar(doc, { layout: 'panel' })}
      </DocumentUploadAccordion>
    )
  }

  const renderRow = (doc: { id: string; name: string; description?: string; flagged?: boolean; flagNote?: string }, sectionId: string) => {
    if (MULTI_YEAR_UPLOAD_SLOTS[doc.id]) {
      return renderMultiYearRow(doc, sectionId)
    }

    const files = getFilesForSlot(doc.id)
    const isComplete = files.length > 0 || Boolean(getResolvedStatus(doc.id).fileName)

    return (
      <DocumentUploadAccordion
        key={`${doc.id}-${refreshKey}`}
        tone="admin"
        title={doc.name}
        description={doc.description}
        fileCount={files.length}
        isComplete={isComplete}
        statusBadge={renderAdminStatusBadge(doc.id)}
        headerActions={renderAdminToolbar(doc, { layout: 'header' })}
      >
        {doc.flagged && doc.flagNote && (
          <p className="mb-3 flex items-start gap-2 text-xs text-amber-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {doc.flagNote}
          </p>
        )}
        {doc.description && (
          <p className="mb-3 text-xs leading-relaxed text-slate-600">{doc.description}</p>
        )}
        {doc.id === 'insurance_claims_12m' && renderInsuranceSummary(doc.id)}

        <div className="mb-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Uploaded files</p>
          <AdminDocumentFileList
            clientId={client.id}
            files={files}
            onDeleteFile={deleteOneFile}
            deletingId={deletingFileId}
          />
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Target deadline</span>
          <DocumentDeadlineField client={client} documentId={doc.id} sectionId={sectionId} onSaved={refreshFromSave} />
        </div>

        {renderAdminToolbar(doc, { layout: 'panel' })}
      </DocumentUploadAccordion>
    )
  }

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

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 leading-relaxed">
        Each row has <span className="font-medium text-slate-700">Admin upload</span> and{' '}
        <span className="font-medium text-slate-700">Follow-up Question</span> on the right without expanding.
        Expand for full description, file list, per-document deadline, and delete.
        Section deadlines apply to the whole group unless overridden on a document.
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
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
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
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
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
