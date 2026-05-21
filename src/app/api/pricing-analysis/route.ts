import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { analyzePricing } from '@/lib/pricing-analysis/analyze'
import type { CompetitorPricingInput } from '@/lib/pricing-analysis/types'
import { normalizePricingReport } from '@/lib/pricing-analysis/normalize-report'
import { researchWebsite } from '@/lib/competitor-analysis/website-research'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normalizeCompetitorInput(item: any): CompetitorPricingInput | null {
  const name = String(item?.name ?? '').trim()
  const websiteUrl = String(item?.websiteUrl ?? '').trim()
  const manualPricingText = String(item?.manualPricingText ?? '').trim()
  if (!name || !websiteUrl) return null
  return { name, websiteUrl, ...(manualPricingText ? { manualPricingText } : {}) }
}

function extractCompetitorsFromReport(parsed: any): CompetitorPricingInput[] {
  return (parsed?.competitors ?? [])
    .map((c: any) => normalizeCompetitorInput({ name: c.name, websiteUrl: c.websiteUrl }))
    .filter(Boolean)
    .slice(0, 5) as CompetitorPricingInput[]
}

export async function GET(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('clientId')
    if (!clientId) {
      return new Response('Missing clientId', { status: 400 })
    }

    const includePrefill = req.nextUrl.searchParams.get('includePrefill') === '1'
    const client = await (prisma as any).clientProfile.findUnique({
      where: { id: clientId },
      select: { sectionSubmissions: true },
    })

    const data = (client?.sectionSubmissions as Record<string, any>) ?? {}
    if (!includePrefill) {
      return NextResponse.json(normalizePricingReport(data.pricingAnalysis) ?? null)
    }

    const competitorAnalysis = await (prisma as any).competitorAnalysis.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      select: { parsed: true, report: true },
    })
    let reportCompetitors: CompetitorPricingInput[] = []
    const parsed = competitorAnalysis?.parsed as any
    if (parsed?.competitors) reportCompetitors = extractCompetitorsFromReport(parsed)
    const manualCompetitors = ((data.competitorPricingInputs?.competitors ?? []) as any[])
      .map(normalizeCompetitorInput)
      .filter(Boolean)
      .slice(0, 5) as CompetitorPricingInput[]

    return NextResponse.json({
      report: normalizePricingReport(data.pricingAnalysis) ?? null,
      prefill: {
        sellerWebsiteUrl: data.competitorPricingInputs?.sellerWebsiteUrl ?? '',
        sellerManualPricingText: data.competitorPricingInputs?.sellerManualPricingText ?? '',
        competitors: manualCompetitors.length ? manualCompetitors : reportCompetitors,
      },
    })
  } catch (error) {
    console.error('[pricing-analysis] GET error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { clientId, sellerWebsiteUrl, sellerManualPricingText, competitors } = await req.json()

    if (!clientId) {
      return new Response('Missing required field: clientId', { status: 400 })
    }

    const clientProfile = await (prisma as any).clientProfile.findUnique({
      where: { id: clientId },
      select: { businessName: true, businessCategory: true, websiteUrl: true, sectionSubmissions: true },
    })
    if (!clientProfile) return new Response('Client not found', { status: 404 })

    // Load competitor analysis from DB
    const competitorAnalysis = await (prisma as any).competitorAnalysis.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      select: { parsed: true, report: true },
    })

    // Extract competitor pricing data
    let competitorData: any = { competitors: [], message: 'No competitor analysis found' }
    let reportCompetitors: CompetitorPricingInput[] = []
    if (competitorAnalysis) {
      const parsed = competitorAnalysis.parsed as any
      if (parsed?.competitors) {
        reportCompetitors = extractCompetitorsFromReport(parsed)
        competitorData = {
          businessName: parsed.businessName ?? '',
          radiusMiles: parsed.radiusMiles ?? 0,
          competitors: (parsed.competitors ?? []).map((c: any) => ({
            name: c.name,
            pricePoints: c.pricePoints ?? [],
            pricingComparison: c.pricingComparison ?? '',
            priceEvidence: c.priceEvidence ?? [],
            distanceMiles: c.distanceMiles,
            services: c.services ?? [],
          })),
        }
      } else if (competitorAnalysis.report) {
        // Fallback: try to parse the report string
        try {
          const reportParsed = JSON.parse(competitorAnalysis.report)
          competitorData = {
            businessName: reportParsed.businessName ?? '',
            radiusMiles: reportParsed.radiusMiles ?? 0,
            competitors: (reportParsed.competitors ?? []).map((c: any) => ({
              name: c.name,
              pricePoints: c.pricePoints ?? [],
              pricingComparison: c.pricingComparison ?? '',
              priceEvidence: c.priceEvidence ?? [],
              distanceMiles: c.distanceMiles,
              services: c.services ?? [],
            })),
          }
        } catch {
          // Keep default empty competitor data
        }
      }
    }

    const existing = (clientProfile.sectionSubmissions as Record<string, any>) ?? {}
    const savedCompetitors = ((existing.competitorPricingInputs?.competitors ?? []) as any[])
      .map(normalizeCompetitorInput)
      .filter(Boolean) as CompetitorPricingInput[]
    const requestedCompetitors = ((competitors ?? []) as any[])
      .map(normalizeCompetitorInput)
      .filter(Boolean) as CompetitorPricingInput[]
    const competitorInputs = (requestedCompetitors.length ? requestedCompetitors : savedCompetitors.length ? savedCompetitors : reportCompetitors).slice(0, 5)
    const resolvedSellerWebsite = String(sellerWebsiteUrl || existing.competitorPricingInputs?.sellerWebsiteUrl || clientProfile.websiteUrl || '').trim()

    if (!resolvedSellerWebsite) return new Response('Seller website URL is required', { status: 400 })
    if (competitorInputs.length !== 5) return new Response('Exactly 5 competitor names and websites are required', { status: 400 })

    const tavilyApiKey = process.env.TAVILY_API_KEY
    const sellerPricingResearch = await researchWebsite({
      websiteUrl: resolvedSellerWebsite,
      businessName: clientProfile.businessName,
      businessCategory: clientProfile.businessCategory || 'pet resort',
      tavilyApiKey,
    })
    const manualSellerEvidence = String(sellerManualPricingText || existing.competitorPricingInputs?.sellerManualPricingText || '').trim()
    const sellerResearchWithManual = manualSellerEvidence
      ? {
          ...(sellerPricingResearch ?? {}),
          websiteUrl: resolvedSellerWebsite,
          manualPricingText: manualSellerEvidence,
          pricePoints: [...(sellerPricingResearch?.pricePoints ?? []), `ADMIN PROVIDED SELLER PRICING:\n${manualSellerEvidence}`],
        }
      : sellerPricingResearch
    const researchedCompetitors = await Promise.all(competitorInputs.map(async (competitor) => ({
      ...competitor,
      research: await researchWebsite({
        websiteUrl: competitor.websiteUrl,
        businessName: competitor.name,
        businessCategory: clientProfile.businessCategory || 'pet resort',
        tavilyApiKey,
      }),
    })))

    // Run analysis
    const report = await analyzePricing({
      businessName: clientProfile.businessName,
      sellerWebsiteUrl: resolvedSellerWebsite,
      sellerPricingResearch: sellerResearchWithManual,
      competitors: competitorInputs,
      competitorData: {
        ...competitorData,
        websitePricingResearch: researchedCompetitors,
      },
    })

    // Store result in sectionSubmissions.pricingAnalysis
    existing.pricingAnalysis = report
    existing.competitorPricingInputs = {
      sellerWebsiteUrl: resolvedSellerWebsite,
      sellerManualPricingText: manualSellerEvidence,
      competitors: competitorInputs,
      updatedAt: new Date().toISOString(),
    }

    await (prisma as any).clientProfile.update({
      where: { id: clientId },
      data: { sectionSubmissions: existing },
    })

    return NextResponse.json(report)
  } catch (error) {
    console.error('[pricing-analysis] POST error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('clientId')
    if (!clientId) {
      return new Response('Missing clientId', { status: 400 })
    }

    const client = await (prisma as any).clientProfile.findUnique({
      where: { id: clientId },
      select: { sectionSubmissions: true },
    })

    const existing = (client?.sectionSubmissions as Record<string, any>) ?? {}
    delete existing.pricingAnalysis

    await (prisma as any).clientProfile.update({
      where: { id: clientId },
      data: { sectionSubmissions: existing },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[pricing-analysis] DELETE error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
