'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function AdminLoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (res.ok) {
        const data = await res.json()
        localStorage.setItem('cantara_role', JSON.stringify('admin'))
        localStorage.setItem('cantara_admin_name', JSON.stringify(data.name))
        router.push('/admin')
      } else {
        const msg = await res.text()
        setError(msg || 'Invalid email or password')
      }
    } catch {
      setError('An error occurred during login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center font-sans" style={{ background: 'linear-gradient(145deg, #21263C 0%, #1a1f32 50%, #21263C 100%)' }}>
      <div className="w-full max-w-sm px-6">
        <Link href="/" className="flex items-center gap-2 text-cantara-sun/30 hover:text-cantara-sun/60 text-xs mb-12 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Link>

        <div className="text-center mb-10">
          <img src="/brand/logo-wordmark-dark.svg" alt="Cantara" className="h-10 mx-auto mb-3" />
          <p className="text-cantara-sun/30 text-xs tracking-[0.18em] uppercase">Advisor Portal</p>
          <div className="gold-line mt-4" />
        </div>

        <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(241,230,187,0.08)' }}>
          <h2 className="text-white text-lg font-light cantara-serif mb-6">Sign in</h2>

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-cantara-sun/40 font-bold ml-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-white/5 border border-cantara-sun/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cantara-gold/50 transition-colors"
                placeholder="advisor@cantarapet.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-cantara-sun/40 font-bold ml-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-white/5 border border-cantara-sun/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cantara-gold/50 transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-rose-400 text-[10px] text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg text-white text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 hover:opacity-90"
              style={{ background: '#D37141' }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <div className="text-center mt-6">
          <Link href="/login/client" className="text-cantara-sun/30 hover:text-cantara-sun/60 text-xs transition-colors">
            Are you a client? Sign in here →
          </Link>
        </div>
      </div>
    </div>
  )
}
