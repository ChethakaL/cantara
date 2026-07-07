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
  const [forgotMode, setForgotMode] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otpSending, setOtpSending] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)

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

  const handleRequestOtp = async () => {
    if (!email) {
      setPasswordMessage('Enter your email address first.')
      return
    }
    setOtpSending(true)
    setPasswordMessage(null)
    try {
      const res = await fetch('/api/auth/admin/request-password-otp', {
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
    setPasswordMessage(null)
    try {
      const res = await fetch('/api/auth/admin/verify-password-otp', {
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
      setError(null)
      setPasswordMessage(null)
    } catch (err) {
      setPasswordMessage(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center font-sans" style={{ background: 'linear-gradient(145deg, #21263C 0%, #1a1f32 50%, #21263C 100%)' }}>
      <div className="w-full max-w-sm px-6">
        <Link href="/" className="flex items-center gap-2 text-cantara-sun/30 hover:text-cantara-sun/60 text-xs mb-12 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to home
        </Link>

        <div className="text-center mb-10">
          <img src="/brand/logo-wordmark-dark.svg" alt="Cantara" className="h-10 mx-auto mb-3" />
          <p className="text-cantara-sun/30 text-xs tracking-[0.18em] uppercase">Advisor Portal</p>
          <div className="gold-line mt-4" />
        </div>

        <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(241,230,187,0.08)' }}>
          <h2 className="text-white text-lg font-light cantara-serif mb-6">
            {forgotMode ? 'Reset password' : 'Sign in'}
          </h2>

          {!forgotMode ? (
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
                <div className="flex items-center justify-between gap-3">
                  <label className="text-[10px] uppercase tracking-widest text-cantara-sun/40 font-bold ml-1">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotMode(true)
                      setError(null)
                      setPasswordMessage(null)
                    }}
                    className="text-[11px] text-cantara-gold hover:text-cantara-sun"
                  >
                    Forgot password?
                  </button>
                </div>
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
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
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

              {!otpSent ? (
                <button
                  type="button"
                  onClick={() => void handleRequestOtp()}
                  disabled={otpSending}
                  className="w-full py-3 rounded-lg text-white text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 hover:opacity-90"
                  style={{ background: '#D37141' }}
                >
                  {otpSending ? 'Sending code...' : 'Send verification code'}
                </button>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest text-cantara-sun/40 font-bold ml-1">Verification Code</label>
                    <input
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="w-full bg-white/5 border border-cantara-sun/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cantara-gold/50 transition-colors"
                      placeholder="6-digit code"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest text-cantara-sun/40 font-bold ml-1">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-white/5 border border-cantara-sun/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cantara-gold/50 transition-colors"
                      placeholder="New password"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest text-cantara-sun/40 font-bold ml-1">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-white/5 border border-cantara-sun/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cantara-gold/50 transition-colors"
                      placeholder="Confirm new password"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-lg text-white text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 hover:opacity-90"
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

              {passwordMessage && <p className="text-slate-300 text-[11px] text-center">{passwordMessage}</p>}

              <button
                type="button"
                onClick={() => {
                  setForgotMode(false)
                  setOtpSent(false)
                  setOtpCode('')
                  setNewPassword('')
                  setConfirmPassword('')
                  setPasswordMessage(null)
                }}
                className="w-full text-xs text-slate-400 hover:text-slate-200"
              >
                Back to sign in
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
