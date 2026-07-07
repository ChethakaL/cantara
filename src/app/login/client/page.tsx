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
  const [forgotMode, setForgotMode] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otpSending, setOtpSending] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { setError('Please enter your credentials.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/client/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Failed to sign in')
      }
      const data = await res.json()
      localStorage.setItem('cantara_role', JSON.stringify('client'))
      localStorage.setItem('cantara_client_email', JSON.stringify(email))
      if (data.clientId) localStorage.setItem('cantara_client_id', JSON.stringify(data.clientId))
      localStorage.setItem('cantara_client_must_change_password', JSON.stringify(Boolean(data.mustChangePassword)))
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  const handleRequestOtp = async () => {
    if (!email) {
      setPasswordMessage('Enter your email address first.')
      return
    }
    setOtpSending(true)
    setPasswordMessage('')
    try {
      const res = await fetch('/api/auth/client/request-password-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error(await res.text())
      setOtpSent(true)
      setPasswordMessage('Verification code sent to your email.')
    } catch (err) {
      setPasswordMessage(err instanceof Error ? err.message : 'Failed to send verification code')
    } finally {
      setOtpSending(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !otpCode || !newPassword) {
      setPasswordMessage('Email, code, and new password are required.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage('Passwords do not match.')
      return
    }
    setLoading(true)
    setPasswordMessage('')
    try {
      const res = await fetch('/api/auth/client/verify-password-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otpCode, newPassword }),
      })
      if (!res.ok) throw new Error(await res.text())
      setForgotMode(false)
      setOtpSent(false)
      setOtpCode('')
      setNewPassword('')
      setConfirmPassword('')
      setPassword('')
      setError('')
      setPasswordMessage('')
      setShow(false)
    } catch (err) {
      setPasswordMessage(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(145deg, #21263C 0%, #1a1f32 50%, #21263C 100%)' }}>
      <div className="w-full max-w-sm px-6">
        <Link href="/" className="flex items-center gap-2 text-cantara-sun/30 hover:text-cantara-sun/60 text-xs mb-12 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Link>

        <div className="text-center mb-10">
          <img src="/brand/logo-wordmark-dark.svg" alt="Cantara" className="h-10 mx-auto mb-3" />
          <p className="text-cantara-sun/30 text-xs tracking-[0.18em] uppercase">Client Portal</p>
          <div className="gold-line mt-4" />
        </div>

        <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(241,230,187,0.08)' }}>
          <h2 className="text-white text-lg font-light cantara-serif mb-6">Welcome back</h2>

          {!forgotMode ? (
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
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <label className="block text-xs text-slate-400">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotMode(true)
                      setError('')
                      setPasswordMessage('')
                    }}
                    className="text-[11px] text-cantara-gold hover:text-cantara-sun"
                  >
                    Forgot password?
                  </button>
                </div>
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
                style={{ background: '#D37141' }}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-white placeholder-slate-600 outline-none transition-all focus:ring-1"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  placeholder="you@company.com"
                />
              </div>
              {!otpSent ? (
                <button
                  type="button"
                  onClick={() => void handleRequestOtp()}
                  disabled={otpSending}
                  className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-60"
                  style={{ background: '#D37141' }}
                >
                  {otpSending ? 'Sending code...' : 'Send verification code'}
                </button>
              ) : (
                <>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Verification code</label>
                    <input
                      type="text"
                      value={otpCode}
                      onChange={e => setOtpCode(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg text-sm text-white placeholder-slate-600 outline-none transition-all focus:ring-1"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                      placeholder="6-digit code"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">New password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg text-sm text-white placeholder-slate-600 outline-none transition-all focus:ring-1"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                      placeholder="New password"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Confirm new password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg text-sm text-white placeholder-slate-600 outline-none transition-all focus:ring-1"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                      placeholder="Confirm new password"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-60"
                    style={{ background: '#D37141' }}
                  >
                    {loading ? 'Updating password...' : 'Update password'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRequestOtp()}
                    disabled={otpSending}
                    className="w-full text-xs text-cantara-gold hover:text-cantara-sun"
                  >
                    {otpSending ? 'Sending code...' : 'Resend code'}
                  </button>
                </>
              )}
              {passwordMessage && <p className="text-slate-300 text-xs">{passwordMessage}</p>}
              <button
                type="button"
                onClick={() => {
                  setForgotMode(false)
                  setOtpSent(false)
                  setOtpCode('')
                  setNewPassword('')
                  setConfirmPassword('')
                  setPasswordMessage('')
                }}
                className="w-full text-xs text-slate-400 hover:text-slate-200"
              >
                Back to sign in
              </button>
            </form>
          )}

          <p className="text-slate-600 text-xs text-center mt-6">
            Access is provided by your Cantara advisor. Contact your team if you need help.
          </p>
        </div>
      </div>
    </div>
  )
}
