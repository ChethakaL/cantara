import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { analyzePricingByVertical } from '@/lib/pricing-vertical/analyze'
import type { PricingVerticalReport } from '@/lib/pricing-vertical/types'
import type { ServicePricingRow } from '@/lib/pricing-vertical/types'
import { researchWebsite } from '@/lib/competitor-analysis/website-research'
import { collectPricingDocumentEvidence } from '@/lib/pricing-vertical/document-evidence'
import { enrichVerticalSummariesInReport } from '@/lib/pricing-vertical/enrich-vertical-summaries-from-grid'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function mergeStructuredDocumentPrices(report: PricingVerticalReport, rows: ServicePricingRow[], periods?: string[]) {
  if (!rows.length) return report

  const nextPeriods = periods?.length ? periods : ['Current', 'Nov 2025', 'May 2025', 'Nov 2024', 'May 2024']
  const existingRows = report.pricingGrid ?? []
  const byName = new Map<string, ServicePricingRow>()

  for (const row of existingRows) {
    byName.set(row.serviceName.toLowerCase(), row)
  }

  for (const row of rows) {
    const key = row.serviceName.toLowerCase()
    const existing = byName.get(key)
    byName.set(key, existing ? { ...existing, ...row, prices: { ...existing.prices, ...row.prices } } : row)
  }

  return {
    ...report,
    pricingPeriods: nextPeriods,
    pricingGrid: Array.from(byName.values()).map((row) => ({
      ...row,
      prices: Object.fromEntries(nextPeriods.map((period) => [period, row.prices?.[period] ?? ''])),
    })),
  }
}

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
    const raw = data.pricingVertical as PricingVerticalReport | null | undefined
    return NextResponse.json(raw ? enrichVerticalSummariesInReport(raw) : null)
  } catch (error) {
    console.error('[pricing-vertical] GET error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const {
      clientId,
      fileName,
      base64,
      mediaType,
      websiteUrl: websiteUrlOverride,
      reanalyzeFromEdits,
      existingReport,
    } = await req.json()

    if (!clientId) {
      return new Response('Missing required field: clientId', { status: 400 })
    }
    if (
      !reanalyzeFromEdits &&
      (base64 || fileName || mediaType) &&
      (!fileName || !base64 || !mediaType)
    ) {
      return new Response('When uploading a file, fileName, base64, and mediaType are required', { status: 400 })
    }
    if (reanalyzeFromEdits && (!existingReport || typeof existingReport !== 'object')) {
      return new Response('reanalyzeFromEdits requires existingReport object', { status: 400 })
    }

    const clientProfile = await (prisma as any).clientProfile.findUnique({
      where: { id: clientId },
      select: {
        businessName: true,
        businessCategory: true,
        websiteUrl: true,
        sectionSubmissions: true,
      },
    })

    if (!clientProfile) {
      return new Response('Client not found', { status: 404 })
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

    const websiteUrl = (websiteUrlOverride || clientProfile.websiteUrl || '').trim()
    const websiteResearch = websiteUrl && process.env.TAVILY_API_KEY
      ? await researchWebsite({
          websiteUrl,
          businessName: clientProfile.businessName,
          businessCategory: clientProfile.businessCategory || 'pet resort',
          tavilyApiKey: process.env.TAVILY_API_KEY,
        })
      : websiteUrl
        ? await researchWebsite({
            websiteUrl,
            businessName: clientProfile.businessName,
            businessCategory: clientProfile.businessCategory || 'pet resort',
            tavilyApiKey: null,
          })
        : null
    const documentEvidence = await collectPricingDocumentEvidence(clientId)

    // Run analysis
    const analyzedReport = await analyzePricingByVertical({
      fileName,
      base64,
      mediaType,
      revenueByVertical,
      businessName: clientProfile.businessName,
      websiteResearch,
      documentEvidence,
      existingReport: reanalyzeFromEdits ? (existingReport as PricingVerticalReport) : null,
    })
    const report = reanalyzeFromEdits
      ? analyzedReport
      : mergeStructuredDocumentPrices(
          analyzedReport,
          documentEvidence.structuredPricingRows ?? [],
          documentEvidence.pricingPeriods,
        )

    // Store result in sectionSubmissions.pricingVertical
    const existing = (clientProfile.sectionSubmissions as Record<string, any>) ?? {}
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
