import crypto from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { getProjectEnv } from '@/lib/project-env'

const DEFAULT_NYLAS_API_URI = 'https://api.us.nylas.com'

function apiBase() {
  return (getProjectEnv('NYLAS_API_URI') || DEFAULT_NYLAS_API_URI).replace(/\/$/, '')
}

export function isNylasConfigured() {
  return Boolean(
    getProjectEnv('NYLAS_API_KEY') && getProjectEnv('NYLAS_CLIENT_ID') && getProjectEnv('NYLAS_CALLBACK_URI')
  )
}

export function nylasFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = getProjectEnv('NYLAS_API_KEY')
  if (!apiKey) throw new Error('NYLAS_API_KEY is not configured.')

  return fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  }).then(async (response) => {
    const text = await response.text()
    let data: unknown = null

    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text || null
    }

    if (!response.ok) {
      const topLevelMessage =
        typeof data === 'object' && data && 'message' in data && typeof (data as { message?: unknown }).message === 'string'
          ? (data as { message: string }).message
          : null
      const nestedError =
        typeof data === 'object' && data && 'error' in data && typeof (data as { error?: unknown }).error === 'object'
          ? ((data as { error?: { type?: unknown; message?: unknown } }).error ?? null)
          : null
      const nestedType = nestedError && typeof nestedError.type === 'string' ? nestedError.type : null
      const nestedMessage = nestedError && typeof nestedError.message === 'string' ? nestedError.message : null
      const message = nestedType || nestedMessage
        ? [nestedType, nestedMessage].filter(Boolean).join(': ')
        : topLevelMessage || `Nylas request failed (${response.status}).`
      throw new Error(message)
    }

    return data as T
  })
}

export function isGrantNotFoundError(error: unknown) {
  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  return message.includes('grant.not_found') || message.includes('grant not found') || message.includes('no grant found')
}

export function buildNylasAuthUrl(options?: { provider?: string; state?: string }) {
  const clientId = getProjectEnv('NYLAS_CLIENT_ID')
  const callbackUri = getProjectEnv('NYLAS_CALLBACK_URI')

  if (!clientId || !callbackUri) {
    throw new Error('Nylas auth is not configured.')
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUri,
    response_type: 'code',
    access_type: 'offline',
  })

  if (options?.provider) params.set('provider', options.provider)
  if (options?.state) params.set('state', options.state)

  return `${apiBase()}/v3/connect/auth?${params.toString()}`
}

export function exchangeNylasCodeForGrant(code: string) {
  const clientId = getProjectEnv('NYLAS_CLIENT_ID')
  const callbackUri = getProjectEnv('NYLAS_CALLBACK_URI')
  const apiKey = getProjectEnv('NYLAS_API_KEY')

  if (!clientId || !callbackUri || !apiKey) {
    throw new Error('Nylas auth is not configured.')
  }

  return nylasFetch<{ grant_id?: string; email?: string; provider?: string }>('/v3/connect/token', {
    method: 'POST',
    body: JSON.stringify({
      client_id: clientId,
      client_secret: apiKey,
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUri,
    }),
  })
}

export function fetchGrantDetails(grantId: string) {
  return nylasFetch<{ data?: { grant_id?: string; email?: string; provider?: string } }>(`/v3/grants/${grantId}`)
}

export function fetchGrantCalendars(grantId: string) {
  return nylasFetch<{ data?: Array<{ id?: string; is_primary?: boolean; read_only?: boolean }> }>(
    `/v3/grants/${grantId}/calendars`
  )
}

export function getActiveNylasConnection() {
  return (prisma as any).nylasConnection.findFirst({
    where: { active: true },
    orderBy: { updatedAt: 'desc' },
  })
}

export function deactivateNylasConnection(grantId: string) {
  return (prisma as any).nylasConnection.updateMany({
    where: { grantId },
    data: { active: false },
  })
}

export async function upsertActiveNylasConnection(input: {
  grantId: string
  email?: string | null
  provider?: string | null
  calendarIds?: string[]
}) {
  await (prisma as any).nylasConnection.updateMany({
    where: { active: true, grantId: { not: input.grantId } },
    data: { active: false },
  })

  return (prisma as any).nylasConnection.upsert({
    where: { grantId: input.grantId },
    update: {
      email: input.email || null,
      provider: input.provider || null,
      calendarIds: input.calendarIds || [],
      active: true,
    },
    create: {
      grantId: input.grantId,
      email: input.email || null,
      provider: input.provider || null,
      calendarIds: input.calendarIds || [],
      active: true,
    },
  })
}

