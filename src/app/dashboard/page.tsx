'use client'
import { Fragment, useState, useEffect, useRef, useCallback, type Dispatch, type SetStateAction } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import {
  LogOut, Bell, Settings, ChevronRight, CheckCircle, Upload, X,
  MessageSquare, AlertCircle, Send, Users, Plus, Trash2,
  FileText, FileSpreadsheet, HelpCircle, ChevronDown, ChevronUp, Map as MapIcon, Lock, Loader2, ExternalLink, Calendar, Search
} from 'lucide-react'
import {
  formatDeadlineLabel,
  getDeadlineStatus,
  getEffectiveDocumentDeadline,
  VALUATION_SECTION_ID,
} from '@/lib/document-deadlines'
import { getWorkstreamPortalSubtitle, getWorkstreamPortalTitle } from '@/lib/workstream-display'
import {
  STRUCTURED_FORM_COLUMNS,
  downloadStructuredFormTemplate,
  isStructuredFormFieldKey,
  parsePipeRows,
  parseStructuredFormExcel,
  serializePipeRows,
  type StructuredFormFieldKey,
} from '@/lib/structured-form-excel'
import { Button, Badge, ProgressBar, Modal, Input, Textarea, GoldLine } from '@/components/ui'
import { DocumentUploadPanel, type DocumentUploadStatusSummary } from '@/components/documents/DocumentUploadPanel'
import { DocumentUploadAccordion } from '@/components/documents/DocumentUploadAccordion'
import { RevenueBreakdownReview } from '@/components/client-portal/RevenueBreakdownReview'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import { fetchClientDocumentsBatch, fileCountForDocumentIds, mergeUploadedFiles, type FilesByDocumentId } from '@/lib/client-document-files'
import { getDocsForAgentSelections, getDocsForWorkstream, getValuationDocsForWorkstream, mergeDocumentCategories } from '@/lib/documentData'
import {
  DOCUMENT_ASSIGN_HELP,
  DOCUMENT_REFERENCE_TEMPLATES,
  MULTI_YEAR_UPLOAD_SLOTS,
  filterClientPortalDocuments,
  getMultiYearCombinedId,
  getMultiYearUploadProgress,
  summarizeClientPortalProgress,
} from '@/lib/client-portal-documents'
import { getClients, getRequirements, getCurrentRole, logout, getClient, saveClient, updateRequirement } from '@/lib/store'
import type { Client, DocumentStatus, AdditionalRequirement } from '@/lib/store'
import { useChatRoom } from '@/hooks/useChatRoom'
import { ChatThread } from '@/components/chat/ChatThread'
import { Ws2WorkbookView } from '@/components/ttm-agent/Ws2WorkbookView'
import DigitalPresenceScorecard from '@/components/digital-presence/DigitalPresenceScorecard'
import ClientApprovedAgentOutput, { type ClientApprovedClient } from '@/components/client-portal/ClientApprovedAgentOutput'
import ClientLocationMapTab from '@/components/client-location-map/ClientLocationMapTab'
import { ClientCompetitorInputsFields } from '@/components/client-portal/ClientCompetitorInputsFields'
import { buildTaxReadinessReferenceHtml } from '@/lib/tax-readiness'

export type ClientPortalFormQuestion = {
  id: string
  agentId: string
  fieldKey: string
  label: string
  description?: string | null
  inputType: 'text' | 'url' | 'textarea' | 'select' | 'number'
  placeholder?: string | null
  required: boolean
  options?: string[] | null
  groupKey?: string | null
  groupLabel?: string | null
  sortOrder?: number
}

function isRequirementStillOpen(requirement: AdditionalRequirement) {
  return (
    requirement.status === 'open'
    && !requirement.respondedAt
    && !requirement.clientResponse
    && !requirement.responseFileName
    && !requirement.responseFileUrl
  )
}

// ── Nav ──────────────────────────────────────────────────────────────────────
function ClientNav({ workstreamTitle, unreadCount, onNotifications, onAccountSettings, highlightSettings = false, tourPaused = false, onResumeTour }: {
  workstreamTitle: string | null
  unreadCount: number
  onNotifications: () => void
  onAccountSettings: () => void
  highlightSettings?: boolean
  tourPaused?: boolean
  onResumeTour?: () => void
}) {
  const router = useRouter()
  return (
    <header className={`sticky top-0 ${highlightSettings ? 'z-[61]' : 'z-40'}`} style={{ background: '#0d1829' }}>
      <div className="max-w-4xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-white cantara-serif tracking-[0.18em] text-sm shrink-0">Cantara</span>
          <div className="w-px h-3 bg-white/15 shrink-0" />
          <div className="min-w-0">
            <span className="text-white/30 tracking-[0.18em] uppercase block" style={{ fontSize: '0.58rem' }}>Client Portal</span>
            {workstreamTitle && (
              <span className="text-white/70 text-[11px] truncate block mt-0.5" title={workstreamTitle}>{workstreamTitle}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onNotifications}
            className="relative p-2 rounded hover:bg-white/5 transition-colors text-white/30 hover:text-white/70"
            aria-label="Open notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ background: '#ef4444' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {tourPaused && onResumeTour && (
            <button
              type="button"
              onClick={onResumeTour}
              className="rounded-md border border-amber-400/60 bg-amber-400/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-200 transition-colors hover:bg-amber-400/20"
            >
              Resume tour
            </button>
          )}
          <button
            id="account-settings-button"
            onClick={onAccountSettings}
            className={`p-2 rounded transition-colors ${
              highlightSettings
                ? 'relative z-[62] bg-amber-500/15 text-amber-300 ring-2 ring-amber-300/70 shadow-[0_0_0_6px_rgba(251,191,36,0.12)]'
                : 'text-white/30 hover:bg-white/5 hover:text-white/70'
            }`}
            aria-label="Account settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={() => { logout(); router.push('/') }}
            className="flex items-center gap-1.5 text-white/30 hover:text-white/60 transition-colors px-3 py-1.5 rounded hover:bg-white/5 text-xs"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </div>
      <GoldLine />
    </header>
  )
}

// ── Phase tabs ───────────────────────────────────────────────────────────────
const PHASES = [
  { id: 'overview', label: 'Overview' },
  { id: 'assign', label: 'Assign' },
  { id: 'collection', label: 'Document Upload' },
  { id: 'information', label: 'Required Info' },
  { id: 'requirements', label: 'Action Items' },
  { id: 'roadmap', label: 'Report Tabs' },
]

const TOUR_STEPS = [
  {
    step: 1,
    title: "Change Temporary Password",
    desc: "Click the highlighted gear icon here to open Account Settings and update your temporary password to secure your account.",
  },
  {
    step: 2,
    title: "Welcome to Cantara",
    desc: "Welcome to your Client Portal! This dashboard gives you a high-level view of your business, advisor chat updates, and overall progress.",
  },
  {
    step: 3,
    title: "Invite your Team",
    desc: "Click 'Add Team Member' here to invite other members of your company who will help you collect and upload documents.",
  },
  {
    step: 4,
    title: "Assigned Workstream",
    desc: "This card shows your active workstream and advisor notes on what to focus on next.",
  },
  {
    step: 5,
    title: "Onboarding Process",
    desc: "This list maps out the complete roadmap from document collection to questionnaires and advisor feedback.",
  },
  {
    step: 6,
    title: "1 — Tell us which documents you have",
    desc: "In the Assign tab, select Yes/No/NA for optional items to indicate which documents your business currently has. Advisors use this to update your checklist.",
  },
  {
    step: 7,
    title: "2 — Assign documents",
    desc: "Once documents are confirmed, switch to the second sub-tab to designate who is responsible for uploading each item.",
  },
  {
    step: 8,
    title: "Assigning Document Owners",
    desc: "Use the dropdown select box next to each item to assign the task to yourself ('Me') or an invited team member.",
  },
  {
    step: 9,
    title: "3 — Assigned documents",
    desc: "Review a summary of all assigned documents and their designated owners for progress tracking.",
  },
  {
    step: 10,
    title: "Document Upload Checklist",
    desc: "Expand checklist categories here to view detailed advisor instructions, upload your files, and track approval status.",
  },
  {
    step: 11,
    title: "Submitting Sections",
    desc: "Once you have uploaded all files in a checklist category, click the 'Mark Section Ready' button to submit that section for advisor review.",
  },
  {
    step: 12,
    title: "Action Items & Feedback",
    desc: "Review tasks, comments, and specific feedback from your advisor team that require your direct action.",
  },
  {
    step: 13,
    title: "You’re all set",
    desc: "You’ve reached the end of the portal tour. You can now explore your dashboard, and this introduction will not appear again.",
  },
]

const getTourTargetId = (step: number) => {
  switch (step) {
    case 1: return 'account-settings-button'
    case 2: return 'tour-welcome-banner'
    case 3: return 'tour-add-team-member'
    case 4: return 'tour-workstream-card'
    case 5: return 'tour-process-card'
    case 6: return 'tour-assign-switcher'
    case 7: return 'tour-assign-switcher'
    case 8: return 'tour-assign-dropdown-first'
    case 9: return 'tour-assign-switcher'
    case 10: return 'tour-collection-container'
    case 11: return 'tour-submit-section-button'
    case 12: return 'tour-requirements-container'
    case 13: return 'tour-roadmap-container'
    default: return null
  }
}

const DEDICATED_REQUIRED_INFO_AGENTS = [
  'facility_review',
  'digital_presence',
  'occupancy_review',
  'vendor_directory',
  'professional_advisors',
  'competitor_analysis',
  'pricing_analysis',
] as const

function isDedicatedRequiredInfoAgent(agentId: string): boolean {
  return (DEDICATED_REQUIRED_INFO_AGENTS as readonly string[]).includes(agentId)
}

function buildRequiredInfoFormTabs(formQuestions: ClientPortalFormQuestion[]) {
  const hasAgentForm = (agentId: string) => formQuestions.some(q => q.agentId === agentId)
  return {
    activeFormKeys: [
      ...(hasAgentForm('facility_review') ? ['facility_review'] : []),
      ...(hasAgentForm('digital_presence') ? ['digital_presence'] : []),
      ...(hasAgentForm('competitor_analysis') || hasAgentForm('pricing_analysis') ? ['competitor_analysis'] : []),
      ...(hasAgentForm('occupancy_review') ? ['occupancy_review'] : []),
      ...(hasAgentForm('vendor_directory') ? ['vendor_directory'] : []),
      ...(hasAgentForm('professional_advisors') ? ['professional_advisors'] : []),
      ...(formQuestions.some(q => !isDedicatedRequiredInfoAgent(q.agentId)) ? ['other_info'] : []),
    ],
    formLabels: {
      facility_review: 'Facility Review',
      digital_presence: 'Digital Presence',
      competitor_analysis: 'Competitor & Pricing Inputs',
      occupancy_review: 'Occupancy Review',
      vendor_directory: 'Software & Vendors',
      professional_advisors: 'Professional Advisors',
      other_info: 'Other Required Info',
    } as Record<string, string>,
  }
}

