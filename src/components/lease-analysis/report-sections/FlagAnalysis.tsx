'use client'
import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Flag, FlagReviewStatus, LeaseReport as LeaseReportData } from '../../../lib/lease-analysis/types'
import { Badge, Button, Textarea, cn } from '@/components/ui'
import { getVisibleFlags, isVisibleFlag, reevaluateFlagInReport, setFlagReviewNotes, setFlagReviewStatus } from '@/lib/lease-analysis/report-utils'

interface Props {
  red: Flag[]
  orange: Flag[]
  green: Flag[]
  report?: LeaseReportData
  adminMode?: boolean
  onReportUpdated?: (report: LeaseReportData) => Promise<void>
}

export function FlagAnalysis({ red, orange, green, report, adminMode = false, onReportUpdated }: Props) {
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const total = adminMode
    ? red.length + orange.length + green.length
    : getVisibleFlags(red).length + getVisibleFlags(orange).length + getVisibleFlags(green).length

  if (total === 0) {
    return (
      <div className="py-12 text-center text-sm text-slate-400">
        No active flags to review.
      </div>
    )
  }

  const handleReviewChange = async (
    tone: 'red' | 'orange' | 'green',
    index: number,
    nextStatus: FlagReviewStatus,
    checked: boolean,
  ) => {
    if (!report || !onReportUpdated) return

    const key = `${tone}-${index}`
    const updatedReport = setFlagReviewStatus(report, tone, index, checked ? nextStatus : undefined)
    setSavingKey(key)

    try {
      await onReportUpdated(updatedReport)
    } catch (error) {
      console.error(error)
      alert(error instanceof Error ? error.message : 'Failed to update flag review')
    } finally {
      setSavingKey(null)
    }
  }

  const handleReviewNotesSave = async (
    tone: 'red' | 'orange' | 'green',
    index: number,
    nextNotes: string,
  ) => {
    if (!report || !onReportUpdated) return

    const key = `${tone}-${index}-notes`
    const updatedReport = setFlagReviewNotes(report, tone, index, nextNotes)
    setSavingKey(key)

    try {
      await onReportUpdated(updatedReport)
      setNoteDrafts((current) => {
        const next = { ...current }
        delete next[`${tone}-${index}`]
        return next
      })
    } catch (error) {
      console.error(error)
      alert(error instanceof Error ? error.message : 'Failed to update flag review notes')
    } finally {
      setSavingKey(null)
    }
  }

  const getSectionCount = (flags: Flag[]) => (adminMode ? flags.length : getVisibleFlags(flags).length)

  const handleFlagReevaluation = async (
    tone: 'red' | 'orange' | 'green',
    index: number,
    flag: Flag,
  ) => {
    if (!report || !onReportUpdated) return

    const key = `${tone}-${index}-rerun`
    const note = (noteDrafts[`${tone}-${index}`] ?? flag.reviewNotes ?? '').trim()
    if (!note) {
      alert('Add a note explaining why the flag is questionable before rerunning.')
      return
    }

    setSavingKey(key)

    try {
      const res = await fetch('/api/lease-analysis/reevaluate-flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportRaw: report.raw,
          tone,
          flag,
          note,
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Failed to reevaluate flag')
      }

      const data = await res.json()
      const updatedReport = reevaluateFlagInReport(report, tone, index, data.decision, {
        ...data.flag,
        reevaluationReasoning: data.reasoning ?? '',
      })
      await onReportUpdated(updatedReport)
    } catch (error) {
      console.error(error)
      alert(error instanceof Error ? error.message : 'Failed to reevaluate flag')
    } finally {
      setSavingKey(null)
    }
  }

  const renderReviewControls = (flag: Flag, tone: 'red' | 'orange' | 'green', index: number) => {
    if (!adminMode || !report || !onReportUpdated) return null

    const key = `${tone}-${index}`
    const saving = savingKey === key || savingKey === `${key}-notes` || savingKey === `${key}-rerun`
    const noteValue = noteDrafts[key] ?? flag.reviewNotes ?? ''
    const labelClassName = tone === 'red'
      ? 'border-rose-200 bg-white/70 text-rose-700'
      : tone === 'orange'
        ? 'border-amber-200 bg-white/70 text-amber-700'
        : 'border-emerald-200 bg-white/70 text-emerald-700'

    return (
      <div className="mt-3 pt-3 border-t border-black/5 flex items-center justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Admin Review</p>
          <div className="flex items-center gap-2 flex-wrap">
            <label className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${labelClassName}`}>
              <input
                type="checkbox"
                className="rounded border-slate-300"
                checked={flag.reviewStatus === 'relevant'}
                disabled={saving}
                onChange={(event) => void handleReviewChange(tone, index, 'relevant', event.target.checked)}
              />
              Relevant
            </label>
            <label className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${labelClassName}`}>
              <input
                type="checkbox"
                className="rounded border-slate-300"
                checked={flag.reviewStatus === 'questionable'}
                disabled={saving}
                onChange={(event) => void handleReviewChange(tone, index, 'questionable', event.target.checked)}
              />
              Questionable
            </label>
            <label className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${labelClassName}`}>
              <input
                type="checkbox"
                className="rounded border-slate-300"
                checked={flag.reviewStatus === 'not_applicable'}
                disabled={saving}
                onChange={(event) => void handleReviewChange(tone, index, 'not_applicable', event.target.checked)}
              />
              Not applicable
            </label>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {flag.reviewStatus === 'relevant' && <Badge color="blue">Reviewed</Badge>}
          {flag.reviewStatus === 'questionable' && <Badge color="gold">Questionable</Badge>}
          {flag.reviewStatus === 'not_applicable' && <Badge color="slate">Not Applicable</Badge>}
          {flag.reevaluatedAt && <Badge color="blue">Re-evaluated</Badge>}
          {saving && <span className="text-[11px] font-medium text-slate-400">Saving...</span>}
        </div>
        {flag.reviewStatus === 'questionable' && (
          <div className="w-full">
            <Textarea
              rows={3}
              label="Why is this conclusion questionable?"
              placeholder="Capture the factual or interpretive issue so this flag can be re-reviewed."
              value={noteValue}
              onChange={(event) => setNoteDrafts((current) => ({
                ...current,
                [key]: event.target.value,
              }))}
              onBlur={() => {
                if (noteValue === (flag.reviewNotes ?? '')) return
                void handleReviewNotesSave(tone, index, noteValue)
              }}
            />
            <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
              {/* <p className="text-[11px] text-slate-400">Notes save when the field loses focus.</p> */}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => void handleFlagReevaluation(tone, index, flag)}
              >
                {savingKey === `${key}-rerun` ? 'Reevaluating...' : 'Rerun'}
              </Button>
            </div>
            {flag.reevaluationReasoning && (
              <p className="mt-2 text-[11px] text-slate-500">{flag.reevaluationReasoning}</p>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {(adminMode ? red.length > 0 : red.some(isVisibleFlag)) && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🔴</span>
            <h5 className="font-semibold text-rose-700">Red Flags — Requires Immediate Attention</h5>
            <Badge color="red">{getSectionCount(red)}</Badge>
          </div>
          <div className="space-y-3">
            {red.map((f, i) => (adminMode || isVisibleFlag(f)) && (
              <div key={i} className={cn('p-4 rounded-sm border shadow-sm transition-shadow hover:shadow-md', f.reviewStatus === 'not_applicable' ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-[#fef2f2] border-rose-200')}>
                <div className="flex justify-between items-start flex-wrap gap-4">
                  <div className="max-w-4xl">
                    <div className="flex items-start gap-4">
                      <AlertTriangle className="mt-1 h-[18px] w-[18px] shrink-0 text-[#8a2f2c]" strokeWidth={2.5} />
                      <div>
                        <h4 className="text-[17px] font-bold leading-tight tracking-tight text-[#8a2f2c]">
                          {f.issue}
                        </h4>
                        <p className="mt-2 text-[15px] leading-relaxed text-slate-700/90 font-medium">
                          {f.whyItMatters || 'Requires immediate attention.'}
                        </p>
                        {f.sourceSection && <p className="mt-2 text-[11px] text-rose-600/70 font-bold uppercase tracking-wider">Source: {f.sourceSection}</p>}
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#8a2f2c] text-white rounded-sm px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] shrink-0">
                     HIGH • SECTION {f.sourceSection || 'F'}
                  </div>
                </div>
                {renderReviewControls(f, 'red', i)}
              </div>
            ))}
          </div>
        </section>
      )}
      {(adminMode ? orange.length > 0 : orange.some(isVisibleFlag)) && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🟡</span>
            <h5 className="font-semibold text-amber-700">Yellow Flags — Requires Clarification</h5>
            <Badge color="gold">{getSectionCount(orange)}</Badge>
          </div>
          <div className="space-y-3">
            {orange.map((f, i) => (adminMode || isVisibleFlag(f)) && (
              <div key={i} className={cn('p-4 rounded-sm border shadow-sm transition-shadow hover:shadow-md', f.reviewStatus === 'not_applicable' ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-[#fffbeb] border-amber-200')}>
                <div className="flex justify-between items-start flex-wrap gap-4">
                  <div className="max-w-4xl">
                    <div className="flex items-start gap-4">
                      <div className="mt-[11px] h-2 w-2 shrink-0 rounded-full bg-[#a6542f]" />
                      <div>
                        <h4 className="text-[17px] font-bold leading-tight tracking-tight text-[#a6542f]">
                          {f.issue}
                        </h4>
                        <p className="mt-2 text-[15px] leading-relaxed text-slate-700/90 font-medium">
                          {f.whyItMatters || 'Requires clarification.'}
                        </p>
                        {f.sourceSection && <p className="mt-2 text-[11px] text-amber-600/70 font-bold uppercase tracking-wider">Source: {f.sourceSection}</p>}
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#a6542f] text-white rounded-sm px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] shrink-0">
                     MED • SECTION {f.sourceSection || 'C'}
                  </div>
                </div>
                {renderReviewControls(f, 'orange', i)}
              </div>
            ))}
          </div>
        </section>
      )}
      {(adminMode ? green.length > 0 : green.some(isVisibleFlag)) && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🟢</span>
            <h5 className="font-semibold text-emerald-700">Green Flags — Favorable Provisions</h5>
            <Badge color="green">{getSectionCount(green)}</Badge>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {green.map((f, i) => (adminMode || isVisibleFlag(f)) && (
              <div key={i} className={cn('p-4 rounded-sm border shadow-sm transition-shadow hover:shadow-md', f.reviewStatus === 'not_applicable' ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-emerald-50 border-emerald-100')}>
                <div className="flex justify-between items-start flex-wrap gap-4">
                  <div className="max-w-4xl">
                    <div className="flex items-start gap-4">
                      <div className="mt-[11px] h-2 w-2 shrink-0 rounded-full bg-emerald-700" />
                      <div>
                        <h4 className="text-[17px] font-bold leading-tight tracking-tight text-emerald-800">
                          {f.issue}
                        </h4>
                        <p className="mt-2 text-[15px] leading-relaxed text-slate-700/90 font-medium">
                          {f.whyItMatters || 'Favorable provision.'}
                        </p>
                        {f.sourceSection && <p className="mt-2 text-[11px] text-emerald-600/70 font-bold uppercase tracking-wider">Source: {f.sourceSection}</p>}
                      </div>
                    </div>
                  </div>
                  <div className="bg-emerald-700 text-white rounded-sm px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] shrink-0">
                     LOW • SECTION {f.sourceSection || 'G'}
                  </div>
                </div>
                {renderReviewControls(f, 'green', i)}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
