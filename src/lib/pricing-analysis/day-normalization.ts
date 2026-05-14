import type { PricingAnalysisReport } from './types'

export interface FullDayNormalizedRow {
  service: string
  sellerPrice: string
  competitors: Record<string, string>
}

const FULL_DAY_HOURS = 8

function parseMoney(value: string | undefined | null): number | null {
  if (!value) return null
  const match = value.replace(/,/g, '').match(/\$?\s*(-?\d+(?:\.\d+)?)/)
  if (!match) return null
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : null
}

function packageDays(label: string): number | null {
  const match = label.match(/\b(5|10|20|30|40|50|60|80|100)\s*(?:extended\s*)?(?:full\s*)?(?:half\s*)?day/i)
  if (!match) return null
  return Number(match[1])
}

function toFullDayPrice(priceLabel: string | undefined | null, basisLabel: string): string {
  const amount = parseMoney(priceLabel)
  if (amount === null) return 'N/A'

  const basis = basisLabel.toLowerCase()
  const days = packageDays(basis)
  let fullDayAmount = amount

  if (days) {
    fullDayAmount = amount / days
  } else if (/half\s*day|part\s*day/.test(basis)) {
    fullDayAmount = amount * 2
  } else if (/\bhour|hourly|\/hr|per hr/.test(basis)) {
    fullDayAmount = amount * FULL_DAY_HOURS
  }

  return `$${fullDayAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function buildFullDayNormalizedRows(report: PricingAnalysisReport): FullDayNormalizedRow[] {
  return (report.serviceComparisons ?? []).filter((row) => {
    const serviceLabel = `${row.serviceCategory} ${row.serviceDetail ?? ''} ${row.sellerServiceBasis ?? ''}`.toLowerCase()
    return !/half\s*day|part\s*day|\bhour|hourly|\/hr|per hr/.test(serviceLabel)
  }).map((row) => {
    const service = row.serviceCategory || row.serviceDetail || 'Service'
    const sellerBasis = `${row.serviceCategory} ${row.serviceDetail ?? ''} ${row.sellerServiceBasis ?? ''}`
    const competitors: Record<string, string> = {}

    for (const competitor of row.competitorPrices ?? []) {
      const competitorBasis = `${service} ${competitor.serviceBasis ?? ''}`
      competitors[competitor.name] = toFullDayPrice(
        competitor.price,
        competitorBasis,
      )
    }

    return {
      service,
      sellerPrice: toFullDayPrice(row.sellerPrice, sellerBasis),
      competitors,
    }
  })
}
