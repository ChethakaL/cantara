'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ChatViewerRole } from '@/lib/chat-utils'
import { subscribeChatSse } from '@/lib/chat-sse'

export function useChatUnread(clientId: string, viewer: ChatViewerRole) {
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!clientId) {
      setCount(0)
      return
    }
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    const res = await fetch(
      `/api/chat/unread?clientId=${encodeURIComponent(clientId)}&viewer=${viewer}`,
      { cache: 'no-store' },
    )
    if (!res.ok) return
    const data = await res.json()
    setCount(data.count ?? 0)
  }, [clientId, viewer])

  useEffect(() => {
    void refresh()
    if (!clientId) return

    const url = `/api/chat/stream?clientId=${encodeURIComponent(clientId)}`
    return subscribeChatSse(url, () => {
      void refresh()
    })
  }, [clientId, viewer, refresh])

  return { count, refresh }
}
