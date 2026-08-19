const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i

function splitCandidateList(input: unknown): string[] {
  if (Array.isArray(input)) return input.map(value => String(value || ''))
  if (typeof input === 'string') return input.split(/[,;\n]+/)
  return []
}

export function normalizeEmailAddress(value: string) {
  return value.trim().toLowerCase()
}

export function isValidEmailAddress(value: string) {
  return EMAIL_RE.test(value.trim())
}

export function parseEmailList(input: unknown): string[] {
  const seen = new Set<string>()
  const emails: string[] = []
  for (const raw of splitCandidateList(input)) {
    const trimmed = String(raw || '').trim()
    if (!trimmed) continue
    if (!isValidEmailAddress(trimmed)) {
      throw new Error(`Invalid email address: ${trimmed}`)
    }
    const email = normalizeEmailAddress(trimmed)
    if (seen.has(email)) continue
    seen.add(email)
    emails.push(email)
  }
  return emails
}

export function withoutEmail(emails: string[], skip?: string | null) {
  const ignored = normalizeEmailAddress(skip || '')
  return ignored ? emails.filter(email => email !== ignored) : emails
}
