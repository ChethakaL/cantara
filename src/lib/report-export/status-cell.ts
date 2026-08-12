/**
 * Detects markdown table cells that are status indicators (🟢/🟡/🔴),
 * without matching prose that merely contains those color words
 * (e.g. "ready", "reduce", "already").
 */
export function isStatusCell(text: string): boolean {
  const s = String(text ?? '').trim()
  if (!s) return false
  return /^(?:🟢|🟡|🔴)\s*(?:GREEN|YELLOW|RED)?$/i.test(s)
    || /^(?:GREEN|YELLOW|RED)$/i.test(s)
}

export type StatusBadgeKind = 'green' | 'yellow' | 'red'

export function getStatusBadgeKind(text: string): StatusBadgeKind | null {
  const s = String(text ?? '').trim()
  if (!isStatusCell(s)) return null
  if (/🟢/i.test(s) || /^GREEN$/i.test(s)) return 'green'
  if (/🟡/i.test(s) || /^YELLOW$/i.test(s)) return 'yellow'
  if (/🔴/i.test(s) || /^RED$/i.test(s)) return 'red'
  return null
}
