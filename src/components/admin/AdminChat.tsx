'use client'
import { useState, useEffect, useRef } from 'react'
import { Send, MessageSquare } from 'lucide-react'
import { Button, Textarea } from '@/components/ui'
import { getMessages, saveMessage } from '@/lib/store'
import type { ChatMessage } from '@/lib/store'

export default function AdminChat({ clientId, clientName, adminName }: {
  clientId: string
  clientName: string
  adminName: string
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    const data = await getMessages(clientId)
    setMessages(data)
  }

  useEffect(() => {
    load()
    const interval = setInterval(async () => {
        await load()
    }, 3000)
    return () => clearInterval(interval)
  }, [clientId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    if (!draft.trim()) return
    setSending(true)
    const msgDraft = draft.trim()
    setDraft('')
    await saveMessage({
      clientId,
      senderRole: 'admin',
      senderName: adminName,
      message: msgDraft,
      timestamp: new Date().toISOString(),
      readByAdmin: true,
      readByClient: false,
    })
    await load()
    setSending(false)
  }

  const unreadCount = messages.filter(m => m.senderRole === 'client' && !m.readByAdmin).length

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Client Messages
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold text-white" style={{ background: '#b8922a' }}>
                {unreadCount}
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Conversation with {clientName}</p>
        </div>
      </div>

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1" style={{ maxHeight: '460px' }}>
        {messages.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            <MessageSquare className="w-8 h-8 text-slate-200 mx-auto mb-3" />
            No messages yet. Send a message to {clientName}.
          </div>
        ) : messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.senderRole === 'admin' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
              msg.senderRole === 'admin'
                ? 'rounded-br-sm text-white'
                : 'rounded-bl-sm bg-white border border-slate-200 text-slate-800'
            }`} style={msg.senderRole === 'admin' ? { background: '#0d1829' } : {}}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-medium ${msg.senderRole === 'admin' ? 'text-white/60' : 'text-slate-400'}`}>
                  {msg.senderName}
                </span>
                <span className={`text-xs ${msg.senderRole === 'admin' ? 'text-white/40' : 'text-slate-300'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm leading-relaxed">{msg.message}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div className="border-t border-slate-100 pt-4">
        <Textarea
          placeholder={`Reply to ${clientName}...`}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={3}
          onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) send() }}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-slate-400">⌘↵ to send</span>
          <Button size="sm" onClick={send} disabled={!draft.trim() || sending}>
            <Send className="w-3.5 h-3.5" />
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}
