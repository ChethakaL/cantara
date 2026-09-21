import { NextRequest, NextResponse } from 'next/server';
import { researchAllChannels } from '@/lib/digital-presence/claude-research';
import { analyzeWithClaude, reanalyzeDigitalPresenceFromEdits } from '@/lib/digital-presence/claude-analyzer';
import { AnalyzeRequestBody, ChannelType, DigitalPresenceReport } from '@/lib/digital-presence/types';
import { findPlaceByText, getPlaceDetails } from '@/lib/competitor-analysis/google-places';
import {
  assertOpenAiConfiguredForAnalyze,
  resolveAnalyzeModelId,
} from '@/lib/agent-analyze-provider';
import { getPlacesApiKey } from '@/lib/secure-settings';

export const maxDuration = 180;

/** Digital Presence is OpenAI-only so web search always runs. */
const DIGITAL_PRESENCE_PROVIDER = 'openai' as const;

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

export async function POST(req: NextRequest) {
  let body: AnalyzeRequestBody & { modelId?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const { formData, modelId: requestedModelId, reanalyzeFromEdits, existingReport } = body;
  const provider = DIGITAL_PRESENCE_PROVIDER;
  const modelId = resolveAnalyzeModelId(provider, requestedModelId);

  const gate = await assertOpenAiConfiguredForAnalyze();
  if (gate) return gate;

  // Edit-aware path: no web research — rewrite analysis from advisor-edited metrics.
  if (reanalyzeFromEdits) {
    if (!existingReport || typeof existingReport !== 'object' || !Array.isArray(existingReport.channels)) {
      return NextResponse.json({ error: 'reanalyzeFromEdits requires existingReport with channels.' }, { status: 400 });
    }
    try {
      const report = await reanalyzeDigitalPresenceFromEdits(existingReport as DigitalPresenceReport, {
        provider,
        modelId,
      });
      return NextResponse.json({ report });
    } catch (err: any) {
      console.error('[Digital Presence] Reanalyze error:', err);
      return NextResponse.json({ error: err?.message ?? 'Reanalyze failed.' }, { status: 500 });
    }
  }

  if (!formData?.businessName?.trim()) {
    return new Response(JSON.stringify({ error: 'Business name is required.' }), { status: 400 });
  }

  const tavilyKey = process.env.TAVILY_API_KEY || '';

  const hasAtLeastOneChannel =
    formData.websiteUrl ||
    formData.googleBusinessProfileUrl ||
    formData.facebookHandle ||
    formData.instagramHandle ||
    formData.tiktokHandle ||
    formData.bookingPlatformUrl ||
    formData.yelpUrl ||
    formData.nextdoorUrl ||
    formData.linkedinUrl ||
    formData.glassdoorUrl ||
    formData.bbbUrl;

  if (!hasAtLeastOneChannel) {
    return new Response(
      JSON.stringify({ error: 'Please provide at least one digital channel to analyse.' }),
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: object) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // client disconnected
        }
      }

      try {
        console.log(`[Digital Presence] Starting for: ${formData.businessName}`);

        const channelCount = [
          formData.websiteUrl,
          formData.googleBusinessProfileUrl,
          formData.facebookHandle,
          formData.instagramHandle,
          formData.tiktokHandle,
          formData.bookingPlatformUrl,
          formData.yelpUrl || formData.nextdoorUrl,
          formData.linkedinUrl || formData.glassdoorUrl || formData.bbbUrl,
        ].filter(Boolean).length;

        send({
          type: 'progress',
          phase: 'research',
          message: `Starting web research across ${channelCount} channel${channelCount !== 1 ? 's' : ''}…`,
          completed: 0,
          total: channelCount,
        });

        const researchData = await researchAllChannels(
          formData,
          tavilyKey,
          (channelType, channelLabel, completed, total) => {
            const label = CHANNEL_LABELS[channelType] ?? channelLabel;
            send({
              type: 'progress',
              phase: 'research',
              message: `${label} researched (${completed}/${total})`,
              channelType,
              channelLabel: label,
              completed,
              total,
            });
          },
          { provider, modelId },
        );

        const googleApiKey = await getPlacesApiKey();
        if (!googleApiKey) {
          send({
            type: 'progress',
            phase: 'research',
            message: 'Google Places API key is not set (Admin Settings) — skipping Places verification.',
          });
        }
        if (googleApiKey) {
          try {
            const searchQuery = (formData as any).businessAddress
              ? `${formData.businessName} ${(formData as any).businessAddress}`
              : formData.businessName;
            const placeMatch = await findPlaceByText(searchQuery, googleApiKey);
            if (placeMatch?.placeId) {
              const placeDetails = await getPlaceDetails(placeMatch.placeId, googleApiKey);
              if (placeDetails) {
                const verifiedContent = [
                  `[VERIFIED DATA from Google Places API]`,
                  `Business: ${placeDetails.name}`,
                  `Address: ${placeDetails.address}`,
                  placeDetails.rating != null ? `Rating: ${placeDetails.rating} stars` : null,
                  placeDetails.reviewCount != null ? `Total Reviews: ${placeDetails.reviewCount}` : null,
                  placeDetails.phoneNumber ? `Phone: ${placeDetails.phoneNumber}` : null,
                  placeDetails.websiteUrl ? `Website: ${placeDetails.websiteUrl}` : null,
                  placeDetails.businessStatus ? `Status: ${placeDetails.businessStatus}` : null,
                  placeDetails.openNow != null ? `Currently Open: ${placeDetails.openNow ? 'Yes' : 'No'}` : null,
                ].filter(Boolean).join('\n');

                const gbChannel = researchData.find((r) => r.channelType === 'google_business');
                if (gbChannel) {
                  gbChannel.results.unshift({
                    title: `[VERIFIED] ${placeDetails.name} - Google Business Profile`,
                    url: placeDetails.mapsUrl || `https://www.google.com/maps/place/?q=place_id:${placeDetails.placeId}`,
                    content: verifiedContent,
                    score: 1.0,
                  });
                }
              }
            }
          } catch (err) {
            console.warn('[Digital Presence] Google Places verification failed (non-fatal):', err);
          }
        }

        send({
          type: 'progress',
          phase: 'analyze',
          message: `Research complete. Running AI scoring across ${researchData.length} channel${researchData.length !== 1 ? 's' : ''}…`,
          completed: researchData.length,
          total: researchData.length,
        });

        const report = await analyzeWithClaude(formData, researchData, { provider, modelId });
        send({ type: 'complete', report });
        controller.close();
      } catch (err: any) {
        console.error('[Digital Presence] Error:', err);
        send({ type: 'error', error: err?.message ?? 'An unexpected error occurred.' });
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
