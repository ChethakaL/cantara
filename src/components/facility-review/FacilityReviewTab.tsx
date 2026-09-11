'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Camera,
  CheckCircle2,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RotateCw,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { Badge, Card, cn, Button } from '@/components/ui'
import { agentTabReadOnlyGate } from '@/hooks/useAgentTabReadOnly'
import type { FacilityRating, FacilityReviewReport, FacilityImpact, FacilityEffort } from '@/lib/facility-review/types'
import { buildFacilityReviewReportHtml } from '@/lib/report-export/build-facility-review-report'
import { useAgentAiProvider } from '@/hooks/useAgentAiProvider'
import { AgentRunToolbar } from '@/components/admin/AgentRunToolbar'
import { resolveAgentModelId } from '@/lib/agent-model-provider'
import { useGenericAgentRuns } from '@/hooks/useGenericAgentRuns'
import { AGENT_RUN_KEYS } from '@/lib/agent-run-keys'
import { saveAgentAnalysisRunClient } from '@/lib/agent-analysis-runs.client'
import type { AgentRunHistoryItem } from '@/components/admin/AgentRunHistoryPanel'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'

const ACCEPTED_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
}

const RATING_BADGE: Record<FacilityRating, 'green' | 'blue' | 'gold' | 'red'> = {
  Excellent: 'green',
  Good: 'blue',
  'Needs Attention': 'gold',
  Critical: 'red',
}

const PHOTO_SECTIONS = [
  {
    key: 'exterior',
    title: 'Exterior & Curb Appeal',
    prompt: 'Upload 3-5 photos of the exterior',
    helper: 'Front signage, entrance, parking, landscaping, side/rear exterior.',
  },
  {
    key: 'reception',
    title: 'Reception & Client-Facing Areas',
    prompt: 'Upload 3-5 photos of reception and client-facing areas',
    helper: 'Front desk, waiting room, retail display, check-in path, client bathrooms if relevant.',
  },
  {
    key: 'boarding',
    title: 'Boarding & Daycare Areas',
    prompt: 'Upload 3-5 photos of boarding and daycare areas',
    helper: 'Kennel runs, daycare rooms, flooring, gates, drains, ventilation view.',
  },
  {
    key: 'grooming',
    title: 'Grooming Suite',
    prompt: 'Upload 3-5 photos of grooming suite',
    helper: 'Tables, tubs, dryers, plumbing, storage, work area condition.',
  },
  {
    key: 'outdoor',
    title: 'Outdoor Play Areas',
    prompt: 'Upload 3-5 photos of outdoor play areas',
    helper: 'Fencing, turf/ground surface, shade, drainage, gates, large/small dog yards.',
  },
  {
    key: 'staff',
    title: 'Staff & Operational Areas',
    prompt: 'Upload 3-5 photos of staff and operational areas',
    helper: 'Laundry, storage, staff room, mechanical/HVAC, cleaning supply area.',
  },
] as const

const CLIENT_IMAGE_DOCUMENT_IDS: Record<PhotoSectionKey, string[]> = {
  exterior: ['facility_review_images_exterior'],
  reception: ['facility_review_images_reception'],
  boarding: ['facility_review_images_boarding', 'facility_review_images_indoor-play'],
  grooming: ['facility_review_images_grooming'],
  outdoor: ['facility_review_images_outdoor-play'],
  staff: ['facility_review_images_staff-ops'],
}

const INTAKE_FIELD_LABELS: Record<string, string> = {
  businessAddress: 'Facility address / location',
  facilityExteriorLastPainted: 'Exterior last painted or pressure-washed',
  facilityExteriorRepairs: 'Outstanding exterior repairs, bylaw violations, or open permits',
  facilityReceptionLastRefreshed: 'Reception last renovated, repainted, or refreshed',
  facilityReceptionRetail: 'Retail product sold in reception',
  facilityKennelPanels: 'Kennel panel material and replacement/refinish history',
  facilityHvacLastServiced: 'HVAC last professionally serviced',
  facilityHvacServiceRecord: 'HVAC service record available',
  facilityBoardingMaintenanceIssues: 'Boarding maintenance issues not visible in photos',
  facilityGroomingStationCount: 'Number of grooming stations',
  facilityGroomingTableDetails: 'Grooming table type and age',
  facilityDryerDetails: 'Dryers in use and service history',
  facilityGroomingVentilation: 'Grooming suite ventilation',
  facilityIndoorPlayAreaCount: 'Indoor play area count',
  facilityIndoorPlayIssues: 'Indoor play maintenance issues not visible in photos',
  facilityOutdoorFencing: 'Outdoor fencing type and approximate age',
  facilityOutdoorShade: 'Outdoor shade structure',
  facilityOutdoorWaterSource: 'Outdoor water source',
  facilityOutdoorIssues: 'Outdoor fencing, surface, or structural issues not visible in photos',
  facilityLaundrySetup: 'Laundry setup',
  facilityLaundryUnitAge: 'Laundry unit age',
  facilityOperationalIssues: 'Operational/facilities issues not visible in photos',
  facilityBusinessLicenseExpiry: 'Business license expiry',
  facilityAnimalCareLicenseExpiry: 'Animal care license expiry',
  facilityLastMunicipalInspection: 'Last municipal inspection',
  facilityLastInspectionOutcome: 'Last inspection outcome',
  facilityRegulatoryItems: 'Outstanding violations, open permits, or regulatory items',
  facilityRecentCapex: 'Major capital expenditures in last 3 years',
  facilityExpectedCapex: 'Expected capital investment in next 1-3 years',
  facilityReviewNotes: 'Additional facility notes',
}

type PhotoSectionKey = typeof PHOTO_SECTIONS[number]['key']
type SectionFiles = Record<PhotoSectionKey, File[]>
type ExistingFacilityImage = {
  id: string
  fileName: string
  fileUrl?: string | null
  uploadedAt?: string | null
}
type ExistingSectionImages = Record<PhotoSectionKey, ExistingFacilityImage[]>
type FacilityIntakeQuestion = {
  id: string
  fieldKey: string
  label: string
  description?: string | null
  inputType: 'text' | 'url' | 'textarea' | 'select' | 'number'
  placeholder?: string | null
  required: boolean
  options?: string[] | null
  groupLabel?: string | null
}

