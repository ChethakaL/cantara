import Anthropic from '@anthropic-ai/sdk';
import { requireAIClient, resolveModel, usesBedrock } from "@/lib/ai-client"
import {
  ChannelResearchData,
  DigitalAssetFormData,
  DigitalPresenceReport,
  ChannelAssessment,
  ChannelType,
} from './types';

const CHANNEL_LABELS: Record<ChannelType, string> = {
  website: 'Website',
  google_business: 'Google Business Profile',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  booking_platform: 'Booking Platform',
  online_reputation: 'Online Reputation',
};

function buildPrompt(
  formData: DigitalAssetFormData,
  researchData: ChannelResearchData[]
): string {
  const channelSections = researchData
    .map(ch => {
      const resultSummaries = ch.results
        .slice(0, 5)
        .map(r => `  - [${r.title}](${r.url})\n    ${r.content.slice(0, 400)}`)
        .join('\n');

      return `### Channel: ${CHANNEL_LABELS[ch.channelType]}
Provided URL/Handle: ${ch.inputUrl ?? 'N/A'}
Search Queries Used: ${ch.searchQueries.join(' | ')}
Web Research Results:
${resultSummaries || '  (No results found)'}`;
    })
    .join('\n\n');

  return `You are a digital presence analyst specializing in M&A (mergers and acquisitions) due diligence for service businesses. Your job is to assess the digital footprint of a business being evaluated for sale.

## Business Being Assessed
- Business Name: ${formData.businessName}


## Web Research Data
The following data was gathered via web search for each digital channel provided by the seller. Note: this data is sourced from public web search and may be incomplete or imprecise. Only report metrics you can reasonably infer from the search results. If data is absent or unclear, mark the channel as low confidence.

IMPORTANT: Any result marked [VERIFIED] contains authoritative data retrieved directly from the Google Places API. This data is more reliable than web-scraped data.

CRITICAL INSTRUCTION FOR GOOGLE BUSINESS PROFILE: When [VERIFIED] data is present for Google Business Profile, you MUST use the VERIFIED rating and review count EXACTLY as provided. Do not override, estimate, or round these numbers based on other search results. The verified data is the single source of truth for rating and total review count.

${channelSections}

---

## Your Task
Analyse each channel based on the research data and produce a structured JSON report. Follow these scoring criteria:

### Scoring Criteria (1–5 per channel):

**Website (1–5)**
- 5: Fast load, mobile-optimised, clear services, booking integration, good SEO signals
- 4: Good overall with minor gaps
- 3: Functional but missing key elements (slow, no booking, weak SEO)
- 2: Outdated, poor mobile, missing service info
- 1: Broken, very outdated, or negligible web presence

**Google Business Profile (1–5)** — THIS IS THE MOST IMPORTANT REVIEW CHANNEL
- 5: 4.5+ stars, 50+ reviews, active (< 1 month), complete profile with photos
- 4: 4+ stars, 20+ reviews, mostly complete
- 3: 3.5–4 stars or < 20 reviews or inactive 1–3 months
- 2: < 3.5 stars or very few reviews or very incomplete
- 1: Not found, 1 or 2 reviews, or very negative

**MANDATORY Google Reviews Deep-Dive**: For Google Business Profile, you MUST report ALL of the following in keyMetrics:
- "Total Reviews": Absolute number of reviews (e.g. "47 reviews")
- "Overall Rating": Overall star score (e.g. "4.3 stars")
- "Recent Review Activity": How frequently reviews are posted in the last 3–6 months (e.g. "~3 reviews/month", "Last review 2 months ago")
- "Recent Review Quality": Sentiment of recent reviews — are recent reviews mostly positive (4–5 stars) or trending negative?
- "Negative Review Response": Does the business respond to poor reviews (1–2 stars)? Are responses professional and timely? (e.g. "Owner responds to all negative reviews within 48h" or "No responses to negative reviews found")
- If the business has MULTIPLE LOCATIONS, report each location separately with its own review count, rating, and recency data. Use the format "Location: [name] — [rating], [count] reviews"

**Social Media — Facebook/Instagram/TikTok/YouTube (1–5 each)**
- 5: Large following (1k+ FB/IG, 500+ TikTok/YT), posts weekly, strong engagement, on-brand
- 4: Moderate following, posts monthly, decent engagement
- 3: Small following or irregular posts (1–3 months gap)
- 2: Very small following, rare posts, low engagement
- 1: Dormant (6+ months), near-zero following, or not found

**Booking Platform (1–5)**
- 5: Active, publicly bookable, prominent in web results
- 4: Active with minor friction
- 3: Exists but may not be prominently linked or easy to find
- 2: Hard to find or may be inactive
- 1: Not publicly bookable or not found

**Online Reputation Aggregate (1–5)**
- 5: 4.5+ avg across Google/Yelp/FB, strong review volume
- 4: 4+ avg, decent volume
- 3: Mixed reviews or low volume
- 2: Below 3.5 avg or many negative patterns
- 1: Overwhelmingly negative or no reputation online

**Glassdoor / Employer Reputation**: If Glassdoor data is found in the research results, include it in the Online Reputation channel assessment with keyMetrics for:
- "Glassdoor Rating": Overall employer rating (e.g. "3.8/5")
- "Glassdoor Reviews": Number of employee reviews
- "Glassdoor Recommend": % who recommend to a friend
If no Glassdoor data is found, include a keyMetric: "Glassdoor": "No profile found — search for employer reviews recommended"

### Traffic Light Mapping:
- Score 4–5 → "green"
- Score 3 → "amber"
- Score 1–2 → "red"

### Data Confidence:
- "high": multiple corroborating data points found in search results
- "medium": some data found but incomplete
- "low": very little or no relevant data found; score is a best estimate

---

## Required JSON Output Format

Return ONLY valid JSON (no markdown, no code fences, no explanation). The structure must exactly match:

{
  "overallScore": <number 1–5, weighted average of all channel scores>,
  "overallTrafficLight": "<green|amber|red>",
  "executiveSummary": "<2–3 sentence summary for M&A advisors>",
  "maReadinessNotes": "<1–2 sentences about digital asset quality for M&A sale package>",
  "channels": [
    {
      "channelType": "<website|google_business|facebook|instagram|tiktok|youtube|booking_platform|online_reputation>",
      "channelLabel": "<human readable label>",
      "url": "<url or handle if known>",
      "score": <1–5>,
      "trafficLight": "<green|amber|red>",
      "summary": "<1–2 sentence factual summary based on research data>",
      "notFound": <true if no meaningful data was found>,
      "dataConfidence": "<high|medium|low>",
      "flags": [
        { "severity": "<critical|warning|positive>", "message": "<specific actionable flag>" }
      ],
      "keyMetrics": [
        { "label": "<metric name>", "value": "<value or 'Not found'>" }
      ]
    }
  ],
  "digitalAssetInventory": [
    {
      "assetType": "<Website|Google Business Profile|Facebook Page|Instagram|TikTok|YouTube|Booking Platform|Yelp|Review Platform>",
      "channelType": "<channel type>",
      "url": "<full url>",
      "status": "<active|inactive|not_found|unverified>",
      "score": <1–5 or null if not_found>,
      "notes": "<brief note>"
    }
  ]
}

Important rules:
- Only include channels that were actually provided and researched
- If a channel was not found in search results, set notFound: true and score: 2 (penalise absence)
- keyMetrics should include the most relevant observable data points (e.g. "Google Rating": "4.2 stars", "Review Count": "~35 reviews", "Last Post": "2 weeks ago")
- flags must be specific and actionable — avoid generic statements
- scores must reflect data confidence: if confidence is low, do not score above 3
- overallScore is a simple average of all channel scores, rounded to 1 decimal place`;
}

