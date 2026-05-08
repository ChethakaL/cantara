'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { AlertTriangle, Camera, CheckCircle, FileText, Loader2, Printer, RefreshCw, Save, Upload, X } from 'lucide-react'
import { Badge, Card, Input, Textarea, cn } from '@/components/ui'
import type { FacilityRating, FacilityReviewReport } from '@/lib/facility-review/types'
import { buildFacilityReviewReportHtml } from '@/lib/report-export/build-facility-review-report'

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

type PhotoSectionKey = typeof PHOTO_SECTIONS[number]['key']
type SectionFiles = Record<PhotoSectionKey, File[]>

function emptySectionFiles(): SectionFiles {
  return PHOTO_SECTIONS.reduce((acc, section) => {
    acc[section.key] = []
    return acc
  }, {} as SectionFiles)
}

function SectionUploader({
  sectionKey,
  title,
  prompt,
  helper,
  files,
  onAdd,
  onRemove,
}: {
  sectionKey: PhotoSectionKey
  title: string
  prompt: string
  helper: string
  files: File[]
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
  const complete = files.length >= 3

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
            <Badge color={complete ? 'green' : files.length ? 'gold' : 'gray'}>{files.length}/5</Badge>
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
      {files.length > 0 && (
        <div className="mt-3 space-y-2">
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

export default function FacilityReviewTab({ clientId, clientName, businessAddress }: { clientId: string; clientName: string; businessAddress?: string }) {
  const [businessName, setBusinessName] = useState(clientName)
  const [location, setLocation] = useState(businessAddress || '')
  const [notes, setNotes] = useState('')
  const [sectionFiles, setSectionFiles] = useState<SectionFiles>(() => emptySectionFiles())
  const [report, setReport] = useState<FacilityReviewReport | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadSaved = async () => {
      try {
        const res = await fetch(`/api/client-data/${clientId}?section=facilityReview`)
        if (res.ok) {
          const data = await res.json()
          if (data?.overallScore) setReport(data)
        }
      } catch {}
    }
    void loadSaved()
  }, [clientId])

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
  const totalFiles = PHOTO_SECTIONS.reduce((sum, section) => sum + sectionFiles[section.key].length, 0)
  const completeSections = PHOTO_SECTIONS.filter(section => sectionFiles[section.key].length >= 3).length

  const analyze = async () => {
    if (!totalFiles) {
      setError('Upload facility images first.')
      return
    }
    setAnalyzing(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('businessName', businessName)
      form.append('location', location)
      form.append('notes', notes)
      PHOTO_SECTIONS.forEach(section => {
        sectionFiles[section.key].forEach(file => {
          form.append('images', file)
          form.append('imageSections', section.title)
        })
      })
      const res = await fetch('/api/facility-review/analyze', { method: 'POST', body: form })
      if (!res.ok) throw new Error(await res.text())
      setReport(await res.json())
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
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    } catch (err: any) {
      setError(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
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

  if (report) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-800">Facility Assessment Report</h2>
              <Badge color={RATING_BADGE[report.overallRating]}>{report.overallRating}</Badge>
            </div>
            <p className="text-xs text-slate-400 mt-1">{report.businessName} - Generated {new Date(report.generatedAt).toLocaleString()}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setReport(null)} className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"><RefreshCw className="w-3.5 h-3.5" />New Run</button>
            <button onClick={save} disabled={saving} className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-slate-900 text-white disabled:opacity-50"><Save className="w-3.5 h-3.5" />{saving ? 'Saving...' : 'Save'}</button>
            <button onClick={openReport} className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><Printer className="w-3.5 h-3.5" />Export PDF</button>
            {saved && <span className="text-xs font-semibold text-emerald-600">Saved</span>}
          </div>
        </div>

        <Card className="p-6">
          <div className="grid gap-5 lg:grid-cols-[180px_1fr]">
            <div className="text-center border-r border-slate-100 pr-0 lg:pr-5">
              <div className="text-5xl font-bold text-slate-900">{report.overallScore}</div>
              <p className="text-xs text-slate-400">out of 100</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Overall Rating</p>
              <h3 className="text-xl font-semibold text-slate-800 mt-1">{report.overallRating}</h3>
              <p className="text-sm text-slate-600 mt-3 leading-6">{report.overallNarrative}</p>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100"><h3 className="text-sm font-semibold text-slate-800">Zone Scores at a Glance</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-400"><tr><th className="text-left px-5 py-3">Assessment Zone</th><th className="text-left px-5 py-3">Weight</th><th className="text-left px-5 py-3">Score</th><th className="text-left px-5 py-3">Rating</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{report.zones.map(zone => <tr key={zone.zone}><td className="px-5 py-3 font-medium text-slate-700">{zone.zone}</td><td className="px-5 py-3 text-slate-500">{zone.weight}%</td><td className="px-5 py-3 text-slate-700">{zone.score} / 100</td><td className="px-5 py-3"><Badge color={RATING_BADGE[zone.rating]}>{zone.rating}</Badge></td></tr>)}</tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-4">
          {sortedZones.map(zone => (
            <Card key={zone.zone} className="p-5">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <h3 className="text-base font-semibold text-slate-800">{zone.zone} - {zone.score}/100</h3>
                <Badge color={RATING_BADGE[zone.rating]}>{zone.rating}</Badge>
              </div>
              <p className="text-sm text-slate-600 leading-6">{zone.commentary}</p>
              <ul className="mt-4 space-y-2">{zone.keyFindings.map(item => <li key={item} className="flex gap-2 text-sm text-slate-600"><CheckCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />{item}</li>)}</ul>
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100"><h3 className="text-sm font-semibold text-slate-800">Prioritized Improvement Plan</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-400"><tr><th className="text-left px-5 py-3">Improvement</th><th className="text-left px-5 py-3">Zone</th><th className="text-left px-5 py-3">Impact</th><th className="text-left px-5 py-3">Effort</th><th className="text-left px-5 py-3">Timing</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{report.prioritizedImprovements.map(item => <tr key={`${item.improvement}-${item.timing}`}><td className="px-5 py-3 font-medium text-slate-700">{item.improvement}</td><td className="px-5 py-3 text-slate-500">{item.zone}</td><td className="px-5 py-3 text-slate-600">{item.valueImpact}</td><td className="px-5 py-3 text-slate-600">{item.effort}</td><td className="px-5 py-3 text-slate-600">{item.timing}</td></tr>)}</tbody>
            </table>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Facility Review Agent</h2>
        <p className="text-xs text-slate-400 mt-1">Upload structured facility photos by section. Target 3-5 photos per section for strongest report quality.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Business name" value={businessName} onChange={e => setBusinessName(e.target.value)} />
        <Input label="Location" value={location} onChange={e => setLocation(e.target.value)} placeholder="City, state/province" />
      </div>
      <Textarea label="Additional notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Add known maintenance issues, recent upgrades, or context the photos may not show." />

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold text-slate-800">Photo checklist</p>
          <Badge color={completeSections === PHOTO_SECTIONS.length ? 'green' : 'gold'}>{completeSections}/{PHOTO_SECTIONS.length} sections complete</Badge>
          <Badge color="slate">{totalFiles} photos uploaded</Badge>
        </div>
        <p className="text-xs text-amber-800 mt-2">Minimum to run: 1 photo. Recommended: 3-5 photos per section, 10-15+ photos total.</p>
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
            onAdd={addSectionFiles}
            onRemove={removeSectionFile}
          />
          ))}
      </div>
      {error && <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><AlertTriangle className="w-4 h-4 mt-0.5" />{error}</div>}
      <button onClick={analyze} disabled={analyzing || !totalFiles} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
        {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
        {analyzing ? 'Analyzing facility images...' : 'Generate Facility Report'}
      </button>
    </div>
  )
}
