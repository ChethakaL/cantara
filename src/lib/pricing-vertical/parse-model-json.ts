/**
 * Best-effort parse of Claude's JSON reply (handles markdown fences, leading junk,
 * and occasional truncation by extracting the outermost `{ ... }` block).
 */
export function safeParseModelJson(raw: string): unknown {
  let s = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()

  const tryParse = (input: string) => {
    try {
      return JSON.parse(input)
    } catch {
      return null
    }
  }

  const direct = tryParse(s)
  if (direct !== null) return direct

  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start >= 0 && end > start) {
    const slice = s.slice(start, end + 1)
    const sliced = tryParse(slice)
    if (sliced !== null) return sliced
  }

  throw new Error(
    `Model returned JSON that could not be parsed. First 400 chars:\n${s.slice(0, 400)}`,
  )
}
