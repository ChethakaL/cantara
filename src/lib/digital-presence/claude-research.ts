import Anthropic from '@anthropic-ai/sdk'
import {
  ChannelType,
  ChannelResearchData,
  DigitalAssetFormData,
  TavilySearchResult,
} from './types'

export type ProgressCallback = (
  channelType: ChannelType,
  channelLabel: string,
  completed: number,
  total: number
) => void

async function claudeWebSearch(
  queries: string[],
  businessName: string,
  channelLabel: string,
  apiKey: string,
): Promise<TavilySearchResult[]> {
  const client = new Anthropic({ apiKey })

  const prompt = `Search for the following information about "${businessName}" for a ${channelLabel} digital presence audit. For each search result, extract the key metrics (ratings, review counts, follower counts, engagement data, etc.) accurately.

Search queries to execute:
${queries.map((q, i) => `${i + 1}. ${q}`).join('\n')}

After searching, return a JSON array of findings:
[
  {
    "title": "Result title",
    "url": "Source URL",
    "content": "Key information found including exact metrics, ratings, review counts, follower counts etc.",
    "score": 0.9
  }
]

IMPORTANT: Report exact numbers as found on the source websites. Do not estimate or round. If a Google Business Profile shows 4.3 stars with 287 reviews, report exactly "4.3 stars" and "287 reviews". Return ONLY the JSON array.`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0,
      tools: [{ type: 'web_search_20250305' as any, name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }],
    })

    // Extract text from response (after web search tool calls)
    const textBlocks = response.content.filter((b) => b.type === 'text')
    const rawText = textBlocks.map((b) => ('text' in b ? b.text : '')).join('').trim()
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()

    try {
      const results = JSON.parse(cleaned)
      if (Array.isArray(results)) {
        return results.map((r: any) => ({
          title: r.title ?? '',
          url: r.url ?? '',
          content: r.content ?? '',
          score: r.score ?? 0.8,
        }))
      }
    } catch {
      // If JSON parsing fails, create a single result from the raw text
      return [{
        title: `${channelLabel} Research`,
        url: '',
        content: rawText.slice(0, 2000),
        score: 0.7,
      }]
    }
  } catch (err: any) {
    console.error(`[Claude Research] Error for ${channelLabel}:`, err?.message)
  }

  return []
}

function normaliseHandle(handle: string, platform: string): string {
  handle = handle.trim().replace(/^@/, '')
  if (handle.startsWith('http')) return handle
  const platformDomains: Record<string, string> = {
    facebook: 'facebook.com/',
    instagram: 'instagram.com/',
    tiktok: 'tiktok.com/@',
  }
  const domain = platformDomains[platform]
  return domain ? `https://${domain}${handle}` : handle
}

function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

