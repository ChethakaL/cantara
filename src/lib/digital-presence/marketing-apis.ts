import type { DigitalAssetFormData, TavilySearchResult } from './types'

export type MarketingApiEvidence = {
  source: string
  status: 'connected' | 'skipped' | 'error'
  content: string
  url?: string
}

export function isPageSpeedDocumentFetchFailure(message: string) {
  return /FAILED_DOCUMENT_REQUEST|ERR_TIMED_OUT|unable to reliably load the page/i.test(message)
}

export function normalizedLocation(address?: string) {
  const parts = String(address ?? '').split(',').map(part => part.trim()).filter(Boolean)
  const beginsWithStreetNumber = /^\d/.test(parts[0] ?? '')
  const locationParts = beginsWithStreetNumber && parts.length > 1 ? parts.slice(1) : parts
  if (locationParts.length < 2) return locationParts.join(',').slice(0, 120)

  const canadianProvinces: Record<string, string> = {
    AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba', NB: 'New Brunswick',
    NL: 'Newfoundland and Labrador', NS: 'Nova Scotia', NT: 'Northwest Territories',
    NU: 'Nunavut', ON: 'Ontario', PE: 'Prince Edward Island', QC: 'Quebec', SK: 'Saskatchewan', YT: 'Yukon',
  }
  const usStates: Record<string, string> = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
    DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
    KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
    MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
    NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
    OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
    TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
    DC: 'District of Columbia',
  }

  const countryText = locationParts.at(-1) ?? ''
  const hasExplicitCountry = /\b(?:canada|united states|usa)\b/i.test(countryText)
  const remainder = locationParts.slice(1, hasExplicitCountry ? -1 : undefined).join(' ')
  const postalStripped = remainder
    .replace(/\b[A-Z]\d[A-Z][ -]?\d[A-Z]\d\b/gi, '')
    .replace(/\b\d{5}(?:-\d{4})?\b/g, '')
    .trim()
  const regionToken = postalStripped.match(/\b[A-Z]{2}\b/i)?.[0]?.toUpperCase()
  const province = regionToken ? canadianProvinces[regionToken] : undefined
  const state = regionToken ? usStates[regionToken] : undefined
  if (province && (/canada/i.test(countryText) || /\b[A-Z]\d[A-Z][ -]?\d[A-Z]\d\b/i.test(remainder) || !state)) {
    return `${locationParts[0]},${province},Canada`.slice(0, 120)
  }
  if (state && (/united states|\bUSA\b/i.test(countryText) || /\b\d{5}(?:-\d{4})?\b/.test(remainder))) {
    return `${locationParts[0]},${state},United States`.slice(0, 120)
  }

  const country = /\bcanada\b/i.test(countryText) ? 'Canada'
    : /\b(?:united states|usa)\b/i.test(countryText) ? 'United States'
      : countryText
  return [locationParts[0], postalStripped, country].filter(Boolean).join(',').slice(0, 120)
}

function mapKeywords(formData: DigitalAssetFormData) {
  const category = `${formData.businessCategory ?? ''} ${formData.businessName}`.toLowerCase()
  const service = /vet|veterinar|animal hospital/.test(category)
    ? 'veterinarian'
    : /groom/.test(category)
      ? 'pet grooming'
      : /day.?care/.test(category)
        ? 'dog daycare'
        : /train/.test(category)
          ? 'dog training'
          : 'dog boarding'
  return [service]
}

