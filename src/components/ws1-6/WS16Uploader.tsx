'use client'
// Architecture spec — Portal UI / UX Specification: Upload Screen
// Section Label: "Employee Obligations Documents"
// Validation: blocks "Run Analysis" until slots 1 and 3 are filled; slots 2 and 4 show inline warnings if missing

import { useRef, useState } from 'react'
import type { UploadedDoc } from '@/hooks/useWS16Analysis'

// Architecture spec: Required (slots 1–4), Strongly Recommended (5–10), Optional (11–13)
const UPLOAD_SLOTS = [
  // Required
  {
    key: 'employment_agreements',
    label: 'Employment Agreements',
    note: 'Upload one file per agreement, or a single merged PDF. Include any amendments or addenda.',
    required: true,
    multi: true,
  },
  {
    key: 'non_compete',
    label: 'Non-Compete / Non-Solicitation Agreements',
    note: 'Skip if embedded in employment agreements above.',
    required: true,
    multi: true,
  },
  {
    key: 'handbook',
    label: 'Employee Handbook',
    note: 'Most current version. Required for benefit policy, PTO, and disciplinary procedures analysis.',
    required: true,
    multi: false,
  },
  {
    key: 'benefits_summary',
    label: 'Benefits Summary',
    note: 'Current benefit enrollment guide, plan summary, or broker-provided benefit summary.',
    required: true,
    multi: false,
  },
] as const

