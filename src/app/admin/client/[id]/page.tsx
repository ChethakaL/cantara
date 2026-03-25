'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, FileText, MessageSquare, AlertCircle, Settings,
  Landmark, Briefcase, CalendarDays, FileSpreadsheet, Globe2,
  ChevronDown, Bot,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import AdminNav from '@/components/admin/AdminNav'
import LeaseAnalysisTab from '@/components/admin/LeaseAnalysis'
import ContractAnalysisTab from '@/components/admin/ContractAnalysis'
import AdminChat from '@/components/admin/AdminChat'
import AdditionalRequirementsAdmin from '@/components/admin/AdditionalRequirements'
import ClientManager from '@/components/admin/ClientManager'
import AdminDocumentsView from '@/components/admin/AdminDocuments'
import MeetingsTab from '@/components/admin/MeetingsTab'
import { TtmAnalysisTab } from '@/components/ttm-agent/TtmAnalysisTab'
import DigitalPresenceTab from '@/components/digital-presence/DigitalPresenceTab'
import InsuranceReviewTab from '@/components/admin/InsuranceReviewTab'
import { Badge, WorkstreamBadge, Card, GoldLine, cn } from '@/components/ui'
import { getClient, getAdminName, getCurrentRole } from '@/lib/store'
import type { Client } from '@/lib/store'

// ── Tab definitions ──────────────────────────────────────────────────────────

const AGENT_TABS = [
  {
    key: 'ttm',
    label: 'Valuation Agent',
    badge: '5 Agents',
    icon: FileSpreadsheet,
  },
  {
    key: 'lease',
    label: 'Lease Analysis',
    badge: null,
    icon: Landmark,
  },
  {
    key: 'contract',
    label: 'Contract Analysis',
    badge: null,
    icon: Briefcase,
  },
  {
    key: 'digital',
    label: 'Digital Presence',
    badge: null,
    icon: Globe2,
  },
  {
    key: 'insurance',
    label: 'Insurance Review Agent',
    badge: null,
    icon: FileText,
  },
] as const

type AgentKey = typeof AGENT_TABS[number]['key']

const STANDARD_TABS = [
  { key: 'manage', label: 'Client Management', icon: Settings },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'meetings', label: 'Meetings', icon: CalendarDays },
  { key: 'requirements', label: 'Additional Requirements', icon: AlertCircle },
  { key: 'messages', label: 'Messages', icon: MessageSquare },
] as const

type TabKey = typeof STANDARD_TABS[number]['key'] | AgentKey

// ── Agents dropdown ──────────────────────────────────────────────────────────
// Rendered into a portal so it escapes the overflow-x-auto tab scroll container.

