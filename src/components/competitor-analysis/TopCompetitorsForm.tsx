'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui'
import type { ManualCompetitorEntry } from '@/lib/competitor-analysis/types'
import { COMPETITOR_SLOT_COUNT } from '@/lib/competitor-portal-form'

type TopCompetitorsFormProps = {
  competitors: ManualCompetitorEntry[]
  onChange: (competitors: ManualCompetitorEntry[]) => void
  showAddress?: boolean
  addressRequired?: boolean
  maxCompetitors?: number
}

const emptyCompetitor = (): ManualCompetitorEntry => ({ name: '', address: '', websiteUrl: '' })

export default function TopCompetitorsForm({
  competitors,
  onChange,
  showAddress = true,
  addressRequired = false,
  maxCompetitors = COMPETITOR_SLOT_COUNT,
}: TopCompetitorsFormProps) {
  const rows = competitors.length ? competitors : [emptyCompetitor()]

  const updateCompetitor = (index: number, field: keyof ManualCompetitorEntry, value: string) => {
    const next = rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row))
    onChange(next)
  }

  const addCompetitor = () => {
    if (rows.length >= maxCompetitors) return
    onChange([...rows, emptyCompetitor()])
  }

  const removeCompetitor = (index: number) => {
    if (rows.length <= 1) {
      onChange([emptyCompetitor()])
      return
    }
    onChange(rows.filter((_, rowIndex) => rowIndex !== index))
  }

  const gridClass = showAddress ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-700">Top Competitors</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Enter up to {maxCompetitors} known competitors. The analysis will run on these specific businesses.
          </p>
        </div>
        {rows.length < maxCompetitors && (
          <button
            type="button"
            onClick={addCompetitor}
            className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        )}
      </div>

      <div className="space-y-3">
        {rows.map((competitor, index) => (
          <div key={index} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                Competitor {index + 1}
              </p>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCompetitor(index)}
                  className="text-slate-300 hover:text-rose-500 transition-colors"
                  title="Remove competitor"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className={`grid ${gridClass} gap-2`}>
              <Input
                label="Business Name *"
                placeholder="e.g. Rex Dog Hotel"
                value={competitor.name}
                onChange={event => updateCompetitor(index, 'name', event.target.value)}
              />
              {showAddress && (
                <Input
                  label={addressRequired ? 'Address *' : 'Address (optional)'}
                  placeholder="123 Main St, Vancouver, BC"
                  value={competitor.address ?? ''}
                  onChange={event => updateCompetitor(index, 'address', event.target.value)}
                />
              )}
              <Input
                label="Website"
                placeholder="https://..."
                value={competitor.websiteUrl ?? ''}
                onChange={event => updateCompetitor(index, 'websiteUrl', event.target.value)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
