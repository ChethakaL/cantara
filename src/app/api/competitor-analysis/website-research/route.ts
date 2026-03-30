import { NextRequest, NextResponse } from 'next/server';
import { researchWebsite } from '@/lib/competitor-analysis/website-research';

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
        { status: 400 }
      );
    }

    const tavilyApiKey = process.env.TAVILY_API_KEY;
    if (!tavilyApiKey) {
      return NextResponse.json(
        { error: 'TAVILY_API_KEY is not configured.' },
        { status: 500 }
      );
    }

    const research = await researchWebsite({
      websiteUrl,
      businessName,
      businessCategory,
      tavilyApiKey,
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
      { status: 500 }
    );
  }
}
