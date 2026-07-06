'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Bell, LogOut, Settings } from 'lucide-react'
import { GoldLine } from '@/components/ui'
import { logout } from '@/lib/store'

export function ClientPortalHeader({
  pageLabel,
  unreadCount = 0,
  showBack = true,
  active,
  highlightSettings = false,
}: {
  pageLabel: string
  unreadCount?: number
  showBack?: boolean
  active?: 'notifications' | 'settings'
  highlightSettings?: boolean
}) {
  const router = useRouter()

  return (
    <header className="sticky top-0 z-40" style={{ background: '#0d1829' }}>
      <div className="max-w-3xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {showBack ? (
            <Link href="/dashboard" className="p-2 rounded hover:bg-white/5 text-white/50 hover:text-white/80 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          ) : null}
          <div className="min-w-0">
            <span className="text-white cantara-serif tracking-[0.18em] text-sm">Cantara</span>
            <span className="text-white/50 text-[11px] block">{pageLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/dashboard/notifications"
            className={`relative p-2 rounded transition-colors ${active === 'notifications' ? 'bg-white/10 text-white/80' : 'text-white/30 hover:bg-white/5 hover:text-white/70'}`}
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ background: '#ef4444' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
          <Link
            href="/dashboard/settings"
            className={`relative z-[61] p-2 rounded transition-colors ${
              highlightSettings
                ? 'bg-amber-500/15 text-amber-300 ring-2 ring-amber-300/70 shadow-[0_0_0_6px_rgba(251,191,36,0.12)]'
                : active === 'settings'
                  ? 'bg-white/10 text-white/80'
                  : 'text-white/30 hover:bg-white/5 hover:text-white/70'
            }`}
            aria-label="Account settings"
          >
            <Settings className="w-4 h-4" />
          </Link>
          <button
            onClick={() => { logout(); router.push('/') }}
            className="flex items-center gap-1.5 text-white/30 hover:text-white/60 transition-colors px-3 py-1.5 rounded hover:bg-white/5 text-xs"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </div>
      <GoldLine />
    </header>
  )
}
