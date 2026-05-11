'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import {
  LogOut, Bell, Settings, ChevronRight, CheckCircle, Upload, X,
  MessageSquare, AlertCircle, Send, Users, Plus, Trash2,
  FileText, HelpCircle, ChevronDown, ChevronUp, Map, Briefcase, Lock, Loader2, ExternalLink
} from 'lucide-react'
import { Button, Badge, ProgressBar, Modal, Input, Textarea, GoldLine } from '@/components/ui'
import { getDocsForWorkstream, getValuationDocsForWorkstream } from '@/lib/documentData'
import { getClients, getMessages, saveMessage, getRequirements, getCurrentRole, logout, getClient, saveClient, updateRequirement } from '@/lib/store'
import type { Client, DocumentStatus, ChatMessage, AdditionalRequirement } from '@/lib/store'

// ── Nav ──────────────────────────────────────────────────────────────────────
function ClientNav({ clientName, unreadCount, onSettings, showSettings }: {
  clientName: string; unreadCount: number; onSettings: () => void; showSettings: boolean
}) {
  const router = useRouter()
  return (
    <header className="sticky top-0 z-40" style={{ background: '#0d1829' }}>
      <div className="max-w-4xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-white cantara-serif tracking-[0.18em] text-sm">Cantara</span>
          <div className="w-px h-3 bg-white/15" />
          <span className="text-white/30 tracking-[0.18em] uppercase" style={{ fontSize: '0.58rem' }}>Client Portal</span>
        </div>
        <div className="flex items-center gap-1">
          <button className="relative p-2 rounded hover:bg-white/5 transition-colors text-white/30 hover:text-white/70">
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: '#b8922a' }} />
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
  { id: 'collection', label: 'Collection' },
  { id: 'requirements', label: 'Additional Requirements' },
  { id: 'roadmap', label: 'Roadmap', disabled: true },
]

