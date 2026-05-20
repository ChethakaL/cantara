'use client'

import { memo, useEffect, useRef, useState } from 'react'
import { cn } from '@/components/ui'

function formatForInput(value: number, decimals = 0) {
  const numeric = value ?? 0
  return decimals > 0 ? Number(numeric).toFixed(decimals) : String(Math.round(numeric))
}

export type WorkbookNumberInputProps = {
  cellKey: string
  value: number
  decimals?: number
  className?: string
  hasOverride?: boolean
  /** Fired on each keystroke so parent can capture in-flight edits before blur. */
  onDraft?: (raw: string) => void
  onCommit: (parsed: number | null, raw: string) => void
}

/** Stable input — local text state so parent re-renders do not steal focus. */
export const WorkbookNumberInput = memo(function WorkbookNumberInput({
  cellKey,
  value,
  decimals = 0,
  className,
  hasOverride = false,
  onDraft,
  onCommit,
}: WorkbookNumberInputProps) {
  const [text, setText] = useState(() => formatForInput(value, decimals))
  const focusedRef = useRef(false)

  useEffect(() => {
    if (!focusedRef.current) {
      setText(formatForInput(value, decimals))
    }
  }, [cellKey, value, decimals])

  return (
    <input
      type="text"
      className={cn(
        'w-full rounded border px-2 py-1 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-blue-300',
        hasOverride ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-blue-200 bg-blue-50 text-slate-900',
        className,
      )}
      value={text}
      onFocus={() => {
        focusedRef.current = true
      }}
      onChange={(e) => {
        const next = e.target.value
        setText(next)
        onDraft?.(next)
      }}
      onBlur={(e) => {
        focusedRef.current = false
        const raw = e.currentTarget.value
        const parsed = Number(raw.replace(/[,$x]/gi, ''))
        onCommit(Number.isFinite(parsed) ? parsed : null, raw)
      }}
    />
  )
})
