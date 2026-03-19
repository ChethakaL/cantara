'use client'
import { DocumentInventoryItem } from '../../../lib/contract-analysis/types'
import { Badge } from '@/components/ui'

interface Props {
  rows: DocumentInventoryItem[]
}

export function DocumentInventoryReport({ rows }: Props) {
  if (!rows || !rows.length) {
    return <div className="py-12 text-center text-sm text-slate-400">No document inventory extracted.</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            {['Document', 'Type', 'Date', 'Status'].map(h => (
              <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-slate-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
              <td className="py-3 px-3 text-sm font-medium text-slate-800">{r.document}</td>
              <td className="py-3 px-3 text-xs text-slate-500">{r.documentType}</td>
              <td className="py-3 px-3 text-xs text-slate-500">{r.date}</td>
              <td className="py-3 px-3">
                <Badge color={r.status.toLowerCase().includes('missing') ? 'red' : r.status.toLowerCase().includes('complete') ? 'green' : 'slate'}>
                  {r.status || 'Provided'}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
