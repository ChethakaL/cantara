'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, FileText, MessageSquare, AlertCircle, Settings,
  Landmark, Briefcase, FileSpreadsheet, Globe2,
  ChevronDown, Bot, Users2, Calculator, Sparkles, Camera, TrendingUp, MapPin,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import AdminNav from '@/components/admin/AdminNav'
import LeaseAnalysisTab from '@/components/admin/LeaseAnalysis'
import ContractAnalysisTab from '@/components/admin/ContractAnalysis'
import AdminChat from '@/components/admin/AdminChat'
import AdditionalRequirementsAdmin from '@/components/admin/AdditionalRequirements'
import ClientManager from '@/components/admin/ClientManager'
import AdminDocumentsView from '@/components/admin/AdminDocuments'
import SalesProcessReviewTab from '@/components/sales-review/SalesProcessReviewTab'
// Meeting notes agent is temporarily hidden from the client agents dropdown.
// Keep the component code in place so it can be restored later.
// import MeetingNotesTab from '@/components/meeting-notes/MeetingNotesTab'
import { TtmAnalysisTab } from '@/components/ttm-agent/TtmAnalysisTab'
import DigitalPresenceTab from '@/components/digital-presence/DigitalPresenceTab'
import CompetitorAnalysisTab from '@/components/competitor-analysis/CompetitorAnalysisTab'
import InsuranceReviewTab from '@/components/admin/InsuranceReviewTab'
import EmployeeObligationsTab from '@/components/ws1-6/EmployeeObligationsTab'
import NetProceedsCalculator from '@/components/net-proceeds/NetProceedsCalculator'
import TeaserGeneratorTab from '@/components/teaser/TeaserGeneratorTab'
import CimGeneratorTab from '@/components/cim/CimGeneratorTab'
import ProfessionalAdvisorsTab from '@/components/advisors/ProfessionalAdvisorsTab'
import VendorDirectoryTab from '@/components/vendor-directory/VendorDirectoryTab'
import OrgChartReviewTab from '@/components/org-chart/OrgChartReviewTab'
import LitigationSearchTab from '@/components/litigation-search/LitigationSearchTab'
import EmployeeCompTab from '@/components/employee-comp/EmployeeCompTab'
import FacilityReviewTab from '@/components/facility-review/FacilityReviewTab'
import OwnershipVerificationTab from '@/components/ws1-8/OwnershipVerificationTab'
import PricingAnalysisTab from '@/components/pricing-analysis/PricingAnalysisTab'
import PricingByVerticalTab from '@/components/pricing-vertical/PricingByVerticalTab'
import PermitsZoningTab from '@/components/ws1-9/PermitsZoningTab'
import OwnerGmAssessmentTab from '@/components/owner-gm-assessment/OwnerGmAssessmentTab'
import AgentOverviewTab from '@/components/admin/AgentOverviewTab'
import AgentRunsTab from '@/components/admin/AgentRunsTab'
import LegalEntitySearchTab from '@/components/legal-entity-search/LegalEntitySearchTab'
import TaxLiabilityReviewTab from '@/components/tax-liability-review/TaxLiabilityReviewTab'
import AssessmentReportTab from '@/components/assessment-report/AssessmentReportTab'
import ImprovementRoadmapTab from '@/components/improvement-roadmap/ImprovementRoadmapTab'
import BuyerReportTab from '@/components/buyer-report/BuyerReportTab'
import OccupancyReviewTab from '@/components/occupancy-review/OccupancyReviewTab'
import LoiReviewTab from '@/components/loi-review/LoiReviewTab'
import ClientLocationMapTab from '@/components/client-location-map/ClientLocationMapTab'
import AdminRequiredInfoTab from '@/components/admin/AdminRequiredInfoTab'
import { Badge, WorkstreamBadge, Card, GoldLine, cn } from '@/components/ui'
import { getClient, getAdminName, getCurrentRole } from '@/lib/store'
import type { Client } from '@/lib/store'
import { useChatUnread } from '@/hooks/useChatUnread'
import { getClientWorkstreamAgents, normalizeAgentStatusKey } from '@/lib/workstream-agents'

// ── Tab definitions ──────────────────────────────────────────────────────────

