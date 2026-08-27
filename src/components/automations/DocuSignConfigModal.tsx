'use client'

import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  Copy,
  FileSignature,
  Loader2,
  Unplug,
  X,
  ExternalLink,
} from 'lucide-react'
import { Button, Card } from '@/components/ui'

interface DocuSignConfigModalProps {
  isOpen: boolean
  onClose: () => void
  connected: boolean
  onConnectionChange: () => void
}

export default function DocuSignConfigModal({
  isOpen,
  onClose,
  connected,
  onConnectionChange,
}: DocuSignConfigModalProps) {
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [connectionId, setConnectionId] = useState<string | null>(null)

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://advisor.cantarapet.com'
  const webhookUrl = `${origin}/api/webhooks/docusign`

  useEffect(() => {
    if (!isOpen) return
    setError('')
    void (async () => {
      try {
        const res = await fetch('/api/composio/docusign/status', { cache: 'no-store' })
        const data = await res.json()
        setConnectionId(data.connection?.id ?? null)
      } catch {
        /* ignore */
      }
    })()
  }, [isOpen, connected])

  if (!isOpen) return null

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleConnect = async () => {
    setConnecting(true)
    setError('')
    try {
      const res = await fetch('/api/composio/docusign/connect', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.redirect_url) {
        throw new Error(data.error || 'Could not start DocuSign OAuth.')
      }
      window.location.href = data.redirect_url
    } catch (err: any) {
      setError(err.message || 'Could not start DocuSign OAuth.')
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    setError('')
    try {
      const res = await fetch('/api/composio/docusign/disconnect', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to disconnect DocuSign.')
      onConnectionChange()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect DocuSign.')
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <Card className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#21263C] text-cantara-gold">
              <FileSignature className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">DocuSign Connection</h2>
              <p className="text-xs text-slate-500">
                One global OAuth connection via Composio for Cantara automations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-800 border border-rose-200">
              {error}
            </div>
          )}

          {connected ? (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">DocuSign is connected</div>
                <p className="mt-0.5 text-emerald-800/80 leading-relaxed">
                  Automations can send envelopes and use DocuSign tools through Composio.
                  {connectionId ? (
                    <span className="block mt-1 font-mono text-[10px] text-emerald-700/70">
                      Connection: {connectionId}
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-blue-900 leading-relaxed">
              Click Connect to authorize DocuSign with Composio (Authorization Code Grant). No API
              proxy is used — only Composio tool execution.
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              DocuSign Connect Listener Webhook URL
            </label>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={webhookUrl}
                className="w-full px-3 py-2 text-xs bg-slate-50 text-slate-700 rounded-lg border border-slate-200 font-mono select-all"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={copyWebhook}
                className="shrink-0 bg-white"
              >
                <Copy className="w-3.5 h-3.5" />
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <p className="text-[11px] text-slate-400">
              Paste this URL in DocuSign Admin → Connect to receive envelope-signed events.
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2">
          {connected ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="bg-white text-rose-700 border-rose-200 hover:bg-rose-50"
            >
              {disconnecting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Unplug className="w-3.5 h-3.5" />
              )}
              Disconnect
            </Button>
          ) : (
            <a
              href="https://composio.dev/auth/docusign"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800"
            >
              Setup guide <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={onClose} className="bg-white">
              Close
            </Button>
            {!connected && (
              <Button size="sm" onClick={handleConnect} disabled={connecting} className="gap-1.5">
                {connecting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileSignature className="w-3.5 h-3.5" />
                )}
                Connect DocuSign
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
