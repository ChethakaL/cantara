'use client'

import { useEffect, useState } from 'react'
import {
  Building2,
  AlertTriangle,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Send,
  Star,
  User,
  Trash2,
  X,
} from 'lucide-react'
import { Badge, Button, Input, SearchableSelect, Select, Textarea } from '@/components/ui'
import { CALL_RESULT_LABELS, STAGE_LABELS } from '@/lib/sales-leads/workflow'
import { Sparkles } from 'lucide-react'
import EnrichmentModal from '@/components/sales-leads/EnrichmentModal'

type Lead = any

export default function LeadDetailDrawer({
  lead,
  callers,
  isOpen,
  onClose,
  onUpdate,
}: {
  lead: Lead | null
  callers: any[]
  isOpen: boolean
  onClose: () => void
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState('')
  const [stage, setStage] = useState('')
  const [callerId, setCallerId] = useState('')
  const [showEnrichModal, setShowEnrichModal] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Email Draft State
  const [draftLoading, setDraftLoading] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [draftSubject, setDraftSubject] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [draftRecipient, setDraftRecipient] = useState('')
  const [draftTemplateNum, setDraftTemplateNum] = useState<number>(1)
  const [emailStatusMsg, setEmailStatusMsg] = useState('')
  const [emailErrorMsg, setEmailErrorMsg] = useState('')

  const fetchDraft = async (leadId: string) => {
    setDraftLoading(true)
    setEmailStatusMsg('')
    setEmailErrorMsg('')
    try {
      const res = await fetch(`/api/sales-leads/${leadId}/email-draft`)
      if (!res.ok) throw new Error('Failed to generate draft')
      const data = await res.json()
      setDraftSubject(data.subject || '')
      setDraftBody(data.body || '')
      setDraftRecipient(data.recipientEmail || '')
      setDraftTemplateNum(data.templateNum || 1)
    } catch (err: any) {
      setEmailErrorMsg(err.message || 'Draft generation failed')
    } finally {
      setDraftLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && lead) {
      setStage(lead.currentStage)
      setCallerId(lead.assignedCallerId || '')
      setNotes(lead.notes || '')
      if (
        ['EMAIL_1_DUE', 'EMAIL_1_SENT', 'EMAIL_2_DUE', 'EMAIL_2_SENT', 'NEW'].includes(
          lead.currentStage,
        )
      ) {
        void fetchDraft(lead.id)
      }
    }
  }, [isOpen, lead?.id])

  if (!isOpen || !lead) return null

  const handleSendDraft = async () => {
    if (!draftRecipient) {
      setEmailErrorMsg('Cannot send email: Lead has no owner email address set.')
      return
    }
    setSendingEmail(true)
    setEmailErrorMsg('')
    setEmailStatusMsg('')
    try {
      const res = await fetch(`/api/sales-leads/${lead.id}/email-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: draftSubject, bodyText: draftBody }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Email dispatch failed')
      }
      setEmailStatusMsg(`Email ${draftTemplateNum} sent successfully to ${draftRecipient}! Stage updated to Email ${draftTemplateNum} Sent (+7 calendar days).`)
      await onUpdate(lead.id, {})
    } catch (err: any) {
      setEmailErrorMsg(err.message || 'Email dispatch failed')
    } finally {
      setSendingEmail(false)
    }
  }

  const handleQuickCallResult = async (resultKey: string) => {
    setSaving(true)
    try {
      await onUpdate(lead.id, { lastCallResult: resultKey })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleSaveFields = async () => {
    setSaving(true)
    try {
      await onUpdate(lead.id, {
        currentStage: stage || lead.currentStage,
        assignedCallerId: callerId !== undefined ? callerId || null : lead.assignedCallerId,
        notes: notes !== undefined ? notes : lead.notes,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!lead) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/sales-leads?id=${lead.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete lead')
      setShowDeleteConfirm(false)
      onClose()
      await onUpdate(lead.id, {})
    } catch (err: any) {
      setError(err.message || 'Could not delete lead')
    } finally {
      setDeleting(false)
    }
  }

  const isEmailDueStage =
    lead.currentStage === 'EMAIL_1_DUE' ||
    lead.currentStage === 'EMAIL_2_DUE' ||
    lead.currentStage === 'EMAIL_1_SENT' ||
    lead.currentStage === 'EMAIL_2_SENT'

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col">
          {/* Drawer Header */}
          <div className="p-6 bg-[#21263C] text-white flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge color="gold" className="text-[10px] uppercase font-bold tracking-wider">
                  {STAGE_LABELS[lead.currentStage as keyof typeof STAGE_LABELS] || lead.currentStage}
                </Badge>
                {lead.emailType && (
                  <Badge color="slate" className="text-[10px] uppercase">
                    {lead.emailType} Contact
                  </Badge>
                )}
              </div>
              <h2 className="text-xl font-light cantara-serif text-white">{lead.businessName}</h2>
              <p className="text-xs text-slate-300 flex items-center gap-1 mt-1">
                <MapPin className="w-3.5 h-3.5 text-cantara-gold" />
                {[lead.city, lead.state].filter(Boolean).join(', ') || 'Location unmapped'}
              </p>
            </div>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Interactive Email Draft Box (When Email is Due or Sent) */}
            {isEmailDueStage && (
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-blue-700" /> Outbound Email {draftTemplateNum} Draft & Approval
                  </h3>
                  <Badge color="blue" className="text-[10px]">
                    Template {draftTemplateNum} ({lead.emailType || 'GENERAL'})
                  </Badge>
                </div>

                {draftLoading ? (
                  <div className="py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> Generating email draft template...
                  </div>
                ) : (
                  <div className="space-y-3">
                    {emailStatusMsg && (
                      <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {emailStatusMsg}
                      </div>
                    )}
                    {emailErrorMsg && (
                      <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                        {emailErrorMsg}
                      </div>
                    )}

                    <div className="text-xs space-y-1">
                      <div className="flex justify-between text-slate-600 font-medium">
                        <span>To Recipient:</span>
                        <span className="font-mono text-slate-800">
                          {draftRecipient ? `${lead.ownerFirstName || 'Owner'} (${draftRecipient})` : '⚠️ No Owner Email Set'}
                        </span>
                      </div>
                    </div>

                    <Input
                      label="Subject Line"
                      value={draftSubject}
                      onChange={e => setDraftSubject(e.target.value)}
                      className="bg-white text-xs"
                    />

                    <Textarea
                      label="Email Body Draft"
                      value={draftBody}
                      onChange={e => setDraftBody(e.target.value)}
                      className="h-32 text-xs bg-white font-mono leading-relaxed"
                    />

                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void fetchDraft(lead.id)}
                        className="bg-white text-xs h-8"
                      >
                        Reset Template
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSendDraft}
                        disabled={sendingEmail || !draftRecipient}
                        className="bg-blue-700 hover:bg-blue-800 text-white text-xs h-8 gap-1.5"
                      >
                        {sendingEmail ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        Approve & Dispatch Email {draftTemplateNum}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Call Action Box */}
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-amber-700" /> Record Call Attempt
                </h3>
                <span className="text-[11px] text-amber-700 font-medium">
                  Same Caller continuity required
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {Object.entries(CALL_RESULT_LABELS).map(([value, label]) => (
                  <button
                    key={value}
                    disabled={saving}
                    onClick={() => void handleQuickCallResult(value)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border text-left transition-all ${
                      lead.lastCallResult === value
                        ? 'bg-amber-700 text-white border-amber-800 shadow-xs'
                        : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100/70 hover:border-amber-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Stage & Caller Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Current Stage
                </label>
                <SearchableSelect
                  options={Object.entries(STAGE_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  value={stage || lead.currentStage}
                  onChange={val => setStage(val)}
                  allowEmpty={false}
                  placeholder="Search stages..."
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Assigned Caller
                </label>
                <SearchableSelect
                  options={callers.map(c => ({
                    value: c.id,
                    label: c.name,
                  }))}
                  value={callerId !== '' ? callerId : lead.assignedCallerId || ''}
                  onChange={val => setCallerId(val)}
                  allowEmpty={true}
                  emptyLabel="-- Unassigned --"
                  placeholder="Search callers..."
                />
              </div>
            </div>

            {/* Lead Intelligence & 24 Fields Overview */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                  Prospect Intelligence & Data Fields
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEnrichModal(true)}
                  className="text-xs py-1 h-7 bg-white text-slate-700 hover:text-[#CAA15F] border-slate-200"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1 text-[#CAA15F]" /> Research Prospect
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border">
                  <div className="text-slate-400 mb-1 flex items-center gap-1">
                    <User className="w-3.5 h-3.5" /> Owner Contact
                  </div>
                  <div className="font-semibold text-slate-800">
                    {[lead.ownerFirstName, lead.ownerLastName].filter(Boolean).join(' ') ||
                      'Not specified'}
                  </div>
                  {lead.ownerEmail && (
                    <div className="text-slate-500 flex items-center gap-1 mt-1 truncate">
                      <Mail className="w-3 h-3 flex-shrink-0" /> {lead.ownerEmail}
                    </div>
                  )}
                  {lead.ownerPhone && (
                    <div className="text-slate-500 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" /> {lead.ownerPhone}
                    </div>
                  )}
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border">
                  <div className="text-slate-400 mb-1 flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-500" /> Google Rating & Reviews
                  </div>
                  <div className="font-semibold text-slate-800">
                    {lead.googleRating ? `${lead.googleRating} ★` : 'No rating'}
                    {lead.reviewCount ? ` (${lead.reviewCount} reviews)` : ''}
                  </div>
                  <div className="text-slate-500 mt-1">
                    {lead.locationType || 'Location type unmapped'}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border">
                  <div className="text-slate-400 mb-1 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" /> Facility Square Footage
                  </div>
                  <div className="text-slate-700 font-medium">
                    Indoor: {lead.sqftIndoor ? `${lead.sqftIndoor} sq ft` : 'N/A'}
                  </div>
                  <div className="text-slate-700 font-medium">
                    Outdoor: {lead.sqftOutdoor ? `${lead.sqftOutdoor} sq ft` : 'N/A'}
                  </div>
                  <div className="text-slate-900 font-semibold border-t pt-1 mt-1">
                    Combined: {lead.sqftCombined ? `${lead.sqftCombined} sq ft` : 'N/A'}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border">
                  <div className="text-slate-400 mb-1 flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5" /> Web & Pre-Call Brief
                  </div>
                  {lead.websiteUrl ? (
                    <a
                      href={lead.websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cantara-navy hover:underline flex items-center gap-1 font-medium truncate"
                    >
                      {lead.websiteUrl} <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  ) : (
                    <div className="text-slate-400">No website link</div>
                  )}
                  {lead.preCallBriefUrl && (
                    <a
                      href={lead.preCallBriefUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cantara-gold hover:underline flex items-center gap-1 mt-1 font-medium"
                    >
                      Pre-Call Brief <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>

              {/* AI Prospect Research Scorecard Section */}
              {(() => {
                let r: any = lead.aiResearchReport
                if (!r && lead.notes) {
                  const match = lead.notes.match(/<!-- AI_RESEARCH_JSON:([\s\S]*?)-->/)
                  if (match && match[1]) {
                    try { r = JSON.parse(match[1]) } catch { r = null }
                  }
                }

                if (!r) return null

                return (
                  <div className="p-4 rounded-xl border border-amber-200/80 bg-amber-50/40 space-y-3">
                    <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs uppercase tracking-wider">
                        <Sparkles className="w-4 h-4 text-cantara-gold" /> AI Prospect Intelligence Scorecard
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        {r.tierRating || 'Tier 2'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <div className="p-2.5 bg-white rounded-lg border border-amber-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Year Established</span>
                        <span className="font-semibold text-slate-800">{r.yearStarted}</span>
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-amber-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Ownership Tenure</span>
                        <span className="font-semibold text-slate-800">{r.ownershipTenure}</span>
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-amber-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Prior Sale History</span>
                        <span className="font-semibold text-slate-800">{r.priorSaleHistory}</span>
                      </div>
                    </div>

                    {r.businessProfileSummary && (
                      <div className="p-2.5 bg-white rounded-lg border border-amber-100 text-xs text-slate-700 leading-relaxed">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Executive Profile</span>
                        {r.businessProfileSummary}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Notes */}
              <Textarea
                label="Freeform Notes & Caller Log"
                value={notes !== undefined ? notes : lead.notes || ''}
                onChange={e => setNotes(e.target.value)}
                placeholder="Enter notes from your call or conversation..."
                className="h-24 text-xs"
              />
            </div>
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t bg-slate-50 flex items-center justify-between">
            <div className="text-xs text-slate-500 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Monday Sync: {lead.syncStatus}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={saving || deleting}
                className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
              </Button>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSaveFields} disabled={saving || deleting}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Delete Sales Lead</h3>
                <p className="text-xs text-slate-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100">
              Are you sure you want to delete <span className="font-bold text-slate-900">"{lead.businessName}"</span>? This will permanently remove it from your local database and from your Monday.com board (if synced).
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="bg-rose-600 hover:bg-rose-700 text-white font-medium gap-1.5"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? 'Deleting...' : 'Delete Lead'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <EnrichmentModal
        isOpen={showEnrichModal}
        leadId={lead.id}
        businessName={lead.businessName}
        initialNotes={lead.notes}
        initialReport={lead.aiResearchReport}
        onClose={() => setShowEnrichModal(false)}
        onNotesSaved={async () => {
          await onUpdate(lead.id, {})
        }}
      />
    </div>
  )
}
