'use client'

import { useState } from 'react'
import {
  Zap,
  Plus,
  Search,
  Copy,
  CheckCircle2,
  Globe,
  Clock,
  ExternalLink,
  ChevronRight,
  Filter,
  FileSignature,
  Activity,
  Layers,
  Power,
  RefreshCw,
} from 'lucide-react'
import { Badge, Button, Card, Input } from '@/components/ui'
import { AutomationItem } from '@/lib/automations/types'
import DocuSignConnectionCard from './DocuSignConnectionCard'
import AutomationModal from './AutomationModal'
import AutomationDetailsDrawer from './AutomationDetailsDrawer'

export default function AutomationsTab({
  automations,
  setAutomations,
  onOpenNewModal,
}: {
  automations: AutomationItem[]
  setAutomations: React.Dispatch<React.SetStateAction<AutomationItem[]>>
  onOpenNewModal?: () => void
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'active' | 'inactive' | 'webhook' | 'scheduled'>('all')
  const [selectedItem, setSelectedItem] = useState<AutomationItem | null>(null)
  const [editingItem, setEditingItem] = useState<AutomationItem | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

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

  const handleSaveItem = (item: AutomationItem) => {
    setAutomations(prev => {
      const exists = prev.some(a => a.id === item.id)
      if (exists) {
        return prev.map(a => (a.id === item.id ? item : a))
      }
      return [item, ...prev]
    })
    setSelectedItem(null)
    setEditingItem(null)
  }

  const handleDeleteItem = (id: string) => {
    setAutomations(prev => prev.filter(a => a.id !== id))
    if (selectedItem?.id === id) {
      setSelectedItem(null)
    }
  }

  const filtered = automations.filter(item => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.webhookSlug && item.webhookSlug.toLowerCase().includes(searchQuery.toLowerCase()))

    if (!matchesSearch) return false

    if (filterType === 'active') return item.status === 'active'
    if (filterType === 'inactive') return item.status === 'inactive'
    if (filterType === 'webhook') return item.triggerType === 'webhook'
    if (filterType === 'scheduled') return item.triggerType === 'scheduled'
    return true
  })

  const stats = {
    total: automations.length,
    active: automations.filter(a => a.status === 'active').length,
    webhooks: automations.filter(a => a.triggerType === 'webhook').length,
    totalRuns: automations.reduce((acc, a) => acc + (a.totalRuns || 0), 0),
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://advisor.cantarapet.com'

  return (
    <div className="space-y-8">
      {/* DocuSign Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Document & Signature Integration
          </h3>
        </div>
        <DocuSignConnectionCard />
      </div>

      {/* Automations Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Zap className="w-4 h-4 text-cantara-gold" />
              Automations & Webhooks
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage incoming Make.com webhooks, scheduled triggers, and automation pipelines.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditingItem(null)
              setShowModal(true)
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            New Automation
          </Button>
        </div>

        {/* Stats summary banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-4 border-slate-200/80 bg-white">
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Total Automations</div>
            <div className="text-xl font-semibold text-slate-800 mt-1">{stats.total}</div>
          </Card>
          <Card className="p-4 border-slate-200/80 bg-white">
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Active Pipelines</div>
            <div className="text-xl font-semibold text-emerald-600 mt-1">{stats.active}</div>
          </Card>
          <Card className="p-4 border-slate-200/80 bg-white">
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Webhook Endpoints</div>
            <div className="text-xl font-semibold text-amber-600 mt-1">{stats.webhooks}</div>
          </Card>
          <Card className="p-4 border-slate-200/80 bg-white">
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Total Runs</div>
            <div className="text-xl font-semibold text-slate-700 mt-1">{stats.totalRuns}</div>
          </Card>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {(
              [
                { key: 'all', label: 'All' },
                { key: 'active', label: 'Active' },
                { key: 'inactive', label: 'Inactive' },
                { key: 'webhook', label: 'Webhooks' },
                { key: 'scheduled', label: 'Scheduled' },
              ] as const
            ).map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilterType(tab.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  filterType === tab.key
                    ? 'bg-cantara-navy text-cantara-sun shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="w-full sm:w-72">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search automations or endpoints..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white outline-none focus:border-cantara-gold focus:ring-2 focus:ring-cantara-gold/20 transition-all"
              />
            </div>
          </div>
        </div>

        {/* List or Empty state */}
        {filtered.length === 0 ? (
          <Card className="p-12 text-center border-dashed border-2 border-slate-200 bg-white/70">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background: 'linear-gradient(135deg, rgba(202,161,95,0.15), rgba(33,38,60,0.08))' }}
            >
              <Zap className="w-6 h-6 text-cantara-navy/70" />
            </div>
            <h4 className="text-sm font-semibold text-slate-800">
              {searchQuery ? 'No matching automations found' : 'No Automations Created Yet'}
            </h4>
            <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
              {searchQuery
                ? `No results match "${searchQuery}". Try a different search term or filter.`
                : 'Create your first automation or webhook endpoint to start receiving events from Make.com, DocuSign, or custom triggers.'}
            </p>
            {!searchQuery && (
              <Button
                size="sm"
                className="mt-5"
                onClick={() => {
                  setEditingItem(null)
                  setShowModal(true)
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                Create First Automation
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(item => {
              const itemWebhookUrl =
                item.webhookUrl || `${origin}/api/webhooks/automations/${item.webhookSlug || item.id}`

              return (
                <Card
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className="p-4 border-slate-200 hover:border-cantara-gold/50 cursor-pointer transition-all hover:shadow-sm bg-white"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                        style={{
                          background:
                            item.triggerType === 'webhook'
                              ? 'linear-gradient(135deg, rgba(202,161,95,0.15), rgba(33,38,60,0.1))'
                              : 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(33,38,60,0.1))',
                        }}
                      >
                        {item.triggerType === 'webhook' ? (
                          <Globe className="w-5 h-5 text-cantara-navy" />
                        ) : item.triggerType === 'scheduled' ? (
                          <Clock className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Zap className="w-5 h-5 text-cantara-gold" />
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold text-slate-800">{item.name}</h4>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
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
                          <Badge color="slate" className="capitalize">
                            {item.triggerType.replace('_', ' ')}
                          </Badge>
                          <Badge color="gold" className="capitalize">
                            {item.actionType.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-1">
                          {item.description || 'No description provided.'}
                        </p>

                        {/* Webhook URL preview box if webhook */}
                        {item.triggerType === 'webhook' && (
                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                              {itemWebhookUrl}
                            </span>
                            <button
                              type="button"
                              onClick={e => copyToClipboard(itemWebhookUrl, item.id, e)}
                              className="text-[11px] font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1 hover:underline"
                            >
                              <Copy className="w-3 h-3" />
                              {copiedId === item.id ? 'Copied' : 'Copy URL'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:self-center shrink-0">
                      <Button
                        size="sm"
                        variant={item.status === 'active' ? 'outline' : 'ghost'}
                        onClick={e => handleToggleStatus(item.id, e)}
                        className={item.status === 'active' ? 'text-emerald-700 border-emerald-200 hover:bg-emerald-50' : 'text-slate-500'}
                      >
                        <Power className="w-3.5 h-3.5" />
                        {item.status === 'active' ? 'Enabled' : 'Disabled'}
                      </Button>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal to Create/Edit */}
      <AutomationModal
        open={showModal}
        onClose={() => {
          setShowModal(false)
          setEditingItem(null)
        }}
        onSave={handleSaveItem}
        initialData={editingItem}
      />

      {/* Details Drawer */}
      <AutomationDetailsDrawer
        open={!!selectedItem}
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onToggleStatus={id => handleToggleStatus(id)}
        onEdit={item => {
          setEditingItem(item)
          setShowModal(true)
        }}
        onDelete={id => handleDeleteItem(id)}
      />
    </div>
  )
}
