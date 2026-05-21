'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  ChevronDown,
  CheckCircle2,
  Clock3,
  FileUp,
  Link as LinkIcon,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Unplug,
  Video,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Badge, Button, Card, DatePicker, Input, Modal, Textarea } from '@/components/ui'

type NylasStatus = {
  configured: boolean
  connected: boolean
  connection: {
    id: string
    grantId: string
    email?: string | null
    provider?: string | null
    calendarIds?: string[]
  } | null
}

type CalendarEvent = {
  id: string
  title?: string
  location?: string
  calendar_id?: string
  when?: { start_time?: number; end_time?: number }
  conferencing?: Array<{ url?: string; meeting_link?: string; details?: { url?: string } }>
  locations?: Array<{ uri?: string }>
}

type MeetingReport = {
  id: string
  report: string
  createdAt: string
}

type Meeting = {
  id: string
  title: string
  startAt: string
  endAt?: string | null
  source: 'MANUAL' | 'CALENDAR'
  agenda?: string | null
  agendaTags: string[]
  meetingUrl?: string | null
  notesText?: string | null
  notesFileName?: string | null
  notesUploadedAt?: string | null
  reportStatus: 'IDLE' | 'RUNNING' | 'COMPLETE' | 'FAILED'
  reportStartedAt?: string | null
  lastReportedAt?: string | null
  externalEventId?: string | null
  nylasNotetakerId?: string | null
  nylasNotetakerState?: string | null
  nylasNotetakerLastWebhookAt?: string | null
  reports: MeetingReport[]
}

type TranscriptSegment = {
  speaker: string | null
  text: string
}

type ReportSections = {
  snapshot: string
  summary: string
  coverage: string
  discussion: string
  decisions: string
  risks: string
  actions: string
  questions: string
  strategic: string
  full: string
}

