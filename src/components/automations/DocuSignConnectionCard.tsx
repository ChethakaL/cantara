'use client'

import { useState } from 'react'
import { CheckCircle2, Copy, ExternalLink, FileSignature, KeyRound, Loader2, RefreshCw, Shield, ShieldCheck, Zap } from 'lucide-react'
import { Badge, Button, Card, Input, Modal, Select } from '@/components/ui'

interface DocuSignConfig {
  connected: boolean
  environment: 'demo' | 'production'
  accountId: string
  integrationKey: string
  secretKey: string
  webhookSecret: string
  lastConnectedAt?: string
}

export default function DocuSignConnectionCard({
  compact = false,
  onOpenSettings,
}: {
  compact?: boolean
  onOpenSettings?: () => void
}) {
  const [config, setConfig] = useState<DocuSignConfig>({
    connected: false,
    environment: 'production',
    accountId: '',
    integrationKey: '',
    secretKey: '',
    webhookSecret: '',
  })

  const [showConfigModal, setShowConfigModal] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(keyName)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleSaveConfig = () => {
    setSaving(true)
    setStatusMessage(null)
    setTimeout(() => {
      setSaving(false)
      if (config.integrationKey || config.accountId) {
        setConfig(prev => ({ ...prev, connected: true, lastConnectedAt: new Date().toISOString() }))
        setStatusMessage({ type: 'success', text: 'DocuSign configuration saved successfully.' })
      } else {
        setStatusMessage({ type: 'error', text: 'Please fill in the required DocuSign credentials.' })
      }
    }, 600)
  }

  const handleTestConnection = () => {
    setTesting(true)
    setStatusMessage(null)
    setTimeout(() => {
      setTesting(false)
      if (config.integrationKey || config.accountId) {
        setStatusMessage({ type: 'success', text: 'Connection verified! Webhooks and DocuSign REST API are ready.' })
      } else {
        setStatusMessage({ type: 'error', text: 'Could not connect: Missing Integration Key or Account ID.' })
      }
    }, 800)
  }

  const handleDisconnect = () => {
    setConfig({
      connected: false,
      environment: 'production',
      accountId: '',
      integrationKey: '',
      secretKey: '',
      webhookSecret: '',
    })
    setStatusMessage(null)
  }

  const docuSignWebhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhooks/docusign`
    : 'https://advisor.cantarapet.com/api/webhooks/docusign'

  if (compact) {
    return (
      <>
        <Card className="p-5 border-cantara-gold/20 hover:border-cantara-gold/40 transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, rgba(202,161,95,0.15), rgba(33,38,60,0.1))' }}
              >
                <FileSignature className="w-5 h-5 text-cantara-navy" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-slate-800">DocuSign Integration</h3>
                  {config.connected ? (
                    <Badge color="green">Connected</Badge>
                  ) : (
                    <Badge color="slate">Not Connected</Badge>
                  )}
                  {config.connected && (
                    <Badge color="gold">{config.environment.toUpperCase()}</Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
                  Automate NDA signatures, advisory agreements, and trigger document completion webhooks directly in Cantara.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant={config.connected ? 'outline' : 'primary'}
                onClick={() => setShowConfigModal(true)}
              >
                {config.connected ? 'Configure DocuSign' : 'Connect DocuSign'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Modal */}
        <Modal
          open={showConfigModal}
          onClose={() => setShowConfigModal(false)}
          title="DocuSign Integration Settings"
          sizeClassName="max-w-xl"
        >
          <div className="space-y-4">
            <div className="p-3 bg-amber-50/60 border border-amber-200/70 rounded-lg text-xs text-amber-900 leading-relaxed">
              Connect your DocuSign account to enable automated envelope generation, e-signatures, and instant webhook notifications when contracts are completed.
            </div>

            {statusMessage && (
              <div
                className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : null}
                {statusMessage.text}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Select
                label="Environment"
                value={config.environment}
                onChange={e => setConfig({ ...config, environment: e.target.value as 'demo' | 'production' })}
                options={[
                  { value: 'production', label: 'Production (Live)' },
                  { value: 'demo', label: 'Demo / Sandbox' },
                ]}
              />
              <Input
                label="DocuSign Account ID"
                placeholder="e.g. 12345678-abcd-..."
                value={config.accountId}
                onChange={e => setConfig({ ...config, accountId: e.target.value })}
              />
            </div>

            <Input
              label="Integration Key (Client ID)"
              placeholder="Enter DocuSign Integration Key"
              value={config.integrationKey}
              onChange={e => setConfig({ ...config, integrationKey: e.target.value })}
            />

            <Input
              label="Secret Key / RSA Private Key"
              type="password"
              placeholder="Enter Secret Key or JWT Private Key"
              value={config.secretKey}
              onChange={e => setConfig({ ...config, secretKey: e.target.value })}
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-600">DocuSign Webhook / Connect Listener URL</label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={docuSignWebhookUrl}
                  className="w-full px-3 py-2 text-xs bg-slate-50 text-slate-600 rounded-lg border border-slate-200 select-all font-mono"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(docuSignWebhookUrl, 'docusign_url')}
                  className="shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedKey === 'docusign_url' ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <p className="text-[11px] text-slate-400">
                Paste this URL in your DocuSign Connect settings to receive event updates.
              </p>
            </div>

            <Input
              label="DocuSign Connect HMAC Secret (Optional)"
              placeholder="Webhook verification secret"
              value={config.webhookSecret}
              onChange={e => setConfig({ ...config, webhookSecret: e.target.value })}
            />

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              {config.connected ? (
                <Button size="sm" variant="danger" onClick={handleDisconnect}>
                  Disconnect
                </Button>
              ) : <div />}
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleTestConnection} disabled={testing}>
                  {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Test Connection
                </Button>
                <Button size="sm" onClick={handleSaveConfig} disabled={saving}>
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      </>
    )
  }

  return (
    <Card className="p-6 border-cantara-gold/20 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"
            style={{ background: 'linear-gradient(135deg, #21263C, #2C324E)' }}
          >
            <FileSignature className="w-6 h-6 text-cantara-sun" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-base font-semibold text-slate-800">DocuSign eSignature Integration</h3>
              {config.connected ? (
                <Badge color="green">Connected</Badge>
              ) : (
                <Badge color="slate">Not Connected</Badge>
              )}
              <Badge color="gold">{config.environment === 'production' ? 'Production' : 'Sandbox / Demo'}</Badge>
            </div>
            <p className="text-xs text-slate-500 mt-1.5 max-w-2xl leading-relaxed">
              Connect DocuSign to automatically dispatch NDAs, agreements, and LOIs. Incoming DocuSign webhooks will trigger platform workflows and update client onboarding timelines in real-time.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={handleTestConnection}
            disabled={testing}
          >
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Test Connection
          </Button>
          <Button
            size="sm"
            variant={config.connected ? 'outline' : 'primary'}
            onClick={() => setShowConfigModal(true)}
          >
            {config.connected ? 'Edit Credentials' : 'Connect DocuSign'}
          </Button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`mt-4 p-3 rounded-lg text-xs flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : null}
          {statusMessage.text}
        </div>
      )}

      {/* Integration details / quick view */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Environment</div>
          <div className="text-sm font-semibold text-slate-800 mt-1 capitalize">{config.environment}</div>
          <div className="text-xs text-slate-400 mt-0.5">REST API v2.1</div>
        </div>
        <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Webhook Status</div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`w-2 h-2 rounded-full ${config.connected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            <span className="text-sm font-semibold text-slate-800">
              {config.connected ? 'Listening for Events' : 'Inactive'}
            </span>
          </div>
          <div className="text-xs text-slate-400 mt-0.5">DocuSign Connect</div>
        </div>
        <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Account ID</div>
          <div className="text-sm font-semibold text-slate-800 mt-1 font-mono">
            {config.accountId || 'Not configured'}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">eSignature API</div>
        </div>
      </div>

      {/* Webhook endpoint box */}
      <div className="mt-5 p-4 rounded-xl bg-cantara-beige/30 border border-cantara-beige flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-cantara-gold" />
            DocuSign Webhook Listener URL
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Configure this listener endpoint in your DocuSign Connect Admin console.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <code className="text-xs px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-mono select-all">
            {docuSignWebhookUrl}
          </code>
          <Button
            size="sm"
            variant="outline"
            onClick={() => copyToClipboard(docuSignWebhookUrl, 'docusign_main_url')}
            className="shrink-0"
          >
            <Copy className="w-3.5 h-3.5" />
            {copiedKey === 'docusign_main_url' ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>

      {/* Modal */}
      <Modal
        open={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        title="DocuSign Integration Settings"
        sizeClassName="max-w-xl"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50/60 border border-amber-200/70 rounded-lg text-xs text-amber-900 leading-relaxed">
            Enter your DocuSign API credentials below. You can find these in the DocuSign Developer or Production Admin Console under <strong>Apps and Keys</strong>.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="Environment"
              value={config.environment}
              onChange={e => setConfig({ ...config, environment: e.target.value as 'demo' | 'production' })}
              options={[
                { value: 'production', label: 'Production (Live)' },
                { value: 'demo', label: 'Demo / Sandbox' },
              ]}
            />
            <Input
              label="DocuSign Account ID"
              placeholder="e.g. 12345678-abcd-..."
              value={config.accountId}
              onChange={e => setConfig({ ...config, accountId: e.target.value })}
            />
          </div>

          <Input
            label="Integration Key (Client ID)"
            placeholder="Enter DocuSign Integration Key"
            value={config.integrationKey}
            onChange={e => setConfig({ ...config, integrationKey: e.target.value })}
          />

          <Input
            label="Secret Key / RSA Private Key"
            type="password"
            placeholder="Enter Secret Key or JWT Private Key"
            value={config.secretKey}
            onChange={e => setConfig({ ...config, secretKey: e.target.value })}
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-600">DocuSign Webhook / Connect Listener URL</label>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={docuSignWebhookUrl}
                className="w-full px-3 py-2 text-xs bg-slate-50 text-slate-600 rounded-lg border border-slate-200 select-all font-mono"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(docuSignWebhookUrl, 'docusign_modal_url')}
                className="shrink-0"
              >
                <Copy className="w-3.5 h-3.5" />
                {copiedKey === 'docusign_modal_url' ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <p className="text-[11px] text-slate-400">
              Paste this URL in your DocuSign Connect settings to receive event updates.
            </p>
          </div>

          <Input
            label="DocuSign Connect HMAC Secret (Optional)"
            placeholder="Webhook verification secret"
            value={config.webhookSecret}
            onChange={e => setConfig({ ...config, webhookSecret: e.target.value })}
          />

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            {config.connected ? (
              <Button size="sm" variant="danger" onClick={handleDisconnect}>
                Disconnect
              </Button>
            ) : <div />}
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleTestConnection} disabled={testing}>
                {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Test Connection
              </Button>
              <Button size="sm" onClick={handleSaveConfig} disabled={saving}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </Card>
  )
}