async function fetchDataForSeo(formData: DigitalAssetFormData): Promise<MarketingApiEvidence> {
  const login = process.env.DATA_FOR_SEO_LOGIN?.trim() ?? ''
  const password = process.env.DATA_FOR_SEO_API_KEY?.trim() ?? ''
  const location = normalizedLocation(formData.businessAddress)
  if (!login || !password) {
    return { source: 'DataForSEO Google Maps local results', status: 'skipped', content: 'DataForSEO skipped because credentials are not configured.' }
  }
  if (!location) {
    return { source: 'DataForSEO Google Maps local results', status: 'skipped', content: 'DataForSEO skipped because the business location is missing.' }
  }

  const authorization = Buffer.from(`${login}:${password}`).toString('base64')
  const keywords = mapKeywords(formData)
  const responses = await Promise.all(keywords.map(async keyword => {
    const response = await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/advanced', {
      method: 'POST',
      headers: { Authorization: `Basic ${authorization}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([{ keyword, location_name: location, language_code: 'en', depth: 10 }]),
      signal: AbortSignal.timeout(20000),
    })
    if (!response.ok) {
      const message = await response.text().catch(() => '')
      throw new Error(`DataForSEO returned HTTP ${response.status}${message ? `: ${message.slice(0, 240)}` : ''}`)
    }
    const data = await response.json() as {
      cost?: number
      tasks?: Array<{ status_code?: number; status_message?: string; result?: Array<{ items?: Array<Record<string, unknown>> }> }>
    }
    const task = data.tasks?.[0]
    if (!task || (task.status_code != null && task.status_code >= 40000)) {
      throw new Error(task
        ? `DataForSEO Maps task ${task.status_code}: ${task.status_message ?? 'request was rejected.'}`
        : 'DataForSEO did not return a Maps task.')
    }
    const items = task.result?.flatMap(result => result.items ?? []) ?? []
    const businessNeedle = formData.businessName.toLowerCase()
    const resultLines = items.slice(0, 20).map((item, index) => {
      const title = String(item.title ?? item.name ?? 'Unlabeled business')
      const rank = item.rank_absolute ?? item.rank_group ?? index + 1
      const addressInfo = item.address_info && typeof item.address_info === 'object'
        ? item.address_info as Record<string, unknown>
        : null
      const ratingInfo = item.rating && typeof item.rating === 'object'
        ? item.rating as Record<string, unknown>
        : null
      const address = String(item.address ?? addressInfo?.address ?? '')
      const rating = ratingInfo?.value ?? item.rating ?? item.rating_value
      // Maps SERP uses `rating.votes_count`; the previous parser only looked for
      // `votes`, so rankings showed the reviews column as blank despite data.
      const reviewCount = ratingInfo?.votes_count ?? ratingInfo?.votes ?? item.reviews_count ?? item.review_count
      const domain = item.domain ?? item.url
      const subject = title.toLowerCase().includes(businessNeedle) ? ' [POSSIBLE CLIENT LISTING]' : ''
      return `- Rank ${rank}: ${title}${subject}${address ? `; ${address}` : ''}${rating != null ? `; rating ${rating}` : ''}${reviewCount != null ? `; review count ${reviewCount}` : ''}${domain ? `; ${domain}` : ''}`
    })
    const cost = typeof data.cost === 'number' ? `Reported DataForSEO request cost: $${data.cost.toFixed(4)}.\n` : ''
    return `${cost}Google Maps results for “${keyword}” near ${location}:\n${resultLines.join('\n') || 'No listings returned.'}`
  }))

  return {
    source: 'DataForSEO Google Maps local results',
    status: 'connected',
    content: responses.join('\n\n'),
    url: 'https://www.google.com/maps',
  }
}

export async function fetchDataForSeoOrganic(formData: DigitalAssetFormData): Promise<MarketingApiEvidence> {
  const login = process.env.DATA_FOR_SEO_LOGIN?.trim() ?? ''
  const password = process.env.DATA_FOR_SEO_API_KEY?.trim() ?? ''
  const location = normalizedLocation(formData.businessAddress)
  if (!login || !password) return { source: 'Google organic search visibility', status: 'skipped', content: 'Organic search results were not checked because search credentials are unavailable.' }
  if (!location) return { source: 'Google organic search visibility', status: 'skipped', content: 'Organic search results were not checked because the business location is missing.' }
  const serviceKeyword = mapKeywords(formData)[0]
  const city = location.split(',')[0]
  const keyword = `${serviceKeyword} ${city}`.slice(0, 100)
  const siteDomain = (() => {
    try { return new URL(formData.websiteUrl?.startsWith('http') ? formData.websiteUrl : `https://${formData.websiteUrl}`).hostname.replace(/^www\./, '').toLowerCase() }
    catch { return '' }
  })()
  const authorization = Buffer.from(`${login}:${password}`).toString('base64')
  const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
    method: 'POST',
    headers: { Authorization: `Basic ${authorization}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ keyword, location_name: location, language_code: 'en', depth: 10 }]),
    signal: AbortSignal.timeout(20000),
  })
  const data = await response.json().catch(() => ({})) as {
    tasks?: Array<{ status_code?: number; status_message?: string; result?: Array<{ items?: Array<Record<string, unknown>> }> }>
  }
  if (!response.ok) throw new Error(`DataForSEO organic results returned HTTP ${response.status}`)
  const task = data.tasks?.[0]
  if (!task || (task.status_code != null && task.status_code >= 40000)) {
    throw new Error(task ? `DataForSEO organic task ${task.status_code}: ${task.status_message ?? 'request rejected.'}` : 'DataForSEO returned no organic search task.')
  }
  const items = task.result?.flatMap(result => result.items ?? []) ?? []
  const lines = items.filter(item => ['organic', 'paid'].includes(String(item.type ?? ''))).slice(0, 20).map(item => {
    let urlDomain = ''
    if (typeof item.url === 'string') {
      try { urlDomain = new URL(item.url).hostname.replace(/^www\./, '') } catch { /* keep the domain field if the URL is malformed */ }
    }
    const domain = String(item.domain ?? urlDomain)
    const rank = String(item.rank_absolute ?? item.rank_group ?? '?')
    const kind = item.type === 'paid' ? 'Paid placement' : 'Organic result'
    const isClient = Boolean(siteDomain && domain.replace(/^www\./, '').toLowerCase() === siteDomain)
    return `- ${kind} ${rank}: ${domain || 'Unknown site'}${isClient ? ' [CLIENT WEBSITE]' : ''}; ${String(item.title ?? '')}; ${String(item.url ?? '')}`
  })
  return {
    source: 'Google organic search visibility',
    status: 'connected',
    url: `https://www.google.com/search?q=${encodeURIComponent(keyword)}`,
    content: [`Search phrase: ${keyword}`, `Search location: ${location}`, `Client website: ${siteDomain || 'No website domain supplied'}`, ...lines, ...(lines.length ? [] : ['No organic or paid website listings appeared in the returned results.']), 'This is a point-in-time search result, not proof of client advertising spend or traffic.'].join('\n'),
  }
}

async function fetchPageSpeed(websiteUrl?: string): Promise<MarketingApiEvidence> {
  const apiKey = process.env.GOOGLE_PAGE_SPEED_API_KEY?.trim() ?? ''
  if (!websiteUrl) return { source: 'Google PageSpeed Insights', status: 'skipped', content: 'PageSpeed skipped because no website URL was provided.' }
  if (!apiKey) return { source: 'Google PageSpeed Insights', status: 'skipped', content: 'PageSpeed skipped because its API key is not configured.' }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`)
    if (!['https:', 'http:'].includes(parsedUrl.protocol)) throw new Error('unsupported protocol')
  } catch {
    return { source: 'Google PageSpeed Insights', status: 'skipped', content: 'PageSpeed skipped because the website URL is invalid.' }
  }

  const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed')
  endpoint.searchParams.set('url', parsedUrl.toString())
  endpoint.searchParams.set('key', apiKey)
  endpoint.searchParams.set('strategy', 'mobile')
  for (const category of ['performance', 'accessibility', 'best-practices', 'seo']) endpoint.searchParams.append('category', category)
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(30000) })
  const data = await response.json().catch(() => ({})) as {
    error?: { message?: string }
    lighthouseResult?: {
      categories?: Record<string, { score?: number; title?: string }>
      audits?: Record<string, { title?: string; scoreDisplayMode?: string; displayValue?: string; details?: { overallSavingsMs?: number } }>
      finalDisplayedUrl?: string
      fetchTime?: string
    }
  }
  if (!response.ok) {
    const providerMessage = data.error?.message ?? ''
    if (isPageSpeedDocumentFetchFailure(providerMessage)) {
      return {
        source: 'Google PageSpeed Insights',
        status: 'error',
        content: `PageSpeed's Lighthouse crawler could not fetch ${parsedUrl.toString()} (HTTP ${response.status}): ${providerMessage.slice(0, 320)}. This is a target-site crawl failure, not an API-key rejection. CrUX field data may still be available separately.`,
        url: parsedUrl.toString(),
      }
    }
    throw new Error(`PageSpeed Insights returned HTTP ${response.status}${providerMessage ? `: ${providerMessage.slice(0, 320)}` : ''}`)
  }
  const lighthouse = data.lighthouseResult
  const categories = lighthouse?.categories ?? {}
  const scores = Object.entries(categories).map(([key, value]) => `${value.title ?? key}: ${Math.round(Number(value.score ?? 0) * 100)}/100`)
  const opportunities = Object.values(lighthouse?.audits ?? {})
    .filter(audit => audit.scoreDisplayMode === 'numeric' && Number(audit.details?.overallSavingsMs ?? 0) > 0)
    .sort((a, b) => Number(b.details?.overallSavingsMs ?? 0) - Number(a.details?.overallSavingsMs ?? 0))
    .slice(0, 5)
    .map(audit => `- ${audit.title ?? 'Improvement'}${audit.displayValue ? `: ${audit.displayValue}` : ''}`)
  return {
    source: 'Google PageSpeed Insights',
    status: 'connected',
    content: [
      `Tested URL: ${lighthouse?.finalDisplayedUrl ?? parsedUrl.toString()}`,
      `Test time: ${lighthouse?.fetchTime ?? 'unknown'}`,
      `Mobile Lighthouse scores: ${scores.join('; ') || 'No category scores returned.'}`,
      `Largest opportunities:\n${opportunities.join('\n') || 'No significant opportunities returned.'}`,
      'These are point-in-time lab measurements and do not measure bookings or revenue.',
    ].join('\n'),
    url: lighthouse?.finalDisplayedUrl ?? parsedUrl.toString(),
  }
}

