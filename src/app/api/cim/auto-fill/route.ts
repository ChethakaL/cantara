import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CimInputData } from '@/lib/cim/types'
import { createAgentMessage } from '@/lib/llm-completion'
import {
  assertOpenAiConfiguredForAnalyze,
  parseAnalyzeProvider,
  resolveAnalyzeModelId,
} from '@/lib/agent-analyze-provider'
import { runWithAgentLlmContext } from '@/lib/agent-llm-context'

export const maxDuration = 120
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { clientId, provider: rawProvider, modelId: requestedModelId } = await req.json()
    if (!clientId) return new Response('clientId required', { status: 400 })

    const provider = parseAnalyzeProvider(rawProvider)
    const modelId = resolveAnalyzeModelId(provider, requestedModelId)
    if (provider === 'openai') {
      const gate = await assertOpenAiConfiguredForAnalyze()
      if (gate) return gate
    }

    // ── 1. Load client profile ──────────────────────────────────────────
    let client: any = null
    try {
      client = await (prisma as any).clientProfile.findUnique({
        where: { id: clientId },
        select: {
          id: true,
          businessName: true,
          businessDescription: true,
          businessAddress: true,
          businessCategory: true,
          websiteUrl: true,
          notes: true,
          sectionSubmissions: true,
        },
      })
    } catch (e1: any) {
      // If select fails due to missing columns, try without select
      console.warn('[CIM] Select query failed, trying without select:', e1?.message?.slice(0, 100))
      try {
        client = await (prisma as any).clientProfile.findUnique({ where: { id: clientId } })
      } catch { /* table may not exist */ }
    }
    if (!client) return new Response('Client not found', { status: 404 })

    // ── 2. Load latest TTM analysis (WS2-1) ────────────────────────────
    let latestAnalysis: any = null
    try { latestAnalysis = await (prisma as any).ttmAnalysis.findFirst({ where: { clientId }, orderBy: { version: 'desc' } }) } catch {}

    // ── 3. Load latest recast (WS2-2) ──────────────────────────────────
    let recast: any = null
    if (latestAnalysis) {
      try { recast = await (prisma as any).ws2RecastAnalysis.findFirst({ where: { ttmAnalysisId: latestAnalysis.id }, orderBy: { version: 'desc' } }) } catch {}
    }

    // ── 4. Load latest lease analysis ───────────────────────────────────
    let leaseReport: any = null
    try { leaseReport = await prisma.leaseAnalysis.findFirst({ where: { clientId }, orderBy: { createdAt: 'desc' } }) } catch {}

    // ── 5. Load latest competitor analysis ──────────────────────────────
    let competitorReport: any = null
    try { competitorReport = await (prisma as any).competitorAnalysis.findFirst({ where: { clientId }, orderBy: { createdAt: 'desc' } }) } catch {}

    // ── 6. Load digital presence report ─────────────────────────────────
    let digitalPresence: any = null
    try { digitalPresence = await (prisma as any).digitalPresenceReport?.findFirst({ where: { clientId }, orderBy: { createdAt: 'desc' } }) } catch {}
    if (!digitalPresence) {
      try {
        const clientRow = await (prisma as any).clientProfile.findUnique({
          where: { id: clientId },
          select: { sectionSubmissions: true },
        })
        digitalPresence = (clientRow?.sectionSubmissions as Record<string, unknown> | null)?.digitalPresence ?? null
      } catch {}
    }

    // ── 7. Load employee obligations report ─────────────────────────────
    let employeeReport: any = null
    try { employeeReport = await (prisma as any).employeeObligationsReport.findFirst({ where: { clientId }, orderBy: { createdAt: 'desc' } }) } catch {}

    // ── 8. Load insurance review document ───────────────────────────────
    let insuranceDoc: any = null
    try {
      insuranceDoc = await (prisma as any).clientDocument.findFirst({
        where: { clientId, documentId: 'insurance_claims_12m' },
        orderBy: { createdAt: 'desc' },
        select: { aiReviewSummary: true, aiReviewStatus: true },
      })
    } catch {}

    // ── Build financial data directly from TTM analysis (no AI needed) ──
    const years = latestAnalysis?.annualModel?.years ?? []
    const ttmSummary = latestAnalysis?.ttmSummary
    const formatK = (v: number | null | undefined) => {
      if (typeof v !== 'number' || !Number.isFinite(v)) return ''
      return `$${Math.round(v / 1000)}K`
    }
    const formatPct = (v: number | null | undefined) => {
      if (typeof v !== 'number' || !Number.isFinite(v)) return ''
      const pct = Math.abs(v) <= 1 ? v * 100 : v
      return `${pct.toFixed(1)}%`
    }

    // Build income statement from annual model
    const incomeStatement = []
    if (years.length >= 1) {
      // Revenue row
      incomeStatement.push({
        label: 'Revenue',
        fy1: formatK(years[0]?.totalRevenue), fy1Pct: '',
        fy2: formatK(years[1]?.totalRevenue), fy2Pct: '',
        fy3: formatK(years[2]?.totalRevenue), fy3Pct: '',
        ttm: formatK(ttmSummary?.totalRevenue), ttmPct: '',
        proj1: '', proj1Pct: '', proj2: '', proj2Pct: '',
      })
      // COGS row
      incomeStatement.push({
        label: 'Cost of Goods Sold',
        fy1: formatK(years[0]?.totalCogs), fy1Pct: formatPct(years[0]?.totalCogs && years[0]?.totalRevenue ? years[0].totalCogs / years[0].totalRevenue : null),
        fy2: formatK(years[1]?.totalCogs), fy2Pct: formatPct(years[1]?.totalCogs && years[1]?.totalRevenue ? years[1].totalCogs / years[1].totalRevenue : null),
        fy3: formatK(years[2]?.totalCogs), fy3Pct: formatPct(years[2]?.totalCogs && years[2]?.totalRevenue ? years[2].totalCogs / years[2].totalRevenue : null),
        ttm: formatK(ttmSummary?.totalCogs), ttmPct: formatPct(ttmSummary?.totalCogs && ttmSummary?.totalRevenue ? ttmSummary.totalCogs / ttmSummary.totalRevenue : null),
        proj1: '', proj1Pct: '', proj2: '', proj2Pct: '',
      })
      // Gross Profit row
      incomeStatement.push({
        label: 'Gross Profit',
        fy1: formatK(years[0]?.grossProfit), fy1Pct: formatPct(years[0]?.grossProfit && years[0]?.totalRevenue ? years[0].grossProfit / years[0].totalRevenue : null),
        fy2: formatK(years[1]?.grossProfit), fy2Pct: formatPct(years[1]?.grossProfit && years[1]?.totalRevenue ? years[1].grossProfit / years[1].totalRevenue : null),
        fy3: formatK(years[2]?.grossProfit), fy3Pct: formatPct(years[2]?.grossProfit && years[2]?.totalRevenue ? years[2].grossProfit / years[2].totalRevenue : null),
        ttm: formatK(ttmSummary?.grossProfit), ttmPct: formatPct(ttmSummary?.grossProfit && ttmSummary?.totalRevenue ? ttmSummary.grossProfit / ttmSummary.totalRevenue : null),
        proj1: '', proj1Pct: '', proj2: '', proj2Pct: '',
      })
      // Operating Expenses row
      incomeStatement.push({
        label: 'Operating Expenses',
        fy1: formatK(years[0]?.totalOpex), fy1Pct: formatPct(years[0]?.totalOpex && years[0]?.totalRevenue ? years[0].totalOpex / years[0].totalRevenue : null),
        fy2: formatK(years[1]?.totalOpex), fy2Pct: formatPct(years[1]?.totalOpex && years[1]?.totalRevenue ? years[1].totalOpex / years[1].totalRevenue : null),
        fy3: formatK(years[2]?.totalOpex), fy3Pct: formatPct(years[2]?.totalOpex && years[2]?.totalRevenue ? years[2].totalOpex / years[2].totalRevenue : null),
        ttm: formatK(ttmSummary?.totalOpex), ttmPct: formatPct(ttmSummary?.totalOpex && ttmSummary?.totalRevenue ? ttmSummary.totalOpex / ttmSummary.totalRevenue : null),
        proj1: '', proj1Pct: '', proj2: '', proj2Pct: '',
      })
      // EBITDA row
      incomeStatement.push({
        label: 'EBITDA (Pre-Normalized)',
        fy1: formatK(years[0]?.ebitdaPreRecast), fy1Pct: formatPct(years[0]?.ebitdaPreRecast && years[0]?.totalRevenue ? years[0].ebitdaPreRecast / years[0].totalRevenue : null),
        fy2: formatK(years[1]?.ebitdaPreRecast), fy2Pct: formatPct(years[1]?.ebitdaPreRecast && years[1]?.totalRevenue ? years[1].ebitdaPreRecast / years[1].totalRevenue : null),
        fy3: formatK(years[2]?.ebitdaPreRecast), fy3Pct: formatPct(years[2]?.ebitdaPreRecast && years[2]?.totalRevenue ? years[2].ebitdaPreRecast / years[2].totalRevenue : null),
        ttm: formatK(ttmSummary?.ebitdaPreRecast), ttmPct: formatPct(ttmSummary?.ebitdaPreRecast && ttmSummary?.totalRevenue ? ttmSummary.ebitdaPreRecast / ttmSummary.totalRevenue : null),
        proj1: '', proj1Pct: '', proj2: '', proj2Pct: '',
      })
    }

    // Build normalization items from recast add-backs
    const normalizationItems = (recast?.recastSchedule?.addBackItems ?? []).map((item: any) => ({
      item: item.description || 'Unnamed',
      ttmAmount: item.ttmAmount ? `${item.ttmAmount >= 0 ? '+' : ''}$${Math.round(item.ttmAmount / 1000)}K` : '',
      commentary: item.glAccount || '',
    }))

    // Build service line breakdown from WS2-3 data
    const ws23Report = latestAnalysis?.derivedReports?.find((r: any) => r.agentId === 'ws2_3_rev_vertical_v1')
    const serviceLineBreakdown = []
    if (ws23Report?.payload?.verticals) {
      for (const v of ws23Report.payload.verticals) {
        serviceLineBreakdown.push({
          name: v.name,
          ttmRevenue: formatK(v.ttmDollar),
          pctOfTotal: formatPct(v.ttmPct),
        })
      }
    }

    // Build competitor data from competitor analysis
    const competitors = []
    if (competitorReport?.reportData) {
      try {
        const data = typeof competitorReport.reportData === 'string' ? JSON.parse(competitorReport.reportData) : competitorReport.reportData
        for (const c of (data.competitors ?? []).slice(0, 5)) {
          competitors.push({
            name: c.name || '',
            distance: c.distance || '',
            services: (c.services ?? []).join(', '),
            capacity: c.capacity || '',
            rating: c.rating ? `${c.rating} \u2605` : '',
            commentary: c.competitiveRead || '',
          })
        }
      } catch {}
    }

    // Build lease details from lease analysis
    const leaseDetails = []
    if (leaseReport?.parsed) {
      try {
        const parsed = typeof leaseReport.parsed === 'string' ? JSON.parse(leaseReport.parsed) : leaseReport.parsed
        for (const row of (parsed.snapshotTable ?? []).slice(0, 10)) {
          leaseDetails.push({ label: row.field || '', value: row.finding || '' })
        }
      } catch {}
    }

    // ── Use AI for the narrative text sections ──────────────────────────
    let aiSections: any = {}
    try {
      await runWithAgentLlmContext({ provider, modelId }, async () => {
        const context = [
          `Business: ${client.businessName}`,
          `Address: ${client.businessAddress || ''}`,
          `Category: ${client.businessCategory || ''}`,
          `Description: ${client.businessDescription || ''}`,
          `TTM Revenue: ${ttmSummary?.totalRevenue ? `$${Math.round(ttmSummary.totalRevenue).toLocaleString()}` : 'N/A'}`,
          `Normalized EBITDA: ${recast?.normalizedEbitda ? `$${Math.round(recast.normalizedEbitda).toLocaleString()}` : 'N/A'}`,
          `Valuation Mid: ${recast?.valuationMid ? `$${Math.round(recast.valuationMid).toLocaleString()}` : 'N/A'}`,
          digitalPresence ? `Digital Presence: ${JSON.stringify(digitalPresence.scores ?? {}).slice(0, 500)}` : '',
          employeeReport ? `Employee Count: ${employeeReport.headcount ?? 'N/A'}` : '',
        ].filter(Boolean).join('\n')

        const text = await createAgentMessage({
          system: 'You are writing a Confidential Information Memorandum for a pet care business acquisition. Return ONLY valid JSON.',
          content: `Generate CIM narrative sections based on this data:\n\n${context}\n\nReturn JSON with these fields:\n- investmentOverview: 2-3 sentence overview for PE buyers\n- investmentThesis: array of 5-6 bullet points (key selling points)\n- sellerOverview: 2-3 sentences about the seller and reason for sale\n- businessDescription: 2-3 sentences about the business\n- facilityProfile: bullet points about the facility\n- staffOperations: bullet points about staff\n- clientProfile: bullet points about clients\n- marketingOverview: array of 3-4 bullet points about current marketing\n- marketingOpportunities: array of 3-4 bullet points about marketing improvement opportunities\n- valueCreationIntro: intro sentence\n- financialHighlights: array of 4 one-line financial highlights\n\nReturn ONLY valid JSON.`,
          maxTokens: 4000,
          temperature: 0.3,
        })
        aiSections = JSON.parse(text.replace(/^```json\s*/i, '').replace(/\s*```$/i, ''))
      })
    } catch (e: any) {
      console.warn('CIM AI generation failed:', e?.message)
    }

    // ── Build the auto-filled CimInputData ──────────────────────────────
    const autoFilled: CimInputData = {
      businessName: client.businessName || '',
      subtitle: 'Acquisition Opportunity',
      region: client.businessAddress || '',
      serviceLines: 'Boarding \u00b7 Daycare \u00b7 Grooming \u00b7 Training \u00b7 Wellness',
      dealReference: '',
      investmentOverview: aiSections.investmentOverview || '',
      investmentThesis: aiSections.investmentThesis || ['', '', '', '', ''],
      sellerOverview: aiSections.sellerOverview || '',
      transactionOverview: 'Managed exclusively by Cantara Pet Business Advisors, this confidential sale process provides qualified buyers with full financial and lease documentation, with management meetings available upon receipt of a qualified LOI.',
      businessDescription: aiSections.businessDescription || client.businessDescription || '',
      facilityProfile: aiSections.facilityProfile || '',
      ownershipManagement: '',
      clientProfile: aiSections.clientProfile || '',
      staffOperations: aiSections.staffOperations || '',
      realEstate: '',
      technology: '',
      permitsZoning: 'All permits and licenses current and in good standing.',
      financialHighlights: aiSections.financialHighlights || [],
      incomeStatement,
      incomeFootnote: '* Management accounts basis. EBITDA normalized for owner-specific add-backs. Full financial package available in data room.',
      serviceLineBreakdown,
      monthlyTrending: '',
      normalizationNotes: [],
      normalizationItems,
      normalizationFootnote: 'Full normalization schedule with line-item backup is available in the data room.',
      valueCreationIntro: aiSections.valueCreationIntro || 'Identified initiatives \u2014 near-term operational improvements and strategic growth levers:',
      valueCreationItems: [],
      orgChartHtml: '',
      gmProfile: { name: '', tenure: '', certifications: '', transition: '', responsibilities: '' },
      staffingOverview: Array.isArray(aiSections.staffOperations) ? aiSections.staffOperations : [],
      technologyStack: [],
      marketingOverview: Array.isArray(aiSections.marketingOverview) ? aiSections.marketingOverview : [],
      marketingOpportunities: Array.isArray(aiSections.marketingOpportunities) ? aiSections.marketingOpportunities : [],
      facilityDetails: [],
      leaseDetails,
      competitiveIntro: [],
      competitors,
      pricingComparison: '',
      transactionTerms: [],
      dataRoomContents: [],
      processSteps: [
        { step: 'Step 1', title: 'Data Room Review', description: 'CIM, financials & full diligence materials' },
        { step: 'Step 2', title: 'Submit LOI', description: 'Management meeting & letter of intent' },
        { step: 'Step 3', title: 'Diligence & Close', description: 'Exclusivity, confirmatory diligence & close' },
      ],
      contactName: 'Craig Pollack',
      contactTitle: 'Chief Executive Officer \u00b7 Cantara Pet Advisors',
      contactEmail: 'craig@cantarapet.com',
    }

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
        aiGenerated: !!Object.keys(aiSections).length,
      },
    })
  } catch (error: any) {
    console.error('CIM auto-fill error:', error?.message ?? error)
    return new Response(error?.message ?? 'Internal Server Error', { status: 500 })
  }
}
