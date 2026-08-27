'use client'

import { useState } from 'react'
import { Copy, Globe, Workflow, X, CheckCircle2, ArrowRight } from 'lucide-react'
import { Button, Card, Badge } from '@/components/ui'

interface MakeConfigModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function MakeConfigModal({ isOpen, onClose }: MakeConfigModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  if (!isOpen) return null

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://advisor.cantarapet.com'
  const sampleWebhookUrl = `${origin}/api/webhooks/automations/make-intake`

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(keyName)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <Card className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-slate-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#21263C] text-orange-400">
              <Workflow className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Make.com Webhook Integration</h2>
              <p className="text-xs text-slate-500">Migrate Make.com scenarios to Cantara webhook listeners</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-amber-900 leading-relaxed">
            Rebuild your 30+ Make.com scenarios by routing HTTP request modules from Make directly into Cantara’s dedicated webhook listeners.
          </div>

          <div className="space-y-2">
            <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">How to connect a Make.com scenario:</h3>
            <ol className="list-decimal pl-4 space-y-1.5 text-slate-600">
              <li>Open your Scenario in Make.com.</li>
              <li>Add an <strong>HTTP &gt; Make a request</strong> module at the trigger or completion step.</li>
              <li>Set Method to <strong>POST</strong> and paste the Cantara Webhook URL below.</li>
              <li>Set Body type to <strong>Raw / JSON</strong> and send your payload.</li>
            </ol>
          </div>

          <div className="space-y-1.5 pt-2">
            <label className="block text-xs font-semibold text-slate-700">Make.com Inbound Webhook URL</label>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={sampleWebhookUrl}
                className="w-full px-3 py-2 text-xs bg-slate-50 text-slate-700 rounded-lg border border-slate-200 font-mono select-all"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(sampleWebhookUrl, 'make_wh_url')}
                className="shrink-0 bg-white"
              >
                <Copy className="w-3.5 h-3.5" />
                {copiedKey === 'make_wh_url' ? 'Copied' : 'Copy URL'}
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end">
          <Button size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </Card>
    </div>
  )
}
