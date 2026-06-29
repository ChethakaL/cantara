export type CompetitorFormFieldDef = {
  agentId: string
  agentName: string
  fieldKey: string
  label: string
  inputType: 'text' | 'url'
  placeholder: string
  required: boolean
  groupKey: string
  groupLabel: string
  sortOrder: number
}

const COMPETITOR_AGENTS = [
  {
    agentId: 'competitor_analysis',
    agentName: 'Competitor Analysis Agent',
    groupKey: 'competitors',
    groupLabel: 'Competitor Inputs',
    baseSort: 140,
  },
  {
    agentId: 'pricing_analysis',
    agentName: 'Competitive Pricing Analysis Agent',
    groupKey: 'pricing_competitors',
    groupLabel: 'Competitor Pricing Inputs',
    baseSort: 500,
  },
] as const

export function competitorFieldSortOrder(fieldKey: string): number | null {
  const match = fieldKey.match(/^competitor(\d+)(Name|Website|Address|Category)$/)
  if (!match) return null
  const index = Number(match[1])
  const slot = { Name: 0, Website: 1, Address: 2, Category: 3 }[match[2] as 'Name' | 'Website' | 'Address' | 'Category']
  return index * 10 + slot
}

export function buildCompetitorFieldDefs(agentId: string): CompetitorFormFieldDef[] {
  const config = COMPETITOR_AGENTS.find(item => item.agentId === agentId)
  if (!config) return []

  const fields: CompetitorFormFieldDef[] = []
  for (let index = 1; index <= 5; index += 1) {
    const sortBase = config.baseSort + index * 10
    fields.push(
      {
        agentId: config.agentId,
        agentName: config.agentName,
        fieldKey: `competitor${index}Name`,
        label: `Competitor ${index} name`,
        inputType: 'text',
        placeholder: 'Competitor name',
        required: true,
        groupKey: config.groupKey,
        groupLabel: config.groupLabel,
        sortOrder: sortBase + 0,
      },
      {
        agentId: config.agentId,
        agentName: config.agentName,
        fieldKey: `competitor${index}Website`,
        label: `Competitor ${index} website`,
        inputType: 'url',
        placeholder: 'https://competitor.com',
        required: true,
        groupKey: config.groupKey,
        groupLabel: config.groupLabel,
        sortOrder: sortBase + 1,
      },
      {
        agentId: config.agentId,
        agentName: config.agentName,
        fieldKey: `competitor${index}Address`,
        label: `Competitor ${index} address`,
        inputType: 'text',
        placeholder: '123 Main St, City, State',
        required: false,
        groupKey: config.groupKey,
        groupLabel: config.groupLabel,
        sortOrder: sortBase + 2,
      },
      {
        agentId: config.agentId,
        agentName: config.agentName,
        fieldKey: `competitor${index}Category`,
        label: `Competitor ${index} business category`,
        inputType: 'text',
        placeholder: 'Boarding, Daycare, Grooming',
        required: false,
        groupKey: config.groupKey,
        groupLabel: config.groupLabel,
        sortOrder: sortBase + 3,
      },
    )
  }
  return fields
}

export function ensureCompetitorFormFields<T extends { agentId: string; fieldKey: string; sortOrder: number }>(
  rows: T[],
  activeAgentIds: string[],
): T[] {
  const byKey = new Map(rows.map(row => [row.fieldKey, row]))
  for (const agentId of activeAgentIds) {
    for (const def of buildCompetitorFieldDefs(agentId)) {
      if (byKey.has(def.fieldKey)) continue
      byKey.set(def.fieldKey, {
        id: `${agentId}_${def.fieldKey}`,
        agentId: def.agentId,
        agentName: def.agentName,
        fieldKey: def.fieldKey,
        label: def.label,
        description: null,
        inputType: def.inputType,
        placeholder: def.placeholder,
        required: def.required,
        options: null,
        groupKey: def.groupKey,
        groupLabel: def.groupLabel,
        sortOrder: def.sortOrder,
      } as unknown as T)
    }
  }
  return Array.from(byKey.values()).sort((a, b) => {
    const aCompetitor = competitorFieldSortOrder(a.fieldKey)
    const bCompetitor = competitorFieldSortOrder(b.fieldKey)
    if (aCompetitor != null && bCompetitor != null) return aCompetitor - bCompetitor
    if (aCompetitor != null) return 1
    if (bCompetitor != null) return -1
    return a.sortOrder - b.sortOrder || a.fieldKey.localeCompare(b.fieldKey)
  })
}
