'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import {
  LogOut, Bell, Settings, ChevronRight, CheckCircle, Upload, X,
  MessageSquare, AlertCircle, Send, Users, Plus, Trash2,
  FileText, HelpCircle, ChevronDown, ChevronUp, Map
} from 'lucide-react'
import { Button, Badge, ProgressBar, Modal, Input, Textarea, GoldLine } from '@/components/ui'
import { VALUATION_DOCS, DOCUMENT_CATEGORIES, getDocsForWorkstream } from '@/lib/documentData'
import { getClients, getMessages, saveMessage, getRequirements, getCurrentRole, logout } from '@/lib/store'
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
  { id: 'valuation', label: 'Valuation' },
  { id: 'assign', label: 'Assign' },
  { id: 'collection', label: 'Collection' },
  { id: 'requirements', label: 'Additional Requirements' },
  { id: 'roadmap', label: 'Roadmap' },
]

// ── Document upload dropzone ─────────────────────────────────────────────────
function DocumentUpload({ docId, docName, onUploaded }: {
  docId: string; docName: string; onUploaded: (fileName: string) => void
}) {
  const [uploaded, setUploaded] = useState(false)
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => {
      if (files[0]) { onUploaded(files[0].name); setUploaded(true) }
    },
    multiple: false,
  })
  if (uploaded) return (
    <div className="flex items-center gap-2 text-xs text-emerald-600">
      <CheckCircle className="w-3.5 h-3.5" /> Uploaded
    </div>
  )
  return (
    <div {...getRootProps()} className={`border border-dashed rounded-lg px-3 py-2 cursor-pointer text-xs transition-all flex items-center gap-2 ${isDragActive ? 'border-amber-400 bg-amber-50 text-amber-600' : 'border-slate-200 text-slate-400 hover:border-amber-300 hover:text-amber-500'}`}>
      <input {...getInputProps()} />
      <Upload className="w-3.5 h-3.5 shrink-0" />
      {isDragActive ? 'Drop file here' : 'Upload file'}
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
      setMessages(await getMessages(client.id))
      setRequirements(await getRequirements(client.id))
    }, 3000)
    return () => clearInterval(interval)
  }, [client])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, showChat])

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

  const getDocStatus = (docId: string): DocumentStatus =>
    docStatuses[docId] ?? { id: docId, hasDoc: null, assignedTo: null, uploadedAt: null, fileName: null, notApplicable: false }

  const categories = getDocsForWorkstream(client.workstream, client.businessType)
  const allDocs = [...VALUATION_DOCS, ...categories.flatMap(c => c.documents)]
  const confirmedDocs = allDocs.filter(d => getDocStatus(d.id).hasDoc === true)
  const allConfirmedAssigned = confirmedDocs.length > 0 && confirmedDocs.every(d => getDocStatus(d.id).assignedTo || getDocStatus(d.id).fileName)
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

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-8">

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
                <span>{submittedDocs.length} of {allDocs.length} documents submitted</span>
              </div>
              <ProgressBar value={allDocs.length ? Math.round((submittedDocs.length / allDocs.length) * 100) : 0} />
            </div>
          </div>
        </motion.div>

        {/* Phase navigation */}
        <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
          {PHASES.map(p => {
            const isActive = phase === p.id
            const hasBadge = p.id === 'requirements' && openReqs.length > 0
            return (
              <button
                key={p.id}
                onClick={() => setPhase(p.id)}
                className={`relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isActive ? 'text-white shadow-sm' : 'text-slate-500 bg-white border border-slate-200 hover:border-slate-300 hover:text-slate-700'
                }`}
                style={isActive ? { background: 'linear-gradient(135deg, #0d1829, #111e35)', border: '1px solid rgba(184,146,42,0.3)' } : {}}
              >
                {p.id === 'assign' && allConfirmedAssigned && (
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                )}
                {p.label}
                {hasBadge && (
                  <span className="w-4 h-4 rounded-full text-xs font-bold flex items-center justify-center" style={{ background: '#f43f5e', color: 'white', fontSize: '0.55rem' }}>
                    {openReqs.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {phase === 'overview' && <OverviewTab client={client} wsLabel={wsLabel} onStart={() => setPhase('valuation')} />}
            {phase === 'valuation' && <ValuationTab docs={VALUATION_DOCS} getStatus={getDocStatus} setStatus={setDocStatus} onNext={() => setPhase('assign')} />}
            {phase === 'assign' && <AssignTab categories={categories} getStatus={getDocStatus} setStatus={setDocStatus} teamMembers={client.teamMembers} allAssigned={allConfirmedAssigned} />}
            {phase === 'collection' && <CollectionTab categories={categories} getStatus={getDocStatus} setStatus={setDocStatus} />}
            {phase === 'requirements' && <RequirementsClientTab requirements={requirements} />}
            {phase === 'roadmap' && <RoadmapTab />}
          </motion.div>
        </AnimatePresence>
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
                <p className="text-xs text-slate-400">No team members added. Contact your advisor to add team members.</p>
              ) : client.teamMembers.map(m => (
                <div key={m.id} className="flex items-center gap-2 py-1.5">
                  <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-xs font-semibold text-amber-700">{m.name[0]}</div>
                  <div>
                    <p className="text-xs font-medium text-slate-700">{m.name}</p>
                    <p className="text-xs text-slate-400">{m.role}</p>
                  </div>
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
function OverviewTab({ client, wsLabel, onStart }: { client: Client; wsLabel: Record<string, string>; onStart: () => void }) {
  const steps = [
    { num: 1, title: 'Business Valuation', desc: 'Upload your P&L documents so we can assess your starting valuation.' },
    { num: 2, title: 'Assign Documents', desc: 'Tell us which documents you have, then assign them to the right team members.' },
    { num: 3, title: 'Upload & Collect', desc: 'Your team uploads documents directly to the portal — all in one secure place.' },
    { num: 4, title: 'Review & Analysis', desc: 'Your advisor team reviews everything and will reach out with any questions.' },
    { num: 5, title: 'Final Deliverable', desc: 'Receive your sale readiness report, valuation, and roadmap.' },
  ]
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-800 cantara-serif mb-4">Your Process</h3>
        {client.workstream && (
          <div className="mb-5 p-3 rounded-xl text-xs" style={{ background: 'rgba(184,146,42,0.06)', border: '1px solid rgba(184,146,42,0.15)', color: '#9a7a22' }}>
            You are enrolled in: <strong>{wsLabel[client.workstream]}</strong>
          </div>
        )}
        <div className="space-y-4">
          {steps.map(step => (
            <div key={step.num} className="flex gap-4">
              <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white" style={{ background: '#b8922a' }}>
                {step.num}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{step.title}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 pt-6 border-t border-slate-100">
          <p className="text-xs text-slate-400 mb-4">
            Your advisor team will guide you through each step. If you have questions at any point, use the chat button in the bottom right corner.
          </p>
          <Button onClick={onStart}>Begin with Business Valuation <ChevronRight className="w-4 h-4" /></Button>
        </div>
      </div>
    </div>
  )
}

// ── Valuation Tab ────────────────────────────────────────────────────────────
function ValuationTab({ docs, getStatus, setStatus, onNext }: {
  docs: typeof VALUATION_DOCS
  getStatus: (id: string) => DocumentStatus
  setStatus: (id: string, u: Partial<DocumentStatus>) => void
  onNext: () => void
}) {
  const allSubmitted = docs.every(d => getStatus(d.id).fileName)
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(184,146,42,0.08)' }}>
            <span className="text-sm">📊</span>
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">Business Valuation Documents</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              These documents are required first — your advisor will use them to establish a starting valuation for your business.
              Please upload P&Ls in Excel format with all GL codes visible. Upload what you have now — you can add more at any time.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {docs.map(doc => {
            const status = getStatus(doc.id)
            return (
              <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{doc.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{doc.description}</p>
                  {status.fileName && (
                    <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> {status.fileName}
                    </p>
                  )}
                </div>
                <DocumentUpload
                  docId={doc.id}
                  docName={doc.name}
                  onUploaded={(fileName) => setStatus(doc.id, { fileName, uploadedAt: new Date().toISOString() })}
                />
              </div>
            )
          })}
        </div>

        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            {docs.filter(d => getStatus(d.id).fileName).length} of {docs.length} uploaded
          </p>
          <Button onClick={onNext} variant={allSubmitted ? 'primary' : 'outline'} size="sm">
            {allSubmitted ? 'Continue to Assign' : 'Continue (upload remaining later)'} <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Assign Tab (was Preparation) ─────────────────────────────────────────────
// UX from meeting: client first says Yes/No per doc, then assigns YES docs only
function AssignTab({ categories, getStatus, setStatus, teamMembers, allAssigned }: {
  categories: ReturnType<typeof getDocsForWorkstream>
  getStatus: (id: string) => DocumentStatus
  setStatus: (id: string, u: Partial<DocumentStatus>) => void
  teamMembers: Client['teamMembers']
  allAssigned: boolean
}) {
  const [subView, setSubView] = useState<'yesno' | 'assign'>('yesno')
  const allDocs = categories.flatMap(c => c.documents)
  const confirmedDocs = allDocs.filter(d => getStatus(d.id).hasDoc === true)
  const answeredAll = allDocs.every(d => getStatus(d.id).hasDoc !== null || getStatus(d.id).notApplicable)

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
            {v === 'yesno' ? '1 — Do you have this document?' : '2 — Assign documents'}
            {v === 'assign' && allAssigned && <CheckCircle className="w-3 h-3 text-emerald-400 inline ml-1.5" />}
          </button>
        ))}
      </div>

      {subView === 'yesno' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-700">
            Go through each document and indicate whether you have it. If you say yes, you'll assign it in the next step. You can change your answers at any time.
          </div>
          {categories.map(cat => (
            <div key={cat.id} className="bg-white rounded-2xl border border-slate-200">
              <div className="px-5 py-3 border-b border-slate-100">
                <h4 className="text-sm font-semibold text-slate-700">{cat.title}</h4>
              </div>
              <div className="divide-y divide-slate-50">
                {cat.documents.map(doc => {
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
                Assign {confirmedDocs.length} Documents <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {subView === 'assign' && (
        <div className="space-y-4">
          {confirmedDocs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-400">
              Go back and mark which documents you have before assigning.
            </div>
          ) : (
            <>
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-700">
                Showing {confirmedDocs.length} confirmed documents. Assign each to yourself or a team member who will upload it.
              </div>
              {confirmedDocs.map(doc => {
                const s = getStatus(doc.id)
                const options = [
                  { value: 'me', label: 'Me (I\'ll upload it)' },
                  ...teamMembers.map(m => ({ value: m.name, label: m.name + ' · ' + m.role })),
                ]
                return (
                  <div key={doc.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{doc.name}</p>
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
function CollectionTab({ categories, getStatus, setStatus }: {
  categories: ReturnType<typeof getDocsForWorkstream>
  getStatus: (id: string) => DocumentStatus
  setStatus: (id: string, u: Partial<DocumentStatus>) => void
}) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 text-xs text-slate-500 leading-relaxed">
        Upload documents for each item your team confirmed in the Assign step. You can upload in batches — progress is saved automatically. Assigned team members have been notified by email.
      </div>
      {categories.map(cat => {
        const docsToShow = cat.documents.filter(d => {
          const s = getStatus(d.id)
          return s.hasDoc !== false && !s.notApplicable // show docs they said yes to or unanswered
        })
        if (docsToShow.length === 0) return null
        return (
          <div key={cat.id} className="bg-white rounded-2xl border border-slate-200">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-700">{cat.title}</h4>
              <span className="text-xs text-slate-400">
                {docsToShow.filter(d => getStatus(d.id).fileName).length}/{docsToShow.length} uploaded
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
                        onUploaded={(fileName) => setStatus(doc.id, { fileName, uploadedAt: new Date().toISOString() })}
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
          </div>
        )
      })}
    </div>
  )
}

// ── Additional Requirements (client view) ─────────────────────────────────────
function RequirementsClientTab({ requirements }: { requirements: AdditionalRequirement[] }) {
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
    <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-400">
      <Map className="w-10 h-10 text-slate-200 mx-auto mb-4" />
      <p className="font-medium text-slate-600 mb-2">Your Roadmap</p>
      <p className="text-xs leading-relaxed max-w-sm mx-auto">
        Your sale readiness roadmap and action plan will appear here once your advisor team has completed their initial review of your documents.
      </p>
    </div>
  )
}
