import { NextRequest, NextResponse } from 'next/server';
import { hasAIConfigured } from "@/lib/ai-client"
import { buildSingleCompetitorReport } from '@/lib/competitor-analysis/claude-analyzer';
import { getPlaceDetails } from '@/lib/competitor-analysis/google-places';
import { researchWebsite } from '@/lib/competitor-analysis/website-research';
import type { BusinessPlaceProfile, CompetitorAnalysisFormData, CompetitorReportItem, SubjectBusinessProfile } from '@/lib/competitor-analysis/types';
import {
  assertOpenAiConfiguredForAnalyze,
  parseAnalyzeProvider,
  resolveAnalyzeModelId,
} from '@/lib/agent-analyze-provider';
import { hasOpenAiConfigured } from '@/lib/openai-client';

type CompetitorResearchRequest = {
  formData: CompetitorAnalysisFormData;
  subject: SubjectBusinessProfile;
  competitor: BusinessPlaceProfile & { distanceMiles: number };
  provider?: unknown;
  modelId?: unknown;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as CompetitorResearchRequest;
    if (!body?.formData?.businessName || !body?.formData?.businessAddress || !body?.competitor?.name) {
      return new Response('Missing required fields', { status: 400 });
    }

    const provider = parseAnalyzeProvider(body.provider);
    const modelId = resolveAnalyzeModelId(provider, body.modelId);
    if (provider === 'openai') {
      const gate = await assertOpenAiConfiguredForAnalyze();
      if (gate) return gate;
    }

    const googleApiKey = process.env.GOOGLE_SERVICES_API;

    const aiConfigured =
      provider === 'openai' ? await hasOpenAiConfigured() : await hasAIConfigured();

    if (!googleApiKey || !aiConfigured) {
      return new Response('Competitor analysis is not configured correctly.', { status: 500 });
    }

    const refreshedCompetitor = body.competitor.placeId
      ? await getPlaceDetails(body.competitor.placeId, googleApiKey)
      : null;

    const competitor = {
      ...(refreshedCompetitor ?? body.competitor),
      distanceMiles: body.competitor.distanceMiles,
    };

    // Prefer Google Places / subject profile URL; fall back to Required Info / form website.
    const subjectWebsiteUrl =
      body.subject.websiteUrl
      ?? body.formData.websiteUrl
      ?? null;

    // Prefer Places website; fall back to a Required Info / top-competitors match by name.
    const manualMatch = (body.formData.manualCompetitors ?? []).find((entry) => {
      const entryName = entry.name?.trim().toLowerCase();
      const competitorName = competitor.name.trim().toLowerCase();
      return Boolean(entryName) && entryName === competitorName;
    });
    const competitorWebsiteUrl =
      competitor.websiteUrl
      || manualMatch?.websiteUrl
      || null;
    if (!competitor.websiteUrl && competitorWebsiteUrl) {
      competitor.websiteUrl = competitorWebsiteUrl;
    }
    if ((!competitor.address || !competitor.address.trim()) && manualMatch?.address?.trim()) {
      competitor.address = manualMatch.address.trim();
    }

    const subjectWebsiteResearch = await researchWebsite({
      websiteUrl: subjectWebsiteUrl,
      businessName: body.formData.businessName,
      businessCategory: body.formData.businessCategory,
    });

    const competitorWebsiteResearch = await researchWebsite({
      websiteUrl: competitorWebsiteUrl,
      businessName: competitor.name,
      businessCategory: body.formData.businessCategory,
    });

    const researchedCompetitor: CompetitorReportItem = await buildSingleCompetitorReport({
      formData: body.formData,
      subject: body.subject,
      subjectWebsiteResearch,
      competitor,
      competitorWebsiteResearch,
      provider,
      modelId,
    });

    return NextResponse.json({ competitor: researchedCompetitor });
  } catch (error) {
    console.error('Failed to research single competitor:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