function AgentsDropdown({
  activeTab,
  onSelect,
}: {
  activeTab: TabKey
  onSelect: (key: AgentKey) => void
}) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [mounted, setMounted] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const isAgentActive = AGENT_TABS.some(t => t.key === activeTab)
  const activeAgent = AGENT_TABS.find(t => t.key === activeTab)

  useEffect(() => { setMounted(true) }, [])

  const openDropdown = useCallback(() => {
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect())
    setOpen(o => !o)
  }, [])

  useEffect(() => {
    if (!open) return
    function handleOutside(e: MouseEvent) {
      const target = e.target as Node
      if (btnRef.current?.contains(target)) return
      const panel = document.getElementById('agents-dropdown-panel')
      if (panel?.contains(target)) return
      setOpen(false)
    }
    function handleScroll() { setOpen(false) }
    document.addEventListener('mousedown', handleOutside)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [open])

  const dropdown = open && rect && mounted ? createPortal(
    <AnimatePresence>
      <motion.div
        id="agents-dropdown-panel"
        key="agents-panel"
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.15 }}
        style={{
          position: 'fixed',
          top: rect.bottom + 4,
          left: rect.left,
          zIndex: 9999,
        }}
        className="bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden min-w-[220px]"
      >
        <div className="px-3 pt-2.5 pb-1">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            {AGENT_TABS.length} Agents
          </p>
        </div>
        {AGENT_TABS.map(agent => {
          const Icon = agent.icon
          const isActive = activeTab === agent.key
          return (
            <button
              key={agent.key}
              onClick={() => { onSelect(agent.key); setOpen(false) }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2.5 text-xs transition-colors',
                isActive
                  ? 'bg-amber-50 text-amber-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50'
              )}
            >
              <Icon className={cn('w-3.5 h-3.5 flex-shrink-0', isActive ? 'text-amber-500' : 'text-slate-400')} />
              <span className="flex-1 text-left">{agent.label}</span>
              {agent.badge && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#b8922a,#d4a843)', color: '#fff' }}
                >
                  {agent.badge}
                </span>
              )}
            </button>
          )
        })}
      </motion.div>
    </AnimatePresence>,
    document.body
  ) : null

  return (
    <>
      <button
        ref={btnRef}
        onClick={openDropdown}
        className={cn(
          'flex items-center gap-2 px-4 py-3.5 text-xs font-medium tracking-wide border-b-2 -mb-px whitespace-nowrap transition-all',
          isAgentActive
            ? 'text-slate-900 border-amber-500'
            : 'text-slate-400 border-transparent hover:text-slate-600'
        )}
      >
        <Bot className="w-3.5 h-3.5" />
        <span>Agents</span>
        {isAgentActive && activeAgent && (
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: 'linear-gradient(135deg,#b8922a,#d4a843)', color: '#fff' }}
          >
            {activeAgent.label}
          </span>
        )}
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>
      {dropdown}
    </>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ClientDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const [client, setClient] = useState<Client | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('manage')
  const adminName = getAdminName()

  useEffect(() => {
    if (getCurrentRole() !== 'admin') { router.push('/login/admin'); return }
    const load = async () => {
      const c = await getClient(id)
      if (!c) { router.push('/admin'); return }
      setClient(c)
    }
    load()
  }, [id])

  useEffect(() => {
    if (!client) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const poll = async () => {
      const startedAt = Date.now()
      try {
        const refreshed = await getClient(id)
        if (!cancelled && refreshed) setClient(refreshed)
      } finally {
        if (cancelled) return
        // Avoid overlapping polls: schedule next run only after this one completes.
        const elapsed = Date.now() - startedAt
        const delay = Math.max(4000, 8000 - elapsed)
        timer = setTimeout(() => {
          void poll()
        }, delay)
      }
    }

    timer = setTimeout(() => {
      void poll()
    }, 4000)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [id, client])

  if (!client) {
    return (
      <div className="min-h-screen" style={{ background: '#0d1829' }}>
        <div className="flex items-center justify-center h-screen">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  const stageColors: Record<string, string> = {
    onboarding: 'slate', collection: 'gold', review: 'blue', final: 'green', closed: 'slate',
  }

  const submitted = Object.values(client.documentStatuses).filter(s => s.fileName).length

  return (
    <div className="min-h-screen" style={{ background: 'hsl(220,18%,96%)' }}>
      <AdminNav name={adminName} />

      {/* Subheader */}
      <div style={{ background: '#0d1829', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => router.push('/admin')}
            className="flex items-center gap-2 text-white/40 hover:text-white/80 text-xs transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> All Clients
          </button>
          <div className="w-px h-3 bg-white/15" />
          <div className="flex-1">
            <span className="text-white/80 text-sm cantara-serif">{client.name}</span>
            <span className="text-white/30 ml-3 text-xs">{client.company}</span>
          </div>
          <WorkstreamBadge ws={client.workstream} />
          <Badge color={stageColors[client.stage] as 'slate' | 'gold' | 'blue' | 'green' | 'red'}>
            {client.stage.charAt(0).toUpperCase() + client.stage.slice(1)}
          </Badge>
        </div>
        <GoldLine />
      </div>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
        >
          {[
            { label: 'Workstream', value: client.workstream ? client.workstream.toUpperCase() : '—', sub: 'assigned' },
            { label: 'Documents', value: submitted, sub: 'submitted' },
            { label: 'Team Members', value: client.teamMembers.length, sub: 'invited' },
            { label: 'Last Login', value: client.lastLogin ? new Date(client.lastLogin).toLocaleDateString() : 'Never', sub: 'client login' },
          ].map(s => (
            <Card key={s.label} className="p-4 text-center">
              <p className="text-xl font-bold text-slate-800">{s.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.sub}</p>
              <p className="text-xs font-semibold text-slate-500 mt-2 uppercase tracking-wide" style={{ fontSize: '0.6rem' }}>{s.label}</p>
            </Card>
          ))}
        </motion.div>

        {/* Tab navigation */}
        <Card className="mb-6">
          <div className="flex overflow-x-auto hide-scrollbar border-b border-slate-100">
            {/* Standard tabs */}
            {STANDARD_TABS.slice(0, 3).map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex items-center gap-2 px-5 py-3.5 text-xs font-medium tracking-wide border-b-2 -mb-px whitespace-nowrap transition-all',
                    active ? 'text-slate-900 border-amber-500' : 'text-slate-400 border-transparent hover:text-slate-600'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              )
            })}

            {/* Agents dropdown */}
            <AgentsDropdown
              activeTab={activeTab}
              onSelect={key => setActiveTab(key)}
            />

            {/* Remaining standard tabs */}
            {STANDARD_TABS.slice(3).map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex items-center gap-2 px-5 py-3.5 text-xs font-medium tracking-wide border-b-2 -mb-px whitespace-nowrap transition-all',
                    active ? 'text-slate-900 border-amber-500' : 'text-slate-400 border-transparent hover:text-slate-600'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="p-6"
          >
            {activeTab === 'manage' && <ClientManager client={client} onSaved={setClient} />}
            {activeTab === 'documents' && <AdminDocumentsView client={client} />}
            {activeTab === 'meetings' && <MeetingsTab clientName={client.name} />}
            {activeTab === 'ttm' && (
              <TtmAnalysisTab
                clientId={client.id}
                clientName={client.name}
                adminName={adminName}
                documentStatuses={client.documentStatuses}
              />
            )}
            {activeTab === 'lease' && (
              <LeaseAnalysisTab clientId={client.id} clientName={client.name} />
            )}
            {activeTab === 'contract' && (
              <ContractAnalysisTab clientId={client.id} clientName={client.name} />
            )}
            {activeTab === 'digital' && (
              <DigitalPresenceTab clientId={client.id} clientName={client.name} />
            )}
            {activeTab === 'insurance' && (
              <InsuranceReviewTab clientId={client.id} />
            )}
            {activeTab === 'requirements' && (
              <AdditionalRequirementsAdmin clientId={client.id} />
            )}
            {activeTab === 'messages' && (
              <AdminChat clientId={client.id} clientName={client.name} adminName={adminName} />
            )}
          </motion.div>
        </Card>
      </main>
    </div>
  )
}
