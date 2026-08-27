'use client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Bell, LogOut, Settings, Globe2, BarChart3, Zap } from 'lucide-react'
import { logout } from '@/lib/store'
import { GoldLine, cn } from '@/components/ui'
import { useAdminInboxUnread } from '@/hooks/useChatRoom'
import AdminChatInboxWidget from '@/components/admin/AdminChatInboxWidget'

export default function AdminNav({ name = 'Admin Pollack' }: { name?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const { total: unreadCount } = useAdminInboxUnread()
  const handleLogout = () => { logout(); router.push('/') }
  return (
    <>
      <header className="sticky top-0 z-40" style={{ background: '#21263C' }}>
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <img src="/brand/logo-wordmark-dark.svg" alt="Cantara" className="h-8" />
            </Link>
            <div className="w-px h-3 bg-cantara-sun/15" />
            <span className="tracking-[0.18em] uppercase" style={{ fontSize: '0.58rem', color: '#F1E6BB', opacity: 0.4 }}>Advisor Dashboard</span>
            <div className="w-px h-3 bg-cantara-sun/10 hidden md:block" />
            {/* <Link
              href="/admin/digital-presence"
              className={cn(
                'hidden md:flex items-center gap-1.5 text-xs transition-colors px-2 py-1 rounded',
                pathname?.startsWith('/admin/digital-presence')
                  ? 'text-cantara-gold'
                  : 'text-cantara-sun/40 hover:text-cantara-sun/70'
              )}
            >
              <Globe2 className="w-3.5 h-3.5" />
              Digital Presence
            </Link> */}
            <Link
              href="/admin/sales-leads"
              className={cn(
                'hidden md:flex items-center gap-1.5 text-xs transition-colors px-2 py-1 rounded',
                pathname?.startsWith('/admin/sales-leads')
                  ? 'text-cantara-gold'
                  : 'text-cantara-sun/40 hover:text-cantara-sun/70'
              )}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Sales Leads
            </Link>
            <Link
              href="/admin/automations"
              className={cn(
                'hidden md:flex items-center gap-1.5 text-xs transition-colors px-2 py-1 rounded',
                pathname?.startsWith('/admin/automations')
                  ? 'text-cantara-gold'
                  : 'text-cantara-sun/40 hover:text-cantara-sun/70'
              )}
            >
              <Zap className="w-3.5 h-3.5" />
              Automations
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-cantara-sun/40 text-xs hidden md:block">{name}</span>
            <Link
              href="/admin/notifications"
              className={cn(
                'relative p-2 rounded transition-colors',
                pathname?.startsWith('/admin/notifications')
                  ? 'bg-cantara-sun/10 text-cantara-gold'
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
                "p-2 rounded hover:bg-cantara-sun/5 transition-colors",
                pathname?.startsWith("/admin/settings")
                  ? "text-cantara-gold"
                  : "text-cantara-sun/30 hover:text-cantara-sun/70",
              )}
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </Link>
            <button onClick={handleLogout} className="p-2 rounded hover:bg-cantara-sun/5 transition-colors text-cantara-sun/30 hover:text-rose-400">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        <GoldLine />
      </header>
      <AdminChatInboxWidget adminName={name} />
    </>
  )
}
