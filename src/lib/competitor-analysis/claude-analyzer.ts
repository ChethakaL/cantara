import Anthropic from '@anthropic-ai/sdk';
import {
  BusinessPlaceProfile,
  CompetitorAnalysisFormData,
  CompetitorAnalysisReport,
  CompetitorReportItem,
  SubjectBusinessProfile,
  WebsiteResearchData,
} from './types';

interface ClaudeOverlayResponse {
  executiveSummary?: string;
  marketSummary?: string;
  positioningSummary?: string;
  keyTakeaways?: string[];
  recommendations?: string[];
  clientProfile?: {
    serviceSummary?: string;
    services?: string[];
    pricingSummary?: string;
    pricePoints?: string[];
    hoursSummary?: string;
    reputationSummary?: string;
    websiteConfidence?: 'high' | 'medium' | 'low';
  };
  competitors?: Array<{
    placeId?: string | null;
    similarityLevel?: 'high' | 'medium' | 'low';
    similarityScore?: number;
    similaritySummary?: string;
    serviceComparison?: string;
    pricingComparison?: string;
    hoursComparison?: string;
    reputationComparison?: string;
    services?: string[];
    pricePoints?: string[];
    strengths?: string[];
    gaps?: string[];
    websiteConfidence?: 'high' | 'medium' | 'low';
  }>;
}

const COMPETITOR_ANALYSIS_MODEL = 'claude-sonnet-4-20250514';
const PRIMARY_MAX_TOKENS = 2200;
const RETRY_MAX_TOKENS = 1400;

