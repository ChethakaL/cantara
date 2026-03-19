'use client'
import { ContractRiskCard, Flag } from '../../../lib/contract-analysis/types'
import { Badge } from '@/components/ui'

interface Props {
  riskCards: ContractRiskCard[]
  red: Flag[]
  orange: Flag[]
  green: Flag[]
}

export function FlagAnalysis({ riskCards, red, orange, green }: Props) {
  const total = red.length + orange.length + green.length
  const groupedFlags = groupFlagsByContract(red, orange, green)
  const hasRiskCards = riskCards.length > 0
  const hasGroupedFlags = groupedFlags.length > 0

  if (!hasRiskCards && !hasGroupedFlags && total === 0) {
    return (
      <div className="py-12 text-center text-sm text-slate-400">
        No flags parsed. View the raw report for flag analysis.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {hasGroupedFlags ? (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🗂️</span>
            <h5 className="font-semibold text-slate-800">Flags By Contract</h5>
            <Badge color="slate">{groupedFlags.length}</Badge>
          </div>
          <div className="space-y-4">
            {groupedFlags.map((group) => {
              const totalForContract = group.red.length + group.orange.length + group.green.length
              return (
                <div key={group.contractName} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/70 flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      {group.contractId && <p className="text-xs font-mono text-slate-400 mb-1">{group.contractId}</p>}
                      <h6 className="font-semibold text-slate-900">{group.contractName}</h6>
                    </div>
                    <Badge color="slate">{totalForContract} flags</Badge>
                  </div>
                  <div className="p-5 space-y-4">
                    {group.red.length > 0 && (
                      <FlagSection
                        title={`${group.contractName} Red Flags`}
                        emoji="🔴"
                        tone="rose"
                        flags={group.red}
                      />
                    )}
                    {group.orange.length > 0 && (
                      <FlagSection
                        title={`${group.contractName} Orange Flags`}
                        emoji="🟡"
                        tone="amber"
                        flags={group.orange}
                      />
                    )}
                    {group.green.length > 0 && (
                      <FlagSection
                        title={`${group.contractName} Green Flags`}
                        emoji="🟢"
                        tone="emerald"
                        flags={group.green}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ) : hasRiskCards ? (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🗂️</span>
            <h5 className="font-semibold text-slate-800">Per-Contract Risk Cards</h5>
            <Badge color="slate">{riskCards.length}</Badge>
          </div>
          <div className="space-y-4">
            {riskCards.map((card) => {
              const contractTotal = card.redFlags.length + card.orangeFlags.length + card.greenFlags.length
              return (
                <div key={card.contractId} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/70 flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-xs font-mono text-slate-400 mb-1">{card.contractId}</p>
                      <h6 className="font-semibold text-slate-900">{card.contractName}</h6>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge color={normalizeRiskTier(card.riskTier)}>{card.riskTier}</Badge>
                      <Badge color="slate">{card.recommendedAction}</Badge>
                      <Badge color="slate">{contractTotal} flags</Badge>
                    </div>
                  </div>
                  <div className="p-5 grid gap-4 md:grid-cols-3">
                    {card.redFlags.length > 0 && (
                      <FlagSection title={`${card.contractId} Red Flags`} emoji="🔴" tone="rose" flags={card.redFlags} />
                    )}
                    {card.orangeFlags.length > 0 && (
                      <FlagSection title={`${card.contractId} Orange Flags`} emoji="🟡" tone="amber" flags={card.orangeFlags} />
                    )}
                    {card.greenFlags.length > 0 && (
                      <FlagSection title={`${card.contractId} Green Flags`} emoji="🟢" tone="emerald" flags={card.greenFlags} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {!hasRiskCards && !hasGroupedFlags && red.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🔴</span>
            <h5 className="font-semibold text-rose-700">Package-Level Red Flags</h5>
            <Badge color="red">{red.length}</Badge>
          </div>
          <div className="space-y-3">
            {red.map((f, i) => (
              <div key={i} className="p-4 rounded-xl bg-rose-50 border border-rose-100">
                <p className="font-semibold text-rose-800 text-sm mb-1">{f.issue}</p>
                {f.whyItMatters && <p className="text-sm text-rose-700 mb-2"><strong>Impact:</strong> {f.whyItMatters}</p>}
                {f.sourceSection && <p className="text-xs text-rose-600 font-mono mb-2">Source: {f.sourceSection}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
      {!hasRiskCards && !hasGroupedFlags && orange.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🟡</span>
            <h5 className="font-semibold text-amber-700">Package-Level Orange Flags</h5>
            <Badge color="gold">{orange.length}</Badge>
          </div>
          <div className="space-y-3">
            {orange.map((f, i) => (
              <div key={i} className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                <p className="font-semibold text-amber-800 text-sm mb-1">{f.issue}</p>
                {f.whyItMatters && <p className="text-sm text-amber-700 mb-2"><strong>Impact:</strong> {f.whyItMatters}</p>}
                {f.sourceSection && <p className="text-xs text-amber-600 font-mono mb-2">Source: {f.sourceSection}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
      {!hasRiskCards && !hasGroupedFlags && green.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🟢</span>
            <h5 className="font-semibold text-emerald-700">Package-Level Green Flags</h5>
            <Badge color="green">{green.length}</Badge>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {green.map((f, i) => (
              <div key={i} className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                <p className="font-semibold text-emerald-800 text-sm mb-1">{f.issue}</p>
                {f.whyItMatters && <p className="text-sm text-emerald-700 mb-2"><strong>Impact:</strong> {f.whyItMatters}</p>}
                {f.sourceSection && <p className="text-xs text-emerald-600 font-mono italic">Source: {f.sourceSection}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function groupFlagsByContract(red: Flag[], orange: Flag[], green: Flag[]) {
  const groups = new Map<string, { contractName: string; contractId?: string; red: Flag[]; orange: Flag[]; green: Flag[] }>()

  const addFlags = (flags: Flag[], type: 'red' | 'orange' | 'green') => {
    for (const flag of flags) {
      const parsed = parseContractSource(flag)
      if (!parsed.contractName) continue

      const existing = groups.get(parsed.contractName) ?? {
        contractName: parsed.contractName,
        contractId: parsed.contractId,
        red: [],
        orange: [],
        green: [],
      }

      if (!existing.contractId && parsed.contractId) existing.contractId = parsed.contractId
      existing[type].push(flag)
      groups.set(parsed.contractName, existing)
    }
  }

  addFlags(red, 'red')
  addFlags(orange, 'orange')
  addFlags(green, 'green')

  return Array.from(groups.values())
}

function parseContractSource(flag: Flag): { contractName: string | null; contractId?: string } {
  if (flag.contractName) {
    const match = flag.contractName.match(/^(Contract\s+\d+)\s+[—-]\s+(.+)$/i)
    if (match) {
      return { contractId: match[1], contractName: match[2].trim() }
    }
    return { contractName: flag.contractName }
  }

  const source = flag.sourceSection || ''
  const contractName = source.split(',')[0]?.trim() || null
  return { contractName }
}

function normalizeRiskTier(tier: string): 'red' | 'gold' | 'green' | 'slate' {
  const lower = tier.toLowerCase()
  if (lower.includes('high')) return 'red'
  if (lower.includes('medium')) return 'gold'
  if (lower.includes('low')) return 'green'
  return 'slate'
}

function FlagSection({
  title,
  emoji,
  tone,
  flags,
}: {
  title: string
  emoji: string
  tone: 'rose' | 'amber' | 'emerald'
  flags: Flag[]
}) {
  const styles =
    tone === 'rose'
      ? {
          wrap: 'bg-rose-50 border-rose-100',
          title: 'text-rose-800',
          text: 'text-rose-700',
          source: 'text-rose-600',
        }
      : tone === 'amber'
        ? {
            wrap: 'bg-amber-50 border-amber-100',
            title: 'text-amber-800',
            text: 'text-amber-700',
            source: 'text-amber-600',
          }
        : {
            wrap: 'bg-emerald-50 border-emerald-100',
            title: 'text-emerald-800',
            text: 'text-emerald-700',
            source: 'text-emerald-600',
          }

  return (
    <div className={`rounded-xl border p-4 ${styles.wrap}`}>
      <div className="flex items-center gap-2 mb-3">
        <span>{emoji}</span>
        <p className={`text-sm font-semibold ${styles.title}`}>{title}</p>
      </div>
      <div className="space-y-3">
        {flags.map((flag, index) => (
          <div key={`${flag.issue}-${index}`} className="rounded-xl border border-white/70 bg-white/50 p-4">
            <p className={`font-semibold text-sm mb-1 ${styles.title}`}>{flag.issue}</p>
            {flag.whyItMatters && (
              <p className={`text-sm mb-2 ${styles.text}`}>
                <strong>Impact:</strong> {flag.whyItMatters}
              </p>
            )}
            {flag.sourceSection && (
              <p className={`text-xs font-mono ${styles.source}`}>
                Source: {flag.sourceSection}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
