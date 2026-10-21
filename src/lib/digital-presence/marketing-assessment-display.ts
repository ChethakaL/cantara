/** Replace internal research labels with advisor-friendly wording. */
export function advisorFriendlyMarketingText(value: string): string {
  return value
    .replace(/Chrome UX Report\s*\(CrUX\)|\bCrUX\b/gi, 'real visitor website data')
    .replace(/Google PageSpeed Insights/gi, 'website speed test')
    .replace(/Google Places API/gi, 'Google Business Profile records')
    .replace(/DataForSEO/gi, 'local search results')
}

/**
 * Turn marketingAssessment prose into short display points.
 * Supports newline / markdown bullets from newer runs, and sentence splits for older paragraph runs.
 */
export function splitMarketingAssessmentPoints(raw: string): string[] {
  const text = advisorFriendlyMarketingText(raw).replace(/\r\n/g, '\n').trim()
  if (!text) return []

  const linePoints = text
    .split('\n')
    .map((line) => line.replace(/^[-*•]\s+/, '').trim())
    .filter(Boolean)
  if (linePoints.length >= 2) return linePoints

  const sentencePoints: string[] = []
  const boundary = /[.!?](?:\s+|$)/g
  let match: RegExpExecArray | null
  let lastIndex = 0
  while ((match = boundary.exec(text)) !== null) {
    const end = match.index + match[0].length
    const chunk = text.slice(lastIndex, end).trim()
    if (chunk) sentencePoints.push(chunk)
    lastIndex = end
  }
  const tail = text.slice(lastIndex).trim()
  if (tail) sentencePoints.push(tail)
  return sentencePoints.length > 0 ? sentencePoints : [text]
}

export const BUYER_FOLLOW_UP_GUIDANCE_POINTS = [
  'Reconcile channel spend and bookings to platform exports and financials.',
  'Obtain campaign-level ad and website analytics, email open/click/booking results, documented goals, and peak/off-season trends.',
  'A spend-to-revenue ratio needs verified marketing expense and revenue.',
  'Public search placement and website performance do not verify ad spend, traffic, bookings, or sales.',
] as const
