'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'

export default function ClientLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { setError('Please enter your credentials.'); return }
    setLoading(true)
    setError('')
    await new Promise(r => setTimeout(r, 800))
    // Production: validate against DB, check client is provisioned
    localStorage.setItem('cantara_role', JSON.stringify('client'))
    localStorage.setItem('cantara_client_email', JSON.stringify(email))
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d1829' }}>
      <div className="w-full max-w-sm px-6">
        <Link href="/" className="flex items-center gap-2 text-white/30 hover:text-white/60 text-xs mb-12 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Link>

        <div className="text-center mb-10">
          <div className="text-2xl cantara-serif text-white mb-1 tracking-[0.15em]">Cantara</div>
          <p className="text-white/30 text-xs tracking-[0.18em] uppercase">Client Portal</p>
          <div className="gold-line mt-4" />
        </div>

        <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="text-white text-lg font-light cantara-serif mb-6">Welcome back</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Email address</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-sm text-white placeholder-slate-600 outline-none transition-all focus:ring-1"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm text-white placeholder-slate-600 outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && <p className="text-rose-400 text-xs">{error}</p>}
            <button
              type="submit" disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-60 mt-2"
              style={{ background: 'linear-gradient(135deg, #b8922a, #d4a843)' }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-slate-600 text-xs text-center mt-6">
            Access is provided by your Cantara advisor. Contact your team if you need help.
          </p>
        </div>
      </div>
    </div>
  )
}