async function fetchCrux(websiteUrl?: string): Promise<MarketingApiEvidence> {
  const apiKey = process.env.CRUX_API_KEY?.trim() ?? ''
  if (!websiteUrl) return { source: 'Chrome UX Report (CrUX)', status: 'skipped', content: 'CrUX skipped because no website URL was provided.' }
  if (!apiKey) return { source: 'Chrome UX Report (CrUX)', status: 'skipped', content: 'CrUX skipped because CRUX_API_KEY is not configured.' }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`)
  } catch {
    return { source: 'Chrome UX Report (CrUX)', status: 'skipped', content: 'CrUX skipped because the website URL is invalid.' }
  }

  const endpoint = new URL('https://chromeuxreport.googleapis.com/v1/records:queryRecord')
  endpoint.searchParams.set('key', apiKey)
  const response = await fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: parsedUrl.toString() }),
    signal: AbortSignal.timeout(15000),
  })
  if (response.status === 404) {
    return { source: 'Chrome UX Report (CrUX)', status: 'skipped', content: 'CrUX has no field record for this URL; the page may not have enough eligible Chrome user traffic.' }
  }
  if (!response.ok) {
    return { source: 'Chrome UX Report (CrUX)', status: 'error', content: `CrUX returned HTTP ${response.status}; check Chrome UX Report API enablement and key restrictions.` }
  }
  const data = await response.json() as {
    record?: {
      key?: { url?: string; origin?: string }
      collectionPeriod?: { firstDate?: { year?: number; month?: number; day?: number }; lastDate?: { year?: number; month?: number; day?: number } }
      metrics?: Record<string, { percentiles?: { p75?: number | string } }>
    }
  }
  const metrics = data.record?.metrics ?? {}
  const labels: Array<[string, string]> = [
    ['largest_contentful_paint', 'LCP'],
    ['interaction_to_next_paint', 'INP'],
    ['cumulative_layout_shift', 'CLS'],
    ['experimental_time_to_first_byte', 'TTFB'],
  ]
  const suffix: Record<string, string> = { largest_contentful_paint: ' ms', interaction_to_next_paint: ' ms', cumulative_layout_shift: '', experimental_time_to_first_byte: ' ms' }
  const values = labels.flatMap(([key, label]) => {
    const value = metrics[key]?.percentiles?.p75
    return value == null ? [] : [`${label} p75: ${value}${suffix[key]}`]
  })
  if (!values.length) {
    return { source: 'Chrome UX Report (CrUX)', status: 'skipped', content: 'CrUX returned a record without the requested Core Web Vitals metrics.' }
  }
  const toDate = (date?: { year?: number; month?: number; day?: number }) => date
    ? `${date.year}-${String(date.month ?? 0).padStart(2, '0')}-${String(date.day ?? 0).padStart(2, '0')}`
    : ''
  const period = data.record?.collectionPeriod
  return {
    source: 'Chrome UX Report (CrUX)', status: 'connected', url: data.record?.key?.url ?? parsedUrl.toString(),
    content: [
      `Real-user Chrome field data for ${data.record?.key?.url ?? data.record?.key?.origin ?? parsedUrl.toString()}:`,
      ...values,
      ...(period ? [`Collection period: ${toDate(period.firstDate)} through ${toDate(period.lastDate)}`] : []),
      'These are aggregated real-user browser experience metrics, not conversions or revenue.',
    ].join('\n'),
  }
}

export async function collectMarketingApiEvidence(formData: DigitalAssetFormData): Promise<MarketingApiEvidence[]> {
  const tasks = await Promise.allSettled([
    fetchDataForSeo(formData),
    fetchDataForSeoOrganic(formData),
    fetchPageSpeed(formData.websiteUrl),
    fetchCrux(formData.websiteUrl),
  ])
  return tasks.map((task, index) => {
    const source = ['DataForSEO Google Maps local results', 'Google organic search visibility', 'Google PageSpeed Insights', 'Chrome UX Report (CrUX)'][index]
    if (task.status === 'fulfilled') {
      const evidence = task.value
      if (evidence.status === 'error') {
        // These requests are intentionally isolated with Promise.allSettled so one
        // provider outage does not fail the whole report. Log the provider reason
        // here because the outer analysis route only sees the completed report.
        console.error(`[Marketing APIs] ${source} failed: ${evidence.content.slice(0, 600)}`)
      } else if (evidence.status === 'skipped') {
        console.warn(`[Marketing APIs] ${source} skipped: ${evidence.content.slice(0, 400)}`)
      }
      return evidence
    }
    const error = task.reason instanceof Error ? task.reason.message : 'The API request failed.'
    console.error(`[Marketing APIs] ${source} request failed: ${error}`)
    return { source, status: 'error', content: `${source} request failed: ${error}` } satisfies MarketingApiEvidence
  })
}

export function toMarketingResearchResults(evidence: MarketingApiEvidence[]): TavilySearchResult[] {
  return evidence.map(item => ({
    title: `[${item.status.toUpperCase()}] ${item.source}`,
    url: item.url ?? 'https://support.google.com/',
    content: item.content,
    score: item.status === 'connected' ? 1 : 0.2,
  }))
}
