'use client'
import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { ContractReport, ContractRiskCard, Flag } from '../../../lib/contract-analysis/types'
import { Badge, Button, Textarea, cn } from '@/components/ui'

type FlagReviewStatus = 'relevant' | 'questionable' | 'not_applicable'

interface Props {
  riskCards: ContractRiskCard[]
  red: Flag[]
  orange: Flag[]
  green: Flag[]
  report?: ContractReport
  adminMode?: boolean
  onReportUpdated?: (report: ContractReport) => Promise<void>
}

// ── Helpers to update flag review state immutably ────────────────────────────

function setContractFlagReviewStatus(
  report: ContractReport,
  tone: 'red' | 'orange' | 'green',
  index: number,
  status: FlagReviewStatus | undefined,
): ContractReport {
  const updated = { ...report }
  const flags = [...(tone === 'red' ? updated.redFlags : tone === 'orange' ? updated.orangeFlags : updated.greenFlags)]
  if (flags[index]) {
    flags[index] = { ...flags[index], reviewStatus: status }
  }
  if (tone === 'red') updated.redFlags = flags
  else if (tone === 'orange') updated.orangeFlags = flags
  else updated.greenFlags = flags
  return updated
}

function setContractFlagReviewNotes(
  report: ContractReport,
  tone: 'red' | 'orange' | 'green',
  index: number,
  notes: string,
): ContractReport {
  const updated = { ...report }
  const flags = [...(tone === 'red' ? updated.redFlags : tone === 'orange' ? updated.orangeFlags : updated.greenFlags)]
  if (flags[index]) {
    flags[index] = { ...flags[index], reviewNotes: notes }
  }
  if (tone === 'red') updated.redFlags = flags
  else if (tone === 'orange') updated.orangeFlags = flags
  else updated.greenFlags = flags
  return updated
}

function isVisibleFlag(flag: Flag): boolean {
  return flag.reviewStatus !== 'not_applicable'
}

function getVisibleFlags(flags: Flag[]): Flag[] {
  return flags.filter(isVisibleFlag)
}

// ── Component ────────────────────────────────────────────────────────────────