const RECOMMENDED_SLOTS = [
  {
    key: 'payroll_register',
    label: 'Payroll Register or Headcount Summary',
    note: 'Current employee list with role/title, employment type (FT/PT/1099), hourly rate or salary, and average weekly hours.',
    multi: false,
  },
  {
    key: 'org_chart',
    label: 'Org Chart',
    note: 'Current organizational structure. Used to identify key-person concentration.',
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
] as const

const OPTIONAL_SLOTS = [
  {
    key: 'pto_ledger',
    label: 'PTO Accrual Ledger or Balance Report',
    note: 'Current PTO balances owed to all employees. Enables accrued PTO liability quantification — feeds WS2 labor analysis.',
    multi: false,
  },
  {
    key: 'workers_comp',
    label: "Workers' Comp Certificate / Loss Run",
    note: 'Flags patterns that may indicate workforce safety or liability issues.',
    multi: false,
  },
  {
    key: 'state_employer_docs',
    label: 'State Employer Registration Documents',
    note: 'Used to verify employer classification and multi-state risk.',
    multi: false,
  },
] as const

type SlotKey =
  | typeof UPLOAD_SLOTS[number]['key']
  | typeof RECOMMENDED_SLOTS[number]['key']
  | typeof OPTIONAL_SLOTS[number]['key']

interface Props {
  onDocumentsReady: (docs: UploadedDoc[]) => void
  onAnalyze: () => void
  isLoading: boolean
}

export default function WS16Uploader({ onDocumentsReady, onAnalyze, isLoading }: Props) {
  const [uploadedBySlot, setUploadedBySlot] = useState<Record<string, UploadedDoc[]>>({})
  const [showRecommended, setShowRecommended] = useState(false)
  const [showOptional, setShowOptional] = useState(false)

  const requiredFilled =
    (uploadedBySlot['employment_agreements']?.length ?? 0) > 0 &&
    (uploadedBySlot['handbook']?.length ?? 0) > 0

  const missingRecommendedRequired = [
    (uploadedBySlot['non_compete']?.length ?? 0) === 0
      ? 'Non-Compete / Non-Solicitation Agreements: skip only if embedded in employment agreements.'
      : null,
    (uploadedBySlot['benefits_summary']?.length ?? 0) === 0
      ? 'Benefits Summary: analysis can run, but benefits obligations will be incomplete.'
      : null,
  ].filter(Boolean) as string[]

  const allUploadedDocs = Object.values(uploadedBySlot).flat()
  const totalFileCount = allUploadedDocs.length
  // For size tracking, we can estimate base64 size or we should just pass file sizes if needed. But let's check base64 lengths.
  const totalSizeBytes = allUploadedDocs.reduce((acc, doc) => acc + (doc.base64.length * 3) / 4, 0)
  const isOverLimits = totalFileCount > 10 || totalSizeBytes > 20 * 1024 * 1024

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
              sizeBytes: file.size, // Custom property for logging/UI limits
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

  return (
    <div className="space-y-5">
      {/* Header — matches spec instruction text */}
      <div className="bg-stone-50 border border-stone-200 rounded-lg px-4 py-3">
        <p className="text-[12px] text-stone-500 leading-relaxed">
          Please upload the following documents to complete your employment obligations review.{' '}
          <span className="font-medium text-stone-700">Required documents must be uploaded before analysis can begin.</span>{' '}
          Recommended documents improve the depth and accuracy of your report.
        </p>
      </div>

      {isOverLimits && (
        <div className="flex gap-2 text-[12px] text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <span>⚠</span>
          <span>Upload limit exceeded. Maximum 10 files and 20MB combined allowed.</span>
        </div>
      )}

      {/* Required slots */}
      <SlotGroup
        label="Required"
        slots={UPLOAD_SLOTS}
        uploadedBySlot={uploadedBySlot}
        onFiles={handleFiles}
        onRemove={removeFile}
        badge="red"
      />

      {/* Strongly Recommended (collapsible) */}
      <CollapsibleGroup
        label="Strongly Recommended"
        open={showRecommended}
        onToggle={() => setShowRecommended(o => !o)}
        slots={RECOMMENDED_SLOTS}
        uploadedBySlot={uploadedBySlot}
        onFiles={handleFiles}
        onRemove={removeFile}
      />

      {/* Optional (collapsible) */}
      <CollapsibleGroup
        label="Optional / Supplemental"
        open={showOptional}
        onToggle={() => setShowOptional(o => !o)}
        slots={OPTIONAL_SLOTS}
        uploadedBySlot={uploadedBySlot}
        onFiles={handleFiles}
        onRemove={removeFile}
      />

      {/* Run Analysis button — Architecture: blocked until required slots filled */}
      <div className="pt-2 flex items-center justify-between border-t border-stone-100">
        <p className={`text-[11px] ${isOverLimits ? 'text-red-500 font-medium' : 'text-stone-400'}`}>
          {totalFileCount} file{totalFileCount !== 1 ? 's' : ''} ({(totalSizeBytes / 1024 / 1024).toFixed(1)} MB)
          {totalFileCount > 0 && ` · Max 10 files / 20 MB`}
        </p>
        <button
          onClick={onAnalyze}
          disabled={!requiredFilled || isLoading || isOverLimits}
          className={`text-[12px] px-4 py-2 rounded-lg font-medium transition-all ${
            requiredFilled && !isLoading && !isOverLimits
              ? 'bg-stone-900 text-white hover:bg-stone-800'
              : 'bg-stone-100 text-stone-400 cursor-not-allowed'
          }`}
        >
          {isLoading ? 'Running Analysis…' : 'Run Analysis →'}
        </button>
      </div>

      {!requiredFilled && (
        <p className="text-[11px] text-stone-400 text-right -mt-3">
          Upload at minimum: Employment Agreements and Employee Handbook to enable analysis
        </p>
      )}

      {requiredFilled && missingRecommendedRequired.length > 0 && (
        <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {missingRecommendedRequired.map(message => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SlotGroup({
  label,
  slots,
  uploadedBySlot,
  onFiles,
  onRemove,
  badge,
}: {
  label: string
  slots: readonly any[]
  uploadedBySlot: Record<string, UploadedDoc[]>
  onFiles: (key: string, files: FileList | null) => void
  onRemove: (key: string, name: string) => void
  badge?: 'red'
}) {
  return (
    <div>
      <p className="text-[11px] font-medium text-stone-400 uppercase tracking-widest mb-2">
        {label}
        {badge === 'red' && (
          <span className="ml-2 text-red-500 normal-case tracking-normal">* Required</span>
        )}
      </p>
      <div className="space-y-2">
        {slots.map((slot: any) => (
          <UploadSlot
            key={slot.key}
            slot={slot}
            files={uploadedBySlot[slot.key] ?? []}
            onFiles={onFiles}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  )
}

function CollapsibleGroup({
  label,
  open,
  onToggle,
  slots,
  uploadedBySlot,
  onFiles,
  onRemove,
}: {
  label: string
  open: boolean
  onToggle: () => void
  slots: readonly any[]
  uploadedBySlot: Record<string, UploadedDoc[]>
  onFiles: (key: string, files: FileList | null) => void
  onRemove: (key: string, name: string) => void
}) {
  const uploaded = slots.filter((s: any) => (uploadedBySlot[s.key]?.length ?? 0) > 0).length
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-[11px] font-medium text-stone-400 uppercase tracking-widest mb-2 hover:text-stone-600 transition-colors"
      >
        <span>{open ? '▾' : '▸'}</span>
        {label}
        {uploaded > 0 && (
          <span className="normal-case tracking-normal text-green-700">
            ({uploaded} uploaded)
          </span>
        )}
      </button>
      {open && (
        <div className="space-y-2">
          {slots.map((slot: any) => (
            <UploadSlot
              key={slot.key}
              slot={slot}
              files={uploadedBySlot[slot.key] ?? []}
              onFiles={onFiles}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function UploadSlot({
  slot,
  files,
  onFiles,
  onRemove,
}: {
  slot: any
  files: UploadedDoc[]
  onFiles: (key: string, files: FileList | null) => void
  onRemove: (key: string, name: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className={`border rounded-lg px-3 py-2.5 transition-colors ${
      files.length > 0 ? 'border-green-200 bg-green-50' : 'border-stone-200 bg-white'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-stone-800">{slot.label}</p>
          <p className="text-[11px] text-stone-400 leading-snug mt-0.5">{slot.note}</p>
          {files.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {files.map(f => (
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
        <div className="flex-shrink-0">
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
        </div>
      </div>
    </div>
  )
}
