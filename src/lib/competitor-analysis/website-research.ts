import { ConfidenceLevel, WebsiteResearchData, WebsiteSnippet } from './types';

const TAVILY_API_URL = 'https://api.tavily.com/search';
const FETCH_TIMEOUT_MS = 20000;
const MAX_FETCHED_PAGES = 1;
const MAX_SEARCH_RESULTS = 3;

interface TavilyResponse {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    raw_content?: string;
  }>;
}

function normalizeWebsiteUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] ?? '';
  }
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function stripHtml(html: string): string {
  return collapseWhitespace(
    decodeEntities(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<\/(p|div|section|article|li|h1|h2|h3|h4|h5|h6)>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
    )
  );
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return collapseWhitespace(decodeEntities(match?.[1] ?? 'Website page'));
}

async function fetchText(url: string): Promise<{ url: string; title: string; text: string; html: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CantaraCompetitorAnalysis/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!res.ok) return null;
    const html = await res.text();
    const text = stripHtml(html).slice(0, 5000);
    if (!text) return null;
    return {
      url,
      title: extractTitle(html),
      text,
      html,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function tavilySearch(query: string, apiKey: string): Promise<WebsiteSnippet[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(TAVILY_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        max_results: 2,
        include_answer: false,
        include_raw_content: false,
      }),
    });

    if (!res.ok) return [];
    const data = await res.json() as TavilyResponse;
    return (data.results ?? []).map((result) => ({
      url: result.url ?? '',
      title: result.title ?? 'Search result',
      snippet: collapseWhitespace((result.content || result.raw_content || '').slice(0, 420)),
      source: 'search' as const,
    })).filter((item) => item.url && item.snippet);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function dedupeSnippets(snippets: WebsiteSnippet[]): WebsiteSnippet[] {
  const seen = new Set<string>();
  return snippets.filter((item) => {
    const key = item.url;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function confidenceFromCounts(siteCount: number, searchCount: number): ConfidenceLevel {
  const total = siteCount + searchCount;
  if (siteCount >= 2 || total >= 4) return 'high';
  if (total >= 2) return 'medium';
  return 'low';
}

export async function researchWebsite(args: {
  websiteUrl?: string | null;
  businessName: string;
  businessCategory: string;
  tavilyApiKey?: string | null;
}): Promise<WebsiteResearchData | null> {
  const normalizedUrl = normalizeWebsiteUrl(args.websiteUrl ?? '');
  if (!normalizedUrl) return null;

  const domain = getDomain(normalizedUrl);
  const fetchedSnippets: WebsiteSnippet[] = [];
  let lastError: string | undefined;

  let searchSnippets: WebsiteSnippet[] = [];
  if (args.tavilyApiKey) {
    const queries = [
      `site:${domain} "${args.businessName}" ${args.businessCategory} services pricing hours`,
      `site:${domain} pricing prices services hours`,
    ];
    const results = await Promise.all(queries.map((query) => tavilySearch(query, args.tavilyApiKey!)));
    searchSnippets = results
      .flat()
      .filter((item) => getDomain(item.url) === domain)
      .slice(0, MAX_SEARCH_RESULTS);
  }

  // Only fetch the homepage when Tavily did not produce enough evidence.
  if (searchSnippets.length < 2) {
    try {
      const homepage = await fetchText(normalizedUrl);
      if (homepage) {
        fetchedSnippets.push({
          url: homepage.url,
          title: homepage.title,
          snippet: homepage.text.slice(0, 500),
          source: 'site_fetch',
        });
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Website fetch failed.';
    }
  }

  const snippets = dedupeSnippets([...searchSnippets, ...fetchedSnippets]).slice(0, 3);
  if (!snippets.length) {
    return {
      websiteUrl: normalizedUrl,
      domain,
      confidence: 'low',
      snippets: [],
      error: lastError ?? 'No public website content could be collected.',
    };
  }

  return {
    websiteUrl: normalizedUrl,
    domain,
    confidence: confidenceFromCounts(
      snippets.filter((item) => item.source === 'site_fetch').length,
      snippets.filter((item) => item.source === 'search').length,
    ),
    snippets,
  };
}