function clip(text: string | undefined, limit = 240): string {
  return (text ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function buildWebsiteSection(label: string, research: WebsiteResearchData | null): string {
  if (!research) {
    return `${label}: No website or website research was available.`;
  }

  const snippets = research.snippets
    .slice(0, 2)
    .map((snippet, index) => [
      `Snippet ${index + 1}`,
      `Title: ${clip(snippet.title, 80)}`,
      `Content: ${clip(snippet.snippet, 240)}`,
    ].join('\n'))
    .join('\n\n');

  return [
    `${label}:`,
    `Website: ${research.websiteUrl}`,
    `Confidence: ${research.confidence}`,
    research.error ? `Research note: ${research.error}` : null,
    snippets || 'No usable snippets found.',
  ].filter(Boolean).join('\n');
}

function buildPrompt(args: {
  formData: CompetitorAnalysisFormData;
  subject: BusinessPlaceProfile;
  subjectWebsiteResearch: WebsiteResearchData | null;
  competitors: Array<BusinessPlaceProfile & { distanceMiles: number }>;
  competitorWebsiteResearch: Record<string, WebsiteResearchData | null>;
  compact?: boolean;
}): string {
  const competitorsBlock = args.competitors.slice(0, args.compact ? 5 : 6).map((competitor, index) => {
    const websiteSection = buildWebsiteSection(
      `${competitor.name} website research`,
      args.competitorWebsiteResearch[competitor.placeId ?? ''] ?? null
    );

    return [
      `Competitor ${index + 1}: ${competitor.name}`,
      `placeId: ${competitor.placeId ?? 'unknown'}`,
      `Address: ${competitor.address || 'Not found'}`,
      `Distance: ${competitor.distanceMiles.toFixed(2)} miles`,
      `Rating: ${competitor.rating ?? 'Not found'}`,
      `Review count: ${competitor.reviewCount ?? 'Not found'}`,
      `Price level: ${competitor.priceLevel ?? 'Not found'}`,
      `Open now: ${competitor.openNow === null ? 'Not found' : competitor.openNow ? 'Yes' : 'No'}`,
      `Business status: ${competitor.businessStatus ?? 'Not found'}`,
      `Website: ${competitor.websiteUrl ?? 'Not found'}`,
      `Primary types: ${competitor.primaryTypes.join(', ') || 'Not found'}`,
      `Weekday hours: ${competitor.weekdayText.join(' | ') || 'Not found'}`,
      websiteSection,
    ].join('\n');
  }).join('\n\n---\n\n');

  return `
You are a business-sale readiness analyst preparing a professional competitor analysis report for an advisor dashboard.

Business under review:
- Name: ${args.formData.businessName}
- Address: ${args.formData.businessAddress}
- Category: ${args.formData.businessCategory}
- Search radius: ${args.formData.radiusMiles ?? 5} miles

Subject business public profile:
- placeId: ${args.subject.placeId ?? 'unknown'}
- Name: ${args.subject.name}
- Address: ${args.subject.address || args.formData.businessAddress}
- Rating: ${args.subject.rating ?? 'Not found'}
- Review count: ${args.subject.reviewCount ?? 'Not found'}
- Price level: ${args.subject.priceLevel ?? 'Not found'}
- Open now: ${args.subject.openNow === null ? 'Not found' : args.subject.openNow ? 'Yes' : 'No'}
- Business status: ${args.subject.businessStatus ?? 'Not found'}
- Website: ${args.subject.websiteUrl ?? 'Not found'}
- Primary types: ${args.subject.primaryTypes.join(', ') || 'Not found'}
- Weekday hours: ${args.subject.weekdayText.join(' | ') || 'Not found'}

${buildWebsiteSection('Subject business website research', args.subjectWebsiteResearch)}

Nearby competitors:
${competitorsBlock || 'No competitors were found.'}

Task:
1. Compare the subject business against the nearby competitors using public data only.
2. Infer service overlap, pricing transparency, pricing level signals, operating-hour overlap, and reputation positioning.
3. If a website does not clearly publish prices, say so directly. Do not invent prices.
4. Keep the tone professional, precise, and suitable for an advisor-facing report.
5. Keep all string fields compact. Prefer one sentence per field.

Return ONLY valid JSON with this exact structure:
{
  "executiveSummary": "string",
  "marketSummary": "string",
  "positioningSummary": "string",
  "keyTakeaways": ["string"],
  "recommendations": ["string"],
  "clientProfile": {
    "serviceSummary": "string",
    "services": ["string"],
    "pricingSummary": "string",
    "pricePoints": ["string"],
    "hoursSummary": "string",
    "reputationSummary": "string",
    "websiteConfidence": "high|medium|low"
  },
  "competitors": [
    {
      "placeId": "string",
      "similarityLevel": "high|medium|low",
      "similarityScore": 1,
      "similaritySummary": "string",
      "serviceComparison": "string",
      "pricingComparison": "string",
      "hoursComparison": "string",
      "reputationComparison": "string",
      "services": ["string"],
      "pricePoints": ["string"],
      "strengths": ["string"],
      "gaps": ["string"],
      "websiteConfidence": "high|medium|low"
    }
  ]
}

Rules:
- Keep every statement tied to the supplied public evidence.
- Do not mention data providers, search tools, APIs, or model names.
- Do not output markdown.
- Use short, concrete bullet-style strings inside arrays.
- "similarityScore" must be 1 to 5, where 5 means very direct substitute.
- If pricing is not visible, say "No public pricing located" or similar rather than guessing.
- Keep the total response short enough to fit comfortably inside a small JSON payload.
  `.trim();
}

function parseClaudeJson(rawText: string): ClaudeOverlayResponse {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  return JSON.parse(cleaned) as ClaudeOverlayResponse;
}

async function requestOverlay(args: {
  client: Anthropic;
  prompt: string;
  maxTokens: number;
}) {
  const response = await args.client.messages.create({
    model: COMPETITOR_ANALYSIS_MODEL,
    max_tokens: args.maxTokens,
    temperature: 0,
    messages: [{ role: 'user', content: args.prompt }],
  });

  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { text: string }).text)
    .join('');
}

function average(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => typeof value === 'number');
  if (!valid.length) return null;
  return Number((valid.reduce((sum, value) => sum + value, 0) / valid.length).toFixed(1));
}

