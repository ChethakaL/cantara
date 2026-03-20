'use client'
import { useState } from 'react'
import { Flag, FlagReviewStatus, LeaseReport as LeaseReportData } from '../../../lib/lease-analysis/types'
import { Badge } from '@/components/ui'
import { getVisibleFlags, isVisibleFlag, setFlagReviewStatus } from '@/lib/lease-analysis/report-utils'

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
  const total = getVisibleFlags(red).length + getVisibleFlags(orange).length + getVisibleFlags(green).length

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

  const renderReviewControls = (flag: Flag, tone: 'red' | 'orange' | 'green', index: number) => {
    if (!adminMode || !report || !onReportUpdated) return null

    const saving = savingKey === `${tone}-${index}`
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
          {saving && <span className="text-[11px] font-medium text-slate-400">Saving...</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {red.some(isVisibleFlag) && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🔴</span>
            <h5 className="font-semibold text-rose-700">Red Flags — Requires Immediate Attention</h5>
            <Badge color="red">{getVisibleFlags(red).length}</Badge>
          </div>
          <div className="space-y-3">
            {red.map((f, i) => isVisibleFlag(f) && (
              <div key={i} className="p-4 rounded-xl bg-rose-50 border border-rose-100">
                <p className="font-semibold text-rose-800 text-sm mb-1">{f.issue}</p>
                {f.whyItMatters && <p className="text-sm text-rose-700 mb-2"><strong>Impact:</strong> {f.whyItMatters}</p>}
                {f.sourceSection && <p className="text-xs text-rose-600 font-mono mb-2">Source: {f.sourceSection}</p>}
                {renderReviewControls(f, 'red', i)}
              </div>
            ))}
          </div>
        </section>
      )}
      {orange.some(isVisibleFlag) && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🟡</span>
            <h5 className="font-semibold text-amber-700">Yellow Flags — Requires Clarification</h5>
            <Badge color="gold">{getVisibleFlags(orange).length}</Badge>
          </div>
          <div className="space-y-3">
            {orange.map((f, i) => isVisibleFlag(f) && (
              <div key={i} className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                <p className="font-semibold text-amber-800 text-sm mb-1">{f.issue}</p>
                {f.whyItMatters && <p className="text-sm text-amber-700 mb-2"><strong>Impact:</strong> {f.whyItMatters}</p>}
                {f.sourceSection && <p className="text-xs text-amber-600 font-mono mb-2">Source: {f.sourceSection}</p>}
                {renderReviewControls(f, 'orange', i)}
              </div>
            ))}
          </div>
        </section>
      )}
      {green.some(isVisibleFlag) && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🟢</span>
            <h5 className="font-semibold text-emerald-700">Green Flags — Favorable Provisions</h5>
            <Badge color="green">{getVisibleFlags(green).length}</Badge>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {green.map((f, i) => isVisibleFlag(f) && (
              <div key={i} className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                <p className="font-semibold text-emerald-800 text-sm mb-1">{f.issue}</p>
                {f.whyItMatters && <p className="text-sm text-emerald-700 mb-2"><strong>Impact:</strong> {f.whyItMatters}</p>}
                {f.sourceSection && <p className="text-xs text-emerald-600 font-mono italic">Source: {f.sourceSection}</p>}
                {renderReviewControls(f, 'green', i)}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
