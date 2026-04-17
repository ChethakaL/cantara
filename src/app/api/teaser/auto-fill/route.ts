import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { TeaserInputData } from '@/lib/teaser/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { clientId } = await req.json()
    if (!clientId) {
      return new Response('clientId is required', { status: 400 })
    }

    // ── 1. Load client profile ──────────────────────────────────────────
    const client = await (prisma as any).clientProfile.findUnique({
      where: { id: clientId },
      include: {
        Branches: true,
        TeamMembers: true,
        AdvisorProfiles: true,
      },
    })
    if (!client) {
      return new Response('Client not found', { status: 404 })
    }

    // ── 2. Load latest TTM analysis (WS2-1) ────────────────────────────
    const latestAnalysis = await (prisma as any).ttmAnalysis.findFirst({
      where: { clientId },
      orderBy: { version: 'desc' },
    })

    // ── 3. Load latest recast (WS2-2) ──────────────────────────────────
    let recast: any = null
    if (latestAnalysis) {
      recast = await (prisma as any).ws2RecastAnalysis.findFirst({
        where: { ttmAnalysisId: latestAnalysis.id },
        orderBy: { version: 'desc' },
      })
    }

    // ── 4. Load latest lease analysis ───────────────────────────────────
    const leaseReport = await prisma.leaseAnalysis.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    })

    // ── 5. Load latest competitor analysis ──────────────────────────────
    const competitorReport = await (prisma as any).competitorAnalysis.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    })

    // ── 6. Load latest employee obligations report ──────────────────────
    const employeeReport = await (prisma as any).employeeObligationsReport.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    })

    // ── 7. Load insurance review document ───────────────────────────────
    const insuranceDoc = await (prisma as any).clientDocument.findFirst({
      where: { clientId, documentId: 'insurance_claims_12m' },
      orderBy: { createdAt: 'desc' },
      select: {
        aiReviewSummary: true,
        aiReviewStatus: true,
      },
    })

    // ── Helpers ─────────────────────────────────────────────────────────
    const formatCurrency = (v: number | null | undefined) => {
      if (typeof v !== 'number' || !Number.isFinite(v)) return ''
      return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    }

    const formatRange = (v: number | null | undefined) => {
      if (typeof v !== 'number' || !Number.isFinite(v)) return ''
      return `${formatCurrency(v * 0.9)} \u2013 ${formatCurrency(v * 1.1)}`
    }

    // ── Extract financial data from TTM / Recast ────────────────────────
    const ttmRevenue: number | null = latestAnalysis?.ttmSummary?.totalRevenue ?? null
    const normalizedEbitda: number | null = recast?.normalizedEbitda ?? null
    const ebitdaMargin =
      ttmRevenue && normalizedEbitda ? normalizedEbitda / ttmRevenue : null

    const years: any[] = latestAnalysis?.annualModel?.years ?? []
    let revenueGrowth: number | null = null
    if (years.length >= 2) {
      const cur = years[years.length - 1]?.totalRevenue ?? 0
      const prev = years[years.length - 2]?.totalRevenue
      if (prev && prev !== 0) {
        revenueGrowth = (cur - prev) / prev
      }
    }

    // ── Extract lease info ──────────────────────────────────────────────
    let leaseInfo = ''
    if (leaseReport?.parsed) {
      try {
        const parsed =
          typeof leaseReport.parsed === 'string'
            ? JSON.parse(leaseReport.parsed)
            : leaseReport.parsed
        if (parsed?.snapshotTable) {
          const propertyRow = parsed.snapshotTable.find(
            (r: any) =>
              r.field?.toLowerCase().includes('property') ||
              r.field?.toLowerCase().includes('location'),
          )
          if (propertyRow) leaseInfo = propertyRow.finding || propertyRow.value || ''
        }
        if (!leaseInfo && parsed?.summary) {
          leaseInfo =
            typeof parsed.summary === 'string'
              ? parsed.summary.slice(0, 300)
              : ''
        }
      } catch {
        // parsed field may not be in expected shape — gracefully ignore
      }
    }

    // ── Extract valuation range from recast ─────────────────────────────
    const valuationLow: number | null = recast?.valuationLow ?? null
    const valuationHigh: number | null = recast?.valuationHigh ?? null
    const _valuationRange =
      valuationLow && valuationHigh
        ? `${formatCurrency(valuationLow)} \u2013 ${formatCurrency(valuationHigh)}`
        : ''

    // ── Derive location from client profile ─────────────────────────────
    const location = client.businessAddress || ''

    // ── Derive business type label ──────────────────────────────────────
    const businessTypeRaw: string = client.businessType || ''
    const businessTypeLabel =
      businessTypeRaw.charAt(0).toUpperCase() +
      businessTypeRaw.slice(1).toLowerCase()

    // ── Build the auto-filled TeaserInputData ───────────────────────────
    const autoFilled: TeaserInputData = {
      // Transaction Snapshot
      dealType: 'Asset or Equity Sale',
      location,
      revenueRange: formatRange(ttmRevenue),
      serviceModel: client.businessCategory || 'Full-Service Resort',
      facilityCapacity: '',
      processStage: 'LOI Solicitation',

      // Business Overview
      businessOverview: client.businessDescription
        ? client.businessDescription
        : `An opportunity to acquire a well-established ${client.businessCategory || 'pet care business'} in a high-growth market. This business combines strong recurring revenue, a loyal client base, and a full suite of services.`,
      facilityProfile: leaseInfo || '',
      ownershipManagement: '',
      clientProfile: '',
      staffOperations: '',
      realEstate: leaseInfo ? `Leased facility. ${leaseInfo}` : '',
      permitsZoning:
        'Fully compliant with all local land use and zoning regulations. All required operating permits and licenses current and in good standing.',

      // Financial Highlights
      annualRevenue: formatRange(ttmRevenue),
      revenueGrowth:
        revenueGrowth !== null ? `+${(revenueGrowth * 100).toFixed(0)}%` : '',
      normalizedEbitda: formatRange(normalizedEbitda),
      ebitdaMargin:
        ebitdaMargin !== null ? `${(ebitdaMargin * 100).toFixed(0)}%` : '',
      revenueMix: 'Disclosed post-NDA',
      buyerCapex: 'Low',

      // Headline KPIs
      ttmRevenue: formatRange(ttmRevenue),
      normalizedEbitdaMargin:
        ebitdaMargin !== null ? `${(ebitdaMargin * 100).toFixed(0)}%` : '',
      totalCapacity: '',

      // Investment Highlights
      investmentHighlights: [
        {
          title: 'Recurring revenue with membership depth',
          description:
            'Active membership and subscription programs drive predictable, high-retention revenue.',
        },
        {
          title: 'Full-service model with cross-sell economics',
          description:
            'Multiple service lines create natural cross-sell pathways that increase revenue per customer and reduce churn.',
        },
        {
          title: 'Capacity utilization upside',
          description:
            'Current operations present identifiable headroom. A buyer with operational focus can drive meaningful EBITDA improvement without material additional capex.',
        },
        {
          title: 'General Manager in place',
          description:
            'An experienced GM manages day-to-day operations, making this business immediately transferable and reducing transition risk.',
        },
        {
          title: 'Platform and add-on optionality',
          description:
            'Positioned as either a standalone acquisition or an anchor asset for a regional roll-up strategy.',
        },
      ],

      // Contact
      contactName: 'Craig Pollack',
      contactTitle: 'Chief Executive Officer',
      contactEmail: 'craig@cantarapet.com',

      // Branding
      businessDisplayName: `Premium ${client.businessCategory || businessTypeLabel || 'Pet Resort'}`,
      teaserSubtitle: 'Acquisition Opportunity',
      regionLabel: location,
    }

    // ── Return result with metadata about data sources ──────────────────
    return NextResponse.json({
      autoFilled,
      sources: {
        client: true,
        ttmAnalysis: !!latestAnalysis,
        recast: !!recast,
        lease: !!leaseReport,
        competitor: !!competitorReport,
        employeeObligations: !!employeeReport,
        insurance: !!insuranceDoc,
      },
    })
  } catch (error) {
    console.error('Teaser auto-fill error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
