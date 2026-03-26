'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Plus, Search, Users, MessageSquare, AlertCircle, FolderOpen, ChevronRight, Mail } from 'lucide-react'
import AdminNav from '@/components/admin/AdminNav'
import { Button, Badge, WorkstreamBadge, ProgressBar, Modal, Input, Card } from '@/components/ui'
import { getClients, createClient, getCurrentRole, getAdminName, getMessages } from '@/lib/store'
import type { Client } from '@/lib/store'

const WORKSTREAM_SECTIONS = [
  { id: 'onboarding', label: 'Onboarding', color: '#94a3b8' },
  { id: 'ws1', label: 'Workstream 1', color: '#3b82f6' },
  { id: 'ws2', label: 'Workstream 2', color: '#10b981' },
  { id: 'both', label: 'WS1 + WS2', color: '#b8922a' },
  { id: 'ma', label: 'M&A', color: '#f43f5e' },
]

export default function AdminDashboard() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [newClient, setNewClient] = useState({ name: '', email: '', company: '' })
  const [adminName, setAdminName] = useState('Admin Pollack')

  useEffect(() => {
    if (getCurrentRole() !== 'admin') { router.push('/login/admin'); return }
    setAdminName(getAdminName())
    getClients().then(setClients)
  }, [])

  const refresh = () => getClients().then(setClients)

  const handleAddClient = async () => {
    if (!newClient.name || !newClient.email) return
    await createClient(newClient)
    refresh()
    setAdding(false)
    setNewClient({ name: '', email: '', company: '' })
  }

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
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(184,146,42,0.08)' }}>
                    <Icon className="w-5 h-5" style={{ color: '#b8922a' }} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                    <p className="text-xs text-slate-400">{stat.label}</p>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
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

          {filtered.length === 0 && (
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
        <Card className="p-5 hover:shadow-md transition-all hover:border-amber-200 cursor-pointer group">
          <div className="flex items-start justify-between mb-3">
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 text-sm group-hover:text-amber-700 transition-colors">{client.name}</p>
              <p className="text-xs text-slate-400 mt-0.5 truncate">{client.company || client.email}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              {unread > 0 && (
                <span className="w-5 h-5 rounded-full text-xs font-bold text-white flex items-center justify-center" style={{ background: '#b8922a' }}>
                  {unread}
                </span>
              )}
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-400 transition-colors" />
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
            <div className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 flex items-center gap-2">
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
