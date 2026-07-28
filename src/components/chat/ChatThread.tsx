'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { Send, MessageSquare, Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui'
import type { ChatMessage } from '@/lib/store'
import { isOwnMessage, type ChatViewerRole } from '@/lib/chat-utils'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ChatThread({
  messages,
  viewer,
  draft,
  onDraftChange,
  onSend,
  onAttachmentChange,
  attachment,
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
  onAttachmentChange?: (file: File | null) => void
  attachment?: File | null
  sending: boolean
  emptyHint: string
  placeholder: string
  composeRows?: number
  maxHeightClass?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const previewUrl = useMemo(() => {
    if (attachment && attachment.type.startsWith('image/')) {
      return URL.createObjectURL(attachment)
    }
    return null
  }, [attachment])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

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

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) {
          e.preventDefault()
          onAttachmentChange?.(file)
          break
        }
      }
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      onAttachmentChange?.(file)
    }
  }

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
                  {msg.message && <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.message}</p>}
                  {msg.attachmentUrl && msg.attachmentName && (msg.attachmentMimeType?.startsWith('image/') ? (
                    <a href={msg.attachmentUrl} target="_blank" rel="noreferrer" className="mt-2 block group relative">
                      <img src={msg.attachmentUrl} alt={msg.attachmentName} className="max-h-48 max-w-full rounded-xl object-contain border border-white/20 shadow-sm" />
                      <span className="mt-1 block truncate text-[11px] opacity-70">{msg.attachmentName}</span>
                    </a>
                  ) : (
                    <a href={msg.attachmentUrl} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-2.5 rounded-xl bg-slate-100/90 hover:bg-slate-200/80 px-3.5 py-2.5 text-xs text-slate-800 transition-colors">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 font-semibold text-[10px]">
                        {msg.attachmentName.split('.').pop()?.toUpperCase() ?? 'FILE'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{msg.attachmentName}</p>
                        <p className="text-[10px] text-slate-400">Click to view file</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>

      <div
        className={`border-t border-slate-100 pt-3 transition-colors ${
          isDragging ? 'bg-amber-50/50 rounded-xl p-2 ring-2 ring-amber-400' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {attachment && (
          <div className="mb-3 relative inline-block group">
            {previewUrl ? (
              <div className="relative inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm pr-8">
                <img src={previewUrl} alt={attachment.name} className="h-14 w-14 rounded-xl object-cover border border-slate-100" />
                <div className="min-w-0 max-w-[200px]">
                  <p className="truncate text-xs font-semibold text-slate-700">{attachment.name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{formatFileSize(attachment.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onAttachmentChange?.(null)}
                  className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors"
                  aria-label="Remove attachment"
                >
                  <X className="h-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="relative inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 shadow-sm pr-8">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 font-bold text-[10px]">
                  {attachment.name.split('.').pop()?.toUpperCase() ?? 'FILE'}
                </div>
                <div className="min-w-0 max-w-[200px]">
                  <p className="truncate text-xs font-semibold text-slate-700">{attachment.name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{formatFileSize(attachment.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onAttachmentChange?.(null)}
                  className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-200/70 hover:bg-rose-50 text-slate-500 hover:text-rose-500 transition-colors"
                  aria-label="Remove attachment"
                >
                  <X className="h-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}

        <textarea
          ref={composerRef}
          placeholder={placeholder}
          value={draft}
          onChange={e => onDraftChange(e.target.value)}
          onPaste={handlePaste}
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
          <label className="flex cursor-pointer items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
            <Paperclip className="h-3.5 w-3.5" /> Attach file
            <input type="file" className="hidden" onChange={e => onAttachmentChange?.(e.target.files?.[0] ?? null)} />
          </label>
          <Button size="sm" onClick={onSend} disabled={(!draft.trim() && !attachment) || sending}>
            <Send className="w-3.5 h-3.5" />
            Send
          </Button>
        </div>
      </div>
    </>
  )
}