export function verifyNylasWebhookSignature(rawBody: string, signatureHeader: string | null) {
  const secret = getProjectEnv('NYLAS_WEBHOOK_SECRET')
  if (!secret) return true
  if (!signatureHeader) return false

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader))
}

export function extractMeetingJoinUrl(event: Record<string, unknown> | null | undefined): string | null {
  if (!event || typeof event !== 'object') return null

  const conferencing = Array.isArray((event as { conferencing?: unknown[] }).conferencing)
    ? ((event as { conferencing?: Array<Record<string, unknown>> }).conferencing as Array<Record<string, unknown>>)
    : (event as { conferencing?: unknown }).conferencing && typeof (event as { conferencing?: unknown }).conferencing === 'object'
      ? [((event as { conferencing?: Record<string, unknown> }).conferencing as Record<string, unknown>)]
      : []

  for (const item of conferencing) {
    if (typeof item.url === 'string') return item.url
    if (typeof item.meeting_link === 'string') return item.meeting_link
    if (item.details && typeof item.details === 'object' && typeof (item.details as { url?: unknown }).url === 'string') {
      return (item.details as { url: string }).url
    }
  }

  const locations = Array.isArray((event as { locations?: unknown[] }).locations)
    ? ((event as { locations?: Array<Record<string, unknown>> }).locations as Array<Record<string, unknown>>)
    : []

  for (const location of locations) {
    if (typeof location.uri === 'string') return location.uri
  }

  if (typeof (event as { location?: unknown }).location === 'string') {
    return (event as { location: string }).location
  }

  if (typeof (event as { html_link?: unknown }).html_link === 'string') {
    return (event as { html_link: string }).html_link
  }

  return null
}

