'use client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Bell, LogOut, Settings, Users, Globe2 } from 'lucide-react'
import { logout } from '@/lib/store'
import { GoldLine, cn } from '@/components/ui'

export default function AdminNav({ name = 'Admin Pollack' }: { name?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const handleLogout = () => { logout(); router.push('/') }
  return (
    <header className="sticky top-0 z-40" style={{ background: '#0d1829' }}>
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-white cantara-serif tracking-[0.18em] text-sm hover:opacity-80 transition-opacity">Cantara</Link>
          <div className="w-px h-3 bg-white/15" />
          <span className="text-white/30 tracking-[0.18em] uppercase" style={{ fontSize: '0.58rem' }}>Advisor Dashboard</span>
          <div className="w-px h-3 bg-white/10 hidden md:block" />
          <Link
            href="/admin/digital-presence"
            className={cn(
              'hidden md:flex items-center gap-1.5 text-xs transition-colors px-2 py-1 rounded',
              pathname?.startsWith('/admin/digital-presence')
                ? 'text-amber-400'
                : 'text-white/40 hover:text-white/70'
            )}
          >
            <Globe2 className="w-3.5 h-3.5" />
            Digital Presence
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-white/40 text-xs hidden md:block">{name}</span>
          <button className="p-2 rounded hover:bg-white/5 transition-colors text-white/30 hover:text-white/70">
            <Bell className="w-4 h-4" />
          </button>
          <button onClick={handleLogout} className="p-2 rounded hover:bg-white/5 transition-colors text-white/30 hover:text-rose-400">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
      <GoldLine />
    </header>
  )
}