function emptySectionFiles(): SectionFiles {
  return PHOTO_SECTIONS.reduce((acc, section) => {
    acc[section.key] = []
    return acc
  }, {} as SectionFiles)
}

function emptyExistingSectionImages(): ExistingSectionImages {
  return PHOTO_SECTIONS.reduce((acc, section) => {
    acc[section.key] = []
    return acc
  }, {} as ExistingSectionImages)
}

function DeleteConfirmModal({
  open,
  title,
  description,
  onClose,
  onConfirm,
  confirmLabel = 'Delete',
  isDeleting = false,
}: {
  open: boolean
  title: string
  description: string
  onClose: () => void
  onConfirm: () => void
  confirmLabel?: string
  isDeleting?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isDeleting} className="text-xs cursor-pointer">
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onConfirm}
            disabled={isDeleting}
            className="text-xs bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
          >
            {isDeleting ? 'Deleting...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatusToast({
  toast,
  onClose,
}: {
  toast: { message: string; type: 'success' | 'error' | 'info' } | null
  onClose: () => void
}) {
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(onClose, 3500)
    return () => clearTimeout(timer)
  }, [toast, onClose])

  if (!toast) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-lg border shadow-lg text-xs font-medium bg-white text-slate-800 border-slate-200 animate-in fade-in slide-in-from-bottom-2 duration-200">
      {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
      {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
      {toast.type === 'info' && <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />}
      <span>{toast.message}</span>
      <button onClick={onClose} className="ml-2 text-slate-400 hover:text-slate-600 cursor-pointer">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function SectionUploader({
  sectionKey,
  title,
  prompt,
  helper,
  files,
  existingImages,
  onAdd,
  onRemove,
}: {
  sectionKey: PhotoSectionKey
  title: string
  prompt: string
  helper: string
  files: File[]
  existingImages: ExistingFacilityImage[]
  onAdd: (key: PhotoSectionKey, files: File[]) => void
  onRemove: (key: PhotoSectionKey, index: number) => void
}) {
  const onDrop = useCallback((accepted: File[]) => onAdd(sectionKey, accepted), [onAdd, sectionKey])
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    multiple: true,
    maxFiles: 5,
    maxSize: 5 * 1024 * 1024,
  })
  const totalCount = existingImages.length + files.length
  const complete = totalCount >= 3

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900">{title}</span>
            <span
              className={cn(
                'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border',
                complete
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : totalCount > 0
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200',
              )}
            >
              {totalCount} / 5 photos
            </span>
          </div>
          <p className="text-xs font-medium text-slate-600 mt-1">{prompt}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{helper}</p>
        </div>
      </div>
      <div
        {...getRootProps()}
        className={cn(
          'rounded-lg border border-dashed p-4 text-center cursor-pointer transition-colors',
          isDragActive ? 'bg-amber-50 border-amber-300' : 'border-slate-200 hover:bg-slate-50',
        )}
      >
        <input {...getInputProps()} />
        <Upload className="w-4 h-4 text-slate-400 mx-auto mb-1.5" />
        <p className="text-xs font-medium text-slate-600">Drop photos here, or click to browse</p>
        <p className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WebP up to 5MB</p>
      </div>
      {(existingImages.length > 0 || files.length > 0) && (
        <div className="space-y-1.5 pt-1">
          {existingImages.map((image) => (
            <div
              key={image.id}
              className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-emerald-900">{image.fileName}</p>
                <p className="text-[10px] text-emerald-600">
                  Uploaded in Client Portal{image.uploadedAt ? ` · ${new Date(image.uploadedAt).toLocaleDateString()}` : ''}
                </p>
              </div>
            </div>
          ))}
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <Camera className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-800">{file.name}</p>
                <p className="text-[10px] text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(sectionKey, index)}
                className="text-slate-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                title="Remove photo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function FacilityReviewTab({
  clientId,
  clientName,
  businessAddress,
  readOnly = false,
}: {
  clientId: string
  clientName: string
  businessAddress?: string
  readOnly?: boolean
}) {
  const reportTopRef = useRef<HTMLDivElement | null>(null)
  const [runMode, setRunMode] = useState<'standard' | 'advisor'>('standard')
  const [businessName, setBusinessName] = useState(clientName)
  const [location, setLocation] = useState(businessAddress || '')
  const [notes, setNotes] = useState('')
  const [meetingNotes, setMeetingNotes] = useState('')
  const [advisorImages, setAdvisorImages] = useState<File[]>([])
  const [reportRunMode, setReportRunMode] = useState<'standard' | 'advisor' | null>(null)
  const [intakeQuestions, setIntakeQuestions] = useState<FacilityIntakeQuestion[]>([])
  const [intakeResponses, setIntakeResponses] = useState<Record<string, string>>({})
  const [savingIntake, setSavingIntake] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [intakeSaved, setIntakeSaved] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)
  const [sectionFiles, setSectionFiles] = useState<SectionFiles>(() => emptySectionFiles())
  const [existingSectionImages, setExistingSectionImages] = useState<ExistingSectionImages>(() => emptyExistingSectionImages())
  const [report, setReport] = useState<FacilityReviewReport | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [composingNew, setComposingNew] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const { provider, setProvider } = useAgentAiProvider()
  const {
    runs,
    historyItems,
    activeRun,
    activeId,
    setActiveId,
    reload: reloadRuns,
    loading: loadingRuns,
  } = useGenericAgentRuns(clientId, AGENT_RUN_KEYS.facilityReview)
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedSnapshotRef = useRef('')

  function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
    setToast({ message, type })
  }

  useEffect(() => {
    if (!readOnly) return
    setEditMode(false)
  }, [readOnly])

  const loadData = useCallback(async () => {
    try {
      const modeRes = await fetch(`/api/client-data/${clientId}?section=facilityReviewMode`)
      if (modeRes.ok) {
        const mode = await modeRes.json()
        setRunMode(mode === 'advisor' ? 'advisor' : 'standard')
      }
      const inputsRes = await fetch(`/api/client-data/${clientId}?section=facilityReviewInputs`)
      if (inputsRes.ok) {
        const inputs = await inputsRes.json()
        if (inputs?.location) setLocation(inputs.location)
        if (inputs?.notes) setNotes(inputs.notes)
      }
      const questionsRes = await fetch(`/api/client-form-questions?clientId=${encodeURIComponent(clientId)}`)
      if (questionsRes.ok) {
        const data = await questionsRes.json()
        const facilityQuestions = (data.questions ?? []).filter((question: FacilityIntakeQuestion) => (
          question.fieldKey === 'businessAddress' || question.fieldKey.startsWith('facility')
        ))
        setIntakeQuestions(facilityQuestions)
        if (data.responses && typeof data.responses === 'object') {
          setIntakeResponses(data.responses)
          if (data.responses.businessAddress) setLocation(data.responses.businessAddress)
        }
      }
      const res = await fetch(`/api/client-data/${clientId}?section=facilityReview`)
      if (res.ok) {
        const data = await res.json()
        if (data?.overallScore) {
          setReport(data)
          lastSavedSnapshotRef.current = JSON.stringify(data)
          if (data.reportVersion?.includes('Advisor Visit')) {
            setReportRunMode('advisor')
          }
        }
      }
      const advisorInputsRes = await fetch(`/api/client-data/${clientId}?section=facilityReviewAdvisorInputs`)
      if (advisorInputsRes.ok) {
        const advisorInputs = await advisorInputsRes.json()
        if (advisorInputs?.meetingNotes) setMeetingNotes(advisorInputs.meetingNotes)
        if (advisorInputs?.location) setLocation(advisorInputs.location)
        if (advisorInputs?.businessName) setBusinessName(advisorInputs.businessName)
      }
      const imageEntries = await Promise.all(PHOTO_SECTIONS.map(async section => {
        const docs = await Promise.all((CLIENT_IMAGE_DOCUMENT_IDS[section.key] ?? []).map(async documentId => {
          const docRes = await fetch(`/api/client-documents?clientId=${encodeURIComponent(clientId)}&documentId=${encodeURIComponent(documentId)}&all=true`)
          if (!docRes.ok) return []
          const docData = await docRes.json()
          return docData.documents ?? []
        }))
        return [section.key, docs.flat()] as const
      }))
      setExistingSectionImages(Object.fromEntries(imageEntries) as ExistingSectionImages)
    } catch {}
    finally {
      setHydrated(true)
    }
  }, [clientId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (loadingRuns) return
    if (activeRun?.report) {
      const payload = activeRun.report as FacilityReviewReport
      if (payload?.overallScore) {
        setReport(payload)
        lastSavedSnapshotRef.current = JSON.stringify(payload)
        const meta = activeRun.metadata as { runMode?: 'standard' | 'advisor' } | null | undefined
        if (meta?.runMode === 'advisor' || payload.reportVersion?.includes('Advisor Visit')) {
          setReportRunMode('advisor')
        }
      }
      setHydrated(true)
    }
  }, [activeRun, loadingRuns])

  function selectRun(run: AgentRunHistoryItem) {
    setActiveId(run.id)
    const full = runs.find((item) => item.id === run.id)
    if (full?.report) {
      const payload = full.report as FacilityReviewReport
      setReport(payload)
      setComposingNew(false)
      const meta = full.metadata as { runMode?: 'standard' | 'advisor' } | null | undefined
      if (meta?.runMode === 'advisor' || payload.reportVersion?.includes('Advisor Visit')) {
        setReportRunMode('advisor')
      } else {
        setReportRunMode('standard')
      }
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await loadData()
      showToast('Facility review data refreshed from Client Portal & Profile', 'success')
    } catch {
      showToast('Failed to refresh data', 'error')
    } finally {
      setRefreshing(false)
    }
  }

  const persistFacilityRun = async (nextReport: FacilityReviewReport, mode: 'standard' | 'advisor') => {
    await saveAgentAnalysisRunClient({
      clientId,
      agentKey: AGENT_RUN_KEYS.facilityReview,
      fileName: `${nextReport.businessName || clientName} — Facility Review`,
      report: nextReport,
      metadata: { runMode: mode },
      aiProvider: provider,
      aiModel: resolveAgentModelId(provider),
    })
    await reloadRuns({ selectNewest: true })
  }

  const updateRunMode = async (nextMode: 'standard' | 'advisor') => {
    setRunMode(nextMode)
    setError(null)
    try {
      await fetch('/api/agent-runs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          agentId: 'facility_review',
          facilityReviewMode: nextMode === 'advisor' ? 'advisor' : '360',
        }),
      })
      await fetch(`/api/client-data/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'facilityReviewMode', data: nextMode }),
      })
      showToast(
        nextMode === 'advisor'
          ? 'Switched to Advisor Review Mode (client portal intake hidden)'
          : 'Switched to 360 Review Mode (client portal intake enabled)',
        'info',
      )
    } catch (err: any) {
      setError(err.message || 'Could not update facility review mode.')
      showToast('Could not update facility review mode', 'error')
    }
  }

  const addSectionFiles = useCallback((key: PhotoSectionKey, accepted: File[]) => {
    setSectionFiles(current => ({
      ...current,
      [key]: [...current[key], ...accepted].slice(0, 5),
    }))
    setError(null)
  }, [])

  const removeSectionFile = useCallback((key: PhotoSectionKey, index: number) => {
    setSectionFiles(current => ({
      ...current,
      [key]: current[key].filter((_, fileIndex) => fileIndex !== index),
    }))
  }, [])

  const sortedZones = useMemo(() => report ? [...report.zones].sort((a, b) => a.score - b.score) : [], [report])
  const totalFiles = PHOTO_SECTIONS.reduce((sum, section) => sum + sectionFiles[section.key].length + existingSectionImages[section.key].length, 0)
  const completeSections = PHOTO_SECTIONS.filter(section => sectionFiles[section.key].length + existingSectionImages[section.key].length >= 3).length
  const facilityIntakeEntries = intakeQuestions
    .map(question => [INTAKE_FIELD_LABELS[question.fieldKey] ?? question.label, String(intakeResponses[question.fieldKey] ?? '').trim()] as const)
    .filter(([, value]) => value)
  const missingRequiredIntake = intakeQuestions.filter(question => question.required && !String(intakeResponses[question.fieldKey] ?? '').trim())
  const groupedIntakeQuestions = intakeQuestions.reduce<Record<string, FacilityIntakeQuestion[]>>((acc, question) => {
    const key = question.groupLabel || 'Facility Review'
    acc[key] = [...(acc[key] ?? []), question]
    return acc
  }, {})

  const updateIntakeResponse = (fieldKey: string, value: string) => {
    setIntakeResponses(current => ({ ...current, [fieldKey]: value }))
    if (fieldKey === 'businessAddress') setLocation(value)
    setIntakeSaved(false)
    setDraftSaved(false)
    setError(null)
  }

  const saveIntakeResponses = async ({ draft = false }: { draft?: boolean } = {}) => {
    if (!draft && missingRequiredIntake.length) {
      setError(`Complete required intake fields: ${missingRequiredIntake.slice(0, 3).map(q => q.label).join(', ')}${missingRequiredIntake.length > 3 ? '...' : ''}`)
      return false
    }
    if (draft) {
      setSavingDraft(true)
    } else {
      setSavingIntake(true)
    }
    setError(null)
    try {
      const res = await fetch('/api/client-form-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, responses: intakeResponses, mode: draft ? 'draft' : 'final' }),
      })
      if (!res.ok) throw new Error(await res.text())
      await fetch(`/api/client-data/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'facilityReviewInputs', data: { location, notes, businessName } }),
      })
      if (draft) {
        setDraftSaved(true)
        showToast('Intake responses draft saved', 'success')
        setTimeout(() => setDraftSaved(false), 1800)
      } else {
        setIntakeSaved(true)
        showToast('Intake responses saved to client record', 'success')
        setTimeout(() => setIntakeSaved(false), 1800)
      }
      return true
    } catch (err: any) {
      const msg = err.message || (draft ? 'Could not save intake draft.' : 'Could not save intake responses.')
      setError(msg)
      showToast(msg, 'error')
      return false
    } finally {
      if (draft) {
        setSavingDraft(false)
      } else {
        setSavingIntake(false)
      }
    }
  }

  const saveAdvisorNotes = async () => {
    try {
      await fetch(`/api/client-data/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'facilityReviewAdvisorInputs',
          data: { businessName, location, meetingNotes, runMode: 'advisor' },
        }),
      })
      showToast('Advisor visit notes saved', 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to save advisor notes', 'error')
    }
  }

  const analyze = async () => {
    if (missingRequiredIntake.length) {
      setError(`Complete required intake fields: ${missingRequiredIntake.slice(0, 3).map(q => q.label).join(', ')}${missingRequiredIntake.length > 3 ? '...' : ''}`)
      return
    }
    setAnalyzing(true)
    setError(null)
    try {
      const savedOk = await saveIntakeResponses({ draft: false })
      if (!savedOk) return
      const form = new FormData()
      form.append('businessName', businessName)
      form.append('location', location)
      const intakeText = facilityIntakeEntries.length
        ? `Seller intake form responses:\n${facilityIntakeEntries.map(([label, value]) => `- ${label}: ${value}`).join('\n')}`
        : 'Seller intake form responses: not provided.'
      form.append('notes', [intakeText, notes.trim() ? `Admin notes:\n${notes.trim()}` : 'Admin notes: none.'].join('\n\n'))
      form.append('provider', provider)
      form.append('modelId', resolveAgentModelId(provider))
      for (const section of PHOTO_SECTIONS) {
        for (const image of existingSectionImages[section.key]) {
          if (!image.fileUrl) continue
          try {
            const imageRes = await fetch(image.fileUrl)
            if (!imageRes.ok) continue
            const blob = await imageRes.blob()
            form.append('images', new File([blob], image.fileName, { type: blob.type || 'image/jpeg' }))
            form.append('imageSections', section.title)
          } catch {
            // Keep going if a browser fetch fails
          }
        }
      }
      PHOTO_SECTIONS.forEach(section => {
        sectionFiles[section.key].forEach(file => {
          form.append('images', file)
          form.append('imageSections', section.title)
        })
      })
      const res = await fetch('/api/facility-review/analyze', { method: 'POST', body: form })
      if (!res.ok) throw new Error(await res.text())
      const nextReport = await res.json()
      setReport(nextReport)
      setReportRunMode('standard')
      setComposingNew(false)
      try {
        const saveRes = await fetch(`/api/client-data/${clientId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section: 'facilityReview', data: nextReport }),
        })
        if (!saveRes.ok) throw new Error('Save failed')
        setSaved(true)
        setTimeout(() => setSaved(false), 1800)
      } catch (saveErr: any) {
        setError(saveErr.message || 'Analysis completed but failed to save')
      }
      await persistFacilityRun(nextReport, 'standard')
      requestAnimationFrame(() => {
        reportTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    } catch (err: any) {
      setError(err.message || 'Facility review failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const save = async () => {
    if (!report) return
    setSaving(true)
    try {
      const res = await fetch(`/api/client-data/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'facilityReview', data: report }),
      })
      if (!res.ok) throw new Error('Save failed')
      lastSavedSnapshotRef.current = JSON.stringify(report)
      setSaved(true)
      showToast('Facility assessment report saved', 'success')
      setTimeout(() => setSaved(false), 1800)
    } catch (err: any) {
      setError(err.message || 'Save failed')
      showToast(err.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!editMode || !report) return
    const snapshot = JSON.stringify(report)
    if (snapshot === lastSavedSnapshotRef.current) return
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
    autoSaveTimeoutRef.current = setTimeout(() => {
      void save()
    }, 800)
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
    }
  }, [editMode, report])

  const updateReport = (updates: Partial<FacilityReviewReport>) => {
    setReport(current => current ? { ...current, ...updates } : current)
  }

  const updateZone = (index: number, updates: Partial<FacilityReviewReport['zones'][number]>) => {
    setReport(current => {
      if (!current) return current
      const zones = [...current.zones]
      zones[index] = { ...zones[index], ...updates }
      return { ...current, zones }
    })
  }

  const updateImprovement = (index: number, updates: Partial<FacilityReviewReport['prioritizedImprovements'][number]>) => {
    setReport(current => {
      if (!current) return current
      const prioritizedImprovements = [...current.prioritizedImprovements]
      prioritizedImprovements[index] = { ...prioritizedImprovements[index], ...updates }
      return { ...current, prioritizedImprovements }
    })
  }

  const advisorNotesMissing = !meetingNotes.trim()

  const analyzeAdvisorRun = async () => {
    if (!meetingNotes.trim()) {
      setError('Fill in meeting notes / visit observations before generating the report.')
      return
    }
    setAnalyzing(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('businessName', businessName)
      form.append('location', location)
      form.append('meetingNotes', meetingNotes)
      advisorImages.forEach(file => form.append('images', file))
      const res = await fetch('/api/facility-review/advisor-analyze', { method: 'POST', body: form })
      if (!res.ok) throw new Error(await res.text())
      const nextReport = await res.json() as FacilityReviewReport
      setReport(nextReport)
      setReportRunMode('advisor')
      setComposingNew(false)
      try {
        const saveRes = await fetch(`/api/client-data/${clientId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section: 'facilityReview', data: nextReport }),
        })
        if (!saveRes.ok) throw new Error('Save failed')
        await fetch(`/api/client-data/${clientId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            section: 'facilityReviewAdvisorInputs',
            data: { businessName, location, meetingNotes, runMode: 'advisor' },
          }),
        })
        setSaved(true)
        setTimeout(() => setSaved(false), 1800)
      } catch (saveErr: any) {
        setError(saveErr.message || 'Analysis completed but failed to save')
      }
      await persistFacilityRun(nextReport, 'advisor')
      requestAnimationFrame(() => {
        reportTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    } catch (err: any) {
      setError(err.message || 'Advisor facility review failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const onAdvisorDrop = useCallback((accepted: File[]) => {
    setAdvisorImages(current => [...current, ...accepted].slice(0, 20))
    setError(null)
  }, [])

  const { getRootProps: getAdvisorRootProps, getInputProps: getAdvisorInputProps, isDragActive: advisorDragActive } = useDropzone({
    onDrop: onAdvisorDrop,
    accept: ACCEPTED_TYPES,
    multiple: true,
    maxFiles: 20,
    maxSize: 5 * 1024 * 1024,
  })

  const handleDeleteReport = async () => {
    setIsDeleting(true)
    try {
      await fetch(`/api/client-data/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'facilityReview', data: null }),
      })
      setReport(null)
      setReportRunMode(null)
      setComposingNew(false)
      setDeleteModalOpen(false)
      showToast('Facility review report deleted', 'success')
      await reloadRuns()
    } catch {
      showToast('Failed to delete report', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleNewAnalysis = () => {
    setComposingNew(true)
    setError(null)
  }

  // ────────────────────────── Report View ──────────────────────────
  if (report && !composingNew) {
    return (
      <div ref={reportTopRef} className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-serif text-xl font-bold text-slate-900 tracking-tight">
                Facility Assessment &amp; Physical Condition Report
              </h1>
              <span
                className={cn(
                  'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border',
                  reportRunMode === 'advisor'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200',
                )}
              >
                {reportRunMode === 'advisor' ? 'Advisor Review' : '360 Review'}
              </span>
              <span
                className={cn(
                  'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border',
                  report.overallRating === 'Excellent' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
                  report.overallRating === 'Good' && 'bg-blue-50 text-blue-700 border-blue-200',
                  report.overallRating === 'Needs Attention' && 'bg-amber-50 text-amber-700 border-amber-200',
                  report.overallRating === 'Critical' && 'bg-rose-50 text-rose-700 border-rose-200',
                )}
              >
                {report.overallRating} ({report.overallScore}/100)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {report.businessName || clientName} &middot; Generated {new Date(report.generatedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>

          {!readOnly && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (editMode) void save()
                  setEditMode(!editMode)
                }}
                disabled={saving}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer',
                  editMode
                    ? 'bg-amber-50 text-amber-700 border-amber-300'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                )}
              >
                {editMode ? <Save className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                {editMode ? 'Done Editing' : 'Edit Output'}
              </button>
              <ExportReportButton
                html={buildFacilityReviewReportHtml(report)}
                fileName={`facility-review-${(report.businessName || clientName).replace(/\s+/g, '-').toLowerCase()}`}
                buttonClassName="border-slate-200 text-slate-600 hover:bg-slate-50 text-xs px-3 py-1.5 cursor-pointer"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeleteModalOpen(true)}
                className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-slate-200 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Delete
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleNewAnalysis}
                className="h-8 text-xs cursor-pointer border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                New Analysis
              </Button>
            </div>
          )}
        </div>

        {/* Toolbar */}
        {!readOnly && (
          <AgentRunToolbar
            provider={provider}
            onProviderChange={setProvider}
            disabled={analyzing || saving}
            historyItems={historyItems}
            activeId={activeId}
            onSelectRun={selectRun}
            activeProvider={activeRun?.aiProvider}
            activeModel={activeRun?.aiModel}
            activeVersion={activeRun?.version}
          />
        )}

        {/* Edit mode banner */}
        {editMode && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3">
            <Pencil className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-relaxed">
              Edit mode active. Click any zone score, narrative, or improvement row to edit in-place. Changes are auto-saved.
            </p>
          </div>
        )}

        {/* Overall Score Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
          <div className="grid gap-6 lg:grid-cols-[180px_1fr]">
            <div className="text-center lg:border-r lg:border-slate-100 lg:pr-6 flex flex-col justify-center items-center">
              {editMode ? (
                <input
                  type="number"
                  value={report.overallScore}
                  onChange={e => updateReport({ overallScore: Number(e.target.value) })}
                  className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-center text-4xl font-bold text-slate-900 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
                />
              ) : (
                <div className="text-5xl font-bold text-slate-900 tracking-tight">{report.overallScore}</div>
              )}
              <p className="text-xs text-slate-400 mt-1 font-medium">Facility Score (out of 100)</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Overall Assessment</p>
              {editMode ? (
                <select
                  value={report.overallRating}
                  onChange={e => updateReport({ overallRating: e.target.value as FacilityRating })}
                  className="mt-1 rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-700 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
                >
                  {Object.keys(RATING_BADGE).map(rating => <option key={rating} value={rating}>{rating}</option>)}
                </select>
              ) : (
                <h3 className="text-xl font-bold text-slate-900 mt-1">{report.overallRating} Condition</h3>
              )}
              {editMode ? (
                <textarea
                  value={report.overallNarrative}
                  onChange={e => updateReport({ overallNarrative: e.target.value })}
                  rows={4}
                  className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs leading-relaxed text-slate-700 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
                />
              ) : (
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">{report.overallNarrative}</p>
              )}
            </div>
          </div>
        </div>

        {/* Zones Breakdown */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Facility Zone Breakdown</h3>
            <span className="text-xs text-slate-400">{sortedZones.length} Zones Assessed</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {sortedZones.map((zone, index) => (
              <div key={zone.zone} className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h4 className="text-sm font-bold text-slate-900">{zone.zone}</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">{zone.score}/100</span>
                    <Badge color={RATING_BADGE[zone.rating]}>{zone.rating}</Badge>
                  </div>
                </div>

                {editMode ? (
                  <textarea
                    value={zone.narrative}
                    onChange={e => updateZone(index, { narrative: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-amber-300"
                  />
                ) : (
                  <p className="text-xs text-slate-600 leading-relaxed">{zone.narrative}</p>
                )}

                {zone.strengths?.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Strengths</span>
                    {zone.strengths.map((s, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                )}

                {zone.concerns?.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Areas for Improvement</span>
                    {zone.concerns.map((c, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                )}

                {zone.photoCount > 0 && (
                  <div className="pt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Camera className="w-3.5 h-3.5 text-slate-400" />
                    <span>{zone.photoCount} zone photos evaluated</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Prioritized Improvements Table */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Prioritized Capital Improvements &amp; CapEx Estimates
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Recommended capital expenditures ranked by buyer impact and operational effort
              </p>
            </div>
            {editMode && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const item = {
                    zone: 'Exterior',
                    improvement: 'New maintenance item',
                    estimatedCost: '$1,000 - $3,000',
                    impact: 'Medium' as FacilityImpact,
                    effort: 'Medium' as FacilityEffort,
                    timing: 'Before listing',
                  }
                  updateReport({ prioritizedImprovements: [...report.prioritizedImprovements, item] })
                }}
                className="text-xs h-7"
              >
                + Add Improvement
              </Button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Zone</th>
                  <th className="px-4 py-2.5">Recommended Improvement</th>
                  <th className="px-4 py-2.5">Est. Cost</th>
                  <th className="px-4 py-2.5">Buyer Impact</th>
                  <th className="px-4 py-2.5">Effort</th>
                  <th className="px-4 py-2.5">Timing</th>
                  {editMode && <th className="px-4 py-2.5 w-8"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.prioritizedImprovements.map((item, index) => (
                  <tr key={index} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 font-semibold text-slate-800">{item.zone}</td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {editMode ? (
                        <input
                          value={item.improvement}
                          onChange={e => updateImprovement(index, { improvement: e.target.value })}
                          className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                        />
                      ) : (
                        item.improvement
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-800">
                      {editMode ? (
                        <input
                          value={item.estimatedCost}
                          onChange={e => updateImprovement(index, { estimatedCost: e.target.value })}
                          className="w-28 rounded border border-slate-200 px-2 py-1 text-xs font-mono"
                        />
                      ) : (
                        item.estimatedCost
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border',
                          item.impact === 'High' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-600 border-slate-200',
                        )}
                      >
                        {item.impact}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{item.effort}</td>
                    <td className="px-4 py-2.5 text-slate-600">{item.timing}</td>
                    {editMode && (
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                          onClick={() => {
                            const nextList = report.prioritizedImprovements.filter((_, i) => i !== index)
                            updateReport({ prioritizedImprovements: nextList })
                          }}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        <DeleteConfirmModal
          open={deleteModalOpen}
          title="Delete Facility Review Report?"
          description="This will permanently remove the active facility assessment report from this client. The underlying intake responses, notes, and uploaded photos will remain saved, allowing you to re-run at any time."
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={handleDeleteReport}
          confirmLabel="Delete Report"
          isDeleting={isDeleting}
        />

        {/* Status Toast */}
        <StatusToast toast={toast} onClose={() => setToast(null)} />
      </div>
    )
  }

  const readOnlyGate = agentTabReadOnlyGate(readOnly, !hydrated, Boolean(report), 'Facility Review')
  if (readOnlyGate) return readOnlyGate

  // ────────────────────────── Starting Workspace View ──────────────────────────
  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="font-serif text-xl font-bold text-slate-900 tracking-tight">
            Facility Review &amp; Physical Condition
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {runMode === 'advisor'
              ? 'On-site walkthrough review using advisor visit notes and supporting photos.'
              : '360 facility assessment synthesized from client intake form responses and zone photo documentation.'}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Mode Switcher Segmented Control */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => void updateRunMode('standard')}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer inline-flex items-center gap-1.5',
                runMode === 'standard'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              <Building2 className="w-3.5 h-3.5" />
              360 Review
            </button>
            <button
              type="button"
              onClick={() => void updateRunMode('advisor')}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer inline-flex items-center gap-1.5',
                runMode === 'advisor'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              <FileText className="w-3.5 h-3.5" />
              Advisor Review
            </button>
          </div>

          {!readOnly && report && composingNew && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setComposingNew(false)}
              className="h-8 text-xs cursor-pointer border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Cancel &amp; Return to Report
            </Button>
          )}
        </div>
      </div>

      {/* Provider & Version Toolbar */}
      {!readOnly && (
        <AgentRunToolbar
          provider={provider}
          onProviderChange={setProvider}
          disabled={analyzing || savingIntake || savingDraft}
          historyItems={historyItems}
          activeId={activeId}
          onSelectRun={selectRun}
          activeProvider={activeRun?.aiProvider}
          activeModel={activeRun?.aiModel}
          activeVersion={activeRun?.version}
        />
      )}

      {/* Main Workspace Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6">
        {/* Mode Notice */}
        <p className="text-xs text-slate-500">
          {runMode === 'advisor'
            ? 'Advisor Review Mode: Intake form is hidden from the client portal. The advisor directly enters walkthrough meeting notes, physical site observations, and uploads visit photos taken on-site.'
            : '360 Review Mode: Facility details, physical condition questions, and photos are prefilled automatically from the Required Information form submitted by the client in the Client Portal. Advisors can review, override, or supplement responses and photos below before running analysis.'}
        </p>

        {/* Sector Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              {runMode === 'advisor'
                ? 'On-Site Walkthrough & Advisor Observations'
                : 'Facility Profile & Physical Intake'}
            </span>
            {runMode === 'standard' ? (
              <>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {facilityIntakeEntries.length} answers recorded
                </span>
                <span
                  className={cn(
                    'text-[11px] font-semibold px-2 py-0.5 rounded-full border',
                    missingRequiredIntake.length === 0
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200',
                  )}
                >
                  {missingRequiredIntake.length === 0
                    ? 'All Required Complete'
                    : `${missingRequiredIntake.length} required missing`}
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {totalFiles} photos ({completeSections}/{PHOTO_SECTIONS.length} zones ready)
                </span>
              </>
            ) : (
              <>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Advisor Mode Active
                </span>
                <span
                  className={cn(
                    'text-[11px] font-semibold px-2 py-0.5 rounded-full border',
                    meetingNotes.trim()
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200',
                  )}
                >
                  {meetingNotes.trim() ? 'Notes Recorded' : 'Notes Required'}
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {advisorImages.length} visit photos staged
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-[11px] text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 cursor-pointer transition-colors shrink-0"
          >
            <RotateCw className={cn('w-3 h-3', refreshing && 'animate-spin')} />
            Refresh from Portal &amp; Profile
          </button>
        </div>

        {/* Informational Callout Banner */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
            {runMode === 'advisor' ? <FileText className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
          </div>
          <div className="text-xs space-y-1">
            <div className="font-semibold text-slate-800">
              {runMode === 'advisor'
                ? 'On-Site Walkthrough & Advisor Observation Synthesis'
                : 'Automated Multi-Zone Physical Condition & CapEx Analysis'}
            </div>
            <p className="text-slate-600 leading-relaxed">
              {runMode === 'advisor'
                ? "The AI agent synthesizes the advisor's physical walkthrough notes, interview observations, and on-site visit photos into an executive physical condition scorecard with CapEx recommendations."
                : 'The AI agent reviews physical condition across 6 operational zones (Exterior, Reception, Boarding/Daycare, Grooming, Outdoor, and Staff/Operations), estimating deferred maintenance, rating curb appeal, and prioritizing capital improvements.'}
            </p>
          </div>
        </div>

        {/* Mode Specific Body */}
        {runMode === 'advisor' ? (
          /* ── Advisor Review Mode ── */
          <div className="space-y-5">
            {/* Card 1: Subject Business & Facility Location */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">Subject Business &amp; Location</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        Client Record
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">Facility context used for physical review analysis</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                    Business Name *
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    className="w-full text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                    Facility Location / Physical Address *
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="123 Main Street, City, State"
                    className="w-full text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Walkthrough Meeting Notes */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        Meeting Notes &amp; Walkthrough Observations *
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        Advisor Visit
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                      Observations from on-site visit, seller discussions, HVAC/equipment ages, and deferred maintenance
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={saveAdvisorNotes}
                  className="h-7 text-xs cursor-pointer"
                >
                  <Save className="w-3 h-3 mr-1" />
                  Save Notes
                </Button>
              </div>

              <div>
                <textarea
                  value={meetingNotes}
                  onChange={e => {
                    setMeetingNotes(e.target.value)
                    setError(null)
                  }}
                  rows={10}
                  placeholder="Paste or type Craig's facility visit notes, observations from the walkthrough, seller comments, equipment ages, and anything not captured in photos..."
                  className={cn(
                    'w-full text-xs rounded-md border bg-white p-3 text-slate-800 leading-relaxed focus:outline-none focus:ring-1 focus:ring-amber-500 min-h-[220px]',
                    advisorNotesMissing ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200',
                  )}
                />
                {advisorNotesMissing && (
                  <p className="text-[11px] text-amber-700 mt-1 font-medium">
                    Meeting notes are required before you can run the advisor facility review.
                  </p>
                )}
              </div>
            </div>

            {/* Card 3: Visit Photos */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-pink-50 border border-pink-100 text-pink-600 flex items-center justify-center shrink-0">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">On-Site Visit Photos</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-pink-50 text-pink-700 border border-pink-200">
                        {advisorImages.length} staged
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                      Upload photos from the facility walkthrough (exterior, kennels, play yards, grooming, equipment)
                    </p>
                  </div>
                </div>
              </div>

              <div
                {...getAdvisorRootProps()}
                className={cn(
                  'rounded-lg border border-dashed p-6 text-center cursor-pointer transition-colors',
                  advisorDragActive ? 'bg-amber-50 border-amber-300' : 'border-slate-200 hover:bg-slate-50',
                )}
              >
                <input {...getAdvisorInputProps()} />
                <Upload className="w-5 h-5 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">Drop visit photos here, or click to browse</p>
                <p className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WebP up to 5MB each (up to 20 photos)</p>
              </div>

              {advisorImages.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {advisorImages.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                    >
                      <Camera className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-slate-800">{file.name}</p>
                        <p className="text-[10px] text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAdvisorImages(current => current.filter((_, i) => i !== index))}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                        title="Remove photo"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 px-4 py-3 rounded-lg">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Action Footer for Advisor Review */}
            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2">
                {!advisorNotesMissing ? (
                  <span className="text-xs text-emerald-700 font-medium inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Meeting notes and {advisorImages.length} photo(s) staged. Ready for advisor review.
                  </span>
                ) : (
                  <span className="text-xs text-amber-700 font-medium inline-flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    Meeting notes / visit observations are required to generate the report.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <Button
                  type="button"
                  onClick={analyzeAdvisorRun}
                  disabled={analyzing || advisorNotesMissing}
                  className="h-9 px-5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                      Generating Advisor Summary Report...
                    </>
                  ) : (
                    <>
                      <FileText className="w-3.5 h-3.5 mr-2" />
                      Generate Advisor Summary Report
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* ── 360 Review Mode (Standard) ── */
          <div className="space-y-5">
            {/* Card 1: Subject Business Profile & Location */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">Subject Business Profile</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        Client Profile
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                      Business name and facility location used for zone review and compliance check
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                    Business Name *
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    className="w-full text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                    Facility Location / Physical Address *
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="123 Main Street, City, State"
                    className="w-full text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                  Additional Notes / Known Issues (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Add known maintenance issues, recent upgrades, or context the photos may not show."
                  className="w-full text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Card 2: Facility Physical Intake Form */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">Facility Physical Intake Form</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Client Portal Required Info
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                      Client responses prefilled automatically. Admins can verify, complete, or override missing responses.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void saveIntakeResponses({ draft: true })}
                    disabled={savingDraft || savingIntake}
                    className="h-7 text-xs cursor-pointer"
                  >
                    <Save className="w-3 h-3 mr-1" />
                    {savingDraft ? 'Saving Draft...' : 'Save Draft'}
                  </Button>
                </div>
              </div>

              {intakeQuestions.length > 0 ? (
                <div className="space-y-6 pt-1">
                  {Object.entries(groupedIntakeQuestions).map(([groupLabel, questions]) => (
                    <div key={groupLabel} className="space-y-3">
                      <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                          {groupLabel}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          ({questions.length} question{questions.length > 1 ? 's' : ''})
                        </span>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        {questions.map(question => {
                          const value = intakeResponses[question.fieldKey] ?? ''
                          const isMissing = question.required && !String(value).trim()
                          const fieldClass = cn(
                            'mt-1 w-full text-xs rounded-md border px-2.5 py-1.5 text-slate-800 outline-none transition-all focus:ring-1 focus:ring-amber-500',
                            isMissing ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200 bg-white',
                          )
                          return (
                            <label key={question.id} className={question.inputType === 'textarea' ? 'md:col-span-2' : ''}>
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 block">
                                {question.label}
                                {question.required && <span className="text-amber-600 font-bold"> *</span>}
                              </span>
                              {question.description && (
                                <span className="block text-[10px] text-slate-400 mt-0.5">{question.description}</span>
                              )}
                              {question.inputType === 'textarea' ? (
                                <textarea
                                  value={value}
                                  onChange={e => updateIntakeResponse(question.fieldKey, e.target.value)}
                                  placeholder={question.placeholder ?? ''}
                                  rows={3}
                                  className={cn(fieldClass, 'min-h-[70px] resize-y')}
                                />
                              ) : question.inputType === 'select' ? (
                                <select
                                  value={value}
                                  onChange={e => updateIntakeResponse(question.fieldKey, e.target.value)}
                                  className={fieldClass}
                                >
                                  <option value="">Select...</option>
                                  {(question.options ?? []).map(option => <option key={option} value={option}>{option}</option>)}
                                </select>
                              ) : (
                                <input
                                  type={question.inputType === 'number' ? 'number' : question.inputType === 'url' ? 'url' : 'text'}
                                  value={value}
                                  onChange={e => updateIntakeResponse(question.fieldKey, e.target.value)}
                                  placeholder={question.placeholder ?? ''}
                                  className={fieldClass}
                                />
                              )}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-3">No facility intake questions configured for this client workstream.</p>
              )}
            </div>

            {/* Card 3: Photo Documentation Checklist */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">Photo Documentation by Zone</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Supporting Evidence
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                      Client photos uploaded in the Client Portal prefill here. Recommended: 3-5 photos per zone.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {totalFiles} total photos
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    {completeSections} of {PHOTO_SECTIONS.length} zones complete
                  </span>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {PHOTO_SECTIONS.map(section => (
                  <SectionUploader
                    key={section.key}
                    sectionKey={section.key}
                    title={section.title}
                    prompt={section.prompt}
                    helper={section.helper}
                    files={sectionFiles[section.key]}
                    existingImages={existingSectionImages[section.key]}
                    onAdd={addSectionFiles}
                    onRemove={removeSectionFile}
                  />
                ))}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 px-4 py-3 rounded-lg">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Action Footer for 360 Review */}
            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2">
                {missingRequiredIntake.length === 0 ? (
                  <span className="text-xs text-emerald-700 font-medium inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    All required intake fields completed ({facilityIntakeEntries.length} answers) and {totalFiles} photos documented. Ready for 360 review.
                  </span>
                ) : (
                  <span className="text-xs text-amber-700 font-medium inline-flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    Complete {missingRequiredIntake.length} required intake field(s) to generate report.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void saveIntakeResponses({ draft: true })}
                  disabled={savingDraft || savingIntake}
                  className="h-9 px-4 text-xs font-medium cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                  {savingDraft ? 'Saving Draft...' : 'Save Draft'}
                </Button>

                <Button
                  type="button"
                  onClick={analyze}
                  disabled={analyzing || savingIntake || savingDraft || missingRequiredIntake.length > 0}
                  className="h-9 px-5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                      Generating Facility 360 Report...
                    </>
                  ) : (
                    <>
                      <Building2 className="w-3.5 h-3.5 mr-2" />
                      Generate Facility Report
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={deleteModalOpen}
        title="Delete Facility Review Report?"
        description="This will permanently remove the active facility assessment report from this client record. The underlying intake responses, notes, and uploaded photos will remain saved, allowing you to re-run at any time."
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteReport}
        confirmLabel="Delete Report"
        isDeleting={isDeleting}
      />

      {/* Status Toast */}
      <StatusToast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}
