'use client'
// Architecture spec — Portal UI / UX Specification: Upload Screen
// Section Label: "Employee Obligations Documents"
// Validation: blocks "Run Analysis" until slots 1 and 3 are filled; slots 2 and 4 show inline warnings if missing

import { useRef, useState } from 'react'
import type { UploadedDoc } from '@/hooks/useWS16Analysis'

// All document slots — each is optional (yes/no toggle). Agent runs with whatever is available.
const ALL_DOCUMENT_SLOTS = [
  {
    key: 'employment_agreements',
    label: 'Employment Agreements',
    note: 'Upload one file per agreement, or a single merged PDF. Include any amendments or addenda.',
    multi: true,
  },
  {
    key: 'non_compete',
    label: 'Non-Compete / Non-Solicitation Agreements',
    note: 'Skip if embedded in employment agreements above.',
    multi: true,
  },
  {
    key: 'handbook',
    label: 'Employee Handbook',
    note: 'Most current version. Used for benefit policy, PTO, and disciplinary procedures analysis.',
    multi: false,
  },
  {
    key: 'benefits_summary',
    label: 'Benefits Summary',
    note: 'Current benefit enrollment guide, plan summary, or broker-provided benefit summary.',
    multi: false,
  },
  {
    key: 'contractor_agreements',
    label: 'Independent Contractor Agreements (1099)',
    note: 'Any active contractor or freelance arrangements. Triggers IC misclassification risk analysis.',
    multi: true,
  },
  {
    key: 'offer_letters',
    label: 'Offer Letters',
    note: 'Especially for management-level employees hired without a formal employment agreement.',
    multi: true,
  },
  {
    key: 'severance_agreements',
    label: 'Severance / Separation Agreements',
    note: 'Any active or recent (last 24 months) agreements. Flags contingent liabilities.',
    multi: true,
  },
  {
    key: 'retirement_plan_docs',
    label: 'Retirement Plan Documents',
    note: '401(k) plan summary, SIMPLE IRA, SEP-IRA, or any other employer-sponsored retirement arrangement.',
    multi: true,
  },
  {
    key: 'pto_ledger',
    label: 'PTO Accrual Ledger or Balance Report',
    note: 'Current PTO balances owed to all employees. Enables accrued PTO liability quantification — feeds WS2 labor analysis.',
    multi: false,
  },
  {
    key: 'workers_comp_claims',
    label: "Workers' Compensation Claims",
    note: 'Any workers compensation claims filed in the last 24 months.',
    multi: true,
  },
] as const

type SlotKey = typeof ALL_DOCUMENT_SLOTS[number]['key']

interface Props {
  onDocumentsReady: (docs: UploadedDoc[]) => void
  onAnalyze: () => void
  isLoading: boolean
}

export default function WS16Uploader({ onDocumentsReady, onAnalyze, isLoading }: Props) {
  const [uploadedBySlot, setUploadedBySlot] = useState<Record<string, UploadedDoc[]>>({})
  const [hasDocument, setHasDocument] = useState<Record<string, boolean>>({})

  const allUploadedDocs = Object.values(uploadedBySlot).flat()
  const totalFileCount = allUploadedDocs.length
  const totalSizeBytes = allUploadedDocs.reduce((acc, doc) => acc + (doc.base64.length * 3) / 4, 0)
  const isOverLimits = totalFileCount > 15 || totalSizeBytes > 25 * 1024 * 1024

  // At least one document must be uploaded to run
  const hasAnyDocs = totalFileCount > 0

  // Count how many slots are marked "No"
  const unavailableSlots = ALL_DOCUMENT_SLOTS.filter(
    slot => hasDocument[slot.key] === false
  )

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
      </div>

      {isOverLimits && (
        <div className="flex gap-2 text-[12px] text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <span>⚠</span>
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
            <p key={slot.key} className="text-amber-700">• {slot.label} — will be noted as not provided in the report</p>
          ))}
        </div>
      )}

      <div className="pt-2 flex items-center justify-between border-t border-stone-100">
        <p className={`text-[11px] ${isOverLimits ? 'text-red-500 font-medium' : 'text-stone-400'}`}>
          {totalFileCount} file{totalFileCount !== 1 ? 's' : ''} ({(totalSizeBytes / 1024 / 1024).toFixed(1)} MB)
          {totalFileCount > 0 && ` · Max 15 files / 25 MB`}
        </p>
        <button
          onClick={onAnalyze}
          disabled={!hasAnyDocs || isLoading || isOverLimits}
          className={`text-[12px] px-4 py-2 rounded-lg font-medium transition-all ${
            hasAnyDocs && !isLoading && !isOverLimits
              ? 'bg-stone-900 text-white hover:bg-stone-800'
              : 'bg-stone-100 text-stone-400 cursor-not-allowed'
          }`}
        >
          {isLoading ? 'Running Analysis…' : 'Run Analysis →'}
        </button>
      </div>

      {!hasAnyDocs && (
        <p className="text-[11px] text-stone-400 text-right -mt-3">
          Upload at least one document to run the analysis
        </p>
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

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
                  {f.name.length > 28 ? f.name.slice(0, 28) + '…' : f.name}
                  <button
                    onClick={() => onRemove(slot.key, f.name)}
                    className="text-stone-400 hover:text-red-500 transition-colors"
                  >
                    ×
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
