'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { AlertTriangle, Camera, CheckCircle, FileText, Loader2, Pencil, Printer, RefreshCw, Save, Upload, X } from 'lucide-react'
import { Badge, Card, Input, Textarea, cn } from '@/components/ui'
import { agentTabReadOnlyGate } from '@/hooks/useAgentTabReadOnly'
import { AdvisorActions } from '@/components/client-portal/AgentClientPortalFrame'
import type { FacilityRating, FacilityReviewReport, FacilityImpact, FacilityEffort } from '@/lib/facility-review/types'
import { buildFacilityReviewReportHtml } from '@/lib/report-export/build-facility-review-report'
import { useAgentAiProvider } from '@/hooks/useAgentAiProvider'
import { AgentRunToolbar } from '@/components/admin/AgentRunToolbar'
import { resolveAgentModelId } from '@/lib/agent-model-provider'
import { useGenericAgentRuns } from '@/hooks/useGenericAgentRuns'
import { AGENT_RUN_KEYS } from '@/lib/agent-run-keys'
import { saveAgentAnalysisRunClient } from '@/lib/agent-analysis-runs.client'
import type { AgentRunHistoryItem } from '@/components/admin/AgentRunHistoryPanel'

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
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
            <Badge color={complete ? 'green' : totalCount ? 'gold' : 'gray'}>{totalCount}/5</Badge>
          </div>
          <p className="text-xs font-medium text-slate-600 mt-2">{prompt}</p>
          <p className="text-[11px] text-slate-400 mt-1">{helper}</p>
        </div>
      </div>
      <div
        {...getRootProps()}
        className={cn(
          'mt-4 rounded-lg border border-dashed p-5 text-center cursor-pointer transition-colors',
          isDragActive ? 'bg-amber-50 border-amber-300' : 'border-slate-200 hover:bg-slate-50'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="w-5 h-5 text-slate-300 mx-auto mb-2" />
        <p className="text-xs font-medium text-slate-600">Drop photos here, or click to browse</p>
      </div>
      {(existingImages.length > 0 || files.length > 0) && (
        <div className="mt-3 space-y-2">
          {existingImages.map(image => (
            <div key={image.id} className="flex items-center gap-2 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-emerald-800">{image.fileName}</p>
                <p className="text-[10px] text-emerald-600">Uploaded by client{image.uploadedAt ? ` · ${new Date(image.uploadedAt).toLocaleDateString()}` : ''}</p>
              </div>
            </div>
          ))}
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
              <Camera className="w-3.5 h-3.5 text-slate-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-700">{file.name}</p>
                <p className="text-[10px] text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <button onClick={() => onRemove(sectionKey, index)} className="text-slate-300 hover:text-rose-500">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export default function FacilityReviewTab({ clientId, clientName, businessAddress, readOnly = false }: { clientId: string; clientName: string; businessAddress?: string; readOnly?: boolean }) {
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

  useEffect(() => {
    if (!readOnly) return
    setEditMode(false)
  }, [readOnly])

  useEffect(() => {
    const loadSaved = async () => {
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
    }
    void loadSaved()
  }, [clientId])

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
      const meta = full.metadata as { runMode?: 'standard' | 'advisor' } | null | undefined
      if (meta?.runMode === 'advisor' || payload.reportVersion?.includes('Advisor Visit')) {
        setReportRunMode('advisor')
      } else {
        setReportRunMode('standard')
      }
    }
  }

  const persistFacilityRun = async (nextReport: FacilityReviewReport, runMode: 'standard' | 'advisor') => {
    await saveAgentAnalysisRunClient({
      clientId,
      agentKey: AGENT_RUN_KEYS.facilityReview,
      fileName: `${nextReport.businessName || clientName} — Facility Review`,
      report: nextReport,
      metadata: { runMode },
      aiProvider: provider,
      aiModel: resolveAgentModelId(provider),
    })
    await reloadRuns({ selectNewest: true })
  }

  const updateRunMode = async (nextMode: 'standard' | 'advisor') => {
    setRunMode(nextMode)
    setError(null)
    try {
      const res = await fetch('/api/agent-runs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          agentId: 'facility_review',
          facilityReviewMode: nextMode === 'advisor' ? 'advisor' : '360',
        }),
      })
      if (!res.ok) throw new Error(await res.text())
    } catch (err: any) {
      setError(err.message || 'Could not update facility review mode.')
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
      if (draft) {
        setDraftSaved(true)
        setTimeout(() => setDraftSaved(false), 1800)
      } else {
        setIntakeSaved(true)
        setTimeout(() => setIntakeSaved(false), 1800)
      }
      return true
    } catch (err: any) {
      setError(err.message || (draft ? 'Could not save intake draft.' : 'Could not save intake responses.'))
      return false
    } finally {
      if (draft) {
        setSavingDraft(false)
      } else {
        setSavingIntake(false)
      }
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
      const saved = await saveIntakeResponses({ draft: false })
      if (!saved) return
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
            // If an existing client image cannot be fetched from the browser, still use all available form data and local files.
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
      setTimeout(() => setSaved(false), 1800)
    } catch (err: any) {
      setError(err.message || 'Save failed')
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

  const openReport = () => {
    if (!report) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(buildFacilityReviewReportHtml(report))
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 300)
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

  if (report) {
    return (
      <div ref={reportTopRef} className="space-y-6">
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
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-800">Facility Assessment Report</h2>
              {reportRunMode === 'advisor' && <Badge color="blue">Advisor Review</Badge>}
              <Badge color={RATING_BADGE[report.overallRating]}>{report.overallRating}</Badge>
            </div>
            <p className="text-xs text-slate-400 mt-1">{report.businessName} - Generated {new Date(report.generatedAt).toLocaleString()}</p>
          </div>
          <AdvisorActions className="flex flex-wrap items-center gap-2">
            {!readOnly && (
              <>
                <button onClick={() => { setReport(null); setReportRunMode(null); setEditMode(false) }} className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"><RefreshCw className="w-3.5 h-3.5" />New Run</button>
                <button
                  onClick={() => {
                    if (editMode) void save()
                    setEditMode(!editMode)
                  }}
                  disabled={saving}
                  className={cn('flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg disabled:opacity-50', editMode ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
                >
                  {editMode ? <Save className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                  {editMode ? 'Done Editing' : 'Edit Output'}
                </button>
                <button onClick={save} disabled={saving} className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-slate-900 text-white disabled:opacity-50"><Save className="w-3.5 h-3.5" />{saving ? 'Saving...' : 'Save'}</button>
              </>
            )}
            <button onClick={openReport} className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><Printer className="w-3.5 h-3.5" />Export PDF</button>
            {saved && <span className="text-xs font-semibold text-emerald-600">Saved</span>}
          </AdvisorActions>
        </div>

        <Card className="p-6">
          <div className="grid gap-5 lg:grid-cols-[180px_1fr]">
            <div className="text-center border-r border-slate-100 pr-0 lg:pr-5">
              {editMode ? (
                <input
                  type="number"
                  value={report.overallScore}
                  onChange={e => updateReport({ overallScore: Number(e.target.value) })}
                  className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-center text-4xl font-bold text-slate-900 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
                />
              ) : (
                <div className="text-5xl font-bold text-slate-900">{report.overallScore}</div>
              )}
              <p className="text-xs text-slate-400">out of 100</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Overall Rating</p>
              {editMode ? (
                <select
                  value={report.overallRating}
                  onChange={e => updateReport({ overallRating: e.target.value as FacilityRating })}
                  className="mt-1 rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-700 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
                >
                  {Object.keys(RATING_BADGE).map(rating => <option key={rating} value={rating}>{rating}</option>)}
                </select>
              ) : (
                <h3 className="text-xl font-semibold text-slate-800 mt-1">{report.overallRating}</h3>
              )}
              {editMode ? (
                <textarea
                  value={report.overallNarrative}
                  onChange={e => updateReport({ overallNarrative: e.target.value })}
                  rows={5}
                  className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6 text-slate-600 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
                />
              ) : (
                <p className="text-sm text-slate-600 mt-3 leading-6">{report.overallNarrative}</p>
              )}
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100"><h3 className="text-sm font-semibold text-slate-800">Zone Scores at a Glance</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-400">
                <tr>
                  <th className="text-left px-5 py-3">Assessment Zone</th>
                  <th className="text-left px-5 py-3">Weight</th>
                  <th className="text-left px-5 py-3">Score</th>
                  <th className="text-left px-5 py-3">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.zones.map((zone, index) => (
                  <tr key={zone.zone}>
                    <td className="px-5 py-3 font-medium text-slate-700">{zone.zone}</td>
                    <td className="px-5 py-3 text-slate-500">{zone.weight}%</td>
                    <td className="px-5 py-3 text-slate-700">
                      {editMode ? (
                        <input
                          type="number"
                          value={zone.score}
                          onChange={e => updateZone(index, { score: Number(e.target.value) })}
                          className="w-20 rounded border border-slate-200 px-2 py-1 text-xs"
                        />
                      ) : (
                        `${zone.score} / 100`
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {editMode ? (
                        <select
                          value={zone.rating}
                          onChange={e => updateZone(index, { rating: e.target.value as FacilityRating })}
                          className="text-xs rounded border border-slate-200 bg-white px-1.5 py-0.5 outline-none font-medium text-slate-700"
                        >
                          {Object.keys(RATING_BADGE).map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      ) : (
                        <Badge color={RATING_BADGE[zone.rating]}>{zone.rating}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-4">
          {sortedZones.map(zone => {
            const zoneIndex = report.zones.findIndex(item => item.zone === zone.zone)
            return (
              <Card key={zone.zone} className="p-5">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <h3 className="text-base font-semibold text-slate-800">{zone.zone} - {zone.score}/100</h3>
                  {editMode ? (
                    <select
                      value={zone.rating}
                      onChange={e => updateZone(zoneIndex, { rating: e.target.value as FacilityRating })}
                      className="text-xs rounded border border-slate-200 bg-white px-2 py-1 outline-none font-medium text-slate-700"
                    >
                      {Object.keys(RATING_BADGE).map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  ) : (
                    <Badge color={RATING_BADGE[zone.rating]}>{zone.rating}</Badge>
                  )}
                </div>
                {editMode ? (
                  <textarea
                    value={zone.commentary}
                    onChange={e => updateZone(zoneIndex, { commentary: e.target.value })}
                    rows={4}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6 text-slate-600 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
                  />
                ) : (
                  <p className="text-sm text-slate-600 leading-6">{zone.commentary}</p>
                )}

                <div className="mt-4 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Key findings:</p>
                  {editMode ? (
                    <div className="space-y-2">
                      {zone.keyFindings.map((finding, findIdx) => (
                        <div key={findIdx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={finding}
                            onChange={e => {
                              const keyFindings = [...zone.keyFindings]
                              keyFindings[findIdx] = e.target.value
                              updateZone(zoneIndex, { keyFindings })
                            }}
                            className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs outline-none bg-white text-slate-700"
                          />
                          <button
                            type="button"
                            className="text-rose-500 hover:text-rose-700"
                            onClick={() => {
                              const keyFindings = zone.keyFindings.filter((_, idx) => idx !== findIdx)
                              updateZone(zoneIndex, { keyFindings })
                            }}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const keyFindings = [...zone.keyFindings, 'New Key Finding']
                          updateZone(zoneIndex, { keyFindings })
                        }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        + Add Finding
                      </button>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {zone.keyFindings.map(item => (
                        <li key={item} className="flex gap-2 text-sm text-slate-600">
                          <CheckCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            )
          })}
        </div>

        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Prioritized Improvement Plan</h3>
            {editMode && (
              <button
                type="button"
                onClick={() => {
                  const newItem = {
                    improvement: 'New Improvement',
                    zone: report.zones[0]?.zone || 'Exterior & Curb Appeal',
                    valueImpact: 'Medium' as FacilityImpact,
                    effort: 'Medium' as FacilityEffort,
                    timing: '1-3 months',
                  }
                  updateReport({ prioritizedImprovements: [...report.prioritizedImprovements, newItem] })
                }}
                className="px-3 py-1.5 text-xs font-medium rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
              >
                + Add Improvement
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-400">
                <tr>
                  <th className="text-left px-5 py-3">Improvement</th>
                  <th className="text-left px-5 py-3">Zone</th>
                  <th className="text-left px-5 py-3">Impact</th>
                  <th className="text-left px-5 py-3">Effort</th>
                  <th className="text-left px-5 py-3">Timing</th>
                  {editMode && <th className="text-left px-5 py-3">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.prioritizedImprovements.map((item, index) => (
                  <tr key={index}>
                    <td className="px-5 py-3 font-medium text-slate-700">
                      {editMode ? (
                        <input
                          value={item.improvement}
                          onChange={e => updateImprovement(index, { improvement: e.target.value })}
                          className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none"
                        />
                      ) : (
                        item.improvement
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {editMode ? (
                        <select
                          value={item.zone}
                          onChange={e => updateImprovement(index, { zone: e.target.value })}
                          className="text-xs rounded border border-slate-200 bg-white px-2 py-1 outline-none font-medium text-slate-700"
                        >
                          {report.zones.map(z => (
                            <option key={z.zone} value={z.zone}>{z.zone}</option>
                          ))}
                        </select>
                      ) : (
                        item.zone
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {editMode ? (
                        <select
                          value={item.valueImpact}
                          onChange={e => updateImprovement(index, { valueImpact: e.target.value as FacilityImpact })}
                          className="text-xs rounded border border-slate-200 bg-white px-2 py-1 outline-none font-medium text-slate-700"
                        >
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      ) : (
                        item.valueImpact
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {editMode ? (
                        <select
                          value={item.effort}
                          onChange={e => updateImprovement(index, { effort: e.target.value as FacilityEffort })}
                          className="text-xs rounded border border-slate-200 bg-white px-2 py-1 outline-none font-medium text-slate-700"
                        >
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      ) : (
                        item.effort
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {editMode ? (
                        <input
                          value={item.timing}
                          onChange={e => updateImprovement(index, { timing: e.target.value })}
                          className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none"
                        />
                      ) : (
                        item.timing
                      )}
                    </td>
                    {editMode && (
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          className="text-rose-500 hover:text-rose-700"
                          onClick={() => {
                            const prioritizedImprovements = report.prioritizedImprovements.filter((_, i) => i !== index)
                            updateReport({ prioritizedImprovements })
                          }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    )
  }

  const readOnlyGate = agentTabReadOnlyGate(readOnly, !hydrated, Boolean(report), 'Facility Review')
  if (readOnlyGate) return readOnlyGate

  return (
    <div className="space-y-6">
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
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Facility Review Agent</h2>
          <p className="text-xs text-slate-400 mt-1">
            {runMode === 'advisor'
              ? 'Generate the advisor review report using advisor visit notes and photos only.'
              : 'Generate the 360 Review from the mandatory seller intake form. Facility photos are optional supporting evidence.'}
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => void updateRunMode('standard')}
            className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-colors', runMode === 'standard' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500')}
          >
            360 Review
          </button>
          <button
            type="button"
            onClick={() => void updateRunMode('advisor')}
            className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-colors', runMode === 'advisor' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500')}
          >
            Advisor Review
          </button>
        </div>
      </div>

      {runMode === 'advisor' ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Business name" value={businessName} onChange={e => setBusinessName(e.target.value)} />
            <Input label="Location" value={location} onChange={e => setLocation(e.target.value)} placeholder="City, state/province" />
          </div>
          <Textarea
            label="Meeting notes / visit observations"
            value={meetingNotes}
            onChange={e => { setMeetingNotes(e.target.value); setError(null) }}
            rows={10}
            className={cn('min-h-[220px] resize-y leading-relaxed', advisorNotesMissing && 'border-amber-300 ring-1 ring-amber-200')}
            placeholder="Paste or type Craig's facility visit notes, observations from the walkthrough, seller comments, and anything not captured in photos."
          />
          {advisorNotesMissing && (
            <p className="text-xs text-amber-700">Meeting notes are required before you can generate the advisor summary report.</p>
          )}
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-slate-800">Visit photos</h3>
            <p className="text-xs text-slate-400 mt-1">Upload images from the facility visit. These support the summary report.</p>
            <div
              {...getAdvisorRootProps()}
              className={cn(
                'mt-4 rounded-lg border border-dashed p-5 text-center cursor-pointer transition-colors',
                advisorDragActive ? 'bg-amber-50 border-amber-300' : 'border-slate-200 hover:bg-slate-50'
              )}
            >
              <input {...getAdvisorInputProps()} />
              <Upload className="w-5 h-5 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-medium text-slate-600">Drop visit photos here, or click to browse</p>
            </div>
            {advisorImages.length > 0 && (
              <div className="mt-3 space-y-2">
                {advisorImages.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
                    <Camera className="w-3.5 h-3.5 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-700">{file.name}</p>
                      <p className="text-[10px] text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button onClick={() => setAdvisorImages(current => current.filter((_, i) => i !== index))} className="text-slate-300 hover:text-rose-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
          {error && <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><AlertTriangle className="w-4 h-4 mt-0.5" />{error}</div>}
          <span
            className="inline-block"
            title={advisorNotesMissing ? 'Fill in meeting notes / visit observations to generate the report.' : undefined}
          >
            <button
              onClick={analyzeAdvisorRun}
              disabled={analyzing || advisorNotesMissing}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {analyzing ? 'Generating summary report...' : 'Generate Advisor Summary Report'}
            </button>
          </span>
        </>
      ) : (
        <>
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Business name" value={businessName} onChange={e => setBusinessName(e.target.value)} />
        <Input label="Location" value={location} onChange={e => setLocation(e.target.value)} placeholder="City, state/province" />
      </div>
      <Textarea label="Additional notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Add known maintenance issues, recent upgrades, or context the photos may not show." />

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Facility Intake Form</h3>
            <p className="text-xs text-slate-400 mt-1">Client answers prefill here. Admins can complete or override missing responses.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge color={missingRequiredIntake.length ? 'gold' : 'green'}>{missingRequiredIntake.length ? `${missingRequiredIntake.length} required missing` : 'Complete'}</Badge>
            <Badge color="slate">{facilityIntakeEntries.length} answers</Badge>
          </div>
        </div>
        {intakeQuestions.length > 0 ? (
          <div className="mt-4 space-y-5">
            {Object.entries(groupedIntakeQuestions).map(([groupLabel, questions]) => (
              <div key={groupLabel} className="space-y-3">
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{groupLabel}</h4>
                <div className="grid gap-3 md:grid-cols-2">
                  {questions.map(question => {
                    const value = intakeResponses[question.fieldKey] ?? ''
                    const isMissing = question.required && !String(value).trim()
                    const fieldClass = cn(
                      'mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-cantara-gold focus:ring-2 focus:ring-cantara-gold/20',
                      isMissing ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200 bg-white'
                    )
                    return (
                      <label key={question.id} className={question.inputType === 'textarea' ? 'md:col-span-2' : ''}>
                        <span className="text-xs font-medium text-slate-600">
                          {question.label}
                          {question.required && <span className="text-amber-600"> *</span>}
                        </span>
                        {question.description && <span className="block text-[11px] text-slate-400 mt-0.5">{question.description}</span>}
                        {question.inputType === 'textarea' ? (
                          <textarea
                            value={value}
                            onChange={e => updateIntakeResponse(question.fieldKey, e.target.value)}
                            placeholder={question.placeholder ?? ''}
                            rows={3}
                            className={cn(fieldClass, 'min-h-[84px] resize-y')}
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
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => void saveIntakeResponses({ draft: true })} disabled={savingDraft || savingIntake} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                <Save className="w-3.5 h-3.5" />
                {savingDraft ? 'Saving Draft...' : 'Save Draft'}
              </button>
              {draftSaved && <span className="text-xs font-semibold text-emerald-600">Draft saved</span>}
              {intakeSaved && <span className="text-xs font-semibold text-emerald-600">Intake saved</span>}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-xs text-slate-500">No facility intake questions found for this client workstream.</p>
        )}
      </Card>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold text-slate-800">Photo checklist</p>
          <Badge color={completeSections === PHOTO_SECTIONS.length ? 'green' : 'gold'}>{completeSections}/{PHOTO_SECTIONS.length} sections complete</Badge>
          <Badge color="slate">{totalFiles} photos uploaded</Badge>
        </div>
        <p className="text-xs text-amber-800 mt-2">Photos are optional. Recommended: 3-5 photos per section, 10-15+ photos total.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
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
      {error && <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><AlertTriangle className="w-4 h-4 mt-0.5" />{error}</div>}
      <button onClick={analyze} disabled={analyzing || savingIntake || savingDraft || missingRequiredIntake.length > 0} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
        {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
        {analyzing ? 'Generating facility report...' : 'Generate Facility Report'}
      </button>
        </>
      )}
    </div>
  )
}
