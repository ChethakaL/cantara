'use client'

import { useState } from 'react'
import {
  Copy,
  CheckCircle2,
  Globe,
  Trash2,
  Edit,
  Play,
  X,
  Activity,
  Loader2,
} from 'lucide-react'
import { Badge, Button } from '@/components/ui'
import { AutomationItem } from '@/lib/automations/types'

interface AutomationDetailsDrawerProps {
  item: AutomationItem | null
  isOpen: boolean
  onClose: () => void
  onToggleStatus: (id: string) => void
  onEdit: (item: AutomationItem) => void
  onDelete: (id: string) => void
}

export default function AutomationDetailsDrawer({
  item,
  isOpen,
  onClose,
  onToggleStatus,
  onEdit,
  onDelete,
}: AutomationDetailsDrawerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'curl' | 'logs'>('overview')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [testItemId, setTestItemId] = useState('')
  const [testBoardId, setTestBoardId] = useState('')

  if (!isOpen || !item) return null

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(keyName)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://advisor.cantarapet.com'
  const webhookUrl = item.webhookUrl || `${origin}/api/webhooks/${item.webhookSlug || item.id}`
  const isMondayContract = item.handlerKey === 'contract_send' || item.id === 'contract-send-from-monday'
  const isMondayNda = item.handlerKey === 'nda_send' || item.id === 'nda-send-from-monday'
  const isMondayNdaPrimary =
    item.handlerKey === 'nda_primary_contact' || item.id === 'nda-primary-contact-from-monday'
  const isTeaserApprove =
    item.handlerKey === 'teaser_approve' || item.id === 'teaser-approve-send-to-buyer'
  const isEmbeddedSigning =
    item.handlerKey === 'embedded_signing' || item.id === 'docusign-embedded-signing'
  const isMondayDealSend = isMondayContract || isMondayNda || isMondayNdaPrimary
  const isMondayPulseTest = isMondayDealSend || isTeaserApprove
  const isBuyerNdaSigned =
    item.handlerKey === 'buyer_nda_signed' || item.id === 'buyer-nda-signed-from-docusign'
  const isEnvelopeCompleted =
    item.handlerKey === 'envelope_completed' || item.id === 'docusign-envelope-completed'
  const isDocuSignEnvelopeTest = isEnvelopeCompleted || isBuyerNdaSigned || isEmbeddedSigning

  const curlExample = isMondayPulseTest
    ? `curl -X POST "${webhookUrl}?secret=YOUR_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event": {
      "pulseId": "1234567890",
      "boardId": "${isTeaserApprove ? 'WEBHOOK_BOARD_ID' : '18398612826'}"
    }
  }'`
    : isEmbeddedSigning
      ? `curl -G "${webhookUrl}" \\
  --data-urlencode "envelope=ENVELOPE-GUID-HERE" \\
  --data-urlencode "itemId=MONDAY_ITEM_ID" \\
  --data-urlencode "boardId=MONDAY_BOARD_ID" \\
  --data-urlencode "role=Client"`
    : isBuyerNdaSigned
      ? `curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event": "recipient-completed",
    "data": {
      "envelopeId": "ENVELOPE-GUID-HERE",
      "recipientId": "1"
    },
    "monday": {
      "boardId": "YOUR_BUYERS_BOARD_ID",
      "itemId": "YOUR_MONDAY_ITEM_ID"
    }
  }'`
    : isEnvelopeCompleted
      ? `curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event": "envelope-completed",
    "data": {
      "envelopeId": "ENVELOPE-GUID-HERE",
      "envelopeStatus": "completed"
    }
  }'`
      : `curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{ "event": "sample" }'`

  const handleRunTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      if (isMondayPulseTest) {
        if (!testItemId.trim()) {
          setTestResult('Enter a Monday item id (pulseId) to dry-run.')
          return
        }
        if (isTeaserApprove && !testBoardId.trim()) {
          setTestResult('Enter the Monday boardId from the webhook (dynamic — required).')
          return
        }
        const res = await fetch(`/api/automations/${item.id}/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itemId: testItemId.trim(),
            ...(isTeaserApprove ? { boardId: testBoardId.trim() } : {}),
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setTestResult(data.error || 'Test failed')
          return
        }
        const r = data.result || {}
        setTestResult(
          [
            r.dryRun ? 'DRY-RUN' : 'LIVE',
            r.ok ? 'ok' : 'failed',
            r.boardId ? `board=${r.boardId}` : null,
            r.branch ? `branch=${r.branch}` : null,
            r.templateId ? `template=${r.templateId}` : null,
            r.primaryCompleted === true ? 'primary=completed' : null,
            r.primaryCompleted === false ? 'primary=pending' : null,
            r.skipped ? `skipped: ${r.reason}` : null,
            r.reason && !r.skipped ? r.reason : null,
            r.error || null,
            r.envelopeId ? `envelope=${r.envelopeId}` : null,
          ]
            .filter(Boolean)
            .join(' · ')
        )
      } else if (isDocuSignEnvelopeTest) {
        if (!testItemId.trim()) {
          setTestResult('Enter a DocuSign envelopeId to dry-run.')
          return
        }
        const res = await fetch(`/api/automations/${item.id}/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            envelopeId: testItemId.trim(),
            documentKind: isBuyerNdaSigned || isEmbeddedSigning ? undefined : 'nda',
            ...(isEmbeddedSigning ? { role: 'Client' } : {}),
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setTestResult(data.error || 'Test failed')
          return
        }
        const r = data.result || {}
        setTestResult(
          [
            r.dryRun ? 'DRY-RUN' : 'LIVE',
            r.ok ? 'ok' : 'failed',
            r.documentKind ? `kind=${r.documentKind}` : null,
            r.mondayItemId ? `monday=${r.mondayItemId}` : null,
            r.boardId ? `board=${r.boardId}` : null,
            r.skipped ? `skipped: ${r.reason}` : null,
            r.reason && !r.skipped ? r.reason : null,
            r.error || null,
          ]
            .filter(Boolean)
            .join(' · ')
        )
      } else {
        setTestResult('No live test handler for this automation yet.')
      }
    } catch (e: any) {
      setTestResult(e?.message || 'Test request failed')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-white shadow-2xl flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
            <div className="space-y-1 pr-4">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-slate-800">{item.name}</h3>
                <span
                  className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full ${
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
              </div>
              <p className="text-xs text-slate-500">{item.description || 'No description provided.'}</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 border-b border-slate-100 bg-white flex gap-6 text-xs font-medium text-slate-500">
            {(['overview', 'curl', 'logs'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 border-b-2 transition-colors capitalize ${
                  activeTab === tab
                    ? 'border-cantara-gold text-cantara-navy font-bold'
                    : 'border-transparent hover:text-slate-700'
                }`}
              >
                {tab === 'overview' ? 'Overview & Steps' : tab === 'curl' ? 'cURL & Integration' : `Logs (${item.totalRuns})`}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {testResult && (
              <div className="p-3 bg-slate-50 text-slate-800 text-xs rounded-xl border border-slate-200 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-cantara-gold shrink-0 mt-0.5" />
                <span className="break-words">{testResult}</span>
              </div>
            )}

            {activeTab === 'overview' && (
              <div className="space-y-5">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-cantara-gold" />
                      Webhook Listener URL
                    </span>
                    <Badge color="gold">HTTP POST</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={webhookUrl}
                      className="w-full px-3 py-2 text-xs bg-white text-slate-700 rounded-lg border border-slate-200 font-mono select-all"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(webhookUrl, 'drawer_wh_url')}
                      className="shrink-0 bg-white"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiedKey === 'drawer_wh_url' ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {isTeaserApprove
                      ? 'Point the Monday “Teaser Draft → Approved” webhook here (dynamic boardId + pulseId). Dry-run is on by default.'
                      : isEmbeddedSigning
                        ? 'Gmail “Review & Signing NDA” links point here. Dry-run returns JSON; live returns HTTP 302 to DocuSign.'
                      : isBuyerNdaSigned
                      ? 'Point DocuSign Connect recipient-completed here (prospective buyer NDA). Dry-run is on by default.'
                      : isEnvelopeCompleted
                        ? 'Point DocuSign Connect envelope-completed here. Dry-run is on by default.'
                        : isMondayNdaPrimary
                          ? 'Point the Monday “Send NDA” (primary contact / transaction) webhook here. Dry-run is on by default.'
                          : isMondayNda
                            ? 'Point the Monday “Send NDA” webhook here (replace Make). Dry-run is on by default.'
                            : isMondayContract
                              ? 'Point the Monday “Create Contract” webhook here (replace Make). Dry-run is on by default.'
                              : 'Point the external webhook here. Dry-run may apply depending on the automation.'}
                  </p>
                </div>

                {item.steps && item.steps.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-800">Pipeline steps</div>
                    <ol className="space-y-2">
                      {item.steps.map((step, idx) => (
                        <li
                          key={step.id}
                          className="p-3 rounded-xl border border-slate-100 bg-white text-xs"
                        >
                          <div className="font-semibold text-slate-800">
                            {idx + 1}. {step.title}
                          </div>
                          <div className="text-slate-500 mt-0.5 leading-relaxed">{step.detail}</div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {item.notes && item.notes.length > 0 && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                    {item.notes.map((n, i) => (
                      <div key={i}>• {n}</div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                      Trigger
                    </div>
                    <div className="text-xs font-bold text-slate-800 mt-1 capitalize">
                      {item.triggerType.replace('_', ' ')}
                    </div>
                  </div>
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                      Action
                    </div>
                    <div className="text-xs font-bold text-slate-800 mt-1 capitalize">
                      {item.actionType.replace('_', ' ')}
                    </div>
                  </div>
                </div>

                {isMondayPulseTest && (
                  <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="text-xs font-bold text-slate-800">Dry-run test</div>
                    <p className="text-[11px] text-slate-500">
                      {isTeaserApprove
                        ? 'Needs webhook boardId + pulseId. Does not email or send DocuSign while dry-run is on.'
                        : 'Uses a real Monday item id. Does not send DocuSign while dry-run is enabled.'}
                    </p>
                    {isTeaserApprove && (
                      <input
                        value={testBoardId}
                        onChange={e => setTestBoardId(e.target.value)}
                        placeholder="Monday boardId (from webhook)"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                      />
                    )}
                    <input
                      value={testItemId}
                      onChange={e => setTestItemId(e.target.value)}
                      placeholder="Monday pulseId / item id"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                    />
                  </div>
                )}

                {isDocuSignEnvelopeTest && (
                  <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="text-xs font-bold text-slate-800">Dry-run test</div>
                    <p className="text-[11px] text-slate-500">
                      Enter a DocuSign envelope ID. Does not download/upload while dry-run is on.
                    </p>
                    <input
                      value={testItemId}
                      onChange={e => setTestItemId(e.target.value)}
                      placeholder="DocuSign envelopeId"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                    />
                  </div>
                )}

                <div className="p-4 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-800">Pipeline Status</div>
                    <div className="text-[11px] text-slate-400">Enable or disable processing</div>
                  </div>
                  <Button
                    size="sm"
                    variant={item.status === 'active' ? 'outline' : 'primary'}
                    onClick={() => onToggleStatus(item.id)}
                    className={item.status === 'active' ? 'bg-white' : ''}
                  >
                    {item.status === 'active' ? 'Disable' : 'Enable'}
                  </Button>
                </div>
              </div>
            )}

            {activeTab === 'curl' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Sample cURL</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(curlExample, 'curl_sample')}
                    className="bg-white"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedKey === 'curl_sample' ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <pre className="p-4 bg-[#21263C] text-cantara-sun rounded-xl text-xs font-mono overflow-x-auto leading-relaxed">
                  {curlExample}
                </pre>
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="text-center py-16 px-4 bg-slate-50 rounded-xl border border-slate-200/60">
                <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <div className="text-xs font-bold text-slate-700">No persisted logs yet</div>
                <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                  Server logs print each run. DB execution history can be added next.
                </p>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                onDelete(item.id)
                onClose()
              }}
              disabled={Boolean(item.handlerKey)}
              title={item.handlerKey ? 'Catalog automations cannot be deleted' : undefined}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </Button>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleRunTest} disabled={testing} className="bg-white">
                {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                {testing ? 'Running…' : 'Test (dry-run)'}
              </Button>
              {!item.handlerKey && (
                <Button
                  size="sm"
                  onClick={() => {
                    onEdit(item)
                    onClose()
                  }}
                >
                  <Edit className="w-3.5 h-3.5" />
                  Edit
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
