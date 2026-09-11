'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Play,
  RefreshCw,
  Save,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui'
import type { UploadedDoc } from '@/hooks/useWS19Analysis'
import type { DocumentStatus } from '@/lib/store'
import {
  fetchClientDocumentAsBase64,
  listClientDocuments,
  type ClientUploadedDoc,
} from '@/lib/client-documents-client'

export interface PermitsDocumentSlotDef {
  key: string
  documentIds: string[]
  label: string
  note: string
  multi: boolean
  accept?: string
}

export const ALL_DOCUMENT_SLOTS: PermitsDocumentSlotDef[] = [
  {
    key: 'business_license',
    documentIds: ['business_licenses'],
    label: 'Business License',
    note: 'Current business license or registration certificate from the city/county.',
    multi: true,
    accept: '.pdf,.docx,.doc',
  },
  {
    key: 'kennel_license',
    documentIds: ['kennel_license'],
    label: 'Kennel License',
    note: 'Kennel or animal facility license required for pet boarding operations.',
    multi: false,
    accept: '.pdf,.docx,.doc',
  },
  {
    key: 'health_permit',
    documentIds: ['health_permit'],
    label: 'Health Permit',
    note: 'Health department permit or inspection certificate for animal care facilities.',
    multi: false,
    accept: '.pdf,.docx,.doc',
  },
  {
    key: 'fire_permit',
    documentIds: ['fire_permit'],
    label: 'Fire Permit',
    note: 'Fire department permit, inspection certificate, or occupancy load documentation.',
    multi: false,
    accept: '.pdf,.docx,.doc',
  },
  {
    key: 'zoning_verification',
    documentIds: ['zoning_approval', 'certificate_occupancy'],
    label: 'Zoning Verification / Certificate of Occupancy',
    note: 'Zoning verification letter, certificate of occupancy, or zoning compliance letter from the municipality.',
    multi: true,
    accept: '.pdf,.docx,.doc',
  },
  {
    key: 'conditional_use_permit',
    documentIds: ['conditional_use_permit'],
    label: 'Conditional Use Permit',
    note: 'CUP, special use permit, or special exception documentation including all conditions of approval.',
    multi: true,
    accept: '.pdf,.docx,.doc',
  },
  {
    key: 'signage_permit',
    documentIds: ['signage_permit'],
    label: 'Signage Permit',
    note: 'Any signage permits or approvals for the property.',
    multi: true,
    accept: '.pdf,.docx,.doc',
  },
  {
    key: 'building_permits',
    documentIds: ['building_permits'],
    label: 'Building Permits',
    note: 'Building permits for any facility modifications, renovations, or additions.',
    multi: true,
    accept: '.pdf,.docx,.doc',
  },
  {
    key: 'environmental_permits',
    documentIds: ['environmental_permits'],
    label: 'Environmental Permits',
    note: 'Environmental permits related to waste disposal, water runoff, or other environmental compliance.',
    multi: true,
    accept: '.pdf,.docx,.doc',
  },
  {
    key: 'variance_approvals',
    documentIds: ['variance_approvals'],
    label: 'Variance Approvals',
    note: 'Any variance approvals, zoning board decisions, or appeals documentation.',
    multi: true,
    accept: '.pdf,.docx,.doc',
  },
]

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

const PERMITS_DOCUMENT_IDS = Object.keys(DOCUMENTS_TAB_TO_SLOT)

interface Props {
  clientId: string
  documentStatuses?: Record<string, DocumentStatus>
  onDocumentsReady: (docs: UploadedDoc[]) => void
  onAvailabilityReady?: (hasDocument: Record<string, boolean>) => void
  onAnalyze: (docs: UploadedDoc[], options?: { allDocumentsUnavailable?: boolean }) => void | Promise<void>
  isLoading: boolean
  onCancel?: () => void
  readOnly?: boolean
}

