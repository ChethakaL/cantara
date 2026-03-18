'use client'
import { Flag } from '../../../lib/lease-analysis/types'
import { Badge } from '@/components/ui'

interface Props {
  red: Flag[]
  orange: Flag[]
  green: Flag[]
}

export function FlagAnalysis({ red, orange, green }: Props) {
  const total = red.length + orange.length + green.length
  if (total === 0) {
    return (
      <div className="py-12 text-center text-sm text-slate-400">
        No flags parsed. View the raw report for flag analysis.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {red.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🔴</span>
            <h5 className="font-semibold text-rose-700">Red Flags — Requires Immediate Attention</h5>
            <Badge color="red">{red.length}</Badge>
          </div>
          <div className="space-y-3">
            {red.map((f, i) => (
              <div key={i} className="p-4 rounded-xl bg-rose-50 border border-rose-100">
                <p className="font-semibold text-rose-800 text-sm mb-1">{f.issue}</p>
                {f.whyItMatters && <p className="text-sm text-rose-700 mb-2"><strong>Impact:</strong> {f.whyItMatters}</p>}
                {f.sourceSection && <p className="text-xs text-rose-600 font-mono mb-2">Source: {f.sourceSection}</p>}
                {f.recommendedAction && <p className="text-xs text-rose-700 bg-rose-100 rounded px-2 py-1"><strong>Action:</strong> {f.recommendedAction}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
      {orange.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🟡</span>
            <h5 className="font-semibold text-amber-700">Orange Flags — Requires Clarification</h5>
            <Badge color="gold">{orange.length}</Badge>
          </div>
          <div className="space-y-3">
            {orange.map((f, i) => (
              <div key={i} className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                <p className="font-semibold text-amber-800 text-sm mb-1">{f.issue}</p>
                {f.whyItMatters && <p className="text-sm text-amber-700 mb-2"><strong>Impact:</strong> {f.whyItMatters}</p>}
                {f.sourceSection && <p className="text-xs text-amber-600 font-mono mb-2">Source: {f.sourceSection}</p>}
                {f.recommendedAction && <p className="text-xs text-amber-700 bg-amber-100 rounded px-2 py-1"><strong>Action:</strong> {f.recommendedAction}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
      {green.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🟢</span>
            <h5 className="font-semibold text-emerald-700">Green Flags — Favorable Provisions</h5>
            <Badge color="green">{green.length}</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {green.map((f, i) => (
              <div key={i} className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                <p className="font-semibold text-emerald-800 text-sm mb-1">{f.issue}</p>
                {f.sourceSection && <p className="text-xs text-emerald-600 font-mono">Source: {f.sourceSection}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
