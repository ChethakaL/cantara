import { ConfidenceLevel, PriceEvidenceItem, WebsiteResearchData, WebsiteSnippet } from './types';

const TAVILY_API_URL = 'https://api.tavily.com/search';
const FETCH_TIMEOUT_MS = 20000;
const MAX_FETCHED_PAGES = 3;
const MAX_TAVILY_RESULTS_PER_QUERY = 6;
const MAX_SEARCH_RESULTS = 3;
const MAX_SEARCH_RESULTS_FOR_EXTRACTION = 12;
const MAX_PRICE_POINTS = 8;
const MAX_EXTRACT_FALLBACK_URLS = 5;

interface TavilyResponse {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    raw_content?: string;
  }>;
}

interface TavilyExtractResponse {
  results?: Array<{
    url?: string;
    title?: string;
    raw_content?: string;
    content?: string;
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

function isSameDomainOrSubdomain(url: string, rootDomain: string): boolean {
  const domain = getDomain(url).toLowerCase();
  const root = rootDomain.toLowerCase();
  return domain === root || domain.endsWith(`.${root}`);
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
        max_results: MAX_TAVILY_RESULTS_PER_QUERY,
        include_answer: false,
        include_raw_content: true,
      }),
    });

    if (!res.ok) return [];
    const data = await res.json() as TavilyResponse;
    return (data.results ?? []).map((result) => ({
      url: result.url ?? '',
      title: result.title ?? 'Search result',
      snippet: collapseWhitespace((result.raw_content || result.content || '').slice(0, 4000)),
      source: 'search' as const,
    })).filter((item) => item.url && item.snippet);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function tavilyExtract(urls: string[], apiKey: string): Promise<WebsiteSnippet[]> {
  if (!urls.length) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch('https://api.tavily.com/extract', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        urls,
        extract_depth: 'basic',
      }),
    });

    if (!res.ok) return [];
    const data = await res.json() as TavilyExtractResponse;
    return (data.results ?? []).map((result) => ({
      url: result.url ?? '',
      title: result.title ?? 'Extracted page',
      snippet: collapseWhitespace((result.raw_content || result.content || '').slice(0, 2200)),
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

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizePriceLabel(name: string, price: string): string {
  const cleanName = collapseWhitespace(name).replace(/\s*[|>].*$/, '').slice(0, 120);
  const cleanPrice = collapseWhitespace(price).replace(/\s+/g, ' ');
  return `${cleanName} — ${cleanPrice}`;
}

function buildContextualPriceLabel(name: string, price: string, pageTitle?: string): string | null {
  const cleanName = collapseWhitespace(name);
  const cleanTitle = collapseWhitespace(pageTitle ?? '');
  const isGeneric = /^(starting at|from)\b/i.test(cleanName) || /^starting at\b/i.test(cleanName);
  const titleLooksUseful = cleanTitle.length >= 8
    && !/shop by brand|search result|all products|homepage|product pricing page/i.test(cleanTitle);

  if (isGeneric) {
    if (!titleLooksUseful) return null;
    return normalizePriceLabel(cleanTitle, price);
  }

  return normalizePriceLabel(cleanName, price);
}

function looksLikeCatalogUrl(url: string): boolean {
  return /search|shop|product|products|category|categories|collection|collections|catalog|cgid|\/c\/|\/p\/|all-products|pricing|prices|rates|daycare|boarding|grooming|services/i.test(url);
}

function isStoreDetailsUrl(url: string): boolean {
  return /Stores-StoreDetails|storeID=|storefinder|locations|about|contact|blog|events/i.test(url);
}

function looksLikePriceEvidenceUrl(url: string): boolean {
  return looksLikeCatalogUrl(url) && !isStoreDetailsUrl(url);
}

function isBadPriceEvidenceLabel(label: string): boolean {
  return /free delivery|delivery over|store details|chat with an expert|options available/i.test(label);
}

function isLowQualityProductName(name: string): boolean {
  const normalized = collapseWhitespace(name).toLowerCase();
  if (!normalized) return true;
  if (/^starting at$/.test(normalized)) return true;
  if (/^starting at\s*[-:–—]?\s*$/.test(normalized)) return true;
  if (/in stock|get it by|for delivery|change store|schedule autoship|quick view|shop by/i.test(normalized)) return true;
  const words = normalized.split(/\s+/).filter(Boolean);
  const meaningful = words.filter((word) => /[a-z]{3,}/.test(word) && !['starting', 'from', 'price', 'prices'].includes(word));
  return meaningful.length < 2;
}

function dedupePriceEvidence(items: PriceEvidenceItem[]): PriceEvidenceItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.label.toLowerCase()}|${(item.url ?? '').toLowerCase()}`;
    if (!item.label || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collectJsonLdObjects(value: unknown): Record<string, unknown>[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectJsonLdObjects(item));
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const items = [record];
    if (record['@graph']) {
      items.push(...collectJsonLdObjects(record['@graph']));
    }
    return items;
  }
  return [];
}

function extractJsonLdPriceEvidence(html: string, pageUrl: string): PriceEvidenceItem[] {
  const matches = Array.from(html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
  const points: PriceEvidenceItem[] = [];

  for (const match of matches) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const objects = collectJsonLdObjects(parsed);
      for (const obj of objects) {
        const name = typeof obj.name === 'string' ? obj.name : '';
        const offers = obj.offers;
        const offerObjects = collectJsonLdObjects(offers);
        for (const offer of offerObjects) {
          const price = typeof offer.price === 'string' || typeof offer.price === 'number'
            ? `$${offer.price}`
            : typeof offer.lowPrice === 'string' || typeof offer.lowPrice === 'number'
              ? `$${offer.lowPrice}${offer.highPrice ? ` - $${offer.highPrice}` : ''}`
              : '';
          if (name && price) {
            const label = normalizePriceLabel(name, price);
            if (!isBadPriceEvidenceLabel(label)) {
              points.push({ label, url: pageUrl, pageTitle: 'Product pricing page' });
            }
          }
        }
      }
    } catch {
      continue;
    }
  }

  return points;
}

function extractRegexPriceEvidence(text: string, pageUrl?: string, pageTitle?: string): PriceEvidenceItem[] {
  const compact = collapseWhitespace(text)
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, ' $1 ')
    .replace(/\s+\|\s+/g, ' ')
    .replace(/\s{2,}/g, ' ');
  const patterns = [
    /([A-Za-z][A-Za-z0-9&'(),.\-\/+ ]{8,110}?)\s+\$ ?(\d+(?:\.\d{2})?(?:\s*-\s*\$ ?\d+(?:\.\d{2})?)?)/g,
    /([A-Za-z][A-Za-z0-9&'(),.\-\/+ ]{8,110}?)\s+from\s+\$ ?(\d+(?:\.\d{2})?)/gi,
  ];

  const points: PriceEvidenceItem[] = [];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(compact)) !== null) {
      const name = collapseWhitespace(match[1] ?? '');
      const price = collapseWhitespace(match[2] ?? '');
      if (!name || !price) continue;
      if (isLowQualityProductName(name)) continue;
      if (name.length < 8 || /search result|showing|all products|sort by/i.test(name)) continue;
      if (!/[A-Za-z]{3,}/.test(name)) continue;
      if (/discounted|coupon|save|off\b|deal|weekly ad|promotion|special offer/i.test(name)) continue;
      if (/quick view|shop by|options available|skip to footer|in stock|get it by|for delivery|change store|schedule autoship/i.test(name)) continue;
      const label = buildContextualPriceLabel(name, `$${price.replace(/^\$/, '')}`, pageTitle);
      if (!label) continue;
      if (isBadPriceEvidenceLabel(label)) continue;
      points.push({ label, url: pageUrl, pageTitle });
      if (points.length >= MAX_PRICE_POINTS) return points;
    }
  }

  return points;
}

function extractLinkedProductPriceEvidence(text: string, pageUrl?: string, pageTitle?: string): PriceEvidenceItem[] {
  const compact = collapseWhitespace(text);
  const pattern = /\[([^\]]{6,140})\]\([^)]+\)\s+\$ ?(\d+(?:\.\d{2})?(?:\s*-\s*\$ ?\d+(?:\.\d{2})?)?)/g;
  const points: PriceEvidenceItem[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(compact)) !== null) {
    const name = collapseWhitespace(match[1] ?? '');
    const price = collapseWhitespace(match[2] ?? '');
    if (!name || !price) continue;
    if (isLowQualityProductName(name)) continue;
    const label = buildContextualPriceLabel(name, `$${price.replace(/^\$/, '')}`, pageTitle);
    if (!label) continue;
    if (isBadPriceEvidenceLabel(label)) continue;
    points.push({ label, url: pageUrl, pageTitle });
    if (points.length >= MAX_PRICE_POINTS) break;
  }
  return points;
}

function extractPriceEvidenceFromSnippet(snippet: WebsiteSnippet): PriceEvidenceItem[] {
  const merged = `${snippet.title} ${snippet.snippet}`;
  return [
    ...extractLinkedProductPriceEvidence(merged, snippet.url, snippet.title),
    ...extractRegexPriceEvidence(merged, snippet.url, snippet.title),
  ];
}

function scoreSearchSnippet(snippet: WebsiteSnippet): number {
  const haystack = `${snippet.title} ${snippet.snippet}`;
  let score = 0;
  if (/[$€£]\s*\d|\bfrom\s*[$€£]?\s*\d/i.test(haystack)) score += 8;
  if (/pricing|prices|rates|daycare|boarding|grooming|services|packages/i.test(haystack)) score += 8;
  if (/pricing|prices|rates|daycare|boarding|grooming|services/i.test(snippet.url)) score += 8;
  if (/\/products?\/|shop-by-brand|\/p\/|item|sku|brand|\/cat\/|\/dog\//i.test(snippet.url)) score += 4;
  if (/\/\d+\.html$/i.test(snippet.url)) score += 6;
  if (/dog|cat|food|treat|recipe|wet|dry|canned|kibble/i.test(haystack)) score += 2;
  if (/search\?q=|\/search|sort by|showing:/i.test(haystack)) score -= 3;
  if (/evergreen-pattern|home-supplies|grooming\/?$|accessories\/?$|privacy-policy|homepage/i.test(snippet.url)) score -= 5;
  if (isStoreDetailsUrl(snippet.url)) score -= 8;
  return score;
}

function pickFetchUrls(homepageUrl: string, searchSnippets: WebsiteSnippet[]): string[] {

  const rankedCatalogUrls = searchSnippets
    .filter((item) => looksLikeCatalogUrl(item.url))
    .sort((a, b) => scoreSearchSnippet(b) - scoreSearchSnippet(a))
    .map((item) => item.url);

  const candidates = [
    ...buildFallbackExtractUrls(homepageUrl),
    ...rankedCatalogUrls,
    homepageUrl,
    ...searchSnippets.map((item) => item.url),
  ];

  return dedupeStrings(candidates).slice(0, MAX_FETCHED_PAGES);
}

function buildFallbackExtractUrls(homepageUrl: string): string[] {
  try {
    const base = new URL(homepageUrl);
    return dedupeStrings([
      homepageUrl,
      new URL('/services/daycare', base).toString(),
      new URL('/services/daycare#pricing', base).toString(),
      new URL('/services/boarding', base).toString(),
      new URL('/services/grooming', base).toString(),
      new URL('/pricing', base).toString(),
      new URL('/prices', base).toString(),
      new URL('/rates', base).toString(),
      new URL('/services', base).toString(),
      new URL('/shop-by-brand/', base).toString(),
      new URL('/search?cgid=root', base).toString(),
      new URL('/feed-like-a-muddy/', base).toString(),
      new URL('/products-pet-featured/', base).toString(),
    ]);
  } catch {
    return [];
  }
}

function rankExtractCandidateUrl(url: string): number {
  let score = 0;
  if (/pricing|prices|rates|daycare|boarding|grooming|services/i.test(url)) score += 12;
  if (/search\?cgid=root/i.test(url)) score += 10;
  if (/\/\d+\.html$/i.test(url)) score += 8;
  if (/shop-by-brand|\/cat\/|\/dog\/|\/products?\//i.test(url)) score += 4;
  if (/storedetails|storeid=|homepage|privacy-policy|about/i.test(url)) score -= 8;
  return score;
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
  const logPrefix = `[WebsiteResearch:${args.businessName}]`;
  const fetchedSnippets: WebsiteSnippet[] = [];
  const fetchedPriceEvidence: PriceEvidenceItem[] = [];
  let lastError: string | undefined;

  let searchSnippets: WebsiteSnippet[] = [];
  if (args.tavilyApiKey) {
    const queries = [
      `site:${domain} "${args.businessName}" (daycare OR boarding OR grooming OR services) (pricing OR prices OR rates OR "$")`,
      `site:${domain} (daycare OR "half day" OR "full day" OR boarding OR grooming) (pricing OR prices OR rates OR "$") -Stores-StoreDetails -storeID -storefinder -locations -contact -about`,
      `site:${domain} "${args.businessName}" ${args.businessCategory} services hours pricing`,
      `site:${domain} (${args.businessCategory} OR daycare OR boarding OR grooming) (prices OR pricing OR rates OR "$") -Stores-StoreDetails -storeID -storefinder -locations -contact -about`,
      `site:${domain} ("shop-by-brand" OR products OR "all products" OR cgid) (dog OR cat) (price OR "$") -Stores-StoreDetails -storeID`,
      `site:${domain} "shop-by-brand" (dog OR cat OR food OR treats)`,
      `site:${domain} ("search?cgid=root" OR "feed-like-a-muddy" OR "all products")`,
      `site:${domain} inurl:shop-by-brand (dog OR cat) prices`,
      `site:${domain} "${args.businessName}" inurl:shop-by-brand "$"`,
    ];
    const results = await Promise.all(queries.map((query) => tavilySearch(query, args.tavilyApiKey!)));
    results.forEach((items, index) => {
      console.log(
        `${logPrefix} Tavily query ${index + 1}/${queries.length} -> ${items.length} result(s):`,
        queries[index]
      );
      items.forEach((item, itemIndex) => {
        console.log(`${logPrefix}   [q${index + 1} r${itemIndex + 1}] ${item.url}`);
      });
    });
    searchSnippets = results
      .flat()
      .filter((item) => isSameDomainOrSubdomain(item.url, domain))
      .filter((item, index, arr) => arr.findIndex((candidate) => candidate.url === item.url) === index)
      .sort((a, b) => scoreSearchSnippet(b) - scoreSearchSnippet(a))
      .slice(0, MAX_SEARCH_RESULTS_FOR_EXTRACTION);
    console.log(
      `${logPrefix} Domain-filtered Tavily snippets: ${searchSnippets.length} (domain=${domain})`
    );
  } else {
    console.warn(`${logPrefix} Tavily API key missing. Skipping Tavily search.`);
  }

  const searchSnippetsForDisplay = searchSnippets.slice(0, MAX_SEARCH_RESULTS);

  const fetchUrls = pickFetchUrls(normalizedUrl, searchSnippets);
  console.log(`${logPrefix} Fetch URL candidates (${fetchUrls.length}):`, fetchUrls);
  if (fetchUrls.length) {
    try {
      const pages = await Promise.all(fetchUrls.map((url) => fetchText(url)));
      for (const page of pages) {
        if (!page) continue;
        fetchedSnippets.push({
          url: page.url,
          title: page.title,
          snippet: page.text.slice(0, 500),
          source: 'site_fetch',
        });
        if (looksLikePriceEvidenceUrl(page.url)) {
          fetchedPriceEvidence.push(
            ...extractJsonLdPriceEvidence(page.html, page.url),
            ...extractRegexPriceEvidence(page.text, page.url, page.title),
          );
        }
        if (page.url === normalizedUrl && !fetchedPriceEvidence.length) {
          const linkedCatalogUrls = Array.from(page.html.matchAll(/href=["']([^"']+)["']/gi))
            .map((match) => match[1] ?? '')
            .map((href) => {
              try {
                return new URL(href, normalizedUrl).toString();
              } catch {
                return '';
              }
            })
            .filter((url) => getDomain(url) === domain && looksLikePriceEvidenceUrl(url))
            .slice(0, 2);

          const linkedPages = await Promise.all(linkedCatalogUrls.map((url) => fetchText(url)));
          for (const linkedPage of linkedPages) {
            if (!linkedPage) continue;
            fetchedPriceEvidence.push(
              ...extractJsonLdPriceEvidence(linkedPage.html, linkedPage.url),
              ...extractRegexPriceEvidence(linkedPage.text, linkedPage.url, linkedPage.title),
            );
          }
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Website fetch failed.';
      console.warn(`${logPrefix} Fetch pipeline error: ${lastError}`);
    }
  }

  const snippets = dedupeSnippets([...searchSnippetsForDisplay, ...fetchedSnippets]).slice(0, 3);
  const priceEvidence = dedupePriceEvidence([
    ...searchSnippets.flatMap((snippet) => extractPriceEvidenceFromSnippet(snippet)),
    ...fetchedPriceEvidence,
  ]).slice(0, MAX_PRICE_POINTS);
  let finalPriceEvidence = priceEvidence;

  if (!finalPriceEvidence.length && args.tavilyApiKey) {
    const extractCandidates = dedupeStrings([
      ...buildFallbackExtractUrls(normalizedUrl),
        ...pickFetchUrls(normalizedUrl, searchSnippets).filter((url) => looksLikePriceEvidenceUrl(url)),
        ...searchSnippets.map((item) => item.url).filter((url) => looksLikePriceEvidenceUrl(url)),
      ])
        .sort((a, b) => rankExtractCandidateUrl(b) - rankExtractCandidateUrl(a))
        .slice(0, MAX_EXTRACT_FALLBACK_URLS);
    if (extractCandidates.length) {
      console.log(`${logPrefix} Tavily extract fallback candidates (${extractCandidates.length}):`, extractCandidates);
      const extractedSnippets = await tavilyExtract(extractCandidates, args.tavilyApiKey);
      const extractedEvidence = dedupePriceEvidence(
        extractedSnippets.flatMap((snippet) =>
            [
              ...extractLinkedProductPriceEvidence(`${snippet.title} ${snippet.snippet}`, snippet.url, snippet.title),
              ...extractRegexPriceEvidence(`${snippet.title} ${snippet.snippet}`, snippet.url, snippet.title),
            ]
        )
      ).slice(0, MAX_PRICE_POINTS);
      if (extractedEvidence.length) {
        console.log(`${logPrefix} Tavily extract recovered ${extractedEvidence.length} price evidence item(s).`);
      } else {
        console.warn(`${logPrefix} Tavily extract fallback did not recover pricing evidence.`);
      }
      finalPriceEvidence = extractedEvidence;
    }
  }

  const pricePoints = dedupeStrings(finalPriceEvidence.map((item) => item.label)).slice(0, MAX_PRICE_POINTS);
  console.log(
    `${logPrefix} Final summary -> snippets=${snippets.length}, priceEvidence=${finalPriceEvidence.length}, pricePoints=${pricePoints.length}`
  );
  if (finalPriceEvidence.length) {
    finalPriceEvidence.slice(0, 5).forEach((item, index) => {
      console.log(`${logPrefix}   [price ${index + 1}] ${item.label} (${item.url ?? 'no-url'})`);
    });
  } else {
    console.warn(`${logPrefix} No price evidence extracted.`);
  }
  if (!snippets.length) {
    return {
      websiteUrl: normalizedUrl,
      domain,
      confidence: 'low',
      snippets: [],
      pricePoints,
      priceEvidence: finalPriceEvidence,
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
    pricePoints,
    priceEvidence: finalPriceEvidence,
  };
}
