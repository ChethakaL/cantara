'use client'

import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { AdminPortalHeader } from '@/components/admin/AdminPortalHeader'
import { AdminMessageNotificationSettings } from '@/components/admin/AdminMessageNotificationSettings'
import { useAdminInboxUnread } from '@/hooks/useChatRoom'

export default function AdminNotificationsPage() {
  const { total: unreadCount } = useAdminInboxUnread()

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminPortalHeader pageLabel="Notifications" unreadCount={unreadCount} active="notifications" />

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">
            Email alerts when clients send portal messages.
          </p>
        </div>

        <AdminMessageNotificationSettings />

        <div className="flex justify-center">
          <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
            <CheckCircle2 className="w-4 h-4" /> Back to advisor dashboard
          </Link>
        </div>
      </main>
    </div>
  )
}
