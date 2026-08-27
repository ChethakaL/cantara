'use client'

import { useState, useEffect } from 'react'
import { Copy, Globe, Clock, Zap, X, Save, CheckCircle2, KeyRound } from 'lucide-react'
import { Button, Card, Input, Select, Badge } from '@/components/ui'
import { AutomationItem, TriggerType, ActionType } from '@/lib/automations/types'

interface AutomationModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (item: AutomationItem) => void
  initialData?: AutomationItem | null
}

const TRIGGER_OPTIONS: { value: TriggerType; label: string }[] = [
  { value: 'webhook', label: 'Incoming Webhook (Make.com / External HTTP)' },
  { value: 'docusign_event', label: 'DocuSign Event (Contract / LOI Signed)' },
  { value: 'monday_event', label: 'Monday.com Event (Board Column / Status Change)' },
  { value: 'client_event', label: 'Client Milestone (Portal / Document Uploaded)' },
  { value: 'scheduled', label: 'Scheduled Cron Interval' },
]

const ACTION_OPTIONS: { value: ActionType; label: string }[] = [
  { value: 'run_agent', label: 'Execute Workstream AI Agent (Valuation, WS1, WS2)' },
  { value: 'send_email', label: 'Send Email Notification / Invitation' },
  { value: 'sync_monday', label: 'Sync Board Item with Monday.com' },
  { value: 'call_webhook', label: 'Relay Payload to Outbound Webhook' },
  { value: 'custom_handler', label: 'Custom Document Processing Pipeline' },
]

export default function AutomationModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: AutomationModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [triggerType, setTriggerType] = useState<TriggerType>('webhook')
  const [actionType, setActionType] = useState<ActionType>('run_agent')
  const [actionTarget, setActionTarget] = useState('')
  const [scheduleExpression, setScheduleExpression] = useState('0 9 * * 1-5')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [webhookSlug, setWebhookSlug] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (initialData) {
      setName(initialData.name)
      setDescription(initialData.description || '')
      setTriggerType(initialData.triggerType)
      setActionType(initialData.actionType)
      setActionTarget(initialData.actionTarget || '')
      setScheduleExpression(initialData.scheduleExpression || '0 9 * * 1-5')
      setStatus(initialData.status)
      setWebhookSlug(initialData.webhookSlug || '')
      setWebhookSecret(initialData.webhookSecret || '')
    } else {
      setName('')
      setDescription('')
      setTriggerType('webhook')
      setActionType('run_agent')
      setActionTarget('')
      setScheduleExpression('0 9 * * 1-5')
      setStatus('active')
      const randomSlug = 'wh_' + Math.random().toString(36).substring(2, 9)
      const randomSecret = 'sec_' + Math.random().toString(36).substring(2, 18)
      setWebhookSlug(randomSlug)
      setWebhookSecret(randomSecret)
    }
    setError('')
  }, [initialData, isOpen])

  if (!isOpen) return null

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://advisor.cantarapet.com'
  const generatedWebhookUrl = `${origin}/api/webhooks/automations/${webhookSlug || 'endpoint'}`

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(keyName)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please provide an automation name.')
      return
    }

    const item: AutomationItem = {
      id: initialData?.id || 'auto_' + Math.random().toString(36).substring(2, 9),
      name: name.trim(),
      description: description.trim(),
      status,
      triggerType,
      actionType,
      actionTarget: actionTarget.trim(),
      scheduleExpression: triggerType === 'scheduled' ? scheduleExpression : undefined,
      webhookSlug: triggerType === 'webhook' ? webhookSlug : undefined,
      webhookUrl: triggerType === 'webhook' ? generatedWebhookUrl : undefined,
      webhookSecret: triggerType === 'webhook' ? webhookSecret : undefined,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      lastTriggeredAt: initialData?.lastTriggeredAt || null,
      totalRuns: initialData?.totalRuns || 0,
      successCount: initialData?.successCount || 0,
      errorCount: initialData?.errorCount || 0,
    }

    onSave(item)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <Card className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-slate-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#21263C] text-cantara-gold">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                {initialData ? 'Edit Automation Pipeline' : 'Create New Automation'}
              </h2>
              <p className="text-xs text-slate-500">Configure triggers, webhooks, and execution actions</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
              {error}
            </div>
          )}

          <Input
            label="Automation Pipeline Name"
            placeholder="e.g. Make.com Deal Intake Webhook, DocuSign LOI Trigger"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">Description (Optional)</label>
            <textarea
              className="w-full px-3 py-2 text-xs text-slate-800 rounded-lg border border-slate-200 outline-none focus:border-cantara-gold focus:ring-2 focus:ring-cantara-gold/20"
              rows={2}
              placeholder="Briefly describe what this automation or webhook does..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="Trigger Source"
              value={triggerType}
              onChange={e => setTriggerType(e.target.value as TriggerType)}
              options={TRIGGER_OPTIONS}
            />

            <Select
              label="Status"
              value={status}
              onChange={e => setStatus(e.target.value as 'active' | 'inactive')}
              options={[
                { value: 'active', label: 'Active (Enabled)' },
                { value: 'inactive', label: 'Inactive (Disabled)' },
              ]}
            />
          </div>

          {/* Webhook endpoint generated */}
          {triggerType === 'webhook' && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-cantara-gold" />
                  Generated Webhook Listener URL
                </span>
                <Badge color="gold">HTTP POST</Badge>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-slate-500">Listener URL (Use in Make.com HTTP module)</label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={generatedWebhookUrl}
                    className="w-full px-3 py-2 text-xs bg-white text-slate-700 rounded-lg border border-slate-200 font-mono select-all"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(generatedWebhookUrl, 'modal_wh')}
                    className="shrink-0 bg-white"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedKey === 'modal_wh' ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-slate-500">Secret Token</label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={webhookSecret}
                    className="w-full px-3 py-1.5 text-xs bg-white text-slate-700 rounded-lg border border-slate-200 font-mono select-all"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(webhookSecret, 'modal_sec')}
                    className="shrink-0 bg-white"
                  >
                    <Copy className="w-3 h-3" />
                    {copiedKey === 'modal_sec' ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Scheduled cron */}
          {triggerType === 'scheduled' && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cantara-gold" />
                Schedule Cron Expression
              </span>
              <Input
                placeholder="e.g. 0 9 * * 1-5 (Every weekday at 9:00 AM)"
                value={scheduleExpression}
                onChange={e => setScheduleExpression(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-3 pt-2">
            <Select
              label="Action to Execute"
              value={actionType}
              onChange={e => setActionType(e.target.value as ActionType)}
              options={ACTION_OPTIONS}
            />

            <Input
              label="Action Target / Agent Parameter (Optional)"
              placeholder="e.g. Valuation Agent, WS1 Litigation, CIM Generator"
              value={actionTarget}
              onChange={e => setActionTarget(e.target.value)}
            />
          </div>

          {/* Footer */}
          <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="bg-white">
              Cancel
            </Button>
            <Button type="submit" size="sm" className="gap-1.5">
              <Save className="w-3.5 h-3.5" />
              {initialData ? 'Save Changes' : 'Create Automation'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
