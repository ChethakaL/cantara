import type { ManualCompetitorEntry } from '@/lib/competitor-analysis/types'

export const COMPETITOR_SLOT_COUNT = 5

export function competitorFieldKey(index: number, field: 'Name' | 'Website' | 'Address' | 'Category'): string {
  return `competitor${index}${field}`
}

export function readCompetitorSlots(responses: Record<string, string>): ManualCompetitorEntry[] {
  const slots = Array.from({ length: COMPETITOR_SLOT_COUNT }, (_, slotIndex) => {
    const index = slotIndex + 1
    return {
      name: responses[competitorFieldKey(index, 'Name')] ?? '',
      websiteUrl: responses[competitorFieldKey(index, 'Website')] ?? '',
      address: responses[competitorFieldKey(index, 'Address')] ?? '',
    }
  })

  let lastFilled = -1
  slots.forEach((slot, index) => {
    if (slot.name.trim() || slot.websiteUrl?.trim() || slot.address?.trim()) {
      lastFilled = index
    }
  })

  const visibleCount = Math.max(1, lastFilled + 1)
  return slots.slice(0, visibleCount)
}

export function writeCompetitorSlots(
  responses: Record<string, string>,
  competitors: ManualCompetitorEntry[],
): Record<string, string> {
  const next = { ...responses }
  for (let index = 1; index <= COMPETITOR_SLOT_COUNT; index += 1) {
    const competitor = competitors[index - 1]
    next[competitorFieldKey(index, 'Name')] = competitor?.name?.trim() ?? ''
    next[competitorFieldKey(index, 'Website')] = competitor?.websiteUrl?.trim() ?? ''
    next[competitorFieldKey(index, 'Address')] = competitor?.address?.trim() ?? ''
  }
  return next
}