function cleanTranscriptFragment(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function looksLikeText(value: string) {
  const normalized = cleanTranscriptFragment(value)
  if (!normalized) return false
  if (/^https?:\/\//i.test(normalized)) return false
  if (/^[\w.-]+\.[A-Za-z]{2,}(\/.*)?$/.test(normalized)) return false
  return /[A-Za-z0-9]/.test(normalized)
}

function extractWordSequence(input: unknown): string {
  if (!Array.isArray(input)) return ''

  const words = input
    .map((item) => {
      if (typeof item === 'string') return cleanTranscriptFragment(item)
      if (!item || typeof item !== 'object') return ''

      const record = item as Record<string, unknown>
      const token =
        (typeof record.word === 'string' && record.word) ||
        (typeof record.text === 'string' && record.text) ||
        (typeof record.token === 'string' && record.token) ||
        (typeof record.value === 'string' && record.value)

      return token ? cleanTranscriptFragment(token) : ''
    })
    .filter(Boolean)

  return cleanTranscriptFragment(words.join(' '))
}

function normalizeTranscriptEntry(record: Record<string, unknown>): string {
  const directTextKeys = ['text', 'transcript', 'content', 'sentence', 'utterance', 'value', 'display_text', 'body']

  let text = ''
  for (const key of directTextKeys) {
    const value = record[key]
    if (typeof value === 'string' && looksLikeText(value)) {
      text = cleanTranscriptFragment(value)
      break
    }
  }

  if (!text && record.words) {
    text = extractWordSequence(record.words)
  }

  if (!text && Array.isArray(record.alternatives)) {
    text = normalizeTranscriptText(record.alternatives)
  }

  if (!text) return ''

  const speaker =
    (typeof record.speaker_name === 'string' && record.speaker_name) ||
    (typeof record.speaker === 'string' && record.speaker) ||
    (typeof record.name === 'string' && record.name) ||
    ''

  const normalizedSpeaker = cleanTranscriptFragment(speaker)
  if (normalizedSpeaker && normalizedSpeaker.toLowerCase() !== text.toLowerCase()) {
    return `${normalizedSpeaker}: ${text}`
  }

  return text
}

function walkTranscript(input: unknown, results: string[]) {
  if (typeof input === 'string') {
    if (looksLikeText(input)) results.push(cleanTranscriptFragment(input))
    return
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      walkTranscript(item, results)
    }
    return
  }

  if (!input || typeof input !== 'object') return

  const record = input as Record<string, unknown>
  const normalizedEntry = normalizeTranscriptEntry(record)
  if (normalizedEntry) {
    results.push(normalizedEntry)
    return
  }

  const beforeCount = results.length
  const prioritizedKeys = [
    'utterances',
    'entries',
    'segments',
    'items',
    'paragraphs',
    'sentences',
    'results',
    'transcripts',
    'alternatives',
    'monologues',
    'data',
    'words',
  ]

  for (const key of prioritizedKeys) {
    if (record[key] !== undefined) {
      walkTranscript(record[key], results)
    }
  }

  if (results.length > beforeCount) return

  for (const value of Object.values(record)) {
    walkTranscript(value, results)
  }
}

export function normalizeTranscriptText(input: unknown): string {
  const fragments: string[] = []
  walkTranscript(input, fragments)

  const deduped = fragments.filter((fragment, index) => {
    if (!fragment) return false
    return index === 0 || fragment !== fragments[index - 1]
  })

  return deduped.join('\n').trim()
}

export function getDefaultCalendarId(connection: { calendarIds: string[] }) {
  return (connection.calendarIds && connection.calendarIds[0]) || 'primary'
}

export function getAutoConferencingProvider(provider?: string | null) {
  const normalized = (provider || '').toLowerCase()
  if (normalized.includes('google')) return 'Google Meet'
  if (normalized.includes('microsoft')) return 'Microsoft Teams'
  return null
}

export async function createCalendarEvent(args: {
  grantId: string
  calendarId: string
  title: string
  description?: string | null
  startAt: Date
  endAt: Date | null
  meetingUrl?: string | null
  provider?: string | null
}) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const conferencingProvider = getAutoConferencingProvider(args.provider)
  const payload: Record<string, unknown> = {
    title: args.title,
    description: args.description || undefined,
    busy: true,
    when: {
      start_time: Math.floor(args.startAt.getTime() / 1000),
      start_timezone: timezone,
      ...(args.endAt
        ? {
            end_time: Math.floor(args.endAt.getTime() / 1000),
            end_timezone: timezone,
          }
        : {}),
    },
  }

  if (args.meetingUrl) {
    payload.location = args.meetingUrl
    if (conferencingProvider) {
      payload.conferencing = {
        provider: conferencingProvider,
        details: {
          url: args.meetingUrl,
        },
      }
    }
  } else if (conferencingProvider) {
    payload.conferencing = {
      provider: conferencingProvider,
      autocreate: {},
    }
  }

  console.info('NYLAS_EVENT_CREATE_REQUEST', {
    grantId: args.grantId,
    calendarId: args.calendarId,
    title: args.title,
    provider: args.provider || null,
    conferencingProvider: conferencingProvider || null,
    autocreateConferencing: Boolean(!args.meetingUrl && conferencingProvider),
    hasManualMeetingUrl: Boolean(args.meetingUrl),
  })

  return nylasFetch<{ data?: Record<string, unknown> }>(
    `/v3/grants/${args.grantId}/events?calendar_id=${encodeURIComponent(args.calendarId)}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  )
}

export async function scheduleNylasNotetaker(args: {
  grantId: string
  meetingLink: string
  joinTime: Date
  title: string
}) {
  const joinAt = Math.max(args.joinTime.getTime(), Date.now() + 30 * 1000)

  console.info('NYLAS_NOTETAKER_SCHEDULE_REQUEST', {
    grantId: args.grantId,
    title: args.title,
    meetingLink: args.meetingLink,
    requestedJoinTimeIso: args.joinTime.toISOString(),
    effectiveJoinTimeIso: new Date(joinAt).toISOString(),
  })

  return nylasFetch<{ data?: { id?: string; state?: string } }>(`/v3/grants/${args.grantId}/notetakers`, {
    method: 'POST',
    body: JSON.stringify({
      meeting_link: args.meetingLink,
      join_time: Math.floor(joinAt / 1000),
      name: `${args.title} Notetaker`,
    }),
  })
}
