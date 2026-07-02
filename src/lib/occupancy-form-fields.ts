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
