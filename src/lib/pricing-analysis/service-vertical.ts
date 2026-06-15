export type PricingServiceVertical = 'Boarding' | 'Daycare' | 'Grooming' | 'Training' | 'Other'

export const PRICING_SERVICE_VERTICAL_ORDER: PricingServiceVertical[] = [
  'Boarding',
  'Daycare',
  'Grooming',
  'Training',
  'Other',
]

export function classifyPricingService(service: string): PricingServiceVertical {
  const value = service.toLowerCase()
  if (/board|overnight|suite|kennel|night|cat board/.test(value)) return 'Boarding'
  if (/daycare|day care|half.?day|full.?day|day camp/.test(value)) return 'Daycare'
  if (/groom|bath|brush|spa|salon/.test(value)) return 'Grooming'
  if (/train|class|obedien|behavior/.test(value)) return 'Training'
  return 'Other'
}

export function groupRowsByPricingVertical<T extends { service: string }>(
  rows: T[],
): Record<PricingServiceVertical, T[]> {
  const grouped = Object.fromEntries(
    PRICING_SERVICE_VERTICAL_ORDER.map(vertical => [vertical, [] as T[]]),
  ) as Record<PricingServiceVertical, T[]>

  for (const row of rows) {
    grouped[classifyPricingService(row.service)].push(row)
  }

  return grouped
}
