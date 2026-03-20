'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { use } from 'react'
import { ArrowLeft, FileText, MessageSquare, AlertCircle, Settings, Landmark, Briefcase, CalendarDays, FileSpreadsheet } from 'lucide-react'
import { motion } from 'framer-motion'
import AdminNav from '@/components/admin/AdminNav'
import LeaseAnalysisTab from '@/components/admin/LeaseAnalysis'
import ContractAnalysisTab from '@/components/admin/ContractAnalysis'
import AdminChat from '@/components/admin/AdminChat'
import AdditionalRequirementsAdmin from '@/components/admin/AdditionalRequirements'
import ClientManager from '@/components/admin/ClientManager'
import AdminDocumentsView from '@/components/admin/AdminDocuments'
import MeetingsTab from '@/components/admin/MeetingsTab'
import { TtmAnalysisTab } from '@/components/ttm-agent/TtmAnalysisTab'
import { Badge, WorkstreamBadge, ProgressBar, GoldLine, Card } from '@/components/ui'
import { getClient, getAdminName, getCurrentRole } from '@/lib/store'
import type { Client } from '@/lib/store'

const TABS = [
  { key: 'manage', label: 'Client Management', icon: Settings },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'meetings', label: 'Meetings', icon: CalendarDays },
  // { key: 'ttm', label: 'TTM Analysis', icon: FileSpreadsheet },
  { key: 'lease', label: 'Lease Analysis', icon: Landmark },
  { key: 'contract', label: 'Contract Analysis', icon: Briefcase },
  { key: 'requirements', label: 'Additional Requirements', icon: AlertCircle },
  { key: 'messages', label: 'Messages', icon: MessageSquare },
]

export default function ClientDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const [client, setClient] = useState<Client | null>(null)
  const [activeTab, setActiveTab] = useState('manage')
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
    const interval = setInterval(async () => {
      const refreshed = await getClient(id)
      if (refreshed) setClient(refreshed)
    }, 3000)
    return () => clearInterval(interval)
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
    onboarding: 'slate',
    collection: 'gold',
    review: 'blue',
    final: 'green',
    closed: 'slate',
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
            {TABS.map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-5 py-3.5 text-xs font-medium tracking-wide border-b-2 -mb-px whitespace-nowrap transition-all ${
                    active ? 'text-slate-900 border-amber-500' : 'text-slate-400 border-transparent hover:text-slate-600'
                  }`}
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
            {activeTab === 'manage' && (
              <ClientManager client={client} onSaved={setClient} />
            )}
            {activeTab === 'documents' && (
              <AdminDocumentsView client={client} />
            )}
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
            {activeTab === 'meetings' && (
              <MeetingsTab clientName={client.name} />
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
