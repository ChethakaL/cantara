'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ChatViewerRole } from '@/lib/chat-utils'

export function useChatUnread(clientId: string, viewer: ChatViewerRole) {
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!clientId) {
      setCount(0)
      return
    }
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

    const source = new EventSource(`/api/chat/stream?clientId=${encodeURIComponent(clientId)}`)
    source.addEventListener('update', () => {
      void refresh()
    })
    return () => source.close()
  }, [clientId, viewer, refresh])

  return { count, refresh }
}