export default function WS19Uploader({
  clientId,
  documentStatuses,
  onDocumentsReady,
  onAvailabilityReady,
  onAnalyze,
  isLoading,
  onCancel,
  readOnly = false,
}: Props) {
  const [uploadedBySlot, setUploadedBySlot] = useState<Record<string, UploadedDoc[]>>({})
  const [savingDraft, setSavingDraft] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)
  const [draftLoaded, setDraftLoaded] = useState(false)
  const [documentsTabUploads, setDocumentsTabUploads] = useState<ClientUploadedDoc[]>([])
  const [loadingPortalDocs, setLoadingPortalDocs] = useState(false)
  const [preparingAnalyze, setPreparingAnalyze] = useState(false)

  const uploadedBySlotRef = useRef(uploadedBySlot)
  uploadedBySlotRef.current = uploadedBySlot
  const documentsTabUploadsRef = useRef(documentsTabUploads)
  documentsTabUploadsRef.current = documentsTabUploads
  const onDocumentsReadyRef = useRef(onDocumentsReady)
  onDocumentsReadyRef.current = onDocumentsReady

  const syncReady = useCallback((nextUploaded: Record<string, UploadedDoc[]>) => {
    const flatDocs = Object.values(nextUploaded).flat()
    onDocumentsReadyRef.current(flatDocs)
  }, [])

  const persistDraft = useCallback(
    async (nextUploaded: Record<string, UploadedDoc[]>) => {
      try {
        await fetch(`/api/client-data/${clientId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            section: 'permitsZoningDraft',
            data: {
              uploadedBySlot: nextUploaded,
              savedAt: new Date().toISOString(),
            },
          }),
        })
      } catch {
        // Draft persistence is best-effort.
      }
    },
    [clientId],
  )

  const loadDocumentsTabUploads = useCallback(async () => {
    setLoadingPortalDocs(true)
    try {
      const docs = await listClientDocuments(clientId, PERMITS_DOCUMENT_IDS)
      setDocumentsTabUploads(docs)
      return docs
    } catch {
      return [] as ClientUploadedDoc[]
    } finally {
      setLoadingPortalDocs(false)
    }
  }, [clientId])

  // Load draft and portal documents once per client
  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const [draftRes, docs] = await Promise.all([
          fetch(`/api/client-data/${clientId}?section=permitsZoningDraft`),
          loadDocumentsTabUploads(),
        ])
        if (cancelled) return

        let nextUploaded: Record<string, UploadedDoc[]> = {}
        if (draftRes.ok) {
          const draft = await draftRes.json()
          if (draft?.uploadedBySlot) {
            nextUploaded = draft.uploadedBySlot
            setDraftLoaded(true)
          }
        }

        if (cancelled) return
        setUploadedBySlot(nextUploaded)
        syncReady(nextUploaded)
      } catch {
        // Best-effort
      }
    }
    void init()
    return () => {
      cancelled = true
    }
  }, [clientId, loadDocumentsTabUploads, syncReady])

  // Calculate file counts & limits
  const allLocalDocs = useMemo(() => Object.values(uploadedBySlot).flat(), [uploadedBySlot])
  const localFileCount = allLocalDocs.length
  const localSizeBytes = allLocalDocs.reduce((acc, doc) => acc + (doc.base64.length * 3) / 4, 0)

  // Determine readiness for each slot
  const slotReadinessMap = useMemo(() => {
    const map: Record<
      string,
      {
        hasFiles: boolean
        isUnavailable: boolean
        portalDocs: ClientUploadedDoc[]
        localDocs: UploadedDoc[]
        portalStatus?: DocumentStatus
        primaryDocumentId: string
      }
    > = {}

    for (const slot of ALL_DOCUMENT_SLOTS) {
      const portalDocs = documentsTabUploads.filter(d => slot.documentIds.includes(d.documentId))
      const localDocs = uploadedBySlot[slot.key] ?? []

      // Check portal status across mapped documentIds
      let hasStatusFile = false
      let allUnavailable = slot.documentIds.length > 0
      let matchedStatus: DocumentStatus | undefined

      for (const docId of slot.documentIds) {
        const s = documentStatuses?.[docId]
        if (s) {
          matchedStatus = s
          if (s.fileName && String(s.fileName).trim()) hasStatusFile = true
          if (s.hasDoc === true) hasStatusFile = true
          if (s.hasDoc !== false && !s.notApplicable) allUnavailable = false
        } else {
          allUnavailable = false
        }
      }

      const hasFiles = localDocs.length > 0 || portalDocs.length > 0 || hasStatusFile
      const isUnavailable = !hasFiles && allUnavailable

      map[slot.key] = {
        hasFiles,
        isUnavailable,
        portalDocs,
        localDocs,
        portalStatus: matchedStatus,
        primaryDocumentId: slot.documentIds[0] || slot.key,
      }
    }

    return map
  }, [documentsTabUploads, uploadedBySlot, documentStatuses])

  const satisfiedCount = useMemo(
    () => ALL_DOCUMENT_SLOTS.filter(slot => slotReadinessMap[slot.key]?.hasFiles).length,
    [slotReadinessMap],
  )

  const isOverLimits = localFileCount > 25 || localSizeBytes > 35 * 1024 * 1024
  const busy = isLoading || preparingAnalyze
  const hasDraftInput = localFileCount > 0
  const canAnalyze = !isOverLimits

  async function importDocIntoSlot(
    doc: ClientUploadedDoc,
    current: Record<string, UploadedDoc[]>,
  ): Promise<{ uploaded: Record<string, UploadedDoc[]> } | null> {
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
    }
  }

  async function ensurePortalDocsImported(): Promise<Record<string, UploadedDoc[]>> {
    let nextUploaded = { ...uploadedBySlotRef.current }
    let changed = false
    for (const doc of documentsTabUploadsRef.current) {
      try {
        const imported = await importDocIntoSlot(doc, nextUploaded)
        if (!imported) continue
        nextUploaded = imported.uploaded
        changed = true
      } catch (err) {
        console.warn('Failed to import Permits document for analysis:', doc.fileName, err)
      }
    }
    if (changed) {
      setUploadedBySlot(nextUploaded)
      syncReady(nextUploaded)
      void persistDraft(nextUploaded)
    } else {
      syncReady(nextUploaded)
    }
    return nextUploaded
  }

  async function handleAnalyze() {
    if (isLoading || preparingAnalyze) return
    setPreparingAnalyze(true)
    try {
      const nextUploaded = await ensurePortalDocsImported()
      const flatDocs = Object.values(nextUploaded).flat()
      await onAnalyze(flatDocs, { allDocumentsUnavailable: flatDocs.length === 0 })
    } finally {
      setPreparingAnalyze(false)
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
            uploadedBySlot,
            savedAt: new Date().toISOString(),
          },
        }),
      })
      if (res.ok) {
        setDraftSaved(true)
        setTimeout(() => setDraftSaved(false), 3000)
      }
    } catch {
      // best-effort
    } finally {
      setSavingDraft(false)
    }
  }

  function handleFiles(slotKey: string, files: FileList | null) {
    if (!files || files.length === 0) return
    const fileList = Array.from(files)
    const slot = ALL_DOCUMENT_SLOTS.find(item => item.key === slotKey)

    fileList.forEach(file => {
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1] || ''
        const mediaType = file.type || 'application/pdf'
        const doc: UploadedDoc = {
          name: file.name,
          base64,
          mediaType,
          slotKey,
          sizeBytes: file.size,
        }

        setUploadedBySlot(prev => {
          const existing = prev[slotKey] ?? []
          const nextSlotDocs = slot?.multi
            ? [...existing.filter(d => d.name !== file.name), doc]
            : [doc]
          const updated = { ...prev, [slotKey]: nextSlotDocs }
          syncReady(updated)
          void persistDraft(updated)
          return updated
        })
      }
      reader.readAsDataURL(file)
    })
  }

  function removeFile(slotKey: string, name: string) {
    setUploadedBySlot(prev => {
      const updated = {
        ...prev,
        [slotKey]: (prev[slotKey] ?? []).filter(d => d.name !== name),
      }
      syncReady(updated)
      void persistDraft(updated)
      return updated
    })
  }

  return (
    <div className="space-y-6">
      {/* Sector Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Optional Business Permits & Zoning Documents
            </h4>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {satisfiedCount} of {ALL_DOCUMENT_SLOTS.length} uploaded
            </span>
          </div>
          <button
            type="button"
            onClick={() => void loadDocumentsTabUploads()}
            disabled={loadingPortalDocs}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${loadingPortalDocs ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <p className="text-xs text-slate-500">
          All permits and zoning documents are optional. The analysis will run with whatever documents are provided, and any missing items will be noted in the report.
        </p>

        {draftLoaded && (
          <p className="text-[11px] font-medium text-emerald-700">
            Draft restored for this client.
          </p>
        )}
      </div>

      {isOverLimits && (
        <div className="flex gap-2 text-[12px] text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          <span>⚠</span>
          <span>Upload limit exceeded. Maximum 25 files and 35MB combined allowed.</span>
        </div>
      )}

      {/* Document card list */}
      <div className="space-y-2.5">
        {ALL_DOCUMENT_SLOTS.map(slot => {
          const readiness = slotReadinessMap[slot.key] ?? {
            hasFiles: false,
            isUnavailable: false,
            portalDocs: [],
            localDocs: [],
            primaryDocumentId: slot.documentIds[0] || slot.key,
          }
          return (
            <PermitDocRow
              key={slot.key}
              slot={slot}
              clientId={clientId}
              portalDocs={readiness.portalDocs}
              localDocs={readiness.localDocs}
              portalStatus={readiness.portalStatus}
              primaryDocumentId={readiness.primaryDocumentId}
              onFiles={handleFiles}
              onRemove={removeFile}
              readOnly={readOnly}
            />
          )
        })}
      </div>

      {/* Bottom Readiness & Action Footer */}
      <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-xs">
          {satisfiedCount > 0 ? (
            <span className="text-emerald-700 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              {satisfiedCount} document{satisfiedCount > 1 ? 's' : ''} ready. You can start the analysis.
            </span>
          ) : (
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
              No documents uploaded. Analysis can run to note all documents as unavailable.
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onCancel && (
            <Button variant="outline" size="sm" onClick={onCancel} className="h-8 text-xs cursor-pointer">
              Cancel
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void saveDraft()}
            disabled={!hasDraftInput || busy || savingDraft}
            className="gap-1.5 h-8 text-xs relative cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            {savingDraft ? 'Saving…' : 'Save Draft'}
            {draftSaved && (
              <span className="absolute -top-2 -right-2 text-[9px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-medium animate-pulse">
                Saved
              </span>
            )}
          </Button>
          <Button
            size="sm"
            onClick={() => void handleAnalyze()}
            disabled={!canAnalyze || busy}
            className="gap-1.5 h-8 text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
          >
            {busy ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {preparingAnalyze ? 'Preparing files…' : 'Analyzing…'}
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                Run Permits & Zoning Analysis
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

function PermitDocRow({
  slot,
  clientId,
  portalDocs,
  localDocs,
  portalStatus,
  primaryDocumentId,
  onFiles,
  onRemove,
  readOnly,
}: {
  slot: PermitsDocumentSlotDef
  clientId: string
  portalDocs: ClientUploadedDoc[]
  localDocs: UploadedDoc[]
  portalStatus?: DocumentStatus
  primaryDocumentId: string
  onFiles: (slotKey: string, files: FileList | null) => void
  onRemove: (slotKey: string, name: string) => void
  readOnly?: boolean
}) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const hasFiles = localDocs.length > 0 || portalDocs.length > 0 || Boolean(portalStatus?.fileName)
  const isUnavailable = !hasFiles && (portalStatus?.hasDoc === false || Boolean(portalStatus?.notApplicable))

  return (
    <div
      onDragOver={(e) => {
        if (readOnly) return
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        if (readOnly) return
        e.preventDefault()
        setIsDragging(false)
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          onFiles(slot.key, e.dataTransfer.files)
        }
      }}
      className={`rounded-xl border p-4 transition-all shadow-2xs ${
        isDragging
          ? 'border-indigo-400 bg-indigo-50/50 ring-2 ring-indigo-400/20'
          : hasFiles
          ? 'border-emerald-200 bg-emerald-50/40'
          : isUnavailable
          ? 'border-amber-200 bg-amber-50/40'
          : 'border-slate-200/80 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                hasFiles
                  ? 'bg-emerald-50 text-emerald-600'
                  : isUnavailable
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              <FileText className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-slate-800">{slot.label}</p>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                  Optional
                </span>
                {hasFiles ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Uploaded
                  </span>
                ) : isUnavailable ? (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                    Not available with client
                  </span>
                ) : (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-50 text-slate-400 border border-slate-200">
                    Not provided
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{slot.note}</p>

              {/* Uploaded files display */}
              {hasFiles && (
                <div className="flex flex-wrap gap-2 mt-2.5">
                  {/* Portal docs */}
                  {portalDocs.map((pDoc, idx) => (
                    <a
                      key={pDoc.id || idx}
                      href={`/api/client-documents/view?clientId=${encodeURIComponent(clientId)}&documentId=${encodeURIComponent(pDoc.documentId || primaryDocumentId)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-emerald-200 text-emerald-900 shadow-2xs hover:bg-emerald-50 transition-colors cursor-pointer"
                      title="Click to view file"
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate max-w-[240px]">{pDoc.fileName}</span>
                      {pDoc.uploadedAt && (
                        <span className="text-[10px] text-slate-400 font-normal">
                          · {new Date(pDoc.uploadedAt).toLocaleDateString()}
                        </span>
                      )}
                    </a>
                  ))}

                  {/* Local docs */}
                  {localDocs.map(lDoc => (
                    <span
                      key={lDoc.name}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-emerald-200 text-emerald-900 shadow-2xs"
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate max-w-[240px]">{lDoc.name}</span>
                      {lDoc.sizeBytes && (
                        <span className="text-[10px] text-slate-400 font-normal">
                          · {(lDoc.sizeBytes / 1024).toFixed(0)} KB
                        </span>
                      )}
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => onRemove(slot.key, lDoc.name)}
                          className="text-slate-400 hover:text-rose-600 transition-colors ml-0.5 cursor-pointer"
                          title="Remove file"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}

                  {/* Legacy single file name from status if not in portalDocs or localDocs */}
                  {!portalDocs.length && !localDocs.length && portalStatus?.fileName && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-emerald-200 text-emerald-900 shadow-2xs">
                      <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate max-w-[240px]">{portalStatus.fileName}</span>
                    </span>
                  )}
                </div>
              )}

              {/* Status explanation note if not uploaded */}
              {!hasFiles && (
                <div className="mt-2 text-[11px] flex items-center gap-1.5">
                  {isUnavailable ? (
                    <span className="text-amber-700 font-medium flex items-center gap-1">
                      Marked as not available with client in portal
                    </span>
                  ) : (
                    <span className="text-slate-400 font-normal">
                      Not provided yet (optional — analysis can run without this)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Upload Button action */}
        {!readOnly && (
          <div className="shrink-0 pt-0.5">
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              multiple={slot.multi}
              accept={slot.accept || '.pdf,.docx,.doc'}
              onChange={e => {
                onFiles(slot.key, e.target.files)
                e.target.value = ''
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              className="gap-1.5 h-8 text-xs font-medium cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              {hasFiles ? (slot.multi ? '+ Add more' : 'Replace') : 'Upload'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