type ReportTabKey = keyof Omit<ReportSections, 'full'>

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes <= 0) return `${seconds}s`
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`
}

function eventMeetingUrl(event: CalendarEvent) {
  const conferencingItems = Array.isArray(event.conferencing)
    ? event.conferencing
    : event.conferencing && typeof event.conferencing === 'object'
      ? [event.conferencing]
      : []

  for (const conferencing of conferencingItems) {
    if (conferencing.url) return conferencing.url
    if (conferencing.meeting_link) return conferencing.meeting_link
    if (conferencing.details?.url) return conferencing.details.url
  }

  const locationItems = Array.isArray(event.locations)
    ? event.locations
    : event.locations && typeof event.locations === 'object'
      ? [event.locations]
      : []

  for (const location of locationItems) {
    if (location.uri) return location.uri
  }
  return event.location || ''
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function normalizeTypedTime(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits

  const hour = digits.slice(0, 2)
  const minute = digits.slice(2, 4)
  return `${hour}:${minute}`
}

function clampTime(value: string) {
  const match = value.match(/^(\d{1,2})(?::?(\d{1,2}))?$/)
  if (!match) return value

  const hours = Math.min(23, Math.max(0, Number(match[1] || '0')))
  const minutes = Math.min(59, Math.max(0, Number(match[2] || '0')))
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function parseAgendaTags(value: string | string[]) {
  const raw = Array.isArray(value) ? value : value.split(',')
  return raw
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function normalizeAdminLanguage(value: string) {
  return value
    .replace(/\bCraig Pollack\b/gi, 'Cantara Admin')
    .replace(/\bCraig's\b/gi, "Admin's")
    .replace(/\bCraig\b/gi, 'Admin')
    .replace(/For Admin's Strategic Consideration/gi, "Admin's Strategic Considerations")
}

function extractReportSections(markdown: string): ReportSections {
  const normalized = normalizeAdminLanguage(markdown)
  const matches = Array.from(normalized.matchAll(/^##\s+(.+)$/gm))
  const sections: Record<string, string> = {}

  for (let index = 0; index < matches.length; index += 1) {
    const heading = matches[index][1].trim().toLowerCase()
    const start = matches[index].index! + matches[index][0].length
    const end = index + 1 < matches.length ? matches[index + 1].index! : normalized.length
    sections[heading] = normalized.slice(start, end).trim()
  }

  return {
    snapshot: sections['meeting snapshot'] || '',
    summary: sections['executive summary'] || '',
    coverage: sections['agenda coverage'] || '',
    discussion: sections['key discussion points'] || '',
    decisions: sections['decisions made'] || '',
    risks: sections['risks and blockers'] || '',
    actions: sections['action items'] || '',
    questions: sections['follow-up questions'] || '',
    strategic: sections['admin strategic considerations'] || sections['advisor notes'] || '',
    full: normalized,
  }
}

function parseTranscriptSegments(notes: string): TranscriptSegment[] {
  const cleaned = notes
    .replace(/^transcript\s*$/gim, '')
    .replace(/^speaker_labelled\s*$/gim, '')
    .trim()

  if (!cleaned) return []

  const speakerRegex = /(^|\n)([A-Z][A-Za-z .'-]{1,80}):\s/g
  const matches = Array.from(cleaned.matchAll(speakerRegex))
  if (!matches.length) {
    return cleaned
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((text) => ({ speaker: null, text }))
  }

  const segments: TranscriptSegment[] = []
  for (let index = 0; index < matches.length; index += 1) {
    const start = matches[index].index! + matches[index][0].length
    const end = index + 1 < matches.length ? matches[index + 1].index! : cleaned.length
    const speaker = matches[index][2].trim()
    const text = cleaned.slice(start, end).replace(/\n+/g, ' ').trim()
    if (text) segments.push({ speaker, text })
  }

  return segments
}

function statusBadgeColor(status: Meeting['reportStatus']) {
  if (status === 'COMPLETE') return 'green'
  if (status === 'RUNNING') return 'blue'
  if (status === 'FAILED') return 'red'
  return 'slate'
}

function notetakerStatusTone(state?: string | null) {
  const normalized = (state || '').toLowerCase()
  if (['joined', 'recording', 'completed', 'media_ready'].includes(normalized)) return 'green'
  if (['failed', 'error', 'cancelled'].includes(normalized)) return 'red'
  if (['connecting', 'scheduled', 'invited', 'pending', 'processing'].includes(normalized)) return 'blue'
  return 'slate'
}

function notetakerStatusLabel(state?: string | null) {
  const normalized = (state || '').toLowerCase()
  if (normalized === 'joined') return 'Meeting assistant joined'
  if (normalized === 'recording') return 'Meeting assistant recording'
  if (normalized === 'completed') return 'Meeting assistant complete'
  if (normalized === 'media_ready') return 'Meeting notes ready'
  if (normalized === 'failed') return 'Assistant issue'
  if (normalized === 'cancelled') return 'Assistant cancelled'
  if (normalized === 'scheduled') return 'Assistant scheduled'
  if (normalized === 'invited') return 'Assistant invited'
  if (normalized === 'pending') return 'Assistant preparing'
  if (normalized === 'processing') return 'Meeting assistant processing'
  if (normalized === 'connecting') return 'Assistant connecting'
  return 'Assistant active'
}

function CustomTimeInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-slate-600">{label}</label>
      <div className="relative">
        <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          inputMode="numeric"
          placeholder="HH:MM"
          value={value}
          onChange={(event) => onChange(normalizeTypedTime(event.target.value))}
          onBlur={(event) => onChange(clampTime(event.target.value))}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-700 outline-none transition-all focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
        />
      </div>
    </div>
  )
}

function NotesPreview({ notesText }: { notesText: string }) {
  const segments = useMemo(() => parseTranscriptSegments(notesText), [notesText])

  if (!notesText.trim()) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-5 text-sm text-slate-500">
        Waiting for meeting notes to arrive automatically. You can still upload a notes file if needed.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {segments.map((segment, index) => (
        <div key={`${segment.speaker || 'note'}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          {segment.speaker ? (
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{segment.speaker}</p>
          ) : null}
          <p className="text-sm leading-7 text-slate-700">{segment.text}</p>
        </div>
      ))}
    </div>
  )
}