const AGENT_TABS = [
  // Valuation
  { key: 'ttm', label: 'Valuation Agent', badge: '6 Agents' as const, icon: FileSpreadsheet, group: 'Valuation' },
  // WS1 — Risk & Legal
  { key: 'employee-obligations', label: 'Employee Obligations', badge: null, icon: Users2, group: 'WS1 — Risk & Legal' },
  { key: 'employee-comp', label: 'Employee Staffing & Compensation', badge: null, icon: Users2, group: 'WS1 — Risk & Legal' },
  { key: 'insurance', label: 'Insurance Review', badge: null, icon: FileText, group: 'WS1 — Risk & Legal' },
  { key: 'lease', label: 'Lease Analysis', badge: null, icon: Landmark, group: 'WS1 — Risk & Legal' },
  { key: 'litigation', label: 'Litigation & Liens', badge: null, icon: AlertCircle, group: 'WS1 — Risk & Legal' },
  { key: 'contract', label: 'Material Contracts', badge: null, icon: Briefcase, group: 'WS1 — Risk & Legal' },
  { key: 'org-chart', label: 'Org Chart Review', badge: null, icon: Users2, group: 'WS1 — Risk & Legal' },
  { key: 'owner-gm-assessment', label: 'Owner & GM Assessment', badge: null, icon: Users2, group: 'WS1 — Risk & Legal' },
  { key: 'ownership-verification', label: 'Ownership Verification', badge: null, icon: Landmark, group: 'WS1 — Risk & Legal' },
  { key: 'permits-zoning', label: 'Permits & Zoning', badge: null, icon: FileText, group: 'WS1 — Risk & Legal' },
  { key: 'advisors', label: 'Professional Advisors', badge: null, icon: Users2, group: 'WS1 — Risk & Legal' },
  { key: 'vendor-directory', label: 'Software & Vendors', badge: null, icon: FileText, group: 'WS1 — Risk & Legal' },
  { key: 'legal-entity-search', label: 'Legal Reports & Entity Search', badge: null, icon: Landmark, group: 'WS1 — Risk & Legal' },
  { key: 'tax-liability-review', label: 'Tax Liability Review', badge: null, icon: FileSpreadsheet, group: 'WS1 — Risk & Legal' },
  // WS2 — Performance
  { key: 'competitor', label: 'Competitor Analysis', badge: null, icon: Bot, group: 'WS2 — Performance' },
  { key: 'client-location-map', label: 'Client Location Map', badge: null, icon: MapPin, group: 'WS2 — Performance' },
  { key: 'pricing-analysis', label: 'Competitive Pricing Analysis', badge: null, icon: FileText, group: 'WS2 — Performance' },
  { key: 'digital', label: 'Digital Presence', badge: null, icon: Globe2, group: 'WS2 — Performance' },
  { key: 'facility-review', label: 'Facility Review Agent', badge: null, icon: Camera, group: 'WS2 — Performance' },
  { key: 'occupancy-review', label: 'Occupancy Review', badge: null, icon: TrendingUp, group: 'WS2 — Performance' },
  { key: 'pricing-vertical', label: 'Pricing by Vertical', badge: null, icon: FileText, group: 'WS2 — Performance' },
  { key: 'sales-process-review', label: 'Sales Process Review', badge: null, icon: FileText, group: 'WS2 — Performance' },
  // Reports & Roadmaps
  { key: 'ws1-assessment', label: 'WS1 Internal Assessment', badge: null, icon: FileText, group: 'Reports & Roadmaps' },
  { key: 'ws1-roadmap', label: 'WS1 Sales Readiness Roadmap', badge: null, icon: FileText, group: 'Reports & Roadmaps' },
  { key: 'ws1-buyer-report', label: 'WS1 Buyer Report', badge: null, icon: FileText, group: 'Reports & Roadmaps' },
  { key: 'ws2-assessment', label: 'WS2 Internal Assessment', badge: null, icon: FileText, group: 'Reports & Roadmaps' },
  { key: 'ws2-roadmap', label: 'WS2 Sales Readiness Roadmap', badge: null, icon: FileText, group: 'Reports & Roadmaps' },
  { key: 'ws2-buyer-report', label: 'WS2 Buyer Report', badge: null, icon: FileText, group: 'Reports & Roadmaps' },
  // Temporarily hidden per product direction. Do not delete; re-enable when the meeting notes agent is needed again.
  // { key: 'meeting-notes', label: 'Meeting Notes Agent', badge: null, icon: MessageSquare, group: 'WS2 — Performance' },
  // M&A
  { key: 'cim', label: 'CIM Generator', badge: null, icon: FileText, group: 'M&A Sale Process' },
  { key: 'teaser', label: 'Deal Teaser Generator', badge: null, icon: Sparkles, group: 'M&A Sale Process' },
  { key: 'loi-review', label: 'LOI Review & Comparison', badge: null, icon: FileText, group: 'M&A Sale Process' },
  { key: 'net-proceeds', label: 'Net Proceeds Calculator', badge: null, icon: Calculator, group: 'M&A Sale Process' },
] as const

