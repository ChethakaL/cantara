export type OccupancyMonthlyEntry = {
  month: string // YYYY-MM
  boardingDogs: number
  daycareDogs: number
}

export type OccupancyCapacityModel = {
  totalDailyCapacity?: number
  boardingRuns?: number
  daycareSpots?: number
  groomingStations?: number
  bathingStations?: number
}

const MONTH_NAME_TO_NUM: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
}

function stripCell(value: string): string {
  return value.replace(/\*\*/g, '').replace(/,/g, '').trim()
}

function parseMonthKey(raw: string): string | null {
  const cell = stripCell(raw)
  const iso = /^(\d{4})-(\d{2})$/.exec(cell)
  if (iso) return `${iso[1]}-${iso[2]}`

  const named = /^([A-Za-z]+)\s+(\d{4})$/.exec(cell)
  if (named) {
    const monthNum = MONTH_NAME_TO_NUM[named[1].toLowerCase()]
    if (!monthNum) return null
    return `${named[2]}-${String(monthNum).padStart(2, '0')}`
  }
  return null
}

function parseIntCell(raw: string): number | null {
  const cleaned = stripCell(raw).replace(/%/g, '')
  if (!cleaned || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null
  const n = Math.round(Number(cleaned))
  return Number.isFinite(n) ? n : null
}

/**
 * Extract boarding/daycare monthly rows from an occupancy markdown table.
 * Expected columns: Month | Boarding Dogs | Daycare Dogs | ...
 */
export function parseMonthlyDataFromMarkdown(markdown: string): OccupancyMonthlyEntry[] {
  if (!markdown) return []
  const rows: OccupancyMonthlyEntry[] = []
  const seen = new Set<string>()

  for (const line of markdown.split('\n')) {
    if (!line.includes('|')) continue
    const cells = line
      .split('|')
      .map((c) => c.trim())
      .filter((c, idx, arr) => !(idx === 0 && c === '') && !(idx === arr.length - 1 && c === ''))
    if (cells.length < 3) continue

    // skip separator / header rows
    if (cells.every((c) => /^:?-{3,}:?$/.test(c) || c === '')) continue
    const joined = cells.join(' ').toLowerCase()
    if (joined.includes('boarding') && joined.includes('daycare') && joined.includes('month')) continue

    const month = parseMonthKey(cells[0] ?? '')
    if (!month) continue
    const boardingDogs = parseIntCell(cells[1] ?? '')
    const daycareDogs = parseIntCell(cells[2] ?? '')
    if (boardingDogs === null || daycareDogs === null) continue
    if (seen.has(month)) continue
    seen.add(month)
    rows.push({ month, boardingDogs, daycareDogs })
  }

  return rows.sort((a, b) => a.month.localeCompare(b.month))
}

export function computeOccupancyMetrics(
  monthlyData: OccupancyMonthlyEntry[],
  capacityModel: OccupancyCapacityModel = {},
) {
  const totalCapacity =
    capacityModel.totalDailyCapacity ??
    (capacityModel.boardingRuns ?? 0) + (capacityModel.daycareSpots ?? 0)

  const monthlyTotals = monthlyData.map((m) => {
    const total = m.boardingDogs + m.daycareDogs
    return {
      month: m.month,
      boardingDogs: m.boardingDogs,
      daycareDogs: m.daycareDogs,
      total,
      utilization: totalCapacity > 0 ? +((total / totalCapacity) * 100).toFixed(1) : 0,
      boardingMix: total > 0 ? +((m.boardingDogs / total) * 100).toFixed(1) : 0,
      daycareMix: total > 0 ? +((m.daycareDogs / total) * 100).toFixed(1) : 0,
    }
  })

  const sorted = [...monthlyTotals].sort((a, b) => b.utilization - a.utilization)
  const peakMonths = sorted.slice(0, 3).map((m) => m.month)
  const troughMonths = sorted.slice(-3).reverse().map((m) => m.month)
  const avgUtilization =
    monthlyTotals.length > 0
      ? +(monthlyTotals.reduce((s, m) => s + m.utilization, 0) / monthlyTotals.length).toFixed(1)
      : 0
  const resolvedDaycareSpots =
    capacityModel.daycareSpots ??
    (capacityModel.totalDailyCapacity && capacityModel.boardingRuns
      ? capacityModel.totalDailyCapacity - capacityModel.boardingRuns
      : 0)
  const daycareDisplacementPct =
    totalCapacity > 0 ? +((resolvedDaycareSpots / totalCapacity) * 100).toFixed(1) : 0

  return {
    monthlyTotals,
    peakMonths,
    troughMonths,
    avgUtilization,
    daycareDisplacementPct,
    totalCapacity,
  }
}

/** Sync structured chart metrics from advisor-edited markdown tables. */
export function syncOccupancyReportFromMarkdown<T extends {
  markdown: string
  capacityModel?: OccupancyCapacityModel
  monthlyData?: OccupancyMonthlyEntry[]
  computed?: unknown
}>(report: T): T {
  const parsed = parseMonthlyDataFromMarkdown(report.markdown)
  if (!parsed.length) return report

  const computed = computeOccupancyMetrics(parsed, report.capacityModel ?? {})
  return {
    ...report,
    monthlyData: parsed,
    computed,
  }
}
