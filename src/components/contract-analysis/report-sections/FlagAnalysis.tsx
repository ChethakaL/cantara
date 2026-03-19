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
  const sections = buildContractSections(riskCards, red, orange, green)

  if (!sections.length) {
    return (
      <div className="py-12 text-center text-sm text-slate-400">
        No flags parsed. View the raw report for flag analysis.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {sections.map((section) => {
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
                <FlagGroup title="Red Flags" emoji="🔴" tone="rose" flags={section.red} />
              )}
              {section.orange.length > 0 && (
                <FlagGroup title="Orange Flags" emoji="🟡" tone="amber" flags={section.orange} />
              )}
              {section.green.length > 0 && (
                <FlagGroup title="Green Flags" emoji="🟢" tone="emerald" flags={section.green} />
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

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

function FlagGroup({
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
