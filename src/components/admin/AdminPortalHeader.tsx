'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Bell, LogOut, Settings } from 'lucide-react'
import { GoldLine, cn } from '@/components/ui'
import { logout } from '@/lib/store'

export function AdminPortalHeader({
  pageLabel,
  unreadCount = 0,
  active,
}: {
  pageLabel: string
  unreadCount?: number
  active?: 'notifications' | 'settings'
}) {
  const router = useRouter()

  return (
    <header className="sticky top-0 z-50" style={{ background: '#21263C' }}>
      <div className="max-w-3xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/admin" className="p-2 rounded hover:bg-cantara-sun/5 text-cantara-sun/50 hover:text-cantara-sun/80 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <span className="text-cantara-sun cantara-serif tracking-[0.18em] text-sm">Cantara</span>
            <span className="text-cantara-sun/50 text-[11px] block">{pageLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/admin/notifications"
            className={cn(
              'relative p-2 rounded transition-colors',
              active === 'notifications'
                ? 'bg-cantara-sun/10 text-cantara-sun/80'
                : 'text-cantara-sun/30 hover:bg-cantara-sun/5 hover:text-cantara-sun/70',
            )}
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span
                className="absolute top-1 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                style={{ background: '#ef4444' }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
          <Link
            href="/admin/settings"
            className={cn(
              'p-2 rounded transition-colors',
              active === 'settings'
                ? 'bg-cantara-sun/10 text-cantara-sun/80'
                : 'text-cantara-sun/30 hover:bg-cantara-sun/5 hover:text-cantara-sun/70',
            )}
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>
          <button
            onClick={() => { logout(); router.push('/') }}
            className="flex items-center gap-1.5 text-cantara-sun/30 hover:text-cantara-sun/60 transition-colors px-3 py-1.5 rounded hover:bg-cantara-sun/5 text-xs"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </div>
      <GoldLine />
    </header>
  )
}
