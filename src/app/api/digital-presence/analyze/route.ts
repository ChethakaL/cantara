import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { researchAllChannels } from '@/lib/digital-presence/claude-research';
import { analyzeWithClaude, reanalyzeDigitalPresenceFromEdits } from '@/lib/digital-presence/claude-analyzer';
import { AnalyzeRequestBody, ChannelType, DigitalPresenceReport } from '@/lib/digital-presence/types';
import { findPlaceByText, getPlaceDetails } from '@/lib/competitor-analysis/google-places';
import {
  assertOpenAiConfiguredForAnalyze,
  resolveAnalyzeModelId,
} from '@/lib/agent-analyze-provider';
import { getPlacesApiKey } from '@/lib/secure-settings';
import { prisma } from '@/lib/prisma';
import { collectMarketingApiEvidence, toMarketingResearchResults } from '@/lib/digital-presence/marketing-apis';
import { assertS3Configured, s3BucketName, s3Client } from '@/lib/s3';
import { extractTranscriptText } from '@/lib/sales-review/analyze';

export const maxDuration = 180;

/** Digital Presence is OpenAI-only so web search always runs. */
const DIGITAL_PRESENCE_PROVIDER = 'openai' as const;
const MARKETING_CALL_NOTES_DOCUMENT_ID = 'marketing_call_notes';

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  if (typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray === 'function') {
    return Buffer.from(await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray());
  }
  return Buffer.from(await new Response(body as BodyInit).arrayBuffer());
}

async function loadMarketingCallNotes(clientId: string): Promise<string> {
  const documents = await (prisma as any).clientDocument.findMany({
    where: { clientId, documentId: MARKETING_CALL_NOTES_DOCUMENT_ID },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { fileName: true, mimeType: true, localPath: true, storageBucket: true },
  });
  if (!documents.length) return '';
  assertS3Configured();
  const notes: string[] = [];
  let remainingChars = 240_000;
  for (const document of documents.reverse()) {
    if (!document.localPath) continue;
    const object = await s3Client.send(new GetObjectCommand({
      Bucket: document.storageBucket || s3BucketName,
      Key: document.localPath,
    }));
    const buffer = await bodyToBuffer(object.Body);
    const text = await extractTranscriptText(buffer, document.mimeType || '', document.fileName || 'marketing-call-notes');
    const trimmed = text.trim();
    if (!trimmed) throw new Error(`No readable text could be extracted from marketing call notes file “${document.fileName}”. Please use a text-based PDF, Word document, or .txt file.`);
    if (remainingChars <= 0) break;
    notes.push(`### ${document.fileName || 'Advisor call notes'}\n${trimmed.slice(0, remainingChars)}`);
    remainingChars -= trimmed.length;
  }
  return notes.join('\n\n');
}

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

  const { formData, clientId, modelId: requestedModelId, reanalyzeFromEdits, existingReport } = body;
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

  let enrichedFormData = { ...formData };
  if (clientId && req.cookies.get('cantara_role')?.value?.toLowerCase() === 'admin' && /^[a-zA-Z0-9_-]{1,100}$/.test(clientId)) {
    try {
      const client = await (prisma as any).clientProfile.findUnique({
        where: { id: clientId },
        select: { businessAddress: true, businessCategory: true, sectionSubmissions: true },
      });
      const submissions = (client?.sectionSubmissions ?? {}) as Record<string, any>;
      const responses = (submissions.agentFormResponses ?? {}) as Record<string, unknown>;
      const marketingFieldKeys = [
        'marketingReportingPeriod', 'marketingChannelsAndSpend', 'marketingChannelResults',
        'marketingReferralPartners', 'marketingEmailProgram', 'marketingBookingFunnel',
        'marketingPeopleAndVendors', 'marketingAccountOwnership', 'marketingReviewManagement',
        'marketingPlanAndBudget',
      ];
      const marketingIntake = Object.fromEntries(marketingFieldKeys.flatMap(key => {
        const value = responses[key];
        return typeof value === 'string' && value.trim() ? [[key, value.slice(0, 12000)]] : [];
      }));
      enrichedFormData = {
        ...enrichedFormData,
        businessAddress: enrichedFormData.businessAddress || client?.businessAddress || undefined,
        businessCategory: enrichedFormData.businessCategory || client?.businessCategory || undefined,
        marketingIntake: { ...marketingIntake, ...(enrichedFormData.marketingIntake ?? {}) },
      };
    } catch (err) {
      console.warn('[Marketing Agent] Could not load saved client intake; proceeding with submitted digital inputs.');
    }
    try {
      enrichedFormData.marketingCallNotes = await loadMarketingCallNotes(clientId);
      if (enrichedFormData.marketingCallNotes) {
        console.info('[Marketing Agent] Loaded advisor call notes for analysis', {
          clientId,
          chars: enrichedFormData.marketingCallNotes.length,
        });
      }
    } catch (err) {
      console.error('[Marketing Agent] Could not load advisor call notes:', err);
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not read the uploaded marketing call notes.' }, { status: 400 });
    }
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
          enrichedFormData,
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

        send({ type: 'progress', phase: 'research', message: 'Checking local search visibility and website performance…' });
        const apiEvidence = await collectMarketingApiEvidence(enrichedFormData);
        for (const evidence of apiEvidence) {
          const progressLabels: Record<string, string> = {
            'DataForSEO Google Maps local results': 'Nearby local businesses',
            'Google organic search visibility': 'Website visibility in Google search',
            'Google PageSpeed Insights': 'Website speed and quality',
            'Chrome UX Report (CrUX)': 'Real visitor website experience',
          };
          send({ type: 'progress', phase: 'research', message: `${progressLabels[evidence.source] ?? evidence.source}: ${evidence.status === 'connected' ? 'retrieved' : evidence.status === 'skipped' ? 'not available' : 'could not retrieve'}` });
          const channelType: ChannelType = evidence.source.includes('Google Business Profile') || evidence.source === 'DataForSEO Google Maps local results'
            ? 'google_business'
            : 'website';
          let channel = researchData.find(item => item.channelType === channelType);
          if (!channel && evidence.status === 'connected') {
            channel = { channelType, inputUrl: evidence.url, searchQueries: [], results: [] };
            researchData.push(channel);
          }
          if (channel) channel.results.push(...toMarketingResearchResults([evidence]));
        }

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
            const searchQuery = enrichedFormData.businessAddress
              ? `${enrichedFormData.businessName} ${enrichedFormData.businessAddress}`
              : enrichedFormData.businessName;
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

        const analyzedReport = await analyzeWithClaude(enrichedFormData, researchData, { provider, modelId });
        const report = {
          ...analyzedReport,
          marketingIntake: enrichedFormData.marketingIntake ?? {},
          marketingEvidence: apiEvidence,
        };
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
