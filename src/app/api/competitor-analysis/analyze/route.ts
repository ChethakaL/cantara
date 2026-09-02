import { NextRequest } from 'next/server';
import { hasAIConfigured } from "@/lib/ai-client"
import { buildCompetitorAnalysisReport } from '@/lib/competitor-analysis/claude-analyzer';
import { findNearbyCompetitors, lookupSpecifiedCompetitors, inferPetBusinessCategory, lookupSubjectBusiness } from '@/lib/competitor-analysis/google-places';
import { researchWebsite } from '@/lib/competitor-analysis/website-research';
import { CompetitorAnalysisFormData } from '@/lib/competitor-analysis/types';
import {
  assertOpenAiConfiguredForAnalyze,
  parseAnalyzeProvider,
  resolveAnalyzeModelId,
} from '@/lib/agent-analyze-provider';
import { hasOpenAiConfigured } from '@/lib/openai-client';

export const maxDuration = 180;
const DEFAULT_PET_CATEGORY = 'pet resort';

function isGenericPetCategory(category: string | undefined): boolean {
  const normalized = (category ?? '').trim().toLowerCase();
  return !normalized
    || normalized === 'pet store'
    || normalized === 'pet-related business'
    || normalized === 'pet related business'
    || normalized === 'pet business'
    || normalized === 'pets';
}

export async function POST(req: NextRequest) {
  let formData: CompetitorAnalysisFormData;
  let rawProvider: unknown;
  let requestedModelId: unknown;
  try {
    const body = await req.json();
    formData = body?.formData;
    rawProvider = body?.provider;
    requestedModelId = body?.modelId;
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const provider = parseAnalyzeProvider(rawProvider);
  const modelId = resolveAnalyzeModelId(provider, requestedModelId);

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
  const tavilyApiKey = process.env.TAVILY_API_KEY;
  const aiConfigured =
    provider === 'openai' ? await hasOpenAiConfigured() : await hasAIConfigured();

  if (!googleApiKey || !aiConfigured) {
    return new Response(
      JSON.stringify({ error: 'Competitor analysis is not configured correctly.' }),
      { status: 500 }
    );
  }

  if (provider === 'openai') {
    const gate = await assertOpenAiConfiguredForAnalyze();
    if (gate) return gate;
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

        const hasManualCompetitors = formData.manualCompetitors && formData.manualCompetitors.filter(c => c.name.trim()).length > 0;

        // Always run radius-based discovery first
        send({
          type: 'progress',
          phase: 'research',
          message: `Searching for nearby ${resolvedCategory} competitors within ${formData.radiusMiles ?? 5} miles…`,
        });

        let nearby = await findNearbyCompetitors({
          center: subjectLookup.center,
          businessCategory: resolvedCategory,
          apiKey: googleApiKey,
          subjectPlaceId: subjectLookup.subject.placeId,
          subjectName: subjectLookup.subject.name,
          subjectAddress: subjectLookup.subject.address || subjectLookup.formattedAddress,
          limit: 12,
          radiusMiles: formData.radiusMiles ?? 5,
        });

        send({
          type: 'progress',
          phase: 'research',
          message: nearby.competitors.length
            ? `Found ${nearby.discoveredCompetitors} nearby competitors. Gathering website evidence for the closest matches and mapping all discovered competitors…`
            : 'No nearby competitors were found from public location data.',
        });

        // If manual competitors exist, look them up and merge on top
        if (hasManualCompetitors) {
          const validCompetitors = formData.manualCompetitors!.filter(c => c.name.trim());
          send({
            type: 'progress',
            phase: 'research',
            message: `Looking up ${validCompetitors.length} specified competitor${validCompetitors.length === 1 ? '' : 's'}…`,
          });

          const manual = await lookupSpecifiedCompetitors({
            competitors: validCompetitors,
            center: subjectLookup.center,
            apiKey: googleApiKey,
            radiusMiles: formData.radiusMiles ?? 5,
          });

          if (manual.rejectedCompetitors.length > 0) {
            send({
              type: 'progress',
              phase: 'research',
              message: `Rejected ${manual.rejectedCompetitors.length} competitor${manual.rejectedCompetitors.length === 1 ? '' : 's'}: ${manual.rejectedCompetitors.map(r => `${r.name} (${r.reason})`).join(', ')}`,
            });
          }

          // Merge manual competitors into the radius discovery results
          const existingPlaceIds = new Set(nearby.competitors.map(c => c.placeId).filter(Boolean));
          const newManualCompetitors = manual.competitors.filter(c => !existingPlaceIds.has(c.placeId));
          nearby = {
            competitors: [...manual.competitors, ...nearby.competitors.filter(c => !manual.competitors.some(m => m.placeId === c.placeId))],
            discoveredCompetitors: nearby.discoveredCompetitors + newManualCompetitors.length,
            discoveredItems: [...manual.discoveredItems, ...nearby.discoveredItems.filter(d => !manual.discoveredItems.some(m => m.placeId === d.placeId))],
          };

          send({
            type: 'progress',
            phase: 'research',
            message: manual.competitors.length
              ? `Found ${manual.competitors.length} of ${validCompetitors.length} specified competitors. Gathering website evidence…`
              : 'Could not locate any of the specified competitors. Proceeding with radius discovery results…',
          });
        }

        // Limit deep-dive comparisons to only the 5 closest competitors listed by the client (or radius closest)
        nearby.competitors = nearby.competitors.slice(0, 5);

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
          message: 'Synthesizing the competitor comparison, service overlap, and market positioning…',
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
          provider,
          modelId,
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
