import {
  ChannelType,
  ChannelResearchData,
  DigitalAssetFormData,
  TavilySearchResult,
} from './types';

const TAVILY_API_URL = 'https://api.tavily.com/search';
const MAX_RESULTS_PER_QUERY = 5;
const FETCH_TIMEOUT_MS = 20000;

function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

async function tavilySearch(
  query: string,
  apiKey: string,
  searchDepth: 'basic' | 'advanced' = 'basic'
): Promise<TavilySearchResult[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(TAVILY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: searchDepth,
        max_results: MAX_RESULTS_PER_QUERY,
        include_answer: false,
        include_raw_content: false,
      }),
    });

    if (!res.ok) {
      console.error(`[Research] Search failed for "${query}": ${res.status}`);
      return [];
    }

    const data = await res.json();
    return (data.results ?? []).map((r: any) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      content: r.content ?? '',
      score: r.score ?? 0,
    }));
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.warn(`[Research] Search timed out for "${query}"`);
    } else {
      console.error(`[Research] Error for "${query}":`, err?.message ?? err);
    }
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function normaliseHandle(handle: string, platform: string): string {
  handle = handle.trim().replace(/^@/, '');
  if (handle.startsWith('http')) return handle;
  const platformDomains: Record<string, string> = {
    facebook: 'facebook.com/',
    instagram: 'instagram.com/',
    tiktok: 'tiktok.com/@',
    youtube: 'youtube.com/@',
  };
  const domain = platformDomains[platform];
  return domain ? `https://${domain}${handle}` : handle;
}

