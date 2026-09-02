import type { AgentAiProvider } from "@/lib/agent-model-provider";
import { agentWebSearch } from "@/lib/agent-web-search";
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
  onProgress?: ProgressCallback,
  options?: { provider?: AgentAiProvider; modelId?: string },
): Promise<ChannelResearchData[]> {
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
    const searchResults: TavilySearchResult[] = await agentWebSearch({
      queries: task.queries,
      businessName,
      channelLabel: task.label,
      provider: options?.provider,
      modelId: options?.modelId,
    })
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

// Legacy export kept for any direct imports — delegates to shared agent web search.
export async function claudeWebSearch(
  queries: string[],
  businessName: string,
  channelLabel: string,
  options?: { provider?: AgentAiProvider; modelId?: string },
): Promise<TavilySearchResult[]> {
  return agentWebSearch({
    queries,
    businessName,
    channelLabel,
    provider: options?.provider,
    modelId: options?.modelId,
  });
}
