'use client'

import { Mail, Phone } from 'lucide-react'

export function isDirectContactType(type: unknown) {
  return String(type || '').toUpperCase() === 'DIRECT'
}

function hasValue(value?: string | null) {
  return Boolean((value || '').trim())
}

function Chip({
  icon: Icon,
  direct,
  channel,
}: {
  icon: typeof Mail
  direct: boolean
  channel: 'email' | 'phone'
}) {
  const label = direct ? 'Direct owner' : 'General business'
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap ${
        direct
          ? 'bg-amber-50 text-amber-900 border-amber-200'
          : 'bg-slate-100 text-slate-600 border-slate-200'
      }`}
      title={`${label} ${channel}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  )
}

function MissingChip({ channel }: { channel: 'email' | 'phone' }) {
  const Icon = channel === 'email' ? Mail : Phone
  const label = channel === 'email' ? 'No email' : 'No phone'
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed border-slate-200 text-[10px] font-medium whitespace-nowrap text-slate-400"
      title={`${label} on file`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  )
}

export function ContactTypeBadges({
  email,
  phone,
  emailType,
  phoneType,
  layout = 'stack',
}: {
  email?: string | null
  phone?: string | null
  emailType?: string | null
  phoneType?: string | null
  layout?: 'stack' | 'row'
}) {
  return (
    <div
      className={
        layout === 'row'
          ? 'flex flex-wrap items-center gap-1.5'
          : 'flex flex-col items-start gap-1'
      }
    >
      {hasValue(email) ? (
        <Chip icon={Mail} direct={isDirectContactType(emailType)} channel="email" />
      ) : (
        <MissingChip channel="email" />
      )}
      {hasValue(phone) ? (
        <Chip icon={Phone} direct={isDirectContactType(phoneType)} channel="phone" />
      ) : (
        <MissingChip channel="phone" />
      )}
    </div>
  )
}
