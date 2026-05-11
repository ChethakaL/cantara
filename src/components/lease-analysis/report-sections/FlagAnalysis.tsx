'use client'
import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
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
  editMode?: boolean
  onReportDraftChange?: (report: LeaseReportData) => void
}

type FlagTone = 'red' | 'orange' | 'green'

const FLAG_KEYS: Record<FlagTone, keyof Pick<LeaseReportData, 'redFlags' | 'orangeFlags' | 'greenFlags'>> = {
  red: 'redFlags',
  orange: 'orangeFlags',
  green: 'greenFlags',
}

export function FlagAnalysis({ red, orange, green, report, adminMode = false, onReportUpdated, editMode = false, onReportDraftChange }: Props) {
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [newFlagTarget, setNewFlagTarget] = useState<{ tone: FlagTone; index: number } | null>(null)
  const flagRefs = useRef<Record<string, HTMLDivElement | null>>({})
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

  const sectionBadgeClassName = 'mt-3 w-full whitespace-normal break-words rounded-sm px-3.5 py-1.5 text-[11px] font-bold uppercase leading-relaxed tracking-[0.16em] text-white'

  const getSectionCount = (flags: Flag[]) => (adminMode ? flags.length : getVisibleFlags(flags).length)

  const updateDraftFlag = (tone: FlagTone, index: number, updates: Partial<Flag>) => {
    if (!report || !onReportDraftChange) return
    const key = FLAG_KEYS[tone]
    const nextFlags = [...(report[key] || [])]
    nextFlags[index] = { ...nextFlags[index], ...updates }
    onReportDraftChange({ ...report, [key]: nextFlags })
  }

  const deleteDraftFlag = (tone: FlagTone, index: number) => {
    if (!report || !onReportDraftChange) return
    const key = FLAG_KEYS[tone]
    onReportDraftChange({ ...report, [key]: (report[key] || []).filter((_, i) => i !== index) })
  }

  const addDraftFlag = (tone: FlagTone) => {
    if (!report || !onReportDraftChange) return
    const key = FLAG_KEYS[tone]
    const nextIndex = (report[key] || []).length
    const label = tone === 'red' ? 'New red flag' : tone === 'orange' ? 'New yellow flag' : 'New green flag'
    const nextFlag: Flag = {
      issue: label,
      whyItMatters: '',
      sourceSection: '',
    }
    onReportDraftChange({ ...report, [key]: [...(report[key] || []), nextFlag] })
    setNewFlagTarget({ tone, index: nextIndex })
  }

  const moveDraftFlag = (fromTone: FlagTone, index: number, toTone: FlagTone) => {
    if (!report || !onReportDraftChange || fromTone === toTone) return
    const fromKey = FLAG_KEYS[fromTone]
    const toKey = FLAG_KEYS[toTone]
    const fromFlags = [...(report[fromKey] || [])]
    const [flag] = fromFlags.splice(index, 1)
    onReportDraftChange({ ...report, [fromKey]: fromFlags, [toKey]: [...(report[toKey] || []), flag] })
  }

  const renderEditFields = (flag: Flag, tone: FlagTone, index: number) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <select
          value={tone}
          onChange={(event) => moveDraftFlag(tone, index, event.target.value as FlagTone)}
          className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-amber-100"
        >
          <option value="red">Red flag</option>
          <option value="orange">Yellow flag</option>
          <option value="green">Green flag</option>
        </select>
        <button
          type="button"
          onClick={() => deleteDraftFlag(tone, index)}
          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Flag title</p>
        <input
          value={flag.issue}
          onChange={(event) => updateDraftFlag(tone, index, { issue: event.target.value })}
          className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-100"
        />
      </div>
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Why it matters</p>
        <textarea
          value={flag.whyItMatters || ''}
          onChange={(event) => updateDraftFlag(tone, index, { whyItMatters: event.target.value })}
          className="min-h-[92px] w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm leading-relaxed text-slate-700 outline-none focus:ring-2 focus:ring-amber-100"
        />
      </div>
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Source</p>
        <textarea
          value={flag.sourceSection || ''}
          onChange={(event) => updateDraftFlag(tone, index, { sourceSection: event.target.value })}
          className="min-h-[70px] w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold uppercase leading-relaxed tracking-wider text-slate-700 outline-none focus:ring-2 focus:ring-amber-100"
        />
      </div>
    </div>
  )

  useEffect(() => {
    if (!newFlagTarget) return
    const id = `${newFlagTarget.tone}-${newFlagTarget.index}`
    const timer = window.setTimeout(() => {
      const node = flagRefs.current[id]
      node?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const firstInput = node?.querySelector('input, textarea, select') as HTMLElement | null
      firstInput?.focus()
      setNewFlagTarget(null)
    }, 80)
    return () => window.clearTimeout(timer)
  }, [newFlagTarget, red.length, orange.length, green.length])

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
      {editMode && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="text-xs font-semibold text-amber-800">Editing flags</span>
          <button type="button" onClick={() => addDraftFlag('red')} className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
            <Plus className="h-3.5 w-3.5" /> Add red
          </button>
          <button type="button" onClick={() => addDraftFlag('orange')} className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
            <Plus className="h-3.5 w-3.5" /> Add yellow
          </button>
          <button type="button" onClick={() => addDraftFlag('green')} className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
            <Plus className="h-3.5 w-3.5" /> Add green
          </button>
        </div>
      )}
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-3">
        <svg className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        <p className="text-xs leading-relaxed text-blue-800">
          Resolved flags are incorporated into the final lease analysis summary. Once all flags are reviewed, the report can be exported with flag resolutions included.
        </p>
      </div>
      {(adminMode ? red.length > 0 : red.some(isVisibleFlag)) && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🔴</span>
            <h5 className="font-semibold text-rose-700">Red Flags — Requires Immediate Attention</h5>
            <Badge color="red">{getSectionCount(red)}</Badge>
          </div>
          <div className="space-y-3">
            {red.map((f, i) => (adminMode || isVisibleFlag(f)) && (
              <div
                key={i}
                ref={(node) => { flagRefs.current[`red-${i}`] = node }}
                className={cn('p-4 rounded-sm border shadow-sm transition-shadow hover:shadow-md', newFlagTarget?.tone === 'red' && newFlagTarget.index === i && 'ring-2 ring-rose-300', f.reviewStatus === 'not_applicable' ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-[#fef2f2] border-rose-200')}
              >
                {editMode ? renderEditFields(f, 'red', i) : <>
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
                </div>
                <div className={`bg-[#8a2f2c] ${sectionBadgeClassName}`}>
                  HIGH • SECTION {f.sourceSection || 'F'}
                </div>
                {renderReviewControls(f, 'red', i)}
                </>}
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
              <div
                key={i}
                ref={(node) => { flagRefs.current[`orange-${i}`] = node }}
                className={cn('p-4 rounded-sm border shadow-sm transition-shadow hover:shadow-md', newFlagTarget?.tone === 'orange' && newFlagTarget.index === i && 'ring-2 ring-amber-300', f.reviewStatus === 'not_applicable' ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-[#fffbeb] border-amber-200')}
              >
                {editMode ? renderEditFields(f, 'orange', i) : <>
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
                </div>
                <div className={`bg-[#a6542f] ${sectionBadgeClassName}`}>
                  MED • SECTION {f.sourceSection || 'C'}
                </div>
                {renderReviewControls(f, 'orange', i)}
                </>}
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
              <div
                key={i}
                ref={(node) => { flagRefs.current[`green-${i}`] = node }}
                className={cn('p-4 rounded-sm border shadow-sm transition-shadow hover:shadow-md', newFlagTarget?.tone === 'green' && newFlagTarget.index === i && 'ring-2 ring-emerald-300', f.reviewStatus === 'not_applicable' ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-emerald-50 border-emerald-100')}
              >
                {editMode ? renderEditFields(f, 'green', i) : <>
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
                </div>
                <div className={`bg-emerald-700 ${sectionBadgeClassName}`}>
                  LOW • SECTION {f.sourceSection || 'G'}
                </div>
                {renderReviewControls(f, 'green', i)}
                </>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
