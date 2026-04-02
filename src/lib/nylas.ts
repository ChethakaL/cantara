import crypto from 'node:crypto'
import { prisma } from '@/lib/prisma'

const DEFAULT_NYLAS_API_URI = 'https://api.us.nylas.com'

function apiBase() {
  return (process.env.NYLAS_API_URI || DEFAULT_NYLAS_API_URI).replace(/\/$/, '')
}

export function isNylasConfigured() {
  return Boolean(process.env.NYLAS_API_KEY && process.env.NYLAS_CLIENT_ID && process.env.NYLAS_CALLBACK_URI)
}

export function nylasFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = process.env.NYLAS_API_KEY
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
      const message =
        typeof data === 'object' && data && 'message' in data && typeof (data as { message?: unknown }).message === 'string'
          ? (data as { message: string }).message
          : `Nylas request failed (${response.status}).`
      throw new Error(message)
    }

    return data as T
  })
}

export function buildNylasAuthUrl(options?: { provider?: string; state?: string }) {
  const clientId = process.env.NYLAS_CLIENT_ID
  const callbackUri = process.env.NYLAS_CALLBACK_URI

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
  const clientId = process.env.NYLAS_CLIENT_ID
  const callbackUri = process.env.NYLAS_CALLBACK_URI
  const apiKey = process.env.NYLAS_API_KEY

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
  const secret = process.env.NYLAS_WEBHOOK_SECRET
  if (!secret) return true
  if (!signatureHeader) return false

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader))
}

export function extractMeetingJoinUrl(event: Record<string, unknown> | null | undefined): string | null {
  if (!event || typeof event !== 'object') return null

  const conferencing = Array.isArray((event as { conferencing?: unknown[] }).conferencing)
    ? ((event as { conferencing?: Array<Record<string, unknown>> }).conferencing as Array<Record<string, unknown>>)
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

  return null
}