type AgentKey = typeof AGENT_TABS[number]['key']

const STANDARD_TABS = [
  { key: 'manage', label: 'Client Management', icon: Settings },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'required-info', label: 'Required Info', icon: FileText },
  { key: 'agent-runs', label: 'Agent Status', icon: Bot },
  { key: 'requirements', label: 'Additional Requirements', icon: AlertCircle },
  { key: 'messages', label: 'Messages', icon: MessageSquare },
  { key: 'agent-overview', label: 'Agent Overview', icon: FileText },
] as const

type TabKey = typeof STANDARD_TABS[number]['key'] | AgentKey

const TAB_AGENT_APPROVAL_KEYS: Partial<Record<TabKey, string>> = {
  ttm: 'ttmAnalysis',
  lease: 'lease',
  'employee-obligations': 'employeeObligations',
  contract: 'contract',
  digital: 'digitalPresence',
  competitor: 'competitor',
  'facility-review': 'facilityReview',
  insurance: 'insuranceReview',
  advisors: 'professionalAdvisors',
  'vendor-directory': 'vendorDirectory',
  'org-chart': 'orgChart',
  litigation: 'litigationSearch',
  'employee-comp': 'employeeComp',
  'ownership-verification': 'ownershipVerification',
  'permits-zoning': 'permitsZoning',
  'owner-gm-assessment': 'ownerGmAssessment',
  'client-location-map': 'clientLocationMap',
  'pricing-analysis': 'pricingAnalysis',
  'pricing-vertical': 'pricingVertical',
  'sales-process-review': 'salesProcessReview',
  'legal-entity-search': 'legalEntitySearch',
  'tax-liability-review': 'taxLiabilityReview',
  'ws1-assessment': 'ws1Assessment',
  'ws2-assessment': 'ws2Assessment',
  'ws1-roadmap': 'ws1Roadmap',
  'ws2-roadmap': 'ws2Roadmap',
  'net-proceeds': 'net_proceeds',
  teaser: 'teaser',
  cim: 'cim',
}

