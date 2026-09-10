'use client'
// WS1-9 Business Permits & Zoning — Upload Screen
// Portal Documents availability + uploads are mirrored here (same pattern as OV / EO).

import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText, RefreshCw, Save } from 'lucide-react'
import type { UploadedDoc } from '@/hooks/useWS19Analysis'
import type { DocumentStatus } from '@/lib/store'
import {
  fetchClientDocumentAsBase64,
  listClientDocuments,
  type ClientUploadedDoc,
} from '@/lib/client-documents-client'

const ALL_DOCUMENT_SLOTS = [
  {
    key: 'business_license',
    label: 'Business License',
    note: 'Current business license or registration certificate from the city/county.',
    multi: true,
  },
  {
    key: 'kennel_license',
    label: 'Kennel License',
    note: 'Kennel or animal facility license required for pet boarding operations.',
    multi: false,
  },
  {
    key: 'health_permit',
    label: 'Health Permit',
    note: 'Health department permit or inspection certificate for animal care facilities.',
    multi: false,
  },
  {
    key: 'fire_permit',
    label: 'Fire Permit',
    note: 'Fire department permit, inspection certificate, or occupancy load documentation.',
    multi: false,
  },
  {
    key: 'zoning_verification',
    label: 'Zoning Verification / Certificate of Occupancy',
    note: 'Zoning verification letter, certificate of occupancy, or zoning compliance letter from the municipality.',
    multi: true,
  },
  {
    key: 'conditional_use_permit',
    label: 'Conditional Use Permit',
    note: 'CUP, special use permit, or special exception documentation including all conditions of approval.',
    multi: true,
  },
  {
    key: 'signage_permit',
    label: 'Signage Permit',
    note: 'Any signage permits or approvals for the property.',
    multi: true,
  },
  {
    key: 'building_permits',
    label: 'Building Permits',
    note: 'Building permits for any facility modifications, renovations, or additions.',
    multi: true,
  },
  {
    key: 'environmental_permits',
    label: 'Environmental Permits',
    note: 'Environmental permits related to waste disposal, water runoff, or other environmental compliance.',
    multi: true,
  },
  {
    key: 'variance_approvals',
    label: 'Variance Approvals',
    note: 'Any variance approvals, zoning board decisions, or appeals documentation.',
    multi: true,
  },
] as const

/** Maps Documents-tab / portal checklist IDs → Permits uploader slot keys */
const DOCUMENTS_TAB_TO_SLOT: Record<string, string> = {
  business_licenses: 'business_license',
  kennel_license: 'kennel_license',
  health_permit: 'health_permit',
  fire_permit: 'fire_permit',
  zoning_approval: 'zoning_verification',
  certificate_occupancy: 'zoning_verification',
  conditional_use_permit: 'conditional_use_permit',
  signage_permit: 'signage_permit',
  building_permits: 'building_permits',
  environmental_permits: 'environmental_permits',
  variance_approvals: 'variance_approvals',
}

/** One slot may map to multiple portal checklist IDs (zoning + CO). */
const SLOT_TO_DOCUMENT_IDS: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {}
  for (const [documentId, slotKey] of Object.entries(DOCUMENTS_TAB_TO_SLOT)) {
    map[slotKey] = [...(map[slotKey] ?? []), documentId]
  }
  return map
})()

const PERMITS_DOCUMENT_IDS = Object.keys(DOCUMENTS_TAB_TO_SLOT)

interface Props {
  clientId: string
  documentStatuses?: Record<string, DocumentStatus>
  onDocumentsReady: (docs: UploadedDoc[]) => void
  onAvailabilityReady?: (hasDocument: Record<string, boolean>) => void
  onAnalyze: () => void
  isLoading: boolean
}

function availabilityFromPortalStatus(status: DocumentStatus | undefined): boolean | undefined {
  if (!status) return undefined
  if (status.notApplicable) return false
  if (status.hasDoc === false) return false
  if (status.hasDoc === true || (status.fileName && String(status.fileName).trim())) return true
  return undefined
}

