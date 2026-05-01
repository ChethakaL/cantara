import { NextRequest } from 'next/server';
import { researchAllChannels } from '@/lib/digital-presence/claude-research';
import { analyzeWithClaude } from '@/lib/digital-presence/claude-analyzer';
import { AnalyzeRequestBody, ChannelType } from '@/lib/digital-presence/types';

export const maxDuration = 180;

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
  let body: AnalyzeRequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const { formData } = body;

  if (!formData?.businessName?.trim()) {
    return new Response(JSON.stringify({ error: 'Business name is required.' }), { status: 400 });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured.' }), { status: 500 });
  }

  // Kept for interface compatibility with researchAllChannels signature
  const tavilyKey = anthropicKey;

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
      { status: 400 }
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

        // Count channels upfront so we can show accurate totals
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
          }
        );

        // After research, count what was actually found
        const foundCount = researchData.filter(r => r.results.length > 0).length;
        console.log(`[Digital Presence] Research done. ${foundCount}/${researchData.length} channels with data.`);

        send({
          type: 'progress',
          phase: 'analyze',
          message: `Research complete. Running AI scoring across ${researchData.length} channel${researchData.length !== 1 ? 's' : ''}…`,
          completed: researchData.length,
          total: researchData.length,
        });

        const report = await analyzeWithClaude(formData, researchData, anthropicKey);
        console.log(`[Digital Presence] Analysis done. Overall: ${report.overallScore}`);

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
