'use client'
// WS1-8 Corporate Ownership Verification — Upload Screen
// 9 document slots for corporate/ownership documents

import { useEffect, useRef, useState } from 'react'
import { Save } from 'lucide-react'
import type { UploadedDoc } from '@/hooks/useWS18Analysis'

// All document slots — each is optional (yes/no toggle). Agent runs with whatever is available.
const ALL_DOCUMENT_SLOTS = [
  {
    key: 'articles_of_org',
    label: 'Articles of Organization / Incorporation',
    note: 'Formation documents filed with the state. Include any certificates of formation or incorporation.',
    multi: true,
  },
  {
    key: 'operating_agreement',
    label: 'Operating Agreement / Bylaws',
    note: 'Current operating agreement (LLC) or bylaws (Corporation). Include any restated versions.',
    multi: false,
  },
  {
    key: 'amendments',
    label: 'Amendments to Organizational Documents',
    note: 'Any amendments to articles, operating agreement, or bylaws. Upload each amendment separately.',
    multi: true,
  },
  {
    key: 'ownership_certificates',
    label: 'Ownership / Membership Certificates',
    note: 'Membership certificates, stock certificates, or cap table showing current ownership.',
    multi: true,
  },
  {
    key: 'ucc_search',
    label: 'UCC Search Results',
    note: 'UCC-1 filing search results from the state of formation and any operating states.',
    multi: true,
  },
  {
    key: 'good_standing',
    label: 'Good Standing Certificate',
    note: 'Certificate of good standing or certificate of existence from the state of formation.',
    multi: true,
  },
  {
    key: 'annual_reports',
    label: 'Annual Reports / Franchise Tax Filings',
    note: 'Most recent annual report or franchise tax filing for each state of registration.',
    multi: true,
  },
  {
    key: 'foreign_qualifications',
    label: 'Foreign Qualification Certificates',
    note: 'Certificates of authority or foreign qualification for states other than the state of formation.',
    multi: true,
  },
  {
    key: 'title_lien_search',
    label: 'Title / Lien Search Results',
    note: 'Any title search, lien search, or judgment search results. Includes tax lien certificates.',
    multi: true,
  },
] as const

type SlotKey = typeof ALL_DOCUMENT_SLOTS[number]['key']

interface Props {
  clientId: string
  onDocumentsReady: (docs: UploadedDoc[]) => void
  onAnalyze: () => void
  isLoading: boolean
}

