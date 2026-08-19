export type OccupancyMonthlyEntry = {
  month: string
  boardingDogs: number
  daycareDogs: number
}

export type OccupancyReviewInputs = {
  totalDailyCapacity?: number
  boardingRuns?: number
  daycareSpots?: number
  groomingStations?: number
  monthlyData?: OccupancyMonthlyEntry[]
  updatedAt?: string
}

const OCCUPANCY_FIELD_KEYS = [
  'occupancyTotalDailyCapacity',
  'occupancyBoardingRuns',
  'occupancyDaycareSpots',
  'occupancyGroomingStations',
  'occupancyMonthlyData',
] as const

export function isOccupancyFormFieldKey(fieldKey: string): boolean {
  return (OCCUPANCY_FIELD_KEYS as readonly string[]).includes(fieldKey)
}

export function parseOccupancyMonthlyData(raw: string | undefined): OccupancyMonthlyEntry[] {
  const text = String(raw ?? '').trim()
  if (!text) return []

  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text) as unknown
      if (!Array.isArray(parsed)) return []
      return parsed
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null
          const month = String((entry as OccupancyMonthlyEntry).month ?? '').trim()
          if (!/^\d{4}-\d{2}$/.test(month)) return null
          return {
            month,
            boardingDogs: Number((entry as OccupancyMonthlyEntry).boardingDogs) || 0,
            daycareDogs: Number((entry as OccupancyMonthlyEntry).daycareDogs) || 0,
          }
        })
        .filter((entry): entry is OccupancyMonthlyEntry => Boolean(entry))
    } catch {
      return []
    }
  }

  return text
    .replace(/\\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [month = '', boarding = '', daycare = ''] = line.split('|').map((part) => part.trim())
      if (!/^\d{4}-\d{2}$/.test(month)) return null
      return {
        month,
        boardingDogs: Number(boarding) || 0,
        daycareDogs: Number(daycare) || 0,
      }
    })
    .filter((entry): entry is OccupancyMonthlyEntry => Boolean(entry))
}

export function formatOccupancyMonthlyData(entries: OccupancyMonthlyEntry[] | undefined): string {
  if (!Array.isArray(entries) || !entries.length) return ''
  return entries
    .map((entry) => `${entry.month}|${entry.boardingDogs}|${entry.daycareDogs}`)
    .join('\n')
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function buildOccupancyReviewInputs(responses: Record<string, string>): OccupancyReviewInputs {
  const monthlyData = parseOccupancyMonthlyData(responses.occupancyMonthlyData)
  return {
    totalDailyCapacity: parseOptionalNumber(responses.occupancyTotalDailyCapacity),
    boardingRuns: parseOptionalNumber(responses.occupancyBoardingRuns),
    daycareSpots: parseOptionalNumber(responses.occupancyDaycareSpots),
    groomingStations: parseOptionalNumber(responses.occupancyGroomingStations),
    monthlyData,
    updatedAt: new Date().toISOString(),
  }
}

export function occupancyInputsToFormResponses(inputs: OccupancyReviewInputs | undefined): Record<string, string> {
  if (!inputs) return {}
  return {
    occupancyTotalDailyCapacity: inputs.totalDailyCapacity != null ? String(inputs.totalDailyCapacity) : '',
    occupancyBoardingRuns: inputs.boardingRuns != null ? String(inputs.boardingRuns) : '',
    occupancyDaycareSpots: inputs.daycareSpots != null ? String(inputs.daycareSpots) : '',
    occupancyGroomingStations: inputs.groomingStations != null ? String(inputs.groomingStations) : '',
    occupancyMonthlyData: formatOccupancyMonthlyData(inputs.monthlyData),
  }
}

export type OccupancyFormFieldDef = {
  agentId: string
  agentName: string
  fieldKey: string
  label: string
  description: string | null
  inputType: string
  placeholder: string
  required: boolean
  options: unknown
  groupKey: string
  groupLabel: string
  sortOrder: number
}

export const OCCUPANCY_CAPACITY_FIELD_DEFS: OccupancyFormFieldDef[] = [
  {
    agentId: 'occupancy_review',
    agentName: 'Occupancy Review Agent',
    fieldKey: 'occupancyTotalDailyCapacity',
    label: 'Total Daily Capacity (Owner-Stated Max)',
    description: 'Owner-stated total capacity is preferred. Daycare spots = Total - Boarding Runs if left blank.',
    inputType: 'number',
    placeholder: 'e.g., 75',
    required: false,
    options: null,
    groupKey: 'occupancy_capacity',
    groupLabel: 'Capacity Model',
    sortOrder: 400,
  },
  {
    agentId: 'occupancy_review',
    agentName: 'Occupancy Review Agent',
    fieldKey: 'occupancyBoardingRuns',
    label: 'Boarding Runs / Kennels',
    description: 'Number of boarding runs or suites at full capacity.',
    inputType: 'number',
    placeholder: 'e.g., 45',
    required: false,
    options: null,
    groupKey: 'occupancy_capacity',
    groupLabel: 'Capacity Model',
    sortOrder: 410,
  },
  {
    agentId: 'occupancy_review',
    agentName: 'Occupancy Review Agent',
    fieldKey: 'occupancyDaycareSpots',
    label: 'Daycare Spots',
    description: 'Leave blank to auto-calculate as Total Capacity minus Boarding Runs.',
    inputType: 'number',
    placeholder: 'e.g., 30',
    required: false,
    options: null,
    groupKey: 'occupancy_capacity',
    groupLabel: 'Capacity Model',
    sortOrder: 420,
  },
  {
    agentId: 'occupancy_review',
    agentName: 'Occupancy Review Agent',
    fieldKey: 'occupancyGroomingStations',
    label: 'Grooming Stations',
    description: 'Optional. Number of grooming stations if applicable.',
    inputType: 'number',
    placeholder: 'e.g., 6',
    required: false,
    options: null,
    groupKey: 'occupancy_capacity',
    groupLabel: 'Capacity Model',
    sortOrder: 430,
  },
]

export function ensureOccupancyFormFields<T extends { agentId: string; fieldKey: string; sortOrder: number }>(
  rows: T[],
  activeAgentIds: string[],
): T[] {
  if (!activeAgentIds.includes('occupancy_review')) return rows
  const nonOccupancyRows = rows.filter(r => r.agentId !== 'occupancy_review')
  const capacityDefs = OCCUPANCY_CAPACITY_FIELD_DEFS.map(def => ({
    id: `occupancy_review_${def.fieldKey}`,
    ...def,
  } as unknown as T))
  return [...nonOccupancyRows, ...capacityDefs]
}

