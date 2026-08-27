'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Zap,
  ArrowLeft,
  Plus,
  Search,
  FileSignature,
  Copy,
  Power,
  Loader2,
} from 'lucide-react'
import AdminNav from '@/components/admin/AdminNav'
import { Badge, Button, Card, Select } from '@/components/ui'
import { AutomationItem } from '@/lib/automations/types'
import DocuSignConfigModal from '@/components/automations/DocuSignConfigModal'
import AutomationModal from '@/components/automations/AutomationModal'
import AutomationDetailsDrawer from '@/components/automations/AutomationDetailsDrawer'

export default function AdminAutomationsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[hsl(220,18%,96%)] flex items-center justify-center text-sm text-slate-500">
          Loading automations…
        </div>
      }
    >
      <AdminAutomationsPageInner />
    </Suspense>
  )
}

function AdminAutomationsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab =
    searchParams.get('tab') === 'connections' ? 'connections' : 'automations'

  const [activeTab, setActiveTab] = useState<'automations' | 'connections'>(initialTab)
  const [automations, setAutomations] = useState<AutomationItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [triggerFilter, setTriggerFilter] = useState<string>('')
  const [selectedItem, setSelectedItem] = useState<AutomationItem | null>(null)
  const [editingItem, setEditingItem] = useState<AutomationItem | null>(null)

  const [showDocuSignModal, setShowDocuSignModal] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [docusignConnected, setDocusignConnected] = useState(false)
  const [docusignLoading, setDocusignLoading] = useState(true)
  const [docusignConnecting, setDocusignConnecting] = useState(false)
  const [docusignError, setDocusignError] = useState('')
  const [automationsLoading, setAutomationsLoading] = useState(true)

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://advisor.cantarapet.com'

  const refreshAutomations = useCallback(async () => {
    setAutomationsLoading(true)
    try {
      const res = await fetch('/api/automations', { cache: 'no-store' })
      const data = await res.json()
      if (res.ok && Array.isArray(data.automations)) {
        setAutomations(data.automations)
      }
    } catch {
      /* keep empty */
    } finally {
      setAutomationsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshAutomations()
  }, [refreshAutomations])

  const refreshDocuSignStatus = useCallback(async () => {
    setDocusignLoading(true)
    setDocusignError('')
    try {
      const res = await fetch('/api/composio/docusign/status', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        setDocusignConnected(false)
        setDocusignError(data.error || 'Could not load DocuSign status.')
        return
      }
      setDocusignConnected(Boolean(data.connected))
    } catch {
      setDocusignConnected(false)
      setDocusignError('Could not load DocuSign status.')
    } finally {
      setDocusignLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshDocuSignStatus()
  }, [refreshDocuSignStatus])

  // After Composio OAuth callback, land on Connections tab and refresh status.
  useEffect(() => {
    const tab = searchParams.get('tab')
    const docusign = searchParams.get('docusign')
    if (tab === 'connections') setActiveTab('connections')
    if (docusign === 'connected') {
      setActiveTab('connections')
      void refreshDocuSignStatus()
      router.replace('/admin/automations?tab=connections', { scroll: false })
    }
  }, [searchParams, refreshDocuSignStatus, router])

  const copyToClipboard = (text: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleToggleStatus = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setAutomations(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, status: item.status === 'active' ? 'inactive' : 'active' }
          : item
      )
    )
    if (selectedItem?.id === id) {
      setSelectedItem(prev =>
        prev ? { ...prev, status: prev.status === 'active' ? 'inactive' : 'active' } : null
      )
    }
  }

  const handleSaveAutomation = (item: AutomationItem) => {
    setAutomations(prev => {
      const exists = prev.some(a => a.id === item.id)
      if (exists) {
        return prev.map(a => (a.id === item.id ? item : a))
      }
      return [item, ...prev]
    })
    setShowNewModal(false)
    setEditingItem(null)
  }

  const handleDeleteAutomation = (id: string) => {
    setAutomations(prev => prev.filter(a => a.id !== id))
    if (selectedItem?.id === id) setSelectedItem(null)
  }

  const startDocuSignOAuth = async () => {
    setDocusignConnecting(true)
    setDocusignError('')
    try {
      const res = await fetch('/api/composio/docusign/connect', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.redirect_url) {
        throw new Error(data.error || 'Could not start DocuSign OAuth.')
      }
      window.location.href = data.redirect_url
    } catch (err: any) {
      setDocusignError(err.message || 'Could not start DocuSign OAuth.')
      setDocusignConnecting(false)
    }
  }

  const filteredAutomations = automations.filter(item => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.webhookSlug && item.webhookSlug.toLowerCase().includes(searchQuery.toLowerCase()))

    if (!matchesSearch) return false
    if (triggerFilter && item.triggerType !== triggerFilter) return false
    return true
  })

  return (
    <div className="min-h-screen bg-[hsl(220,18%,96%)] pb-12">
      <AdminNav name="Admin Pollack" />

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        <div className="mb-6">
          <Link
            href="/admin"
            className="text-xs text-slate-400 hover:text-slate-700 inline-flex items-center gap-1 mb-2 font-medium"
          >
            <ArrowLeft className="w-3 h-3" /> Back to Admin Overview
          </Link>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#21263C] text-cantara-gold">
              <Zap className="w-4 h-4" />
            </span>
            <h1 className="text-3xl font-light text-slate-800 cantara-serif">Automations</h1>
          </div>
        </div>

        <Card className="p-3 mb-6 bg-white border border-slate-200/80 shadow-xs">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-1.5 p-1 bg-slate-100/80 rounded-xl">
              <button
                onClick={() => setActiveTab('automations')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'automations'
                    ? 'bg-[#21263C] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                Automations
              </button>
              <button
                onClick={() => setActiveTab('connections')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'connections'
                    ? 'bg-[#21263C] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                Connections
              </button>
            </div>

            {activeTab === 'automations' && (
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter automations..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-cantara-gold"
                  />
                </div>

                <div className="min-w-[160px]">
                  <Select
                    aria-label="Filter by trigger"
                    value={triggerFilter}
                    onChange={e => setTriggerFilter(e.target.value)}
                    options={[
                      { value: '', label: 'All Triggers' },
                      { value: 'webhook', label: 'Webhooks' },
                      { value: 'docusign_event', label: 'DocuSign Events' },
                      { value: 'monday_event', label: 'Monday.com Events' },
                      { value: 'scheduled', label: 'Scheduled' },
                    ]}
                    className="text-xs h-8 py-1"
                  />
                </div>
              </div>
            )}
          </div>
        </Card>

        {activeTab === 'automations' && (
          <Card className="overflow-hidden border border-slate-200 bg-white shadow-xs">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Automations List
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700 text-[10px] font-bold">
                  {filteredAutomations.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Click any row to view webhook URL and details
              </p>
            </div>

            {automationsLoading ? (
              <div className="py-20 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
                <span>Loading automations…</span>
              </div>
            ) : filteredAutomations.length === 0 ? (
              <div className="py-20 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <Zap className="w-6 h-6 text-slate-300" />
                <span>No automations created yet.</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingItem(null)
                    setShowNewModal(true)
                  }}
                  className="mt-2 bg-white text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Create First Automation
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-400 font-medium">
                      <th className="px-5 py-3">Automation Name</th>
                      <th className="px-4 py-3">Trigger</th>
                      <th className="px-4 py-3">Target Action</th>
                      <th className="px-4 py-3">Webhook URL / Endpoint</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredAutomations.map(item => {
                      const itemWebhookUrl =
                        item.webhookUrl ||
                        `${origin}/api/webhooks/${item.webhookSlug || item.id}`

                      return (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedItem(item)}
                          className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                        >
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-slate-800 group-hover:text-cantara-navy transition-colors">
                              {item.name}
                            </div>
                            {item.description && (
                              <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                                {item.description}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <Badge color="slate" className="font-medium text-[11px] capitalize">
                              {item.triggerType.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="px-4 py-3.5">
                            <Badge color="gold" className="font-medium text-[11px] capitalize">
                              {item.actionType.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-[11px] text-slate-600">
                            {item.triggerType === 'webhook' ||
                            item.triggerType === 'monday_event' ||
                            item.triggerType === 'docusign_event' ? (
                              <div className="flex items-center gap-1.5">
                                <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 max-w-[220px] truncate">
                                  {itemWebhookUrl}
                                </span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-1.5 py-0 text-[10px] bg-white shrink-0"
                                  onClick={e => copyToClipboard(itemWebhookUrl, item.id, e)}
                                >
                                  <Copy className="w-3 h-3" />
                                  {copiedId === item.id ? 'Copied' : 'Copy'}
                                </Button>
                              </div>
                            ) : (
                              <span>{item.scheduleExpression || 'Event Trigger'}</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full ${
                                item.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-500 border border-slate-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                  item.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'
                                }`}
                              />
                              {item.status === 'active' ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-white text-xs"
                              onClick={e => handleToggleStatus(item.id, e)}
                            >
                              <Power className="w-3 h-3" />
                              {item.status === 'active' ? 'Disable' : 'Enable'}
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {activeTab === 'connections' && (
          <Card className="overflow-hidden border border-slate-200 bg-white shadow-xs p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-2xl bg-[#21263C] text-cantara-gold shrink-0">
                  <FileSignature className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-slate-800">DocuSign eSignature</h3>
                    {docusignLoading ? (
                      <Badge color="slate">Checking…</Badge>
                    ) : docusignConnected ? (
                      <Badge color="green">Connected</Badge>
                    ) : (
                      <Badge color="slate">Not Connected</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
                    Global Composio OAuth for sending NDAs, contracts, and LOIs from Cantara
                    automations. Uses tool execution only (no proxy API).
                  </p>
                  {docusignError && (
                    <p className="text-xs text-rose-600 mt-2 max-w-xl">{docusignError}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {docusignConnected ? (
                  <Button size="sm" variant="outline" onClick={() => setShowDocuSignModal(true)}>
                    Manage Connection
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={startDocuSignOAuth}
                    disabled={docusignConnecting || docusignLoading}
                  >
                    {docusignConnecting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileSignature className="w-3.5 h-3.5" />
                    )}
                    Connect DocuSign
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-cantara-gold" />
                  DocuSign Webhook Listener URL
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Configure this listener URL in your DocuSign Connect settings.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-xs px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-mono select-all">
                  {`${origin}/api/webhooks/docusign`}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={e =>
                    copyToClipboard(`${origin}/api/webhooks/docusign`, 'docusign_main', e)
                  }
                  className="bg-white shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedId === 'docusign_main' ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          </Card>
        )}
      </main>

      <DocuSignConfigModal
        isOpen={showDocuSignModal}
        onClose={() => setShowDocuSignModal(false)}
        connected={docusignConnected}
        onConnectionChange={() => void refreshDocuSignStatus()}
      />

      <AutomationModal
        isOpen={showNewModal}
        onClose={() => {
          setShowNewModal(false)
          setEditingItem(null)
        }}
        onSave={handleSaveAutomation}
        initialData={editingItem}
      />

      <AutomationDetailsDrawer
        item={selectedItem}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        onToggleStatus={id => handleToggleStatus(id)}
        onEdit={item => {
          setEditingItem(item)
          setShowNewModal(true)
        }}
        onDelete={handleDeleteAutomation}
      />
    </div>
  )
}
