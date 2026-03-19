'use client'
import { useState } from 'react'
import { ChecklistItem } from '../../../lib/contract-analysis/types'
import { Badge } from '@/components/ui'
import { CheckCircle } from 'lucide-react'

interface Props {
  rows: ChecklistItem[]
}

export function TransactionChecklist({ rows }: Props) {
  const [checked, setChecked] = useState<Record<number, boolean>>({})
  
  if (!rows || !rows.length) {
    return <div className="py-12 text-center text-sm text-slate-400">No checklist items extracted.</div>
  }

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div
          key={i}
          onClick={() => setChecked(p => ({ ...p, [row.number]: !p[row.number] }))}
          className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
            checked[row.number] ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100 hover:border-slate-200'
          }`}
        >
          <div className={`w-5 h-5 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all ${
            checked[row.number] ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'
          }`}>
            {checked[row.number] && <CheckCircle className="w-3 h-3 text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className={`text-sm font-medium ${checked[row.number] ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                <span className="text-slate-400 mr-2">#{row.number}</span>
                {row.actionItem}
              </p>
              {row.priority && (
                <Badge color={row.priority.toLowerCase() === 'high' ? 'red' : row.priority.toLowerCase() === 'medium' ? 'gold' : 'slate'}>
                  {row.priority}
                </Badge>
              )}
            </div>
            {row.notes && <p className="text-xs text-slate-500 mt-1">{row.notes}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}