export async function analyzeWithClaude(
  formData: DigitalAssetFormData,
  researchData: ChannelResearchData[],
): Promise<DigitalPresenceReport> {
  const client = await requireAIClient();
  const prompt = buildPrompt(formData, researchData);

  const response = await client.messages.create({
    model: resolveModel('claude-opus-4-5'),
    max_tokens: 4096,
    temperature: 0,
    messages: [{ role: 'user', content: prompt }],
  });

  const rawText = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as any).text)
    .join('');

  let parsed: any;
  try {
    // Strip any accidental markdown code fences
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error('[Claude Analyzer] Failed to parse JSON response:', rawText.slice(0, 500));
    throw new Error('Claude returned an unparseable response. Please retry.');
  }

  // Inject the business name and timestamp
  const report: DigitalPresenceReport = {
    businessName: formData.businessName,
    generatedAt: new Date().toISOString(),
    overallScore: parsed.overallScore ?? 0,
    overallTrafficLight: parsed.overallTrafficLight ?? 'red',
    executiveSummary: parsed.executiveSummary ?? '',
    maReadinessNotes: parsed.maReadinessNotes ?? '',
    channels: (parsed.channels ?? []).map((ch: any): ChannelAssessment => ({
      channelType: ch.channelType,
      channelLabel: ch.channelLabel ?? CHANNEL_LABELS[ch.channelType as ChannelType] ?? ch.channelType,
      url: ch.url,
      score: Math.min(5, Math.max(1, Math.round(ch.score))) as any,
      trafficLight: ch.trafficLight ?? scoreToTrafficLight(ch.score),
      summary: ch.summary ?? '',
      notFound: ch.notFound ?? false,
      dataConfidence: ch.dataConfidence ?? 'low',
      flags: ch.flags ?? [],
      keyMetrics: ch.keyMetrics ?? [],
    })),
    digitalAssetInventory: parsed.digitalAssetInventory ?? [],
  };

  return report;
}

function scoreToTrafficLight(score: number): 'green' | 'amber' | 'red' {
  if (score >= 4) return 'green';
  if (score >= 3) return 'amber';
  return 'red';
}
