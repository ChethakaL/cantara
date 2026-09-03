'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Plus, Search, Users, MessageSquare, AlertCircle, FolderOpen, ChevronRight, Mail, Loader2, CheckCircle2, ExternalLink, Trello, LogOut, Download, BarChart3 } from 'lucide-react'
import AdminNav from '@/components/admin/AdminNav'
import GoogleServicesCard from '@/components/admin/GoogleServicesCard'
import MondayImportModal from '@/components/monday/MondayImportModal'
import PetBusinessCategoryField from '@/components/ui/PetBusinessCategoryField'
import { PROPERTY_OWNERSHIP_OPTIONS } from '@/lib/pet-business-categories'
import { Button, Badge, WorkstreamBadge, ProgressBar, Modal, Input, Card, Select, cn } from '@/components/ui'
import { getClients, createClient, saveClient, getCurrentRole, getAdminName } from '@/lib/store'
import { useAdminInboxUnread } from '@/hooks/useChatRoom'
import type { Client } from '@/lib/store'

type DrivePickerTarget = 'parent' | 'new-parent' | 'new-existing' | `client:${string}`

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
  onDisconnect,
  onImport,
}: {
  status: { connected: boolean } | null
  connecting: boolean
  onConnect: () => void
  onDisconnect: () => void
  onImport: () => void
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
              Connect Monday.com to import leads (name, email, phone, business, website) and link CIM and Teaser PDFs to board items.
              {!status?.connected && installUrl && (
                <span className="block mt-2">
                  First time? <a href={installUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold">Install the Composio app on your Monday workspace first →</a>
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          {status?.connected && (
            <Button
              id="monday-import-clients-btn"
              size="sm"
              variant="outline"
              onClick={onImport}
              style={{ borderColor: 'rgba(255, 236, 61, 0.65)', color: '#9f7603ff' }}
            >
              <Download className="w-3.5 h-3.5" />
              Fetch Clients
            </Button>
          )}
          <Button
            size="sm"
            variant={status?.connected ? 'outline' : 'primary'}
            onClick={() => status?.connected ? onDisconnect() : onConnect()}
            disabled={connecting}
            style={status?.connected ? {} : { background: 'linear-gradient(135deg,#FF3D57,#FF9A3C)', border: 'none', color: '#fff' }}
            className={status?.connected ? 'text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200' : ''}
          >
            {connecting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : status?.connected ? (
              <LogOut className="w-3.5 h-3.5" />
            ) : (
              <ExternalLink className="w-3.5 h-3.5" />
            )}
            {status?.connected ? 'Disconnect' : 'Connect Monday.com'}
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
  const [creatingClient, setCreatingClient] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [newClient, setNewClient] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    businessCategory: '',
    propertyOwnership: '' as '' | 'lease' | 'owns',
    realEstateRunLease: false,
    realEstateRunAppraisal: true,
  })
  const [adminName, setAdminName] = useState('Admin Pollack')
  const [driveStatus, setDriveStatus] = useState<{ connected: boolean; connection: { status: string; updatedAt: string | null } | null } | null>(null)
  const [syncingDrive, setSyncingDrive] = useState(false)
  const [driveSyncSummary, setDriveSyncSummary] = useState<string>('')
  const [driveSyncJob, setDriveSyncJob] = useState<any>(null)
  const [lastSyncUpdate, setLastSyncUpdate] = useState<Date | null>(null)
  const [showDriveManager, setShowDriveManager] = useState(false)
  const [driveParentFolder, setDriveParentFolder] = useState('')
  const [driveRowExistingFolders, setDriveRowExistingFolders] = useState<Record<string, string>>({})
  const [driveRowFolderNames, setDriveRowFolderNames] = useState<Record<string, string>>({})
  const [driveRowBusy, setDriveRowBusy] = useState<Record<string, string>>({})
  const [driveManagerMessage, setDriveManagerMessage] = useState('')
  const [drivePickerTarget, setDrivePickerTarget] = useState<DrivePickerTarget | null>(null)
  const [drivePickerFolders, setDrivePickerFolders] = useState<Array<{ id: string; name: string; url: string }>>([])
  const [drivePickerPath, setDrivePickerPath] = useState<Array<{ id: string; name: string; url: string }>>([])
  const [drivePickerLoading, setDrivePickerLoading] = useState(false)
  const [drivePickerError, setDrivePickerError] = useState('')
  const [newClientDriveExistingFolder, setNewClientDriveExistingFolder] = useState('')
  const [newClientDriveParentFolder, setNewClientDriveParentFolder] = useState('')
  const [newClientDriveFolderName, setNewClientDriveFolderName] = useState('')
  const [mondayStatus, setMondayStatus] = useState<{ connected: boolean } | null>(null)
  const [connectingMonday, setConnectingMonday] = useState(false)
  const [showMondayImport, setShowMondayImport] = useState(false)
  const { counts: inboxUnreadCounts, total: inboxUnreadTotal } = useAdminInboxUnread()

  useEffect(() => {
    if (getCurrentRole() !== 'admin') {
      router.push('/login/admin')
      return
    }

    setAdminName(getAdminName())

    let active = true
      ; (async () => {
        try {
          const data = await getClients()
          if (active) setClients(data)
        } finally {
          if (active) setLoadingClients(false)
        }
      })()

    void fetch('/api/internal/daily-document-reminders', { method: 'POST' }).catch(() => undefined)

    return () => {
      active = false
    }
  }, [router])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch('/api/drive/settings', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const parentFolder = typeof data.parentFolder === 'string' ? data.parentFolder : ''
        if (!active) return
        setDriveParentFolder(parentFolder)
        setNewClientDriveParentFolder(parentFolder)
      } catch {
        // Settings are optional; keep empty if unavailable.
      }
    })()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    setDriveRowFolderNames(prev => {
      const next = { ...prev }
      for (const client of clients) {
        if (!next[client.id]) next[client.id] = client.company || client.name || 'Client'
      }
      return next
    })
    setDriveRowExistingFolders(prev => {
      const next = { ...prev }
      for (const client of clients) {
        if (!next[client.id]) next[client.id] = client.driveFolder || ''
      }
      return next
    })
  }, [clients])

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
      ; (async () => {
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
    if (!newClient.name || !newClient.email || !newClient.company || creatingClient) return
    setCreatingClient(true)
    try {
      const createdClient = await createClient({ ...newClient, advisorName: adminName })
      let driveFolder = newClientDriveExistingFolder.trim()
      const folderName = (newClientDriveFolderName || newClient.company || newClient.name).trim()
      const parentFolder = newClientDriveParentFolder.trim()
      if (!driveFolder && parentFolder && folderName) {
        const res = await fetch('/api/drive/create-folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: createdClient.id, clientName: folderName, parentFolder }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Client was created, but Drive folder creation failed.')
        driveFolder = data.folderUrl
      }
      if (driveFolder) {
        await saveClient({ ...createdClient, driveFolder })
      }
      await refresh()
      setAdding(false)
      setNewClient({
        name: '',
        email: '',
        company: '',
        phone: '',
        businessCategory: '',
        propertyOwnership: '',
        realEstateRunLease: false,
        realEstateRunAppraisal: true,
      })
      setNewClientDriveExistingFolder('')
      setNewClientDriveParentFolder('')
      setNewClientDriveFolderName('')
      setToast({ message: 'Client created — send the portal invitation from the client profile', type: 'success' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create client'
      setToast({ message, type: 'error' })
    } finally {
      setCreatingClient(false)
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

  const disconnectMonday = async () => {
    if (!confirm('Are you sure you want to disconnect Monday.com? This will stop report linking to Monday boards.')) return
    setConnectingMonday(true)
    try {
      const res = await fetch('/api/composio/monday/disconnect', { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      await refreshMondayStatus()
    } catch (err) {
      console.error(err)
      alert('Failed to disconnect Monday.com')
    } finally {
      setConnectingMonday(false)
    }
  }

  const syncDrive = async (clientId?: string) => {
    setShowDriveManager(false)
    closeDrivePicker()
    setSyncingDrive(true)
    setDriveSyncSummary(clientId ? 'Client Google Drive sync started.' : 'Google Drive sync started. This can take more than 10 minutes; you can keep working while it runs.')
    try {
      const res = await fetch('/api/drive/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientId ? { clientId } : {}),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setDriveSyncJob(data)
      setLastSyncUpdate(new Date())
    } catch {
      setDriveSyncSummary('Google Drive sync failed. Confirm Google Drive is connected, then try again.')
      setSyncingDrive(false)
    }
  }

  const persistDriveParentFolder = async () => {
    const trimmed = driveParentFolder.trim()
    if (!trimmed) {
      setDriveManagerMessage('Set a parent folder first.')
      return false
    }
    try {
      const res = await fetch('/api/drive/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentFolder: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to save parent folder.')
      setDriveParentFolder(data.parentFolder || trimmed)
      setNewClientDriveParentFolder(data.parentFolder || trimmed)
      setDriveManagerMessage('Parent folder saved.')
      return true
    } catch (error) {
      setDriveManagerMessage(error instanceof Error ? error.message : 'Failed to save parent folder.')
      return false
    }
  }

  const updateClientDriveFolder = async (client: Client, folderUrl: string) => {
    const trimmed = folderUrl.trim()
    if (!trimmed) return
    setDriveRowBusy(prev => ({ ...prev, [client.id]: 'Saving...' }))
    setDriveManagerMessage('')
    try {
      await saveClient({ ...client, driveFolder: trimmed })
      setDriveRowExistingFolders(prev => ({ ...prev, [client.id]: trimmed }))
      await refresh()
      setDriveManagerMessage(`Drive folder set for ${client.company || client.name}.`)
    } catch (error) {
      setDriveManagerMessage(error instanceof Error ? error.message : 'Failed to set Drive folder.')
    } finally {
      setDriveRowBusy(prev => {
        const next = { ...prev }
        delete next[client.id]
        return next
      })
    }
  }

  const createClientDriveFolder = async (client: Client) => {
    if (!(await persistDriveParentFolder())) return
    const folderName = (driveRowFolderNames[client.id] || client.company || client.name || 'Client').trim()
    if (!folderName) {
      setDriveManagerMessage('Enter a folder name first.')
      return
    }
    setDriveRowBusy(prev => ({ ...prev, [client.id]: 'Creating...' }))
    setDriveManagerMessage('')
    try {
      const res = await fetch('/api/drive/create-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, clientName: folderName, parentFolder: driveParentFolder.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to create Drive folder.')
      await updateClientDriveFolder(client, data.folderUrl)
    } catch (error) {
      setDriveManagerMessage(error instanceof Error ? error.message : 'Failed to create Drive folder.')
    } finally {
      setDriveRowBusy(prev => {
        const next = { ...prev }
        delete next[client.id]
        return next
      })
    }
  }

  const syncClientDrive = async (client: Client) => {
    if (!client.driveFolder) {
      setDriveManagerMessage('Set this client folder before syncing.')
      return
    }
    await syncDrive(client.id)
  }

  const loadDrivePickerFolders = async (
    parent?: { id: string; name: string; url: string } | null,
    nextPath?: Array<{ id: string; name: string; url: string }>,
  ) => {
    setDrivePickerLoading(true)
    setDrivePickerError('')
    try {
      const parentId = parent?.id || 'root'
      const res = await fetch(`/api/drive/folders?parentId=${encodeURIComponent(parentId)}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not load Google Drive folders.')
      setDrivePickerFolders(Array.isArray(data.folders) ? data.folders : [])
      if (nextPath) setDrivePickerPath(nextPath)
    } catch (error) {
      setDrivePickerError(error instanceof Error ? error.message : 'Could not load Google Drive folders.')
      setDrivePickerFolders([])
    } finally {
      setDrivePickerLoading(false)
    }
  }

  const openDrivePicker = (target: DrivePickerTarget) => {
    setDrivePickerTarget(target)
    setDrivePickerPath([])
    void loadDrivePickerFolders(null, [])
  }

  const closeDrivePicker = () => {
    setDrivePickerTarget(null)
    setDrivePickerError('')
  }

  const currentDrivePickerFolder = drivePickerPath[drivePickerPath.length - 1] || null

  const useSelectedDrivePickerFolder = () => {
    if (!currentDrivePickerFolder || !drivePickerTarget) return
    if (drivePickerTarget === 'parent') {
      setDriveParentFolder(currentDrivePickerFolder.url)
      setNewClientDriveParentFolder(currentDrivePickerFolder.url)
      void fetch('/api/drive/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentFolder: currentDrivePickerFolder.url }),
      }).catch(() => undefined)
      setDriveManagerMessage(`Parent folder set to ${currentDrivePickerFolder.name}.`)
    } else if (drivePickerTarget === 'new-parent') {
      setNewClientDriveParentFolder(currentDrivePickerFolder.url)
      setDriveParentFolder(currentDrivePickerFolder.url)
      void fetch('/api/drive/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentFolder: currentDrivePickerFolder.url }),
      }).catch(() => undefined)
    } else if (drivePickerTarget === 'new-existing') {
      setNewClientDriveExistingFolder(currentDrivePickerFolder.url)
    } else {
      const clientId = drivePickerTarget.replace(/^client:/, '')
      setDriveRowExistingFolders(prev => ({ ...prev, [clientId]: currentDrivePickerFolder.url }))
      const client = clients.find(item => item.id === clientId)
      if (client) void updateClientDriveFolder(client, currentDrivePickerFolder.url)
      setDriveManagerMessage(`Selected folder: ${currentDrivePickerFolder.name}.`)
    }
    closeDrivePicker()
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
  const totalMessages = inboxUnreadTotal
  const clientsForDriveManager = [...clients].sort((a, b) => {
    if (!a.driveFolder && b.driveFolder) return -1
    if (a.driveFolder && !b.driveFolder) return 1
    return (a.company || a.name).localeCompare(b.company || b.name)
  })
  const missingDriveFolderCount = clients.filter(client => !client.driveFolder).length

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
            <div className="flex items-center gap-2 flex-wrap">
            <Link href="/admin/sales-leads">
              <Button variant="outline"><BarChart3 className="w-4 h-4" /> Go to Sales Leads Board <ChevronRight className="w-4 h-4" /></Button>
            </Link>
            <Button onClick={() => setAdding(true)}>
              <Plus className="w-4 h-4" /> New Client
            </Button>
            </div>
          </div>

          <GoogleServicesCard onManageFolders={() => setShowDriveManager(true)} />

          {driveSyncSummary ? (
          <Card className="p-5 mb-8 border-cantara-gold/20">
              <div className="rounded-lg border border-slate-200 bg-white/50 backdrop-blur-sm px-4 py-4 text-xs shadow-sm">
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

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-3 border-y border-slate-100">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Clients</p>
                            <p className="text-sm font-bold text-slate-700">
                              {driveSyncJob.summary.clients || 0} <span className="text-slate-300 font-normal">/</span> {driveSyncJob.summary.totalClients || 0}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Assigned</p>
                            <p className="text-sm font-bold text-slate-700">
                              {driveSyncJob.summary.foldersCreatedOrFound || 0}
                              {driveSyncJob.summary.skippedMissingFolder ? (
                                <span className="ml-1 text-xs font-normal text-slate-400">({driveSyncJob.summary.skippedMissingFolder} skipped)</span>
                              ) : null}
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
          </Card>
          ) : null}

          <Modal
            open={showDriveManager}
            onClose={() => setShowDriveManager(false)}
            title="Google Drive folders"
            sizeClassName="max-w-3xl"
          >
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                  <div className="min-w-0 flex-1">
                    <label className="block text-xs font-medium text-slate-600">Parent folder</label>
                    <div className="mt-1.5 flex min-h-[38px] items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2">
                      <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
                      <span className={cn('min-w-0 flex-1 truncate text-sm', driveParentFolder ? 'text-slate-700' : 'text-slate-400')}>
                        {driveParentFolder || 'Choose where missing client folders should be created'}
                      </span>
                      <Button size="sm" variant="outline" onClick={() => openDrivePicker('parent')}>
                        Choose
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-amber-700">
                      {missingDriveFolderCount > 0
                        ? `${missingDriveFolderCount} client${missingDriveFolderCount === 1 ? '' : 's'} need a Drive folder. Link an existing folder or create one inside this parent.`
                        : 'All clients currently have an assigned Drive folder.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={persistDriveParentFolder} disabled={!driveParentFolder.trim()}>
                      Save Parent
                    </Button>
                    <Button onClick={() => void syncDrive()} disabled={syncingDrive}>
                      {syncingDrive ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderOpen className="h-3.5 w-3.5" />}
                      Sync All Now
                    </Button>
                  </div>
                </div>
              </div>
              {driveManagerMessage && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {driveManagerMessage}
                </div>
              )}
              <div className="max-h-[520px] overflow-y-auto rounded-xl border border-slate-200 bg-white">
                {clients.length === 0 ? (
                  <div className="p-4 text-sm text-slate-400">No clients found.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {clientsForDriveManager.map(client => (
                      <div key={client.id} className={cn('px-4 py-4', !client.driveFolder && 'bg-amber-50/50')}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800">{client.company || client.name}</p>
                            {client.name && client.name !== client.company && (
                              <p className="mt-0.5 truncate text-xs text-slate-500">Client: {client.name}</p>
                            )}
                            <p className="mt-0.5 truncate text-xs text-slate-500">
                              {client.driveFolder ? client.driveFolder : 'No Drive folder assigned'}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {client.driveFolder ? <Badge color="green">Assigned</Badge> : <Badge color="gold">Needs folder</Badge>}
                            <Button size="sm" variant="outline" onClick={() => void syncClientDrive(client)} disabled={syncingDrive || !client.driveFolder}>
                              {syncingDrive ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderOpen className="h-3.5 w-3.5" />}
                              Sync now
                            </Button>
                            <Link href={`/admin/client/${client.id}`}>
                              <Button size="sm" variant="outline">
                                <FolderOpen className="h-3.5 w-3.5" />
                                Open
                              </Button>
                            </Link>
                          </div>
                        </div>
                        {!client.driveFolder && (
                          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
                            <div>
                              <label className="block text-xs font-medium text-slate-600">Existing folder</label>
                              <div className="mt-1.5 flex min-h-[38px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                                <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
                                <span className={cn('min-w-0 flex-1 truncate text-sm', driveRowExistingFolders[client.id] ? 'text-slate-700' : 'text-slate-400')}>
                                  {driveRowExistingFolders[client.id] || 'Choose existing folder'}
                                </span>
                                <Button size="sm" variant="outline" onClick={() => openDrivePicker(`client:${client.id}`)}>
                                  Choose
                                </Button>
                              </div>
                            </div>
                            <Input
                              label="Or create folder named"
                              placeholder="Folder name"
                              value={driveRowFolderNames[client.id] || ''}
                              onChange={e => setDriveRowFolderNames(prev => ({ ...prev, [client.id]: e.target.value }))}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => void createClientDriveFolder(client)}
                                disabled={!!driveRowBusy[client.id] || !driveParentFolder.trim() || !(driveRowFolderNames[client.id] || '').trim()}
                                title={!driveParentFolder.trim() ? 'Choose a parent folder first' : !(driveRowFolderNames[client.id] || '').trim() ? 'Enter a folder name first' : undefined}
                              >
                                {driveRowBusy[client.id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                                Create
                              </Button>
                            </div>
                          </div>
                        )}
                        {!client.driveFolder && !driveParentFolder.trim() && (
                          <p className="mt-2 text-xs text-amber-700">
                            Choose a parent folder above before creating this client folder.
                          </p>
                        )}
                        {driveRowBusy[client.id] && (
                          <p className="mt-2 text-xs text-amber-700">{driveRowBusy[client.id]}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Modal>

          <Modal
            open={drivePickerTarget !== null}
            onClose={closeDrivePicker}
            title={drivePickerTarget === 'parent' || drivePickerTarget === 'new-parent' ? 'Choose Parent Folder' : 'Choose Client Folder'}
            sizeClassName="max-w-2xl"
            zIndexClassName="z-[60]"
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                <button
                  type="button"
                  onClick={() => void loadDrivePickerFolders(null, [])}
                  className={cn('font-medium hover:text-amber-700', drivePickerPath.length === 0 ? 'text-slate-800' : 'text-slate-500')}
                >
                  My Drive
                </button>
                {drivePickerPath.map((folder, index) => (
                  <span key={folder.id} className="inline-flex items-center gap-2">
                    <ChevronRight className="h-3 w-3 text-slate-300" />
                    <button
                      type="button"
                      onClick={() => void loadDrivePickerFolders(folder, drivePickerPath.slice(0, index + 1))}
                      className={cn('font-medium hover:text-amber-700', index === drivePickerPath.length - 1 ? 'text-slate-800' : 'text-slate-500')}
                    >
                      {folder.name}
                    </button>
                  </span>
                ))}
              </div>

              <div className="min-h-[260px] max-h-[360px] overflow-y-auto rounded-xl border border-slate-200 bg-white">
                {drivePickerLoading ? (
                  <div className="flex h-40 items-center justify-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading folders...
                  </div>
                ) : drivePickerError ? (
                  <div className="p-4 text-sm text-red-600">{drivePickerError}</div>
                ) : drivePickerFolders.length === 0 ? (
                  <div className="p-4 text-sm text-slate-400">No folders found here.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {drivePickerFolders.map(folder => (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() => void loadDrivePickerFolders(folder, [...drivePickerPath, folder])}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-amber-50"
                      >
                        <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
                        <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  {currentDrivePickerFolder
                    ? `Selected: ${currentDrivePickerFolder.name}`
                    : 'Open a folder, then select the current folder.'}
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={closeDrivePicker}>Cancel</Button>
                  <Button onClick={useSelectedDrivePickerFolder} disabled={!currentDrivePickerFolder}>
                    {drivePickerTarget === 'parent' || drivePickerTarget === 'new-parent' ? 'Use as Parent' : 'Use Folder'}
                  </Button>
                </div>
              </div>
            </div>
          </Modal>

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
            onDisconnect={() => void disconnectMonday()}
            onImport={() => setShowMondayImport(true)}
          />

          {showMondayImport && (
            <MondayImportModal
              onClose={() => setShowMondayImport(false)}
              onImported={() => void refresh()}
            />
          )}


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
                    <ClientCard
                      key={client.id}
                      client={client}
                      delay={i * 0.05}
                      messageUnread={inboxUnreadCounts[client.id] ?? 0}
                    />
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
            Creates the client workspace and emails portal login credentials to the primary contact. Assign a workstream in Client Management to provision their document checklist.
          </p>
          <Input label="Business name *" placeholder="Happy Paws Resort" value={newClient.company} onChange={e => setNewClient(p => ({ ...p, company: e.target.value }))} />
          <Input label="Primary contact name *" placeholder="Jane Smith" value={newClient.name} onChange={e => setNewClient(p => ({ ...p, name: e.target.value }))} />
          <Input label="Email address *" type="email" placeholder="jane@happypaws.com" value={newClient.email} onChange={e => setNewClient(p => ({ ...p, email: e.target.value }))} />
          <Input label="Phone" placeholder="(555) 555-0100" value={newClient.phone} onChange={e => setNewClient(p => ({ ...p, phone: e.target.value }))} />
          <PetBusinessCategoryField
            value={newClient.businessCategory}
            onChange={businessCategory => setNewClient(p => ({ ...p, businessCategory }))}
          />
          <Select
            label="Real estate"
            value={newClient.propertyOwnership}
            onChange={e => {
              const nextVal = e.target.value as '' | 'lease' | 'owns'
              setNewClient(p => ({
                ...p,
                propertyOwnership: nextVal,
                realEstateRunAppraisal: nextVal === 'owns' ? true : p.realEstateRunAppraisal,
              }))
            }}
            options={PROPERTY_OWNERSHIP_OPTIONS}
          />
          {newClient.propertyOwnership === 'owns' && (
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Active Real Estate Agents
                </span>
                <span className="text-[11px] text-amber-800 font-medium bg-amber-100/80 px-2 py-0.5 rounded-full">
                  Owns Real Estate
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Choose which agents to include in the Agents dropdown for this client:
              </p>
              <div className="flex flex-wrap items-center gap-6 pt-1">
                <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newClient.realEstateRunLease}
                    onChange={e => setNewClient(p => ({ ...p, realEstateRunLease: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 accent-amber-600 cursor-pointer"
                  />
                  <span>Run Lease Analysis Agent</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newClient.realEstateRunAppraisal}
                    onChange={e => setNewClient(p => ({ ...p, realEstateRunAppraisal: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 accent-amber-600 cursor-pointer"
                  />
                  <span>Run Real Estate Appraisal Agent</span>
                </label>
              </div>
            </div>
          )}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-800">Google Drive location</h4>
              <p className="mt-1 text-xs text-slate-500">
                Choose an existing folder, or enter a folder name to create under the saved Drive parent.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">Existing client folder</label>
              <div className="mt-1.5 flex min-h-[38px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
                <span className={cn('min-w-0 flex-1 truncate text-sm', newClientDriveExistingFolder ? 'text-slate-700' : 'text-slate-400')}>
                  {newClientDriveExistingFolder || 'Choose existing folder'}
                </span>
                <Button size="sm" variant="outline" onClick={() => openDrivePicker('new-existing')}>
                  Choose
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Input
                label="Create folder named"
                placeholder={newClient.company || 'Client folder name'}
                value={newClientDriveFolderName}
                onChange={e => setNewClientDriveFolderName(e.target.value)}
              />
              {!newClientDriveExistingFolder && newClientDriveFolderName.trim() && !newClientDriveParentFolder.trim() && (
                <p className="text-xs text-amber-700">
                  Set the parent folder from Manage folders before creating new client folders.
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            <Button
              onClick={handleAddClient}
              disabled={
                !newClient.name ||
                !newClient.email ||
                !newClient.company ||
                creatingClient ||
                (!newClientDriveExistingFolder && !!newClientDriveFolderName.trim() && !newClientDriveParentFolder.trim())
              }
            >
              {creatingClient ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              {creatingClient ? 'Creating...' : 'Create & Send Invite'}
            </Button>
          </div>
        </div>
      </Modal>

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

function ClientCard({ client, delay, messageUnread = 0 }: { client: Client; delay: number; messageUnread?: number }) {
  const submitted = Object.values(client.documentStatuses).filter(s => s.fileName).length
  const total = 22 // approximate
  const progress = Math.round((submitted / total) * 100)
  const unread = messageUnread

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
                <span className="w-5 h-5 rounded-full text-xs font-bold text-white flex items-center justify-center" style={{ background: '#ef4444' }}>
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
