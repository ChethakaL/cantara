'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileSpreadsheet,
  Filter,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react'
import AdminNav from '@/components/admin/AdminNav'
import { Badge, Button, Card, Input, Select } from '@/components/ui'
import { ACTIVE_STAGES, CALL_RESULT_LABELS, isIdleLead, STAGE_LABELS } from '@/lib/sales-leads/workflow'
import MondayBoardConfigModal from '@/components/sales-leads/MondayBoardConfigModal'
import ExcelImportModal from '@/components/sales-leads/ExcelImportModal'
import LeadDetailDrawer from '@/components/sales-leads/LeadDetailDrawer'
import EnrichmentModal from '@/components/sales-leads/EnrichmentModal'

type Lead = any

const stageBadges: Record<string, { label: string; color: 'gold' | 'blue' | 'green' | 'red' | 'amber' | 'slate' }> = {
  NEW: { label: 'New', color: 'slate' },
  EMAIL_1_DUE: { label: 'Email 1 Due', color: 'amber' },
  EMAIL_1_SENT: { label: 'Email 1 Sent', color: 'blue' },
  CALL_1_DUE: { label: 'Call 1 Due', color: 'gold' },
  EMAIL_2_DUE: { label: 'Email 2 Due', color: 'amber' },
  EMAIL_2_SENT: { label: 'Email 2 Sent', color: 'blue' },
  CALL_2_DUE: { label: 'Call 2 Due', color: 'gold' },
  BOOKED: { label: 'Booked', color: 'green' },
  NEEDS_FOLLOW_UP: { label: 'Needs Follow-Up', color: 'amber' },
  RECONNECT_LATER: { label: 'Reconnect Later', color: 'slate' },
  BAD_CONTACT: { label: 'Bad Contact', color: 'red' },
  OPTED_OUT: { label: 'Opted Out', color: 'red' },
  CLOSED_SOLD: { label: 'Closed - Sold', color: 'green' },
  NOT_INTERESTED_TO_NURTURE: { label: 'To Nurture', color: 'red' },
  COMPLETED_NO_RESPONSE: { label: 'No Response', color: 'slate' },
}

