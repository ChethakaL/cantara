'use client'

import { useEffect, useRef } from 'react'
import { Send, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui'
import type { ChatMessage } from '@/lib/store'
import { isOwnMessage, type ChatViewerRole } from '@/lib/chat-utils'

export function ChatThread({
  messages,
  viewer,
  draft,
  onDraftChange,
  onSend,
  sending,
  emptyHint,
  placeholder,
  composeRows = 3,
  maxHeightClass = 'max-h-[460px]',
}: {
  messages: ChatMessage[]
  viewer: ChatViewerRole
  draft: string
  onDraftChange: (value: string) => void
  onSend: () => void
  sending: boolean
  emptyHint: string
  placeholder: string
  composeRows?: number
  maxHeightClass?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      const el = containerRef.current
      if (el) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      }
    }, 50)
    return () => clearTimeout(timer)
  }, [messages])

  useEffect(() => {
    const node = composerRef.current
    if (!node) return
    node.style.height = '0px'
    const nextHeight = Math.min(Math.max(node.scrollHeight, 44), 140)
    node.style.height = `${nextHeight}px`
  }, [draft])

  return (
    <>
      <div ref={containerRef} className={`flex-1 overflow-y-auto space-y-3 mb-4 pr-1 ${maxHeightClass}`}>
        {messages.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            <MessageSquare className="w-8 h-8 text-slate-200 mx-auto mb-3" />
            {emptyHint}
          </div>
        ) : (
          messages.map(msg => {
            const own = isOwnMessage(msg, viewer)
            return (
              <div key={msg.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-3 shadow-sm ${
                    own
                      ? 'rounded-br-md text-white'
                      : 'rounded-bl-md bg-white border border-slate-200 text-slate-800'
                  }`}
                  style={own ? { background: 'linear-gradient(135deg, #0d1829 0%, #1a2d4d 100%)' } : {}}
                >
                  <div className={`flex items-center gap-2 mb-1 ${own ? 'flex-row-reverse' : ''}`}>
                    <span className={`text-xs font-medium ${own ? 'text-white/70' : 'text-slate-500'}`}>
                      {own ? 'You' : msg.senderName}
                    </span>
                    <span className={`text-[10px] ${own ? 'text-white/40' : 'text-slate-300'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.message}</p>
                </div>
              </div>
            )
          })
        )}

      </div>

      <div className="border-t border-slate-100 pt-3">
        <textarea
          ref={composerRef}
          placeholder={placeholder}
          value={draft}
          onChange={e => onDraftChange(e.target.value)}
          rows={composeRows}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSend()
            }
          }}
          className="min-h-[44px] w-full resize-none overflow-y-auto rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-slate-400">Enter to send · Shift+Enter for new line</span>
          <Button size="sm" onClick={onSend} disabled={!draft.trim() || sending}>
            <Send className="w-3.5 h-3.5" />
            Send
          </Button>
        </div>
      </div>
    </>
  )
}
