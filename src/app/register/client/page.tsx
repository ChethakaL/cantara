'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'

export default function ClientRegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', company: '', password: '' })
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) {
      setError('Please complete the required fields.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/client/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Failed to register')
      }
      localStorage.setItem('cantara_role', JSON.stringify('client'))
      localStorage.setItem('cantara_client_email', JSON.stringify(form.email))
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d1829' }}>
      <div className="w-full max-w-sm px-6">
        <Link href="/login/client" className="flex items-center gap-2 text-white/30 hover:text-white/60 text-xs mb-12 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to client login
        </Link>
        <div className="text-center mb-10">
          <div className="text-2xl cantara-serif text-white mb-1 tracking-[0.15em]">Cantara</div>
          <p className="text-white/30 text-xs tracking-[0.18em] uppercase">Client Registration</p>
          <div className="gold-line mt-4" />
        </div>
        <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="text-white text-lg font-light cantara-serif mb-6">Create your account</h2>
          <form onSubmit={submit} className="space-y-4">
            {[
              { key: 'name', label: 'Full name', type: 'text', placeholder: 'Jane Smith' },
              { key: 'email', label: 'Email address', type: 'email', placeholder: 'you@company.com' },
              { key: 'company', label: 'Company / Business name', type: 'text', placeholder: 'Happy Paws Resort' },
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-xs text-slate-400 mb-1.5">{field.label}</label>
                <input
                  type={field.type}
                  value={(form as any)[field.key]}
                  onChange={e => setForm(p => ({ ...p, [field.key]: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-white placeholder-slate-600 outline-none transition-all focus:ring-1"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  placeholder={field.placeholder}
                />
              </div>
            ))}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
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
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-60 mt-2"
              style={{ background: 'linear-gradient(135deg, #b8922a, #d4a843)' }}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