function slotAvailabilityFromPortal(
  statuses: Record<string, DocumentStatus> | undefined,
  slotKey: string,
): boolean | undefined {
  const documentIds = SLOT_TO_DOCUMENT_IDS[slotKey] ?? []
  let sawFalse = false
  for (const documentId of documentIds) {
    const value = availabilityFromPortalStatus(statuses?.[documentId])
    if (value === true) return true
    if (value === false) sawFalse = true
  }
  if (sawFalse && documentIds.every(id => availabilityFromPortalStatus(statuses?.[id]) !== undefined)) {
    return false
  }
  if (sawFalse) return false
  return undefined
}

export default function WS19Uploader({
  clientId,
  documentStatuses,
  onDocumentsReady,
  onAvailabilityReady,
  onAnalyze,
  isLoading,
}: Props) {
  const [uploadedBySlot, setUploadedBySlot] = useState<Record<string, UploadedDoc[]>>({})
  const [hasDocument, setHasDocument] = useState<Record<string, boolean>>({})
  const [portalSourceBySlot, setPortalSourceBySlot] = useState<Record<string, boolean>>({})
  const [savingDraft, setSavingDraft] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)
  const [draftLoaded, setDraftLoaded] = useState(false)
  const [documentsTabUploads, setDocumentsTabUploads] = useState<ClientUploadedDoc[]>([])
  const [importingDocId, setImportingDocId] = useState<string | null>(null)

  const documentStatusesRef = useRef(documentStatuses)
  documentStatusesRef.current = documentStatuses
  const uploadedBySlotRef = useRef(uploadedBySlot)
  uploadedBySlotRef.current = uploadedBySlot
  const hasDocumentRef = useRef(hasDocument)
  hasDocumentRef.current = hasDocument
  const onDocumentsReadyRef = useRef(onDocumentsReady)
  onDocumentsReadyRef.current = onDocumentsReady
  const onAvailabilityReadyRef = useRef(onAvailabilityReady)
  onAvailabilityReadyRef.current = onAvailabilityReady

  const allUploadedDocs = Object.values(uploadedBySlot).flat()
  const totalFileCount = allUploadedDocs.length
  const totalSizeBytes = allUploadedDocs.reduce((acc, doc) => acc + (doc.base64.length * 3) / 4, 0)
  const isOverLimits = totalFileCount > 15 || totalSizeBytes > 25 * 1024 * 1024

  const allSlotsAnswered = ALL_DOCUMENT_SLOTS.every(slot => hasDocument[slot.key] !== undefined)
  const allSlotsUnavailable = ALL_DOCUMENT_SLOTS.every(slot => hasDocument[slot.key] === false)
  const canRun = (totalFileCount > 0 || (allSlotsAnswered && allSlotsUnavailable)) && !isOverLimits
  const hasDraftInput = totalFileCount > 0 || Object.keys(hasDocument).length > 0

  const unavailableSlots = ALL_DOCUMENT_SLOTS.filter(slot => hasDocument[slot.key] === false)

  const syncReady = useCallback((nextUploaded: Record<string, UploadedDoc[]>, nextHas?: Record<string, boolean>) => {
    onDocumentsReadyRef.current(Object.values(nextUploaded).flat())
    if (nextHas) onAvailabilityReadyRef.current?.(nextHas)
  }, [])

  const persistDraft = useCallback(async (
    nextHasDocument: Record<string, boolean>,
    nextUploaded: Record<string, UploadedDoc[]>,
  ) => {
    try {
      await fetch(`/api/client-data/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'permitsZoningDraft',
          data: {
            hasDocument: nextHasDocument,
            uploadedBySlot: nextUploaded,
            savedAt: new Date().toISOString(),
          },
        }),
      })
    } catch {
      // best-effort
    }
  }, [clientId])

  const syncPortalAvailability = useCallback(async (slotKey: string, available: boolean) => {
    const documentIds = SLOT_TO_DOCUMENT_IDS[slotKey]
    if (!documentIds?.length) return
    try {
      const statuses = Object.fromEntries(
        documentIds.map(documentId => [
          documentId,
          {
            hasDoc: available,
            notApplicable: false,
            unavailableDecision: null,
            assignedTo: null,
          },
        ]),
      )
      await fetch('/api/client-portal/statuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, statuses }),
      })
    } catch (err) {
      console.warn('[WS19] Failed to sync portal availability', slotKey, err)
    }
  }, [clientId])

  const loadDocumentsTabUploads = useCallback(async () => {
    try {
      const docs = await listClientDocuments(clientId, PERMITS_DOCUMENT_IDS)
      setDocumentsTabUploads(docs)
      return docs
    } catch {
      return [] as ClientUploadedDoc[]
    }
  }, [clientId])

  const importDocIntoSlot = useCallback(async (
    doc: ClientUploadedDoc,
    current: Record<string, UploadedDoc[]>,
  ): Promise<{ uploaded: Record<string, UploadedDoc[]>; hasDocument: Record<string, boolean> } | null> => {
    const slotKey = DOCUMENTS_TAB_TO_SLOT[doc.documentId]
    if (!slotKey) return null
    const already = (current[slotKey] ?? []).some(item => item.name === doc.fileName)
    if (already) return null

    const payload = await fetchClientDocumentAsBase64({
      clientId,
      documentId: doc.documentId,
      recordId: doc.id,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
    })
    const nextDoc: UploadedDoc = {
      name: payload.name,
      base64: payload.base64,
      mediaType: payload.mediaType,
      slotKey,
      sizeBytes: payload.sizeBytes,
    }
    const slot = ALL_DOCUMENT_SLOTS.find(item => item.key === slotKey)
    const existing = current[slotKey] ?? []
    const nextSlotDocs = slot?.multi ? [...existing, nextDoc] : [nextDoc]
    return {
      uploaded: { ...current, [slotKey]: nextSlotDocs },
      hasDocument: { [slotKey]: true },
    }
  }, [clientId])

  useEffect(() => {
    let cancelled = false
    async function loadDraftAndDocuments() {
      try {
        const [draftRes, docs] = await Promise.all([
          fetch(`/api/client-data/${clientId}?section=permitsZoningDraft`),
          loadDocumentsTabUploads(),
        ])
        if (cancelled) return

        let nextUploaded: Record<string, UploadedDoc[]> = {}
        let nextHasDocument: Record<string, boolean> = {}
        const nextPortalSource: Record<string, boolean> = {}
        const statuses = documentStatusesRef.current

        for (const slot of ALL_DOCUMENT_SLOTS) {
          const fromPortal = slotAvailabilityFromPortal(statuses, slot.key)
          if (fromPortal === undefined) continue
          nextHasDocument[slot.key] = fromPortal
          nextPortalSource[slot.key] = true
        }

        if (draftRes.ok) {
          const draft = await draftRes.json()
          if (draft) {
            nextUploaded = draft.uploadedBySlot ?? {}
            const draftHas = (draft.hasDocument ?? {}) as Record<string, boolean>
            for (const [slotKey, value] of Object.entries(draftHas)) {
              if (nextHasDocument[slotKey] === undefined) nextHasDocument[slotKey] = value
            }
            setDraftLoaded(true)
          }
        }

        let importedAny = false
        for (const doc of docs) {
          if (cancelled) return
          try {
            const imported = await importDocIntoSlot(doc, nextUploaded)
            if (!imported) continue
            nextUploaded = imported.uploaded
            nextHasDocument = { ...nextHasDocument, ...imported.hasDocument }
            const slotKey = DOCUMENTS_TAB_TO_SLOT[doc.documentId]
            if (slotKey) nextPortalSource[slotKey] = true
            importedAny = true
          } catch (err) {
            console.warn('Failed to import permits document:', doc.fileName, err)
          }
        }

        if (cancelled) return
        setUploadedBySlot(nextUploaded)
        setHasDocument(nextHasDocument)
        setPortalSourceBySlot(nextPortalSource)
        syncReady(nextUploaded, nextHasDocument)
        if (importedAny) void persistDraft(nextHasDocument, nextUploaded)
      } catch {
        // never block uploader
      }
    }
    void loadDraftAndDocuments()
    return () => { cancelled = true }
  }, [clientId, importDocIntoSlot, loadDocumentsTabUploads, persistDraft, syncReady])

  useEffect(() => {
    if (!documentStatuses) return
    setHasDocument(prev => {
      const next = { ...prev }
      let changed = false
      for (const slot of ALL_DOCUMENT_SLOTS) {
        const fromPortal = slotAvailabilityFromPortal(documentStatuses, slot.key)
        if (fromPortal === undefined) continue
        if (next[slot.key] !== fromPortal) {
          next[slot.key] = fromPortal
          changed = true
        }
      }
      if (changed) onAvailabilityReadyRef.current?.(next)
      return changed ? next : prev
    })
    setPortalSourceBySlot(prev => {
      const next = { ...prev }
      let changed = false
      for (const slot of ALL_DOCUMENT_SLOTS) {
        if (slotAvailabilityFromPortal(documentStatuses, slot.key) === undefined) continue
        if (!next[slot.key]) {
          next[slot.key] = true
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [documentStatuses])

  async function handleUseDocumentsTabUpload(doc: ClientUploadedDoc) {
    setImportingDocId(doc.id)
    try {
      const imported = await importDocIntoSlot(doc, uploadedBySlotRef.current)
      if (!imported) return
      const nextHas = { ...hasDocumentRef.current, ...imported.hasDocument }
      setUploadedBySlot(imported.uploaded)
      setHasDocument(nextHas)
      const slotKey = DOCUMENTS_TAB_TO_SLOT[doc.documentId]
      if (slotKey) {
        setPortalSourceBySlot(prev => ({ ...prev, [slotKey]: true }))
        void syncPortalAvailability(slotKey, true)
      }
      syncReady(imported.uploaded, nextHas)
      void persistDraft(nextHas, imported.uploaded)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to import document')
    } finally {
      setImportingDocId(null)
    }
  }

  async function saveDraft() {
    setSavingDraft(true)
    try {
      const res = await fetch(`/api/client-data/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'permitsZoningDraft',
          data: {
            hasDocument,
            uploadedBySlot,
            savedAt: new Date().toISOString(),
          },
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      setDraftSaved(true)
      setTimeout(() => setDraftSaved(false), 2000)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save draft')
    } finally {
      setSavingDraft(false)
    }
  }

  function handleFiles(slotKey: string, files: FileList | null) {
    if (!files || files.length === 0) return

    const readers = Array.from(files).map(
      file =>
        new Promise<UploadedDoc>(resolve => {
          const reader = new FileReader()
          reader.onload = e => {
            const dataUrl = e.target?.result as string
            const base64 = dataUrl.split(',')[1]
            resolve({
              name: file.name,
              base64,
              mediaType: file.type || 'application/octet-stream',
              slotKey,
              sizeBytes: file.size,
            })
          }
          reader.readAsDataURL(file)
        }),
    )

    Promise.all(readers).then(docs => {
      setUploadedBySlot(prev => {
        const slot = prev[slotKey] ?? []
        const updated = { ...prev, [slotKey]: [...slot, ...docs] }
        const nextHas = { ...hasDocumentRef.current, [slotKey]: true }
        setHasDocument(nextHas)
        syncReady(updated, nextHas)
        void persistDraft(nextHas, updated)
        return updated
      })
      void syncPortalAvailability(slotKey, true)
    })
  }

  function removeFile(slotKey: string, name: string) {
    setUploadedBySlot(prev => {
      const updated = {
        ...prev,
        [slotKey]: (prev[slotKey] ?? []).filter(d => d.name !== name),
      }
      syncReady(updated, hasDocumentRef.current)
      void persistDraft(hasDocumentRef.current, updated)
      return updated
    })
  }

  function toggleHasDocument(slotKey: string, value: boolean) {
    const nextHas = { ...hasDocumentRef.current, [slotKey]: value }
    setHasDocument(nextHas)
    setPortalSourceBySlot(prev => ({ ...prev, [slotKey]: false }))
    onAvailabilityReadyRef.current?.(nextHas)
    void syncPortalAvailability(slotKey, value)

    if (!value) {
      setUploadedBySlot(prev => {
        const updated = { ...prev, [slotKey]: [] }
        syncReady(updated, nextHas)
        void persistDraft(nextHas, updated)
        return updated
      })
    } else {
      void persistDraft(nextHas, uploadedBySlotRef.current)
    }
  }

  return (
    <div className="space-y-5">
      <div className="bg-stone-50 border border-stone-200 rounded-lg px-4 py-3 space-y-2">
        <p className="text-[12px] text-stone-500 leading-relaxed">
          For each document type below, indicate whether the seller has this document available.{' '}
          <span className="font-medium text-stone-700">Select &ldquo;Yes&rdquo; to upload, or &ldquo;No&rdquo; if unavailable.</span>{' '}
          The analysis will run with whatever documents are provided. Missing documents will be noted in the report.
        </p>
        <p className="text-[11px] text-stone-500 leading-relaxed">
          Yes/No answers and files from the client portal Documents checklist are reflected here automatically and used as run context.
        </p>
        {draftLoaded && (
          <p className="text-[11px] font-medium text-emerald-700">
            Draft restored for this client.
          </p>
        )}
      </div>

      {documentsTabUploads.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Uploaded from Documents ({documentsTabUploads.length})
            </p>
            <button
              type="button"
              onClick={() => void loadDocumentsTabUploads()}
              className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-800"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>
          <div className="space-y-2">
            {documentsTabUploads.map(doc => {
              const inQueue = allUploadedDocs.some(item => item.name === doc.fileName)
              const slotKey = DOCUMENTS_TAB_TO_SLOT[doc.documentId]
              const slotLabel = ALL_DOCUMENT_SLOTS.find(slot => slot.key === slotKey)?.label ?? doc.documentId
              return (
                <div
                  key={doc.id}
                  className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${
                    inQueue ? 'border-emerald-300 bg-emerald-50/60' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className={`w-4 h-4 flex-shrink-0 ${inQueue ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{doc.fileName}</p>
                      <p className="text-[11px] text-slate-400">{slotLabel}</p>
                    </div>
                  </div>
                  {inQueue ? (
                    <span className="text-[11px] font-medium text-emerald-700">In queue</span>
                  ) : (
                    <button
                      type="button"
                      disabled={isLoading || importingDocId === doc.id}
                      onClick={() => void handleUseDocumentsTabUpload(doc)}
                      className="text-xs font-medium text-amber-700 hover:text-amber-800 disabled:opacity-50"
                    >
                      {importingDocId === doc.id ? 'Adding…' : 'Add'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {isOverLimits && (
        <div className="flex gap-2 text-[12px] text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <span>Warning:</span>
          <span>Upload limit exceeded. Maximum 15 files and 25MB combined allowed.</span>
        </div>
      )}

      <div className="space-y-2">
        {ALL_DOCUMENT_SLOTS.map(slot => (
          <ToggleUploadSlot
            key={slot.key}
            slot={slot}
            hasDocument={hasDocument[slot.key]}
            files={uploadedBySlot[slot.key] ?? []}
            fromPortal={Boolean(portalSourceBySlot[slot.key])}
            onToggle={(value) => toggleHasDocument(slot.key, value)}
            onFiles={handleFiles}
            onRemove={removeFile}
          />
        ))}
      </div>

      {unavailableSlots.length > 0 && (
        <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <p className="font-medium mb-1">Documents marked as unavailable ({unavailableSlots.length}):</p>
          {unavailableSlots.map(slot => (
            <p key={slot.key} className="text-amber-700">&bull; {slot.label} — will be noted as not provided in the report</p>
          ))}
        </div>
      )}

      <div className="pt-2 flex items-center justify-between gap-3 border-t border-stone-100">
        <p className={`text-[11px] ${isOverLimits ? 'text-red-500 font-medium' : 'text-stone-400'}`}>
          {totalFileCount} file{totalFileCount !== 1 ? 's' : ''} ({(totalSizeBytes / 1024 / 1024).toFixed(1)} MB)
          {totalFileCount > 0 && ` · Max 15 files / 25 MB`}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={saveDraft}
            disabled={!hasDraftInput || isLoading || savingDraft}
            className={`relative inline-flex items-center gap-1.5 text-[12px] px-4 py-2 rounded-lg font-medium border transition-all ${
              hasDraftInput && !isLoading && !savingDraft
                ? 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                : 'bg-stone-50 text-stone-300 border-stone-100 cursor-not-allowed'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            {savingDraft ? 'Saving...' : 'Save Draft'}
            {draftSaved && (
              <span className="absolute -top-2 -right-2 text-[9px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-medium animate-pulse">
                Saved
              </span>
            )}
          </button>
          <button
            onClick={onAnalyze}
            disabled={!canRun || isLoading}
            className={`text-[12px] px-4 py-2 rounded-lg font-medium transition-all ${
              canRun && !isLoading
                ? 'bg-stone-900 text-white hover:bg-stone-800'
                : 'bg-stone-100 text-stone-400 cursor-not-allowed'
            }`}
          >
            {isLoading ? 'Running Analysis...' : 'Run Analysis ->'}
          </button>
        </div>
      </div>

      {allSlotsAnswered && allSlotsUnavailable && canRun ? (
        <p className="text-[11px] text-stone-400 text-right -mt-3">
          All documents marked No — run analysis to record that nothing was provided.
        </p>
      ) : !canRun ? (
        <p className="text-[11px] text-stone-400 text-right -mt-3">
          Upload at least one document, or mark every item Yes/No, to run the analysis
        </p>
      ) : null}
    </div>
  )
}

function ToggleUploadSlot({
  slot,
  hasDocument,
  files,
  fromPortal,
  onToggle,
  onFiles,
  onRemove,
}: {
  slot: (typeof ALL_DOCUMENT_SLOTS)[number]
  hasDocument: boolean | undefined
  files: UploadedDoc[]
  fromPortal?: boolean
  onToggle: (value: boolean) => void
  onFiles: (key: string, files: FileList | null) => void
  onRemove: (key: string, name: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const borderColor = hasDocument === false
    ? 'border-stone-100 bg-stone-50/50'
    : files.length > 0
      ? 'border-green-200 bg-green-50'
      : 'border-stone-200 bg-white'

  return (
    <div className={`border rounded-lg px-3 py-2.5 transition-colors ${borderColor}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-[12px] font-medium ${hasDocument === false ? 'text-stone-400' : 'text-stone-800'}`}>{slot.label}</p>
            {fromPortal && hasDocument !== undefined && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                Portal: {hasDocument ? 'Yes' : 'No'}
              </span>
            )}
          </div>
          <p className="text-[11px] text-stone-400 leading-snug mt-0.5">{slot.note}</p>
          {files.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {files.map((f: UploadedDoc) => (
                <span
                  key={f.name}
                  className="inline-flex items-center gap-1 text-[11px] bg-white border border-stone-200 text-stone-600 px-2 py-0.5 rounded-full"
                >
                  {f.name.length > 28 ? f.name.slice(0, 28) + '...' : f.name}
                  <button
                    onClick={() => onRemove(slot.key, f.name)}
                    className="text-stone-400 hover:text-red-500 transition-colors"
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center rounded-lg border border-stone-200 overflow-hidden">
            <button
              type="button"
              onClick={() => onToggle(true)}
              className={`text-[10px] font-medium px-2.5 py-1.5 transition-colors ${
                hasDocument === true || files.length > 0
                  ? 'bg-green-100 text-green-700'
                  : 'text-stone-400 hover:bg-stone-50'
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => onToggle(false)}
              className={`text-[10px] font-medium px-2.5 py-1.5 transition-colors ${
                hasDocument === false
                  ? 'bg-stone-200 text-stone-600'
                  : 'text-stone-400 hover:bg-stone-50'
              }`}
            >
              No
            </button>
          </div>
          {hasDocument !== false && (
            <>
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                multiple={slot.multi}
                accept=".pdf,.docx,.xlsx,.png"
                onChange={e => onFiles(slot.key, e.target.files)}
              />
              <button
                type="button"
                className="text-[11px] px-2.5 py-1.5 rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50 transition-colors"
                onClick={() => inputRef.current?.click()}
              >
                {files.length > 0 ? '+ Add more' : 'Upload'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
