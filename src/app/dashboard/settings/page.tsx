'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, Lock, Mail } from 'lucide-react'
import { Button, Card, Input } from '@/components/ui'
import { ClientPortalHeader } from '@/components/client-portal/ClientPortalHeader'
import { DataPrivacySecurityPolicy } from '@/components/settings/DataPrivacySecurityPolicy'
import { resolveClientSession } from '@/lib/client-portal-session'
import { getClient } from '@/lib/store'
import type { Client } from '@/lib/store'
import type { ClientNotificationPreferences } from '@/lib/client-notification-preferences'

export default function ClientSettingsPage() {
  const router = useRouter()
  const [client, setClient] = useState<Client | null>(null)
  const [sessionEmail, setSessionEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [prefs, setPrefs] = useState<ClientNotificationPreferences>({
    emailEnabled: true,
    notificationEmail: '',
  })
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [prefsSaved, setPrefsSaved] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otpSending, setOtpSending] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [showPasswordTour, setShowPasswordTour] = useState(false)
  const [settingsTourStep, setSettingsTourStep] = useState<1 | 2 | 3>(1)
  const [tourPaused, setTourPaused] = useState(false)
  const [policyExpanded, setPolicyExpanded] = useState(false)

  const emailCardRef = useRef<HTMLDivElement | null>(null)
  const passwordCardRef = useRef<HTMLDivElement | null>(null)
  const policyCardRef = useRef<HTMLDivElement | null>(null)
  const settingsTourRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    void (async () => {
      const { client: found, sessionEmail: email } = await resolveClientSession()
      if (!found) {
        router.push('/login/client')
        return
      }
      setClient(found)
      setSessionEmail(email)
      setMustChangePassword(Boolean(JSON.parse(localStorage.getItem('cantara_client_must_change_password') || 'false')))
      const isTourParam = typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('tour') === 'password' || new URLSearchParams(window.location.search).get('tour') === 'settings')
      const savedTourPaused = typeof window !== 'undefined' && localStorage.getItem('cantara_client_tour_paused') === 'true'
      setShowPasswordTour(isTourParam)
      setTourPaused(savedTourPaused)
      const res = await fetch(`/api/client-portal/notifications?clientId=${encodeURIComponent(found.id)}`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setPrefs(data.preferences ?? { emailEnabled: true, notificationEmail: found.email || email })
      }
      setLoading(false)
    })()
  }, [router])

  useEffect(() => {
    if (!showPasswordTour || tourPaused) return
    const timer = window.setTimeout(() => {
      if (settingsTourStep === 1) {
        emailCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else if (settingsTourStep === 2) {
        passwordCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else if (settingsTourStep === 3) {
        setPolicyExpanded(true)
        policyCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 180)
    return () => window.clearTimeout(timer)
  }, [showPasswordTour, tourPaused, settingsTourStep])

  const pauseTour = () => {
    setTourPaused(true)
    localStorage.setItem('cantara_client_tour_paused', 'true')
  }

  const resumeTour = () => {
    setTourPaused(false)
    localStorage.setItem('cantara_client_tour_paused', 'false')
  }

  const finishSettingsTour = () => {
    setShowPasswordTour(false)
    localStorage.setItem('cantara_client_tour_step', '2')
    localStorage.setItem('cantara_client_tour_paused', 'false')
    router.push('/dashboard')
  }

  const savePreferences = async () => {
    if (!client) return
    setSavingPrefs(true)
    setPrefsSaved(false)
    try {
      const res = await fetch('/api/client-portal/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.id,
          emailEnabled: prefs.emailEnabled,
          notificationEmail: prefs.notificationEmail,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setPrefs(data.preferences)
      const refreshed = await getClient(client.id)
      if (refreshed) setClient(refreshed)
      setPrefsSaved(true)
      setTimeout(() => setPrefsSaved(false), 2000)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save notification preferences')
    } finally {
      setSavingPrefs(false)
    }
  }

  const requestOtp = async () => {
    if (!sessionEmail) return
    setOtpSending(true)
    setPasswordMessage(null)
    try {
      const res = await fetch('/api/auth/client/request-password-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sessionEmail }),
      })
      if (!res.ok) throw new Error(await res.text())
      setOtpSent(true)
      setPasswordMessage('Verification code sent to your email.')
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : 'Failed to send verification code.')
    } finally {
      setOtpSending(false)
    }
  }

  const verifyOtpAndReset = async () => {
    if (!sessionEmail) return
    if (newPassword !== confirmPassword) {
      setPasswordMessage('Passwords do not match.')
      return
    }
    setPasswordSaving(true)
    setPasswordMessage(null)
    try {
      const res = await fetch('/api/auth/client/verify-password-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sessionEmail, code: otpCode, newPassword }),
      })
      if (!res.ok) throw new Error(await res.text())
      setOtpCode('')
      setNewPassword('')
      setConfirmPassword('')
      setOtpSent(false)
      setMustChangePassword(false)
      localStorage.setItem('cantara_client_must_change_password', JSON.stringify(false))
      localStorage.removeItem('cantara_client_tour_step')
      setPasswordMessage('Password updated successfully.')
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : 'Failed to update password.')
    } finally {
      setPasswordSaving(false)
    }
  }

  if (loading || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'hsl(220,18%,96%)' }}>
      {showPasswordTour && !tourPaused && (
        <div className="fixed inset-x-0 bottom-0 top-14 z-[55] bg-slate-950/50 backdrop-blur-[1px] transition-all" />
      )}
      <ClientPortalHeader
        pageLabel="Account Settings"
        active="settings"
        highlightSettings={showPasswordTour && !tourPaused}
        tourPaused={tourPaused && showPasswordTour}
        onResumeTour={resumeTour}
      />

      <main className="relative max-w-3xl mx-auto px-4 md:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Account settings</h1>
          <p className="text-sm text-slate-500 mt-1">Manage email notifications and your portal password.</p>
        </div>

        <div
          ref={settingsTourRef}
          className="space-y-6"
        >
        {/* Step 1: Email Notifications Card */}
        <div ref={emailCardRef} className="relative">
          <Card className={`p-5 space-y-4 transition-all ${showPasswordTour && !tourPaused && settingsTourStep === 1 ? 'relative z-[61] ring-2 ring-amber-300 shadow-2xl bg-white' : ''}`}>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-800">Email notifications</h2>
            </div>
            <p className="text-xs text-slate-500">
              When enabled, portal messages and document reminders are emailed to the address below. Turn off to stop all notification emails.
            </p>
            <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-700">Email notifications</p>
                <p className="text-xs text-slate-400 mt-0.5">Messages, reminders, and portal updates</p>
              </div>
              <button
                onClick={() => setPrefs(current => ({ ...current, emailEnabled: !current.emailEnabled }))}
                className={`relative w-11 h-6 rounded-full transition-all shrink-0 ${prefs.emailEnabled ? 'bg-amber-500' : 'bg-slate-200'}`}
                aria-label="Toggle email notifications"
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${prefs.emailEnabled ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            <Input
              label="Send notifications to"
              type="email"
              placeholder={client.email || sessionEmail || 'you@company.com'}
              value={prefs.notificationEmail}
              onChange={e => setPrefs(current => ({ ...current, notificationEmail: e.target.value }))}
            />
            <div className="flex items-center gap-3 flex-wrap">
              <Button size="sm" onClick={() => void savePreferences()} disabled={savingPrefs}>
                {savingPrefs ? 'Saving…' : 'Save notification settings'}
              </Button>
              {prefsSaved && <span className="text-xs text-emerald-600">Saved</span>}
              {!prefs.emailEnabled && (
                <span className="text-xs text-slate-500">Email notifications are off — no reminder or message emails will be sent.</span>
              )}
            </div>
          </Card>
          {showPasswordTour && !tourPaused && settingsTourStep === 1 && (
            <div className="absolute -top-36 left-0 sm:left-4 z-[62] w-[min(90vw,340px)] rounded-2xl border border-amber-200 bg-white p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-amber-100/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full">
                  Settings Tour (1 / 3)
                </span>
                <button
                  type="button"
                  onClick={pauseTour}
                  className="text-[11px] font-medium text-slate-400 hover:text-slate-700 transition-colors"
                >
                  Pause tour
                </button>
              </div>
              <p className="text-sm font-semibold text-slate-900">Email notifications</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Turn email notifications on or off and choose where portal updates, messages, and document reminders should be sent.
              </p>
              <div className="mt-3.5 flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  onClick={() => setSettingsTourStep(2)}
                >
                  Next: Change Password →
                </Button>
              </div>
              <div className="absolute -bottom-2 left-10 h-4 w-4 rotate-45 border-r border-b border-amber-200 bg-white" />
            </div>
          )}
        </div>

        {/* Step 2: Change Password Card */}
        <div ref={passwordCardRef} className="relative">
          <Card className={`p-5 space-y-4 transition-all ${showPasswordTour && !tourPaused && settingsTourStep === 2 ? 'relative z-[61] ring-2 ring-amber-300 shadow-2xl bg-white' : ''}`}>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-800">Change password</h2>
            </div>
            {mustChangePassword && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                You are still using a temporary password. Change it here to finish securing this portal login.
              </div>
            )}
            <p className="text-xs text-slate-500">
              We&apos;ll email a one-time verification code to <span className="font-medium text-slate-700">{sessionEmail}</span>.
            </p>
            {!otpSent ? (
              <Button size="sm" variant="outline" onClick={() => void requestOtp()} disabled={otpSending}>
                {otpSending ? 'Sending code…' : 'Send verification code'}
              </Button>
            ) : (
              <div className="space-y-3">
                <Input label="Verification code" value={otpCode} onChange={e => setOtpCode(e.target.value)} placeholder="6-digit code" />
                <Input label="New password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                <Input label="Confirm new password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                <div className="flex items-center gap-3">
                  <Button size="sm" onClick={() => void verifyOtpAndReset()} disabled={passwordSaving || !otpCode || !newPassword}>
                    {passwordSaving ? 'Updating…' : 'Update password'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void requestOtp()} disabled={otpSending}>
                    Resend code
                  </Button>
                </div>
              </div>
            )}
            {passwordMessage && (
              <p className={`text-xs ${passwordMessage.includes('success') ? 'text-emerald-600' : 'text-slate-600'}`}>{passwordMessage}</p>
            )}
          </Card>
          {showPasswordTour && !tourPaused && settingsTourStep === 2 && (
            <div className="absolute -top-36 right-0 sm:right-4 z-[62] w-[min(90vw,340px)] rounded-2xl border border-amber-200 bg-white p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-amber-100/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full">
                  Settings Tour (2 / 3)
                </span>
                <button
                  type="button"
                  onClick={pauseTour}
                  className="text-[11px] font-medium text-slate-400 hover:text-slate-700 transition-colors"
                >
                  Pause tour
                </button>
              </div>
              <p className="text-sm font-semibold text-slate-900">Change password</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Update your temporary password here to set a permanent, secure password for your portal login.
              </p>
              <div className="mt-3.5 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSettingsTourStep(1)}
                >
                  ← Back
                </Button>
                <Button
                  size="sm"
                  onClick={() => setSettingsTourStep(3)}
                >
                  Next: Data Privacy →
                </Button>
              </div>
              <div className="absolute -bottom-2 right-12 h-4 w-4 rotate-45 border-r border-b border-amber-200 bg-white" />
            </div>
          )}
        </div>

        {/* Step 3: Data Privacy & Security Card */}
        <div ref={policyCardRef} className={`relative transition-all ${showPasswordTour && !tourPaused && settingsTourStep === 3 ? 'relative z-[61]' : ''}`}>
          <DataPrivacySecurityPolicy
            isOpen={settingsTourStep === 3 && showPasswordTour && !tourPaused ? true : policyExpanded}
            onToggle={() => setPolicyExpanded(prev => !prev)}
            highlighted={showPasswordTour && !tourPaused && settingsTourStep === 3}
          />
          {showPasswordTour && !tourPaused && settingsTourStep === 3 && (
            <div className="absolute -top-36 right-0 sm:right-4 z-[62] w-[min(90vw,360px)] rounded-2xl border border-amber-200 bg-white p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-amber-100/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full">
                  Settings Tour (3 / 3)
                </span>
                <button
                  type="button"
                  onClick={pauseTour}
                  className="text-[11px] font-medium text-slate-400 hover:text-slate-700 transition-colors"
                >
                  Pause tour
                </button>
              </div>
              <p className="text-sm font-semibold text-slate-900">Data Privacy &amp; Security Policy</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Read our full AWS cloud security, Anthropic Claude on Bedrock AI privacy (zero model training), AES-256 encryption, and data deletion policies.
              </p>
              <div className="mt-3.5 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSettingsTourStep(2)}
                >
                  ← Back
                </Button>
                <Button
                  size="sm"
                  onClick={finishSettingsTour}
                >
                  Next: Explore Portal Tour →
                </Button>
              </div>
              <div className="absolute -bottom-2 right-12 h-4 w-4 rotate-45 border-r border-b border-amber-200 bg-white" />
            </div>
          )}
        </div>
        </div>

        <div className="flex justify-center">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
            <CheckCircle2 className="w-4 h-4" /> Back to portal
          </Link>
        </div>
      </main>
    </div>
  )
}
