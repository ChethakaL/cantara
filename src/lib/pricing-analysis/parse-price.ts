/**
 * Parse a listed/normalized price string for charts and numeric fields.
 * Avoids the "range glued into one number" bug ($48-$55 → 4855).
 */

/** Midpoint of an explicit range, or the first money amount. */
export function parsePriceForChart(raw: string | null | undefined): number | null {
  const s = String(raw ?? '').trim()
  if (!s || /^n\/?a$/i.test(s) || s === '--' || s === '-') return null

  // Explicit range: $48 - $55, $22 to $32, 48–55
  const range = s.match(
    /\$?\s*(\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*\$?\s*(\d+(?:\.\d+)?)/i,
  )
  if (range) {
    const a = Number(range[1])
    const b = Number(range[2])
    if (Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0) {
      return roundMoney((a + b) / 2)
    }
  }

  // First money token only — never strip all non-digits (that glues ranges).
  // Prefer full integer/decimal match (avoid \d{1,3} truncating 4811 → 481).
  const single = s.match(
    /(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+\.\d{1,2}|\d+)/,
  )
  if (!single) return null
  let n = Number(single[1].replace(/,/g, ''))
  if (!Number.isFinite(n) || n <= 0) return null

  n = unglueSuspiciousPrice(n)
  return n
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Repair already-glued integers from bad parses:
 * - 2232 → midpoint of 22 & 32
 * - 4811 → midpoint of 48 & 11
 * - 39010 / 44010 → package total 390 / 440 (trailing 10 or 20 = days)
 */
export function unglueSuspiciousPrice(n: number): number {
  if (!Number.isInteger(n) || n < 1000 || n > 999999) return n
  const s = String(n)

  // Package totals glued with day count: 39010 → 390, 44020 → 440
  if (s.length >= 4) {
    const days = Number(s.slice(-2))
    const total = Number(s.slice(0, -2))
    if ((days === 10 || days === 20) && total >= 50 && total <= 5000) {
      return total
    }
  }

  // Only unglue 4-digit values as two 2-digit pet prices (avoids $1,250 → 12+50 false positive).
  if (s.length === 4) {
    const a = Number(s.slice(0, 2))
    const b = Number(s.slice(2))
    if (a >= 15 && a <= 99 && b >= 10 && b <= 99) {
      return roundMoney((a + b) / 2)
    }
  }

  return n
}

/** Format a chart/display dollar amount. */
export function formatChartDollar(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`
}
