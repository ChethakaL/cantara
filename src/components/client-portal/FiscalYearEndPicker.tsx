'use client'

import * as Select from '@radix-ui/react-select'
import { CalendarDays, Check, ChevronDown } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { defaultFiscalMonthEnd, FISCAL_MONTHS, fiscalMonthLength, parseFiscalYearEnd } from '@/lib/fiscal-year'

function SelectField({ label, value, placeholder, onValueChange, children, disabled, className }: {
  label: string
  value: string
  placeholder: string
  onValueChange: (value: string) => void
  children: ReactNode
  disabled?: boolean
  className: string
}) {
  return (
    <Select.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <Select.Trigger aria-label={label} className={className}>
        <Select.Value placeholder={placeholder} />
        <Select.Icon><ChevronDown className="h-4 w-4 text-slate-400" /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" sideOffset={6} className="z-[100] max-h-64 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <Select.Viewport className="p-1">{children}</Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}

function SelectOption({ value, children }: { value: string; children: ReactNode }) {
  return (
    <Select.Item value={value} className="flex cursor-pointer select-none items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-700 outline-none data-[highlighted]:bg-amber-50 data-[highlighted]:text-slate-900">
      <Select.ItemText>{children}</Select.ItemText>
      <Select.ItemIndicator><Check className="h-4 w-4 text-amber-600" /></Select.ItemIndicator>
    </Select.Item>
  )
}

export function FiscalYearEndPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const selected = useMemo(() => parseFiscalYearEnd(value), [value])
  const month = selected?.month ?? 0
  const day = selected?.day
  const days = month ? Array.from({ length: fiscalMonthLength(month) }, (_, index) => index + 1) : []

  function update(nextMonth: number, nextDay: number) {
    onChange(`${FISCAL_MONTHS[nextMonth - 1]} ${nextDay}`)
  }

  return (
    <div className="mt-1 flex h-10 items-center rounded-lg border border-slate-200 bg-white px-2 transition focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-100">
      <CalendarDays aria-hidden="true" className="ml-1 h-4 w-4 shrink-0 text-amber-600" />
      <SelectField
        label="Fiscal year end month"
        value={month ? FISCAL_MONTHS[month - 1] : ''}
        placeholder="Month"
        className="flex h-full min-w-0 flex-1 items-center justify-between rounded-md px-3 text-sm font-medium text-slate-700 outline-none hover:bg-slate-50 focus:bg-amber-50/40 disabled:cursor-not-allowed disabled:text-slate-400"
        onValueChange={label => {
          const nextMonth = FISCAL_MONTHS.indexOf(label) + 1
          update(nextMonth, defaultFiscalMonthEnd(nextMonth))
        }}
      >
        {FISCAL_MONTHS.map(label => <SelectOption key={label} value={label}>{label}</SelectOption>)}
      </SelectField>
      <span aria-hidden="true" className="h-5 w-px bg-slate-200" />
      <SelectField
        label="Fiscal year end day"
        value={day ? String(day) : ''}
        placeholder="Day"
        disabled={!month}
        className="flex h-full w-[5.25rem] shrink-0 items-center justify-between rounded-md px-3 text-sm font-medium text-slate-700 outline-none hover:bg-slate-50 focus:bg-amber-50/40 disabled:cursor-not-allowed disabled:text-slate-400"
        onValueChange={nextDay => update(month, Number(nextDay))}
      >
        {days.map(number => <SelectOption key={number} value={String(number)}>{number}</SelectOption>)}
      </SelectField>
    </div>
  )
}
