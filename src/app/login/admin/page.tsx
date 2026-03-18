'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Chrome } from 'lucide-react'

export default function AdminLoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleNylasGoogleLogin = async () => {
    setLoading(true)
    // Redirect to Nylas OAuth connect endpoint
    window.location.href = '/api/auth/nylas/connect'
  }

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
        // Session cookies are set by the API
        const data = await res.json()
        localStorage.setItem('cantara_role', JSON.stringify('admin'))
        localStorage.setItem('cantara_admin_name', JSON.stringify(data.name))
        router.push('/admin')
      } else {
        const msg = await res.text()
        setError(msg || 'Invalid email or password')
      }
    } catch (err) {
      setError('An error occurred during login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center font-sans" style={{ background: '#0d1829' }}>
      <div className="w-full max-w-sm px-6">
        <Link href="/" className="flex items-center gap-2 text-white/30 hover:text-white/60 text-xs mb-12 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Link>

        <div className="text-center mb-10">
          <div className="text-2xl cantara-serif text-white mb-1 tracking-[0.15em]">Cantara</div>
          <p className="text-white/30 text-xs tracking-[0.18em] uppercase">Advisor Portal</p>
          <div className="gold-line mt-4" />
        </div>

        <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="text-white text-lg font-light cantara-serif mb-6">Sign in</h2>
          
          <form onSubmit={handleEmailLogin} className="space-y-4 mb-8">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold ml-1">Email Address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                placeholder="advisor@cantarapet.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold ml-1">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-rose-400 text-[10px] text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-600 hover:bg-amber-500 py-3 rounded-lg text-white text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest"><span className="bg-[#0d1829] px-2 text-slate-600">or continue with</span></div>
          </div>

          <button
            onClick={handleNylasGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg text-sm font-medium transition-all hover:bg-slate-100 disabled:opacity-60"
            style={{ background: 'white', color: '#1e293b' }}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {loading ? 'Connecting...' : 'Continue with Google'}
          </button>

          <div className="mt-6 pt-6 border-t border-white/5">
            <p className="text-slate-600 text-xs text-center leading-relaxed">
              Google sign-in connects Drive for automatic client folder creation and Nylas calendar for meeting management.
            </p>
          </div>
        </div>

        <div className="text-center mt-6">
          <Link href="/login/client" className="text-slate-600 hover:text-slate-400 text-xs transition-colors">
            Are you a client? Sign in here →
          </Link>
        </div>
      </div>
    </div>
  )
}