function isApprovedForReview(client: Client, tab: TabKey): boolean {
  const key = TAB_AGENT_APPROVAL_KEYS[tab]
  if (!key) return false
  const submissions = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object'
    ? client.sectionSubmissions
    : {}) as Record<string, unknown>
  const approvals = (submissions.agentApprovals && typeof submissions.agentApprovals === 'object'
    ? submissions.agentApprovals
    : {}) as Record<string, unknown>
  const entry = (approvals[key] ?? approvals[normalizeAgentStatusKey(key)]) as { status?: string } | undefined
  return entry?.status === 'approved'
}

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
    function handleScroll(e: Event) {
      const panel = document.getElementById('agents-dropdown-panel')
      if (panel?.contains(e.target as Node)) return
      setOpen(false)
    }
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
        className="bg-white border border-slate-200 rounded-xl shadow-xl overflow-y-auto min-w-[220px] max-h-[70vh]"
      >
        {(() => {
          let lastGroup = ''
          return AGENT_TABS.map(agent => {
            const Icon = agent.icon
            const isActive = activeTab === agent.key
            const showHeader = agent.group !== lastGroup
            lastGroup = agent.group
            return (
              <div key={agent.key}>
                {showHeader && (
                  <div className="px-3 pt-3 pb-1 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                    {agent.group}
                  </div>
                )}
                <button
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
              </div>
            )
          })
        })()}
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
        <span>{isAgentActive && activeAgent ? `Agents: ${activeAgent.label}` : 'Agents'}</span>
        {isAgentActive && activeAgent && (
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [agentChecks, setAgentChecks] = useState<Record<string, boolean>>({})
  const [agentApprovalLocks, setAgentApprovalLocks] = useState<Record<string, boolean>>({})
  const [overviewAutoGeneratedFor, setOverviewAutoGeneratedFor] = useState<string | null>(null)
  const [overviewTooltipRect, setOverviewTooltipRect] = useState<DOMRect | null>(null)
  const adminName = getAdminName()
  const { count: messageUnread } = useChatUnread(id, 'admin')
  const activeApprovalKey = TAB_AGENT_APPROVAL_KEYS[activeTab]
  const activeAgentReadOnly = client
    ? isApprovedForReview(client, activeTab) || Boolean(activeApprovalKey && agentApprovalLocks[activeApprovalKey])
    : false

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

  useEffect(() => {
    if (!client) return
    let cancelled = false
    const loadChecks = async () => {
      try {
        const res = await fetch(`/api/agent-status?clientId=${encodeURIComponent(client.id)}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setAgentChecks(data)
      } catch {
        if (!cancelled) setAgentChecks({})
      }
    }
    void loadChecks()
    const timer = setInterval(() => void loadChecks(), 10000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [client?.id])

  useEffect(() => {
    if (!client) return
    let cancelled = false
    const loadApprovalLocks = async () => {
      try {
        const res = await fetch(`/api/agent-runs?clientId=${encodeURIComponent(client.id)}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const locks: Record<string, boolean> = {}
        for (const run of (data.runs ?? []) as Array<{ agentId: string; agentKey: string; status: string }>) {
          if (run.status !== 'approved') continue
          locks[run.agentId] = true
          locks[run.agentKey] = true
        }
        if (!cancelled) setAgentApprovalLocks(locks)
      } catch {
        if (!cancelled) setAgentApprovalLocks({})
      }
    }
    void loadApprovalLocks()
    const timer = setInterval(() => void loadApprovalLocks(), 5000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [client?.id])

  useEffect(() => {
    if (!client) return
    const agents = getClientWorkstreamAgents(client)
    const ready = agents.length > 0 && agents.every(agent => agentChecks[normalizeAgentStatusKey(agent.agentId)])
    if (!ready) return
    const key = `${client.id}:${client.customWorkstreamId || client.workstream || 'unassigned'}`
    if (overviewAutoGeneratedFor === key) return
    setOverviewAutoGeneratedFor(key)

    const ensureOverviewReport = async () => {
      try {
        const existing = await fetch(`/api/agent-overview?clientId=${encodeURIComponent(client.id)}`, { cache: 'no-store' })
        if (!existing.ok) return
        const state = await existing.json()
        if (state.report) return
        await fetch('/api/agent-overview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: client.id, generatedBy: adminName }),
        })
      } catch {
        // Admin can still generate manually from the Agent Overview tab.
      }
    }

    void ensureOverviewReport()
  }, [client, agentChecks, overviewAutoGeneratedFor, adminName])

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
  const overviewAgents = getClientWorkstreamAgents(client)
  const incompleteOverviewAgents = overviewAgents.filter(agent => !agentChecks[normalizeAgentStatusKey(agent.agentId)])
  const overviewReady = overviewAgents.length > 0 && incompleteOverviewAgents.length === 0
  const overviewTooltip = overviewTooltipRect && !overviewReady ? createPortal(
    <div
      style={{
        position: 'fixed',
        top: overviewTooltipRect.bottom + 8,
        left: Math.min(overviewTooltipRect.left, Math.max(16, window.innerWidth - 336)),
        zIndex: 10000,
      }}
      className="w-80 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 shadow-xl"
    >
      <p className="font-semibold text-slate-800">All agents in this workstream must be completed.</p>
      <p className="mt-2 font-medium text-slate-500">Not completed yet:</p>
      <ul className="mt-1 space-y-1">
        {incompleteOverviewAgents.map(agent => (
          <li key={agent.agentId} className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>{agent.agentName}</span>
          </li>
        ))}
      </ul>
    </div>,
    document.body,
  ) : null

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
              const locked = tab.key === 'agent-overview' && !overviewReady
              const tabUnread = tab.key === 'messages' ? messageUnread : 0
              return (
                <div
                  key={tab.key}
                  onMouseEnter={(event) => { if (locked) setOverviewTooltipRect(event.currentTarget.getBoundingClientRect()) }}
                  onMouseLeave={() => { if (locked) setOverviewTooltipRect(null) }}
                  className="relative flex"
                >
                  <button
                    onClick={() => { if (!locked) setActiveTab(tab.key) }}
                    aria-disabled={locked}
                    className={cn(
                      'flex items-center gap-2 px-5 py-3.5 text-xs font-medium tracking-wide border-b-2 -mb-px whitespace-nowrap transition-all',
                      locked && 'cursor-not-allowed text-slate-300 border-transparent',
                      !locked && (active ? 'text-slate-900 border-amber-500' : 'text-slate-400 border-transparent hover:text-slate-600')
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                    {tabUnread > 0 && (
                      <span
                        className="inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                        style={{ background: '#ef4444' }}
                      >
                        {tabUnread}
                      </span>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
          {overviewTooltip}

          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="p-6"
          >
            {activeTab === 'manage' && (
              <ClientManager
                client={client}
                onSaved={setClient}
                onDeleted={() => router.push('/admin')}
                onDeleteError={message => setToast({ message, type: 'error' })}
              />
            )}
            {activeTab === 'documents' && <AdminDocumentsView client={client} onClientUpdated={setClient} />}
            {activeTab === 'required-info' && (
              <AdminRequiredInfoTab client={client} setClient={setClient} />
            )}
            {activeTab === 'agent-runs' && (
              <AgentRunsTab
                clientId={client.id}
                onOpenAgent={tabKey => setActiveTab(tabKey as TabKey)}
              />
            )}
            {activeTab === 'ttm' && (
              <TtmAnalysisTab
                clientId={client.id}
                clientName={client.name}
                adminName={adminName}
                documentStatuses={client.documentStatuses}
                readOnly={activeAgentReadOnly}
              />
            )}
            {activeTab === 'lease' && (
              <LeaseAnalysisTab clientId={client.id} clientName={client.name} readOnly={activeAgentReadOnly} />
            )}
            {activeTab === 'employee-obligations' && (
              <EmployeeObligationsTab
                clientId={client.id}
                clientName={client.company || client.name}
                state={client.state || 'Unknown'}
                dba={client.dba || undefined}
                totalEmployeesSelfReported={client.totalEmployeesSelfReported ?? undefined}
                employmentTypeBreakdown={client.employmentTypeBreakdown ?? undefined}
                readOnly={activeAgentReadOnly}
              />
            )}
            {activeTab === 'contract' && (
              <ContractAnalysisTab clientId={client.id} clientName={client.name} readOnly={activeAgentReadOnly} />
            )}
            {activeTab === 'digital' && (
              <DigitalPresenceTab clientId={client.id} clientName={client.company || client.name} clientWebsite={client.websiteUrl} readOnly={activeAgentReadOnly} />
            )}
            {activeTab === 'competitor' && (
              <CompetitorAnalysisTab
                clientId={client.id}
                businessName={client.company || client.name}
                businessAddress={client.businessAddress}
                businessCategory={client.businessCategory}
                websiteUrl={client.websiteUrl}
                readOnly={activeAgentReadOnly}
              />
            )}
            {activeTab === 'facility-review' && (
              <FacilityReviewTab
                clientId={client.id}
                clientName={client.company || client.name}
                businessAddress={client.businessAddress}
                readOnly={activeAgentReadOnly}
              />
            )}
            {activeTab === 'insurance' && (
              <InsuranceReviewTab clientId={client.id} clientName={client.company || client.name} readOnly={activeAgentReadOnly} />
            )}
            {activeTab === 'advisors' && (
              <ProfessionalAdvisorsTab clientId={client.id} clientName={client.company || client.name} readOnly={activeAgentReadOnly} />
            )}
            {activeTab === 'vendor-directory' && (
              <VendorDirectoryTab clientId={client.id} clientName={client.company || client.name} readOnly={activeAgentReadOnly} />
            )}
            {activeTab === 'org-chart' && (
              <OrgChartReviewTab clientId={client.id} clientName={client.company || client.name} readOnly={activeAgentReadOnly} />
            )}
            {activeTab === 'litigation' && (
              <LitigationSearchTab clientId={client.id} clientName={client.company || client.name} businessAddress={client.businessAddress} readOnly={activeAgentReadOnly} />
            )}
            {activeTab === 'employee-comp' && (
              <EmployeeCompTab clientId={client.id} clientName={client.company || client.name} readOnly={activeAgentReadOnly} />
            )}
            {activeTab === 'ownership-verification' && (
              <OwnershipVerificationTab clientId={client.id} clientName={client.company || client.name} readOnly={activeAgentReadOnly} />
            )}
            {activeTab === 'permits-zoning' && (
              <PermitsZoningTab clientId={client.id} clientName={client.company || client.name} readOnly={activeAgentReadOnly} />
            )}
            {activeTab === 'owner-gm-assessment' && (
              <OwnerGmAssessmentTab clientId={client.id} clientName={client.company || client.name} readOnly={activeAgentReadOnly} />
            )}
            {activeTab === 'occupancy-review' && (
              <OccupancyReviewTab clientId={client.id} clientName={client.company || client.name} readOnly={activeAgentReadOnly} />
            )}
            {activeTab === 'client-location-map' && (
              <ClientLocationMapTab clientId={client.id} clientName={client.company || client.name} businessAddress={client.businessAddress || ''} readOnly={activeAgentReadOnly} />
            )}
            {activeTab === 'pricing-analysis' && (
              <PricingAnalysisTab clientId={client.id} clientName={client.company || client.name} readOnly={activeAgentReadOnly} />
            )}
            {activeTab === 'pricing-vertical' && (
              <PricingByVerticalTab clientId={client.id} clientName={client.company || client.name} readOnly={activeAgentReadOnly} />
            )}
            {activeTab === 'sales-process-review' && (
              <SalesProcessReviewTab clientId={client.id} clientName={client.name} readOnly={activeAgentReadOnly} />
            )}
            {activeTab === 'legal-entity-search' && (
              <LegalEntitySearchTab
                clientId={client.id}
                clientName={client.company || client.name}
                state={client.state}
                dba={client.dba || undefined}
                businessAddress={client.businessAddress}
                readOnly={activeAgentReadOnly}
              />
            )}
            {activeTab === 'tax-liability-review' && (
              <TaxLiabilityReviewTab
                clientId={client.id}
                clientName={client.company || client.name}
                state={client.state}
                readOnly={activeAgentReadOnly}
              />
            )}
            {activeTab === 'ws1-assessment' && (
              <AssessmentReportTab clientId={client.id} clientName={client.company || client.name} workstream="ws1" readOnly={activeAgentReadOnly} />
            )}
            {activeTab === 'ws2-assessment' && (
              <AssessmentReportTab clientId={client.id} clientName={client.company || client.name} workstream="ws2" readOnly={activeAgentReadOnly} />
            )}
            {activeTab === 'ws1-roadmap' && (
              <ImprovementRoadmapTab clientId={client.id} clientName={client.company || client.name} workstream="ws1" readOnly={activeAgentReadOnly} />
            )}
            {activeTab === 'ws2-roadmap' && (
              <ImprovementRoadmapTab clientId={client.id} clientName={client.company || client.name} workstream="ws2" readOnly={activeAgentReadOnly} />
            )}
            {activeTab === 'ws1-buyer-report' && (
              <BuyerReportTab clientId={client.id} clientName={client.company || client.name} workstream="ws1" />
            )}
            {activeTab === 'ws2-buyer-report' && (
              <BuyerReportTab clientId={client.id} clientName={client.company || client.name} workstream="ws2" />
            )}
            {/* Temporarily hidden per product direction. Do not delete; re-enable when the meeting notes agent is needed again. */}
            {/* {activeTab === 'meeting-notes' && (
              <MeetingNotesTab clientId={client.id} clientName={client.name} />
            )} */}
            {activeTab === 'net-proceeds' && (
              <NetProceedsCalculator clientId={client.id} clientName={client.name} readOnly={activeAgentReadOnly} />
            )}
            {activeTab === 'teaser' && (
              <TeaserGeneratorTab clientId={client.id} clientName={client.name} readOnly={activeAgentReadOnly} />
            )}
            {activeTab === 'cim' && (
              <CimGeneratorTab clientId={client.id} clientName={client.name} readOnly={activeAgentReadOnly} />
            )}
            {activeTab === 'loi-review' && (
              <LoiReviewTab clientId={client.id} clientName={client.name} />
            )}
            {activeTab === 'requirements' && (
              <AdditionalRequirementsAdmin clientId={client.id} />
            )}
            {activeTab === 'messages' && (
              <AdminChat clientId={client.id} clientName={client.name} adminName={adminName} />
            )}
            {activeTab === 'agent-overview' && (
              <AgentOverviewTab clientId={client.id} clientName={client.company || client.name} adminName={adminName} />
            )}
          </motion.div>
        </Card>
      </main>

      {toast && (
        <div
          className={`fixed bottom-8 right-8 z-[100] px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 max-w-md ${
            toast.type === 'success'
              ? 'bg-stone-900 text-white border-stone-800'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          <div className={`w-2 h-2 rounded-full shrink-0 ${toast.type === 'success' ? 'bg-amber-400' : 'bg-red-500'}`} />
          <p className="text-sm font-medium">{toast.message}</p>
          <button type="button" onClick={() => setToast(null)} className="ml-2 opacity-50 hover:opacity-100 shrink-0">×</button>
        </div>
      )}
    </div>
  )
}