function TargetDeadlineBadge({ deadline, uploaded }: { deadline: string | null; uploaded: boolean }) {
  const label = formatDeadlineLabel(deadline)
  if (!label) return null
  const status = getDeadlineStatus(deadline, uploaded)
  const tone =
    status === 'overdue'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : status === 'due-soon'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : status === 'done'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-slate-50 text-slate-600'
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium ${tone}`}>
      <Calendar className="w-3 h-3" />
      Target: {label}
      {status === 'overdue' && !uploaded ? ' · Overdue' : ''}
    </span>
  )
}

function applyDocumentUploadSummary(
  setStatus: (id: string, u: Partial<DocumentStatus>) => void,
  docId: string,
  summary: DocumentUploadStatusSummary,
  mirrorDocIds: string[] = [],
) {
  const patch = summary.fileCount
    ? {
        hasDoc: true,
        unavailableDecision: null,
        fileName: summary.fileName,
        fileUrl: summary.fileUrl,
        uploadedAt: summary.uploadedAt,
      }
    : {
        fileName: null,
        fileUrl: null,
        uploadedAt: null,
      }
  setStatus(docId, patch)
  mirrorDocIds.forEach(mirrorId => {
    if (mirrorId !== docId) setStatus(mirrorId, patch)
  })
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function ClientDashboard() {
  const router = useRouter()
  const [client, setClient] = useState<Client | null>(null)
  const [phase, setPhase] = useState('overview')
  const [showChat, setShowChat] = useState(false)
  const [docStatuses, setDocStatuses] = useState<Record<string, DocumentStatus>>({})
  const [assignPhaseComplete, setAssignPhaseComplete] = useState(false)
  const [chatDraft, setChatDraft] = useState('')
  const [requirements, setRequirements] = useState<AdditionalRequirement[]>([])
  const [savingStatuses, setSavingStatuses] = useState(false)
  const [dirtyStatusIds, setDirtyStatusIds] = useState<Set<string>>(new Set())
  const [submittingSectionId, setSubmittingSectionId] = useState<string | null>(null)
  const [newTeamMember, setNewTeamMember] = useState({ name: '', email: '', role: '' })
  const [savingTeamMember, setSavingTeamMember] = useState(false)
  const [deletingTeamMemberId, setDeletingTeamMemberId] = useState<string | null>(null)
  const [editingTeamMemberId, setEditingTeamMemberId] = useState<string | null>(null)
  const [sessionEmail, setSessionEmail] = useState('')
  const [formQuestions, setFormQuestions] = useState<ClientPortalFormQuestion[]>([])
  const [formResponses, setFormResponses] = useState<Record<string, string>>({})
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [tourStep, setTourStep] = useState<number | null>(null)
  const [tourPaused, setTourPaused] = useState(false)
  const [tourTargetPos, setTourTargetPos] = useState<{ x: number; top: number; bottom: number } | null>(null)
  const showPasswordTour = tourStep !== null && !tourPaused

  useEffect(() => {
    if (tourStep === null || !client) return

    if (tourStep >= 1 && tourStep <= 5) {
      setPhase('overview')
    } else if (tourStep >= 6 && tourStep <= 9) {
      setPhase('assign')
    } else if (tourStep === 10 || tourStep === 11) {
      setPhase('collection')
    } else if (tourStep === 12) {
      setPhase('requirements')
    } else if (tourStep === 13) {
      setPhase('roadmap')
    }

    const id = getTourTargetId(tourStep)
    if (id) {
      const timer = setTimeout(() => {
        const el = document.getElementById(id)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [tourStep, client])

  useEffect(() => {
    if (tourStep === null || !mustChangePassword || !client) return

    const updatePosition = () => {
      const id = getTourTargetId(tourStep)
      if (!id) {
        setTourTargetPos(null)
        return
      }
      const el = document.getElementById(id)
      if (el) {
        const rect = el.getBoundingClientRect()
        setTourTargetPos({
          x: rect.left + rect.width / 2,
          top: rect.top,
          bottom: rect.bottom,
        })
      }
    }

    updatePosition()
    const rafId = requestAnimationFrame(updatePosition)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, { passive: true })
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition)
    }
  }, [tourStep, mustChangePassword, client])
  const chat = useChatRoom({
    clientId: client?.id ?? '',
    viewer: 'client',
    senderName: client?.name ?? 'Client',
    isActive: showChat,
  })

  useEffect(() => {
    // In production: load the actual logged-in client. For demo use first provisioned client.
    const load = async () => {
      const email = typeof window !== 'undefined' ? (JSON.parse(localStorage.getItem('cantara_client_email') || 'null')) : null
      const clientId = typeof window !== 'undefined' ? (JSON.parse(localStorage.getItem('cantara_client_id') || 'null')) : null
      const requiresPasswordChange = typeof window !== 'undefined' ? Boolean(JSON.parse(localStorage.getItem('cantara_client_must_change_password') || 'false')) : false
      const savedTourStep = typeof window !== 'undefined' ? Number(localStorage.getItem('cantara_client_tour_step') || '') : NaN
      const savedTourPaused = typeof window !== 'undefined' && localStorage.getItem('cantara_client_tour_paused') === 'true'
      setSessionEmail(email || '')
      setMustChangePassword(requiresPasswordChange)
      setTourStep(
        savedTourPaused
          ? null
          : Number.isInteger(savedTourStep) && savedTourStep >= 2
            ? savedTourStep
            : (requiresPasswordChange ? 1 : null),
      )
      setTourPaused(savedTourPaused)
      const all = await getClients()
      const found =
        (clientId ? all.find(c => c.id === clientId) : null) ??
        (email ? all.find(c => c.email === email || c.teamMembers.some(member => member.email === email)) : null) ??
        all.find(c => c.workstream) ??
        all[0]
      if (found) {
        setClient(found)
        setDocStatuses(found.documentStatuses ?? {})
        setRequirements(await getRequirements(found.id))
      }
    }
    load()
    void fetch('/api/internal/daily-document-reminders', { method: 'POST' }).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!client) return
    const interval = setInterval(async () => {
      const refreshedClient = await getClient(client.id)
      if (refreshedClient) {
        setClient(refreshedClient)
        setDocStatuses(prev => {
          const refreshed = refreshedClient.documentStatuses ?? {}
          if (dirtyStatusIds.size === 0) return refreshed
          const merged = { ...refreshed }
          dirtyStatusIds.forEach(id => {
            if (prev[id]) merged[id] = prev[id]
          })
          return merged
        })
      }
      setRequirements(await getRequirements(client.id))
    }, 30000)
    return () => clearInterval(interval)
  }, [client, dirtyStatusIds])

  useEffect(() => {
    if (!client) return
    let cancelled = false
    async function loadFormQuestions() {
      try {
        const res = await fetch(`/api/client-form-questions?clientId=${encodeURIComponent(client.id)}`)
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setFormQuestions(data.questions ?? [])
        setFormResponses(data.responses ?? {})
      } catch {
        if (!cancelled) setFormQuestions([])
      }
    }
    void loadFormQuestions()
    return () => { cancelled = true }
  }, [client?.id])

  useEffect(() => {
    if (!client || dirtyStatusIds.size === 0) return
    const idsToSave = Array.from(dirtyStatusIds)
    const statusesToSave = Object.fromEntries(idsToSave.map(id => [id, docStatuses[id]]).filter(([, status]) => Boolean(status)))
    const timeout = setTimeout(async () => {
      setSavingStatuses(true)
      try {
        const res = await fetch('/api/client-portal/statuses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: client.id, statuses: statusesToSave }),
        })
        if (!res.ok) throw new Error(await res.text())
        setDirtyStatusIds(prev => {
          const next = new Set(prev)
          idsToSave.forEach(id => next.delete(id))
          return next
        })
        const refreshedClient = await getClient(client.id)
        if (refreshedClient) {
          setClient(refreshedClient)
          setDocStatuses(prev => ({ ...(refreshedClient.documentStatuses ?? {}), ...Object.fromEntries(Array.from(dirtyStatusIds).map(id => [id, prev[id]]).filter(([, status]) => Boolean(status))) }))
        }
      } catch (error) {
        console.error('Save statuses error:', error)
      } finally {
        setSavingStatuses(false)
      }
    }, 400)

    return () => clearTimeout(timeout)
  }, [docStatuses, client, dirtyStatusIds])

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d1829' }}>
        <div className="w-6 h-6 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
      </div>
    )
  }

  const setDocStatus = (docId: string, update: Partial<DocumentStatus>) => {
    setDirtyStatusIds(prev => new Set(prev).add(docId))
    setDocStatuses(prev => ({
      ...prev,
      [docId]: { id: docId, hasDoc: null, unavailableDecision: null, assignedTo: null, uploadedAt: null, fileName: null, notApplicable: false, ...prev[docId], ...update },
    }))
  }

  const submitSection = async (sectionId: string) => {
    if (!client) return
    setSubmittingSectionId(sectionId)
    const nextClient = {
      ...client,
      sectionSubmissions: {
        ...(client.sectionSubmissions ?? {}),
        [sectionId]: { submittedAt: new Date().toISOString() },
      },
    }
    setClient(nextClient)
    try {
      const savedClient = await saveClient(nextClient)
      if (savedClient) {
        setClient(savedClient)
      }
    } finally {
      setSubmittingSectionId(null)
    }
  }

  const addTeamMember = async () => {
    if (!client || !newTeamMember.name.trim() || !newTeamMember.email.trim()) return
    setSavingTeamMember(true)
    const nextMembers = editingTeamMemberId
      ? client.teamMembers.map(member =>
          member.id === editingTeamMemberId
            ? {
                ...member,
                name: newTeamMember.name.trim(),
                email: newTeamMember.email.trim(),
                role: newTeamMember.role.trim(),
              }
            : member,
        )
      : [
          ...client.teamMembers,
          {
            id: `tm_${Date.now()}`,
            name: newTeamMember.name.trim(),
            email: newTeamMember.email.trim(),
            role: newTeamMember.role.trim(),
          },
        ]
    const nextClient = {
      ...client,
      teamMembers: nextMembers,
    }
    setClient(nextClient)
    try {
      const savedClient = await saveClient(nextClient)
      if (savedClient) {
        setClient(savedClient)
      }
      setNewTeamMember({ name: '', email: '', role: '' })
      setEditingTeamMemberId(null)
    } finally {
      setSavingTeamMember(false)
    }
  }

  const startEditingTeamMember = (member: Client['teamMembers'][number]) => {
    setEditingTeamMemberId(member.id)
    setNewTeamMember({
      name: member.name,
      email: member.email,
      role: member.role,
    })
  }

  const deleteTeamMember = async (memberId: string) => {
    if (!client) return
    setDeletingTeamMemberId(memberId)
    const nextClient = {
      ...client,
      teamMembers: client.teamMembers.filter(member => member.id !== memberId),
    }
    setClient(nextClient)
    try {
      const savedClient = await saveClient(nextClient)
      if (savedClient) {
        setClient(savedClient)
      }
      if (editingTeamMemberId === memberId) {
        setEditingTeamMemberId(null)
        setNewTeamMember({ name: '', email: '', role: '' })
      }
    } finally {
      setDeletingTeamMemberId(null)
    }
  }

  const getDocStatus = (docId: string): DocumentStatus =>
    docStatuses[docId] ?? { id: docId, hasDoc: null, assignedTo: null, uploadedAt: null, fileName: null, notApplicable: false }

  const categories = mergeDocumentCategories([
    ...(client.customWorkstream
      ? getDocsForAgentSelections(client.customWorkstream.agents)
      : getDocsForWorkstream(client.workstream, client.businessType)),
    ...getDocsForAgentSelections(client.workstreamAgents ?? []),
  ])
    .map(category => ({
      ...category,
      documents: filterClientPortalDocuments(category.documents).filter(doc =>
        client.propertyOwnership === 'owns' ? doc.id !== 'leases' : doc.id !== 'real_estate_appraisal'
      ),
    }))
    .filter(category => category.documents.length > 0)
  const valuationDocs = getValuationDocsForWorkstream(client.workstream)
  const diligenceDocs = categories.flatMap(c => c.documents)
  const allDocs = [...valuationDocs, ...diligenceDocs]
  const requiredAndValuationDocs = [
    ...valuationDocs,
    ...diligenceDocs.filter(d => d.type === 'required'),
  ]
  const yesDocs = diligenceDocs.filter(d => d.type !== 'required' && getDocStatus(d.id).hasDoc === true)
  const docsNeedingAssignment = [...requiredAndValuationDocs, ...yesDocs].filter(
    (doc, index, arr) => arr.findIndex(item => item.id === doc.id) === index,
  )
  const allConfirmedAssigned =
    docsNeedingAssignment.length > 0 &&
    docsNeedingAssignment.every(d => getDocStatus(d.id).assignedTo || getDocStatus(d.id).fileName)
  const unreadMsgs = chat.unreadCount
  const sessionTeamMember = client.teamMembers.find(member => member.email.toLowerCase() === sessionEmail.toLowerCase()) ?? null
  const isTeamMemberSession = Boolean(sessionTeamMember && sessionEmail.toLowerCase() !== client.email.toLowerCase())
  const memberAssignedTo = sessionTeamMember ? [sessionTeamMember.name, sessionTeamMember.email] : []
  const hasAssignedForms = (() => {
    if (!isTeamMemberSession) return true
    const formAssignments = (client.sectionSubmissions as any)?.formAssignments ?? {}
    return Object.values(formAssignments).some(assignedTo =>
      Boolean(assignedTo && memberAssignedTo.some(value => value.toLowerCase() === (assignedTo as string).toLowerCase()))
    )
  })()
  const isAssignedToCurrentTeamMember = (docId: string) => {
    if (!isTeamMemberSession) return true
    const assignedTo = getDocStatus(docId).assignedTo
    return Boolean(assignedTo && memberAssignedTo.some(value => value.toLowerCase() === assignedTo.toLowerCase()))
  }
  const visibleValuationDocs = isTeamMemberSession ? valuationDocs.filter(doc => isAssignedToCurrentTeamMember(doc.id)) : valuationDocs
  const visibleCategories = isTeamMemberSession
    ? categories
        .map(category => ({
          ...category,
          documents: category.documents.filter(doc => isAssignedToCurrentTeamMember(doc.id)),
        }))
        .filter(category => category.documents.length > 0)
    : categories
  const visibleAllDocs = [...visibleValuationDocs, ...visibleCategories.flatMap(category => category.documents)]
  const portalProgressDocs = filterClientPortalDocuments(allDocs)
  const portalProgress = summarizeClientPortalProgress(portalProgressDocs, getDocStatus)
  const visiblePortalProgressDocs = filterClientPortalDocuments(visibleAllDocs)
  const visiblePortalProgress = summarizeClientPortalProgress(visiblePortalProgressDocs, getDocStatus)
  const visibleRequirements = isTeamMemberSession
    ? requirements.filter(requirement => (
        requirement.status === 'open' &&
        Boolean(requirement.assignedTo) &&
        memberAssignedTo.some(value => value.toLowerCase() === requirement.assignedTo?.toLowerCase())
      ))
    : requirements
  const openReqs = visibleRequirements.filter(r => (
    r.status === 'open'
    && !r.respondedAt
    && !r.clientResponse
    && !r.responseFileName
    && !r.responseFileUrl
  ))

  const submitChat = async () => {
    if (!chatDraft.trim()) return
    const ok = await chat.sendMessage(chatDraft)
    if (ok) setChatDraft('')
  }

  const wsLabel: Record<string, string> = {
    ws1: 'Workstream 1 — Risk Mitigation',
    ws2: 'Workstream 2 — Profitability & Growth',
    both: 'Workstream 1 & 2',
    ma: 'M&A Advisory',
  }
  const workstreamTitle = getWorkstreamPortalTitle(client)
  const workstreamSubtitle = getWorkstreamPortalSubtitle(client)
  const sectionDeadlines = client.sectionDeadlines ?? {}
  const getDeadline = (docId: string, sectionId: string) =>
    getEffectiveDocumentDeadline(docId, sectionId, docStatuses, sectionDeadlines)

  return (
    <div className="min-h-screen" style={{ background: 'hsl(220,18%,96%)' }}>
      <ClientNav
        workstreamTitle={workstreamTitle}
        unreadCount={unreadMsgs + openReqs.length}
        onNotifications={() => router.push('/dashboard/notifications')}
        onAccountSettings={() => router.push(tourStep === 1 ? '/dashboard/settings?tour=password' : '/dashboard/settings')}
        highlightSettings={tourStep === 1 && !tourPaused}
        tourPaused={tourPaused}
        onResumeTour={() => {
          const savedStep = Number(localStorage.getItem('cantara_client_tour_step') || '')
          if (Number.isInteger(savedStep) && savedStep >= 1) setTourStep(savedStep)
          setTourPaused(false)
          localStorage.setItem('cantara_client_tour_paused', 'false')
        }}
      />

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        {/* Welcome banner */}
        <motion.div
          id="tour-welcome-banner"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={`relative rounded-2xl p-6 md:p-8 mb-6 overflow-hidden transition-all ${
            tourStep === 1 ? 'z-[61] ring-2 ring-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.2)]' : ''
          }`}
          style={{ background: 'linear-gradient(135deg, #0d1829 0%, #111e35 100%)' }}
        >
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" style={{ background: 'rgba(184,146,42,0.06)' }} />
          <div className="relative z-10">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <p className="text-sm font-light tracking-wide mb-1" style={{ color: '#d4a843' }}>Welcome back</p>
                <h2 className="text-2xl font-light text-white cantara-serif">{client.name}</h2>
                <p className="text-slate-400 mt-1 text-sm font-light">{client.company}</p>
                <p className="text-xs mt-2" style={{ color: 'rgba(212,168,67,0.7)' }}>{workstreamSubtitle}</p>
              </div>
              <div className="space-y-2">
                {openReqs.length > 0 && (
                  <button
                    onClick={() => setPhase('requirements')}
                    className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg transition-all"
                    style={{ background: 'rgba(244,63,94,0.15)', color: '#fda4af', border: '1px solid rgba(244,63,94,0.2)' }}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    {openReqs.length} item{openReqs.length > 1 ? 's' : ''} need your attention
                  </button>
                )}
                {unreadMsgs > 0 && (
                  <button
                    onClick={() => setShowChat(true)}
                    className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg transition-all"
                    style={{ background: 'rgba(184,146,42,0.15)', color: '#d4a843', border: '1px solid rgba(184,146,42,0.2)' }}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    {unreadMsgs} new message{unreadMsgs > 1 ? 's' : ''} from your team
                  </button>
                )}
              </div>
            </div>
            <div className="mt-5">
              <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                <span>Overall progress</span>
                <span>
                  {isTeamMemberSession
                    ? `${visiblePortalProgress.completed} of ${visiblePortalProgress.total} applicable documents uploaded`
                    : `${portalProgress.completed} of ${portalProgress.total} applicable documents uploaded`}
                  {savingStatuses ? ' · Saving…' : ''}
                </span>
              </div>
              <ProgressBar value={
                isTeamMemberSession
                  ? (visiblePortalProgress.total ? Math.round((visiblePortalProgress.completed / visiblePortalProgress.total) * 100) : 0)
                  : (portalProgress.total ? Math.round((portalProgress.completed / portalProgress.total) * 100) : 0)
              } />
              <p className="text-[10px] text-slate-500 mt-1.5">
                Counts only documents you confirmed you have (or that are required). Multi-year items count as one slot per year.
              </p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-6 items-start">
          <aside className="bg-white rounded-2xl border border-slate-200 p-3 sticky top-24">
            <div className="mb-3 px-3 pt-2 pb-1">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Portal Sections</p>
            </div>
            <div className="space-y-1">
              {PHASES.filter(p => {
                if (!isTeamMemberSession) return true
                if (p.id === 'assign') return false
                if (p.id === 'information' && !hasAssignedForms) return false
                if (p.id === 'requirements' && visibleRequirements.length === 0) return false
                return true
              }).map(p => {
                const isActive = phase === p.id
                const hasBadge = (p.id === 'requirements' && openReqs.length > 0) || p.id === 'information'
                const disabled = Boolean((p as any).disabled)
                const isStepHighlighted = false
                return (
                  <button
                    key={p.id}
                    id={`tour-tab-${p.id}`}
                    onClick={() => !disabled && setPhase(p.id)}
                    disabled={disabled}
                    className={`w-full relative flex items-center justify-between gap-2 px-3 py-3 rounded-xl text-sm font-medium transition-all ${
                      disabled
                        ? 'text-slate-300 bg-slate-50 border border-slate-100 cursor-not-allowed'
                        : isActive
                        ? 'text-white shadow-sm'
                        : 'text-slate-500 bg-white border border-slate-200 hover:border-slate-300 hover:text-slate-700'
                    } ${isStepHighlighted ? 'z-[61] ring-2 ring-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.25)] bg-white!' : ''}`}
                    style={disabled ? {} : isActive ? { background: 'linear-gradient(135deg, #0d1829, #111e35)', border: '1px solid rgba(184,146,42,0.3)' } : {}}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {p.id === 'assign' && allConfirmedAssigned && !disabled && (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                      {disabled && <Lock className="w-3.5 h-3.5" />}
                      <span className="truncate">{p.label}</span>
                    </span>
                    {hasBadge && p.id === 'requirements' && (
                      <span className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ background: '#f43f5e', color: 'white' }}>
                        {openReqs.length}
                      </span>
                    )}
                    {hasBadge && p.id === 'information' && (
                      <span className="w-2 h-2 rounded-full" style={{ background: '#d4a843' }} />
                    )}
                  </button>
                )
              })}
            </div>
          </aside>

          <AnimatePresence mode="wait">
            <motion.div
              key={phase}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {phase === 'overview' && (
                <OverviewTab
                  client={client}
                  wsLabel={wsLabel}
                  newTeamMember={newTeamMember}
                  setNewTeamMember={setNewTeamMember}
                  savingTeamMember={savingTeamMember}
                  editingTeamMemberId={editingTeamMemberId}
                  addTeamMember={addTeamMember}
                  startEditingTeamMember={startEditingTeamMember}
                  deleteTeamMember={deleteTeamMember}
                  cancelEditingTeamMember={() => {
                    setEditingTeamMemberId(null)
                    setNewTeamMember({ name: '', email: '', role: '' })
                  }}
                  deletingTeamMemberId={deletingTeamMemberId}
                  isTeamMemberSession={isTeamMemberSession}
                  tourStep={tourStep}
                />
              )}
              {phase === 'assign' && (
                <AssignTab
                  valuationDocs={valuationDocs}
                  categories={categories}
                  getStatus={getDocStatus}
                  setStatus={setDocStatus}
                  teamMembers={client.teamMembers}
                  allAssigned={allConfirmedAssigned}
                  getDeadline={getDeadline}
                  savingStatuses={savingStatuses}
                  client={client}
                  newTeamMember={newTeamMember}
                  setNewTeamMember={setNewTeamMember}
                  savingTeamMember={savingTeamMember}
                  editingTeamMemberId={editingTeamMemberId}
                  addTeamMember={addTeamMember}
                  startEditingTeamMember={startEditingTeamMember}
                  deleteTeamMember={deleteTeamMember}
                  cancelEditingTeamMember={() => {
                    setEditingTeamMemberId(null)
                    setNewTeamMember({ name: '', email: '', role: '' })
                  }}
                  deletingTeamMemberId={deletingTeamMemberId}
                  isTeamMemberSession={isTeamMemberSession}
                  sessionEmail={sessionEmail}
                  sectionDeadlines={sectionDeadlines}
                  formQuestions={formQuestions}
                  setClient={setClient}
                  tourStep={tourStep}
                  onSubViewChange={() => {}}
                />
              )}
              {phase === 'information' && (
                <AgentInformationTab
                  clientId={client.id}
                  uploaderEmail={sessionEmail || client.email}
                  client={client}
                  isTeamMemberSession={isTeamMemberSession}
                  sessionTeamMember={sessionTeamMember}
                  setClient={setClient}
                />
              )}
              {phase === 'collection' && (
                <CollectionTab
                  valuationDocs={visibleValuationDocs}
                  categories={visibleCategories}
                  getStatus={getDocStatus}
                  setStatus={setDocStatus}
                  clientId={client.id}
                  clientName={client.company || client.name || 'Client'}
                  uploaderEmail={sessionEmail || client.email}
                  sectionSubmissions={client.sectionSubmissions ?? {}}
                  onSubmitSection={submitSection}
                  submittingSectionId={submittingSectionId}
                  getDeadline={getDeadline}
                  sectionDeadlines={sectionDeadlines}
                  tourStep={tourStep}
                />
              )}
              {phase === 'requirements' && (
                <RequirementsClientTab
                  requirements={visibleRequirements}
                  teamMembers={client.teamMembers}
                  isTeamMemberSession={isTeamMemberSession}
                  onRequirementUpdated={(updated) => {
                    setRequirements(prev => prev.map(item => item.id === updated.id ? updated : item))
                  }}
                />
              )}
              {phase === 'roadmap' && (
                <RoadmapTab
                  clientId={client.id}
                  client={{
                    id: client.id,
                    name: client.name,
                    company: client.company,
                    businessAddress: client.businessAddress,
                    businessCategory: client.businessCategory,
                    websiteUrl: client.websiteUrl,
                    state: client.state,
                    dba: client.dba,
                    totalEmployeesSelfReported: client.totalEmployeesSelfReported,
                    employmentTypeBreakdown: client.employmentTypeBreakdown,
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Chat button */}
      <button
        onClick={() => setShowChat(v => !v)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-30 transition-transform hover:scale-105"
        style={{ background: '#0d1829', border: '2px solid rgba(184,146,42,0.4)' }}
      >
        <MessageSquare className="w-5 h-5 text-white/80" />
        {unreadMsgs > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full text-xs font-bold text-white flex items-center justify-center" style={{ background: '#ef4444' }}>
            {unreadMsgs > 9 ? '9+' : unreadMsgs}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {showChat && (
        <div className="fixed bottom-24 right-6 z-40 w-[min(92vw,380px)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden" style={{ height: '460px' }}>
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0" style={{ background: '#0d1829' }}>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-white/60" />
              <span className="text-sm font-medium text-white">Your Cantara Team</span>
            </div>
            <button onClick={() => setShowChat(false)} className="text-white/40 hover:text-white/70"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex flex-col flex-1 min-h-0 p-3">
            <ChatThread
              messages={chat.messages}
              viewer="client"
              draft={chatDraft}
              onDraftChange={setChatDraft}
              onSend={() => void submitChat()}
              sending={chat.sending}
              emptyHint="Send a message to your Cantara advisor team. Replies appear here and update your notification badge."
              placeholder="Message your team…"
              composeRows={2}
              maxHeightClass="flex-1 min-h-0"
            />
          </div>
        </div>
      )}

      {tourStep !== null && mustChangePassword && tourTargetPos && (() => {
        const currentStepData = TOUR_STEPS.find(s => s.step === tourStep)
        if (!currentStepData) return null

        const tooltipWidth = typeof window !== 'undefined' ? Math.min(320, window.innerWidth - 32) : 320
        const tooltipEstimatedHeight = 180
        const margin = 16
        let left = tourTargetPos.x - tooltipWidth / 2
        const minLeft = margin
        const maxLeft = typeof window !== 'undefined' ? window.innerWidth - tooltipWidth - margin : 0
        if (left < minLeft) left = minLeft
        if (left > maxLeft) left = maxLeft

        const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800
        const spaceBelow = viewportHeight - tourTargetPos.bottom
        // Keep the highlighted control visible and clickable whenever there is
        // enough room below it. Only place the tooltip above when necessary.
        const placeAbove = spaceBelow < (tooltipEstimatedHeight + 20)

        let top = 0
        if (placeAbove) {
          top = tourTargetPos.top - tooltipEstimatedHeight - 12
          if (top < margin) {
            top = margin
          }
        } else {
          top = tourTargetPos.bottom + 12
        }

        const arrowLeft = tourTargetPos.x - left

        const dismissTour = () => {
          setTourStep(null)
          setTourPaused(false)
          setMustChangePassword(false)
          localStorage.setItem('cantara_client_must_change_password', JSON.stringify(false))
          localStorage.removeItem('cantara_client_tour_step')
          localStorage.removeItem('cantara_client_tour_paused')
        }

        const pauseTour = () => {
          if (tourStep === null) return
          localStorage.setItem('cantara_client_tour_step', String(tourStep))
          localStorage.setItem('cantara_client_tour_paused', 'true')
          setTourStep(null)
          setTourPaused(true)
        }

        return (
          <>
            <div className="fixed inset-0 z-[55] bg-slate-950/45" />
            <motion.div
              key={tourStep}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                left: `${left}px`,
                top: `${top}px`,
                width: `${tooltipWidth}px`,
              }}
              className="fixed z-[70] rounded-2xl border border-amber-200 bg-white shadow-2xl"
            >
              {placeAbove ? (
                <div 
                  style={{ left: `${arrowLeft}px` }}
                  className="absolute -bottom-2 h-4 w-4 -translate-x-1/2 rotate-45 border-r border-b border-amber-200 bg-white" 
                />
              ) : (
                <div 
                  style={{ left: `${arrowLeft}px` }}
                  className="absolute -top-2 h-4 w-4 -translate-x-1/2 rotate-45 border-l border-t border-amber-200 bg-white" 
                />
              )}
              <div className="p-4">
                <div className="flex items-center justify-between gap-2 border-b border-slate-50 pb-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-amber-600">
                    Step {tourStep} of {TOUR_STEPS.length}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-900 mt-2">{currentStepData.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {currentStepData.desc}
                </p>
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={dismissTour}
                    className="text-xs font-medium text-slate-500 hover:text-slate-700"
                  >
                    Skip tour
                  </button>
                  <button
                    type="button"
                    onClick={pauseTour}
                    className="text-xs font-medium text-slate-500 hover:text-slate-700"
                  >
                    Pause tour
                  </button>
                  <div className="flex items-center gap-2">
                    {tourStep > 1 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setTourStep(prev => prev !== null ? prev - 1 : null)}
                      >
                        Back
                      </Button>
                    )}
                    {tourStep > 1 && tourStep < TOUR_STEPS.length ? (
                      <Button 
                        size="sm" 
                        onClick={() => setTourStep(prev => prev !== null ? prev + 1 : null)}
                      >
                        Next
                      </Button>
                    ) : (
                      tourStep === TOUR_STEPS.length ? (
                        <Button
                          size="sm"
                          onClick={dismissTour}
                        >
                          Got it
                        </Button>
                      ) : (
                        <span className="text-xs text-amber-600 font-medium animate-pulse">
                          Click the gear icon
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )
      })()}
    </div>
  )
}

// ── Overview Tab ─────────────────────────────────────────────────────────────
function TeamMembersPanel({
  client,
  newTeamMember,
  setNewTeamMember,
  savingTeamMember,
  deletingTeamMemberId,
  editingTeamMemberId,
  addTeamMember,
  startEditingTeamMember,
  deleteTeamMember,
  cancelEditingTeamMember,
  isTeamMemberSession,
  tourStep,
}: {
  client: Client
  newTeamMember: { name: string; email: string; role: string }
  setNewTeamMember: Dispatch<SetStateAction<{ name: string; email: string; role: string }>>
  savingTeamMember: boolean
  deletingTeamMemberId: string | null
  editingTeamMemberId: string | null
  addTeamMember: () => Promise<void>
  startEditingTeamMember: (member: Client['teamMembers'][number]) => void
  deleteTeamMember: (memberId: string) => Promise<void>
  cancelEditingTeamMember: () => void
  isTeamMemberSession: boolean
  tourStep?: number | null
}) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const pageSize = 5
  const normalizedQuery = query.trim().toLowerCase()
  const filteredMembers = normalizedQuery
    ? client.teamMembers.filter(member =>
        [member.name, member.email, member.role].some(value => value.toLowerCase().includes(normalizedQuery)),
      )
    : client.teamMembers
  const pageCount = Math.max(1, Math.ceil(filteredMembers.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const visibleMembers = filteredMembers.slice((safePage - 1) * pageSize, safePage * pageSize)

  useEffect(() => {
    setPage(1)
  }, [query, client.teamMembers.length])

  useEffect(() => {
    if (editingTeamMemberId) setShowModal(true)
  }, [editingTeamMemberId])

  const openAddModal = () => {
    cancelEditingTeamMember()
    setShowModal(true)
  }

  const closeModal = () => {
    if (savingTeamMember) return
    setShowModal(false)
    cancelEditingTeamMember()
  }

  if (isTeamMemberSession) {
    return null
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-600" />
            <h3 className="text-lg font-semibold text-slate-800 cantara-serif">Your Team</h3>
          </div>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl">
            Add people who will help collect and upload documents. New team members receive portal login details by email.
          </p>
        </div>
        <Button 
          id="tour-add-team-member"
          size="sm" 
          onClick={openAddModal} 
          className={`w-full justify-center md:w-auto transition-all ${
            tourStep === 3 ? 'relative z-[61] ring-2 ring-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.25)]' : ''
          }`}
        >
          <Plus className="w-4 h-4" />
          Add Team Member
        </Button>
      </div>

      {client.teamMembers.length > 0 && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search by name, email, or role"
            className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none transition-all focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          />
        </div>
      )}

      <div className="max-h-[360px] overflow-y-auto rounded-xl border border-slate-100">
        {client.teamMembers.length === 0 ? (
          <div className="border border-dashed border-slate-200 p-5 text-sm text-slate-400">
            No team members added yet.
          </div>
        ) : visibleMembers.length === 0 ? (
          <div className="p-5 text-sm text-slate-400">
            No team members match your search.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visibleMembers.map(m => (
              <div key={m.id} className="flex flex-col gap-3 bg-white px-4 py-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-sm font-semibold text-amber-700 shrink-0">{m.name[0]}</div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-700">{m.name}</p>
                    <p className="truncate text-xs text-slate-400">{m.email}{m.role ? ` · ${m.role}` : ''}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => startEditingTeamMember(m)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => void deleteTeamMember(m.id)} disabled={deletingTeamMemberId === m.id}>
                    {deletingTeamMemberId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {filteredMembers.length > pageSize && (
        <div className="mt-3 flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filteredMembers.length)} of {filteredMembers.length}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setPage(prev => Math.max(1, prev - 1))} disabled={safePage === 1}>Previous</Button>
            <Button size="sm" variant="outline" onClick={() => setPage(prev => Math.min(pageCount, prev + 1))} disabled={safePage === pageCount}>Next</Button>
          </div>
        </div>
      )}

      <Modal open={showModal} onClose={closeModal} title={editingTeamMemberId ? 'Edit Team Member' : 'Add Team Member'} zIndexClassName="z-[80]">
        <div className="space-y-4">
          <Input
            label="Name"
            placeholder="Team member name"
            value={newTeamMember.name}
            onChange={e => setNewTeamMember(prev => ({ ...prev, name: e.target.value }))}
          />
          <Input
            label="Email"
            placeholder="Team member email"
            type="email"
            value={newTeamMember.email}
            onChange={e => setNewTeamMember(prev => ({ ...prev, email: e.target.value }))}
          />
          <Input
            label="Role"
            placeholder="Optional"
            value={newTeamMember.role}
            onChange={e => setNewTeamMember(prev => ({ ...prev, role: e.target.value }))}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="ghost" onClick={closeModal} disabled={savingTeamMember}>Cancel</Button>
            <Button
              size="sm"
              onClick={async () => {
                await addTeamMember()
                setShowModal(false)
              }}
              disabled={savingTeamMember || !newTeamMember.name.trim() || !newTeamMember.email.trim()}
            >
              {savingTeamMember && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {savingTeamMember ? (editingTeamMemberId ? 'Saving...' : 'Sending Invite...') : (editingTeamMemberId ? 'Save Changes' : 'Send Invite')}
            </Button>
          </div>
          {!editingTeamMemberId && (
            <p className="text-xs text-slate-400">
              This creates a login under this client profile and emails generated credentials automatically.
            </p>
          )}
        </div>
      </Modal>
    </div>
  )
}

function OverviewTab({
  client,
  wsLabel,
  newTeamMember,
  setNewTeamMember,
  savingTeamMember,
  deletingTeamMemberId,
  editingTeamMemberId,
  addTeamMember,
  startEditingTeamMember,
  deleteTeamMember,
  cancelEditingTeamMember,
  isTeamMemberSession,
  tourStep,
}: {
  client: Client
  wsLabel: Record<string, string>
  newTeamMember: { name: string; email: string; role: string }
  setNewTeamMember: Dispatch<SetStateAction<{ name: string; email: string; role: string }>>
  savingTeamMember: boolean
  deletingTeamMemberId: string | null
  editingTeamMemberId: string | null
  addTeamMember: () => Promise<void>
  startEditingTeamMember: (member: Client['teamMembers'][number]) => void
  deleteTeamMember: (memberId: string) => Promise<void>
  cancelEditingTeamMember: () => void
  isTeamMemberSession: boolean
  tourStep?: number | null
}) {
  const steps = [
    { title: 'Assign Documents', desc: 'Tell us which documents you have, and then assign each document to yourself or a team member who will upload it.' },
    { title: 'Document Upload', desc: 'Upload the required documents.' },
    { title: 'Required Information', desc: 'Complete any short forms needed by your advisor tools, such as websites, profiles, and competitor names.' },
    { title: 'Review', desc: 'Your advisor team will review materials and follow up through the chat button in the bottom right corner.' },
  ]
  return (
    <div className="space-y-6">
      <div 
        id="tour-workstream-card"
        className={`bg-white rounded-2xl p-6 border border-slate-200 transition-all ${
          tourStep === 4 ? 'relative z-[61] ring-2 ring-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.2)]' : ''
        }`}
      >
        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-3">Assigned Workstream</p>
        <h3 className="text-xl font-semibold text-slate-800 cantara-serif">
          {client.workstream ? wsLabel[client.workstream] : 'Awaiting Workstream Assignment'}
        </h3>
        <p className="text-sm text-slate-500 mt-3 max-w-2xl leading-relaxed">
          Your advisor team will guide you through the process. If you have questions at any point, use the chat button in the bottom right corner.
        </p>
      </div>
 
      <TeamMembersPanel
        client={client}
        newTeamMember={newTeamMember}
        setNewTeamMember={setNewTeamMember}
        savingTeamMember={savingTeamMember}
        deletingTeamMemberId={deletingTeamMemberId}
        editingTeamMemberId={editingTeamMemberId}
        addTeamMember={addTeamMember}
        startEditingTeamMember={startEditingTeamMember}
        deleteTeamMember={deleteTeamMember}
        cancelEditingTeamMember={cancelEditingTeamMember}
        isTeamMemberSession={isTeamMemberSession}
        tourStep={tourStep}
      />
 
      <div 
        id="tour-process-card"
        className={`bg-white rounded-2xl p-6 border border-slate-200 transition-all ${
          tourStep === 5 ? 'relative z-[61] ring-2 ring-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.2)]' : ''
        }`}
      >
        <h3 className="text-lg font-semibold text-slate-800 cantara-serif mb-4">The Process</h3>
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={step.title} className="flex gap-4">
              <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white" style={{ background: '#b8922a' }}>
                {index + 1}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{step.title}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Valuation Tab ────────────────────────────────────────────────────────────
// ── Assign Tab (was Preparation) ─────────────────────────────────────────────
// UX from meeting: client first says Yes/No per doc, then assigns YES docs only
function DocumentReferenceLink({ docId }: { docId: string }) {
  const ref = DOCUMENT_REFERENCE_TEMPLATES[docId]
  if (!ref) return null
  return (
    <a
      href={ref.path}
      className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-800 mt-1"
      download
    >
      <FileSpreadsheet className="w-3 h-3" />
      {ref.label}
    </a>
  )
}

function MultiYearDocumentUpload({
  docId,
  clientId,
  uploaderEmail,
  getStatus,
  setStatus,
  filesByDocId,
  refreshFileCatalog,
}: {
  docId: string
  clientId: string
  uploaderEmail: string
  getStatus: (id: string) => DocumentStatus
  setStatus: (id: string, u: Partial<DocumentStatus>) => void
  filesByDocId: FilesByDocumentId
  refreshFileCatalog: () => Promise<void>
}) {
  const labels = MULTI_YEAR_UPLOAD_SLOTS[docId] ?? []
  const combinedId = getMultiYearCombinedId(docId)
  const progress = getMultiYearUploadProgress(docId, getStatus)
  const hasCombinedCoverage = progress.completed === progress.total && progress.total > 0
  const showPerYearIncludedOnly = hasCombinedCoverage && progress.perYearCompleted === 0
  const allComplete = hasCombinedCoverage

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-800">
            {labels.length} years required — choose how you upload
          </p>
          <Badge color={allComplete ? 'green' : progress.completed > 0 ? 'gold' : 'slate'}>
            {allComplete ? 'All years covered' : `${progress.completed} of ${progress.total} years`}
          </Badge>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
          Use <span className="font-medium text-slate-600">one file</span> if all years are in a single PDF or ZIP, or upload{' '}
          <span className="font-medium text-slate-600">each year separately</span> as you receive them.
        </p>
      </div>

      <div className="border-b border-slate-100 px-4 py-4">
        <div className="mb-3 flex items-start gap-2.5">
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: hasCombinedCoverage ? '#059669' : '#b8922a' }}
          >
            A
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-800">All years in one file</p>
            <p className="mt-0.5 text-[11px] text-slate-500">One PDF with all returns, or a ZIP with a file per year inside.</p>
          </div>
        </div>
        <DocumentUploadPanel
          clientId={clientId}
          uploadDocumentId={combinedId}
          uploaderEmail={uploaderEmail}
          files={mergeUploadedFiles([combinedId, docId], filesByDocId)}
          onFilesChange={() => {}}
          onStatusChange={summary => applyDocumentUploadSummary(setStatus, combinedId, summary, [docId])}
          onAfterMutation={refreshFileCatalog}
        />
      </div>

      <div className="px-4 py-4">
        <div className="mb-3 flex items-start gap-2.5">
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: !showPerYearIncludedOnly && progress.perYearCompleted === progress.total ? '#059669' : '#94a3b8' }}
          >
            B
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-800">One file per year</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {showPerYearIncludedOnly
                ? 'Not needed while option A covers all years. Remove files above to upload by year instead.'
                : 'Upload each year when you have it. You can add multiple files per year.'}
            </p>
          </div>
        </div>

        {showPerYearIncludedOnly ? (
          <div className="space-y-2">
            {labels.map(label => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-2"
              >
                <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                <span className="text-xs font-medium text-emerald-800">{label}</span>
                <span className="ml-auto text-[10px] text-emerald-600">Included in combined file</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {labels.map((label, index) => {
              const slotId = `${docId}__year_${index + 1}`
              return (
                <div key={slotId} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
                  <p className="text-xs font-medium text-slate-600 mb-2">{label}</p>
                  <DocumentUploadPanel
                    clientId={clientId}
                    uploadDocumentId={slotId}
                    uploaderEmail={uploaderEmail}
                    files={filesByDocId[slotId] ?? []}
                    onFilesChange={() => {}}
                    onStatusChange={summary => applyDocumentUploadSummary(setStatus, slotId, summary)}
                    onAfterMutation={refreshFileCatalog}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function AssignTab({
  valuationDocs,
  categories,
  getStatus,
  setStatus,
  teamMembers,
  allAssigned,
  getDeadline,
  savingStatuses,
  client,
  newTeamMember,
  setNewTeamMember,
  savingTeamMember,
  editingTeamMemberId,
  addTeamMember,
  startEditingTeamMember,
  deleteTeamMember,
  cancelEditingTeamMember,
  deletingTeamMemberId,
  isTeamMemberSession,
  sessionEmail,
  sectionDeadlines,
  formQuestions,
  setClient,
  onSubViewChange,
  tourStep,
}: {
  valuationDocs: ReturnType<typeof getValuationDocsForWorkstream>
  categories: ReturnType<typeof getDocsForWorkstream>
  getStatus: (id: string) => DocumentStatus
  setStatus: (id: string, u: Partial<DocumentStatus>) => void
  teamMembers: Client['teamMembers']
  allAssigned: boolean
  getDeadline: (docId: string, sectionId: string) => string | null
  savingStatuses: boolean
  client: Client
  newTeamMember: { name: string; email: string; role: string }
  setNewTeamMember: Dispatch<SetStateAction<{ name: string; email: string; role: string }>>
  savingTeamMember: boolean
  editingTeamMemberId: string | null
  addTeamMember: () => Promise<void>
  startEditingTeamMember: (member: Client['teamMembers'][number]) => void
  deleteTeamMember: (memberId: string) => Promise<void>
  cancelEditingTeamMember: () => void
  deletingTeamMemberId: string | null
  isTeamMemberSession: boolean
  sessionEmail: string
  sectionDeadlines: Record<string, string>
  formQuestions: ClientPortalFormQuestion[]
  setClient: Dispatch<SetStateAction<Client | null>>
  onSubViewChange?: (v: 'yesno' | 'assign' | 'assigned') => void
  tourStep?: number | null
}) {
  const [subView, setSubView] = useState<'yesno' | 'assign' | 'assigned'>('yesno')

  useEffect(() => {
    if (tourStep === 6) {
      setSubView('yesno')
    } else if (tourStep === 7 || tourStep === 8) {
      setSubView('assign')
    } else if (tourStep === 9) {
      setSubView('assigned')
    }
  }, [tourStep])
  const diligenceDocs = categories.flatMap(c => c.documents)
  const allDocs = [...valuationDocs, ...diligenceDocs]
  const assignableDocs = allDocs.filter(d => d.type === 'required' || valuationDocs.some(v => v.id === d.id) || getStatus(d.id).hasDoc === true)
  const assignedDocs = assignableDocs.filter(doc => Boolean(getStatus(doc.id).assignedTo))
  const currentTeamMember = teamMembers.find(member => member.email.toLowerCase() === sessionEmail.toLowerCase())
  const currentAssigneeValues = currentTeamMember
    ? [currentTeamMember.name, currentTeamMember.email]
    : ['me', client.name, client.email]
  const isAssignedToMe = (docId: string) => {
    const assignedTo = getStatus(docId).assignedTo?.toLowerCase()
    return Boolean(assignedTo && currentAssigneeValues.some(value => value.toLowerCase() === assignedTo))
  }
  const myAssignedDocs = assignedDocs.filter(doc => isAssignedToMe(doc.id))
  const otherAssignedDocs = assignedDocs.filter(doc => !isAssignedToMe(doc.id))
  const otherDocsByAssignee = otherAssignedDocs.reduce<Array<{ assignee: string; documents: typeof otherAssignedDocs }>>((groups, doc) => {
    const assignee = getStatus(doc.id).assignedTo || 'Unassigned'
    const existingGroup = groups.find(group => group.assignee.toLowerCase() === assignee.toLowerCase())
    if (existingGroup) {
      existingGroup.documents.push(doc)
    } else {
      groups.push({ assignee, documents: [doc] })
    }
    return groups
  }, [])
  const answeredAll = diligenceDocs
    .filter(d => d.type !== 'required')
    .every(d => getStatus(d.id).hasDoc !== null || getStatus(d.id).notApplicable)

  return (
    <div className="space-y-4">
      {/* Step switcher */}
      <div 
        id="tour-assign-switcher" 
        className={`bg-white rounded-2xl border border-slate-200 p-1 flex gap-1 transition-all ${
          (tourStep === 6 || tourStep === 7 || tourStep === 9) ? 'relative z-[61] ring-2 ring-amber-400 shadow-lg' : ''
        }`}
      >
        {(['yesno', 'assign', 'assigned'] as const).map(v => (
          <button
            key={v}
            onClick={() => {
              setSubView(v)
              onSubViewChange?.(v)
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all ${subView === v ? 'text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            style={subView === v ? { background: '#0d1829' } : {}}
          >
            {v === 'yesno'
              ? '1 — Tell us which documents you have'
              : v === 'assign'
                ? '2 — Assign documents'
                : '3 — Assigned documents'}
            {v === 'assign' && allAssigned && <CheckCircle className="w-3 h-3 text-emerald-400 inline ml-1.5" />}
          </button>
        ))}
      </div>

      {subView === 'yesno' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-700 leading-relaxed">
            Please note that the documents in this section are optional. Choose <span className="font-semibold">Yes</span> if you have it, <span className="font-semibold">No</span> if you do not, or <span className="font-semibold">N/A</span> if it does not apply to your business. Required and valuation documents are handled in step 2.
          </div>
          {categories.filter(cat => cat.documents.some(doc => doc.type !== 'required')).map(cat => (
            <div key={cat.id} className="bg-white rounded-2xl border border-slate-200">
              <div className="px-5 py-3 border-b border-slate-100">
                <h4 className="text-sm font-semibold text-slate-700">{cat.title}</h4>
              </div>
              <div className="divide-y divide-slate-50">
                {cat.documents.filter(doc => doc.type !== 'required').map(doc => {
                  const s = getStatus(doc.id)
                  return (
                    <div key={doc.id} className="px-5 py-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-slate-800">{doc.name}</p>
                          {doc.type === 'required' && <Badge color="gold">Required</Badge>}
                          {doc.flagged && <Badge color="red">Flagged</Badge>}
                        </div>
                        {doc.description && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{doc.description}</p>}
                        <DocumentReferenceLink docId={doc.id} />
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Toggle: Yes */}
                        <button
                          onClick={() => setStatus(doc.id, { hasDoc: s.hasDoc === true ? null : true, notApplicable: false })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            s.hasDoc === true ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-400 hover:border-emerald-300'
                          }`}
                        >
                          ✓ Yes
                        </button>
                        {/* Toggle: No */}
                        <button
                          onClick={() => setStatus(doc.id, { hasDoc: s.hasDoc === false ? null : false, notApplicable: false })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            s.hasDoc === false ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-400 hover:border-rose-200'
                          }`}
                        >
                          ✗ No
                        </button>
                        {/* N/A */}
                        {doc.type !== 'required' && (
                          <button
                            onClick={() => setStatus(doc.id, { notApplicable: !s.notApplicable, hasDoc: null })}
                            className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              s.notApplicable ? 'border-slate-400 bg-slate-100 text-slate-600' : 'border-slate-100 text-slate-300 hover:border-slate-300'
                            }`}
                          >
                            N/A
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {answeredAll && (
            <div className="flex justify-end">
              <Button onClick={() => setSubView('assign')}>
                Assign Documents <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {subView === 'assign' && (
        <div className="space-y-4">
          {!isTeamMemberSession && (
            <TeamMembersPanel
              client={client}
              newTeamMember={newTeamMember}
              setNewTeamMember={setNewTeamMember}
              savingTeamMember={savingTeamMember}
              deletingTeamMemberId={deletingTeamMemberId}
              editingTeamMemberId={editingTeamMemberId}
              addTeamMember={addTeamMember}
              startEditingTeamMember={startEditingTeamMember}
              deleteTeamMember={deleteTeamMember}
              cancelEditingTeamMember={cancelEditingTeamMember}
              isTeamMemberSession={isTeamMemberSession}
            />
          )}
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 leading-relaxed">
            Choose who will upload each document. Files are stored securely and synced to your Cantara Google Drive folder when connected. Team members you invite can sign in with their email to upload only what is assigned to them.
          </div>
          {savingStatuses && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving assignment...
            </div>
          )}
          {assignableDocs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-400">
              No documents available to assign yet.
            </div>
          ) : (
            <>
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-amber-200/80 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h4 className="text-sm font-semibold text-amber-900">Valuation Documents</h4>
                    <p className="text-xs text-amber-700 mt-1">Assign these first to yourself or a team member who will upload them.</p>
                  </div>
                  {sectionDeadlines[VALUATION_SECTION_ID] && (
                    <TargetDeadlineBadge deadline={sectionDeadlines[VALUATION_SECTION_ID]} uploaded={false} />
                  )}
                </div>
                <div className="divide-y divide-amber-100/80">
                  {valuationDocs.map((doc, index) => {
                    const s = getStatus(doc.id)
                    const options = [
                      { value: 'me', label: 'Me' },
                      ...teamMembers.map(m => ({ value: m.name, label: m.name + ' · ' + m.role })),
                    ]
                    return (
                      <div key={doc.id} className="px-5 py-4 bg-white/60 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-slate-800">{doc.name}</p>
                            <Badge color="gold">Required</Badge>
                            {s.hasDoc === false && <Badge color="amber">Not available with client</Badge>}
                          </div>
                          {doc.description && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{doc.description}</p>}
                          <DocumentReferenceLink docId={doc.id} />
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setStatus(doc.id, { hasDoc: true, unavailableDecision: null, notApplicable: false })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              s.hasDoc !== false ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-400 hover:border-emerald-300'
                            }`}
                          >
                            Available
                          </button>
                          <button
                            type="button"
                            onClick={() => setStatus(doc.id, { hasDoc: s.hasDoc === false ? true : false, assignedTo: null, unavailableDecision: null, notApplicable: false })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              s.hasDoc === false ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-slate-200 text-slate-400 hover:border-amber-300'
                            }`}
                          >
                            Not available
                          </button>
                          <select
                            id={index === 0 ? 'tour-assign-dropdown-first' : undefined}
                            className={`text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-amber-400 transition-all disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${
                              (index === 0 && tourStep === 8) ? 'relative z-[61] ring-2 ring-amber-400 shadow-lg' : ''
                            }`}
                            value={s.assignedTo ?? ''}
                            disabled={s.hasDoc === false}
                            onChange={e => setStatus(doc.id, { assignedTo: e.target.value || null })}
                          >
                            <option value="">— Assign to —</option>
                            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          {s.assignedTo && s.hasDoc !== false && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-700">
                Required documents and valuation documents appear here automatically. Optional documents appear here once the client confirms they have them.
              </div>
              {categories.map(cat =>
                diligenceDocs
                  .filter(doc => cat.documents.some(item => item.id === doc.id))
                  .filter(doc => doc.type === 'required' || getStatus(doc.id).hasDoc === true)
                  .map(doc => {
                const s = getStatus(doc.id)
                const options = [
                  { value: 'me', label: 'Me' },
                  ...teamMembers.map(m => ({ value: m.name, label: m.name + ' · ' + m.role })),
                ]
                return (
                  <div key={doc.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-slate-800">{doc.name}</p>
                        {doc.type === 'required' && <Badge color="gold">Required</Badge>}
                        {s.hasDoc === false && <Badge color="amber">Not available with client</Badge>}
                      </div>
                      {doc.description && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{doc.description}</p>}
                      <DocumentReferenceLink docId={doc.id} />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {doc.type === 'required' && (
                        <>
                          <button
                            type="button"
                            onClick={() => setStatus(doc.id, { hasDoc: true, unavailableDecision: null, notApplicable: false })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              s.hasDoc !== false ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-400 hover:border-emerald-300'
                            }`}
                          >
                            Available
                          </button>
                          <button
                            type="button"
                            onClick={() => setStatus(doc.id, { hasDoc: s.hasDoc === false ? true : false, assignedTo: null, unavailableDecision: null, notApplicable: false })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              s.hasDoc === false ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-slate-200 text-slate-400 hover:border-amber-300'
                            }`}
                          >
                            Not available
                          </button>
                        </>
                      )}
                      <select
                        className="text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-amber-400 transition-all disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                        value={s.assignedTo ?? ''}
                        disabled={s.hasDoc === false}
                        onChange={e => setStatus(doc.id, { assignedTo: e.target.value || null })}
                      >
                        <option value="">— Assign to —</option>
                        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      {s.assignedTo && s.hasDoc !== false && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />}
                    </div>
                  </div>
                )
              }))}

              {(() => {
                const { activeFormKeys, formLabels: FORM_LABELS } = buildRequiredInfoFormTabs(formQuestions)

                if (activeFormKeys.length === 0) return null

                return (
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                      <h4 className="text-sm font-semibold text-slate-700">Required Info Assignments</h4>
                      <p className="text-xs text-slate-500 mt-1">Choose who will complete each form. Enter the answers in the Required Info tab.</p>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {activeFormKeys.map(formKey => {
                        const formAssignments = (client.sectionSubmissions as any)?.formAssignments ?? {}
                        const assignedTo = formAssignments[formKey] ?? (formKey === 'competitor_analysis' ? formAssignments.pricing_analysis : '') ?? ''
                        const options = [
                          { value: 'me', label: 'Me' },
                          ...teamMembers.map(m => ({ value: m.name, label: m.name + ' · ' + m.role })),
                        ]
                        return (
                          <div key={formKey} className="px-5 py-4 flex items-center gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800">{FORM_LABELS[formKey]}</p>
                              <p className="text-xs text-slate-500 mt-1">Interactive form / questionnaire for client portal onboarding.</p>
                            </div>
                            <select
                              className="text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-amber-400 transition-all"
                              value={assignedTo}
                              onChange={async (e) => {
                                const val = e.target.value || null
                                const nextAssignments = { ...((client.sectionSubmissions as any)?.formAssignments ?? {}), [formKey]: val }
                                const nextClient = {
                                  ...client,
                                  sectionSubmissions: {
                                    ...(client.sectionSubmissions ?? {}),
                                    formAssignments: nextAssignments,
                                  }
                                }
                                setClient(nextClient)
                                await saveClient(nextClient)
                              }}
                            >
                              <option value="">— Assign to —</option>
                              {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            {assignedTo && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {allAssigned && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">All documents assigned</p>
                    <p className="text-xs text-emerald-600 mt-0.5">Go to Document Upload to add files. Team members you invited can sign in with their email to upload assigned items.</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {subView === 'assigned' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 leading-relaxed">
            Track the documents assigned to you and the upload progress for documents assigned to other team members.
          </div>
          <AssignedDocumentStatusList
            title="Assigned to me"
            emptyMessage="No documents are assigned to you yet."
            documents={myAssignedDocs}
            getStatus={getStatus}
          />
          {otherDocsByAssignee.length === 0 ? (
            <AssignedDocumentStatusList
              title="Assigned to other team members"
              emptyMessage="No documents are assigned to other team members yet."
              documents={[]}
              getStatus={getStatus}
            />
          ) : (
            otherDocsByAssignee.map(group => (
              <AssignedDocumentStatusList
                key={group.assignee.toLowerCase()}
                title={`Assigned to ${group.assignee}`}
                emptyMessage=""
                documents={group.documents}
                getStatus={getStatus}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function AssignedDocumentStatusList({
  title,
  emptyMessage,
  documents,
  getStatus,
}: {
  title: string
  emptyMessage: string
  documents: Array<{ id: string; name: string; description?: string }>
  getStatus: (id: string) => DocumentStatus
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
        <span className="text-xs text-slate-400">{documents.length} {documents.length === 1 ? 'document' : 'documents'}</span>
      </div>
      {documents.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-slate-400">{emptyMessage}</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {documents.map(doc => {
            const status = getStatus(doc.id)
            const uploaded = Boolean(status.fileName || status.uploadedAt)
            return (
              <div key={doc.id} className="flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">{doc.name}</p>
                  {doc.description && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{doc.description}</p>}
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  uploaded ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {uploaded ? 'Uploaded' : 'Waiting'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Collection Tab ────────────────────────────────────────────────────────────

function isFacilityReviewFormQuestion(question: ClientPortalFormQuestion): boolean {
  return (
    question.fieldKey.startsWith('facilityReview') ||
    (question.groupKey ?? '').startsWith('facility_review')
  )
}

function facilityReviewSubgroupLabel(groupLabel: string): string {
  return groupLabel.replace(/^Facility Review\s*[-–]\s*/i, '').trim() || groupLabel
}

function buildOrderedFormQuestionGroups(
  questions: ClientPortalFormQuestion[],
): Array<{ groupLabel: string; questions: ClientPortalFormQuestion[] }> {
  const order: string[] = []
  const byLabel = new Map<string, ClientPortalFormQuestion[]>()
  for (const question of questions) {
    const label = question.groupLabel || 'Business Information'
    if (!byLabel.has(label)) {
      order.push(label)
      byLabel.set(label, [])
    }
    byLabel.get(label)!.push(question)
  }
  return order.map(groupLabel => ({ groupLabel, questions: byLabel.get(groupLabel)! }))
}

function FormQuestionFields({
  questions,
  formResponses,
  onUpdate,
  onError,
}: {
  questions: ClientPortalFormQuestion[]
  formResponses: Record<string, string>
  onUpdate: (fieldKey: string, value: string) => void
  onError: (message: string) => void
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {questions.map(question => {
        const commonClass =
          'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400'
        const structured = Boolean(STRUCTURED_FORM_COLUMNS[question.fieldKey])
        const Shell = structured ? 'div' : 'label'
        const shellClass = question.inputType === 'textarea' || structured ? 'md:col-span-2' : ''
        return (
          <Shell key={question.id} className={shellClass}>
            <span className="text-xs font-semibold text-slate-500">
              {question.label}
              {question.required && <span className="text-amber-600"> *</span>}
            </span>
            {question.description && (
              <span className="block text-[11px] text-slate-400 mt-0.5">
                {question.description}
              </span>
            )}
            {structured ? (
              <StructuredRowsInput
                question={question}
                value={formResponses[question.fieldKey] ?? ''}
                onChange={value => onUpdate(question.fieldKey, value)}
                onError={onError}
              />
            ) : question.inputType === 'textarea' ? (
              <textarea
                value={formResponses[question.fieldKey] ?? ''}
                onChange={e => onUpdate(question.fieldKey, e.target.value)}
                placeholder={question.placeholder ?? ''}
                className={`${commonClass} mt-1 min-h-[84px] resize-y`}
              />
            ) : question.inputType === 'select' ? (
              <select
                value={formResponses[question.fieldKey] ?? ''}
                onChange={e => onUpdate(question.fieldKey, e.target.value)}
                className={`${commonClass} mt-1 bg-white`}
              >
                <option value="">Select...</option>
                {(question.options ?? []).map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={
                  question.inputType === 'number'
                    ? 'number'
                    : question.inputType === 'url'
                      ? 'url'
                      : 'text'
                }
                value={formResponses[question.fieldKey] ?? ''}
                onChange={e => onUpdate(question.fieldKey, e.target.value)}
                placeholder={question.placeholder ?? ''}
                className={`${commonClass} mt-1`}
              />
            )}
          </Shell>
        )
      })}
    </div>
  )
}

const FACILITY_IMAGE_DOCUMENT_ID = 'facility_review_images'
const FACILITY_IMAGE_LIMIT = 5
const FACILITY_IMAGE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
}
const FACILITY_IMAGE_SECTIONS = [
  {
    key: 'exterior',
    title: 'Exterior & Curb Appeal',
    helper: 'Front facade, exterior signage, parking, entrance approach, visible exterior concerns.',
  },
  {
    key: 'reception',
    title: 'Reception',
    helper: 'Entrance view, front desk, flooring, retail display, lighting, condition concerns.',
  },
  {
    key: 'boarding',
    title: 'Boarding',
    helper: 'Boarding area, kennel tiers, cat area if applicable, HVAC, floors, equipment issues.',
  },
  {
    key: 'grooming',
    title: 'Grooming',
    helper: 'Grooming stations, tables, wash station, dryers, ventilation, organization.',
  },
  {
    key: 'indoor-play',
    title: 'Indoor Play',
    helper: 'Indoor play rooms, flooring, enrichment equipment, dividers, condition concerns.',
  },
  {
    key: 'outdoor-play',
    title: 'Outdoor Play',
    helper: 'Outdoor yards, fencing, ground surface, shade, gates, structural concerns.',
  },
  {
    key: 'staff-ops',
    title: 'Staff & Operational Areas',
    helper: 'Break room, laundry, storage, supplies, operational condition concerns.',
  },
] as const

function StructuredRowsInput({
  question,
  value,
  onChange,
  onError,
}: {
  question: ClientPortalFormQuestion
  value: string
  onChange: (value: string) => void
  onError: (message: string) => void
}) {
  const NO_PROFESSIONAL_ADVISORS = '__NO_PROFESSIONAL_ADVISORS__'
  const fieldKey = question.fieldKey as StructuredFormFieldKey
  const columns = STRUCTURED_FORM_COLUMNS[fieldKey] ?? []
  const noProfessionalAdvisors = fieldKey === 'professionalAdvisorsList' && value === NO_PROFESSIONAL_ADVISORS
  const rows = parsePipeRows(value, fieldKey)
  const visibleRows = rows.length ? rows : [columns.reduce<Record<string, string>>((row, column) => ({ ...row, [column.key]: '' }), {})]
  const [importing, setImporting] = useState(false)

  function updateCell(rowIndex: number, key: string, nextValue: string) {
    const next = [...visibleRows]
    next[rowIndex] = { ...next[rowIndex], [key]: nextValue }
    onChange(serializePipeRows(next, fieldKey))
  }

  function addRow() {
    onChange(serializePipeRows([...visibleRows, columns.reduce<Record<string, string>>((row, column) => ({ ...row, [column.key]: '' }), {})], fieldKey))
  }

  function removeRow(index: number) {
    onChange(serializePipeRows(visibleRows.filter((_, rowIndex) => rowIndex !== index), fieldKey))
  }

  async function handleExcelUpload(file: File | null) {
    if (!file || !isStructuredFormFieldKey(question.fieldKey)) return
    setImporting(true)
    onError('')
    try {
      const buffer = await file.arrayBuffer()
      onChange(parseStructuredFormExcel(buffer, question.fieldKey))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not read the uploaded spreadsheet.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="mt-2 space-y-3">
      <p className="text-[11px] text-slate-400">
        Download the Excel template, fill in your rows, then upload it here. You can still edit rows in the table below.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {fieldKey === 'professionalAdvisorsList' && (
          <button
            type="button"
            onClick={() => onChange(noProfessionalAdvisors ? '' : NO_PROFESSIONAL_ADVISORS)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {noProfessionalAdvisors ? 'Add professional advisors' : 'No professional advisors'}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (!isStructuredFormFieldKey(question.fieldKey)) return
            downloadStructuredFormTemplate(question.fieldKey)
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          Download Excel template
        </button>
        <input
          id={`upload-${question.fieldKey}`}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="hidden"
          onChange={e => {
            void handleExcelUpload(e.target.files?.[0] ?? null)
            e.target.value = ''
          }}
        />
        <label
          htmlFor={`upload-${question.fieldKey}`}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100"
        >
          <Upload className="w-3.5 h-3.5" />
          {importing ? 'Importing...' : 'Upload completed Excel'}
        </label>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <Plus className="w-3.5 h-3.5" /> Add Row
        </button>
      </div>
      {!noProfessionalAdvisors && <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[980px] text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              {columns.map(column => <th key={column.key} className="px-3 py-2 text-left font-semibold">{column.label}</th>)}
              <th className="w-12 px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map(column => (
                  <td key={column.key} className="px-2 py-2">
                    <input
                      value={row[column.key] ?? ''}
                      onChange={e => updateCell(rowIndex, column.key, e.target.value)}
                      placeholder={column.placeholder}
                      className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </td>
                ))}
                <td className="px-2 py-2 text-right">
                  <button type="button" onClick={() => removeRow(rowIndex)} className="rounded-md p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
    </div>
  )
}

function FacilityImageUploadPanel({
  clientId,
  uploaderEmail,
}: {
  clientId: string
  uploaderEmail: string
}) {
  const [open, setOpen] = useState(false)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ exterior: true })
  const [imagesBySection, setImagesBySection] = useState<Record<string, Array<{ id: string; fileName: string; uploadedAt: string }>>>({})
  const [uploadingSection, setUploadingSection] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function loadImages() {
      try {
        const entries = await Promise.all(FACILITY_IMAGE_SECTIONS.map(async section => {
          const documentId = `${FACILITY_IMAGE_DOCUMENT_ID}_${section.key}`
          const res = await fetch(`/api/client-documents?clientId=${encodeURIComponent(clientId)}&documentId=${documentId}&all=true`)
          if (!res.ok) return [section.key, []] as const
          const data = await res.json()
          return [section.key, data.documents ?? []] as const
        }))
        if (!cancelled) setImagesBySection(Object.fromEntries(entries))
      } catch {
        if (!cancelled) setImagesBySection({})
      }
    }
    void loadImages()
    return () => { cancelled = true }
  }, [clientId])

  const totalImages = Object.values(imagesBySection).reduce((sum, images) => sum + images.length, 0)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50"
      >
        <div>
          <h4 className="text-sm font-bold text-slate-800">Facility Review</h4>
          <p className="text-xs text-slate-500 mt-1">Optional photo walkthrough by area. Cantara uses these with your written answers above to assess facility quality for buyers.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge color={totalImages ? 'green' : 'slate'}>{totalImages} uploaded</Badge>
          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-slate-100 p-4 space-y-3">
          {error && <p className="text-xs text-rose-600">{error}</p>}
          {FACILITY_IMAGE_SECTIONS.map(section => (
            <FacilityImageSectionUploader
              key={section.key}
              section={section}
              clientId={clientId}
              uploaderEmail={uploaderEmail}
              open={Boolean(openSections[section.key])}
              onToggle={() => setOpenSections(current => ({ ...current, [section.key]: !current[section.key] }))}
              images={imagesBySection[section.key] ?? []}
              uploading={uploadingSection === section.key}
              onUploadingChange={uploading => setUploadingSection(uploading ? section.key : null)}
              onError={setError}
              onUploaded={uploaded => setImagesBySection(current => ({
                ...current,
                [section.key]: [...uploaded, ...(current[section.key] ?? [])].slice(0, FACILITY_IMAGE_LIMIT),
              }))}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FacilityImageSectionUploader({
  section,
  clientId,
  uploaderEmail,
  open,
  onToggle,
  images,
  uploading,
  onUploadingChange,
  onError,
  onUploaded,
}: {
  section: typeof FACILITY_IMAGE_SECTIONS[number]
  clientId: string
  uploaderEmail: string
  open: boolean
  onToggle: () => void
  images: Array<{ id: string; fileName: string; uploadedAt: string }>
  uploading: boolean
  onUploadingChange: (uploading: boolean) => void
  onError: (error: string) => void
  onUploaded: (uploaded: Array<{ id: string; fileName: string; uploadedAt: string }>) => void
}) {
  const remainingSlots = Math.max(0, FACILITY_IMAGE_LIMIT - images.length)
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: FACILITY_IMAGE_TYPES,
    multiple: true,
    maxFiles: remainingSlots || 1,
    maxSize: 5 * 1024 * 1024,
    disabled: uploading || remainingSlots === 0,
    onDrop: async accepted => {
      const files = accepted.slice(0, remainingSlots)
      if (!files.length) return
      onUploadingChange(true)
      onError('')
      try {
        const uploaded: Array<{ id: string; fileName: string; uploadedAt: string }> = []
        for (const file of files) {
          const form = new FormData()
          form.append('file', file)
          form.append('clientId', clientId)
          form.append('documentId', `${FACILITY_IMAGE_DOCUMENT_ID}_${section.key}`)
          form.append('uploaderEmail', uploaderEmail)
          const res = await fetch('/api/client-documents/upload', { method: 'POST', body: form })
          if (!res.ok) throw new Error(await res.text())
          const data = await res.json()
          uploaded.push({
            id: data.id || `${file.name}-${Date.now()}`,
            fileName: file.name,
            uploadedAt: new Date().toISOString(),
          })
        }
        onUploaded(uploaded)
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Could not upload facility images.')
      } finally {
        onUploadingChange(false)
      }
    },
  })

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50">
        <div>
          <p className="text-sm font-semibold text-slate-700">{section.title}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{section.helper}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge color={images.length ? 'green' : 'slate'}>{images.length}/{FACILITY_IMAGE_LIMIT}</Badge>
          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-slate-100 p-4 space-y-3">
          <div
            {...getRootProps()}
            className={`rounded-xl border border-dashed p-5 text-center transition-colors ${
              remainingSlots === 0
                ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                : isDragActive
                  ? 'cursor-pointer border-amber-300 bg-amber-50 text-amber-700'
                  : 'cursor-pointer border-slate-200 text-slate-500 hover:border-amber-300 hover:bg-amber-50/40'
            }`}
          >
            <input {...getInputProps()} />
            {uploading ? <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> : <Upload className="mx-auto mb-2 h-5 w-5" />}
            <p className="text-xs font-medium">
              {remainingSlots === 0 ? 'Image limit reached' : uploading ? 'Uploading...' : `Drop ${section.title.toLowerCase()} images here, or click to browse`}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Up to 5 images for this section. JPG, PNG, or WebP. 5 MB max per image.</p>
          </div>
          {images.length > 0 && (
            <div className="space-y-2">
              {images.map(image => (
                <div key={`${image.id}-${image.fileName}`} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">{image.fileName}</span>
                  <span className="text-[10px] text-slate-400">{new Date(image.uploadedAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AgentInformationTab({
  clientId,
  uploaderEmail,
  client,
  isTeamMemberSession,
  sessionTeamMember,
  setClient,
}: {
  clientId: string
  uploaderEmail: string
  client: Client
  isTeamMemberSession: boolean
  sessionTeamMember: Client['teamMembers'][number] | null
  setClient: Dispatch<SetStateAction<Client | null>>
}) {
  const [formQuestions, setFormQuestions] = useState<ClientPortalFormQuestion[]>([])
  const [formResponses, setFormResponses] = useState<Record<string, string>>({})
  const [savingFormResponses, setSavingFormResponses] = useState(false)
  const [formSaved, setFormSaved] = useState(false)
  const [formError, setFormError] = useState('')
  const [formHydrated, setFormHydrated] = useState(false)
  const autoSaveSkipRef = useRef(true)

  useEffect(() => {
    let cancelled = false
    autoSaveSkipRef.current = true
    setFormHydrated(false)
    async function loadFormQuestions() {
      try {
        const res = await fetch(`/api/client-form-questions?clientId=${encodeURIComponent(clientId)}`)
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setFormQuestions(data.questions ?? [])
        setFormResponses(data.responses ?? {})
        setFormHydrated(true)
        setTimeout(() => { autoSaveSkipRef.current = false }, 0)
      } catch {
        if (!cancelled) setFormQuestions([])
      }
    }
    void loadFormQuestions()
    return () => { cancelled = true }
  }, [clientId])

  function updateFormResponse(fieldKey: string, value: string) {
    setFormResponses(prev => ({ ...prev, [fieldKey]: value }))
    setFormError('')
  }

  function replaceFormResponses(nextResponses: Record<string, string>) {
    setFormResponses(nextResponses)
    setFormError('')
  }

  async function saveFormResponses(options?: { silent?: boolean }) {
    if (!formQuestions.length) return true
    const missing = formQuestions.filter(q => q.required && !String(formResponses[q.fieldKey] ?? '').trim())
    if (missing.length && !options?.silent) {
      setFormError(`Please complete required fields: ${missing.slice(0, 3).map(q => q.label).join(', ')}${missing.length > 3 ? '...' : ''}`)
      return false
    }
    setSavingFormResponses(true)
    setFormSaved(false)
    setFormError('')
    try {
      const res = await fetch('/api/client-form-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, responses: formResponses }),
      })
      if (!res.ok) throw new Error(await res.text())
      setFormSaved(true)
      setTimeout(() => setFormSaved(false), 2000)
      return true
    } catch (err) {
      if (!options?.silent) {
        setFormError(err instanceof Error ? err.message : 'Could not save information.')
      }
      return false
    } finally {
      setSavingFormResponses(false)
    }
  }

  useEffect(() => {
    if (!formHydrated || autoSaveSkipRef.current || !formQuestions.length) return
    const timeout = setTimeout(() => {
      void saveFormResponses({ silent: true })
    }, 1200)
    return () => clearTimeout(timeout)
  }, [formResponses, formHydrated, formQuestions.length, clientId])

  const hasAgentForm = (agentId: string) => formQuestions.some(q => q.agentId === agentId)
  const { activeFormKeys, formLabels: FORM_LABELS } = buildRequiredInfoFormTabs(formQuestions)

  const memberAssignedTo = sessionTeamMember ? [sessionTeamMember.name, sessionTeamMember.email] : []
  const isFormAssignedToCurrentTeamMember = (formKey: string) => {
    if (!isTeamMemberSession) return true
    const formAssignments = (client.sectionSubmissions as any)?.formAssignments ?? {}
    const assignedTo = formAssignments[formKey]
    return Boolean(assignedTo && memberAssignedTo.some(value => value.toLowerCase() === assignedTo.toLowerCase()))
  }
  const visibleFormKeys = activeFormKeys.filter(isFormAssignedToCurrentTeamMember)

  const [activeFormTab, setActiveFormTab] = useState<string>('')

  const currentIndex = visibleFormKeys.indexOf(activeFormTab)
  const hasNext = currentIndex !== -1 && currentIndex < visibleFormKeys.length - 1
  const handleNext = async () => {
    const success = await saveFormResponses()
    if (success && hasNext) {
      setActiveFormTab(visibleFormKeys[currentIndex + 1])
    }
  }

  useEffect(() => {
    if (visibleFormKeys.length && (!activeFormTab || !visibleFormKeys.includes(activeFormTab))) {
      setActiveFormTab(visibleFormKeys[0])
    }
  }, [visibleFormKeys, clientId, activeFormTab])

  if (!formHydrated) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-slate-200 border-t-amber-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!formQuestions.length) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 text-sm text-slate-500">
        No extra form information is required for the selected workstream right now.
      </div>
    )
  }

  if (visibleFormKeys.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 text-sm text-slate-500">
        No form information is assigned to you right now.
      </div>
    )
  }

  const otherFormQuestions = formQuestions.filter(q => !isDedicatedRequiredInfoAgent(q.agentId))

  return (
    <div id="tour-information-container" className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-1 flex flex-wrap gap-1">
        {visibleFormKeys.map(key => (
          <button
            key={key}
            onClick={() => setActiveFormTab(key)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeFormTab === key
                ? 'text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
            style={activeFormTab === key ? { background: '#0d1829' } : {}}
          >
            {FORM_LABELS[key]}
          </button>
        ))}
      </div>

      {activeFormTab !== '' && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold text-slate-700">{FORM_LABELS[activeFormTab]}</h4>
              {activeFormTab !== 'vendor_directory' && activeFormTab !== 'professional_advisors' && (
                <p className="text-xs text-slate-500 mt-1">
                  {activeFormTab === 'facility_review'
                    ? 'Complete each area below. Optional facility photos can be added in the separate section at the bottom of this page.'
                    : 'Complete the fields below. Answers save automatically.'}
                </p>
              )}
            </div>
            {!isTeamMemberSession && (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-slate-400 font-medium">Assign to:</span>
                <select
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-amber-400 transition-all font-medium text-slate-600"
                  value={(client.sectionSubmissions as any)?.formAssignments?.[activeFormTab] ?? ''}
                  onChange={async (e) => {
                    const val = e.target.value || null
                    const nextAssignments = { ...((client.sectionSubmissions as any)?.formAssignments ?? {}), [activeFormTab]: val }
                    const nextClient = {
                      ...client,
                      sectionSubmissions: {
                        ...(client.sectionSubmissions ?? {}),
                        formAssignments: nextAssignments,
                      }
                    }
                    setClient(nextClient)
                    await saveClient(nextClient)
                  }}
                >
                  <option value="">— Assign to —</option>
                  <option value="me">Me</option>
                  {client.teamMembers.map(m => (
                    <option key={m.name} value={m.name}>{m.name} · {m.role}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="p-5 space-y-5">
            {buildOrderedFormQuestionGroups(
              formQuestions.filter(q => {
                if (activeFormTab === 'other_info') {
                  return !isDedicatedRequiredInfoAgent(q.agentId)
                }
                return activeFormTab === 'competitor_analysis'
                  ? (q.agentId === 'competitor_analysis' || q.agentId === 'pricing_analysis')
                  : q.agentId === activeFormTab
              })
            ).map((group, index) => (
              <div
                key={group.groupLabel}
                className="space-y-3 pt-2 border-t border-slate-100 first:border-t-0 first:pt-0"
              >
                {activeFormTab !== 'competitor_analysis' && (
                  <h5 className="text-sm font-bold text-slate-800">
                    {activeFormTab === 'facility_review' ? facilityReviewSubgroupLabel(group.groupLabel) : group.groupLabel}
                  </h5>
                )}
                {activeFormTab === 'competitor_analysis' ? (
                  <ClientCompetitorInputsFields
                    mode="competitor_analysis"
                    questions={group.questions}
                    formResponses={formResponses}
                    onUpdate={updateFormResponse}
                    onCompetitorsChange={replaceFormResponses}
                    FormQuestionFields={FormQuestionFields}
                    onError={setFormError}
                    showTopCompetitors={index === 0}
                  />
                ) : (
                  <FormQuestionFields
                    questions={group.questions}
                    formResponses={formResponses}
                    onUpdate={updateFormResponse}
                    onError={setFormError}
                  />
                )}
              </div>
            ))}
            {formError && <p className="text-xs text-red-600">{formError}</p>}
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-3">
                <Button size="sm" onClick={() => void saveFormResponses()} disabled={savingFormResponses}>
                  {savingFormResponses ? 'Saving...' : 'Save Information'}
                </Button>
                {formSaved && <span className="text-xs text-emerald-600 font-medium">Saved</span>}
              </div>
              {hasNext && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-1.5 border-slate-200 hover:bg-slate-50 transition-all font-semibold text-xs text-slate-700"
                  onClick={() => void handleNext()}
                  disabled={savingFormResponses}
                >
                  Next Section
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
      {activeFormTab === 'facility_review' && (
        <FacilityImageUploadPanel clientId={clientId} uploaderEmail={uploaderEmail} />
      )}
    </div>
  )
}

function documentUploadFileCount(docId: string, filesByDocId: FilesByDocumentId): number {
  if (MULTI_YEAR_UPLOAD_SLOTS[docId]) {
    const combinedId = getMultiYearCombinedId(docId)
    const yearIds = (MULTI_YEAR_UPLOAD_SLOTS[docId] ?? []).map((_, index) => `${docId}__year_${index + 1}`)
    return fileCountForDocumentIds([combinedId, docId, ...yearIds], filesByDocId)
  }
  return (filesByDocId[docId] ?? []).length
}

function CollectionTab({ valuationDocs, categories, getStatus, setStatus, clientId, clientName, uploaderEmail, sectionSubmissions, onSubmitSection, submittingSectionId, getDeadline, sectionDeadlines, tourStep }: {
  valuationDocs: ReturnType<typeof getValuationDocsForWorkstream>
  categories: ReturnType<typeof getDocsForWorkstream>
  getStatus: (id: string) => DocumentStatus
  setStatus: (id: string, u: Partial<DocumentStatus>) => void
  clientId: string
  clientName: string
  uploaderEmail: string
  sectionSubmissions: Record<string, any>
  onSubmitSection: (sectionId: string) => Promise<void>
  submittingSectionId: string | null
  getDeadline: (docId: string, sectionId: string) => string | null
  sectionDeadlines: Record<string, string>
  tourStep?: number | null
}) {
  const [formQuestions, setFormQuestions] = useState<ClientPortalFormQuestion[]>([])
  const [formResponses, setFormResponses] = useState<Record<string, string>>({})
  const [savingFormResponses, setSavingFormResponses] = useState(false)
  const [formSaved, setFormSaved] = useState(false)
  const [formError, setFormError] = useState('')
  const [filesByDocId, setFilesByDocId] = useState<FilesByDocumentId>({})
  const [filesCatalogLoading, setFilesCatalogLoading] = useState(true)

  const refreshFileCatalog = useCallback(async () => {
    const batch = await fetchClientDocumentsBatch(clientId)
    setFilesByDocId(batch)
  }, [clientId])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setFilesCatalogLoading(true)
      try {
        const batch = await fetchClientDocumentsBatch(clientId)
        if (!cancelled) setFilesByDocId(batch)
      } catch {
        if (!cancelled) setFilesByDocId({})
      } finally {
        if (!cancelled) setFilesCatalogLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [clientId])

  useEffect(() => {
    let cancelled = false
    async function loadFormQuestions() {
      try {
        const res = await fetch(`/api/client-form-questions?clientId=${encodeURIComponent(clientId)}`)
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setFormQuestions(data.questions ?? [])
        setFormResponses(data.responses ?? {})
      } catch {
        if (!cancelled) setFormQuestions([])
      }
    }
    void loadFormQuestions()
    return () => { cancelled = true }
  }, [clientId])

  function updateFormResponse(fieldKey: string, value: string) {
    setFormResponses(prev => ({ ...prev, [fieldKey]: value }))
    setFormError('')
  }

  async function saveFormResponses() {
    const missing = formQuestions.filter(q => q.required && !String(formResponses[q.fieldKey] ?? '').trim())
    if (missing.length) {
      setFormError(`Please complete required fields: ${missing.slice(0, 3).map(q => q.label).join(', ')}${missing.length > 3 ? '...' : ''}`)
      return
    }
    setSavingFormResponses(true)
    setFormSaved(false)
    setFormError('')
    try {
      const res = await fetch('/api/client-form-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, responses: formResponses }),
      })
      if (!res.ok) throw new Error(await res.text())
      setFormSaved(true)
      setTimeout(() => setFormSaved(false), 2000)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save information.')
    } finally {
      setSavingFormResponses(false)
    }
  }

  const groupedQuestions = formQuestions.reduce<Record<string, ClientPortalFormQuestion[]>>((acc, question) => {
    const key = question.groupLabel || 'Business Information'
    acc[key] = [...(acc[key] ?? []), question]
    return acc
  }, {})

  const uploadUnitsForDoc = (docId: string) => {
    if (!MULTI_YEAR_UPLOAD_SLOTS[docId]) {
      return { uploaded: getStatus(docId).fileName ? 1 : 0, total: 1 }
    }
    const progress = getMultiYearUploadProgress(docId, getStatus)
    return { uploaded: progress.completed, total: progress.total }
  }

  const renderSectionFooter = (sectionId: string, totalCount: number, uploadedCount: number) => {
    const isSubmitted = Boolean(sectionSubmissions[sectionId])
    const canSubmit = uploadedCount > 0

    if (isSubmitted) {
      return (
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
            Thank you — this section is with your Cantara team for review. You can still add more files anytime.
          </div>
        </div>
      )
    }

    return (
      <div className="px-5 py-4 border-t border-slate-100">
        <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
          Upload documents as you have them — each file saves automatically.
          {totalCount > 0 ? ` ${uploadedCount} of ${totalCount} file slot${totalCount === 1 ? '' : 's'} filled.` : ''}
        </p>
      </div>
    )
  }

  return (
    <div id="tour-collection-container" className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 text-xs text-slate-500 leading-relaxed">
        <p>
          Upload documents for each item your team confirmed in the Assign step. You can add files over time — each upload saves immediately. Target deadlines are set by your Cantara team.
        </p>
      </div>
      {filesCatalogLoading && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-600" />
          Loading your uploaded files…
        </div>
      )}
      {/* QuickBooks integration is temporarily hidden from the client Collection UI until it is tested.
          Do not delete; re-enable this card when QuickBooks is ready for client use. */}
      {/* <QuickBooksConnectCard clientId={clientId} /> */}
      {false && formQuestions.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h4 className="text-sm font-semibold text-slate-700">Required Information</h4>
            <p className="text-xs text-slate-500 mt-1">
              Complete these fields once. Cantara uses the saved answers to prefill related advisor tools.
            </p>
          </div>
          <div className="p-5 space-y-5">
            {Object.entries(groupedQuestions).map(([groupLabel, questions]) => (
              <div key={groupLabel} className="space-y-3">
                <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{groupLabel}</h5>
                <div className="grid gap-3 md:grid-cols-2">
                  {questions.map(question => {
                    const commonClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400'
                    return (
                      <label key={question.id} className={question.inputType === 'textarea' ? 'md:col-span-2' : ''}>
                        <span className="text-xs font-semibold text-slate-500">
                          {question.label}
                          {question.required && <span className="text-amber-600"> *</span>}
                        </span>
                        {question.description && <span className="block text-[11px] text-slate-400 mt-0.5">{question.description}</span>}
                        {question.inputType === 'textarea' ? (
                          <textarea
                            value={formResponses[question.fieldKey] ?? ''}
                            onChange={e => updateFormResponse(question.fieldKey, e.target.value)}
                            placeholder={question.placeholder ?? ''}
                            className={`${commonClass} mt-1 min-h-[84px] resize-y`}
                          />
                        ) : question.inputType === 'select' ? (
                          <select
                            value={formResponses[question.fieldKey] ?? ''}
                            onChange={e => updateFormResponse(question.fieldKey, e.target.value)}
                            className={`${commonClass} mt-1 bg-white`}
                          >
                            <option value="">Select...</option>
                            {(question.options ?? []).map(option => <option key={option} value={option}>{option}</option>)}
                          </select>
                        ) : (
                          <input
                            type={question.inputType === 'number' ? 'number' : question.inputType === 'url' ? 'url' : 'text'}
                            value={formResponses[question.fieldKey] ?? ''}
                            onChange={e => updateFormResponse(question.fieldKey, e.target.value)}
                            placeholder={question.placeholder ?? ''}
                            className={`${commonClass} mt-1`}
                          />
                        )}
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
            {formError && <p className="text-xs text-red-600">{formError}</p>}
            <div className="flex items-center gap-3">
              <Button size="sm" onClick={() => void saveFormResponses()} disabled={savingFormResponses}>
                {savingFormResponses ? 'Saving...' : 'Save Information'}
              </Button>
              {formSaved && <span className="text-xs text-emerald-600">Saved</span>}
            </div>
          </div>
        </div>
      )}
      {valuationDocs.length > 0 && (
        <div className={`rounded-2xl border overflow-hidden ${sectionSubmissions.valuation ? 'border-slate-200 bg-slate-50 opacity-70' : 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200'}`}>
          <div className="px-5 py-3 border-b border-amber-200/80 flex items-center justify-between gap-3 flex-wrap">
            <h4 className="text-sm font-semibold text-amber-900">Valuation Documents</h4>
            <div className="flex items-center gap-2 flex-wrap">
              {sectionDeadlines[VALUATION_SECTION_ID] && (
                <TargetDeadlineBadge deadline={sectionDeadlines[VALUATION_SECTION_ID]} uploaded={false} />
              )}
              <span className="text-xs text-amber-700">
                {valuationDocs.reduce((sum, doc) => sum + uploadUnitsForDoc(doc.id).uploaded, 0)}/
                {valuationDocs.reduce((sum, doc) => sum + uploadUnitsForDoc(doc.id).total, 0)} uploaded
              </span>
            </div>
          </div>
          <div className="overflow-hidden rounded-b-2xl border-t border-amber-100/80">
            {valuationDocs.map(doc => {
              const s = getStatus(doc.id)
              if (s.hasDoc === false || s.notApplicable) return null
              const valuationUnits = uploadUnitsForDoc(doc.id)
              const valuationComplete =
                MULTI_YEAR_UPLOAD_SLOTS[doc.id]
                  ? valuationUnits.uploaded === valuationUnits.total && valuationUnits.total > 0
                  : Boolean(s.fileName)
              const fileCount = documentUploadFileCount(doc.id, filesByDocId)
              return (
                <DocumentUploadAccordion
                  key={doc.id}
                  title={doc.name}
                  description={doc.description}
                  assignedTo={s.assignedTo}
                  fileCount={fileCount}
                  isComplete={valuationComplete}
                  tone="valuation"
                >
                  <DocumentReferenceLink docId={doc.id} />
                  {MULTI_YEAR_UPLOAD_SLOTS[doc.id] ? (
                    <MultiYearDocumentUpload
                      docId={doc.id}
                      clientId={clientId}
                      uploaderEmail={uploaderEmail}
                      getStatus={getStatus}
                      setStatus={setStatus}
                      filesByDocId={filesByDocId}
                      refreshFileCatalog={refreshFileCatalog}
                    />
                  ) : (
                    <DocumentUploadPanel
                      clientId={clientId}
                      uploadDocumentId={doc.id}
                      uploaderEmail={uploaderEmail}
                      files={filesByDocId[doc.id] ?? []}
                      onFilesChange={next => setFilesByDocId(prev => ({ ...prev, [doc.id]: next }))}
                      onStatusChange={summary => applyDocumentUploadSummary(setStatus, doc.id, summary)}
                      onAfterMutation={refreshFileCatalog}
                    />
                  )}
                </DocumentUploadAccordion>
              )
            })}
          </div>
          {renderSectionFooter(
            'valuation',
            valuationDocs.reduce((sum, doc) => sum + uploadUnitsForDoc(doc.id).total, 0),
            valuationDocs.reduce((sum, doc) => sum + uploadUnitsForDoc(doc.id).uploaded, 0),
          )}
        </div>
      )}
      {categories.map(cat => {
        const docsToShow = cat.documents.filter(d => {
          const s = getStatus(d.id)
          if (s.hasDoc === false || s.notApplicable) return false
          if (d.id === 'irs_tax_notices_3yr') return true
          return d.type === 'required' || s.hasDoc === true || Boolean(s.fileName)
        })
        if (docsToShow.length === 0) return null
        const isSubmitted = Boolean(sectionSubmissions[cat.id])
        const sectionTotals = docsToShow.reduce(
          (acc, doc) => {
            const units = uploadUnitsForDoc(doc.id)
            return { uploaded: acc.uploaded + units.uploaded, total: acc.total + units.total }
          },
          { uploaded: 0, total: 0 },
        )
        return (
          <div key={cat.id} className={`rounded-2xl border overflow-hidden ${isSubmitted ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-white border-slate-200'}`}>
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
              <h4 className="text-sm font-semibold text-slate-700">{cat.title}</h4>
              <div className="flex items-center gap-2 flex-wrap">
                {cat.id === 'financial' && (
                  <ExportReportButton
                    html={buildTaxReadinessReferenceHtml(clientName, 'client')}
                    fileName={`${clientName} - Tax Readiness Document Reference.pdf`}
                    label="Tax Reference PDF"
                    advisorAction={false}
                  />
                )}
                {sectionDeadlines[cat.id] && (
                  <TargetDeadlineBadge deadline={sectionDeadlines[cat.id]} uploaded={sectionTotals.uploaded === sectionTotals.total && sectionTotals.total > 0} />
                )}
                <span className="text-xs text-slate-400">
                  {sectionTotals.uploaded}/{sectionTotals.total} uploaded
                </span>
              </div>
            </div>
            <div className="overflow-hidden">
              {docsToShow.map(doc => {
                const s = getStatus(doc.id)
                const multiYear = Boolean(MULTI_YEAR_UPLOAD_SLOTS[doc.id])
                const uploadUnits = uploadUnitsForDoc(doc.id)
                const slotUploaded = multiYear
                  ? uploadUnits.uploaded === uploadUnits.total && uploadUnits.total > 0
                  : Boolean(s.fileName)
                const fileCount = documentUploadFileCount(doc.id, filesByDocId)
                return (
                  <DocumentUploadAccordion
                    key={doc.id}
                    title={doc.name}
                    description={doc.description}
                    assignedTo={s.assignedTo}
                    fileCount={fileCount}
                    isComplete={slotUploaded}
                  >
                    <DocumentReferenceLink docId={doc.id} />
                    {doc.id === 'revenue_breakdown' && <RevenueBreakdownReview clientId={clientId} />}
                    {doc.flagged && doc.flagNote && (
                      <p className="mb-2 text-xs text-amber-600">{doc.flagNote}</p>
                    )}
                    {multiYear ? (
                      <MultiYearDocumentUpload
                        docId={doc.id}
                        clientId={clientId}
                        uploaderEmail={uploaderEmail}
                        getStatus={getStatus}
                        setStatus={setStatus}
                        filesByDocId={filesByDocId}
                        refreshFileCatalog={refreshFileCatalog}
                      />
                    ) : (
                      <DocumentUploadPanel
                        clientId={clientId}
                        uploadDocumentId={doc.id}
                        uploaderEmail={uploaderEmail}
                        files={filesByDocId[doc.id] ?? []}
                        onFilesChange={next => setFilesByDocId(prev => ({ ...prev, [doc.id]: next }))}
                        onStatusChange={summary => applyDocumentUploadSummary(setStatus, doc.id, summary)}
                        onAfterMutation={refreshFileCatalog}
                      />
                    )}
                  </DocumentUploadAccordion>
                )
              })}
            </div>
            {renderSectionFooter(cat.id, sectionTotals.total, sectionTotals.uploaded)}
          </div>
        )
      })}
    </div>
  )
}

function QuickBooksConnectCard({ clientId }: { clientId: string }) {
  const [status, setStatus] = useState<{ connected: boolean; connection: { status: string; updatedAt: string | null; statusReason: string | null } | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function loadStatus() {
      setLoading(true)
      try {
        const res = await fetch(`/api/composio/quickbooks/status?clientId=${encodeURIComponent(clientId)}`)
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
        if (!cancelled) setStatus(data)
      } catch {
        if (!cancelled) setError('QuickBooks connection status unavailable.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadStatus()
    return () => {
      cancelled = true
    }
  }, [clientId])

  async function connectQuickBooks() {
    setConnecting(true)
    setError('')
    try {
      const res = await fetch('/api/composio/quickbooks/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      if (data.redirect_url) {
        window.location.href = data.redirect_url
        return
      }
      throw new Error('Missing QuickBooks redirect URL')
    } catch {
      setError('Could not start QuickBooks connection.')
      setConnecting(false)
    }
  }

  const connected = Boolean(status?.connected)
  const statusLabel = loading
    ? 'Checking...'
    : connected
      ? 'Connected'
      : status?.connection?.status
        ? `Status: ${status.connection.status}`
        : 'Optional'

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-800">QuickBooks connection</p>
            <Badge color={connected ? 'green' : 'slate'}>{statusLabel}</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Optional. Connect QuickBooks so Cantara can review financial reports directly instead of requesting extra exports.
          </p>
          {status?.connection?.updatedAt && (
            <p className="text-xs text-slate-400 mt-1">
              Last updated {new Date(status.connection.updatedAt).toLocaleDateString()}
            </p>
          )}
          {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}
        </div>
        <Button
          size="sm"
          variant={connected ? 'outline' : 'primary'}
          onClick={() => void connectQuickBooks()}
          disabled={loading || connecting}
        >
          {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
          {connected ? 'Reconnect' : 'Connect QuickBooks'}
        </Button>
      </div>
    </div>
  )
}

// ── Additional Requirements (client view) ─────────────────────────────────────
function RequirementsClientTab({
  requirements,
  teamMembers,
  isTeamMemberSession,
  onRequirementUpdated,
}: {
  requirements: AdditionalRequirement[]
  teamMembers: Client['teamMembers']
  isTeamMemberSession: boolean
  onRequirementUpdated: (requirement: AdditionalRequirement) => void
}) {
  const [drafts, setDrafts] = useState<Record<string, { response: string; fileName: string | null; fileUrl: string | null; uploading: boolean; saving: boolean }>>({})
  const [assigningRequirementId, setAssigningRequirementId] = useState<string | null>(null)

  const getDraft = (id: string) => drafts[id] ?? { response: '', fileName: null, fileUrl: null, uploading: false, saving: false }

  const uploadRequirementFile = async (requirementId: string, file?: File | null) => {
    if (!file) return
    setDrafts(prev => ({ ...prev, [requirementId]: { ...getDraft(requirementId), uploading: true } }))
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('requirementId', requirementId)
      const res = await fetch('/api/requirements/upload-response', {
        method: 'POST',
        body: form,
      })
      if (!res.ok) return
      const data = await res.json()
      setDrafts(prev => ({
        ...prev,
        [requirementId]: {
          ...getDraft(requirementId),
          fileName: data.fileName,
          fileUrl: data.fileUrl,
          uploading: false,
        },
      }))
    } catch {
      setDrafts(prev => ({ ...prev, [requirementId]: { ...getDraft(requirementId), uploading: false } }))
    }
  }

  const submitRequirementResponse = async (req: AdditionalRequirement) => {
    const draft = getDraft(req.id)
    setDrafts(prev => ({ ...prev, [req.id]: { ...draft, saving: true } }))
    try {
      await updateRequirement(req.id, {
        clientResponse: draft.response || req.clientResponse || null,
        responseFileName: draft.fileName || req.responseFileName || null,
        responseFileUrl: draft.fileUrl || req.responseFileUrl || null,
        respondedAt: new Date().toISOString(),
      })
      window.location.reload()
    } finally {
      setDrafts(prev => ({ ...prev, [req.id]: { ...getDraft(req.id), saving: false } }))
    }
  }

  const assignRequirement = async (req: AdditionalRequirement, assignedTo: string) => {
    setAssigningRequirementId(req.id)
    try {
      const updated = await updateRequirement(req.id, { assignedTo: assignedTo || null })
      if (updated) onRequirementUpdated(updated)
    } finally {
      setAssigningRequirementId(null)
    }
  }

  const open = requirements.filter(isRequirementStillOpen)
  const resolved = requirements.filter(r => !isRequirementStillOpen(r))
  return (
    <div id="tour-requirements-container" className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-xs text-slate-500 leading-relaxed">
        Items your Cantara advisor flagged for follow-up — questions, clarifications, or extra uploads. Complete each item and submit your response; resolved items stay visible for reference.
      </div>
      {open.length === 0 && resolved.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-400">
          <CheckCircle className="w-8 h-8 text-slate-200 mx-auto mb-3" />
          No additional requirements at this time. Check back later.
        </div>
      )}
      {open.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Action Required ({open.length})</p>
          {open.map(req => (
            <div key={req.id} className="bg-white rounded-xl border-l-4 p-4" style={{
              borderLeftColor: req.priority === 'high' ? '#f43f5e' : req.priority === 'medium' ? '#f59e0b' : '#22c55e'
            }}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{req.title}</p>
                </div>
                <Badge color={req.priority === 'high' ? 'red' : req.priority === 'medium' ? 'gold' : 'green'}>
                  {req.priority}
                </Badge>
              </div>
              {!isTeamMemberSession && (
                <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">Who should handle this?</p>
                      <p className="mt-1 text-xs text-amber-700">
                        Default is <span className="font-semibold">Me</span>. Assign to a team member only if they should answer or upload.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {assigningRequirementId === req.id && <Loader2 className="h-4 w-4 animate-spin text-amber-700" />}
                      <select
                        aria-label="Assign additional requirement"
                        value={req.assignedTo ?? ''}
                        onChange={e => void assignRequirement(req, e.target.value)}
                        disabled={assigningRequirementId === req.id}
                        className="w-full min-w-[220px] rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 sm:w-auto"
                      >
                        <option value="">Me</option>
                        {teamMembers.map(member => (
                          <option key={member.id} value={member.name}>
                            {member.name}{member.role ? ` · ${member.role}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
              {isTeamMemberSession && req.assignedTo && (
                <p className="mb-3 inline-flex rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-500">
                  Assigned to {req.assignedTo}
                </p>
              )}
              {req.description && <p className="text-sm text-slate-600 leading-relaxed">{req.description}</p>}
              {req.sourceDocumentName && (
                <p className="text-xs text-slate-400 mt-2">Related document: {req.sourceDocumentName}</p>
              )}
              {req.sourceUploadedFileName && (
                <p className="text-xs text-slate-400 mt-1">Uploaded file: {req.sourceUploadedFileName}</p>
              )}
              {req.question && (
                <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-slate-700">
                  <span className="font-semibold text-blue-700">Question:</span> {req.question}
                </div>
              )}
              {(req.question || req.requestUpload) && (
                <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  {req.question && (
                    <Textarea
                      rows={4}
                      placeholder="Type your response..."
                      value={getDraft(req.id).response || req.clientResponse || ''}
                      onChange={e => setDrafts(prev => ({
                        ...prev,
                        [req.id]: { ...getDraft(req.id), response: e.target.value },
                      }))}
                    />
                  )}
                  {req.requestUpload && (
                    <div className="flex items-center gap-3">
                      <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 cursor-pointer hover:border-amber-300">
                        <Upload className="w-3.5 h-3.5" />
                        {getDraft(req.id).uploading ? 'Uploading...' : 'Upload supporting file'}
                        <input
                          type="file"
                          className="hidden"
                          onChange={e => void uploadRequirementFile(req.id, e.target.files?.[0] || null)}
                        />
                      </label>
                      {(getDraft(req.id).fileName || req.responseFileName) && (
                        <span className="text-xs text-emerald-700">
                          {getDraft(req.id).fileName || req.responseFileName}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => void submitRequirementResponse(req)}
                      disabled={getDraft(req.id).saving || (!req.requestUpload && !req.question)}
                    >
                      {getDraft(req.id).saving ? 'Submitting...' : 'Submit Response'}
                    </Button>
                  </div>
                </div>
              )}
              {req.clientResponse && (
                <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-slate-700">
                  <span className="font-semibold text-emerald-700">Submitted response:</span> {req.clientResponse}
                </div>
              )}
              {req.responseFileName && (
                <div className="mt-2 text-xs text-emerald-700">
                  {req.responseFileUrl ? (
                    <a href={req.responseFileUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                      {req.responseFileName}
                    </a>
                  ) : req.responseFileName}
                </div>
              )}
              <p className="text-xs text-slate-400 mt-3">Added {new Date(req.createdAt).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
      {resolved.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Resolved ({resolved.length})</p>
          {resolved.map(req => (
            <div key={req.id} className="bg-slate-50 rounded-xl border border-slate-100 p-4 opacity-60 flex items-center gap-3">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <p className="text-sm text-slate-600 line-through">{req.title}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Roadmap Tab ───────────────────────────────────────────────────────────────
type ApprovedOutput = {
  agentKey: string
  agentName: string
  approvedAt: string | null
  markdown: string
  data?: { type?: string } | unknown
}

function isAdvisorToRunPlaceholder(output: ApprovedOutput) {
  return !!output.data && typeof output.data === 'object' && (output.data as { type?: string }).type === 'advisorToRunPlaceholder'
}

function RoadmapTab({ clientId, client }: { clientId: string; client: ClientApprovedClient }) {
  const [outputs, setOutputs] = useState<ApprovedOutput[]>([])
  const [activeOutputKey, setActiveOutputKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showSidebar, setShowSidebar] = useState(true)

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    'WS1 — Risk & Legal': true,
    'WS2 — Performance': true,
    'M&A Sale Process': true,
    'Reports & Roadmaps': true,
  })

  const toggleGroup = (groupLabel: string) => {
    setOpenGroups(prev => ({ ...prev, [groupLabel]: !prev[groupLabel] }))
  }

  useEffect(() => {
    let cancelled = false
    async function loadOutputs() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/client-approved-outputs?clientId=${encodeURIComponent(clientId)}`, { cache: 'no-store' })
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
        if (!cancelled) {
          const nextOutputs = (data.outputs ?? []) as ApprovedOutput[]
          setOutputs(nextOutputs)
          setActiveOutputKey(current => (
            current && nextOutputs.some(output => output.agentKey === current)
              ? current
              : nextOutputs[0]?.agentKey ?? null
          ))
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load approved outputs.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadOutputs()
    return () => { cancelled = true }
  }, [clientId])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-slate-300 mx-auto mb-3" />
        Loading released reports...
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-rose-50 rounded-2xl border border-rose-200 p-6 text-sm text-rose-700">
        Released reports load failed: {error}
      </div>
    )
  }

  if (outputs.length === 0) {
    return (
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-400">
        <MapIcon className="w-10 h-10 text-slate-300 mx-auto mb-4" />
        <p className="font-medium text-slate-600 mb-2">Released Reports</p>
        <p className="text-xs leading-relaxed max-w-sm mx-auto">
          Reports released by your Cantara advisor will appear here.
        </p>
      </div>
    )
  }

  const activeOutput = outputs.find(output => output.agentKey === activeOutputKey) ?? outputs[0]



  // Valuation Agent is filtered out from M&A Sale Process and placed on top
  const valuationOutputs = outputs.filter(o => o.agentKey === 'ttmAnalysis')

  const TOC_GROUPS = [
    {
      label: 'WS1 — Risk & Legal',
      keys: ['employeeObligations','employeeComp','insuranceReview','lease','litigationSearch','contract','orgChart','ownerGmAssessment','ownershipVerification','permitsZoning','professionalAdvisors','vendorDirectory','legalEntitySearch','taxLiabilityReview'],
    },
    {
      label: 'WS2 — Performance',
      keys: ['competitor','digitalPresence','facilityReview','occupancyReview','pricingAnalysis','pricingVertical','salesProcessReview','clientLocationMap'],
    },
    {
      label: 'M&A Sale Process',
      keys: ['cim','teaser','net_proceeds'],
    },
    {
      label: 'Reports & Roadmaps',
      keys: ['ws1Assessment','ws2Assessment','ws1Roadmap','ws2Roadmap'],
    },
  ]

  return (
    <div id="tour-roadmap-container" className="space-y-4">
      {outputs.length > 0 && (
        <>
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Released to You</p>
            <h2 className="text-lg font-semibold text-slate-800 mt-1">Released Reports</h2>
            <p className="text-xs text-slate-500 mt-1">Your Cantara advisor has released these reports for your review.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              {showSidebar ? 'Hide Report List' : 'Show Report List'}
            </button>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-500">
              {outputs.filter(output => !isAdvisorToRunPlaceholder(output)).length} released
            </span>
          </div>
        </div>
      </div>
        </>
      )}

      {outputs.length > 0 && <div className="flex flex-col lg:flex-row gap-4">
        {showSidebar && (
          <div className="lg:w-64 xl:w-72 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
              
              {/* Valuation Agent - Always on top if present */}
              {valuationOutputs.length > 0 && (
                <div>
                  {valuationOutputs.map(output => {
                    const isActive = output.agentKey === activeOutput.agentKey
                    return (
                      <button
                        key={output.agentKey}
                        type="button"
                        onClick={() => setActiveOutputKey(output.agentKey)}
                        className={`w-full text-left px-4 py-3 transition-all ${isActive ? 'bg-[#0d1829] text-white' : 'hover:bg-slate-50 text-slate-600'}`}
                      >
                        <span className={`block text-xs font-bold ${isActive ? 'text-white' : 'text-slate-800'}`}>{output.agentName}</span>
                        <span className={`mt-0.5 block text-[10px] ${isActive ? 'text-white/50' : 'text-slate-400'}`}>
                          {output.approvedAt ? new Date(output.approvedAt).toLocaleDateString() : 'Released'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Collapsible Accordion Groups */}
              {TOC_GROUPS.map(group => {
                const groupOutputs = outputs.filter(o => group.keys.includes(o.agentKey))
                const isOpen = !!openGroups[group.label]
                return (
                  <div key={group.label} className="border-t border-slate-100 first:border-t-0">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.label)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-left hover:bg-slate-100/70 transition-colors"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{group.label}</p>
                      <span className="text-slate-400 text-[9px] font-semibold">{isOpen ? '▼' : '▲'}</span>
                    </button>
                    {isOpen && (
                      <div className="divide-y divide-slate-50">
                        {groupOutputs.length === 0 ? (
                          <div className="px-4 py-3">
                            <p className="text-[11px] text-slate-300 italic">No reports released yet</p>
                          </div>
                        ) : (
                          groupOutputs.map(output => {
                            const isActive = output.agentKey === activeOutput.agentKey
                            return (
                              <button
                                key={output.agentKey}
                                type="button"
                                onClick={() => setActiveOutputKey(output.agentKey)}
                                className={`w-full text-left px-4 py-3 transition-all ${isActive ? 'bg-[#0d1829] text-white' : 'hover:bg-slate-50 text-slate-600'}`}
                              >
                                <span className={`block text-xs font-semibold ${isActive ? 'text-white' : 'text-slate-700'}`}>{output.agentName}</span>
                                <span className={`mt-0.5 block text-[10px] ${isActive ? 'text-white/50' : 'text-slate-400'}`}>
                                  {isAdvisorToRunPlaceholder(output)
                                    ? 'Advisor is running this search'
                                    : output.approvedAt
                                      ? new Date(output.approvedAt).toLocaleDateString()
                                      : 'Released'}
                                </span>
                              </button>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-800">{activeOutput.agentName}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isAdvisorToRunPlaceholder(activeOutput)
                  ? 'Advisor is running this search'
                  : `Released ${activeOutput.approvedAt ? new Date(activeOutput.approvedAt).toLocaleString() : 'by advisor'}`}
              </p>
            </div>
            <div className="px-5 py-4">
              <ClientApprovedAgentOutput
                agentKey={activeOutput.agentKey}
                agentName={activeOutput.agentName}
                client={client}
                prefetchedData={activeOutput.data}
                fallbackMarkdown={activeOutput.markdown}
              />
            </div>
          </div>
        </div>
      </div>}
    </div>
  )
}
