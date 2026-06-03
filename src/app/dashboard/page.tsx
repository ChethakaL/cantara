'use client'
import { useState, useEffect, useRef, useCallback, type Dispatch, type SetStateAction } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import {
  LogOut, Bell, Settings, ChevronRight, CheckCircle, Upload, X,
  MessageSquare, AlertCircle, Send, Users, Plus, Trash2,
  FileText, FileSpreadsheet, HelpCircle, ChevronDown, ChevronUp, Map, Lock, Loader2, ExternalLink, Calendar, Search
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

// ── Nav ──────────────────────────────────────────────────────────────────────
function ClientNav({ workstreamTitle, unreadCount, onSettings, showSettings }: {
  workstreamTitle: string | null; unreadCount: number; onSettings: () => void; showSettings: boolean
}) {
  const router = useRouter()
  return (
    <header className="sticky top-0 z-40" style={{ background: '#0d1829' }}>
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
          <button className="relative p-2 rounded hover:bg-white/5 transition-colors text-white/30 hover:text-white/70">
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ background: '#ef4444' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={onSettings}
            className={`p-2 rounded transition-colors ${showSettings ? 'bg-white/10 text-white/80' : 'text-white/30 hover:bg-white/5 hover:text-white/70'}`}
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
  { id: 'roadmap', label: 'Roadmap', disabled: true },
]

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
  const [showSettings, setShowSettings] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [docStatuses, setDocStatuses] = useState<Record<string, DocumentStatus>>({})
  const [assignPhaseComplete, setAssignPhaseComplete] = useState(false)
  const [notifEmail, setNotifEmail] = useState(true)
  const [notifSms, setNotifSms] = useState(false)
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
      setSessionEmail(email || '')
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
      [docId]: { id: docId, hasDoc: null, assignedTo: null, uploadedAt: null, fileName: null, notApplicable: false, ...prev[docId], ...update },
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
      documents: filterClientPortalDocuments(category.documents),
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
  const openReqs = visibleRequirements.filter(r => r.status === 'open')

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
        onSettings={() => setShowSettings(v => !v)}
        showSettings={showSettings}
      />

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">

        {/* Welcome banner */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl p-6 md:p-8 mb-6 overflow-hidden"
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
                if (p.id === 'assign' || p.id === 'information') return false
                if (p.id === 'requirements' && visibleRequirements.length === 0) return false
                return true
              }).map(p => {
                const isActive = phase === p.id
                const hasBadge = (p.id === 'requirements' && openReqs.length > 0) || p.id === 'information'
                const disabled = Boolean((p as any).disabled)
                return (
                  <button
                    key={p.id}
                    onClick={() => !disabled && setPhase(p.id)}
                    disabled={disabled}
                    className={`w-full relative flex items-center justify-between gap-2 px-3 py-3 rounded-xl text-sm font-medium transition-all ${
                      disabled
                        ? 'text-slate-300 bg-slate-50 border border-slate-100 cursor-not-allowed'
                        : isActive
                        ? 'text-white shadow-sm'
                        : 'text-slate-500 bg-white border border-slate-200 hover:border-slate-300 hover:text-slate-700'
                    }`}
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
                />
              )}
              {phase === 'information' && <AgentInformationTab clientId={client.id} uploaderEmail={sessionEmail || client.email} />}
              {phase === 'collection' && (
                <CollectionTab
                  valuationDocs={visibleValuationDocs}
                  categories={visibleCategories}
                  getStatus={getDocStatus}
                  setStatus={setDocStatus}
                  clientId={client.id}
                  uploaderEmail={sessionEmail || client.email}
                  sectionSubmissions={client.sectionSubmissions ?? {}}
                  onSubmitSection={submitSection}
                  submittingSectionId={submittingSectionId}
                  getDeadline={getDeadline}
                  sectionDeadlines={sectionDeadlines}
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
              {phase === 'roadmap' && <RoadmapTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Settings panel */}
      {showSettings && (
        <div className="fixed inset-0 z-40 flex items-start justify-end p-4 pt-16">
          <div className="absolute inset-0" onClick={() => setShowSettings(false)} />
          <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="relative bg-white rounded-2xl shadow-2xl w-80 p-6 space-y-6"
          >
            <h3 className="font-semibold text-slate-800">Notification Preferences</h3>
            <div className="space-y-3">
              {[
                { label: 'Email notifications', sub: 'New requirements, messages, updates', val: notifEmail, set: setNotifEmail },
                { label: 'SMS notifications', sub: 'Urgent items only', val: notifSms, set: setNotifSms },
              ].map(s => (
                <div key={s.label} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{s.label}</p>
                    <p className="text-xs text-slate-400">{s.sub}</p>
                  </div>
                  <button
                    onClick={() => s.set(v => !v)}
                    className={`relative w-10 h-6 rounded-full transition-all shrink-0 ${s.val ? 'bg-amber-500' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${s.val ? 'left-5' : 'left-1'}`} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

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
        <Button size="sm" onClick={openAddModal} className="w-full justify-center md:w-auto">
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

      <Modal open={showModal} onClose={closeModal} title={editingTeamMemberId ? 'Edit Team Member' : 'Add Team Member'}>
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
}) {
  const steps = [
    { title: 'Assign Documents', desc: 'Tell us which documents you have, and then assign each document to yourself or a team member who will upload it.' },
    { title: 'Document Upload', desc: 'Upload the required documents.' },
    { title: 'Required Information', desc: 'Complete any short forms needed by your advisor tools, such as websites, profiles, and competitor names.' },
    { title: 'Review', desc: 'Your advisor team will review materials and follow up through the chat button in the bottom right corner.' },
  ]
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-slate-200">
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
      />

      <div className="bg-white rounded-2xl p-6 border border-slate-200">
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
}) {
  const [subView, setSubView] = useState<'yesno' | 'assign'>('yesno')
  const diligenceDocs = categories.flatMap(c => c.documents)
  const allDocs = [...valuationDocs, ...diligenceDocs]
  const assignableDocs = allDocs.filter(d => d.type === 'required' || valuationDocs.some(v => v.id === d.id) || getStatus(d.id).hasDoc === true)
  const answeredAll = diligenceDocs
    .filter(d => d.type !== 'required')
    .every(d => getStatus(d.id).hasDoc !== null || getStatus(d.id).notApplicable)

  return (
    <div className="space-y-4">
      {/* Step switcher */}
      <div className="bg-white rounded-2xl border border-slate-200 p-1 flex gap-1">
        {(['yesno', 'assign'] as const).map(v => (
          <button
            key={v}
            onClick={() => setSubView(v)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all ${subView === v ? 'text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            style={subView === v ? { background: '#0d1829' } : {}}
          >
            {v === 'yesno' ? '1 — Tell us which documents you have' : '2 — Assign documents to yourself or another team member'}
            {v === 'assign' && allAssigned && <CheckCircle className="w-3 h-3 text-emerald-400 inline ml-1.5" />}
          </button>
        ))}
      </div>

      {subView === 'yesno' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-700 leading-relaxed">
            For each optional item, choose <span className="font-semibold">Yes</span> if you have it, <span className="font-semibold">No</span> if you do not, or <span className="font-semibold">N/A</span> if it does not apply to your business. Required and valuation documents are handled in step 2.
          </div>
          {categories.map(cat => (
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
                        {doc.description && <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{doc.description}</p>}
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
                <div className="px-5 py-3 border-b border-amber-200/80">
                  <h4 className="text-sm font-semibold text-amber-900">Valuation Documents</h4>
                  <p className="text-xs text-amber-700 mt-1">Assign these first to yourself or a team member who will upload them.</p>
                </div>
                <div className="divide-y divide-amber-100/80">
                  {valuationDocs.map(doc => {
                    const s = getStatus(doc.id)
                    const options = [
                      { value: 'me', label: 'Me (I\'ll upload it)' },
                      ...teamMembers.map(m => ({ value: m.name, label: m.name + ' · ' + m.role })),
                    ]
                    return (
                      <div key={doc.id} className="px-5 py-4 bg-white/60 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-slate-800">{doc.name}</p>
                            <Badge color="gold">Required</Badge>
                            <TargetDeadlineBadge deadline={getDeadline(doc.id, VALUATION_SECTION_ID)} uploaded={Boolean(s.fileName)} />
                          </div>
                          {doc.description && <p className="text-xs text-slate-500 mt-1">{doc.description}</p>}
                          {DOCUMENT_ASSIGN_HELP[doc.id] && (
                            <p className="text-xs text-slate-400 mt-0.5">{DOCUMENT_ASSIGN_HELP[doc.id]}</p>
                          )}
                          <DocumentReferenceLink docId={doc.id} />
                        </div>
                        <select
                          className="text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-amber-400 transition-all"
                          value={s.assignedTo ?? ''}
                          onChange={e => setStatus(doc.id, { assignedTo: e.target.value || null })}
                        >
                          <option value="">— Assign to —</option>
                          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        {s.assignedTo && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />}
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
                  { value: 'me', label: 'Me (I\'ll upload it)' },
                  ...teamMembers.map(m => ({ value: m.name, label: m.name + ' · ' + m.role })),
                ]
                return (
                  <div key={doc.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-slate-800">{doc.name}</p>
                        {doc.type === 'required' && <Badge color="gold">Required</Badge>}
                        <TargetDeadlineBadge deadline={getDeadline(doc.id, cat.id)} uploaded={Boolean(s.fileName)} />
                      </div>
                      {doc.description && <p className="text-xs text-slate-500 mt-1">{doc.description}</p>}
                      {DOCUMENT_ASSIGN_HELP[doc.id] && (
                        <p className="text-xs text-slate-400 mt-0.5">{DOCUMENT_ASSIGN_HELP[doc.id]}</p>
                      )}
                      <DocumentReferenceLink docId={doc.id} />
                    </div>
                    <select
                      className="text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-amber-400 transition-all"
                      value={s.assignedTo ?? ''}
                      onChange={e => setStatus(doc.id, { assignedTo: e.target.value || null })}
                    >
                      <option value="">— Assign to —</option>
                      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    {s.assignedTo && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />}
                  </div>
                )
              }))}
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
    </div>
  )
}

// ── Collection Tab ────────────────────────────────────────────────────────────
type ClientPortalFormQuestion = {
  id: string
  fieldKey: string
  label: string
  description?: string | null
  inputType: 'text' | 'url' | 'textarea' | 'select' | 'number'
  placeholder?: string | null
  required: boolean
  options?: string[] | null
  groupKey?: string | null
  groupLabel?: string | null
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
  const fieldKey = question.fieldKey as StructuredFormFieldKey
  const columns = STRUCTURED_FORM_COLUMNS[fieldKey] ?? []
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
      <div className="overflow-x-auto rounded-xl border border-slate-200">
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
      </div>
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

function AgentInformationTab({ clientId, uploaderEmail }: { clientId: string; uploaderEmail: string }) {
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

  const groupedQuestions = formQuestions.reduce<Record<string, ClientPortalFormQuestion[]>>((acc, question) => {
    const key = question.groupLabel || 'Business Information'
    acc[key] = [...(acc[key] ?? []), question]
    return acc
  }, {})
  const hasFacilityQuestions = formQuestions.some(question => question.fieldKey.startsWith('facility'))

  if (!formQuestions.length) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 text-sm text-slate-500">
        No extra form information is required for the selected workstream right now.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h4 className="text-sm font-semibold text-slate-700">Required Information</h4>
          <p className="text-xs text-slate-500 mt-1">
            Complete these fields once. Answers save automatically as you type and when you switch sections — you can also use Save Information below.
          </p>
        </div>
        <div className="p-5 space-y-5">
          {Object.entries(groupedQuestions).map(([groupLabel, questions]) => (
            <div key={groupLabel} className="space-y-3 pt-2 border-t border-slate-100 first:border-t-0 first:pt-0">
              <h5 className="text-sm font-bold text-slate-800">{groupLabel}</h5>
              <div className="grid gap-3 md:grid-cols-2">
                {questions.map(question => {
                  const commonClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400'
                  const structured = Boolean(STRUCTURED_FORM_COLUMNS[question.fieldKey])
                  // Do not wrap structured tables in <label>: first labelable descendant would be the hidden file input,
                  // so clicks (e.g. "Add Row") can incorrectly open the file picker (HTML label activation behavior).
                  const Shell = structured ? 'div' : 'label'
                  const shellClass = (question.inputType === 'textarea' || structured) ? 'md:col-span-2' : ''
                  return (
                    <Shell key={question.id} className={shellClass}>
                      <span className="text-xs font-semibold text-slate-500">
                        {question.label}
                        {question.required && <span className="text-amber-600"> *</span>}
                      </span>
                      {question.description && <span className="block text-[11px] text-slate-400 mt-0.5">{question.description}</span>}
                      {structured ? (
                        <StructuredRowsInput
                          question={question}
                          value={formResponses[question.fieldKey] ?? ''}
                          onChange={value => updateFormResponse(question.fieldKey, value)}
                          onError={setFormError}
                        />
                      ) : question.inputType === 'textarea' ? (
                        <>
                          <textarea
                            value={formResponses[question.fieldKey] ?? ''}
                            onChange={e => updateFormResponse(question.fieldKey, e.target.value)}
                            placeholder={question.placeholder ?? ''}
                            className={`${commonClass} mt-1 min-h-[84px] resize-y`}
                          />
                        </>
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
                    </Shell>
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
      {hasFacilityQuestions && <FacilityImageUploadPanel clientId={clientId} uploaderEmail={uploaderEmail} />}
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

function CollectionTab({ valuationDocs, categories, getStatus, setStatus, clientId, uploaderEmail, sectionSubmissions, onSubmitSection, submittingSectionId, getDeadline, sectionDeadlines }: {
  valuationDocs: ReturnType<typeof getValuationDocsForWorkstream>
  categories: ReturnType<typeof getDocsForWorkstream>
  getStatus: (id: string) => DocumentStatus
  setStatus: (id: string, u: Partial<DocumentStatus>) => void
  clientId: string
  uploaderEmail: string
  sectionSubmissions: Record<string, any>
  onSubmitSection: (sectionId: string) => Promise<void>
  submittingSectionId: string | null
  getDeadline: (docId: string, sectionId: string) => string | null
  sectionDeadlines: Record<string, string>
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
      <div className="px-5 py-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
          Upload documents as you have them — each file saves automatically.
          {totalCount > 0 ? ` ${uploadedCount} of ${totalCount} file slot${totalCount === 1 ? '' : 's'} filled.` : ''}
          {' '}Submit when you would like Cantara to review this section (you do not need every slot filled first).
        </p>
        <Button
          size="sm"
          variant={uploadedCount === totalCount && totalCount > 0 ? 'primary' : 'outline'}
          onClick={() => void onSubmitSection(sectionId)}
          disabled={!canSubmit || submittingSectionId === sectionId}
        >
          {submittingSectionId === sectionId ? 'Submitting...' : 'Mark Section Ready'}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 text-xs text-slate-500 leading-relaxed">
        Upload documents for each item your team confirmed in the Assign step. You can add files over time — each upload saves immediately. Target deadlines are set by your Cantara team.
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
                  deadlineBadge={
                    <TargetDeadlineBadge deadline={getDeadline(doc.id, VALUATION_SECTION_ID)} uploaded={valuationComplete} />
                  }
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
                    deadlineBadge={<TargetDeadlineBadge deadline={getDeadline(doc.id, cat.id)} uploaded={slotUploaded} />}
                    fileCount={fileCount}
                    isComplete={slotUploaded}
                  >
                    <DocumentReferenceLink docId={doc.id} />
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
        status: 'open',
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

  const open = requirements.filter(r => r.status === 'open')
  const resolved = requirements.filter(r => r.status === 'resolved')
  return (
    <div className="space-y-4">
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
function RoadmapTab() {
  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-400 opacity-70">
      <Map className="w-10 h-10 text-slate-300 mx-auto mb-4" />
      <p className="font-medium text-slate-600 mb-2">Your Roadmap</p>
      <p className="text-xs leading-relaxed max-w-sm mx-auto">
        Your sale readiness roadmap and action plan will appear here once your advisor team has completed their initial review of your documents.
      </p>
    </div>
  )
}