export default function SalesLeadsPage() {
  const [view, setView] = useState<'active' | 'mine' | 'warm' | 'idle'>('active')
  const [leads, setLeads] = useState<Lead[]>([])
  const [callers, setCallers] = useState<any[]>([])
  const [callerId, setCallerId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ active: 0, due: 0, warm: 0, idle: 0 })

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [showDrawer, setShowDrawer] = useState(false)
  const [enrichingLead, setEnrichingLead] = useState<Lead | null>(null)

  const [showNew, setShowNew] = useState(false)
  const [showMondayConfig, setShowMondayConfig] = useState(false)
  const [showExcelImport, setShowExcelImport] = useState(false)
  const [syncingNotice, setSyncingNotice] = useState<string | null>(null)

  const [newBusiness, setNewBusiness] = useState('')
  const [error, setError] = useState('')

  const load = async (syncWithMonday = false) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ view })
      if (callerId) params.set('callerId', callerId)
      if (syncWithMonday) params.set('sync', 'true')
      const res = await fetch(`/api/sales-leads?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Unable to load sales leads')
      const data = await res.json()
      setLeads(data.leads || [])
      setCallers(data.callers || [])
      setStats(data.stats || { active: 0, due: 0, warm: 0, idle: 0 })
    } catch (e: any) {
      setError(e.message || 'Unable to load sales leads')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [view, callerId])

  const updateLead = async (id: string, patch: Record<string, unknown>) => {
    const res = await fetch('/api/sales-leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    })
    if (!res.ok) {
      setError('Could not update lead')
      return
    }
    await load()
    if (selectedLead && selectedLead.id === id) {
      setSelectedLead(prev => (prev ? { ...prev, ...patch } : null))
    }
  }

  const createLead = async () => {
    if (!newBusiness.trim()) return
    const res = await fetch('/api/sales-leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessName: newBusiness }),
    })
    if (res.ok) {
      setNewBusiness('')
      setShowNew(false)
      await load()
    }
  }

  const filteredLeads = leads.filter(l =>
    searchQuery
      ? l.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.city && l.city.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (l.ownerFirstName && l.ownerFirstName.toLowerCase().includes(searchQuery.toLowerCase()))
      : true,
  )

  const formatNextActionBadge = (dateStr: string | null, stage: string) => {
    if (!dateStr) return <span className="text-slate-400 text-[11px]">Not scheduled</span>
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 3600 * 24))

    if (diffDays < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-medium">
          <AlertCircle className="w-3 h-3 text-rose-600" /> Overdue ({Math.abs(diffDays)}d)
        </span>
      )
    }
    if (diffDays === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-medium animate-pulse">
          <Clock className="w-3 h-3 text-amber-600" /> Due Today
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium">
        <CalendarClock className="w-3 h-3 text-cantara-gold" /> {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-[hsl(220,18%,96%)] pb-12">
      <AdminNav name="Admin Pollack" />
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        {/* Header Title Section */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <Link
              href="/admin"
              className="text-xs text-slate-400 hover:text-slate-700 inline-flex items-center gap-1 mb-2 font-medium"
            >
              <ArrowLeft className="w-3 h-3" /> Back to Admin Overview
            </Link>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[#21263C] text-cantara-gold">
                <Sparkles className="w-4 h-4" />
              </span>
              <h1 className="text-3xl font-light text-slate-800 cantara-serif">Sales Lead Outreach</h1>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <Button variant="outline" size="sm" onClick={() => setShowMondayConfig(true)} className="bg-white">
              <Settings2 className="w-3.5 h-3.5 mr-1.5 text-cantara-gold" /> Monday Board Sync
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowExcelImport(true)} className="bg-white">
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-slate-600" /> Import Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => void load(true)} className="bg-white" title="Refresh & Sync from Monday.com">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button size="sm" onClick={() => setShowNew(true)} className="gap-1">
              <Plus className="w-3.5 h-3.5" /> New Lead
            </Button>
          </div>
        </div>

        {syncingNotice && (
          <div className="mb-6 p-3.5 rounded-xl bg-blue-50/90 border border-blue-200 text-blue-900 text-xs flex items-center justify-between shadow-xs">
            <span className="flex items-center gap-2 font-medium">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              {syncingNotice}
            </span>
            <span className="text-[11px] text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full font-semibold">
              Background Sync Active
            </span>
          </div>
        )}

        {/* Executive Stats Summary Header */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="p-4 bg-white shadow-xs border border-slate-200/80 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Active Queue</p>
              <h3 className="text-2xl font-semibold text-slate-800 mt-1">{stats.active}</h3>
              <p className="text-xs text-slate-500 mt-0.5">Leads in sequence</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
              <Users className="w-5 h-5" />
            </div>
          </Card>

          <Card className="p-4 bg-white shadow-xs border border-slate-200/80 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Due Today / Overdue</p>
              <h3 className="text-2xl font-semibold text-amber-600 mt-1">
                {stats.due}
              </h3>
              <p className="text-xs text-amber-700/80 mt-0.5">Requires caller attempt</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
          </Card>

          <Card className="p-4 bg-white shadow-xs border border-slate-200/80 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Warm Exceptions</p>
              <h3 className="text-2xl font-semibold text-slate-800 mt-1">
                {stats.warm}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Callback / Booked meetings</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
              <UserCheck className="w-5 h-5" />
            </div>
          </Card>

          <Card className="p-4 bg-white shadow-xs border border-slate-200/80 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Idle Warning</p>
              <h3 className="text-2xl font-semibold text-rose-600 mt-1">
                {stats.idle}
              </h3>
              <p className="text-xs text-rose-700/80 mt-0.5">&gt;10d without contact</p>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 text-rose-600">
              <AlertCircle className="w-5 h-5" />
            </div>
          </Card>
        </div>

        {/* View Switcher & Search Bar */}
        <Card className="p-3 mb-5 bg-white border border-slate-200/80">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-1.5 p-1 bg-slate-100/80 rounded-xl">
              {[
                ['active', 'Active Triage'],
                ['mine', 'My Workload'],
                ['warm', 'Warm / Exceptions'],
                ['idle', 'Idle Leads (>10d)'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setView(key as 'active' | 'mine' | 'warm' | 'idle')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    view === key
                      ? 'bg-[#21263C] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter lead or city..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-cantara-gold"
                />
              </div>

              <div className="min-w-[170px]">
                <Select
                  aria-label="Filter by assigned caller"
                  value={callerId}
                  onChange={e => setCallerId(e.target.value)}
                  options={[
                    { value: '', label: 'All Callers' },
                    ...callers.map(c => ({ value: c.id, label: c.name })),
                  ]}
                  className="text-xs h-8 py-1"
                />
              </div>
            </div>
          </div>
        </Card>

        {error && (
          <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" /> {error}
          </div>
        )}

        {/* Lead Workspace Table Card */}
        <Card className="overflow-hidden border border-slate-200 bg-white shadow-xs">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {view === 'active' && 'Active Outbound Triage'}
                {view === 'mine' && 'My Assigned Workload'}
                {view === 'warm' && 'Warm & Exception Pipeline'}
                {view === 'idle' && 'Idle Lead Monitoring'}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700 text-[10px] font-bold">
                {filteredLeads.length}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Click any row to open lead details drawer</p>
          </div>

          {loading ? (
            <div className="py-20 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-slate-300" />
              Loading lead sequence data...
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              No sales leads found in this view.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-400 font-medium">
                    <th className="px-5 py-3">Business Prospect</th>
                    <th className="px-4 py-3">Stage</th>
                    <th className="px-4 py-3">Next Action Due</th>
                    <th className="px-4 py-3">Assigned Caller</th>
                    <th className="px-4 py-3">Last Call Result</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredLeads.map(lead => {
                    const badgeCfg = stageBadges[lead.currentStage] || {
                      label: lead.currentStage,
                      color: 'slate',
                    }
                    return (
                      <tr
                        key={lead.id}
                        onClick={() => {
                          setSelectedLead(lead)
                          setShowDrawer(true)
                        }}
                        className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                      >
                        {/* Business Name & Details */}
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-slate-800 group-hover:text-cantara-navy transition-colors">
                            {lead.businessName}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-300" />
                              {[lead.city, lead.state].filter(Boolean).join(', ') || 'AZ'}
                            </span>
                            {lead.ownerFirstName && (
                              <span className="border-l pl-2 text-slate-500 font-medium">
                                Owner: {lead.ownerFirstName} {lead.ownerLastName || ''}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Stage Badge */}
                        <td className="px-4 py-3.5">
                          <Badge color={badgeCfg.color} className="font-semibold text-[11px] px-2.5 py-1">
                            {badgeCfg.label}
                          </Badge>
                        </td>

                        {/* Next Action Badge */}
                        <td className="px-4 py-3.5">
                          {formatNextActionBadge(lead.nextActionDate, lead.currentStage)}
                        </td>

                        {/* Assigned Caller */}
                        <td className="px-4 py-3.5">
                          {lead.assignedCaller ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
                              <span className="w-4 h-4 rounded-full bg-[#21263C] text-cantara-gold flex items-center justify-center text-[9px] font-bold">
                                {lead.assignedCaller.name.charAt(0)}
                              </span>
                              {lead.assignedCaller.name}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                          )}
                        </td>

                        {/* Last Call Result */}
                        <td className="px-4 py-3.5">
                          {lead.lastCallResult ? (
                            <span className="text-slate-700 font-medium">
                              {CALL_RESULT_LABELS[lead.lastCallResult as keyof typeof CALL_RESULT_LABELS] || lead.lastCallResult}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">No call attempt</span>
                          )}
                        </td>

                        {/* Quick Row Action Button */}
                        <td className="px-4 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              title="Run AI Prospect Research"
                              onClick={() => setEnrichingLead(lead)}
                              className="text-[11px] py-1 h-7 font-medium bg-white text-slate-700 hover:text-[#CAA15F] border-slate-200"
                            >
                              <Sparkles className="w-3 h-3 text-[#CAA15F]" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedLead(lead)
                                setShowDrawer(true)
                              }}
                              className={`text-[11px] py-1 h-7 font-medium ${
                                lead.currentStage === 'EMAIL_1_DUE' || lead.currentStage === 'EMAIL_2_DUE'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                  : lead.currentStage === 'CALL_1_DUE' || lead.currentStage === 'CALL_2_DUE'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                                  : 'bg-white hover:bg-slate-100'
                              }`}
                            >
                              {lead.currentStage === 'EMAIL_1_DUE' || lead.currentStage === 'EMAIL_2_DUE' ? (
                                <>
                                  <Mail className="w-3 h-3 mr-1 text-blue-600" /> View Email Draft
                                </>
                              ) : lead.currentStage === 'CALL_1_DUE' || lead.currentStage === 'CALL_2_DUE' ? (
                                <>
                                  <Phone className="w-3 h-3 mr-1 text-amber-600" /> Log Call Outcome
                                </>
                              ) : (
                                <>
                                  Log Action <ChevronRight className="w-3 h-3 ml-0.5" />
                                </>
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Modal for creating a single new lead */}
        {showNew && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowNew(false)} />
            <Card className="relative w-full max-w-md p-6 bg-white shadow-2xl">
              <h3 className="font-semibold text-slate-800 mb-4">Create New Sales Lead</h3>
              <Input
                label="Business Name"
                autoFocus
                value={newBusiness}
                onChange={e => setNewBusiness(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && void createLead()}
                placeholder="e.g. Phoenix Pet Resort"
              />
              <div className="flex justify-end gap-2 mt-5">
                <Button variant="outline" onClick={() => setShowNew(false)}>
                  Cancel
                </Button>
                <Button onClick={() => void createLead()}>Create Lead</Button>
              </div>
            </Card>
          </div>
        )}

        {/* Modals & Slide-out Drawer */}
        <MondayBoardConfigModal
          isOpen={showMondayConfig}
          onClose={() => setShowMondayConfig(false)}
          onSaved={() => void load()}
        />

        <ExcelImportModal
          isOpen={showExcelImport}
          onClose={() => setShowExcelImport(false)}
          onImportComplete={async () => {
            setSyncingNotice('Creating local records and syncing leads to Monday.com in the background...')
            await load()
            setTimeout(() => {
              void load()
              setSyncingNotice(null)
            }, 6000)
          }}
        />

        <LeadDetailDrawer
          lead={selectedLead}
          callers={callers}
          isOpen={showDrawer}
          onClose={() => setShowDrawer(false)}
          onUpdate={updateLead}
        />

        {enrichingLead && (
          <EnrichmentModal
            isOpen={Boolean(enrichingLead)}
            leadId={enrichingLead.id}
            businessName={enrichingLead.businessName}
            initialNotes={enrichingLead.notes}
            initialReport={enrichingLead.aiResearchReport}
            onClose={() => setEnrichingLead(null)}
            onNotesSaved={() => void load()}
          />
        )}
      </main>
    </div>
  )
}
