'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { isValidEmailAddress, normalizeEmailAddress } from '@/lib/sales-leads/email-recipients'

function RecipientChip({
  email,
  locked,
  onRemove,
}: {
  email: string
  locked?: boolean
  onRemove?: () => void
}) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-blue-200 text-[11px] font-medium text-slate-700">
      {email}
      {!locked && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-slate-400 hover:text-slate-700"
          aria-label={`Remove ${email}`}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  )
}

export function EmailRecipientFields({
  primaryTo,
  extraTo,
  cc,
  onExtraToChange,
  onCcChange,
}: {
  primaryTo: string
  extraTo: string[]
  cc: string[]
  onExtraToChange: (emails: string[]) => void
  onCcChange: (emails: string[]) => void
}) {
  const [toDraft, setToDraft] = useState('')
  const [ccDraft, setCcDraft] = useState('')
  const [error, setError] = useState('')

  const addEmail = (raw: string, list: string[], onChange: (emails: string[]) => void) => {
    const candidates = raw.split(/[,;\n]+/).map(value => value.trim()).filter(Boolean)
    if (!candidates.length) return
    const next = [...list]
    for (const candidate of candidates) {
      if (!isValidEmailAddress(candidate)) {
        setError(`Invalid email address: ${candidate}`)
        return
      }
      const email = normalizeEmailAddress(candidate)
      if (email === normalizeEmailAddress(primaryTo) || next.includes(email)) continue
      next.push(email)
    }
    setError('')
    onChange(next)
  }

  return (
    <div className="text-xs space-y-2">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium text-slate-600">To</span>
          <span className="text-[10px] font-normal text-slate-400">Owner plus optional extra recipients</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-2 py-1.5">
          {primaryTo ? (
            <RecipientChip email={primaryTo} locked />
          ) : (
            <span className="text-[11px] text-rose-600">No owner email set</span>
          )}
          {extraTo.map(email => (
            <RecipientChip
              key={email}
              email={email}
              onRemove={() => onExtraToChange(extraTo.filter(item => item !== email))}
            />
          ))}
          <input
            value={toDraft}
            onChange={event => setToDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault()
                addEmail(toDraft, extraTo, onExtraToChange)
                setToDraft('')
              }
            }}
            onBlur={() => {
              if (!toDraft.trim()) return
              addEmail(toDraft, extraTo, onExtraToChange)
              setToDraft('')
            }}
            placeholder="Add another To email"
            className="flex-1 min-w-[10rem] bg-transparent text-[11px] outline-none py-0.5 text-slate-700 placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={() => {
              addEmail(toDraft, extraTo, onExtraToChange)
              setToDraft('')
            }}
            className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-700 hover:text-blue-900"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium text-slate-600">Cc</span>
          <span className="text-[10px] font-normal text-slate-400">Optional</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-2 py-1.5">
          {cc.map(email => (
            <RecipientChip
              key={email}
              email={email}
              onRemove={() => onCcChange(cc.filter(item => item !== email))}
            />
          ))}
          <input
            value={ccDraft}
            onChange={event => setCcDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault()
                addEmail(ccDraft, cc, onCcChange)
                setCcDraft('')
              }
            }}
            onBlur={() => {
              if (!ccDraft.trim()) return
              addEmail(ccDraft, cc, onCcChange)
              setCcDraft('')
            }}
            placeholder="Add a Cc email"
            className="flex-1 min-w-[10rem] bg-transparent text-[11px] outline-none py-0.5 text-slate-700 placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={() => {
              addEmail(ccDraft, cc, onCcChange)
              setCcDraft('')
            }}
            className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-700 hover:text-blue-900"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
      </div>
      {error && <p className="text-[11px] text-rose-600">{error}</p>}
    </div>
  )
}
