'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Calendar,
  CheckCircle2,
  Loader2,
  Mail,
  MessageSquare,
  AlertCircle,
} from 'lucide-react'
import { Card } from '@/components/ui'
import { ClientPortalHeader } from '@/components/client-portal/ClientPortalHeader'
import { resolveClientSession } from '@/lib/client-portal-session'
import type { PortalNotificationItem } from '@/lib/client-portal-notification-feed'

function formatWhen(iso: string) {
  const date = new Date(iso)
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function NotificationIcon({ type }: { type: PortalNotificationItem['type'] }) {
  if (type === 'message') return <MessageSquare className="w-4 h-4 text-amber-600" />
  if (type === 'deadline') return <Calendar className="w-4 h-4 text-rose-600" />
  if (type === 'action_item') return <AlertCircle className="w-4 h-4 text-orange-600" />
  return <Mail className="w-4 h-4 text-slate-500" />
}

export default function ClientNotificationsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<PortalNotificationItem[]>([])

  useEffect(() => {
    void (async () => {
      const { client } = await resolveClientSession()
      if (!client) {
        router.push('/login/client')
        return
      }
      await fetch('/api/chat/read', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, viewer: 'client' }),
      }).catch(() => undefined)
      const res = await fetch(`/api/client-portal/notifications?clientId=${encodeURIComponent(client.id)}`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setItems(data.items ?? [])
      }
      setLoading(false)
    })()
  }, [router])

  const unreadCount = useMemo(() => items.filter(item => item.unread).length, [items])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'hsl(220,18%,96%)' }}>
      <ClientPortalHeader pageLabel="Notifications" unreadCount={unreadCount} active="notifications" />

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">Messages, document reminders, and action items from your Cantara team.</p>
        </div>

        <Card className="overflow-hidden">
          {items.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-slate-400">
              No notifications yet. Messages, reminders, and action items will appear here.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map(item => (
                <div key={item.id} className={`px-5 py-4 flex gap-3 ${item.unread ? 'bg-amber-50/40' : ''}`}>
                  <div className="mt-0.5 w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0">
                    <NotificationIcon type={item.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-800">{item.title}</p>
                      {item.unread && <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">New</span>}
                    </div>
                    <p className="text-sm text-slate-600 mt-1 leading-relaxed">{item.body}</p>
                    <p className="text-[11px] text-slate-400 mt-2">{formatWhen(item.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="flex justify-center">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
            <CheckCircle2 className="w-4 h-4" /> Back to portal
          </Link>
        </div>
      </main>
    </div>
  )
}