export default function WS18Uploader({ clientId, onDocumentsReady, onAnalyze, isLoading }: Props) {
  const [uploadedBySlot, setUploadedBySlot] = useState<Record<string, UploadedDoc[]>>({})
  const [hasDocument, setHasDocument] = useState<Record<string, boolean>>({})
  const [savingDraft, setSavingDraft] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)
  const [draftLoaded, setDraftLoaded] = useState(false)

  const allUploadedDocs = Object.values(uploadedBySlot).flat()
  const totalFileCount = allUploadedDocs.length
  const totalSizeBytes = allUploadedDocs.reduce((acc, doc) => acc + (doc.base64.length * 3) / 4, 0)
  const isOverLimits = totalFileCount > 15 || totalSizeBytes > 25 * 1024 * 1024

  // At least one document must be uploaded to run
  const hasAnyDocs = totalFileCount > 0
  const hasDraftInput = totalFileCount > 0 || Object.keys(hasDocument).length > 0

  // Count how many slots are marked "No"
  const unavailableSlots = ALL_DOCUMENT_SLOTS.filter(
    slot => hasDocument[slot.key] === false
  )

  useEffect(() => {
    let cancelled = false
    async function loadDraft() {
      try {
        const res = await fetch(`/api/client-data/${clientId}?section=ownershipVerificationDraft`)
        if (!res.ok) return
        const draft = await res.json()
        if (cancelled || !draft) return
        const nextUploaded = draft.uploadedBySlot ?? {}
        const nextHasDocument = draft.hasDocument ?? {}
        setUploadedBySlot(nextUploaded)
        setHasDocument(nextHasDocument)
        onDocumentsReady(Object.values(nextUploaded).flat() as UploadedDoc[])
        setDraftLoaded(true)
      } catch {
        // Draft restore should never block the uploader.
      }
    }
    void loadDraft()
    return () => { cancelled = true }
  }, [clientId, onDocumentsReady])

  async function saveDraft() {
    setSavingDraft(true)
    try {
      const res = await fetch(`/api/client-data/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'ownershipVerificationDraft',
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
        })
    )

    Promise.all(readers).then(docs => {
      setUploadedBySlot(prev => {
        const slot = prev[slotKey] ?? []
        const updated = { ...prev, [slotKey]: [...slot, ...docs] }
        onDocumentsReady(Object.values(updated).flat())
        return updated
      })
      // Auto-set to "yes" when files are uploaded
      setHasDocument(prev => ({ ...prev, [slotKey]: true }))
    })
  }

  function removeFile(slotKey: string, name: string) {
    setUploadedBySlot(prev => {
      const updated = {
        ...prev,
        [slotKey]: (prev[slotKey] ?? []).filter(d => d.name !== name),
      }
      onDocumentsReady(Object.values(updated).flat())
      return updated
    })
  }

  function toggleHasDocument(slotKey: string, value: boolean) {
    setHasDocument(prev => ({ ...prev, [slotKey]: value }))
    if (!value) {
      // Clear uploaded files for this slot if marked "No"
      setUploadedBySlot(prev => {
        const updated = { ...prev, [slotKey]: [] }
        onDocumentsReady(Object.values(updated).flat())
        return updated
      })
    }
  }

  return (
    <div className="space-y-5">
      <div className="bg-stone-50 border border-stone-200 rounded-lg px-4 py-3">
        <p className="text-[12px] text-stone-500 leading-relaxed">
          For each document type below, indicate whether the seller has this document available.{' '}
          <span className="font-medium text-stone-700">Select &ldquo;Yes&rdquo; to upload, or &ldquo;No&rdquo; if unavailable.</span>{' '}
          The analysis will run with whatever documents are provided. Missing documents will be noted in the report.
        </p>
        {draftLoaded && (
          <p className="mt-2 text-[11px] font-medium text-emerald-700">
            Draft restored for this client.
          </p>
        )}
      </div>

      {isOverLimits && (
        <div className="flex gap-2 text-[12px] text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <span>Warning:</span>
          <span>Upload limit exceeded. Maximum 15 files and 25MB combined allowed.</span>
        </div>
      )}

      <div className="space-y-2">
        {ALL_DOCUMENT_SLOTS.map(slot => {
          const hasIt = hasDocument[slot.key]
          const files = uploadedBySlot[slot.key] ?? []

          return (
            <ToggleUploadSlot
              key={slot.key}
              slot={slot}
              hasDocument={hasIt}
              files={files}
              onToggle={(value) => toggleHasDocument(slot.key, value)}
              onFiles={handleFiles}
              onRemove={removeFile}
            />
          )
        })}
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
            disabled={!hasAnyDocs || isLoading || isOverLimits}
            className={`text-[12px] px-4 py-2 rounded-lg font-medium transition-all ${
              hasAnyDocs && !isLoading && !isOverLimits
                ? 'bg-stone-900 text-white hover:bg-stone-800'
                : 'bg-stone-100 text-stone-400 cursor-not-allowed'
            }`}
          >
            {isLoading ? 'Running Analysis...' : 'Run Analysis ->'}
          </button>
        </div>
      </div>

      {!hasAnyDocs && (
        <p className="text-[11px] text-stone-400 text-right -mt-3">
          Upload at least one document to run the analysis
        </p>
      )}
    </div>
  )
}

// --- Sub-components ---

function ToggleUploadSlot({
  slot,
  hasDocument,
  files,
  onToggle,
  onFiles,
  onRemove,
}: {
  slot: any
  hasDocument: boolean | undefined
  files: UploadedDoc[]
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
          <div className="flex items-center gap-2">
            <p className={`text-[12px] font-medium ${hasDocument === false ? 'text-stone-400' : 'text-stone-800'}`}>{slot.label}</p>
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
          {/* Yes/No toggle */}
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
          {/* Upload button — only shown if "Yes" or undecided */}
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
