import { NextRequest } from 'next/server';
import { buildCompetitorAnalysisReport } from '@/lib/competitor-analysis/claude-analyzer';
import { findNearbyCompetitors, inferPetBusinessCategory, lookupSubjectBusiness } from '@/lib/competitor-analysis/google-places';
import { researchWebsite } from '@/lib/competitor-analysis/website-research';
import { CompetitorAnalysisFormData } from '@/lib/competitor-analysis/types';

export const maxDuration = 180;
const DEFAULT_PET_CATEGORY = 'pet store';

function isGenericPetCategory(category: string | undefined): boolean {
  const normalized = (category ?? '').trim().toLowerCase();
  return !normalized
    || normalized === DEFAULT_PET_CATEGORY
    || normalized === 'pet-related business'
    || normalized === 'pet related business'
    || normalized === 'pet business'
    || normalized === 'pets';
}

export async function POST(req: NextRequest) {
  let formData: CompetitorAnalysisFormData;
  try {
    const body = await req.json();
    formData = body?.formData;
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  if (!formData?.businessName?.trim() || !formData?.businessAddress?.trim()) {
    return new Response(
      JSON.stringify({ error: 'Business name and address are required.' }),
      { status: 400 }
    );
  }

  formData = {
    ...formData,
    businessCategory: isGenericPetCategory(formData.businessCategory) ? DEFAULT_PET_CATEGORY : formData.businessCategory.trim(),
  };

  const googleApiKey = process.env.GOOGLE_SERVICES_API;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const tavilyApiKey = process.env.TAVILY_API_KEY;

  if (!googleApiKey || !anthropicApiKey) {
    return new Response(
      JSON.stringify({ error: 'Competitor analysis is not configured correctly.' }),
      { status: 500 }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: object) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Ignore client disconnects.
        }
      }

      try {
        send({
          type: 'progress',
          phase: 'research',
          message: 'Locating the subject business and confirming the market center…',
        });

        const subjectLookup = await lookupSubjectBusiness(formData, googleApiKey);
        const resolvedCategory = isGenericPetCategory(formData.businessCategory)
          ? inferPetBusinessCategory(subjectLookup.subject)
          : formData.businessCategory.trim();

        send({
          type: 'progress',
          phase: 'research',
          message: `Searching for nearby ${resolvedCategory} competitors within ${formData.radiusMiles ?? 5} miles…`,
        });

        const nearby = await findNearbyCompetitors({
          center: subjectLookup.center,
          businessCategory: resolvedCategory,
          apiKey: googleApiKey,
          subjectPlaceId: subjectLookup.subject.placeId,
          subjectName: subjectLookup.subject.name,
          subjectAddress: subjectLookup.subject.address || subjectLookup.formattedAddress,
          limit: 6,
        });

        send({
          type: 'progress',
          phase: 'research',
          message: nearby.competitors.length
            ? `Found ${nearby.discoveredCompetitors} nearby competitors. Gathering website evidence for the strongest matches…`
            : 'No nearby competitors were found from public location data. Building a report from the subject business profile only…',
        });

        const subjectWebsiteResearch = await researchWebsite({
          websiteUrl: subjectLookup.subject.websiteUrl ?? formData.websiteUrl ?? null,
          businessName: formData.businessName,
          businessCategory: resolvedCategory,
          tavilyApiKey,
        });

        const competitorWebsiteEntries = await Promise.all(
          nearby.competitors.map(async (competitor) => [
            competitor.placeId ?? '',
            await researchWebsite({
              websiteUrl: competitor.websiteUrl,
              businessName: competitor.name,
              businessCategory: resolvedCategory,
              tavilyApiKey,
            }),
          ] as const)
        );
        const competitorWebsiteResearch = Object.fromEntries(competitorWebsiteEntries);

        send({
          type: 'progress',
          phase: 'analyze',
          message: 'Synthesizing the competitor comparison, pricing notes, hours overlap, and market positioning…',
        });

        const report = await buildCompetitorAnalysisReport({
          formData: {
            ...formData,
            businessCategory: resolvedCategory,
            radiusMiles: formData.radiusMiles ?? 5,
          },
          subject: subjectLookup.subject,
          subjectWebsiteResearch,
          competitors: nearby.competitors,
          competitorWebsiteResearch,
          discoveredCompetitors: nearby.discoveredCompetitors,
          anthropicApiKey,
        });

        report.discoveredCompetitors = nearby.discoveredItems.map((item) => {
          const researched = report.competitors.find((competitor) => competitor.placeId === item.placeId);
          if (!researched) return item;
          return {
            placeId: researched.placeId,
            name: researched.name,
            address: researched.address,
            location: researched.location,
            rating: researched.rating,
            reviewCount: researched.reviewCount,
            priceLevel: researched.priceLevel,
            websiteUrl: researched.websiteUrl,
            mapsUrl: researched.mapsUrl,
            phoneNumber: researched.phoneNumber,
            businessStatus: researched.businessStatus,
            openNow: researched.openNow,
            weekdayText: researched.weekdayText,
            primaryTypes: researched.primaryTypes,
            distanceMiles: researched.distanceMiles,
            isResearched: true,
          };
        });

        send({ type: 'complete', report });
        controller.close();
      } catch (error) {
        console.error('[Competitor Analysis] Error:', error);
        send({
          type: 'error',
          error: error instanceof Error ? error.message : 'Competitor analysis failed.',
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
