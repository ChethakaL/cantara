'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle,
  CheckSquare,
  FileText,
  HelpCircle,
  Loader2,
  MessageSquareMore,
  Trash2,
  X,
} from 'lucide-react'
import { DocumentUploadAccordion } from '@/components/documents/DocumentUploadAccordion'
import { Badge, Button, Input, Modal, Select, Textarea } from '@/components/ui'
import { ClientDocumentUpload } from '@/components/documents/ClientDocumentUpload'
import { AdminDocumentFileList } from '@/components/admin/AdminDocumentFileList'
import { fetchClientDocumentsBatch, mergeUploadedFiles, type FilesByDocumentId } from '@/lib/client-document-files'
import type { ClientUploadedFile } from '@/lib/client-document-upload'
import { VALUATION_DOCS, getDocsForAgentSelections, getDocsForWorkstream, mergeDocumentCategories } from '@/lib/documentData'
import {
  CLIENT_PORTAL_HIDDEN_DOC_IDS,
  MULTI_YEAR_UPLOAD_SLOTS,
  getMultiYearCombinedId,
  getMultiYearUploadProgress,
  isMultiYearParentDocId,
} from '@/lib/client-portal-documents'
import { VALUATION_SECTION_ID } from '@/lib/document-deadlines'
import { DocumentDeadlineField, SectionDeadlineField } from '@/components/admin/DocumentDeadlineControls'
import { parseStoredInsuranceReview } from '@/lib/insurance-review-shared'
import { RevenueBreakdownReview } from '@/components/client-portal/RevenueBreakdownReview'
import { getAdminEmail, saveClient, saveRequirement } from '@/lib/store'
import type { Client, DocumentStatus } from '@/lib/store'
import { getClientWorkstreamAgents, SYSTEM_WORKSTREAM_AGENTS } from '@/lib/workstream-agents'

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
  const [actingUnavailableDocId, setActingUnavailableDocId] = useState<string | null>(null)
  const [reopenedUnavailableDocs, setReopenedUnavailableDocs] = useState<Record<string, boolean>>({})
  const [activeSubTab, setActiveSubTab] = useState<'checklist' | 'availability'>('checklist')
  const [showExcludedDocs, setShowExcludedDocs] = useState(false)
  const [savingStatusDocId, setSavingStatusDocId] = useState<string | null>(null)

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
  const assignedAgents = getClientWorkstreamAgents(client)

  const getAgentsForDocument = (documentId: string) => {
    const seen = new Set<string>()
    return assignedAgents.filter(agent => {
      if (seen.has(agent.agentId)) return false
      if (!(agent.documentIds ?? []).includes(documentId)) return false
      seen.add(agent.agentId)
      return true
    })
  }

  const getBaselineAgentsForDocument = (documentId: string) => {
    const sourceAgents =
      client.customWorkstream?.agents?.length
        ? client.customWorkstream.agents
        : client.workstream
          ? (SYSTEM_WORKSTREAM_AGENTS[client.workstream] ?? [])
          : []
    const seen = new Set<string>()
    return sourceAgents.filter(agent => {
      if (seen.has(agent.agentId)) return false
      if (!(agent.documentIds ?? []).includes(documentId)) return false
      seen.add(agent.agentId)
      return true
    })
  }

  const isAgentExcludedForDocument = (docId: string) => {
    const status = getResolvedStatus(docId)
    if (status.unavailableDecision === 'exclude_agent') return true
    if (status.hasDoc !== false) return false
    const baselineAgents = getBaselineAgentsForDocument(docId)
    if (baselineAgents.length === 0) return false
    const currentAgentIds = new Set(getAgentsForDocument(docId).map(agent => agent.agentId))
    return baselineAgents.some(agent => !currentAgentIds.has(agent.agentId))
  }

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

  const getResolvedStatus = (docId?: string | null): DocumentStatus => {
    const validId = String(docId ?? '')
    if (!validId) {
      return {
        id: '',
        hasDoc: null,
        unavailableDecision: null,
        assignedTo: null,
        uploadedAt: null,
        fileName: null,
        fileUrl: null,
        notApplicable: false,
      }
    }
    const status = getStatus(validId)
    const uploaded = uploadedDocuments[validId]
    let catalogFileName = fileNameFromCatalog(validId)
    if (validId.endsWith('__combined')) {
      const parentId = validId.slice(0, -'__combined'.length)
      if (isMultiYearParentDocId(parentId)) {
        catalogFileName = fileNameFromCatalog(validId, [validId, parentId]) ?? catalogFileName
      }
    }
    const fileName = status?.fileName ?? uploaded?.fileName ?? catalogFileName ?? null
    const hasRealFile = Boolean(fileName && String(fileName).trim())
    return {
      id: validId,
      // Keep checklist hasDoc as stored. Infer hasDoc from a real file only when
      // the checklist row is unset — never treat bare hasDoc as an uploaded file.
      hasDoc: status?.hasDoc ?? (hasRealFile ? true : null),
      unavailableDecision: status?.unavailableDecision ?? null,
      assignedTo: status?.assignedTo ?? null,
      uploadedAt: hasRealFile ? (status?.uploadedAt ?? uploaded?.uploadedAt ?? null) : status?.uploadedAt ?? null,
      fileName: hasRealFile ? fileName : null,
      fileUrl: hasRealFile ? (status?.fileUrl ?? uploaded?.fileUrl ?? null) : status?.fileUrl ?? null,
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

  const saveDocAvailability = async (docId: string, patch: { hasDoc?: boolean | null; notApplicable?: boolean }) => {
    setSavingStatusDocId(docId)
    const current = getResolvedStatus(docId)
    const nextStatus = {
      ...current,
      id: docId,
      hasDoc: patch.hasDoc !== undefined ? patch.hasDoc : current.hasDoc,
      notApplicable: patch.notApplicable !== undefined ? patch.notApplicable : false,
      unavailableDecision: patch.hasDoc === false ? current.unavailableDecision : null,
      assignedTo: patch.hasDoc === false || patch.notApplicable ? null : current.assignedTo,
    }

    const nextDocStatuses = {
      ...client.documentStatuses,
      [docId]: nextStatus,
    }
    const updatedClient = {
      ...client,
      documentStatuses: nextDocStatuses,
    }
    onClientUpdated?.(updatedClient)

    try {
      const res = await fetch('/api/client-portal/statuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.id,
          statuses: {
            [docId]: {
              hasDoc: nextStatus.hasDoc,
              notApplicable: nextStatus.notApplicable,
              unavailableDecision: nextStatus.unavailableDecision,
              assignedTo: nextStatus.assignedTo,
            },
          },
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      await refreshClientView()
    } catch (err) {
      console.error('Failed to update document availability:', err)
      window.alert('Failed to update document status. Please try again.')
      await refreshClientView()
    } finally {
      setSavingStatusDocId(null)
    }
  }

  const saveUnavailableDecision = async (
    docId: string,
    decision: 'exclude_agent' | 'keep_agent',
    affectedAgentIds: string[],
  ) => {
    if (actingUnavailableDocId) return
    setActingUnavailableDocId(docId)
    try {
      const nextStatuses = {
        ...client.documentStatuses,
        [docId]: {
          ...(client.documentStatuses[docId] ?? {}),
          id: docId,
          hasDoc: false,
          unavailableDecision: decision,
          assignedTo: null,
          uploadedAt: null,
          fileName: null,
          fileUrl: null,
          notApplicable: false,
        },
      }
      const nextAgents =
        decision === 'exclude_agent'
          ? assignedAgents.filter(agent => !affectedAgentIds.includes(agent.agentId))
          : assignedAgents
      const saved = await saveClient({
        id: client.id,
        documentStatuses: nextStatuses,
        workstreamAgents: nextAgents.map(agent => ({
          id: `override-${agent.agentId}`,
          agentId: agent.agentId,
          agentName: agent.agentName,
          documentIds: agent.documentIds ?? [],
        })),
      })
      setReopenedUnavailableDocs(prev => ({ ...prev, [docId]: false }))
      if (saved) onClientUpdated?.(saved)
      else await refreshClientView()
    } finally {
      setActingUnavailableDocId(null)
    }
  }

  const reopenUnavailableDecision = (docId: string) => {
    setReopenedUnavailableDocs(prev => ({ ...prev, [docId]: !prev[docId] }))
  }

  const renderUnavailableWarning = (doc: { id: string; name: string; type?: string }, status: DocumentStatus) => {
    if (doc.type !== 'required') return null
    if (status.hasDoc !== false) return null
    const reopened = Boolean(reopenedUnavailableDocs[doc.id])
    const decision = status.unavailableDecision ?? null
    const excluded = isAgentExcludedForDocument(doc.id)
    const affectedAgents = getAgentsForDocument(doc.id)
    const baselineAgents = getBaselineAgentsForDocument(doc.id)
    const lastKnownAgents = client.workstreamAgents?.filter(agent => (agent.documentIds ?? []).includes(doc.id)) ?? []
    const agentPool = affectedAgents.length > 0 ? affectedAgents : baselineAgents.length > 0 ? baselineAgents : lastKnownAgents
    if (!reopened && excluded) return null
    if (!reopened && decision === 'keep_agent') return null
    const loading = actingUnavailableDocId === doc.id
    if (agentPool.length === 0) return null
    const agentLabel =
      agentPool.length === 1
        ? agentPool[0].agentName
        : `${agentPool.length} agents (${agentPool.map(agent => agent.agentName).join(', ')})`

    return (
      <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
        <p className="text-xs font-semibold text-amber-900">Client marked this required document as not available.</p>
        <p className="mt-1 text-xs leading-relaxed text-amber-800">
          Do you need to exclude {agentLabel} for this client?
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => void saveUnavailableDecision(doc.id, 'exclude_agent', agentPool.map(agent => agent.agentId))}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Yes, exclude agent'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void saveUnavailableDecision(doc.id, 'keep_agent', agentPool.map(agent => agent.agentId))}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'No, keep agent'}
          </Button>
        </div>
      </div>
    )
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

  const renderAdminStatusBadge = (doc: { id: string; type?: string } | string) => {
    const docId = typeof doc === 'string' ? doc : doc?.id
    const docType = typeof doc === 'object' ? doc?.type : undefined
    if (!docId) return null
    const s = getResolvedStatus(docId)
    const hasFiles = countFiles(docId) > 0
    if (s.notApplicable || s.hasDoc === false) return <Badge color="amber">Client does not have</Badge>
    if (hasFiles) return null
    if (CLIENT_PORTAL_HIDDEN_DOC_IDS.has(docId)) return <Badge color="gray">Not started</Badge>
    if (docType === 'required' || s.hasDoc === true || Boolean(s.assignedTo)) {
      return <Badge color="gold">Awaiting upload</Badge>
    }
    return <Badge color="gray">Not started</Badge>
  }

  const renderUnavailableDecisionTag = (docId: string) => {
    if (!isAgentExcludedForDocument(docId)) return null
    return (
      <button
        type="button"
        onClick={() => reopenUnavailableDecision(docId)}
        className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100"
      >
        Agent excluded
      </button>
    )
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
        {isHeader && renderUnavailableDecisionTag(doc.id)}
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
    doc: { id: string; name: string; description?: string; flagged?: boolean; flagNote?: string; type?: string },
    sectionId: string,
  ) => {
    const shouldForceOpen =
      doc.type === 'required' &&
      getResolvedStatus(doc.id).hasDoc === false &&
      (!isAgentExcludedForDocument(doc.id) || Boolean(reopenedUnavailableDocs[doc.id]))
    const progress = getMultiYearUploadProgress(doc.id, id => getResolvedStatus(id))
    const combinedId = getMultiYearCombinedId(doc.id)
    const labels = MULTI_YEAR_UPLOAD_SLOTS[doc.id] ?? []
    const adminEmail = getAdminEmail()
    const totalFiles =
      countFiles(combinedId, [combinedId, doc.id]) +
      labels.reduce((sum, _, index) => sum + countFiles(`${doc.id}__year_${index + 1}`), 0)

    const multiYearStatusBadge = totalFiles > 0
      ? (
        <Badge color={progress.completed === progress.total ? 'green' : progress.completed > 0 ? 'gold' : 'slate'}>
          {progress.completed === progress.total ? 'All years' : `${progress.completed}/${progress.total} years`}
        </Badge>
      )
      : renderAdminStatusBadge(doc)

    return (
      <DocumentUploadAccordion
        key={`${doc.id}-multi-${refreshKey}`}
        tone="admin"
        title={doc.name}
        description={doc.description}
        assignedTo={getResolvedStatus(doc.id).assignedTo}
        defaultOpen={shouldForceOpen}
        fileCount={totalFiles}
        isComplete={progress.completed === progress.total && progress.total > 0}
        statusBadge={multiYearStatusBadge}
        headerActions={renderAdminToolbar(doc, { layout: 'header' })}
      >
        {doc.flagged && doc.flagNote && (
          <p className="mb-3 flex items-start gap-2 text-xs text-amber-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {doc.flagNote}
          </p>
        )}
        {renderUnavailableWarning(doc, getResolvedStatus(doc.id))}
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

  const renderRow = (doc: { id: string; name: string; description?: string; flagged?: boolean; flagNote?: string; type?: string }, sectionId: string) => {
    if (MULTI_YEAR_UPLOAD_SLOTS[doc.id]) {
      return renderMultiYearRow(doc, sectionId)
    }

    const files = getFilesForSlot(doc.id)
    const resolvedStatus = getResolvedStatus(doc.id)
    const isComplete = files.length > 0 || Boolean(resolvedStatus.fileName)
    const shouldForceOpen =
      doc.type === 'required' &&
      resolvedStatus.hasDoc === false &&
      (!isAgentExcludedForDocument(doc.id) || Boolean(reopenedUnavailableDocs[doc.id]))

    return (
      <DocumentUploadAccordion
        key={`${doc.id}-${refreshKey}`}
        tone="admin"
        title={doc.name}
        description={doc.description}
        assignedTo={resolvedStatus.assignedTo}
        defaultOpen={shouldForceOpen}
        fileCount={files.length}
        isComplete={isComplete}
        statusBadge={renderAdminStatusBadge(doc)}
        headerActions={renderAdminToolbar(doc, { layout: 'header' })}
      >
        {doc.flagged && doc.flagNote && (
          <p className="mb-3 flex items-start gap-2 text-xs text-amber-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {doc.flagNote}
          </p>
        )}
        {renderUnavailableWarning(doc, getResolvedStatus(doc.id))}
        {doc.description && (
          <p className="mb-3 text-xs leading-relaxed text-slate-600">{doc.description}</p>
        )}
        {doc.id === 'insurance_claims_12m' && renderInsuranceSummary(doc.id)}
        {doc.id === 'revenue_breakdown' && <RevenueBreakdownReview clientId={client.id} />}

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

  // Count only real uploads — never bare hasDoc or notApplicable as "Submitted".
  const submittedIds = new Set<string>()
  for (const [id, status] of Object.entries(documentStatuses)) {
    if (status.fileName && String(status.fileName).trim()) submittedIds.add(id)
  }
  for (const [id, uploaded] of Object.entries(uploadedDocuments ?? {})) {
    if (uploaded?.fileName && String(uploaded.fileName).trim()) submittedIds.add(id)
  }
  const submitted = submittedIds.size

  // Active checklist documents (filters out excluded/No/NA optional documents unless showExcludedDocs is true)
  const activeValuationDocs = VALUATION_DOCS.filter(doc => {
    if (doc.type === 'required') return true
    const s = getResolvedStatus(doc.id)
    if (s.fileName) return true
    if (showExcludedDocs) return true
    return s.hasDoc !== false && !s.notApplicable
  })

  const activeCategories = categories.map(cat => ({
    ...cat,
    documents: cat.documents.filter(doc => {
      if (doc.type === 'required') return true
      const s = getResolvedStatus(doc.id)
      if (s.fileName) return true
      if (showExcludedDocs) return true
      return s.hasDoc === true
    }),
  })).filter(cat => cat.documents.length > 0)

  const allApplicableDocs = [...VALUATION_DOCS, ...categories.flatMap(c => c.documents)]
  const totalRequired = activeValuationDocs.length + activeCategories.flatMap(c => c.documents).length
  const pending = Math.max(0, totalRequired - submitted)
  const unansweredCount = allApplicableDocs.filter(doc => {
    if (doc.type === 'required') return false
    const s = getResolvedStatus(doc.id)
    return s.hasDoc === null && !s.notApplicable
  }).length
  const excludedCount = allApplicableDocs.filter(doc => {
    if (doc.type === 'required') return false
    const s = getResolvedStatus(doc.id)
    return s.hasDoc === false || s.notApplicable === true
  }).length

  const renderAvailabilityRow = (doc: { id: string; name: string; description?: string; type?: string }) => {
    const s = getResolvedStatus(doc.id)
    const isSaving = savingStatusDocId === doc.id
    const files = getFilesForSlot(doc.id)
    const fileCount = files.length || (s.fileName ? 1 : 0)

    return (
      <div key={doc.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-800">{doc.name}</p>
            {doc.type === 'required' && (
              <Badge color="gold">Required</Badge>
            )}
            {doc.type === 'conditional' && (
              <Badge color="slate">Conditional</Badge>
            )}
            {doc.type === 'yes_no' && (
              <Badge color="slate">Optional</Badge>
            )}
            {fileCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                <CheckCircle className="w-3 h-3 text-emerald-600" />
                {s.fileName ?? `${fileCount} file(s) uploaded`}
              </span>
            )}
          </div>
          {doc.description && (
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{doc.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {isSaving ? (
            <div className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" /> Saving...
            </div>
          ) : (
            <>
              {/* Toggle: Yes */}
              <button
                type="button"
                onClick={() => void saveDocAvailability(doc.id, { hasDoc: s.hasDoc === true ? null : true, notApplicable: false })}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  s.hasDoc === true && !s.notApplicable
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-2xs ring-1 ring-emerald-500/20'
                    : 'border-slate-200 text-slate-400 hover:border-emerald-300 hover:text-emerald-700'
                }`}
              >
                ✓ Yes
              </button>
              {/* Toggle: No */}
              <button
                type="button"
                onClick={() => void saveDocAvailability(doc.id, { hasDoc: s.hasDoc === false ? null : false, notApplicable: false })}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  s.hasDoc === false && !s.notApplicable
                    ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-2xs ring-1 ring-rose-500/20'
                    : 'border-slate-200 text-slate-400 hover:border-rose-300 hover:text-rose-700'
                }`}
              >
                ✕ No
              </button>
              {/* Toggle: N/A */}
              <button
                type="button"
                onClick={() => void saveDocAvailability(doc.id, { notApplicable: !s.notApplicable, hasDoc: null })}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  s.notApplicable
                    ? 'border-slate-400 bg-slate-100 text-slate-700 shadow-2xs ring-1 ring-slate-400/20'
                    : 'border-slate-200 text-slate-300 hover:border-slate-300 hover:text-slate-600'
                }`}
              >
                N/A
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Sub-tabs header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/60 w-fit">
          <button
            type="button"
            onClick={() => setActiveSubTab('checklist')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === 'checklist'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            Document Checklist
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 font-medium">
              {submitted}/{totalRequired}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('availability')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === 'availability'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5 text-amber-600" />
            Client Document Availability (Yes / No / N/A)
            {unansweredCount > 0 ? (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 font-medium">
                {unansweredCount} unconfirmed
              </span>
            ) : (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-medium">
                All confirmed
              </span>
            )}
          </button>
        </div>

        {activeSubTab === 'checklist' && excludedCount > 0 && (
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showExcludedDocs}
              onChange={e => setShowExcludedDocs(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 accent-amber-600 cursor-pointer"
            />
            <span>Show {excludedCount} excluded / N/A items</span>
          </label>
        )}
      </div>

      {activeSubTab === 'checklist' && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Submitted', value: submitted, color: 'text-emerald-600' },
              { label: 'Pending', value: pending, color: 'text-amber-600' },
              { label: 'Total Required', value: totalRequired, color: 'text-slate-700' },
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
              {activeValuationDocs.map(doc => renderRow(doc, VALUATION_SECTION_ID))}
            </div>
          </section>

          {activeCategories.map(cat => (
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
        </div>
      )}

      {activeSubTab === 'availability' && (
        <div className="space-y-6">
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 text-xs text-amber-800 leading-relaxed flex items-start gap-3">
            <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900 mb-0.5">
                What the client reported they have (Yes / No / N/A)
              </p>
              <p className="text-amber-800/90 text-[11px]">
                This view mirrors Step 1 of the Client Portal's Assign Documents section. If the client calls and informs you they don't have a document or that it does not apply to their business, you can update their status below. Marking an optional document <span className="font-semibold text-rose-700">No</span> or <span className="font-semibold text-slate-700">N/A</span> will automatically remove it from the active Document Checklist.
              </p>
            </div>
          </div>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <h4 className="text-sm font-semibold text-slate-700">Business Valuation Documents</h4>
              <Badge color="gold">First Priority</Badge>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
              {VALUATION_DOCS.map(doc => renderAvailabilityRow(doc))}
            </div>
          </section>

          {categories.map(cat => (
            <section key={cat.id}>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">{cat.title}</h4>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
                {cat.documents.map(doc => renderAvailabilityRow(doc))}
              </div>
            </section>
          ))}
        </div>
      )}

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
