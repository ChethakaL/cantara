'use client'

import React from 'react'
import type { WS18Report, WS18Flag } from '@/types/ws1-8-types'
import { Button } from '@/components/ui'

interface ReportHeaderProps {
  report: WS18Report
  flags: WS18Flag[]
  onDelete: () => void
  onNewAnalysis: () => void
}

export default function ReportHeader({ report, flags, onDelete, onNewAnalysis }: ReportHeaderProps) {
  const generatedDate = new Date(report.generatedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm transition-all duration-300">
      <div className="px-8 py-6 border-b border-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-stone-50/50 to-white">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 text-[10px] font-bold tracking-wider text-stone-500 uppercase bg-stone-100 rounded-md border border-stone-200">
              WS1-8
            </span>
            <span className="px-2.5 py-1 text-[10px] font-bold tracking-wider text-stone-500 uppercase bg-stone-100 rounded-md border border-stone-200">
              Ownership Verification
            </span>
            <span className="px-2.5 py-1 text-[10px] font-bold tracking-wider text-stone-500 uppercase bg-stone-100 rounded-md border border-stone-200">
              Analysis Engine
            </span>
            <span className={`px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase rounded-md border ${
              report.hitlStatus === 'complete'
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {report.hitlStatus === 'complete' ? 'Ready' : 'Pending Review'}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">
              {report.clientName}
            </h1>
            <span className="text-stone-300 mx-1">--</span>
            <span className="text-stone-500 font-medium">Corporate Ownership Verification Report</span>
          </div>

          <p className="text-xs text-stone-400 flex items-center gap-2">
            <span>Generated {generatedDate}</span>
            <span className="w-1 h-1 bg-stone-200 rounded-full" />
            <span>{report.documents.length} documents processed</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="text-stone-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-all duration-200"
          >
            Delete report
          </Button>
          <Button
            size="sm"
            onClick={onNewAnalysis}
            className="bg-stone-900 hover:bg-stone-800 text-white shadow-sm transition-all duration-200"
          >
            + New Analysis
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-stone-100 bg-stone-50/20">
        <Stat icon="Total flags" value={flags.length} color="stone" />
        <Stat icon="Deal risk flags" value={flags.filter(f => f.severity === 'deal-risk').length} color="red" />
        <Stat icon="Review status" value={report.hitlStatus === 'complete' ? '100%' : 'In progress'} color="amber" />
        <Stat icon="Data source" value="Analysis Engine" color="stone" />
      </div>
    </div>
  )
}

function Stat({ icon, value, color }: { icon: string; value: string | number; color: 'red' | 'amber' | 'stone' }) {
  const colorMap = {
    red: 'text-red-600',
    amber: 'text-amber-600',
    stone: 'text-stone-600'
  }

  return (
    <div className="px-8 py-4 space-y-1">
      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">{icon}</p>
      <p className={`text-lg font-semibold ${colorMap[color]}`}>{value}</p>
    </div>
  )
}
