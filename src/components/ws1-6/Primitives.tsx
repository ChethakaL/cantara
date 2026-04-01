'use client'

import { cn } from '@/components/ui'

// ─────────────────────────────────────────────────────────────────────────────
// Flag Pill
// ─────────────────────────────────────────────────────────────────────────────
import type { FlagSeverity, FlagStatus, DocStatus, RiskLevel, TransitionComplexity } from '@/types/ws1-6-types'

const FLAG_CONFIG: Record<FlagSeverity, { label: string; dot: string; pill: string }> = {
  'deal-risk':     { label: 'Deal risk',         dot: 'bg-red-500',    pill: 'bg-red-50 text-red-800 border-red-200' },
  'negotiation':   { label: 'Negotiation point', dot: 'bg-amber-400',  pill: 'bg-amber-50 text-amber-900 border-amber-200' },
  'positive':      { label: 'Positive',          dot: 'bg-green-500',  pill: 'bg-green-50 text-green-800 border-green-200' },
  'informational': { label: 'Informational',     dot: 'bg-stone-400',  pill: 'bg-stone-100 text-stone-600 border-stone-200' },
}

export function FlagPill({ severity }: { severity: FlagSeverity }) {
  const cfg = FLAG_CONFIG[severity]
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full border',
      cfg.pill
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Flag Card (used in Summary + Admin review)
// ─────────────────────────────────────────────────────────────────────────────
const FLAG_BORDER: Record<FlagSeverity, string> = {
  'deal-risk':     'border-l-red-400',
  'negotiation':   'border-l-amber-400',
  'positive':      'border-l-green-400',
  'informational': 'border-l-stone-300',
}

interface FlagCardProps {
  severity: FlagSeverity
  id?: string
  domain?: string
  title: string
  description?: string
  sourceRef?: string
  status: FlagStatus
  onConfirm: () => void
  onNA: () => void
}

export function FlagCard({ severity, id, domain, title, description, sourceRef, status, onConfirm, onNA }: FlagCardProps) {
  return (
    <div className={cn(
      'flex items-start gap-4 bg-white border border-l-[3px] border-stone-200 rounded-lg px-4 py-3.5',
      FLAG_BORDER[severity]
    )}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <FlagPill severity={severity} />
          {id && <span className="text-[11px] text-stone-400">{id}</span>}
          {domain && <span className="text-[11px] text-stone-400">· {domain}</span>}
        </div>
        <p className="text-[13px] font-medium text-stone-800 leading-snug mb-1">{title}</p>
        {description && (
          <p className="text-[12px] text-stone-500 leading-relaxed mb-1">{description}</p>
        )}
        {sourceRef && (
          <p className="text-[11px] text-stone-400 italic">Source: {sourceRef}</p>
        )}
      </div>
      <div className="flex gap-1.5 flex-shrink-0 mt-0.5">
        <HITLButton
          label="Confirm"
          active={status === 'confirmed'}
          activeClass="bg-green-50 text-green-800 border-green-300"
          onClick={onConfirm}
        />
        <HITLButton
          label="N/A"
          active={status === 'na'}
          activeClass="bg-stone-100 text-stone-500 border-stone-300 line-through"
          onClick={onNA}
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HITL Button
// ─────────────────────────────────────────────────────────────────────────────
interface HITLButtonProps {
  label: string
  active: boolean
  activeClass: string
  onClick: () => void
}

function HITLButton({ label, active, activeClass, onClick }: HITLButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'text-[11px] px-2.5 py-1 rounded-full border transition-all',
        active
          ? activeClass
          : 'border-stone-200 text-stone-500 bg-white hover:bg-stone-50'
      )}
    >
      {active && label === 'Confirm' ? 'Confirmed ✓' : label}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Boolean Chip (Yes / No / Unknown)
// ─────────────────────────────────────────────────────────────────────────────
export function BoolChip({ value }: { value: boolean | null }) {
  if (value === null) return <span className="text-[11px] text-stone-400">—</span>
  return value
    ? <span className="inline-block bg-green-50 text-green-800 text-[11px] px-2 py-0.5 rounded-full">Yes</span>
    : <span className="inline-block bg-red-50 text-red-800 text-[11px] px-2 py-0.5 rounded-full">No</span>
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk Level Badge
// ─────────────────────────────────────────────────────────────────────────────
const RISK_CLASS: Record<RiskLevel, string> = {
  High:    'text-red-700 font-medium',
  Medium:  'text-amber-800 font-medium',
  Low:     'text-green-700 font-medium',
  Unknown: 'text-stone-400',
}
export function RiskBadge({ level }: { level: RiskLevel }) {
  return <span className={cn('text-[12px]', RISK_CLASS[level])}>{level}</span>
}

// ─────────────────────────────────────────────────────────────────────────────
// Transition Complexity Badge
// ─────────────────────────────────────────────────────────────────────────────
const COMPLEXITY_CLASS: Record<TransitionComplexity, string> = {
  High:    'text-red-700 font-medium',
  Medium:  'text-amber-800 font-medium',
  Low:     'text-green-700 font-medium',
  Unknown: 'text-stone-400',
}
export function ComplexityBadge({ level }: { level: TransitionComplexity }) {
  return <span className={cn('text-[12px]', COMPLEXITY_CLASS[level])}>{level}</span>
}

// ─────────────────────────────────────────────────────────────────────────────
// Doc Status Badge
// ─────────────────────────────────────────────────────────────────────────────
export function DocStatusBadge({ status, note }: { status: DocStatus; note?: string }) {
  const cfg = {
    complete:   { label: '✓ Complete',    cls: 'text-green-700' },
    incomplete: { label: '⚠ ' + (note ?? 'Incomplete'), cls: 'text-amber-800' },
    missing:    { label: '✕ Missing',     cls: 'text-red-700' },
  }[status]
  return <span className={cn('text-[11px]', cfg.cls)}>{cfg.label}</span>
}

// ─────────────────────────────────────────────────────────────────────────────
// Section Label
// ─────────────────────────────────────────────────────────────────────────────
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('text-[11px] font-medium text-stone-400 uppercase tracking-widest mb-3', className)}>
      {children}
    </p>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Coverage Gap Alert
// ─────────────────────────────────────────────────────────────────────────────
export function CoverageGapAlert({ gaps }: { gaps: { category: string; reason: string }[] }) {
  if (!gaps.length) return null
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 flex gap-2.5">
      <span className="text-[14px] flex-shrink-0 mt-0.5">⚠</span>
      <div>
        <p className="text-[12px] font-medium text-amber-900 mb-1">
          {gaps.length} recommended {gaps.length === 1 ? 'document' : 'documents'} not uploaded
        </p>
        <ul className="space-y-0.5">
          {gaps.map((g, i) => (
            <li key={i} className="text-[12px] text-amber-800">
              <span className="font-medium">{g.category}:</span> {g.reason}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Table wrapper (scrollable on narrow viewports)
// ─────────────────────────────────────────────────────────────────────────────
export function TableCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden mb-4">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] border-collapse">
          {children}
        </table>
      </div>
    </div>
  )
}

export function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn(
      'text-[11px] font-medium text-stone-500 bg-stone-50 px-3 py-2 text-left border-b border-stone-200 whitespace-nowrap',
      className
    )}>
      {children}
    </th>
  )
}

export function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={cn('px-3 py-2.5 border-b border-stone-100 text-stone-700 align-top leading-snug', className)}>
      {children}
    </td>
  )
}
