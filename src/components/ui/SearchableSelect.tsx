'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/components/ui'

export type SearchableSelectOption = {
  value: string
  label: string
  hint?: string
}

type SearchableSelectProps = {
  options: SearchableSelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  emptyLabel?: string
  allowEmpty?: boolean
  className?: string
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Search…',
  emptyLabel = '— Not mapped —',
  allowEmpty = true,
  className,
}: SearchableSelectProps) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selected = options.find(option => option.value === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      option =>
        option.label.toLowerCase().includes(q) ||
        option.hint?.toLowerCase().includes(q) ||
        option.value.toLowerCase().includes(q),
    )
  }, [options, query])

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        id={id}
        onClick={() => setOpen(current => !current)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left text-xs text-slate-700 shadow-sm transition-all',
          'hover:border-slate-300 focus:border-[#CAA15F] focus:outline-none focus:ring-2 focus:ring-[#CAA15F]/25',
          open && 'border-[#CAA15F] ring-2 ring-[#CAA15F]/25',
        )}
      >
        <span className={cn('truncate', !selected && 'text-slate-400')}>
          {selected?.label ?? emptyLabel}
        </span>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-xs outline-none focus:border-[#CAA15F] focus:ring-2 focus:ring-[#CAA15F]/20"
                autoFocus
              />
            </div>
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {allowEmpty ? (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onChange('')
                    setOpen(false)
                    setQuery('')
                  }}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-slate-50',
                    !value && 'bg-slate-50 font-medium text-slate-700',
                  )}
                >
                  {emptyLabel}
                  {!value && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                </button>
              </li>
            ) : null}
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-slate-400">No columns match your search</li>
            ) : (
              filtered.map(option => {
                const active = option.value === value
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(option.value)
                        setOpen(false)
                        setQuery('')
                      }}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-amber-50/60',
                        active && 'bg-amber-50 font-medium text-slate-800',
                      )}
                    >
                      <span className="min-w-0 truncate">
                        {option.label}
                        {option.hint ? <span className="ml-1 text-[10px] text-slate-400">({option.hint})</span> : null}
                      </span>
                      {active ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> : null}
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
