'use client'
import { useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FindingSection } from '../../../lib/lease-analysis/types'
import { Badge } from '@/components/ui'

interface Props {
  findings: FindingSection[]
  raw: string
}

export function DetailedFindings({ findings, raw }: Props) {
  const [selected, setSelected] = useState(findings[0]?.id ?? '')
  const current = findings.find(f => f.id === selected)

  const parsedContent = useMemo(() => {
    if (!current) return null
    
    // Split by label markers
    const blocks = current.content.split(/\n(?=\*\*[\w\s&]+:\*\*)/)
    
    return blocks.map(block => {
      // Find the label - the regex is simple to avoid ES2018 issues
      const labelMatch = block.match(/^\s*\*\*([\w\s&]+):\*\*\s*/)
      if (labelMatch) {
        const label = labelMatch[1].trim()
        let text = block.slice(labelMatch[0].length).trim()
        let source: string | undefined
        
        // Find the source at the end - split by **Source:**
        const parts = text.split(/\*\*Source:\*\*/i)
        if (parts.length > 1) {
          source = parts.pop()?.trim()
          text = parts.join('**Source:**').trim()
        }
        
        return { label, text, source }
      }
      return { text: block.trim() }
    })
  }, [current])

  if (!findings.length) {
    const part2 = raw.match(/---START_PART2---([\s\S]*?)---END_PART2---/)?.[1] ?? raw
    return (
      <div className="prose prose-sm max-w-none text-slate-700 p-4 bg-slate-50 rounded-xl overflow-x-auto">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{part2}</ReactMarkdown>
      </div>
    )
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-320px)] min-h-[500px]">
      {/* Sidebar Navigation */}
      <div className="w-56 shrink-0 flex flex-col gap-1 overflow-y-auto pr-2 custom-scrollbar">
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
            <div className="flex items-center gap-2">
                <span className={`font-mono px-1.5 py-0.5 rounded shrink-0 ${selected === f.id ? 'bg-amber-100' : 'bg-slate-100'}`}>{f.id}</span>
                <span className="truncate">{f.title}</span>
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
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              <div className="grid grid-cols-1 gap-6">
                {parsedContent?.map((item, i) => (
                  <div key={i} className={`group ${item.label ? 'space-y-3' : ''}`}>
                    {item.label && (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-1 bg-amber-400 rounded-full" />
                        <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                          {item.label}
                        </div>
                      </div>
                    )}
                    <div className="prose prose-sm prose-slate max-w-none prose-p:leading-relaxed prose-headings:text-slate-800 prose-strong:text-slate-900 prose-table:border prose-table:border-slate-100 prose-th:bg-slate-50 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {item.text}
                      </ReactMarkdown>
                    </div>
                    {item.source && (
                      <div className="mt-3 pt-3 border-t border-slate-50 flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Citing</span>
                        <code className="text-[11px] font-medium text-amber-700 bg-amber-50/50 border border-amber-100 px-2 py-0.5 rounded-md font-mono">
                          {item.source}
                        </code>
                      </div>
                    )}
                  </div>
                ))}
              </div>
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
  )
}
