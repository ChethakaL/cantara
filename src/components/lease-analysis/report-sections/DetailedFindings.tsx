'use client'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FindingSection, RentScheduleRow } from '../../../lib/lease-analysis/types'
import {
  isRentFindingSection,
  stripRentScheduleFromFindingContent,
} from '@/lib/lease-analysis/report-utils'
import { Badge } from '@/components/ui'

interface Props {
  findings: FindingSection[]
  raw: string
  rentSchedule?: RentScheduleRow[]
}

export function DetailedFindings({ findings, raw, rentSchedule }: Props) {
  const [selected, setSelected] = useState(findings[0]?.id ?? '')
  const current = findings.find(f => f.id === selected)

  if (!findings.length) {
    const part2 = raw.match(/---START_PART2---([\s\S]*?)---END_PART2---/)?.[1] ?? raw
    return (
      <div className="prose prose-sm max-w-none text-slate-700 p-4 bg-slate-50 rounded-xl overflow-x-auto">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{part2}</ReactMarkdown>
      </div>
    )
  }

  return (
    <div className="space-y-6">
    <div className="flex gap-6 h-[calc(100vh-320px)] min-h-[500px]">
      {/* Sidebar Navigation */}
      <div className="w-56 shrink-0 flex flex-col gap-1 overflow-y-auto pr-2 custom-scrollbar border-r border-slate-100">
        {findings.map(f => (
          <button
            key={f.id}
            onClick={() => setSelected(f.id)}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all border ${
              selected === f.id 
                ? 'bg-amber-50 border-amber-200 text-amber-700 font-semibold shadow-sm' 
                : 'text-slate-500 border-transparent hover:bg-slate-100/50 hover:text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 overflow-hidden">
                <span className={`font-mono px-1.5 py-0.5 rounded shrink-0 ${selected === f.id ? 'bg-amber-100' : 'bg-slate-100'}`}>{f.id}</span>
                <span className="truncate flex-1">{f.title}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        {current ? (
          <>
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
              <h5 className="font-semibold text-slate-800 tracking-tight">{current.id} — {current.title}</h5>
              <Badge color="slate" className="text-[10px] uppercase tracking-wider text-slate-400 border-slate-200">Analysis Section</Badge>
            </div>
            <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
              <div className="prose prose-sm prose-slate max-w-none
                prose-p:leading-relaxed
                prose-headings:text-slate-800
                prose-strong:text-slate-900
                prose-table:border prose-table:border-slate-100
                prose-th:bg-slate-50 prose-th:px-3 prose-th:py-2
                prose-td:px-3 prose-td:py-2
                prose-blockquote:border-l-amber-300 prose-blockquote:bg-amber-50/20 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg
                prose-code:text-amber-700 prose-code:bg-amber-50/50 prose-code:px-1 prose-code:rounded">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {rentSchedule &&
                  rentSchedule.length > 0 &&
                  isRentFindingSection(current.id, current.title)
                    ? stripRentScheduleFromFindingContent(current.content)
                    : current.content}
                </ReactMarkdown>
              </div>
              {/* Rent schedule appears only within §2.3 RENT */}
              {rentSchedule && rentSchedule.length > 0 && isRentFindingSection(current.id, current.title) && (
                <div className="mt-8 border-t border-slate-100 pt-6">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-3">Rent Schedule</h4>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50">
                          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Lease Year</th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Months</th>
                          <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500">Per Annum</th>
                          <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500">Per Month</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rentSchedule.map((row, i) => (
                          <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 text-xs font-medium text-slate-600">{row.leaseYear}</td>
                            <td className="py-2.5 px-3 text-xs text-slate-600">{row.months}</td>
                            <td className="py-2.5 px-3 text-sm text-slate-800 text-right font-mono">{row.perAnnum}</td>
                            <td className="py-2.5 px-3 text-sm text-slate-800 text-right font-mono">{row.perMonth}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-4">
            <div className="w-16 h-16 rounded-3xl bg-slate-50 border border-slate-100 flex items-center justify-center animate-pulse">
                <div className="w-8 h-8 border-2 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Processing Document...</p>
          </div>
        )}
      </div>
    </div>
    </div>
  )
}
