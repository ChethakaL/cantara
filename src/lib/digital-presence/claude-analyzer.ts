import { requireAIClient, resolveModel } from "@/lib/ai-client"
import type { AgentAiProvider } from "@/lib/agent-model-provider";
import { createAgentMessage } from "@/lib/llm-completion";
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
  options?: { provider?: AgentAiProvider; modelId?: string },
): Promise<DigitalPresenceReport> {
  const provider = options?.provider ?? 'openai';
  const prompt = buildPrompt(formData, researchData);

  let rawText: string;
  if (provider === 'openai') {
    rawText = await createAgentMessage({
      provider,
      model: options?.modelId,
      system: '',
      content: prompt,
      maxTokens: 4096,
      temperature: 0,
    });
  } else {
    const client = await requireAIClient();
    const response = await client.messages.create({
      model: resolveModel('claude-opus-4-5'),
      max_tokens: 4096,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    });
    rawText = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('');
  }

  let parsed: any;
  try {
    parsed = parseDigitalPresenceJson(rawText);
  } catch (err) {
    console.error('[Claude Analyzer] Failed to parse JSON response:', rawText.slice(0, 500));
    throw new Error('Claude returned an unparseable response. Please retry.');
  }

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

function stripJsonFence(text: string) {
  const t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  if (fence) return fence[1].trim();
  return t;
}

function parseDigitalPresenceJson(rawText: string): any {
  const cleaned = stripJsonFence(rawText);
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('Claude returned an unparseable response. Please retry.');
  }
}

function recalcOverall(channels: ChannelAssessment[]): {
  overallScore: number;
  overallTrafficLight: 'green' | 'amber' | 'red';
} {
  if (!channels.length) return { overallScore: 0, overallTrafficLight: 'red' };
  const avg = channels.reduce((sum, ch) => sum + Number(ch.score || 0), 0) / channels.length;
  const overallScore = Math.round(avg * 10) / 10;
  return { overallScore, overallTrafficLight: scoreToTrafficLight(overallScore) };
}