export function FlagAnalysis({ riskCards, red, orange, green, report, adminMode = false, onReportUpdated }: Props) {
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})

  const sections = buildContractSections(riskCards, red, orange, green)

  // Filter out not_applicable flags for non-admin view
  const visibleSections = adminMode
    ? sections
    : sections
        .map((s) => ({
          ...s,
          red: getVisibleFlags(s.red),
          orange: getVisibleFlags(s.orange),
          green: getVisibleFlags(s.green),
        }))
        .filter((s) => s.red.length + s.orange.length + s.green.length > 0)

  if (!visibleSections.length) {
    return (
      <div className="py-12 text-center text-sm text-slate-400">
        No flags parsed. View the raw report for flag analysis.
      </div>
    )
  }

  // ── Review handlers ──────────────────────────────────────────────────────

  const handleReviewChange = async (
    tone: 'red' | 'orange' | 'green',
    index: number,
    nextStatus: FlagReviewStatus,
    checked: boolean,
  ) => {
    if (!report || !onReportUpdated) return
    const key = `${tone}-${index}`
    const updatedReport = setContractFlagReviewStatus(report, tone, index, checked ? nextStatus : undefined)
    setSavingKey(key)
    try {
      await onReportUpdated(updatedReport)
    } catch (error) {
      console.error(error)
      alert(error instanceof Error ? error.message : 'Failed to update flag review')
    } finally {
      setSavingKey(null)
    }
  }

  const handleReviewNotesSave = async (
    tone: 'red' | 'orange' | 'green',
    index: number,
    nextNotes: string,
  ) => {
    if (!report || !onReportUpdated) return
    const key = `${tone}-${index}-notes`
    const updatedReport = setContractFlagReviewNotes(report, tone, index, nextNotes)
    setSavingKey(key)
    try {
      await onReportUpdated(updatedReport)
      setNoteDrafts((current) => {
        const next = { ...current }
        delete next[`${tone}-${index}`]
        return next
      })
    } catch (error) {
      console.error(error)
      alert(error instanceof Error ? error.message : 'Failed to update flag review notes')
    } finally {
      setSavingKey(null)
    }
  }

  // ── Review controls per flag ─────────────────────────────────────────────

  const renderReviewControls = (flag: Flag, tone: 'red' | 'orange' | 'green', index: number) => {
    if (!adminMode || !report || !onReportUpdated) return null

    const key = `${tone}-${index}`
    const saving = savingKey === key || savingKey === `${key}-notes`
    const noteValue = noteDrafts[key] ?? flag.reviewNotes ?? ''
    const labelClassName =
      tone === 'red'
        ? 'border-rose-200 bg-white/70 text-rose-700'
        : tone === 'orange'
          ? 'border-amber-200 bg-white/70 text-amber-700'
          : 'border-emerald-200 bg-white/70 text-emerald-700'

    return (
      <div className="mt-3 pt-3 border-t border-black/5 flex items-center justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Admin Review</p>
          <div className="flex items-center gap-2 flex-wrap">
            <label className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${labelClassName}`}>
              <input
                type="checkbox"
                className="rounded border-slate-300"
                checked={flag.reviewStatus === 'relevant'}
                disabled={saving}
                onChange={(event) => void handleReviewChange(tone, index, 'relevant', event.target.checked)}
              />
              Relevant
            </label>
            <label className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${labelClassName}`}>
              <input
                type="checkbox"
                className="rounded border-slate-300"
                checked={flag.reviewStatus === 'questionable'}
                disabled={saving}
                onChange={(event) => void handleReviewChange(tone, index, 'questionable', event.target.checked)}
              />
              Questionable
            </label>
            <label className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${labelClassName}`}>
              <input
                type="checkbox"
                className="rounded border-slate-300"
                checked={flag.reviewStatus === 'not_applicable'}
                disabled={saving}
                onChange={(event) => void handleReviewChange(tone, index, 'not_applicable', event.target.checked)}
              />
              Not applicable
            </label>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {flag.reviewStatus === 'relevant' && <Badge color="blue">Reviewed</Badge>}
          {flag.reviewStatus === 'questionable' && <Badge color="gold">Questionable</Badge>}
          {flag.reviewStatus === 'not_applicable' && <Badge color="slate">Not Applicable</Badge>}
          {flag.reevaluatedAt && <Badge color="blue">Re-evaluated</Badge>}
          {saving && <span className="text-[11px] font-medium text-slate-400">Saving...</span>}
        </div>
        {flag.reviewStatus === 'questionable' && (
          <div className="w-full">
            <Textarea
              rows={3}
              label="Why is this conclusion questionable?"
              placeholder="Capture the factual or interpretive issue so this flag can be re-reviewed."
              value={noteValue}
              onChange={(event) =>
                setNoteDrafts((current) => ({
                  ...current,
                  [key]: event.target.value,
                }))
              }
              onBlur={() => {
                if (noteValue === (flag.reviewNotes ?? '')) return
                void handleReviewNotesSave(tone, index, noteValue)
              }}
            />
            {flag.reevaluationReasoning && (
              <p className="mt-2 text-[11px] text-slate-500">{flag.reevaluationReasoning}</p>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-3">
        <svg className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        <p className="text-xs leading-relaxed text-blue-800">
          Review each flag and mark as Relevant, Questionable, or Not Applicable. Notes and resolutions are included in the final report export.
        </p>
      </div>

      {visibleSections.map((section) => {
        const totalFlags = section.red.length + section.orange.length + section.green.length
        return (
          <section key={section.key} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/70 flex items-start justify-between gap-4 flex-wrap">
              <div>
                {section.contractId && (
                  <p className="text-xs font-mono text-slate-400 mb-1">{section.contractId}</p>
                )}
                <h5 className="font-semibold text-slate-900">{section.contractName}</h5>
              </div>
              <Badge color="slate">{totalFlags} flags</Badge>
            </div>

            <div className="p-5 space-y-4">
              {section.red.length > 0 && (
                <FlagGroup title="Red Flags" emoji="🔴" tone="rose" flags={section.red} allRed={red} renderReviewControls={renderReviewControls} adminMode={adminMode} />
              )}
              {section.orange.length > 0 && (
                <FlagGroup title="Orange Flags" emoji="🟡" tone="amber" flags={section.orange} allOrange={orange} renderReviewControls={renderReviewControls} adminMode={adminMode} />
              )}
              {section.green.length > 0 && (
                <FlagGroup title="Green Flags" emoji="🟢" tone="emerald" flags={section.green} allGreen={green} renderReviewControls={renderReviewControls} adminMode={adminMode} />
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

// ── Contract grouping logic (unchanged) ──────────────────────────────────────

function buildContractSections(riskCards: ContractRiskCard[], red: Flag[], orange: Flag[], green: Flag[]) {
  const sections = riskCards.map((card) => ({
    key: card.contractId || card.contractName,
    contractId: card.contractId,
    contractName: card.contractName,
    aliases: buildAliases(card.contractName),
    red: [] as Flag[],
    orange: [] as Flag[],
    green: [] as Flag[],
  }))

  const fallbackSections = new Map<string, {
    key: string
    contractId?: string
    contractName: string
    aliases: string[]
    red: Flag[]
    orange: Flag[]
    green: Flag[]
  }>()

  const assignFlags = (flags: Flag[], tone: 'red' | 'orange' | 'green') => {
    for (const flag of flags) {
      const parsedName = extractContractName(flag.sourceSection || '') || flag.contractName || 'Unmapped Contract'
      const normalized = normalizeLabel(parsedName)

      const existing = sections.find((section) => section.aliases.some((alias) => normalized.includes(alias) || alias.includes(normalized)))
      if (existing) {
        existing[tone].push(flag)
        continue
      }

      const key = normalized || parsedName
      const fallback =
        fallbackSections.get(key) ??
        {
          key,
          contractName: parsedName,
          aliases: [normalized],
          red: [],
          orange: [],
          green: [],
        }
      fallback[tone].push(flag)
      fallbackSections.set(key, fallback)
    }
  }

  assignFlags(red, 'red')
  assignFlags(orange, 'orange')
  assignFlags(green, 'green')

  return [
    ...sections.filter((section) => section.red.length || section.orange.length || section.green.length),
    ...Array.from(fallbackSections.values()),
  ]
}

function buildAliases(contractName: string) {
  const aliases = new Set<string>()
  const normalized = normalizeLabel(contractName)
  if (normalized) aliases.add(normalized)

  const [mainName] = contractName.split('—').map((part) => part.trim())
  const mainNormalized = normalizeLabel(mainName || contractName)
  if (mainNormalized) aliases.add(mainNormalized)

  if (mainNormalized.includes('exclusive supply agreement')) aliases.add(normalizeLabel('Supply Agreement'))
  if (mainNormalized.includes('software subscription agreement')) aliases.add(normalizeLabel('Software Agreement'))
  if (mainNormalized.includes('equipment finance agreement')) aliases.add(normalizeLabel('Equipment Finance'))
  if (mainNormalized.includes('staffing services agreement')) aliases.add(normalizeLabel('Staffing Agreement'))

  return Array.from(aliases)
}

function extractContractName(source: string) {
  const cleaned = source.replace(/\*\*/g, '').trim()
  const match = cleaned.match(/^([^,]+?)(?:\s+Section|\s+§|,|$)/i)
  return match?.[1]?.trim() || null
}

function normalizeLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Flag group sub-component ─────────────────────────────────────────────────

function FlagGroup({
  title,
  emoji,
  tone,
  flags,
  allRed,
  allOrange,
  allGreen,
  renderReviewControls,
  adminMode,
}: {
  title: string
  emoji: string
  tone: 'rose' | 'amber' | 'emerald'
  flags: Flag[]
  allRed?: Flag[]
  allOrange?: Flag[]
  allGreen?: Flag[]
  renderReviewControls: (flag: Flag, tone: 'red' | 'orange' | 'green', index: number) => React.ReactNode
  adminMode: boolean
}) {
  const flagTone: 'red' | 'orange' | 'green' = tone === 'rose' ? 'red' : tone === 'amber' ? 'orange' : 'green'
  const allFlags = flagTone === 'red' ? allRed : flagTone === 'orange' ? allOrange : allGreen

  const styles =
    tone === 'rose'
      ? {
          wrap: 'bg-rose-50 border-rose-100',
          title: 'text-rose-800',
          text: 'text-rose-700',
          source: 'text-rose-600',
          actionWrap: 'bg-rose-100/60 border-rose-200 text-rose-800',
        }
      : tone === 'amber'
        ? {
            wrap: 'bg-amber-50 border-amber-100',
            title: 'text-amber-800',
            text: 'text-amber-700',
            source: 'text-amber-600',
            actionWrap: 'bg-amber-100/60 border-amber-200 text-amber-800',
          }
        : {
            wrap: 'bg-emerald-50 border-emerald-100',
            title: 'text-emerald-800',
            text: 'text-emerald-700',
            source: 'text-emerald-600',
            actionWrap: 'bg-emerald-100/60 border-emerald-200 text-emerald-800',
          }

  return (
    <div className={`rounded-xl border p-4 ${styles.wrap}`}>
      <div className="flex items-center gap-2 mb-3">
        <span>{emoji}</span>
        <p className={`text-sm font-semibold ${styles.title}`}>{title}</p>
      </div>
      <div className="space-y-3">
        {flags.map((flag, _localIndex) => {
          // Find the global index in the top-level array for review status updates
          const globalIndex = allFlags ? allFlags.indexOf(flag) : _localIndex
          const idx = globalIndex >= 0 ? globalIndex : _localIndex

          return (
            <div
              key={`${flag.issue}-${_localIndex}`}
              className={cn(
                'rounded-xl border border-white/70 bg-white/50 p-4',
                flag.reviewStatus === 'not_applicable' && 'opacity-60',
              )}
            >
              <p className={`font-semibold text-sm mb-1 ${styles.title}`}>{flag.issue}</p>
              {flag.whyItMatters && (
                <p className={`text-sm mb-2 ${styles.text}`}>
                  <strong>Impact:</strong> {flag.whyItMatters}
                </p>
              )}
              {flag.suggestedAction && (
                <div className={`text-sm mb-2 rounded-lg border ${styles.actionWrap} px-3 py-2 flex items-start gap-2`}>
                  <span className="shrink-0 mt-0.5">&#9889;</span>
                  <p><strong>Action Required:</strong> {flag.suggestedAction}</p>
                </div>
              )}
              {flag.sourceSection && (
                <p className={`text-xs font-mono ${styles.source}`}>
                  Source: {flag.sourceSection}
                </p>
              )}
              {renderReviewControls(flag, flagTone, idx)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { getVisibleFlags }
