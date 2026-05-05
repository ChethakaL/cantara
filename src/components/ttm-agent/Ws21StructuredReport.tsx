'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { Badge, Card, cn } from '@/components/ui'
import { CANTARA_TAXONOMY } from '@/lib/ttm-agent/taxonomy'
import type { TtmAnalysisView } from '@/lib/ttm-agent/types'

type MappedLedgerRow = {
  accountName: string
  accountCode: string | null
  cantaraCode: string | null
  candidateCodes: string[]
  mappingMethod: string | null
  total: number
}

function asMappedRows(raw: unknown): MappedLedgerRow[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (r): r is MappedLedgerRow =>
      typeof r === 'object' && r !== null && typeof (r as Record<string, unknown>).accountName === 'string',
  )
}

function mappingStatus(row: MappedLedgerRow) {
  if (row.cantaraCode === '_EXCLUDED') return 'Excluded'
  if (!row.cantaraCode) return row.candidateCodes.length ? 'Needs review' : 'Unmapped'
  if (row.mappingMethod === 'claude' || row.mappingMethod === 'fuzzy') return 'Needs review'
  return 'Auto-mapped'
}

function mappingTone(row: MappedLedgerRow) {
  const status = mappingStatus(row)
  if (status === 'Auto-mapped') return 'green' as const
  if (status === 'Needs review') return 'gold' as const
  return 'red' as const
}

function cantaraLabel(code: string | null | undefined) {
  if (!code) return 'Not assigned'
  const match = CANTARA_TAXONOMY.find(e => e.code === code)
  return match ? `${match.code} · ${match.category}` : code
}

export function Ws21StructuredReport({ analysis }: { analysis: TtmAnalysisView }) {
  const mappedPlRows = asMappedRows(analysis.normalizedData?.mappedPlRows)
  const mappedBsRows = asMappedRows(analysis.normalizedData?.mappedBsRows)
  const allMappingRows = [...mappedPlRows, ...mappedBsRows].sort((a, b) => a.accountName.localeCompare(b.accountName))
  const mappingRows = allMappingRows.filter((row) => mappingStatus(row) !== 'Excluded')

  const cantaraOptions = useMemo(() => CANTARA_TAXONOMY.map(e => ({ value: e.code, label: `${e.code} · ${e.category}` })), [])

  // Track which row has the dropdown open and any overrides
  const [openRow, setOpenRow] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [overrides, setOverrides] = useState<Record<string, string>>({})

  const filtered = cantaraOptions.filter(o => {
    const q = search.trim().toLowerCase()
    return !q || o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
  })

  function rowKey(row: MappedLedgerRow, i: number) {
    return `${row.accountName}-${row.accountCode ?? ''}-${i}`
  }

  function getDisplayCode(row: MappedLedgerRow, i: number) {
    return overrides[rowKey(row, i)] ?? row.cantaraCode
  }

  if (mappingRows.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-sm text-slate-400">No GL mapping data available.</p>
      </Card>
    )
  }

  return (
    <Card className="p-5">
      <h4 className="text-sm font-semibold text-slate-900 mb-4">GL Code Mapping</h4>
      <p className="text-xs text-slate-400 mb-3">Click any Cantara Category to change it.</p>
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-slate-900 text-white z-10">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.18em]">Account</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.18em]">GL Code</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.18em] min-w-[260px]">Cantara Category</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.18em]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {mappingRows.map((row, i) => {
                const key = rowKey(row, i)
                const displayCode = getDisplayCode(row, i)
                const isOpen = openRow === key
                const hasOverride = key in overrides
                const status = hasOverride ? 'Updated' : mappingStatus(row)
                const tone = hasOverride ? 'blue' as const : mappingTone(row)

                return (
                  <tr key={key} className={cn(hasOverride && 'bg-blue-50/30')}>
                    <td className="px-4 py-2.5 align-top text-slate-800 text-xs">{row.accountName}</td>
                    <td className="px-4 py-2.5 align-top text-slate-500 font-mono text-[11px]">{row.accountCode ?? '—'}</td>
                    <td className="px-4 py-2.5 align-top relative">
                      <button
                        type="button"
                        onClick={() => { setOpenRow(isOpen ? null : key); setSearch('') }}
                        className="flex items-center gap-1.5 w-full text-left text-xs text-slate-800 hover:text-cantara-navy rounded px-2 py-1 -mx-2 -my-1 hover:bg-slate-100 transition-colors"
                      >
                        <span className="flex-1 truncate">{cantaraLabel(displayCode)}</span>
                        <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                      </button>
                      {isOpen && (
                        <div className="absolute z-30 left-0 top-full mt-1 w-[320px] rounded-lg border border-slate-200 bg-white shadow-xl">
                          <div className="p-2 border-b border-slate-100">
                            <div className="relative">
                              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                              <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search categories..."
                                className="w-full rounded-md border border-slate-200 pl-8 pr-3 py-2 text-xs outline-none focus:border-amber-400"
                                autoFocus
                              />
                            </div>
                          </div>
                          <div className="max-h-48 overflow-auto p-1">
                            <button
                              type="button"
                              className="w-full rounded px-3 py-1.5 text-left text-xs text-slate-400 hover:bg-slate-100"
                              onClick={() => { setOverrides(p => ({ ...p, [key]: '' })); setOpenRow(null) }}
                            >
                              Clear / Not assigned
                            </button>
                            {filtered.map(o => (
                              <button
                                key={o.value}
                                type="button"
                                className={cn(
                                  'w-full rounded px-3 py-1.5 text-left text-xs hover:bg-slate-100',
                                  displayCode === o.value && 'bg-amber-50 font-medium'
                                )}
                                onClick={() => { setOverrides(p => ({ ...p, [key]: o.value })); setOpenRow(null) }}
                              >
                                {o.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <Badge color={tone}>{status}</Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  )
}
