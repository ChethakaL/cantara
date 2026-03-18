'use client'
import { Loader } from 'lucide-react'

interface Props {
  status: string
  rawMarkdown: string
}

export function AnalysisProgress({ status, rawMarkdown }: Props) {
  const getStreamingStatus = () => {
    if (status === 'uploading') return 'Uploading documents...'
    if (rawMarkdown.includes('---START_PART5---')) return 'Finalizing document inventory...'
    if (rawMarkdown.includes('---START_PART4---')) return 'Generating M&A transaction checklist...'
    if (rawMarkdown.includes('---START_PART3---')) return 'Performing flag analysis (Red/Orange/Green)...'
    if (rawMarkdown.includes('---START_PART2---')) return 'Extracting detailed findings & rent schedules...'
    if (rawMarkdown.includes('---START_PART1---')) return 'Building lease snapshot...'
    return 'Scanning documents...'
  }

  const charCount = rawMarkdown.length
  
  return (
    <div className="space-y-4 py-8">
      <Loader className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
      <div className="space-y-1 text-center">
        <p className="text-sm font-medium text-slate-600">
          {status === 'uploading' ? 'Preparing documents...' : 'AI is analyzing your lease...'}
        </p>
        <div className="flex flex-col items-center gap-1">
          <p className="text-xs text-amber-600 animate-pulse font-medium">
            {getStreamingStatus()}
          </p>
          {charCount > 0 && (
            <p className="text-[10px] text-slate-400 font-mono">
              {charCount.toLocaleString()} characters generated
            </p>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-400 italic text-center">This usually takes 60-90 seconds for a full lease package.</p>
    </div>
  )
}
