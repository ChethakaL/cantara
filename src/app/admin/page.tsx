'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Plus, Search, Users, MessageSquare, AlertCircle, FolderOpen, ChevronRight, Mail, Loader2, CheckCircle2, ExternalLink, Trello } from 'lucide-react'
import AdminNav from '@/components/admin/AdminNav'
import { Button, Badge, WorkstreamBadge, ProgressBar, Modal, Input, Card } from '@/components/ui'
import { getClients, createClient, getCurrentRole, getAdminName } from '@/lib/store'
import type { Client } from '@/lib/store'

const WORKSTREAM_SECTIONS = [
  { id: 'onboarding', label: 'Onboarding', color: '#94a3b8' },
  { id: 'ws1', label: 'Workstream 1', color: '#3b82f6' },
  { id: 'ws2', label: 'Workstream 2', color: '#10b981' },
  { id: 'both', label: 'WS1 + WS2', color: '#b8922a' },
  { id: 'ma', label: 'M&A', color: '#f43f5e' },
]

function MondaySetupCard({
  status,
  connecting,
  onConnect,
}: {
  status: { connected: boolean } | null
  connecting: boolean
  onConnect: () => void
}) {
  const [installUrl, setInstallUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!status?.connected) {
      fetch('/api/composio/monday/install-url')
        .then(res => res.json())
        .then(data => setInstallUrl(data.url))
        .catch(console.error)
    }
  }, [status?.connected])

  return (
    <Card className="p-5 mb-8" style={{ borderColor: 'rgba(255,61,87,0.12)' }}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,rgba(255,61,87,0.1),rgba(255,154,60,0.1))' }}
          >
            <Trello className="w-5 h-5" style={{ color: '#FF3D57' }} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-slate-800">Monday.com</h3>
              {status?.connected ? (
                <Badge color="green">Connected</Badge>
              ) : (
                <Badge color="slate">Not connected</Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Connect your Monday.com account to link CIM and Teaser PDFs directly to deals on your Monday boards.
              {!status?.connected && installUrl && (
                <span className="block mt-2">
                  First time? <a href={installUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold">Install the Composio app on your Monday workspace first →</a>
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <Button
            size="sm"
            variant={status?.connected ? 'outline' : 'primary'}
            onClick={onConnect}
            disabled={connecting}
            style={status?.connected ? {} : { background: 'linear-gradient(135deg,#FF3D57,#FF9A3C)', border: 'none', color: '#fff' }}
          >
            {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : status?.connected ? <CheckCircle2 className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
            {status?.connected ? 'Reconnect Monday.com' : 'Connect Monday.com'}
          </Button>
        </div>
      </div>
    </Card>
  )
}


export default function AdminDashboard() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [loadingClients, setLoadingClients] = useState(true)
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [newClient, setNewClient] = useState({ name: '', email: '', company: '' })
  const [adminName, setAdminName] = useState('Admin Pollack')
  const [driveStatus, setDriveStatus] = useState<{ connected: boolean; connection: { status: string; updatedAt: string | null } | null } | null>(null)
  const [connectingDrive, setConnectingDrive] = useState(false)
  const [syncingDrive, setSyncingDrive] = useState(false)
  const [driveSyncSummary, setDriveSyncSummary] = useState<string>('')
  const [driveSyncJob, setDriveSyncJob] = useState<any>(null)
  const [lastSyncUpdate, setLastSyncUpdate] = useState<Date | null>(null)
  const [mondayStatus, setMondayStatus] = useState<{ connected: boolean } | null>(null)
  const [connectingMonday, setConnectingMonday] = useState(false)

  useEffect(() => {
    if (getCurrentRole() !== 'admin') {
      router.push('/login/admin')
      return
    }

    setAdminName(getAdminName())

    let active = true
    ;(async () => {
      try {
        const data = await getClients()
        if (active) setClients(data)
      } finally {
        if (active) setLoadingClients(false)
      }
    })()

    return () => {
      active = false
    }
  }, [router])

  const refreshDriveStatus = async () => {
    try {
      const res = await fetch('/api/composio/google-drive/status')
      if (!res.ok) return
      const data = await res.json()
      setDriveStatus(data)
    } catch {
      setDriveStatus(null)
    }
  }

  const refreshMondayStatus = async () => {
    try {
      const res = await fetch('/api/composio/monday/status')
      if (!res.ok) return
      const data = await res.json()
      setMondayStatus(data)
    } catch {
      setMondayStatus(null)
    }
  }

  useEffect(() => {
    void refreshMondayStatus()
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch('/api/composio/google-drive/status')
        if (!res.ok) return
        const data = await res.json()
        if (active) setDriveStatus(data)
      } catch {
        if (active) setDriveStatus(null)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const onFocus = () => void refreshDriveStatus()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const refresh = () => getClients().then(setClients)

  const handleAddClient = async () => {
    if (!newClient.name || !newClient.email) return
    await createClient(newClient)
    refresh()
    setAdding(false)
    setNewClient({ name: '', email: '', company: '' })
  }

  const connectDrive = async () => {
    setConnectingDrive(true)
    try {
      const res = await fetch('/api/composio/google-drive/connect', { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      if (data.redirect_url) {
        window.open(data.redirect_url, '_blank', 'noopener,noreferrer')
        window.setTimeout(() => void refreshDriveStatus(), 3000)
        window.setTimeout(() => void refreshDriveStatus(), 8000)
      }
    } finally {
      setConnectingDrive(false)
    }
  }

  const connectMonday = async () => {
    setConnectingMonday(true)
    try {
      const res = await fetch('/api/composio/monday/connect', { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      if (data.redirect_url) {
        window.open(data.redirect_url, '_blank', 'noopener,noreferrer')
        window.setTimeout(() => void refreshMondayStatus(), 4000)
        window.setTimeout(() => void refreshMondayStatus(), 10000)
      }
    } finally {
      setConnectingMonday(false)
    }
  }

  const syncDrive = async () => {
    setSyncingDrive(true)
    setDriveSyncSummary('Google Drive sync started. This can take more than 10 minutes; you can keep working while it runs.')
    try {
      const res = await fetch('/api/drive/sync-all', { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setDriveSyncJob(data)
      setLastSyncUpdate(new Date())
    } catch {
      setDriveSyncSummary('Google Drive sync failed. Confirm Google Drive is connected, then try again.')
      setSyncingDrive(false)
    }
  }

  useEffect(() => {
    if (!syncingDrive && driveSyncJob?.status !== 'running') return

    let active = true
    const poll = async () => {
      try {
        const res = await fetch('/api/drive/sync-all', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (!active) return
        setDriveSyncJob(data)
        setLastSyncUpdate(new Date())
        const summary = data.summary || {}
        if (data.status === 'running') {
          setSyncingDrive(true)
          setDriveSyncSummary(data.message || 'Syncing Google Drive...')
        } else if (data.status === 'complete') {
          setSyncingDrive(false)
          setDriveSyncSummary(
            `${data.message || 'Google Drive sync complete.'}` +
            (summary.errors?.length ? ` ${summary.errors.length} issue${summary.errors.length === 1 ? '' : 's'} need review.` : ''),
          )
          refresh()
        } else if (data.status === 'error') {
          setSyncingDrive(false)
          setDriveSyncSummary(`Google Drive sync failed: ${data.message || 'Unknown error'}`)
        }
      } catch {
        if (active) setDriveSyncSummary('Still syncing. Waiting for the latest status...')
      }
    }

    void poll()
    const id = window.setInterval(() => void poll(), 3000)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [syncingDrive, driveSyncJob?.status])

  const filtered = clients.filter(c =>
    (c.name?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (c.company?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (c.email?.toLowerCase() || '').includes(search.toLowerCase())
  )

  const byGroup = (groupId: string) => {
    if (groupId === 'onboarding') return filtered.filter(c => !c.workstream)
    return filtered.filter(c => (c.workstream?.toLowerCase() || '') === groupId.toLowerCase())
  }

  const totalClients = clients.length
  const [totalMessages, setTotalMessages] = useState(0)
  useEffect(() => {
    const count = clients.reduce((acc, c) => acc + (c.unreadCount || 0), 0)
    setTotalMessages(count)
  }, [clients])

  return (
    <div className="min-h-screen" style={{ background: 'hsl(220,18%,96%)' }}>
      <AdminNav name={adminName} />

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

          {/* Header */}
          <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
            <div>
              <p className="text-xs tracking-[0.18em] uppercase text-slate-400 mb-2">Overview</p>
              <h2 className="text-3xl font-light text-slate-800 cantara-serif" style={{ letterSpacing: '-0.01em' }}>Active Clients</h2>
              <div style={{ width: '1.75rem', height: '1.5px', background: '#b8922a', marginTop: '0.75rem' }} />
            </div>
            <Button onClick={() => setAdding(true)}>
              <Plus className="w-4 h-4" /> New Client
            </Button>
          </div>

          <Card className="p-5 mb-8 border-cantara-gold/20">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(202,161,95,0.08)' }}>
                  <FolderOpen className="w-5 h-5" style={{ color: '#CAA15F' }} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-slate-800">Google Drive storage</h3>
                    {driveStatus?.connected ? (
                      <Badge color="green">Connected</Badge>
                    ) : (
                      <Badge color="slate">{driveStatus?.connection?.status ? `Status: ${driveStatus.connection.status}` : 'Not connected'}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                    Sign in with Google to create client folders and save uploaded documents in Google Drive automatically. Full syncs can take more than 10 minutes and continue in the background.
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                {driveStatus?.connected && (
                  <Button
                    size="sm"
                    onClick={() => void syncDrive()}
                    disabled={syncingDrive}
                  >
                    {syncingDrive ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                    {syncingDrive ? 'Syncing...' : 'Sync client folders'}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={driveStatus?.connected ? 'outline' : 'primary'}
                  onClick={() => void connectDrive()}
                  disabled={connectingDrive || syncingDrive}
                >
                  {connectingDrive ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : driveStatus?.connected ? <CheckCircle2 className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
                  {driveStatus?.connected ? 'Reconnect Google Drive' : 'Sign in with Google'}
                </Button>
              </div>
            </div>
            {driveSyncSummary && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-white/50 backdrop-blur-sm px-4 py-4 text-xs shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {syncingDrive ? (
                      <div className="relative">
                        <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                        <div className="absolute inset-0 h-4 w-4 animate-ping rounded-full bg-amber-400/20" />
                      </div>
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    )}
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <p className="font-semibold text-slate-700">
                        {syncingDrive ? (driveSyncJob?.message || 'Syncing Google Drive...') : driveSyncSummary}
                      </p>
                      {lastSyncUpdate && (
                        <span className="text-[10px] font-medium text-slate-400 tabular-nums bg-slate-100 px-1.5 py-0.5 rounded">
                          {lastSyncUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      )}
                    </div>

                    {(syncingDrive || driveSyncJob?.status === 'complete') && driveSyncJob?.summary && (
                      <div className="space-y-4 mt-3">
                        {syncingDrive && driveSyncJob.summary.phase && (
                          <div className="flex items-center gap-2 text-slate-500 italic bg-amber-50/50 px-2 py-1 rounded border border-amber-100/50 w-fit">
                            <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
                            {driveSyncJob.summary.phase}
                          </div>
                        )}
                        
                        <div className="grid grid-cols-3 gap-4 py-3 border-y border-slate-100">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Clients</p>
                            <p className="text-sm font-bold text-slate-700">
                              {driveSyncJob.summary.clients || 0} <span className="text-slate-300 font-normal">/</span> {driveSyncJob.summary.totalClients || 0}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Documents</p>
                            <p className="text-sm font-bold text-slate-700">{driveSyncJob.summary.documentsMirrored || 0}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Reports</p>
                            <p className="text-sm font-bold text-slate-700">{driveSyncJob.summary.reportsArchived || 0}</p>
                          </div>
                        </div>

                        {driveSyncJob.summary.totalClients > 0 && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-medium text-slate-500 uppercase tracking-tight">
                              <span>Overall Progress</span>
                              <span>{Math.round(((driveSyncJob.summary.clients || 0) / driveSyncJob.summary.totalClients) * 100)}%</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-100 border border-slate-200/50 p-0.5">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.max(2, Math.min(100, ((driveSyncJob.summary.clients || 0) / driveSyncJob.summary.totalClients) * 100))}%` }}
                                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]"
                              />
                            </div>
                          </div>
                        )}

                        {driveSyncJob.summary.logs?.length > 0 && (
                          <div className="mt-4 rounded border border-slate-100 bg-slate-50/50 p-2 overflow-hidden">
                            <p className="text-[9px] uppercase tracking-wider text-slate-400 mb-1.5 font-semibold">Recent Activity</p>
                            <div className="space-y-1 max-h-24 overflow-y-auto custom-scrollbar">
                              {driveSyncJob.summary.logs.slice(0, 5).map((log: string, idx: number) => (
                                <p key={idx} className="text-[10px] text-slate-500 font-mono truncate">
                                  <span className="text-slate-300 mr-1 opacity-50">•</span>
                                  {log}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}

                        <p className="text-[10px] text-slate-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Large syncs can take more than 10 minutes.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { icon: Users, label: 'Total Clients', value: totalClients },
              { icon: FolderOpen, label: 'Active', value: clients.filter(c => c.workstream && c.stage !== 'closed').length },
              { icon: AlertCircle, label: 'Unprovisioned', value: clients.filter(c => !c.workstream).length },
              { icon: MessageSquare, label: 'Unread Messages', value: totalMessages },
            ].map(stat => {
              const Icon = stat.icon
              return (
                <Card key={stat.label} className="p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(202,161,95,0.08)' }}>
                    <Icon className="w-5 h-5" style={{ color: '#CAA15F' }} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                    <p className="text-xs text-slate-400">{stat.label}</p>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Monday.com Integration Card */}
          <MondaySetupCard
            status={mondayStatus}
            connecting={connectingMonday}
            onConnect={() => void connectMonday()}
          />


          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-cantara-beige bg-cantara-white outline-none focus:border-cantara-gold focus:ring-2 focus:ring-cantara-gold/20 transition-all"
              placeholder="Search clients by name, company, or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Client groups */}
          {WORKSTREAM_SECTIONS.map(section => {
            const group = byGroup(section.id)
            if (group.length === 0) return null
            return (
              <div key={section.id} className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-2 h-2 rounded-full" style={{ background: section.color }} />
                  <h3 className="text-sm font-semibold text-slate-700">{section.label}</h3>
                  <span className="text-xs text-slate-400">({group.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.map((client, i) => (
                    <ClientCard key={client.id} client={client} delay={i * 0.05} />
                  ))}
                </div>
              </div>
            )
          })}

          {loadingClients && (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400 text-sm">
              <Loader2 className="w-6 h-6 animate-spin text-cantara-gold" />
              <span>Loading clients...</span>
            </div>
          )}

          {!loadingClients && filtered.length === 0 && (
            <div className="py-16 text-center text-slate-400 text-sm">
              No clients match your search.
            </div>
          )}
        </motion.div>
      </main>

      {/* Add client modal */}
      <Modal open={adding} onClose={() => setAdding(false)} title="Add New Client">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Creating a client sends them a portal invitation email and sets up their workspace. Assign a workstream in Client Management to provision their document checklist.
          </p>
          <Input label="Full name *" placeholder="Jane Smith" value={newClient.name} onChange={e => setNewClient(p => ({ ...p, name: e.target.value }))} />
          <Input label="Email address *" type="email" placeholder="jane@company.com" value={newClient.email} onChange={e => setNewClient(p => ({ ...p, email: e.target.value }))} />
          <Input label="Company / Business name" placeholder="Happy Paws Resort" value={newClient.company} onChange={e => setNewClient(p => ({ ...p, company: e.target.value }))} />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            <Button onClick={handleAddClient} disabled={!newClient.name || !newClient.email}>
              <Mail className="w-4 h-4" /> Create & Send Invite
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function ClientCard({ client, delay }: { client: Client; delay: number }) {
  const submitted = Object.values(client.documentStatuses).filter(s => s.fileName).length
  const total = 22 // approximate
  const progress = Math.round((submitted / total) * 100)
  const unread = client.unreadCount || 0

  const stageLabel: Record<string, string> = {
    onboarding: 'Onboarding', collection: 'Collection', review: 'Review', final: 'Final', closed: 'Closed',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      <Link href={`/admin/client/${client.id}`}>
        <Card className="p-5 hover:shadow-md transition-all hover:border-cantara-gold/30 cursor-pointer group">
          <div className="flex items-start justify-between mb-3">
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 text-sm group-hover:text-cantara-navy transition-colors">{client.name}</p>
              <p className="text-xs text-slate-400 mt-0.5 truncate">{client.company || client.email}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              {unread > 0 && (
                <span className="w-5 h-5 rounded-full text-xs font-bold text-white flex items-center justify-center" style={{ background: '#D37141' }}>
                  {unread}
                </span>
              )}
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-cantara-gold transition-colors" />
            </div>
          </div>

          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <WorkstreamBadge ws={client.workstream} />
            <Badge color="slate">{stageLabel[client.stage] ?? client.stage}</Badge>
          </div>

          {client.workstream && (
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Documents</span>
                <span>{submitted} submitted</span>
              </div>
              <ProgressBar value={progress} />
            </div>
          )}

          {!client.workstream && (
            <div className="text-xs rounded-lg px-3 py-2 flex items-center gap-2" style={{ color: '#D37141', background: 'rgba(211,113,65,0.08)' }}>
              <AlertCircle className="w-3.5 h-3.5" />
              Needs workstream assignment
            </div>
          )}

          {client.lastLogin && (
            <p className="text-xs text-slate-300 mt-3">Last login: {new Date(client.lastLogin).toLocaleDateString()}</p>
          )}
        </Card>
      </Link>
    </motion.div>
  )
}
