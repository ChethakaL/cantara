import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { analyzePricingByVertical } from '@/lib/pricing-vertical/analyze'
import type { PricingVerticalReport } from '@/lib/pricing-vertical/types'

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
    return NextResponse.json(data.pricingVertical ?? null)
  } catch (error) {
    console.error('[pricing-vertical] GET error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { clientId, fileName, base64, mediaType } = await req.json()

    if (!clientId || !fileName || !base64 || !mediaType) {
      return new Response('Missing required fields: clientId, fileName, base64, mediaType', { status: 400 })
    }

    // Load WS2-3 revenue by vertical from DB
    const derivedReport = await (prisma as any).ws2DerivedReport.findFirst({
      where: {
        clientId,
        agentId: 'ws2_3_rev_vertical_v1',
        status: 'COMPLETE',
      },
      orderBy: { createdAt: 'desc' },
      select: { parsedReport: true, reportMarkdown: true },
    })

    let revenueByVertical: any = { message: 'No WS2-3 revenue by vertical report found' }
    if (derivedReport) {
      if (derivedReport.parsedReport) {
        revenueByVertical = derivedReport.parsedReport
      } else if (derivedReport.reportMarkdown) {
        // Pass raw markdown if no parsed version
        revenueByVertical = { rawReport: derivedReport.reportMarkdown }
      }
    }

    // Run analysis
    const report = await analyzePricingByVertical({
      fileName,
      base64,
      mediaType,
      revenueByVertical,
    })

    // Store result in sectionSubmissions.pricingVertical
    const client = await (prisma as any).clientProfile.findUnique({
      where: { id: clientId },
      select: { sectionSubmissions: true },
    })

    const existing = (client?.sectionSubmissions as Record<string, any>) ?? {}
    existing.pricingVertical = report

    await (prisma as any).clientProfile.update({
      where: { id: clientId },
      data: { sectionSubmissions: existing },
    })

    return NextResponse.json(report)
  } catch (error) {
    console.error('[pricing-vertical] POST error:', error)
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
    delete existing.pricingVertical

    await (prisma as any).clientProfile.update({
      where: { id: clientId },
      data: { sectionSubmissions: existing },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[pricing-vertical] DELETE error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