export async function researchAllChannels(
  formData: DigitalAssetFormData,
  _tavilyKey: string, // kept for interface compat but unused
  onProgress?: ProgressCallback
): Promise<ChannelResearchData[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY required for Claude web search')

  const { businessName } = formData

  type ChannelTask = {
    channelType: ChannelType
    label: string
    queries: string[]
    inputUrl?: string
  }

  const tasks: ChannelTask[] = []

  // Website
  if (formData.websiteUrl) {
    const host = stripProtocol(formData.websiteUrl)
    tasks.push({
      channelType: 'website',
      label: 'Website',
      queries: [
        `${businessName} website ${host} mobile booking online presence`,
        `site:${host}`,
      ],
      inputUrl: formData.websiteUrl,
    })
  }

  // Google Business Profile
  if (formData.googleBusinessProfileUrl) {
    const queries = [
      `"${businessName}" Google Business Profile reviews star rating number of reviews`,
      `"${businessName}" Google reviews recent`,
    ]
    if (formData.googleBusinessLocations) {
      const locations = formData.googleBusinessLocations.split(',').map(l => l.trim()).filter(Boolean)
      for (const loc of locations) {
        queries.push(`"${loc}" Google reviews star rating number of reviews`)
      }
    }
    tasks.push({
      channelType: 'google_business',
      label: 'Google Business Profile',
      queries,
      inputUrl: formData.googleBusinessProfileUrl,
    })
  }

  // Facebook
  if (formData.facebookHandle) {
    const url = normaliseHandle(formData.facebookHandle, 'facebook')
    tasks.push({
      channelType: 'facebook',
      label: 'Facebook',
      queries: [
        `"${businessName}" Facebook page followers likes posts engagement`,
        `site:facebook.com "${formData.facebookHandle.replace(/^@/, '')}"`,
      ],
      inputUrl: url,
    })
  }

  // Instagram
  if (formData.instagramHandle) {
    const url = normaliseHandle(formData.instagramHandle, 'instagram')
    tasks.push({
      channelType: 'instagram',
      label: 'Instagram',
      queries: [
        `"${businessName}" Instagram followers posts engagement`,
        `site:instagram.com "${formData.instagramHandle.replace(/^@/, '')}"`,
      ],
      inputUrl: url,
    })
  }

  // TikTok
  if (formData.tiktokHandle) {
    const url = normaliseHandle(formData.tiktokHandle, 'tiktok')
    tasks.push({
      channelType: 'tiktok',
      label: 'TikTok',
      queries: [
        `"${businessName}" TikTok followers videos`,
        `site:tiktok.com "@${formData.tiktokHandle.replace(/^@/, '')}"`,
      ],
      inputUrl: url,
    })
  }

  // Booking Platform
  if (formData.bookingPlatformUrl) {
    tasks.push({
      channelType: 'booking_platform',
      label: 'Booking Platform',
      queries: [
        `"${businessName}" online booking appointment scheduling`,
        `site:${stripProtocol(formData.bookingPlatformUrl)}`,
      ],
      inputUrl: formData.bookingPlatformUrl,
    })
  }

  // Online Reputation (Yelp, NextDoor)
  {
    const queries: string[] = [
      `"${businessName}" Yelp reviews star rating number of reviews`,
      `"${businessName}" online reviews reputation`,
    ]
    if (formData.yelpUrl) queries.push(`site:${stripProtocol(formData.yelpUrl)}`)
    if (formData.nextdoorUrl) {
      queries.push(`"${businessName}" NextDoor recommendations`)
    }
    tasks.push({
      channelType: 'online_reputation',
      label: 'Online Reputation',
      queries,
      inputUrl: formData.yelpUrl,
    })
  }

  // Business Reputation (LinkedIn, Glassdoor, BBB)
  if (formData.linkedinUrl || formData.glassdoorUrl || formData.bbbUrl) {
    const queries: string[] = []
    if (formData.linkedinUrl) queries.push(`"${businessName}" LinkedIn company page employees`)
    if (formData.glassdoorUrl) queries.push(`"${businessName}" Glassdoor employer reviews rating`)
    else queries.push(`"${businessName}" Glassdoor reviews employer rating`)
    if (formData.bbbUrl) queries.push(`"${businessName}" BBB Better Business Bureau rating`)
    else queries.push(`"${businessName}" BBB accreditation rating`)

    tasks.push({
      channelType: 'online_reputation' as ChannelType,
      label: 'Business Reputation',
      queries,
      inputUrl: formData.linkedinUrl ?? formData.glassdoorUrl ?? formData.bbbUrl,
    })
  }

  // Run tasks sequentially
  const results: ChannelResearchData[] = []
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    const searchResults = await claudeWebSearch(task.queries, businessName, task.label, apiKey)
    results.push({
      channelType: task.channelType,
      inputUrl: task.inputUrl,
      searchQueries: task.queries,
      results: searchResults,
    })
    onProgress?.(task.channelType, task.label, i + 1, tasks.length)
  }

  return results
}