export async function buildCompetitorAnalysisReport(args: {
  formData: CompetitorAnalysisFormData;
  subject: BusinessPlaceProfile;
  subjectWebsiteResearch: WebsiteResearchData | null;
  competitors: Array<BusinessPlaceProfile & { distanceMiles: number }>;
  competitorWebsiteResearch: Record<string, WebsiteResearchData | null>;
  discoveredCompetitors: number;
  anthropicApiKey: string;
}): Promise<CompetitorAnalysisReport> {
  const client = new Anthropic({ apiKey: args.anthropicApiKey });
  const prompt = buildPrompt({ ...args, compact: false });

  let parsed: ClaudeOverlayResponse;
  let rawText = '';
  try {
    rawText = await requestOverlay({
      client,
      prompt,
      maxTokens: PRIMARY_MAX_TOKENS,
    });
    parsed = parseClaudeJson(rawText);
  } catch (error) {
    console.error('[Competitor Analysis] Claude parse failure:', rawText.slice(0, 1200));
    const retryPrompt = [
      buildPrompt({ ...args, compact: true }),
      '',
      'Your previous answer was invalid or truncated.',
      'Return a shorter JSON response now.',
      'Use at most 2 short takeaways, 2 short recommendations, and at most 4 competitors.',
      'Every summary field should be one short sentence.',
      'Return valid JSON only.',
    ].join('\n');

    try {
      rawText = await requestOverlay({
        client,
        prompt: retryPrompt,
        maxTokens: RETRY_MAX_TOKENS,
      });
      parsed = parseClaudeJson(rawText);
    } catch (retryError) {
      console.error('[Competitor Analysis] Claude retry parse failure:', rawText.slice(0, 1200));
      throw new Error('The competitor analysis report could not be generated cleanly. Please retry.');
    }
  }

  const overlayByPlaceId = new Map(
    (parsed.competitors ?? []).map((item) => [item.placeId ?? '', item])
  );

  const clientProfile: SubjectBusinessProfile = {
    ...args.subject,
    serviceSummary: parsed.clientProfile?.serviceSummary ?? 'Public sources did not clearly describe the full service mix.',
    services: parsed.clientProfile?.services ?? [],
    pricingSummary: parsed.clientProfile?.pricingSummary ?? 'No detailed public pricing was confirmed.',
    pricePoints: parsed.clientProfile?.pricePoints ?? [],
    hoursSummary: parsed.clientProfile?.hoursSummary ?? 'Public hours information was limited.',
    reputationSummary: parsed.clientProfile?.reputationSummary ?? 'Public reputation signals were limited.',
    websiteConfidence: parsed.clientProfile?.websiteConfidence ?? args.subjectWebsiteResearch?.confidence ?? 'low',
  };

  const competitors: CompetitorReportItem[] = args.competitors.map((competitor) => {
    const overlay = overlayByPlaceId.get(competitor.placeId ?? '');
    return {
      ...competitor,
      similarityLevel: overlay?.similarityLevel ?? 'medium',
      similarityScore: Math.max(1, Math.min(5, Math.round(overlay?.similarityScore ?? 3))),
      similaritySummary: overlay?.similaritySummary ?? 'This business operates in a related local market, but public evidence was limited.',
      serviceComparison: overlay?.serviceComparison ?? 'Service overlap could not be fully verified from public sources.',
      pricingComparison: overlay?.pricingComparison ?? 'Pricing visibility was limited across public sources.',
      hoursComparison: overlay?.hoursComparison ?? 'Hours overlap could not be fully verified from public sources.',
      reputationComparison: overlay?.reputationComparison ?? 'Reputation comparison is based on public rating and review signals.',
      services: overlay?.services ?? [],
      pricePoints: overlay?.pricePoints ?? [],
      strengths: overlay?.strengths ?? [],
      gaps: overlay?.gaps ?? [],
      websiteConfidence: overlay?.websiteConfidence ?? args.competitorWebsiteResearch[competitor.placeId ?? '']?.confidence ?? 'low',
    };
  });

  const closest = competitors[0] ?? null;

  return {
    businessName: args.formData.businessName,
    businessAddress: args.subject.address || args.formData.businessAddress,
    businessCategory: args.formData.businessCategory,
    radiusMiles: args.formData.radiusMiles ?? 5,
    generatedAt: new Date().toISOString(),
    searchCenter: args.subject.location,
    executiveSummary: parsed.executiveSummary ?? 'A competitor report was generated from public local-market signals.',
    marketSummary: parsed.marketSummary ?? 'The local competitive set was reviewed using public location, reputation, hours, and website evidence.',
    positioningSummary: parsed.positioningSummary ?? 'Positioning conclusions were based on the publicly observable market footprint.',
    keyTakeaways: parsed.keyTakeaways?.length ? parsed.keyTakeaways : ['Public local-market evidence was limited, so several findings should be treated as directional.'],
    recommendations: parsed.recommendations?.length ? parsed.recommendations : ['Validate service and pricing differentiation directly before buyer-facing use.'],
    marketStats: {
      discoveredCompetitors: args.discoveredCompetitors,
      analyzedCompetitors: competitors.length,
      averageCompetitorRating: average(competitors.map((item) => item.rating)),
      averageCompetitorReviewCount: average(competitors.map((item) => item.reviewCount)),
      closestCompetitorName: closest?.name ?? null,
      closestCompetitorDistanceMiles: closest ? Number(closest.distanceMiles.toFixed(2)) : null,
      highSimilarityCount: competitors.filter((item) => item.similarityLevel === 'high').length,
      competitorsWithWebsite: competitors.filter((item) => Boolean(item.websiteUrl)).length,
      competitorsWithPriceSignals: competitors.filter((item) => item.pricePoints.length > 0).length,
    },
    clientProfile,
    competitors,
  };
}
