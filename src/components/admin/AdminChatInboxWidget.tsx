'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { MessageCircle, Minimize2, X } from 'lucide-react'
import { ChatThread } from '@/components/chat/ChatThread'
import type { ChatMessage } from '@/lib/store'

type InboxThread = {
  clientId: string
  clientName: string
  businessName: string
  unreadCount: number
  lastMessageAt: string | null
  messages: ChatMessage[]
}

async function markAdminThreadRead(clientId: string) {
  await fetch('/api/chat/read', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, viewer: 'admin' }),
  })
}

export default function AdminChatInboxWidget({ adminName }: { adminName: string }) {
  const [threads, setThreads] = useState<InboxThread[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [sendingClientId, setSendingClientId] = useState<string | null>(null)
  const [hiddenClientIds, setHiddenClientIds] = useState<string[]>([])
  const [expanded, setExpanded] = useState(false)
  const [activeClientId, setActiveClientId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch('/api/chat/admin-inbox', { cache: 'no-store' })
    if (!res.ok) return
    const data = await res.json()
    setThreads(Array.isArray(data.threads) ? data.threads : [])
  }, [])

  useEffect(() => {
    void refresh()
    const source = new EventSource('/api/chat/stream?scope=admin-inbox')
    source.addEventListener('update', () => {
      void refresh()
    })
    return () => source.close()
  }, [refresh])

  const visibleThreads = useMemo(() => {
    return threads.filter(thread => !hiddenClientIds.includes(thread.clientId))
  }, [threads, hiddenClientIds])

  useEffect(() => {
    if (!visibleThreads.length) {
      setExpanded(false)
      setActiveClientId(null)
      return
    }
    setActiveClientId(current => current && visibleThreads.some(thread => thread.clientId === current) ? current : visibleThreads[0]?.clientId ?? null)
  }, [visibleThreads])

  useEffect(() => {
    const visibleSet = new Set(threads.map(thread => thread.clientId))
    setHiddenClientIds(current => current.filter(clientId => visibleSet.has(clientId)))
  }, [threads])

  const activeThread = visibleThreads.find(thread => thread.clientId === activeClientId) ?? null

  const dismissThread = useCallback(async (clientId: string) => {
    await markAdminThreadRead(clientId)
    setHiddenClientIds(current => current.includes(clientId) ? current : [...current, clientId])
    await refresh()
  }, [refresh])

  const sendReply = useCallback(async (thread: InboxThread) => {
    const draft = (drafts[thread.clientId] ?? '').trim()
    if (!draft || sendingClientId) return

    setSendingClientId(thread.clientId)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: thread.clientId,
          senderRole: 'admin',
          senderName: adminName,
          message: draft,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      setDrafts(current => ({ ...current, [thread.clientId]: '' }))
      await dismissThread(thread.clientId)
    } catch (error) {
      console.error('Admin inbox reply failed:', error)
    } finally {
      setSendingClientId(null)
    }
  }, [adminName, dismissThread, drafts, sendingClientId])

  if (!visibleThreads.length) return null

  return (
    <div className="fixed bottom-4 right-4 z-[110] flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-3">
      {expanded && activeThread && (
        <div className="w-[420px] h-[550px] max-w-[calc(100vw-1.5rem)] flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="bg-slate-950 text-white shrink-0">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold tracking-wide">
                  <MessageCircle className="h-4 w-4 text-amber-300" />
                  Client Messages
                </div>
              </div>
              <div className="flex items-center gap-3 pr-1">
                <Link
                  href={`/admin/client/${activeThread.clientId}?tab=messages`}
                  className="shrink-0 rounded-full border border-white/15 px-3 py-1 text-[11px] font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                >
                  Open full chat
                </Link>
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto px-3 pb-0 pt-2">
              {visibleThreads.map(thread => {
                const selected = thread.clientId === activeThread.clientId
                return (
                  <button
                    key={thread.clientId}
                    type="button"
                    onClick={() => setActiveClientId(thread.clientId)}
                    className={`flex shrink-0 items-center gap-2 rounded-t-xl border border-b-0 px-3 py-2 text-xs font-medium transition-colors ${
                      selected
                        ? 'border-white bg-white text-slate-900'
                        : 'border-white/10 bg-white/10 text-white/75 hover:bg-white/15 hover:text-white'
                    }`}
                  >
                    <span className="max-w-[120px] truncate">{thread.clientName}</span>
                    {thread.unreadCount > 0 && (
                      <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                        {thread.unreadCount > 9 ? '9+' : thread.unreadCount}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        void dismissThread(thread.clientId)
                      }}
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                        selected
                          ? 'border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                          : 'border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                      }`}
                      aria-label={`Dismiss ${thread.clientName} chat`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col px-4 pt-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">{activeThread.clientName}</p>
                <p className="truncate text-xs text-slate-400">{activeThread.businessName}</p>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                title="Minimize"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="h-[380px] flex flex-col">
              <ChatThread
                messages={activeThread.messages}
                viewer="admin"
                draft={drafts[activeThread.clientId] ?? ''}
                onDraftChange={(value) => setDrafts(current => ({ ...current, [activeThread.clientId]: value }))}
                onSend={() => void sendReply(activeThread)}
                sending={sendingClientId === activeThread.clientId}
                emptyHint={`No messages yet. Send a message to ${activeThread.clientName}.`}
                placeholder={`Reply to ${activeThread.clientName}...`}
                maxHeightClass="flex-1 min-h-0"
              />
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setExpanded(current => !current)
          setActiveClientId(current => current ?? visibleThreads[0]?.clientId ?? null)
        }}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 text-white shadow-2xl transition-transform hover:scale-[1.03]"
        aria-label="Open client messages"
      >
        <MessageCircle className="h-6 w-6 text-amber-300" />
        <span
          className="absolute -right-1 -top-1 min-w-[22px] rounded-full bg-red-500 px-1.5 py-1 text-center text-[10px] font-bold leading-none text-white"
        >
          {visibleThreads.length > 9 ? '9+' : visibleThreads.length}
        </span>
      </button>
    </div>
  )
}