/** Re-score analysis from advisor-edited metrics. Keeps edited keyMetrics; refreshes scores/narrative. */
export async function reanalyzeDigitalPresenceFromEdits(
  existingReport: DigitalPresenceReport,
  options?: { provider?: AgentAiProvider; modelId?: string },
): Promise<DigitalPresenceReport> {
  const provider = options?.provider ?? 'openai';

  const prompt = `You are a digital presence analyst for M&A due diligence.

An advisor manually corrected channel metrics/summaries on an existing Digital Presence report.
RE-SCORE and REWRITE the analysis to match those corrected values.

## CRITICAL — advisor edits override prior analysis
- keyMetrics are GROUND TRUTH. Score and summarise ONLY from those values (and any advisor-edited summary).
- IGNORE prior currentScore, currentTrafficLight, currentFlags, prior summaries, and prior dataConfidence when they conflict with the edited metrics.
- Do NOT keep a channel "Poor"/red/score 1–2 just because the original research had low confidence or said "limited public data".
- Missing optional fields (e.g. "Page likes: Not found") must NOT drag a strong channel down when core metrics are strong.
- When the advisor has filled substantive metric values (not mostly "Not found" / empty), set dataConfidence to "medium" or "high" and rewrite the summary accordingly — drop "best estimate / limited public data" language.
- Flags must match the NEW score: celebrate strengths with positive flags; diligence warnings are fine but cannot be the only story when metrics are strong.

## Recency / dates (CRITICAL — today's context is September 2026)
- Parse any posting / activity dates in keyMetrics (e.g. "27th February 2024", "Feb 27 2024").
- If last post / activity is older than ~6 months → treat as DORMANT: score ≤ 2 (red), and add a warning/critical flag that explicitly names the date and how stale it is (e.g. "Last post 27 February 2024 — over 2 years ago; channel appears dormant").
- If last activity is 1–3 months ago → score ≤ 3 (amber) unless other metrics are exceptional; flag the gap.
- Do NOT call a channel "strong" or "Good" when the last post is from 2024 (or any date clearly >6 months old). Large follower counts cannot override dormancy.
- Example: Followers "1K" + Engagement "Good" + Recent posting "27th February 2024" → score 2 (red/Poor), summary must call out inactivity since Feb 2024, flags must warn about dormancy.

## Social media scoring (Facebook / Instagram / TikTok / YouTube)
- 5 (green): Large following (1k+ FB/IG, or clearly large e.g. "1 + million", "1M+"), recent activity (within ~1 month), strong/good engagement
- 4 (green): Moderate-to-large following, decent engagement, posts within ~1 month
- 3 (amber): Small following or irregular posts (1–3 month gap)
- 2 (red): Very small following, rare posts, low engagement, OR dormant (>6 months) even with decent following
- 1 (red): Long dormant, near-zero following, or essentially not found
Example: Followers "1 + million" + Engagement "Good" + posting within the last month → score 5 (green), even if page likes are "Not found".

## Other channels
Use the same 1–5 scale as a normal digital-presence review (website, GBP, booking, reputation). Strong edited metrics → higher scores — but still apply recency rules when dates are present.

Traffic lights: score 4–5 → green, 3 → amber, 1–2 → red.
overallScore = average of channel scores (1 decimal).

## Authoritative advisor-edited report
${JSON.stringify({
  businessName: existingReport.businessName,
  channels: existingReport.channels.map((ch) => ({
    channelType: ch.channelType,
    channelLabel: ch.channelLabel,
    url: ch.url,
    summary: ch.summary,
    keyMetrics: ch.keyMetrics,
  })),
  digitalAssetInventory: existingReport.digitalAssetInventory,
}, null, 2)}

Return ONLY JSON (no markdown):
{
  "overallScore": <number>,
  "overallTrafficLight": "<green|amber|red>",
  "executiveSummary": "<2–3 sentences reflecting edited metrics>",
  "maReadinessNotes": "<1–2 sentences>",
  "channels": [
    {
      "channelType": "<same channelType>",
      "score": <1–5>,
      "trafficLight": "<green|amber|red>",
      "summary": "<updated from edited metrics>",
      "dataConfidence": "<high|medium|low>",
      "flags": [{ "severity": "<critical|warning|positive>", "message": "<specific>" }]
    }
  ],
  "digitalAssetInventory": [
    {
      "channelType": "<channel type>",
      "status": "<active|inactive|not_found|unverified>",
      "score": <1–5 or null>,
      "notes": "<brief>"
    }
  ]
}

Include EVERY channelType from the edited report. Do NOT return keyMetrics.`;

  let rawText: string;
  if (provider === 'openai') {
    rawText = await createAgentMessage({
      provider,
      model: options?.modelId,
      system: '',
      content: prompt,
      maxTokens: 4096,
      temperature: 0,
    });
  } else {
    const client = await requireAIClient();
    const response = await client.messages.create({
      model: resolveModel('claude-opus-4-5'),
      max_tokens: 4096,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    });
    rawText = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('');
  }

  let parsed: any;
  try {
    parsed = parseDigitalPresenceJson(rawText);
  } catch (err) {
    console.error('[Claude Analyzer] Reanalyze parse failed:', rawText.slice(0, 500));
    throw err instanceof Error ? err : new Error('Claude returned an unparseable response. Please retry.');
  }

  const aiByType = new Map<string, any>(
    (Array.isArray(parsed.channels) ? parsed.channels : []).map((ch: any) => [ch.channelType, ch]),
  );

  const channels: ChannelAssessment[] = existingReport.channels.map((existing) => {
    const ai = aiByType.get(existing.channelType);
    const score = Math.min(5, Math.max(1, Math.round(Number(ai?.score ?? existing.score)))) as ChannelAssessment['score'];
    const hasSubstantiveMetrics = (existing.keyMetrics ?? []).some((m) => {
      const v = (m.value ?? '').trim().toLowerCase();
      return v.length > 0 && v !== 'not found' && v !== 'n/a' && v !== '-';
    });
    return {
      ...existing,
      keyMetrics: existing.keyMetrics,
      score,
      // Always derive from score so AI cannot keep "Poor" while assigning a high score.
      trafficLight: scoreToTrafficLight(score),
      summary: typeof ai?.summary === 'string' && ai.summary.trim() ? ai.summary : existing.summary,
      dataConfidence: (ai?.dataConfidence as ChannelAssessment['dataConfidence'])
        ?? (hasSubstantiveMetrics && existing.dataConfidence === 'low' ? 'medium' : existing.dataConfidence),
      notFound: hasSubstantiveMetrics ? false : existing.notFound,
      flags: Array.isArray(ai?.flags) ? ai.flags : existing.flags,
    };
  });

  const localOverall = recalcOverall(channels);

  const inventory = (existingReport.digitalAssetInventory ?? []).map((item) => {
    const aiInv = Array.isArray(parsed.digitalAssetInventory)
      ? parsed.digitalAssetInventory.find((row: any) => row.channelType === item.channelType)
      : null;
    const matchedChannel = channels.find((ch) => ch.channelType === item.channelType);
    return {
      ...item,
      status: (aiInv?.status as typeof item.status) ?? item.status,
      score: aiInv?.score !== undefined
        ? (aiInv.score === null ? null : Math.min(5, Math.max(1, Math.round(Number(aiInv.score)))))
        : (matchedChannel?.score ?? item.score),
      notes: typeof aiInv?.notes === 'string' && aiInv.notes.trim() ? aiInv.notes : item.notes,
    };
  });

  return {
    businessName: existingReport.businessName,
    generatedAt: new Date().toISOString(),
    overallScore: localOverall.overallScore,
    overallTrafficLight: localOverall.overallTrafficLight,
    executiveSummary:
      typeof parsed.executiveSummary === 'string' && parsed.executiveSummary.trim()
        ? parsed.executiveSummary
        : existingReport.executiveSummary,
    maReadinessNotes:
      typeof parsed.maReadinessNotes === 'string' && parsed.maReadinessNotes.trim()
        ? parsed.maReadinessNotes
        : existingReport.maReadinessNotes,
    channels,
    digitalAssetInventory: inventory,
  };
}
