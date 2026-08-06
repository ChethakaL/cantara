'use client'

import { useEffect, useState } from 'react'
import {
  Award,
  Building2,
  Calendar,
  Check,
  FileText,
  History,
  Loader2,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react'
import { Badge, Button, Card } from '@/components/ui'

type ResearchReport = {
  yearStarted: string
  ownershipTenure: string
  priorSaleHistory: string
  tierRating: string
  tierReasoning: string
  businessProfileSummary: string
  [key: string]: string
}

export default function EnrichmentModal({
  isOpen,
  leadId,
  businessName,
  initialNotes,
  initialReport,
  onClose,
  onNotesSaved,
}: {
  isOpen: boolean
  leadId: string
  businessName: string
  initialNotes?: string | null
  initialReport?: any
  onClose: () => void
  onNotesSaved?: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<ResearchReport | null>(null)
  const [savingNotes, setSavingNotes] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [error, setError] = useState('')
  const [briefUrl, setBriefUrl] = useState('')

  useEffect(() => {
    if (!isOpen) return
    if (initialReport && typeof initialReport === 'object') {
      setReport(initialReport)
      setSavedSuccess(true)
      return
    }
    if (initialNotes) {
      const match = initialNotes.match(/<!-- AI_RESEARCH_JSON:([\s\S]*?)-->/)
      if (match && match[1]) {
        try {
          const parsed = JSON.parse(match[1])
          setReport(parsed)
          setSavedSuccess(true)
        } catch {
          // ignore error
        }
      }
    }
  }, [isOpen, initialNotes, initialReport])

  if (!isOpen) return null

  const runResearch = async () => {
    setLoading(true)
    setError('')
    setReport(null)
    setSavedSuccess(false)
    try {
      const res = await fetch(`/api/sales-leads/${leadId}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to complete AI research')
      }
      const data = await res.json()
      setReport(data.report)
      setBriefUrl(data.preCallBriefUrl || '')
    } catch (err: any) {
      setError(err.message || 'An error occurred during AI research')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveToNotes = async () => {
    if (!report) return
    if (briefUrl) {
      setSavedSuccess(true)
      return
    }
    setSavingNotes(true)
    setError('')
    try {
      const res = await fetch(`/api/sales-leads/${leadId}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saveToNotes: true }),
      })
      if (!res.ok) throw new Error('Failed to save report to notes')
      setSavedSuccess(true)
      if (onNotesSaved) onNotesSaved()
    } catch (err: any) {
      setError(err.message || 'Could not save report to lead notes')
    } finally {
      setSavingNotes(false)
    }
  }

  const recreateGoogleDoc = async () => {
    setSavingNotes(true)
    setError('')
    try {
      const res = await fetch(`/api/sales-leads/${leadId}/research-report`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not recreate Google Doc')
      setBriefUrl(data.preCallBriefUrl || '')
      setSavedSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Could not recreate Google Doc')
    } finally {
      setSavingNotes(false)
    }
  }

  const getTierColor = (tier: string) => {
    if (tier.includes('1')) return 'bg-amber-50 text-amber-800 border-amber-200'
    if (tier.includes('2')) return 'bg-blue-50 text-blue-800 border-blue-200'
    return 'bg-slate-50 text-slate-700 border-slate-200'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={onClose} />
      <Card className="relative w-full max-w-2xl max-h-[90vh] flex flex-col p-6 overflow-hidden bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b pb-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#21263C] text-cantara-gold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                AI Prospect Research & Intelligence
              </h2>
              <p className="text-xs text-slate-500">{businessName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
            {error}
          </div>
        )}

        {!report && !loading && (
          <div className="py-12 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
            <Building2 className="w-10 h-10 text-slate-400 mb-3" />
            <h3 className="text-sm font-semibold text-slate-800 mb-1">
              Run AI Prospect Deep Research
            </h3>
            <p className="text-xs text-slate-500 max-w-md mb-6">
              AI will build a factual pre-call brief from the lead record and verified public research, including ownership, facility operations, recent developments, sources, and outreach personalization.
            </p>
            <Button onClick={runResearch} className="gap-2 bg-[#21263C] hover:bg-slate-800 text-white">
              <Sparkles className="w-4 h-4 text-cantara-gold" /> Start AI Research Analysis
            </Button>
          </div>
        )}

        {loading && (
          <div className="py-16 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-cantara-gold" />
            <div>
              <p className="font-semibold text-slate-800 text-sm mb-1">
                AI is searching public records & business profiles...
              </p>
              <p className="text-slate-400 text-xs">
                Analyzing ownership history, establishment date, and resort tier profile.
              </p>
            </div>
          </div>
        )}

        {report && !loading && (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="space-y-3">
              {[
                ['1. Lead Qualification and Tier', [report.tierRating, report.leadQualification, report.tierReasoning]],
                ['2. Ownership and Business History', [report.yearStarted && `Year established: ${report.yearStarted}`, report.ownershipHistory, report.priorSaleHistory && `Prior sale history: ${report.priorSaleHistory}`]],
                ['3. Owner Intelligence and Relationship Profile', [report.ownerProfile, report.credentialsAndAssociations, report.socialAndCommunityProfile]],
                ['4. Facility and Operating Profile', [report.facilityAndOperatingProfile]],
                ['5. Recent Business Developments', [report.recentBusinessDevelopments]],
                ['6. Outreach Preparation', [report.recommendedPersonalization, report.businessProfileSummary]],
                ['7. Sources', [report.sources]],
              ].map(([title, values]) => (
                <section key={String(title)} className="rounded-xl border border-slate-200 bg-slate-50/60 overflow-hidden">
                  <div className="px-4 py-2.5 bg-[#21263C] text-white text-xs font-semibold tracking-wide">{title}</div>
                  <div className="px-4 py-3 text-sm text-slate-700 leading-6 whitespace-pre-wrap">
                    {(values as unknown[]).filter(Boolean).map((value, index) => <p key={index} className={index ? 'mt-2' : ''}>{String(value)}</p>)}
                  </div>
                </section>
              ))}
            </div>
            {savedSuccess && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700 flex items-center gap-1.5">
                <Check className="w-4 h-4" /> Editable public Google Doc created and saved to Google Drive.
                {briefUrl && <a className="ml-2 underline font-semibold" href={briefUrl} target="_blank" rel="noreferrer">Open brief</a>}
              </div>
            )}
          </div>
        )}

        <div className="border-t pt-4 mt-4 flex justify-between items-center">
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {report && (
              <Button variant="outline" onClick={recreateGoogleDoc} disabled={savingNotes} className="text-slate-600">
                <Sparkles className="w-3.5 h-3.5 mr-1 text-[#CAA15F]" /> Recreate Google Doc
              </Button>
            )}
            {report && (
              <Button variant="outline" onClick={runResearch} disabled={loading} className="text-slate-600">
                <Sparkles className="w-3.5 h-3.5 mr-1 text-[#CAA15F]" /> Re-run Research
              </Button>
            )}
          </div>
          {report && (
            <Button
              onClick={handleSaveToNotes}
              disabled={savingNotes || savedSuccess}
              className="gap-1.5 bg-[#21263C] text-white"
            >
              {savingNotes ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : savedSuccess ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Sparkles className="w-4 h-4 text-cantara-gold" />
              )}
              {savedSuccess ? 'Saved to Drive' : 'Save Report to Drive'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
