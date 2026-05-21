'use client'

import { useEffect, useId, useRef, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/components/ui'

export type DatePickerProps = {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  size?: 'sm' | 'md'
  className?: string
  allowClear?: boolean
}

function parseValue(value: string) {
  if (!value) return null
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function DatePicker({
  value,
  onChange,
  label,
  placeholder = 'Select date',
  size = 'md',
  className,
  allowClear = true,
}: DatePickerProps) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const selectedDate = parseValue(value)
  const [open, setOpen] = useState(false)
  const [monthCursor, setMonthCursor] = useState(startOfMonth(selectedDate ?? new Date()))

  useEffect(() => {
    if (value) {
      const parsed = parseValue(value)
      if (parsed) setMonthCursor(startOfMonth(parsed))
    }
  }, [value])

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  const monthStart = startOfMonth(monthCursor)
  const monthEnd = endOfMonth(monthCursor)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const displayFormat = size === 'sm' ? 'MMM d, yyyy' : 'MMMM d, yyyy'
  const triggerLabel = selectedDate ? format(selectedDate, displayFormat) : placeholder

  function selectDay(iso: string) {
    onChange(iso)
    setOpen(false)
  }

  function selectToday() {
    selectDay(format(new Date(), 'yyyy-MM-dd'))
  }

  function clearDate() {
    onChange('')
    setOpen(false)
  }

  const isSm = size === 'sm'

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {label ? (
        <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-slate-600">
          {label}
        </label>
      ) : null}
      <button
        id={id}
        type="button"
        onClick={() => setOpen(current => !current)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white text-left text-slate-700 shadow-sm transition-all',
          'hover:border-slate-300 focus:border-[#CAA15F] focus:outline-none focus:ring-2 focus:ring-[#CAA15F]/25',
          isSm ? 'h-9 min-w-[148px] px-2.5 text-[11px]' : 'h-[42px] px-3 text-sm',
          open && 'border-[#CAA15F] ring-2 ring-[#CAA15F]/25',
        )}
      >
        <span className="inline-flex min-w-0 flex-1 items-center gap-2">
          <CalendarDays className={cn('shrink-0 text-slate-400', isSm ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
          <span className={cn('truncate', !value && 'text-slate-400')}>{triggerLabel}</span>
        </span>
        {allowClear && value ? (
          <span
            role="button"
            tabIndex={0}
            onClick={event => {
              event.stopPropagation()
              clearDate()
            }}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                event.stopPropagation()
                clearDate()
              }
            }}
            className="rounded-md p-0.5 text-slate-300 hover:bg-slate-100 hover:text-slate-500"
            aria-label="Clear date"
          >
            <X className={isSm ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
          </span>
        ) : (
          <span className={cn('text-slate-400', isSm ? 'text-[10px]' : 'text-xs')}>▼</span>
        )}
      </button>

      {open ? (
        <div
          className={cn(
            'absolute z-30 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl',
            isSm ? 'right-0 top-[calc(100%+6px)] w-[288px]' : 'left-0 top-[calc(100%+8px)] w-[320px]',
          )}
        >
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMonthCursor(current => addMonths(current, -1))}
              className="rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-semibold text-slate-900 cantara-serif">{format(monthCursor, 'MMMM yyyy')}</p>
            <button
              type="button"
              onClick={() => setMonthCursor(current => addMonths(current, 1))}
              className="rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} className="py-1.5">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map(day => {
              const iso = format(day, 'yyyy-MM-dd')
              const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
              const inMonth = isSameMonth(day, monthCursor)
              const isToday = isSameDay(day, new Date())

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => selectDay(iso)}
                  className={cn(
                    'rounded-xl py-2 text-sm transition-all',
                    isSelected
                      ? 'bg-[#21263C] font-semibold text-[#E8C47C] shadow-sm'
                      : inMonth
                        ? 'text-slate-700 hover:bg-[#CAA15F]/15 hover:text-[#21263C]'
                        : 'text-slate-300 hover:bg-slate-50',
                    isToday && !isSelected && 'ring-1 ring-[#CAA15F]/40',
                  )}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={clearDate}
              className="text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={selectToday}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#21263C] transition-colors hover:bg-[#CAA15F]/20"
            >
              Today
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