function deduplicateResults(results: TavilySearchResult[]): TavilySearchResult[] {
  const seen = new Set<string>();
  return results.filter(r => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

export type ProgressCallback = (
  channelType: ChannelType,
  channelLabel: string,
  completed: number,
  total: number
) => void;

export async function researchAllChannels(
  formData: DigitalAssetFormData,
  apiKey: string,
  onProgress?: ProgressCallback
): Promise<ChannelResearchData[]> {
  const { businessName } = formData;
  const ctx = '';

  type ChannelTask = {
    channelType: ChannelType;
    label: string;
    run: () => Promise<ChannelResearchData>;
  };

  const tasks: ChannelTask[] = [];

  // ── Website ────────────────────────────────────────────────────────────────
  if (formData.websiteUrl) {
    const host = stripProtocol(formData.websiteUrl);
    tasks.push({
      channelType: 'website',
      label: 'Website',
      run: async () => {
        const queries = [
          `site:${host}`,
          `"${businessName}"${ctx} website reviews SEO mobile booking`,
        ];
        const all: TavilySearchResult[] = [];
        for (const q of queries) all.push(...await tavilySearch(q, apiKey, 'advanced'));
        return { channelType: 'website', inputUrl: formData.websiteUrl, searchQueries: queries, results: deduplicateResults(all) };
      },
    });
  }

  // ── Google Business Profile ────────────────────────────────────────────────
  if (formData.googleBusinessProfileUrl) {
    tasks.push({
      channelType: 'google_business',
      label: 'Google Business Profile',
      run: async () => {
        const queries = [
          `"${businessName}" Google reviews rating number of reviews${ctx}`,
          `"${businessName}" Google reviews recent negative response${ctx}`,
          `"${businessName}" Google Business Profile photos completeness`,
        ];
        // Multi-location: search each additional location
        if (formData.googleBusinessLocations) {
          const locations = formData.googleBusinessLocations.split(',').map(l => l.trim()).filter(Boolean);
          for (const loc of locations) {
            queries.push(`"${loc}" Google reviews rating number of reviews`);
          }
        }
        const all: TavilySearchResult[] = [];
        for (const q of queries) all.push(...await tavilySearch(q, apiKey, 'advanced'));
        return { channelType: 'google_business', inputUrl: formData.googleBusinessProfileUrl, searchQueries: queries, results: deduplicateResults(all) };
      },
    });
  }

  // ── Facebook ───────────────────────────────────────────────────────────────
  if (formData.facebookHandle) {
    const url = normaliseHandle(formData.facebookHandle, 'facebook');
    const handle = formData.facebookHandle.replace(/^@/, '');
    tasks.push({
      channelType: 'facebook',
      label: 'Facebook',
      run: async () => {
        const queries = [
          `"${businessName}" Facebook followers posts engagement${ctx}`,
          `site:facebook.com "${handle}"`,
        ];
        const all: TavilySearchResult[] = [];
        for (const q of queries) all.push(...await tavilySearch(q, apiKey));
        return { channelType: 'facebook', inputUrl: url, searchQueries: queries, results: deduplicateResults(all) };
      },
    });
  }

  // ── Instagram ──────────────────────────────────────────────────────────────
  if (formData.instagramHandle) {
    const url = normaliseHandle(formData.instagramHandle, 'instagram');
    const handle = formData.instagramHandle.replace(/^@/, '');
    tasks.push({
      channelType: 'instagram',
      label: 'Instagram',
      run: async () => {
        const queries = [
          `"${businessName}" Instagram followers posts engagement${ctx}`,
          `site:instagram.com "${handle}"`,
        ];
        const all: TavilySearchResult[] = [];
        for (const q of queries) all.push(...await tavilySearch(q, apiKey));
        return { channelType: 'instagram', inputUrl: url, searchQueries: queries, results: deduplicateResults(all) };
      },
    });
  }

  // ── TikTok ─────────────────────────────────────────────────────────────────
  if (formData.tiktokHandle) {
    const url = normaliseHandle(formData.tiktokHandle, 'tiktok');
    const handle = formData.tiktokHandle.replace(/^@/, '');
    tasks.push({
      channelType: 'tiktok',
      label: 'TikTok',
      run: async () => {
        const queries = [
          `"${businessName}" TikTok followers videos engagement${ctx}`,
          `site:tiktok.com "@${handle}"`,
        ];
        const all: TavilySearchResult[] = [];
        for (const q of queries) all.push(...await tavilySearch(q, apiKey));
        return { channelType: 'tiktok', inputUrl: url, searchQueries: queries, results: deduplicateResults(all) };
      },
    });
  }

  // ── Booking Platform ───────────────────────────────────────────────────────
  if (formData.bookingPlatformUrl) {
    const host = stripProtocol(formData.bookingPlatformUrl);
    tasks.push({
      channelType: 'booking_platform',
      label: 'Booking Platform',
      run: async () => {
        const queries = [
          `"${businessName}" book appointment online${ctx}`,
          `site:${host} availability bookings`,
        ];
        const all: TavilySearchResult[] = [];
        for (const q of queries) all.push(...await tavilySearch(q, apiKey));
        return { channelType: 'booking_platform', inputUrl: formData.bookingPlatformUrl, searchQueries: queries, results: deduplicateResults(all) };
      },
    });
  }

  // ── Online Reputation (Yelp, NextDoor) ─────────────────────────────────────
  if (formData.yelpUrl || formData.nextdoorUrl) {
    tasks.push({
      channelType: 'online_reputation',
      label: 'Online Reputation',
      run: async () => {
        const queries: string[] = [
          `"${businessName}" Yelp reviews rating${ctx}`,
          `"${businessName}" online reviews reputation${ctx}`,
        ];
        if (formData.yelpUrl) {
          const yelpHost = stripProtocol(formData.yelpUrl);
          queries.push(`site:${yelpHost}`);
        }
        if (formData.nextdoorUrl) {
          const nextdoorHost = stripProtocol(formData.nextdoorUrl);
          queries.push(`site:${nextdoorHost}`);
          queries.push(`"${businessName}" NextDoor recommendations${ctx}`);
        }
        const all: TavilySearchResult[] = [];
        for (const q of queries) all.push(...await tavilySearch(q, apiKey));
        return { channelType: 'online_reputation', inputUrl: formData.yelpUrl, searchQueries: queries, results: deduplicateResults(all) };
      },
    });
  } else {
    // Always search for reputation even if no URLs provided
    tasks.push({
      channelType: 'online_reputation',
      label: 'Online Reputation',
      run: async () => {
        const queries: string[] = [
          `"${businessName}" Yelp reviews rating${ctx}`,
          `"${businessName}" online reviews reputation${ctx}`,
        ];
        const all: TavilySearchResult[] = [];
        for (const q of queries) all.push(...await tavilySearch(q, apiKey));
        return { channelType: 'online_reputation', inputUrl: undefined, searchQueries: queries, results: deduplicateResults(all) };
      },
    });
  }

  // ── Business Reputation (LinkedIn, Glassdoor, BBB) ────────────────────────
  if (formData.linkedinUrl || formData.glassdoorUrl || formData.bbbUrl) {
    tasks.push({
      channelType: 'online_reputation' as ChannelType,
      label: 'Business Reputation',
      run: async () => {
        const queries: string[] = [];
        if (formData.linkedinUrl) {
          const linkedinHost = stripProtocol(formData.linkedinUrl);
          queries.push(`site:${linkedinHost}`);
          queries.push(`"${businessName}" LinkedIn company employees${ctx}`);
        }
        if (formData.glassdoorUrl) {
          const glassdoorHost = stripProtocol(formData.glassdoorUrl);
          queries.push(`site:${glassdoorHost}`);
        } else {
          queries.push(`"${businessName}" Glassdoor reviews employer rating${ctx}`);
        }
        if (formData.bbbUrl) {
          const bbbHost = stripProtocol(formData.bbbUrl);
          queries.push(`site:${bbbHost}`);
        } else {
          queries.push(`"${businessName}" BBB Better Business Bureau rating accreditation${ctx}`);
        }
        const all: TavilySearchResult[] = [];
        for (const q of queries) all.push(...await tavilySearch(q, apiKey));
        return { channelType: 'online_reputation' as ChannelType, inputUrl: formData.linkedinUrl ?? formData.glassdoorUrl ?? formData.bbbUrl, searchQueries: queries, results: deduplicateResults(all) };
      },
    });
  }

  // Run tasks sequentially so we can emit accurate per-channel progress
  const results: ChannelResearchData[] = [];
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const data = await task.run();
    results.push(data);
    onProgress?.(task.channelType, task.label, i + 1, tasks.length);
  }

  return results;
}