// ── Document upload dropzone ─────────────────────────────────────────────────
function DocumentUpload({ docId, docName, clientId, uploaderEmail, onUploaded, currentFileName }: {
  docId: string; docName: string; clientId: string; uploaderEmail: string; onUploaded: (fileName: string, fileUrl?: string | null) => void; currentFileName?: string | null
}) {
  const [uploadedName, setUploadedName] = useState(currentFileName ?? '')
  const [uploading, setUploading] = useState(false)
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (files) => {
      if (!files[0]) return
      setUploading(true)
      const form = new FormData()
      form.append('file', files[0])
      form.append('clientId', clientId)
      form.append('documentId', docId)
      form.append('uploaderEmail', uploaderEmail)
      const res = await fetch('/api/client-documents/upload', {
        method: 'POST',
        body: form,
      })
      setUploading(false)
      if (!res.ok) return
      const data = await res.json()
      onUploaded(files[0].name, data.fileUrl || null)
      setUploadedName(files[0].name)
    },
    multiple: false,
  })
  return (
    <div
      {...getRootProps()}
      className={`border border-dashed rounded-lg px-3 py-2 cursor-pointer text-xs transition-all flex items-center gap-2 min-w-[132px] ${
        uploading
          ? 'border-amber-300 bg-amber-50 text-amber-700'
          : uploadedName
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : isDragActive
          ? 'border-amber-400 bg-amber-50 text-amber-600'
          : 'border-slate-200 text-slate-400 hover:border-amber-300 hover:text-amber-500'
      }`}
    >
      <input {...getInputProps()} />
      {uploading ? (
        <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
      ) : uploadedName ? (
        <CheckCircle className="w-3.5 h-3.5 shrink-0" />
      ) : (
        <Upload className="w-3.5 h-3.5 shrink-0" />
      )}
      <span className="truncate">
        {uploading ? 'Uploading...' : uploadedName ? uploadedName : isDragActive ? 'Drop file here' : 'Upload file'}
      </span>
    </div>
  )
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
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [requirements, setRequirements] = useState<AdditionalRequirement[]>([])
  const [savingStatuses, setSavingStatuses] = useState(false)
  const [submittingSectionId, setSubmittingSectionId] = useState<string | null>(null)
  const [newTeamMember, setNewTeamMember] = useState({ name: '', email: '', role: '' })
  const [savingTeamMember, setSavingTeamMember] = useState(false)
  const [editingTeamMemberId, setEditingTeamMemberId] = useState<string | null>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // In production: load the actual logged-in client. For demo use first provisioned client.
    const load = async () => {
      const email = typeof window !== 'undefined' ? (JSON.parse(localStorage.getItem('cantara_client_email') || 'null')) : null
      const all = await getClients()
      const found = (email ? all.find(c => c.email === email) : null) ?? all.find(c => c.workstream) ?? all[0]
      if (found) {
        setClient(found)
        setDocStatuses(found.documentStatuses ?? {})
        setMessages(await getMessages(found.id))
        setRequirements(await getRequirements(found.id))
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!client) return
    const interval = setInterval(async () => {
      const refreshedClient = await getClient(client.id)
      if (refreshedClient) {
        setClient(refreshedClient)
        setDocStatuses(refreshedClient.documentStatuses ?? {})
      }
      setMessages(await getMessages(client.id))
      setRequirements(await getRequirements(client.id))
    }, 3000)
    return () => clearInterval(interval)
  }, [client])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, showChat])

  useEffect(() => {
    if (!client) return
    const timeout = setTimeout(async () => {
      setSavingStatuses(true)
      try {
        await fetch('/api/client-portal/statuses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: client.id, statuses: docStatuses }),
        })
      } finally {
        setSavingStatuses(false)
      }
    }, 400)

    return () => clearTimeout(timeout)
  }, [docStatuses, client])

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d1829' }}>
        <div className="w-6 h-6 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
      </div>
    )
  }

  const setDocStatus = (docId: string, update: Partial<DocumentStatus>) => {
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
    setSavingTeamMember(true)
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
      setSavingTeamMember(false)
    }
  }

  const getDocStatus = (docId: string): DocumentStatus =>
    docStatuses[docId] ?? { id: docId, hasDoc: null, assignedTo: null, uploadedAt: null, fileName: null, notApplicable: false }

  const categories = getDocsForWorkstream(client.workstream, client.businessType)
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
  const submittedDocs = allDocs.filter(d => getDocStatus(d.id).fileName)
  const openReqs = requirements.filter(r => r.status === 'open')
  const unreadMsgs = messages.filter(m => m.senderRole === 'admin' && !m.readByClient).length

  const sendMessage = async () => {
    if (!chatDraft.trim() || !client) return
    const draft = chatDraft.trim()
    setChatDraft('')
    await saveMessage({
      clientId: client.id,
      senderRole: 'client',
      senderName: client.name,
      message: draft,
      timestamp: new Date().toISOString(),
      readByAdmin: false,
      readByClient: true,
    })
    setMessages(await getMessages(client.id))
  }

  const wsLabel: Record<string, string> = {
    ws1: 'Workstream 1 — Risk Mitigation',
    ws2: 'Workstream 2 — Profitability & Growth',
    both: 'Workstream 1 & 2',
    ma: 'M&A Advisory',
  }

  return (
    <div className="min-h-screen" style={{ background: 'hsl(220,18%,96%)' }}>
      <ClientNav
        clientName={client.name}
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
                {client.workstream && (
                  <p className="text-xs mt-2" style={{ color: 'rgba(212,168,67,0.7)' }}>{wsLabel[client.workstream]}</p>
                )}
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
                <span>{submittedDocs.length} of {allDocs.length} documents submitted{savingStatuses ? ' · Saving…' : ''}</span>
              </div>
              <ProgressBar value={allDocs.length ? Math.round((submittedDocs.length / allDocs.length) * 100) : 0} />
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-6 items-start">
          <aside className="bg-white rounded-2xl border border-slate-200 p-3 sticky top-24">
            <div className="mb-3 px-3 pt-2 pb-1">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Portal Sections</p>
            </div>
            <div className="space-y-1">
              {PHASES.map(p => {
                const isActive = phase === p.id
                const hasBadge = p.id === 'requirements' && openReqs.length > 0
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
                    {hasBadge && (
                      <span className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ background: '#f43f5e', color: 'white' }}>
                        {openReqs.length}
                      </span>
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
              {phase === 'overview' && <OverviewTab client={client} wsLabel={wsLabel} />}
              {phase === 'assign' && <AssignTab valuationDocs={valuationDocs} categories={categories} getStatus={getDocStatus} setStatus={setDocStatus} teamMembers={client.teamMembers} allAssigned={allConfirmedAssigned} />}
              {phase === 'collection' && (
                <CollectionTab
                  valuationDocs={valuationDocs}
                  categories={categories}
                  getStatus={getDocStatus}
                  setStatus={setDocStatus}
                  clientId={client.id}
                  uploaderEmail={client.email}
                  sectionSubmissions={client.sectionSubmissions ?? {}}
                  onSubmitSection={submitSection}
                  submittingSectionId={submittingSectionId}
                />
              )}
              {phase === 'requirements' && <RequirementsClientTab requirements={requirements} />}
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
            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-600 mb-2">Your Team</p>
              {client.teamMembers.length === 0 ? (
                <p className="text-xs text-slate-400">No team members added yet. Add the people who will help upload documents.</p>
              ) : client.teamMembers.map(m => (
                <div key={m.id} className="flex items-center gap-2 py-1.5">
                  <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-xs font-semibold text-amber-700">{m.name[0]}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700">{m.name}</p>
                    <p className="text-xs text-slate-400">{m.email}{m.role ? ` · ${m.role}` : ''}</p>
                  </div>
                  <button
                    onClick={() => startEditingTeamMember(m)}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => void deleteTeamMember(m.id)}
                    className="text-xs text-rose-500 hover:text-rose-700"
                  >
                    Delete
                  </button>
                </div>
              ))}
              <div className="mt-3 space-y-2">
                <Input
                  placeholder="Team member name"
                  value={newTeamMember.name}
                  onChange={e => setNewTeamMember(prev => ({ ...prev, name: e.target.value }))}
                />
                <Input
                  placeholder="Team member email"
                  type="email"
                  value={newTeamMember.email}
                  onChange={e => setNewTeamMember(prev => ({ ...prev, email: e.target.value }))}
                />
                <Input
                  placeholder="Role (optional)"
                  value={newTeamMember.role}
                  onChange={e => setNewTeamMember(prev => ({ ...prev, role: e.target.value }))}
                />
                <Button
                  size="sm"
                  onClick={() => void addTeamMember()}
                  disabled={savingTeamMember || !newTeamMember.name.trim() || !newTeamMember.email.trim()}
                >
                  {savingTeamMember ? (editingTeamMemberId ? 'Saving...' : 'Adding...') : (editingTeamMemberId ? 'Save Changes' : 'Add Team Member')}
                </Button>
                {editingTeamMemberId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingTeamMemberId(null)
                      setNewTeamMember({ name: '', email: '', role: '' })
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
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
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs font-bold text-white flex items-center justify-center" style={{ background: '#b8922a' }}>
            {unreadMsgs}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {showChat && (
        <div className="fixed bottom-24 right-6 z-40 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden" style={{ height: '420px' }}>
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between" style={{ background: '#0d1829' }}>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-white/60" />
              <span className="text-sm font-medium text-white">Your Cantara Team</span>
            </div>
            <button onClick={() => setShowChat(false)} className="text-white/40 hover:text-white/70"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">Send a message to your advisor team.</div>
            ) : messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.senderRole === 'client' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs ${
                  msg.senderRole === 'client' ? 'text-white rounded-br-sm' : 'bg-slate-100 text-slate-700 rounded-bl-sm'
                }`} style={msg.senderRole === 'client' ? { background: '#0d1829' } : {}}>
                  {msg.senderRole === 'admin' && <p className="font-semibold text-slate-500 mb-0.5">{msg.senderName}</p>}
                  <p>{msg.message}</p>
                </div>
              </div>
            ))}
            <div ref={chatBottomRef} />
          </div>
          <div className="p-3 border-t border-slate-100 flex gap-2">
            <input
              className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 outline-none focus:border-amber-400"
              placeholder="Message your team…"
              value={chatDraft}
              onChange={e => setChatDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendMessage() }}
            />
            <button
              onClick={sendMessage}
              disabled={!chatDraft.trim()}
              className="w-8 h-8 rounded-xl flex items-center justify-center disabled:opacity-40"
              style={{ background: '#b8922a' }}
            >
              <Send className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ client, wsLabel }: { client: Client; wsLabel: Record<string, string> }) {
  const steps = [
    { title: 'Assign Documents', desc: 'Review the requested checklist and assign each document to yourself or a team member who will upload it.' },
    { title: 'Collection', desc: 'Upload the required documents, including the valuation materials highlighted by your Cantara team.' },
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

      <div className="bg-white rounded-2xl p-6 border border-slate-200">
        <div className="flex items-center gap-2 mb-4">
          <Briefcase className="w-4 h-4 text-amber-600" />
          <h3 className="text-lg font-semibold text-slate-800 cantara-serif">Your Advisor Team</h3>
        </div>
        {client.advisors.length === 0 ? (
          <p className="text-sm text-slate-400">Your advisor team will appear here once added by Cantara.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {client.advisors.map(advisor => (
              <div key={advisor.id} className="p-5 rounded-xl border border-slate-100 bg-slate-50">
                <img
                  src={advisor.imageUrl}
                  alt={advisor.name}
                  className="w-20 h-20 rounded-full object-cover bg-slate-200 mb-4"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    const next = e.currentTarget.nextElementSibling as HTMLElement | null
                    if (next) next.style.display = 'flex'
                  }}
                />
                <div
                  className="w-20 h-20 rounded-full bg-amber-100 text-amber-700 mb-4 hidden items-center justify-center text-2xl font-semibold"
                >
                  {advisor.name[0]}
                </div>
                <p className="text-sm font-semibold text-slate-800">{advisor.name}</p>
                <p className="text-xs text-slate-400 mt-1">Advisor</p>
              </div>
            ))}
          </div>
        )}
      </div>

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
function AssignTab({ valuationDocs, categories, getStatus, setStatus, teamMembers, allAssigned }: {
  valuationDocs: ReturnType<typeof getValuationDocsForWorkstream>
  categories: ReturnType<typeof getDocsForWorkstream>
  getStatus: (id: string) => DocumentStatus
  setStatus: (id: string, u: Partial<DocumentStatus>) => void
  teamMembers: Client['teamMembers']
  allAssigned: boolean
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
            {v === 'yesno' ? '1 — Do you have these documents?' : '2 — Assign documents'}
            {v === 'assign' && allAssigned && <CheckCircle className="w-3 h-3 text-emerald-400 inline ml-1.5" />}
          </button>
        ))}
      </div>

      {subView === 'yesno' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-700">
            Only optional documents are shown here. Required documents and valuation documents are already available in the Assign documents step.
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
                        {doc.description && <p className="text-xs text-slate-400 mt-0.5">{doc.description}</p>}
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
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-800">{doc.name}</p>
                            <Badge color="gold">Required</Badge>
                          </div>
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
              {diligenceDocs
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
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-800">{doc.name}</p>
                        {doc.type === 'required' && <Badge color="gold">Required</Badge>}
                      </div>
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
              {allAssigned && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">All documents assigned</p>
                    <p className="text-xs text-emerald-600 mt-0.5">Your team has been notified. Head to Collection to start uploading.</p>
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
function CollectionTab({ valuationDocs, categories, getStatus, setStatus, clientId, uploaderEmail, sectionSubmissions, onSubmitSection, submittingSectionId }: {
  valuationDocs: ReturnType<typeof getValuationDocsForWorkstream>
  categories: ReturnType<typeof getDocsForWorkstream>
  getStatus: (id: string) => DocumentStatus
  setStatus: (id: string, u: Partial<DocumentStatus>) => void
  clientId: string
  uploaderEmail: string
  sectionSubmissions: Record<string, { submittedAt: string }>
  onSubmitSection: (sectionId: string) => Promise<void>
  submittingSectionId: string | null
}) {
  const renderSectionFooter = (sectionId: string, totalCount: number, uploadedCount: number) => {
    const isSubmitted = Boolean(sectionSubmissions[sectionId])
    const canSubmit = totalCount > 0 && uploadedCount === totalCount

    if (isSubmitted) {
      return (
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
            Thank you for uploading documents, documents are under review
          </div>
        </div>
      )
    }

    return (
      <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between">
        <p className="text-xs text-slate-400">
          {uploadedCount === totalCount && totalCount > 0
            ? 'All documents uploaded. Submit this section for review.'
            : 'Upload all documents in this section before submitting.'}
        </p>
        <Button
          size="sm"
          onClick={() => void onSubmitSection(sectionId)}
          disabled={!canSubmit || submittingSectionId === sectionId}
        >
          {submittingSectionId === sectionId ? 'Submitting...' : 'Submit Section'}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 text-xs text-slate-500 leading-relaxed">
        Upload documents for each item your team confirmed in the Assign step. You can upload in batches — progress is saved automatically. Assigned team members have been notified by email.
      </div>
      <QuickBooksConnectCard clientId={clientId} />
      {valuationDocs.length > 0 && (
        <div className={`rounded-2xl border overflow-hidden ${sectionSubmissions.valuation ? 'border-slate-200 bg-slate-50 opacity-70' : 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200'}`}>
          <div className="px-5 py-3 border-b border-amber-200/80 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-amber-900">Valuation Documents</h4>
            <span className="text-xs text-amber-700">
              {valuationDocs.filter(d => getStatus(d.id).fileName).length}/{valuationDocs.length} uploaded
            </span>
          </div>
          <div className="divide-y divide-amber-100/80">
            {valuationDocs.map(doc => {
              const s = getStatus(doc.id)
              if (s.hasDoc === false || s.notApplicable) return null
              return (
                <div key={doc.id} className="px-5 py-4 bg-white/60">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-slate-800">{doc.name}</p>
                        {s.assignedTo && <Badge color="slate">{s.assignedTo}</Badge>}
                      </div>
                      <p className="text-xs text-amber-700 mt-0.5">{doc.description}</p>
                    </div>
                    <DocumentUpload
                      docId={doc.id}
                      docName={doc.name}
                      clientId={clientId}
                      uploaderEmail={uploaderEmail}
                      currentFileName={s.fileName}
                      onUploaded={(fileName, fileUrl) => setStatus(doc.id, { fileName, fileUrl: fileUrl || null, uploadedAt: new Date().toISOString() })}
                    />
                  </div>
                  {s.fileName && (
                    <div className="flex items-center gap-2 text-xs text-emerald-600 mt-1">
                      <CheckCircle className="w-3 h-3" /> {s.fileName}
                      <span className="text-slate-300">· {s.uploadedAt ? new Date(s.uploadedAt).toLocaleDateString() : ''}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {renderSectionFooter(
            'valuation',
            valuationDocs.length,
            valuationDocs.filter(d => getStatus(d.id).fileName).length,
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
        const uploadedCount = docsToShow.filter(d => getStatus(d.id).fileName).length
        return (
          <div key={cat.id} className={`rounded-2xl border overflow-hidden ${isSubmitted ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-white border-slate-200'}`}>
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-700">{cat.title}</h4>
              <span className="text-xs text-slate-400">
                {uploadedCount}/{docsToShow.length} uploaded
              </span>
            </div>
            <div className="divide-y divide-slate-50">
              {docsToShow.map(doc => {
                const s = getStatus(doc.id)
                return (
                  <div key={doc.id} className="px-5 py-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-slate-800">{doc.name}</p>
                          {s.assignedTo && <Badge color="slate">{s.assignedTo}</Badge>}
                        </div>
                        {doc.flagged && <p className="text-xs text-amber-600 mt-0.5">{doc.flagNote}</p>}
                      </div>
                      <DocumentUpload
                        docId={doc.id}
                        docName={doc.name}
                        clientId={clientId}
                        uploaderEmail={uploaderEmail}
                        currentFileName={s.fileName}
                        onUploaded={(fileName, fileUrl) => setStatus(doc.id, { fileName, fileUrl: fileUrl || null, uploadedAt: new Date().toISOString() })}
                      />
                    </div>
                    {s.fileName && (
                      <div className="flex items-center gap-2 text-xs text-emerald-600 mt-1">
                        <CheckCircle className="w-3 h-3" /> {s.fileName}
                        <span className="text-slate-300">· {s.uploadedAt ? new Date(s.uploadedAt).toLocaleDateString() : ''}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {renderSectionFooter(cat.id, docsToShow.length, uploadedCount)}
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
function RequirementsClientTab({ requirements }: { requirements: AdditionalRequirement[] }) {
  const [drafts, setDrafts] = useState<Record<string, { response: string; fileName: string | null; fileUrl: string | null; uploading: boolean; saving: boolean }>>({})

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

  const open = requirements.filter(r => r.status === 'open')
  const resolved = requirements.filter(r => r.status === 'resolved')
  return (
    <div className="space-y-4">
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
                <p className="text-sm font-semibold text-slate-800">{req.title}</p>
                <Badge color={req.priority === 'high' ? 'red' : req.priority === 'medium' ? 'gold' : 'green'}>
                  {req.priority}
                </Badge>
              </div>
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