function combineSections(...parts: Array<string | undefined>) {
  const normalized = parts.map((part) => (part || '').trim()).filter(Boolean)
  const seen = new Set<string>()
  const unique = normalized.filter((part) => {
    const key = part.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return unique.join('\n\n')
}

async function readApiResponse(response: Response) {
  const text = await response.text()
  let data: any = null

  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }

  const fallbackError =
    response.status >= 500
      ? 'The service is temporarily unavailable. Please try again in a moment.'
      : 'We could not complete that request. Please try again.'

  return {
    ok: response.ok,
    data,
    error:
      (data && typeof data.error === 'string' && data.error) ||
      (data && typeof data.message === 'string' && data.message) ||
      fallbackError,
  }
}

function ReportPanel({
  latestReport,
  meeting,
}: {
  latestReport: MeetingReport | null
  meeting: Meeting
}) {
  const sections = useMemo(
    () => extractReportSections(latestReport?.report || ''),
    [latestReport?.report]
  )
  const [activeTab, setActiveTab] = useState<ReportTabKey>('summary')

  useEffect(() => {
    setActiveTab('summary')
  }, [latestReport?.id])

  const tabs: Array<{ key: ReportTabKey; label: string; content: string }> = [
    {
      key: 'summary',
      label: 'Summary',
      content: combineSections(sections.snapshot, sections.summary, sections.discussion),
    },
    {
      key: 'decisions',
      label: 'Decisions',
      content: combineSections(sections.decisions, sections.coverage, sections.questions),
    },
    {
      key: 'actions',
      label: 'Actions',
      content: combineSections(sections.actions, sections.questions, sections.coverage),
    },
    {
      key: 'risks',
      label: 'Risks',
      content: combineSections(sections.risks, sections.coverage, sections.discussion),
    },
    {
      key: 'strategic',
      label: 'Admin View',
      content: combineSections(sections.strategic, sections.decisions, sections.risks),
    },
  ]

  const selected = tabs.find((tab) => tab.key === activeTab) || tabs[0]

  return (
    <div className="rounded-3xl border border-slate-200 bg-white">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Meeting Report</p>
          <p className="mt-2 text-sm text-slate-500">
            {latestReport ? `Generated ${formatDateTime(latestReport.createdAt)}` : 'Run the report once the notes are ready.'}
          </p>
        </div>
        {latestReport ? (
          <Badge color="green" className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Ready
          </Badge>
        ) : (
          <Badge color={statusBadgeColor(meeting.reportStatus)}>
            {meeting.reportStatus === 'RUNNING' ? 'Running' : 'Awaiting report'}
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-6 border-b border-slate-100 px-5 pt-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            disabled={!latestReport}
            onClick={() => setActiveTab(tab.key)}
            className={`border-b-2 pb-3 text-sm font-medium transition-all ${
              latestReport
                ? activeTab === tab.key
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
                : 'border-transparent text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {latestReport ? (
        <div className="space-y-5 p-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
            <p className="text-xl font-semibold text-slate-900 cantara-serif">{meeting.title}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Client</p>
                <p className="mt-1 text-sm font-medium text-slate-700">Administrative review</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Meeting Date</p>
                <p className="mt-1 text-sm font-medium text-slate-700">{formatDateTime(meeting.startAt)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{selected.label}</p>
            <div className="prose prose-slate mt-4 max-w-none prose-headings:font-semibold prose-headings:text-slate-900 prose-p:text-slate-700 prose-strong:text-slate-900 prose-table:w-full prose-table:border-separate prose-table:border-spacing-0 prose-th:border prose-th:border-slate-200 prose-th:bg-slate-50 prose-th:px-3 prose-th:py-2 prose-td:border prose-td:border-slate-200 prose-td:px-3 prose-td:py-2">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {selected.content || 'No content was generated for this section.'}
              </ReactMarkdown>
            </div>
          </div>

          <details className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">Open full report</summary>
            <div className="prose prose-slate mt-4 max-w-none prose-headings:font-semibold prose-headings:text-slate-900 prose-p:text-slate-700 prose-strong:text-slate-900 prose-table:w-full prose-table:border-separate prose-table:border-spacing-0 prose-th:border prose-th:border-slate-200 prose-th:bg-white prose-th:px-3 prose-th:py-2 prose-td:border prose-td:border-slate-200 prose-td:px-3 prose-td:py-2">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{sections.full}</ReactMarkdown>
            </div>
          </details>
        </div>
      ) : (
        <div className="p-5">
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-8">
          <p className="text-sm font-medium text-slate-700">Report view is locked until the report runs.</p>
          <p className="mt-2 text-sm text-slate-500">
            Meeting notes will feed into the report, then this area will open with organized sections for summary, decisions, actions, risks, and the administrative view.
          </p>
        </div>
        </div>
      )}
    </div>
  )
}

function MeetingCard({
  clientId,
  meeting,
  onMeetingChange,
  onMeetingDelete,
}: {
  clientId: string
  meeting: Meeting
  onMeetingChange: (item: Meeting) => void
  onMeetingDelete: (meetingId: string) => void
}) {
  const [agenda, setAgenda] = useState(meeting.agenda || '')
  const [agendaTags, setAgendaTags] = useState(meeting.agendaTags.join(', '))
  const [meetingUrl, setMeetingUrl] = useState(meeting.meetingUrl || '')
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [runningReport, setRunningReport] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const latestReport = meeting.reports?.[0] || null
  const effectiveRunStartMs = runStartedAt ?? (meeting.reportStartedAt ? new Date(meeting.reportStartedAt).getTime() : null)
  const isReportRunning = runningReport || meeting.reportStatus === 'RUNNING'
  const normalizedMeetingAgendaTags = useMemo(() => parseAgendaTags(meeting.agendaTags), [meeting.agendaTags])
  const normalizedDraftAgendaTags = useMemo(() => parseAgendaTags(agendaTags), [agendaTags])
  const displayTags = useMemo(() => parseAgendaTags(agendaTags), [agendaTags])
  const hasUnsavedChanges =
    agenda !== (meeting.agenda || '') ||
    meetingUrl !== (meeting.meetingUrl || '') ||
    normalizedDraftAgendaTags.join('|').toLowerCase() !== normalizedMeetingAgendaTags.join('|').toLowerCase()

  useEffect(() => {
    setAgenda(meeting.agenda || '')
    setAgendaTags(meeting.agendaTags.join(', '))
    setMeetingUrl(meeting.meetingUrl || '')
  }, [meeting])

  useEffect(() => {
    if (!effectiveRunStartMs || !isReportRunning) {
      setElapsedMs(0)
      return
    }
    const tick = () => setElapsedMs(Date.now() - effectiveRunStartMs)
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [effectiveRunStartMs, isReportRunning])

  async function saveMeeting() {
    if (!hasUnsavedChanges) return
    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/clients/${clientId}/meetings/${meeting.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agenda,
          agendaTags,
          meetingUrl,
          notesText: meeting.notesText || '',
          notesFileName: meeting.notesFileName || null,
          notesUploadedAt: meeting.notesUploadedAt || null,
        }),
      })

      const { data, error } = await readApiResponse(response)
      if (!response.ok) throw new Error(error || 'We could not save the meeting updates.')
      if (data.item) onMeetingChange(data.item)
      setMessage('Meeting saved.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'We could not save the meeting updates.')
    } finally {
      setSaving(false)
    }
  }

  async function autoSaveMeeting() {
    if (!hasUnsavedChanges || saving || uploading || runningReport) return
    await saveMeeting()
  }

  async function uploadNotes(file: File) {
    setUploading(true)
    setMessage(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const response = await fetch(`/api/clients/${clientId}/meetings/${meeting.id}/notes`, {
        method: 'POST',
        body: form,
      })
      const { data, error } = await readApiResponse(response)
      if (!response.ok) throw new Error(error || 'We could not upload the meeting notes.')
      if (data.item) onMeetingChange(data.item)
      setMessage(`Notes uploaded from ${file.name}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'We could not upload the meeting notes.')
    } finally {
      setUploading(false)
    }
  }

  async function runReport() {
    setRunningReport(true)
    setRunStartedAt(Date.now())
    setMessage(null)
    try {
      const response = await fetch(`/api/clients/${clientId}/meetings/${meeting.id}/report`, { method: 'POST' })
      const { data, error } = await readApiResponse(response)
      if (!response.ok) throw new Error(error || 'The report could not be generated right now.')
      if (data.item) onMeetingChange(data.item)
      setMessage('Detailed report generated.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The report could not be generated right now.')
    } finally {
      setRunningReport(false)
      setRunStartedAt(null)
    }
  }

  async function refreshMeeting() {
    setRefreshing(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/clients/${clientId}/meetings/${meeting.id}/assistant/refresh`, {
        method: 'POST',
      })
      const { data, error } = await readApiResponse(response)
      if (!response.ok) throw new Error(error || 'Meeting notes are being prepared. Please check back in a few minutes.')
      if (data.item) onMeetingChange(data.item)
      if (data.message) setMessage(data.message)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Meeting notes are being prepared. This usually takes around 5 to 10 minutes.'
      )
    } finally {
      setRefreshing(false)
    }
  }

  async function deleteMeeting() {
    setDeleting(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/clients/${clientId}/meetings/${meeting.id}`, {
        method: 'DELETE',
      })
      const { error } = await readApiResponse(response)
      if (!response.ok) throw new Error(error || 'We could not delete the meeting.')
      onMeetingDelete(meeting.id)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'We could not delete the meeting.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-100 bg-gradient-to-r from-white via-slate-50/80 to-amber-50/60 px-6 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xl font-semibold text-slate-900 cantara-serif">{meeting.title}</p>
              <Badge color={meeting.source === 'CALENDAR' ? 'blue' : 'slate'}>
                {meeting.source === 'CALENDAR' ? 'Calendar' : 'Manual'}
              </Badge>
              {meeting.agendaTags.some((tag) => tag.toLowerCase() === 'add agenda') || !meeting.agenda?.trim() ? (
                <Badge color="gold">Add agenda</Badge>
              ) : null}
              {meeting.nylasNotetakerId ? (
                <Badge color={notetakerStatusTone(meeting.nylasNotetakerState)}>
                  {notetakerStatusLabel(meeting.nylasNotetakerState)}
                </Badge>
              ) : null}
              <Badge color={statusBadgeColor(meeting.reportStatus)}>
                {meeting.reportStatus === 'IDLE' ? 'No report yet' : meeting.reportStatus.toLowerCase()}
              </Badge>
              {isReportRunning ? (
                <Badge color="blue" className="inline-flex items-center gap-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Running {formatDuration(elapsedMs)}
                </Badge>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" /> {formatDateTime(meeting.startAt)}
              </span>
              {meeting.meetingUrl ? (
                <a
                  href={meeting.meetingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700"
                >
                  <Video className="h-4 w-4" /> Join link
                </a>
              ) : null}
              {meeting.notesFileName ? <span>Notes source: {meeting.notesFileName}</span> : null}
              {meeting.nylasNotetakerLastWebhookAt ? (
                <span>Assistant updated {formatDateTime(meeting.nylasNotetakerLastWebhookAt)}</span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {saving ? <Badge color="blue">Saving...</Badge> : null}
            {!saving && hasUnsavedChanges ? <Badge color="gold">Unsaved changes</Badge> : null}
            {!saving && !hasUnsavedChanges ? <Badge color="green">Saved</Badge> : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refreshMeeting()}
              disabled={refreshing || saving || uploading || runningReport}
              className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh assistant
            </Button>
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-800"
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {expanded ? (
        <div className="space-y-6 px-6 py-6">
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-5">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 xl:min-h-[620px] xl:max-h-[760px] xl:overflow-y-auto">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Meeting Setup</p>
                <div className="mt-4 space-y-4">
                <Textarea
                  label="Agenda"
                  rows={4}
                  value={agenda}
                  onChange={(event) => setAgenda(event.target.value)}
                  onBlur={() => void autoSaveMeeting()}
                  placeholder="Add the meeting agenda or discussion plan."
                />

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-600">Agenda Tags</label>
                  <div className="flex min-h-[56px] flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                    {displayTags.length ? (
                      displayTags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800"
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">Add topic tags for the report focus.</span>
                    )}
                  </div>
                  <Input
                    value={agendaTags}
                    onChange={(event) => setAgendaTags(event.target.value)}
                    onBlur={() => void autoSaveMeeting()}
                    placeholder="quality of earnings, diligence blockers, legal follow-up"
                  />
                </div>

                <Input
                  label="Meeting Link"
                  value={meetingUrl}
                  onChange={(event) => setMeetingUrl(event.target.value)}
                  onBlur={() => void autoSaveMeeting()}
                  placeholder="https://meet.google.com/... or Teams link"
                />
              </div>
            </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={runReport} disabled={isReportRunning || saving || uploading || !(meeting.notesText || '').trim()}>
                  {isReportRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {isReportRunning ? `Running ${formatDuration(elapsedMs)}` : 'Run Report'}
                </Button>
              <Button variant="outline" onClick={() => void deleteMeeting()} disabled={deleting || saving || uploading || runningReport}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </Button>
                {message ? <p className="text-sm text-slate-500">{message}</p> : null}
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 xl:min-h-[620px] xl:max-h-[760px] xl:overflow-hidden">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Meeting Notes</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Speaker turns are shown as readable blocks so the conversation is easier to scan.
                  </p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                  Upload Notes
                  <input
                    type="file"
                    className="hidden"
                    accept=".txt,.md,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) void uploadNotes(file)
                      event.currentTarget.value = ''
                    }}
                  />
                </label>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Meeting time</p>
                  <p className="mt-2 text-sm font-medium text-slate-700">{formatDateTime(meeting.startAt)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Assistant status</p>
                  <p className="mt-2 text-sm font-medium text-slate-700">{notetakerStatusLabel(meeting.nylasNotetakerState)}</p>
                </div>
              </div>

              <div className="mt-4 max-h-[500px] min-h-[360px] overflow-y-auto pr-1 xl:max-h-[560px]">
                <NotesPreview notesText={meeting.notesText || ''} />
              </div>
            </div>
          </div>

          <ReportPanel latestReport={latestReport} meeting={meeting} />
        </div>
      ) : null}
    </Card>
  )
}

export default function MeetingsTab({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [nylasStatus, setNylasStatus] = useState<NylasStatus | null>(null)
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [manualForm, setManualForm] = useState({
    title: '',
    startDate: '',
    startTime: '10:00',
    endTime: '11:00',
    meetingUrl: '',
    agenda: '',
    agendaTags: '',
  })

  const reportsReady = useMemo(() => meetings.filter((meeting) => meeting.reports?.length).length, [meetings])
  const hasRunningReports = useMemo(() => meetings.some((meeting) => meeting.reportStatus === 'RUNNING'), [meetings])
  const hasPendingAssistants = useMemo(
    () =>
      meetings.some((meeting) => {
        if (!meeting.nylasNotetakerId) return false
        if (meeting.notesText?.trim()) return false
        const state = (meeting.nylasNotetakerState || '').toLowerCase()
        return !['media_ready', 'completed', 'failed', 'cancelled'].includes(state)
      }),
    [meetings]
  )

  function upsertMeeting(next: Meeting) {
    setMeetings((current) => current.map((meeting) => (meeting.id === next.id ? next : meeting)))
  }

  async function loadAll() {
    setLoading(true)
    try {
      const [statusResponse, eventsResponse, meetingsResponse] = await Promise.all([
        fetch('/api/nylas/status'),
        fetch('/api/calendar/events?horizonDays=60'),
        fetch(`/api/clients/${clientId}/meetings`),
      ])

      const statusData = await statusResponse.json()
      const eventsData = await eventsResponse.json()
      const meetingsData = await meetingsResponse.json()

      setNylasStatus(statusData)
      setCalendarEvents(eventsData.items || [])
      if ((eventsData.items || []).length) {
        await fetch(`/api/clients/${clientId}/meetings/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: eventsData.items || [] }),
        })
        const refreshedMeetingsResponse = await fetch(`/api/clients/${clientId}/meetings`)
        const refreshedMeetingsData = await refreshedMeetingsResponse.json()
        setMeetings(refreshedMeetingsData.items || [])
      } else {
        setMeetings(meetingsData.items || [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const now = new Date()
    const date = now.toISOString().slice(0, 10)
    setManualForm((prev) => ({ ...prev, startDate: prev.startDate || date }))
    void loadAll()
  }, [clientId])

  useEffect(() => {
    if (!hasRunningReports) return
    const timer = window.setInterval(() => void loadAll(), 5000)
    return () => window.clearInterval(timer)
  }, [hasRunningReports, clientId])

  useEffect(() => {
    if (!hasPendingAssistants) return
    const timer = window.setInterval(() => {
      const pendingMeetings = meetings.filter((meeting) => {
        if (!meeting.nylasNotetakerId) return false
        if (meeting.notesText?.trim()) return false
        const state = (meeting.nylasNotetakerState || '').toLowerCase()
        return !['media_ready', 'completed', 'failed', 'cancelled'].includes(state)
      })

      for (const meeting of pendingMeetings) {
        void fetch(`/api/clients/${clientId}/meetings/${meeting.id}/assistant/refresh`, {
          method: 'POST',
        })
          .then(async (response) => {
            const data = await response.json()
            if (response.ok && data.item) upsertMeeting(data.item)
          })
          .catch(() => {})
      }
    }, 10000)

    return () => window.clearInterval(timer)
  }, [clientId, hasPendingAssistants, meetings])

  async function connectCalendar(provider: 'google' | 'microsoft') {
    setBusyKey(`connect-${provider}`)
    try {
      const returnTo = `/admin/client/${clientId}?tab=meetings`
      const response = await fetch(`/api/nylas/connect?provider=${provider}&returnTo=${encodeURIComponent(returnTo)}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not start calendar connection.')
      window.location.href = data.url
    } catch (error) {
      console.error(error)
      setBusyKey(null)
    }
  }

  async function disconnectCalendar() {
    setBusyKey('disconnect')
    try {
      await fetch('/api/nylas/disconnect', { method: 'POST' })
      await loadAll()
    } finally {
      setBusyKey(null)
    }
  }

  async function createManualMeeting() {
    if (!manualForm.title.trim() || !manualForm.startDate || !manualForm.startTime) return

    setBusyKey('create-manual')
    try {
      const startAt = new Date(`${manualForm.startDate}T${manualForm.startTime}`)
      const endAt = manualForm.endTime ? new Date(`${manualForm.startDate}T${manualForm.endTime}`) : null

      const response = await fetch(`/api/clients/${clientId}/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: manualForm.title,
          startAt: startAt.toISOString(),
          endAt: endAt ? endAt.toISOString() : null,
          source: 'MANUAL',
          meetingUrl: manualForm.meetingUrl,
          agenda: manualForm.agenda,
          agendaTags: manualForm.agendaTags,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not create meeting.')

      setManualForm({
        title: '',
        startDate: manualForm.startDate,
        startTime: '10:00',
        endTime: '11:00',
        meetingUrl: '',
        agenda: '',
        agendaTags: '',
      })
      setShowCreateModal(false)
      await loadAll()
    } catch (error) {
      console.error(error)
    } finally {
      setBusyKey(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(212,168,67,0.14),transparent_38%),linear-gradient(135deg,#0f172a,#172033)] px-6 py-6 text-white">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">Meeting Control Center</p>
              <h2 className="mt-3 text-3xl font-semibold cantara-serif">Connected meeting operations for {clientName}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/75">
                Connect a calendar account, bring live meetings into the portal, capture notes automatically, and generate a structured internal report once the discussion is complete.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Badge color={nylasStatus?.connected ? 'green' : 'slate'}>
                  {nylasStatus?.connected ? 'Calendar connected' : 'Calendar not connected'}
                </Badge>
                {nylasStatus?.connection?.provider ? <Badge color="blue">{nylasStatus.connection.provider}</Badge> : null}
                {nylasStatus?.connection?.email ? <Badge color="slate">{nylasStatus.connection.email}</Badge> : null}
                <Badge color="gold">{meetings.length} meetings tracked</Badge>
                <Badge color="green">{reportsReady} reports ready</Badge>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:w-[460px]">
              <Button
                onClick={() => void connectCalendar('google')}
                disabled={busyKey === 'connect-google' || !nylasStatus?.configured}
                className="justify-center"
              >
                {busyKey === 'connect-google' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Connect Google
              </Button>
              <Button
                onClick={() => void connectCalendar('microsoft')}
                disabled={busyKey === 'connect-microsoft' || !nylasStatus?.configured}
                className="justify-center"
              >
                {busyKey === 'connect-microsoft' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Connect Microsoft
              </Button>
              <Button variant="outline" onClick={() => setShowCreateModal(true)} className="justify-center border-white/20 bg-white/10 text-white hover:bg-white/15">
                <Plus className="h-4 w-4" />
                Add Meeting
              </Button>
              <Button variant="outline" onClick={() => void loadAll()} className="justify-center border-white/20 bg-white/10 text-white hover:bg-white/15">
                <RefreshCw className="h-4 w-4" />
                Refresh Board
              </Button>
              {nylasStatus?.connected ? (
                <Button
                  variant="outline"
                  onClick={() => void disconnectCalendar()}
                  disabled={busyKey === 'disconnect'}
                  className="justify-center border-white/20 bg-white/10 text-white hover:bg-white/15 sm:col-span-2"
                >
                  {busyKey === 'disconnect' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                  Disconnect Calendar
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-blue-500" />
            <h3 className="text-lg font-semibold text-slate-900">Upcoming Meetings</h3>
          </div>
          <div className="flex items-center gap-2">
            {calendarEvents.length ? <Badge color="blue">{calendarEvents.length} live calendar items</Badge> : null}
            <p className="text-sm text-slate-500">New calendar meetings are auto-created here and open collapsed.</p>
          </div>
        </div>

        {meetings.length === 0 ? (
          <Card className="p-8 text-sm text-slate-500">
            No meetings yet. New connected calendar events will appear here automatically, or you can create one from the Add Meeting button.
          </Card>
        ) : (
          <div className="space-y-4">
            {meetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                clientId={clientId}
                meeting={meeting}
                onMeetingChange={upsertMeeting}
                onMeetingDelete={(meetingId) => setMeetings((current) => current.filter((item) => item.id !== meetingId))}
              />
            ))}
          </div>
        )}
      </section>

      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Add Meeting" sizeClassName="max-w-2xl">
        <div className="space-y-4">
          <Input
            label="Meeting Title"
            value={manualForm.title}
            onChange={(event) => setManualForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Management call with seller"
          />
          <div className="grid gap-3 md:grid-cols-3">
            <DatePicker
              label="Date"
              value={manualForm.startDate}
              onChange={(value) => setManualForm((prev) => ({ ...prev, startDate: value }))}
            />
            <CustomTimeInput
              label="Start Time"
              value={manualForm.startTime}
              onChange={(value) => setManualForm((prev) => ({ ...prev, startTime: value }))}
            />
            <CustomTimeInput
              label="End Time"
              value={manualForm.endTime}
              onChange={(value) => setManualForm((prev) => ({ ...prev, endTime: value }))}
            />
          </div>
          <Input
            label="Meeting Link"
            value={manualForm.meetingUrl}
            onChange={(event) => setManualForm((prev) => ({ ...prev, meetingUrl: event.target.value }))}
            placeholder="Paste Zoom, Meet, or Teams link"
          />
          <p className="-mt-1 text-xs text-slate-400">
            Leave the link blank to create the calendar meeting and generate the meeting link automatically.
          </p>
          <Textarea
            label="Agenda"
            rows={5}
            value={manualForm.agenda}
            onChange={(event) => setManualForm((prev) => ({ ...prev, agenda: event.target.value }))}
            placeholder="Describe the agenda or intended talking points."
          />
          <Input
            label="Agenda Tags"
            value={manualForm.agendaTags}
            onChange={(event) => setManualForm((prev) => ({ ...prev, agendaTags: event.target.value }))}
            placeholder="owner diligence, legal issues, labor, transition"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => void createManualMeeting()} disabled={busyKey === 'create-manual'}>
              {busyKey === 'create-manual' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
              Create Meeting
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
