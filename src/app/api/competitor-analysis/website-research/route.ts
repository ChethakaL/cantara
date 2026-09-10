import { NextRequest, NextResponse } from 'next/server';
import { researchWebsite } from '@/lib/competitor-analysis/website-research';
import { hasOpenAiConfigured } from '@/lib/openai-client';

type WebsiteResearchRequest = {
  websiteUrl?: string | null;
  businessName: string;
  businessCategory?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as WebsiteResearchRequest;
    const businessName = (body.businessName ?? '').trim();
    const businessCategory = (body.businessCategory ?? 'pet store').trim() || 'pet store';
    const websiteUrl = (body.websiteUrl ?? '').trim();

    if (!businessName || !websiteUrl) {
      return NextResponse.json(
        { error: 'businessName and websiteUrl are required.' },
        { status: 400 },
      );
    }

    if (!(await hasOpenAiConfigured())) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured in Settings.' },
        { status: 500 },
      );
    }

    const research = await researchWebsite({
      websiteUrl,
      businessName,
      businessCategory,
    });

    return NextResponse.json({
      ok: true,
      input: { businessName, businessCategory, websiteUrl },
      research,
      metrics: {
        snippets: research?.snippets.length ?? 0,
        priceEvidence: research?.priceEvidence.length ?? 0,
        pricePoints: research?.pricePoints.length ?? 0,
      },
    });
  } catch (error) {
    console.error('[WebsiteResearch API] request failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 },
    );
  }
}
