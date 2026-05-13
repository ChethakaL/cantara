import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { analyzePricing } from '@/lib/pricing-analysis/analyze'
import type { PricingAnalysisReport } from '@/lib/pricing-analysis/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('clientId')
    if (!clientId) {
      return new Response('Missing clientId', { status: 400 })
    }

    const client = await (prisma as any).clientProfile.findUnique({
      where: { id: clientId },
      select: { sectionSubmissions: true },
    })

    const data = (client?.sectionSubmissions as Record<string, any>) ?? {}
    return NextResponse.json(data.pricingAnalysis ?? null)
  } catch (error) {
    console.error('[pricing-analysis] GET error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { clientId, fileName, base64, mediaType } = await req.json()

    if (!clientId || !fileName || !base64 || !mediaType) {
      return new Response('Missing required fields: clientId, fileName, base64, mediaType', { status: 400 })
    }

    // Load competitor analysis from DB
    const competitorAnalysis = await (prisma as any).competitorAnalysis.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      select: { parsed: true, report: true },
    })

    // Extract competitor pricing data
    let competitorData: any = { competitors: [], message: 'No competitor analysis found' }
    if (competitorAnalysis) {
      const parsed = competitorAnalysis.parsed as any
      if (parsed?.competitors) {
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

    // Run analysis
    const report = await analyzePricing({
      fileName,
      base64,
      mediaType,
      competitorData,
    })

    // Store result in sectionSubmissions.pricingAnalysis
    const client = await (prisma as any).clientProfile.findUnique({
      where: { id: clientId },
      select: { sectionSubmissions: true },
    })

    const existing = (client?.sectionSubmissions as Record<string, any>) ?? {}
    existing.pricingAnalysis = report

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
