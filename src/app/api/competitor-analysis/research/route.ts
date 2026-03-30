import { NextRequest, NextResponse } from 'next/server';
import { buildSingleCompetitorReport } from '@/lib/competitor-analysis/claude-analyzer';
import { getPlaceDetails } from '@/lib/competitor-analysis/google-places';
import { researchWebsite } from '@/lib/competitor-analysis/website-research';
import type { BusinessPlaceProfile, CompetitorAnalysisFormData, CompetitorReportItem, SubjectBusinessProfile } from '@/lib/competitor-analysis/types';

type CompetitorResearchRequest = {
  formData: CompetitorAnalysisFormData;
  subject: SubjectBusinessProfile;
  competitor: BusinessPlaceProfile & { distanceMiles: number };
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as CompetitorResearchRequest;
    if (!body?.formData?.businessName || !body?.formData?.businessAddress || !body?.competitor?.name) {
      return new Response('Missing required fields', { status: 400 });
    }

    const googleApiKey = process.env.GOOGLE_SERVICES_API;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    const tavilyApiKey = process.env.TAVILY_API_KEY;

    if (!googleApiKey || !anthropicApiKey) {
      return new Response('Competitor analysis is not configured correctly.', { status: 500 });
    }

    const refreshedCompetitor = body.competitor.placeId
      ? await getPlaceDetails(body.competitor.placeId, googleApiKey)
      : null;

    const competitor = {
      ...(refreshedCompetitor ?? body.competitor),
      distanceMiles: body.competitor.distanceMiles,
    };

    const subjectWebsiteResearch = await researchWebsite({
      websiteUrl: body.subject.websiteUrl ?? body.formData.websiteUrl ?? null,
      businessName: body.formData.businessName,
      businessCategory: body.formData.businessCategory,
      tavilyApiKey,
    });

    const competitorWebsiteResearch = await researchWebsite({
      websiteUrl: competitor.websiteUrl,
      businessName: competitor.name,
      businessCategory: body.formData.businessCategory,
      tavilyApiKey,
    });

    const researchedCompetitor: CompetitorReportItem = await buildSingleCompetitorReport({
      formData: body.formData,
      subject: body.subject,
      subjectWebsiteResearch,
      competitor,
      competitorWebsiteResearch,
      anthropicApiKey,
    });

    return NextResponse.json({ competitor: researchedCompetitor });
  } catch (error) {
    console.error('Failed to research single competitor:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
