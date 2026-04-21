import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { TeaserInputData } from '@/lib/teaser/types'
import { generateTeaserWithAI, ClientContext } from '@/lib/teaser/ai-autofill'

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
    })
    if (!client) {
      return new Response('Client not found', { status: 404 })
    }

    // ── 2. Load latest TTM analysis (WS2-1) ────────────────────────────
    let latestAnalysis: any = null
    try {
      latestAnalysis = await (prisma as any).ttmAnalysis.findFirst({
        where: { clientId },
        orderBy: { version: 'desc' },
      })
    } catch { /* table may not exist yet */ }

    // ── 3. Load latest recast (WS2-2) ──────────────────────────────────
    let recast: any = null
    if (latestAnalysis) {
      try {
        recast = await (prisma as any).ws2RecastAnalysis.findFirst({
          where: { ttmAnalysisId: latestAnalysis.id },
          orderBy: { version: 'desc' },
        })
      } catch { /* table may not exist yet */ }
    }

    // ── 4. Load latest lease analysis ───────────────────────────────────
    let leaseReport: any = null
    try {
      leaseReport = await prisma.leaseAnalysis.findFirst({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
      })
    } catch { /* table may not exist yet */ }

    // ── 5. Load latest competitor analysis ──────────────────────────────
    let competitorReport: any = null
    try {
      competitorReport = await (prisma as any).competitorAnalysis.findFirst({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
      })
    } catch { /* table may not exist yet */ }

    // ── 6. Load latest employee obligations report ──────────────────────
    let employeeReport: any = null
    try {
      employeeReport = await (prisma as any).employeeObligationsReport.findFirst({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
      })
    } catch { /* table may not exist yet */ }

    // ── 7. Load insurance review document ───────────────────────────────
    let insuranceDoc: any = null
    try {
      insuranceDoc = await (prisma as any).clientDocument.findFirst({
        where: { clientId, documentId: 'insurance_claims_12m' },
        orderBy: { createdAt: 'desc' },
        select: {
          aiReviewSummary: true,
          aiReviewStatus: true,
        },
      })
    } catch { /* table may not exist yet */ }

    // ── 8. Load digital presence report ───────────────────────────────
    let digitalPresence: any = null
    try {
      digitalPresence = await (prisma as any).digitalPresenceReport.findFirst({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
      })
    } catch { /* table may not exist yet */ }

    // ── AI-powered auto-fill (falls back to static logic below) ────────
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const aiContext: ClientContext = {
          clientProfile: client,
          ttmAnalysis: latestAnalysis,
          recast,
          leaseReport,
          competitorReport,
          digitalPresence,
          insuranceDoc,
          employeeReport,
        }
        const autoFilled = await generateTeaserWithAI(aiContext)
        return NextResponse.json({
          autoFilled,
          sources: {
            client: true,
            ttmAnalysis: !!latestAnalysis,
            recast: !!recast,
            lease: !!leaseReport,
            competitor: !!competitorReport,
            digitalPresence: !!digitalPresence,
            employeeObligations: !!employeeReport,
            insurance: !!insuranceDoc,
            aiGenerated: true,
          },
        })
      } catch (aiError: any) {
        console.warn('AI teaser generation failed, falling back to static:', aiError?.message)
        // Fall through to static logic below
      }
    }

    // ── Static fallback ────────────────────────────────────────────────

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
      technology: 'Modern booking & POS platform in place. CRM and review management tools active. Digital marketing channels established. Operational tech stack transferable to new owner.',
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
  } catch (error: any) {
    console.error('Teaser auto-fill error:', error?.message ?? error, error?.stack ?? '')
    return new Response(error?.message ?? 'Internal Server Error', { status: 500 })
  }
}
