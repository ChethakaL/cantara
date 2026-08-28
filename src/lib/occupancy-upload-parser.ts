import * as XLSX from 'xlsx'
import type { OccupancyReviewInputs, OccupancyMonthlyEntry } from '@/lib/occupancy-form-fields'

function number(value: unknown): number {
  const parsed = Number(String(value ?? '').replace(/[$,%\s]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function monthKey(value: unknown, dailyExport = false): string | null {
  const raw = String(value ?? '').trim()
  if (/^\d{4}-\d{2}$/.test(raw)) return raw
  if (dailyExport) {
    const datedMatch = raw.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/)
    if (datedMatch) return `${datedMatch[3]}-${String(Number(datedMatch[1])).padStart(2, '0')}`
    const monthOnlyMatch = raw.match(/\b\d{1,2}\/(\d{1,2})\b/)
    if (monthOnlyMatch) return `${new Date().getFullYear()}-${String(Number(monthOnlyMatch[1])).padStart(2, '0')}`
  }
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function parseOccupancyUpload(bytes: Buffer, fileName: string): OccupancyReviewInputs | null {
  const workbook = XLSX.read(bytes, { type: 'buffer', cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) return null
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' })
  if (rows.length < 2) return null

  const headers = (rows[0] as unknown[]).map(value => String(value ?? '').trim().toLowerCase())
  const find = (...names: string[]) => headers.findIndex(header => names.some(name => header === name || header.includes(name)))
  const isDaily = headers.some(header => header.includes('day start') || header.includes('kennel occupancy') || header.includes('pet occupancy'))
  const monthIndex = find('month', 'date', 'period')
  const boardingIndex = find('boarding dogs', 'boardingdogs', 'boarding_dogs', 'boarding', 'day end')
  const daycareIndex = find('daycare dogs', 'daycaredogs', 'daycare_dogs', 'daycare')
  if (boardingIndex < 0 || daycareIndex < 0) return null

  const aggregates = new Map<string, { boarding: number; daycare: number; days: number }>()
  const boardingCapacities: number[] = []
  const daycareCapacities: number[] = []
  const groomingCounts: number[] = []
  const bathingCounts: number[] = []
  const kennelOccupancyIndex = find('kennel occupancy')
  const daycareOccupancyIndex = find('daycare pet occupancy', 'daycare occupancy')
  const groomingIndex = find('grooming')
  const bathingIndex = find('bathing')

  for (const row of rows.slice(1) as unknown[][]) {
    if (String(row[0] ?? '').trim().toLowerCase() === 'average') continue
    const key = monthKey(row[monthIndex >= 0 ? monthIndex : 0], isDaily)
    if (!key) continue
    const boarding = number(row[boardingIndex])
    const daycare = number(row[daycareIndex])
    if (groomingIndex >= 0 && number(row[groomingIndex]) > 0) groomingCounts.push(number(row[groomingIndex]))
    if (bathingIndex >= 0 && number(row[bathingIndex]) > 0) bathingCounts.push(number(row[bathingIndex]))
    const current = aggregates.get(key) ?? { boarding: 0, daycare: 0, days: 0 }
    current.boarding += boarding
    current.daycare += daycare
    current.days += 1
    aggregates.set(key, current)

    if (isDaily && kennelOccupancyIndex >= 0 && number(row[kennelOccupancyIndex]) > 0 && boarding > 0) {
      boardingCapacities.push(boarding / (number(row[kennelOccupancyIndex]) / 100))
    }
    if (isDaily && daycareOccupancyIndex >= 0 && number(row[daycareOccupancyIndex]) > 0 && daycare > 0) {
      daycareCapacities.push(daycare / (number(row[daycareOccupancyIndex]) / 100))
    }
  }

  const monthlyData: OccupancyMonthlyEntry[] = Array.from(aggregates, ([month, value]) => ({
    month,
    boardingDogs: Math.round(value.boarding / value.days),
    daycareDogs: Math.round(value.daycare / value.days),
  })).sort((a, b) => a.month.localeCompare(b.month))
  if (!monthlyData.length) return null

  const boardingRuns = boardingCapacities.length ? Math.round(boardingCapacities.reduce((a, b) => a + b, 0) / boardingCapacities.length) : undefined
  const daycareSpots = daycareCapacities.length ? Math.round(daycareCapacities.reduce((a, b) => a + b, 0) / daycareCapacities.length) : undefined
  // This export has grooming appointments but no grooming-utilization column.
  // Use the observed peak concurrent daily count as the best available station estimate.
  const groomingStations = groomingCounts.length ? Math.max(...groomingCounts) : undefined
  const bathingStations = bathingCounts.length ? Math.max(...bathingCounts) : undefined
  return {
    ...(boardingRuns != null ? { boardingRuns } : {}),
    ...(daycareSpots != null ? { daycareSpots } : {}),
    ...(groomingStations != null ? { groomingStations } : {}),
    ...(bathingStations != null ? { bathingStations } : {}),
    ...(boardingRuns != null || daycareSpots != null ? { totalDailyCapacity: (boardingRuns ?? 0) + (daycareSpots ?? 0) } : {}),
    monthlyData,
    updatedAt: new Date().toISOString(),
  }
}
