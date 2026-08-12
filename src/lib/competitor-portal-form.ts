import type { ManualCompetitorEntry } from '@/lib/competitor-analysis/types'

export const COMPETITOR_SLOT_COUNT = 5

export function competitorFieldKey(index: number, field: 'Name' | 'Website' | 'Address' | 'Category'): string {
  return `competitor${index}${field}`
}

export function readCompetitorSlots(responses: Record<string, string>): ManualCompetitorEntry[] {
  // Always return all 5 slots so Required Info shows a fixed competitor list.
  return Array.from({ length: COMPETITOR_SLOT_COUNT }, (_, slotIndex) => {
    const index = slotIndex + 1
    return {
      name: responses[competitorFieldKey(index, 'Name')] ?? '',
      websiteUrl: responses[competitorFieldKey(index, 'Website')] ?? '',
      address: responses[competitorFieldKey(index, 'Address')] ?? '',
    }
  })
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
  next.competitorSlotCount = String(COMPETITOR_SLOT_COUNT)
  return next
}
