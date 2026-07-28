'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '@/lib/store'
import { countUnreadForViewer, type ChatViewerRole } from '@/lib/chat-utils'

async function fetchMessages(clientId: string): Promise<ChatMessage[]> {
  const res = await fetch(`/api/chat?clientId=${encodeURIComponent(clientId)}`, { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json()
  return data.messages ?? []
}

async function markChatRead(clientId: string, viewer: ChatViewerRole) {
  await fetch('/api/chat/read', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, viewer }),
  })
}

export function useChatRoom(args: {
  clientId: string
  viewer: ChatViewerRole
  senderName: string
  /** When true, marks incoming messages as read (e.g. chat panel open). */
  isActive?: boolean
}) {
  const { clientId, viewer, senderName, isActive = false } = args
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [sending, setSending] = useState(false)
  const [connected, setConnected] = useState(false)
  const markedReadRef = useRef(false)

  const refresh = useCallback(async () => {
    const next = await fetchMessages(clientId)
    setMessages(next)
    setUnreadCount(countUnreadForViewer(next, viewer))
    return next
  }, [clientId, viewer])

  useEffect(() => {
    if (!clientId) {
      setMessages([])
      setUnreadCount(0)
      return
    }
    markedReadRef.current = false
    void refresh()
  }, [clientId, refresh])

  useEffect(() => {
    if (!clientId) return

    const params = new URLSearchParams({ clientId })
    const source = new EventSource(`/api/chat/stream?${params.toString()}`)

    source.addEventListener('update', () => {
      void refresh()
    })
    source.addEventListener('open', () => setConnected(true))
    source.onerror = () => setConnected(false)

    return () => {
      source.close()
      setConnected(false)
    }
  }, [clientId, refresh])

  useEffect(() => {
    if (!isActive || !clientId) {
      markedReadRef.current = false
      return
    }
    if (markedReadRef.current) return

    markedReadRef.current = true
    void markChatRead(clientId, viewer).then(() => refresh())
  }, [isActive, clientId, viewer, refresh])

  const sendMessage = useCallback(async (text: string, attachment?: File | null) => {
    const trimmed = text.trim()
    if ((!trimmed && !attachment) || sending || !clientId) return false

    const optimisticId = `optimistic-${Date.now()}`
    const optimistic: ChatMessage = {
      id: optimisticId,
      clientId,
      senderRole: viewer,
      senderName,
      message: trimmed,
      attachmentName: attachment?.name,
      attachmentMimeType: attachment?.type,
      attachmentSize: attachment?.size,
      timestamp: new Date().toISOString(),
      readByAdmin: viewer === 'admin',
      readByClient: viewer === 'client',
    }

    setSending(true)
    setMessages(prev => [...prev, optimistic])

    try {
      const form = new FormData()
      form.append('clientId', clientId)
      form.append('senderRole', viewer)
      form.append('senderName', senderName)
      form.append('message', trimmed)
      if (attachment) form.append('attachment', attachment)
      const res = await fetch('/api/chat', {
        method: 'POST',
        body: form,
      })
      if (!res.ok) throw new Error(await res.text())
      await refresh()
      return true
    } catch (error) {
      console.error('sendMessage', error)
      setMessages(prev => prev.filter(message => message.id !== optimisticId))
      return false
    } finally {
      setSending(false)
    }
  }, [clientId, viewer, senderName, sending, refresh])

  return {
    messages,
    unreadCount,
    sending,
    connected,
    refresh,
    sendMessage,
  }
}

export function useAdminInboxUnread() {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [total, setTotal] = useState(0)

  const refresh = useCallback(async () => {
    const res = await fetch('/api/chat/unread?viewer=admin', { cache: 'no-store' })
    if (!res.ok) return
    const data = await res.json()
    setCounts(data.counts ?? {})
    setTotal(data.total ?? 0)
  }, [])

  useEffect(() => {
    void refresh()
    const source = new EventSource('/api/chat/stream?scope=admin-inbox')
    source.addEventListener('update', () => {
      void refresh()
    })
    return () => source.close()
  }, [refresh])

  return { counts, total, refresh }
}
