'use client'

import { useState, type ReactNode } from 'react'
import { CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { Badge } from '@/components/ui'

type DocumentUploadAccordionProps = {
  title: string
  description?: string
  assignedTo?: string | null
  deadlineBadge?: ReactNode
  statusBadge?: ReactNode
  headerActions?: ReactNode
  fileCount: number
  isComplete?: boolean
  tone?: 'default' | 'valuation' | 'admin'
  defaultOpen?: boolean
  children: ReactNode
}

export function DocumentUploadAccordion({
  title,
  description,
  assignedTo,
  deadlineBadge,
  statusBadge,
  headerActions,
  fileCount,
  isComplete = false,
  tone = 'default',
  defaultOpen = false,
  children,
}: DocumentUploadAccordionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const toneBorder =
    tone === 'valuation' ? 'border-amber-100/80' : tone === 'admin' ? 'border-slate-100' : 'border-slate-100'
  const toneHover =
    tone === 'valuation' ? 'bg-white/60 hover:bg-white/80' : 'bg-white hover:bg-slate-50/90'
  const showEmptyFileBadge = fileCount === 0 && !statusBadge

  return (
    <div className={`border-b ${toneBorder} last:border-b-0`}>
      <div className={`flex items-start gap-2 px-4 py-3.5 ${toneHover}`}>
        <button
          type="button"
          onClick={() => setOpen(value => !value)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <div className="mt-0.5 shrink-0 text-slate-400">
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-slate-800">{title}</p>
              {assignedTo && (
                <Badge color="slate">
                  {assignedTo.trim().toLowerCase() === 'me' || assignedTo.trim().toLowerCase() === 'self'
                    ? 'Owner'
                    : assignedTo}
                </Badge>
              )}
              {statusBadge}
              {deadlineBadge}
              {isComplete && <CheckCircle className="h-4 w-4 text-emerald-500" aria-label="Complete" />}
              {fileCount > 0 ? (
                <Badge color={isComplete ? 'green' : 'gold'}>
                  {fileCount === 1 ? '1 file' : `${fileCount} files`}
                </Badge>
              ) : showEmptyFileBadge ? (
                <Badge color="slate">No files yet</Badge>
              ) : null}
            </div>
            {description && (
              <p
                className={`mt-0.5 text-xs leading-relaxed ${
                  open ? '' : 'line-clamp-2'
                } ${tone === 'valuation' ? 'text-amber-700' : 'text-slate-500'}`}
              >
                {description}
              </p>
            )}
            {!open && (
              <p className="mt-1 text-[11px] text-slate-400">
                Expand to upload file(s)
              </p>
            )}
          </div>
        </button>
        {headerActions && (
          <div
            className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 pt-0.5"
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
          >
            {headerActions}
          </div>
        )}
      </div>
      {open && (
        <div className={`border-t px-4 pb-4 pt-3 ${tone === 'valuation' ? 'border-amber-100/60 bg-slate-50/40' : 'border-slate-100 bg-slate-50/60'}`}>
          {children}
        </div>
      )}
    </div>
  )
}
