'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, LogOut, Settings, Users } from 'lucide-react'
import { logout } from '@/lib/store'
import { GoldLine } from '@/components/ui'

export default function AdminNav({ name = 'Craig Pollack' }: { name?: string }) {
  const router = useRouter()
  const handleLogout = () => { logout(); router.push('/') }
  return (
    <header className="sticky top-0 z-40" style={{ background: '#0d1829' }}>
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-white cantara-serif tracking-[0.18em] text-sm hover:opacity-80 transition-opacity">Cantara</Link>
          <div className="w-px h-3 bg-white/15" />
          <span className="text-white/30 tracking-[0.18em] uppercase" style={{ fontSize: '0.58rem' }}>Advisor Dashboard</span>
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
