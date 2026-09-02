import { requireAIClient, resolveModel } from "@/lib/ai-client";
import type { AgentAiProvider } from "@/lib/agent-model-provider";
import { createAgentMessage } from "@/lib/llm-completion";
import { getActiveAgentProvider } from "@/lib/agent-llm-context";
import {
  BusinessPlaceProfile,
  CompetitorAnalysisFormData,
  CompetitorAnalysisReport,
  CompetitorReportItem,
  DiscoveredCompetitorItem,
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
    reputationSummary?: string;
    websiteConfidence?: 'high' | 'medium' | 'low';
  };
  competitors?: Array<{
    placeId?: string | null;
    similarityLevel?: 'high' | 'medium' | 'low';
    similarityScore?: number;
    similaritySummary?: string;
    serviceComparison?: string;
    reputationComparison?: string;
    services?: string[];
    strengths?: string[];
    gaps?: string[];
    websiteConfidence?: 'high' | 'medium' | 'low';
  }>;
}

const COMPETITOR_ANALYSIS_MODEL = 'claude-sonnet-4-20250514';
const PRIMARY_MAX_TOKENS = 2600;
const RETRY_MAX_TOKENS = 1200;

function clip(text: string | undefined, limit = 240): string {
  return (text ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function dedupePricePoints(points: string[]): string[] {
  const seen = new Set<string>();
  return points.filter((point) => {
    const key = point.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}

function summarizePriceEvidence(research: WebsiteResearchData | null): string | null {
  if (!research?.priceEvidence?.length) return null;
  return research.priceEvidence
    .slice(0, 2)
    .map((item) => clip(item.label, 90))
    .join(' | ');
}

function buildWebsiteSection(label: string, research: WebsiteResearchData | null): string {
  if (!research) {
    return `${label}: No website or website research was available.`;
  }

  const snippets = research.snippets
    .slice(0, 1)
    .map((snippet, index) => [
      `Snippet ${index + 1}`,
      `Title: ${clip(snippet.title, 80)}`,
      `Content: ${clip(snippet.snippet, 140)}`,
    ].join('\n'))
    .join('\n\n');

  return [
    `${label}:`,
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
  const competitorsBlock = args.competitors.slice(0, args.compact ? 4 : 5).map((competitor, index) => {
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
      `Open now: ${competitor.openNow === null ? 'Not found' : competitor.openNow ? 'Yes' : 'No'}`,
      `Website available: ${competitor.websiteUrl ? 'Yes' : 'No'}`,
      `Primary type: ${competitor.primaryTypes[0] ?? 'Not found'}`,
      `Hours summary: ${competitor.weekdayText[0] ?? 'Not found'}`,
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
- Open now: ${args.subject.openNow === null ? 'Not found' : args.subject.openNow ? 'Yes' : 'No'}
- Business status: ${args.subject.businessStatus ?? 'Not found'}
- Website: ${args.subject.websiteUrl ?? 'Not found'}
- Primary types: ${args.subject.primaryTypes.join(', ') || 'Not found'}
- Weekday hours: ${args.subject.weekdayText.join(' | ') || 'Not found'}

${buildWebsiteSection('Subject business website research', args.subjectWebsiteResearch)}

Nearby competitors:
${competitorsBlock || 'No competitors were found.'}

The service categories to focus on are: Dog boarding, Dog daycare, Dog grooming, Dog training, Cat boarding.
For each business, determine which of these five services they offer based on public evidence.

Task:
1. Compare the subject business against the nearby competitors using public data only.
2. Infer service overlap and reputation positioning. Do NOT analyze or compare pricing — pricing is handled by a separate analysis agent.
3. Keep the tone professional, precise, and suitable for an advisor-facing report.
4. Keep all string fields compact. Prefer one sentence per field.

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
      "reputationComparison": "string",
      "services": ["string"],
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
- Do NOT include any pricing analysis, price points, or pricing comparisons. Pricing is handled separately.
- Use short, concrete bullet-style strings inside arrays.
- "similarityScore" must be 1 to 5, where 5 means very direct substitute.
- For the "services" array, use only from: "Dog boarding", "Dog daycare", "Dog grooming", "Dog training", "Cat boarding".
- Keep the total response very compact.
- Use at most 5 services per business (one per category).
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
  prompt: string;
  maxTokens: number;
  provider?: AgentAiProvider;
  modelId?: string;
}) {
  const provider = args.provider ?? getActiveAgentProvider();
  if (provider === 'openai') {
    return createAgentMessage({
      provider,
      model: args.modelId,
      system: '',
      content: args.prompt,
      maxTokens: args.maxTokens,
      temperature: 0,
    });
  }

  const client = await requireAIClient();
  const response = await client.messages.create({
    model: resolveModel(COMPETITOR_ANALYSIS_MODEL),
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

function normalizePricingComparison(text: string | undefined, hasPricePoints: boolean): string {
  const normalized = (text ?? '').trim();
  if (hasPricePoints) {
    return normalized || 'Public pricing details were located on the website.';
  }

  if (!normalized) return 'No public pricing located.';
  if (/\$\$?|\$\$\$/i.test(normalized)) return 'No public pricing located.';
  if (/limited|not fully|could not be verified|visibility was limited/i.test(normalized)) {
    return 'No public pricing located.';
  }
  return normalized;
}

export async function buildCompetitorAnalysisReport(args: {
  formData: CompetitorAnalysisFormData;
  subject: BusinessPlaceProfile;
  subjectWebsiteResearch: WebsiteResearchData | null;
  competitors: Array<BusinessPlaceProfile & { distanceMiles: number }>;
  competitorWebsiteResearch: Record<string, WebsiteResearchData | null>;
  discoveredCompetitors: number;
  provider?: AgentAiProvider;
  modelId?: string;
}): Promise<CompetitorAnalysisReport> {
  const provider = args.provider ?? 'bedrock';
  const prompt = buildPrompt({ ...args, compact: false });

  let parsed: ClaudeOverlayResponse;
  let rawText = '';
  try {
    rawText = await requestOverlay({
      prompt,
      maxTokens: PRIMARY_MAX_TOKENS,
      provider,
      modelId: args.modelId,
    });
    parsed = parseClaudeJson(rawText);
  } catch (error) {
    console.error('[Competitor Analysis] Claude parse failure:', rawText.slice(0, 1200));
    const retryPrompt = [
      buildPrompt({ ...args, compact: true }),
      '',
      'Your previous answer was invalid or truncated.',
      'Return a shorter JSON response now.',
      'Use at most 2 short takeaways, 2 short recommendations, and at most 3 competitors.',
      'Every summary field should be one short sentence.',
      'Use at most 5 services per business (from: Dog boarding, Dog daycare, Dog grooming, Dog training, Cat boarding).',
      'Do NOT include any pricing fields.',
      'Return valid JSON only.',
    ].join('\n');

    try {
      rawText = await requestOverlay({
        prompt: retryPrompt,
        maxTokens: RETRY_MAX_TOKENS,
        provider,
        modelId: args.modelId,
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
    pricingSummary: '',
    pricePoints: [],
    priceEvidence: [],
    hoursSummary: '',
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
      pricingComparison: '',
      hoursComparison: '',
      reputationComparison: overlay?.reputationComparison ?? 'Reputation comparison is based on public rating and review signals.',
      services: overlay?.services ?? [],
      pricePoints: [],
      priceEvidence: [],
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
      competitorsWithPriceSignals: 0,
    },
    clientProfile,
    discoveredCompetitors: competitors.map((item) => ({
      placeId: item.placeId,
      name: item.name,
      address: item.address,
      location: item.location,
      rating: item.rating,
      reviewCount: item.reviewCount,
      priceLevel: item.priceLevel,
      websiteUrl: item.websiteUrl,
      mapsUrl: item.mapsUrl,
      phoneNumber: item.phoneNumber,
      businessStatus: item.businessStatus,
      openNow: item.openNow,
      weekdayText: item.weekdayText,
      primaryTypes: item.primaryTypes,
      distanceMiles: item.distanceMiles,
      isResearched: true,
    })),
    competitors,
  };
}

export async function buildSingleCompetitorReport(args: {
  formData: CompetitorAnalysisFormData;
  subject: BusinessPlaceProfile;
  subjectWebsiteResearch: WebsiteResearchData | null;
  competitor: BusinessPlaceProfile & { distanceMiles: number };
  competitorWebsiteResearch: WebsiteResearchData | null;
  provider?: AgentAiProvider;
  modelId?: string;
}): Promise<CompetitorReportItem> {
  const provider = args.provider ?? 'bedrock';
  const modelId = args.modelId;
  const prompt = buildPrompt({
    formData: args.formData,
    subject: args.subject,
    subjectWebsiteResearch: args.subjectWebsiteResearch,
    competitors: [args.competitor],
    competitorWebsiteResearch: {
      [args.competitor.placeId ?? '']: args.competitorWebsiteResearch,
    },
    compact: true,
  });

  let rawText = '';
  let parsed: ClaudeOverlayResponse;
  try {
    rawText = await requestOverlay({
      prompt,
      maxTokens: 1000,
      provider,
      modelId,
    });
    parsed = parseClaudeJson(rawText);
  } catch {
    rawText = await requestOverlay({
      prompt: `${prompt}\n\nReturn only one competitor object in valid JSON and keep all strings short.`,
      maxTokens: 800,
      provider,
      modelId,
    });
    parsed = parseClaudeJson(rawText);
  }

  const overlay = parsed.competitors?.[0];
  return {
    ...args.competitor,
    similarityLevel: overlay?.similarityLevel ?? 'medium',
    similarityScore: Math.max(1, Math.min(5, Math.round(overlay?.similarityScore ?? 3))),
    similaritySummary: overlay?.similaritySummary ?? 'This business operates in a related local market, but public evidence was limited.',
    serviceComparison: overlay?.serviceComparison ?? 'Service overlap could not be fully verified from public sources.',
    pricingComparison: '',
    hoursComparison: '',
    reputationComparison: overlay?.reputationComparison ?? 'Reputation comparison is based on public rating and review signals.',
    services: overlay?.services ?? [],
    pricePoints: [],
    priceEvidence: [],
    strengths: overlay?.strengths ?? [],
    gaps: overlay?.gaps ?? [],
    websiteConfidence: overlay?.websiteConfidence ?? args.competitorWebsiteResearch?.confidence ?? 'low',
  };
}
