'use client'

import { useState } from 'react'
import {
  FileSignature,
  Workflow,
  Trello,
  Mail,
  MessageSquare,
  Globe2,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Zap,
  Layers,
  ArrowUpRight,
  Server,
  Plus,
} from 'lucide-react'
import { Badge, Button, Card, Input, Modal, Select } from '@/components/ui'
import DocuSignConnectionCard from './DocuSignConnectionCard'

interface ConnectionIntegration {
  id: string
  name: string
  category: string
  description: string
  icon: any
  status: 'connected' | 'not_connected' | 'configured'
  badgeLabel?: string
  docsUrl?: string
}

export default function ConnectionsTab() {
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const integrations: ConnectionIntegration[] = [
    {
      id: 'docusign',
      name: 'DocuSign eSignature',
      category: 'E-Signatures & Contracts',
      description: 'Automate envelope dispatch, client signature tracking, LOIs, and document completion webhooks.',
      icon: FileSignature,
      status: 'configured',
      badgeLabel: 'eSignature API',
    },
    {
      id: 'make',
      name: 'Make.com (Integromat)',
      category: 'Workflow Automation',
      description: 'Receive webhook payloads from Make.com scenarios or trigger outbound HTTP scenario runs.',
      icon: Workflow,
      status: 'configured',
      badgeLabel: 'Webhooks & REST',
    },
    {
      id: 'monday',
      name: 'Monday.com Work OS',
      category: 'CRM & Board Sync',
      description: 'Bi-directional synchronization for sales leads, client stages, document statuses, and deal boards.',
      icon: Trello,
      status: 'connected',
      badgeLabel: 'GraphQL API',
    },
    {
      id: 'google',
      name: 'Google Workspace (Gmail & Drive)',
      category: 'Email & Cloud Storage',
      description: 'Sync client briefs to Google Drive folders, send onboarding emails via Gmail, and manage shared assets.',
      icon: Mail,
      status: 'connected',
      badgeLabel: 'Google Cloud API',
    },
    {
      id: 'slack',
      name: 'Slack Notifications',
      category: 'Team Communication',
      description: 'Post automated notifications to deal channels when high-value leads arrive or contracts are completed.',
      icon: MessageSquare,
      status: 'not_connected',
      badgeLabel: 'Incoming Webhooks',
    },
    {
      id: 'custom_webhook',
      name: 'Custom REST Endpoints',
      category: 'Developer APIs',
      description: 'Create custom secret-authenticated endpoints for inbound HTTP requests from any external platform.',
      icon: Globe2,
      status: 'configured',
      badgeLabel: 'Custom Webhooks',
    },
  ]

  const filtered = integrations.filter(
    item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-8">
      {/* Featured DocuSign Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Primary Document Gateway
          </h3>
        </div>
        <DocuSignConnectionCard />
      </div>

      {/* All Integrations Catalog */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cantara-gold" />
              Connected Platforms & Integrations
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure credentials, API tokens, and webhook listeners for third-party services.
            </p>
          </div>
          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white outline-none focus:border-cantara-gold focus:ring-2 focus:ring-cantara-gold/20"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(item => {
            const Icon = item.icon
            return (
              <Card
                key={item.id}
                className="p-5 border-slate-200 bg-white flex flex-col justify-between hover:border-cantara-gold/40 transition-all shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'linear-gradient(135deg, rgba(202,161,95,0.12), rgba(33,38,60,0.08))' }}
                    >
                      <Icon className="w-5 h-5 text-cantara-navy" />
                    </div>
                    <div>
                      {item.status === 'connected' ? (
                        <Badge color="green">Connected</Badge>
                      ) : item.status === 'configured' ? (
                        <Badge color="gold">Active Endpoint</Badge>
                      ) : (
                        <Badge color="slate">Not Connected</Badge>
                      )}
                    </div>
                  </div>

                  <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                    {item.category}
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800 mt-0.5">{item.name}</h4>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{item.description}</p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-400">{item.badgeLabel}</span>
                  <Button
                    size="sm"
                    variant={item.status === 'connected' ? 'outline' : 'ghost'}
                    className="text-xs"
                    onClick={() => setSelectedIntegration(item.id)}
                  >
                    Configure
                    <ArrowUpRight className="w-3 h-3" />
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Integration config placeholder modal */}
      {selectedIntegration && selectedIntegration !== 'docusign' && (
        <Modal
          open={!!selectedIntegration}
          onClose={() => setSelectedIntegration(null)}
          title={`Configure ${integrations.find(i => i.id === selectedIntegration)?.name}`}
          sizeClassName="max-w-md"
        >
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 leading-relaxed">
              Configure connection settings and credentials for this service.
            </div>
            <Input label="API Key / Access Token" type="password" placeholder="Enter API secret token" />
            <Input label="Webhook Secret / Signing Key" type="password" placeholder="Enter webhook secret" />
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setSelectedIntegration(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => setSelectedIntegration(null)}>
                Save Settings
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
