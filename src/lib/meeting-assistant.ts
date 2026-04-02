import { prisma } from '@/lib/prisma'
import { normalizeTranscriptText, nylasFetch } from '@/lib/nylas'

function pickUrl(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.download_url === 'string') return record.download_url
    if (typeof record.url === 'string') return record.url
    if (typeof record.uri === 'string') return record.uri
    if (typeof record.href === 'string') return record.href
  }
  return null
}

async function fetchTextFromUrl(url: string) {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Could not fetch meeting media (${response.status}).`)
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const json = await response.json()
    return normalizeTranscriptText(json)
  }

  return (await response.text()).trim()
}

export function extractMediaUrls(data: Record<string, unknown>) {
  const objectRecord =
    data.object && typeof data.object === 'object' && !Array.isArray(data.object)
      ? (data.object as Record<string, unknown>)
      : data
  const mediaRecord =
    objectRecord.media && typeof objectRecord.media === 'object' && !Array.isArray(objectRecord.media)
      ? (objectRecord.media as Record<string, unknown>)
      : data.media && typeof data.media === 'object' && !Array.isArray(data.media)
        ? (data.media as Record<string, unknown>)
        : data

  const urls = {
    transcriptUrl: pickUrl(mediaRecord.transcript) || pickUrl(data.transcript_url),
    summaryUrl: pickUrl(mediaRecord.summary) || pickUrl(data.summary_url),
    actionItemsUrl: pickUrl(mediaRecord.action_items) || pickUrl(data.action_items_url),
    recordingUrl: pickUrl(mediaRecord.recording) || pickUrl(mediaRecord.audio) || pickUrl(data.recording_url),
  } as Record<string, string | null>

  const mediaItems = Array.isArray(data.media) ? (data.media as Array<Record<string, unknown>>) : []
  for (const item of mediaItems) {
    const kind = typeof item.type === 'string' ? item.type.toLowerCase() : ''
    const url = pickUrl(item)
    if (!url) continue
    if (kind.includes('transcript') && !urls.transcriptUrl) urls.transcriptUrl = url
    if (kind.includes('summary') && !urls.summaryUrl) urls.summaryUrl = url
    if ((kind.includes('action') || kind.includes('item')) && !urls.actionItemsUrl) urls.actionItemsUrl = url
    if ((kind.includes('recording') || kind.includes('audio') || kind.includes('video')) && !urls.recordingUrl) {
      urls.recordingUrl = url
    }
  }

  return urls
}

function extractActionItems(raw: string) {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String((item as { text?: string }).text || item).trim()).filter(Boolean)
    }
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { action_items?: unknown[] }).action_items)) {
      return (parsed as { action_items: unknown[] }).action_items
        .map((item) => String((item as { text?: string }).text || item).trim())
        .filter(Boolean)
    }
  } catch {}

  return raw
    .split('\n')
    .map((line) => line.replace(/^\s*[-*]\s*/, '').trim())
    .filter(Boolean)
}

async function hydrateMeetingMedia(args: {
  meetingId: string
  notetakerId: string
  rawMedia: Record<string, unknown>
}) {
  const urls = extractMediaUrls(args.rawMedia)
  const [transcript, summary, actionItemsRaw] = await Promise.all([
    urls.transcriptUrl ? fetchTextFromUrl(urls.transcriptUrl).catch(() => '') : Promise.resolve(''),
    urls.summaryUrl ? fetchTextFromUrl(urls.summaryUrl).catch(() => '') : Promise.resolve(''),
    urls.actionItemsUrl ? fetchTextFromUrl(urls.actionItemsUrl).catch(() => '') : Promise.resolve(''),
  ])

  const actionItems = actionItemsRaw ? extractActionItems(actionItemsRaw) : []
  const notesSections = [
    transcript ? transcript.trim() : '',
    summary ? `Summary\n${summary.trim()}` : '',
    actionItems.length ? `Action Items\n${actionItems.map((item) => `- ${item}`).join('\n')}` : '',
  ].filter(Boolean)

  return await (prisma as any).meeting.update({
    where: { id: args.meetingId },
    data: {
      notesText: notesSections.join('\n\n') || null,
      notesFileName: notesSections.length ? 'Meeting assistant transcript' : null,
      notesUploadedAt: notesSections.length ? new Date() : undefined,
      nylasNotetakerState: 'MEDIA_READY',
      nylasNotetakerLastWebhookAt: new Date(),
    },
    include: {
      reports: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })
}

export async function syncMeetingAssistantFromMedia(args: {
  meetingId: string
  notetakerId: string
  media: Record<string, unknown>
}) {
  console.info('MEETING_ASSISTANT_MEDIA_SYNC', {
    meetingId: args.meetingId,
    notetakerId: args.notetakerId,
  })

  return hydrateMeetingMedia({
    meetingId: args.meetingId,
    notetakerId: args.notetakerId,
    rawMedia: args.media,
  })
}

export async function refreshMeetingAssistant(args: {
  meetingId: string
  grantId: string
  notetakerId: string
}) {
  try {
    const mediaResponse = await nylasFetch<{ data?: Record<string, unknown> }>(
      `/v3/grants/${args.grantId}/notetakers/${args.notetakerId}/media`,
      { method: 'GET' }
    )

    const item = await hydrateMeetingMedia({
      meetingId: args.meetingId,
      notetakerId: args.notetakerId,
      rawMedia: mediaResponse.data || {},
    })

    return {
      processing: false,
      item,
      message: item.notesText?.trim()
        ? 'Meeting notes have been synced.'
        : 'Meeting media is available, but no transcript text was returned.',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load assistant media.'
    const normalized = message.toLowerCase()
    const mediaPending =
      normalized.includes('media is not yet available') ||
      (normalized.includes('404') && normalized.includes('media'))

    if (!mediaPending) throw error

    const statusResponse = await nylasFetch<{ data?: { state?: string } }>(
      `/v3/grants/${args.grantId}/notetakers/${args.notetakerId}`,
      { method: 'GET' }
    ).catch(() => null)

    const nextState = statusResponse?.data?.state || 'PROCESSING'
    const item = await (prisma as any).meeting.update({
      where: { id: args.meetingId },
      data: {
        nylasNotetakerState: String(nextState).toUpperCase(),
        nylasNotetakerLastWebhookAt: new Date(),
      },
      include: {
        reports: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    return {
      processing: true,
      item,
      message: 'The meeting assistant is still processing notes.',
    }
  }
}
