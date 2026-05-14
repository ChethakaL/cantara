import Anthropic from '@anthropic-ai/sdk'
import { getAnthropicApiKey } from "@/lib/secure-settings"
import { TeaserInputData } from './types'

export interface ClientContext {
  clientProfile: any
  ttmAnalysis: any
  recast: any
  leaseReport: any
  competitorReport: any
  digitalPresence: any
  insuranceDoc: any
  employeeReport: any
}

export async function generateTeaserWithAI(context: ClientContext): Promise<TeaserInputData> {
  const apiKey = await getAnthropicApiKey()
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY required')

  const client = new Anthropic({ apiKey })

  // Build comprehensive context string from all available data
  const dataContext = buildDataContext(context)

  const prompt = `You are a senior M&A advisor at Cantara Pet Advisors preparing a confidential investment teaser (blind teaser) for a pet care business acquisition opportunity.

Using the data provided below, generate content for each section of the teaser. The teaser should NOT reveal the business name, exact location, or owner identity. Use ranges for financial figures. The tone should be professional, compelling, and aimed at PE buyers and strategic acquirers.

=== CLIENT DATA ===
${dataContext}

=== INSTRUCTIONS ===
Generate a JSON object with these fields. Each field should be thoughtfully written based on the actual data:

{
  "dealType": "Asset or Equity Sale" (or adjust based on data),
  "location": "Region only, e.g. 'Southwest United States' - do NOT reveal exact city",
  "revenueRange": "Use a range like '$1.6M – $2.0M' based on TTM revenue",
  "serviceModel": "Describe the service model, e.g. 'Full-Service Resort' or 'Boarding & Daycare Focused'",
  "facilityCapacity": "e.g. '175 Dogs' or similar based on available data",
  "processStage": "LOI Solicitation",

  "businessOverview": "2-3 sentence compelling overview. Mention key strengths: recurring revenue, service breadth, market position. Do NOT name the business.",

  "overviewHeadline": "Section 02 title under Business Overview, e.g. 'A Purpose-Built Premium Pet Resort'",
  "section02LeadSummary": "2-3 sentence narrative summary for section 02 directly under that headline (lot size, SF, reputation, GM-led operations). Do NOT name the business.",

  "facilityProfile": "NEWLINE-SEPARATED bullet lines only (no paragraph). Example: line1\\nline2\\nline3. Describe facility: SF, kennels, zones, climate.",
  "ownershipManagement": "NEWLINE-SEPARATED bullet lines only. Owner-operator, GM, seller motivation, transition support.",
  "clientProfile": "NEWLINE-SEPARATED bullet lines only.",
  "staffOperations": "NEWLINE-SEPARATED bullet lines only.",
  "realEstate": "NEWLINE-SEPARATED bullet lines only.",
  "technology": "NEWLINE-SEPARATED bullet lines only.",
  "permitsZoning": "NEWLINE-SEPARATED bullet lines only.",

  "annualRevenue": "Revenue range from TTM data",
  "revenueGrowth": "YoY growth percentage if available",
  "normalizedEbitda": "EBITDA range from recast data",
  "ebitdaMargin": "Margin percentage",
  "revenueMix": "'Disclosed post-NDA' or brief description without exact numbers",
  "buyerCapex": "'Low' unless data suggests otherwise",

  "ttmRevenue": "Headline figure for KPI strip",
  "normalizedEbitdaMargin": "Headline margin for KPI strip",
  "totalCapacity": "Facility capacity headline",

  "investmentHighlights": [
    {"title": "...", "description": "1-2 sentences. Base on actual data strengths."},
    {"title": "...", "description": "..."},
    {"title": "...", "description": "..."},
    {"title": "...", "description": "..."},
    {"title": "...", "description": "..."}
  ],

  "businessDisplayName": "Generic name like 'Premium Pet Resort' - NOT the real name",
  "teaserSubtitle": "Acquisition Opportunity",
  "regionLabel": "Region only, e.g. 'Southwest United States'"
}

Return ONLY valid JSON. No markdown, no explanation.`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    temperature: 0.3,
    messages: [{ role: 'user', content: prompt }],
  })

  const rawText = response.content
    .filter((b) => b.type === 'text')
    .map((b) => ('text' in b ? b.text : ''))
    .join('')
    .trim()

  const cleaned = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
  const generated = JSON.parse(cleaned)

  // Merge with defaults for any missing fields
  return {
    dealType: generated.dealType || 'Asset or Equity Sale',
    location: generated.location || '',
    revenueRange: generated.revenueRange || '',
    serviceModel: generated.serviceModel || '',
    facilityCapacity: generated.facilityCapacity || '',
    processStage: generated.processStage || 'LOI Solicitation',
    businessOverview: generated.businessOverview || '',
    overviewHeadline: generated.overviewHeadline || 'A Purpose-Built Premium Pet Resort',
    section02LeadSummary: generated.section02LeadSummary || '',
    facilityProfile: generated.facilityProfile || '',
    ownershipManagement: generated.ownershipManagement || '',
    clientProfile: generated.clientProfile || '',
    staffOperations: generated.staffOperations || '',
    realEstate: generated.realEstate || '',
    technology: generated.technology || 'Modern booking & POS platform in place. CRM and review management tools active. Operational tech stack transferable to new owner.',
    permitsZoning: generated.permitsZoning || 'Fully compliant with all local land use and zoning regulations.',
    annualRevenue: generated.annualRevenue || '',
    revenueGrowth: generated.revenueGrowth || '',
    normalizedEbitda: generated.normalizedEbitda || '',
    ebitdaMargin: generated.ebitdaMargin || '',
    revenueMix: generated.revenueMix || 'Disclosed post-NDA',
    buyerCapex: generated.buyerCapex || 'Low',
    ttmRevenue: generated.ttmRevenue || '',
    normalizedEbitdaMargin: generated.normalizedEbitdaMargin || '',
    totalCapacity: generated.totalCapacity || '',
    investmentHighlights: generated.investmentHighlights?.length === 5
      ? generated.investmentHighlights
      : [
          { title: '', description: '' },
          { title: '', description: '' },
          { title: '', description: '' },
          { title: '', description: '' },
          { title: '', description: '' },
        ],
    contactName: 'Craig Pollack',
    contactTitle: 'Chief Executive Officer',
    contactEmail: 'craig@cantarapet.com',
    businessDisplayName: generated.businessDisplayName || 'Premium Pet Resort',
    teaserSubtitle: generated.teaserSubtitle || 'Acquisition Opportunity',
    regionLabel: generated.regionLabel || '',
  }
}

function buildDataContext(ctx: ClientContext): string {
  const sections: string[] = []

  // Client profile
  if (ctx.clientProfile) {
    sections.push(`=== CLIENT PROFILE ===
Business Name: ${ctx.clientProfile.businessName || 'Unknown'}
Business Type: ${ctx.clientProfile.businessType || 'Unknown'}
Business Category: ${ctx.clientProfile.businessCategory || 'Unknown'}
Address: ${ctx.clientProfile.businessAddress || 'Unknown'}
Description: ${ctx.clientProfile.businessDescription || 'None provided'}
Website: ${ctx.clientProfile.websiteUrl || 'Unknown'}`)
  }

  // Financial data from TTM analysis (WS2-1)
  if (ctx.ttmAnalysis) {
    const ttm = ctx.ttmAnalysis.ttmSummary
    const years: any[] = ctx.ttmAnalysis.annualModel?.years ?? []
    sections.push(`=== FINANCIAL DATA (WS2-1) ===
TTM Revenue: $${ttm?.totalRevenue?.toLocaleString() ?? 'N/A'}
TTM EBITDA (Pre-Normalized): $${ttm?.ebitdaPreRecast?.toLocaleString() ?? 'N/A'}
TTM Period: ${ttm?.startMonth ?? '?'} to ${ttm?.endMonth ?? '?'}
Annual Years: ${years.map((y: any) => `FY${y.fiscalYear}: Rev $${y.totalRevenue?.toLocaleString() ?? 'N/A'}, EBITDA $${y.ebitdaPreRecast?.toLocaleString() ?? 'N/A'}`).join(' | ')}`)
  }

  // Recast / Valuation (WS2-2)
  if (ctx.recast) {
    sections.push(`=== VALUATION (WS2-2 Recast) ===
Normalized EBITDA: $${ctx.recast.normalizedEbitda?.toLocaleString() ?? 'N/A'}
Valuation Low: $${ctx.recast.valuationLow?.toLocaleString() ?? 'N/A'}
Valuation Mid: $${ctx.recast.valuationMid?.toLocaleString() ?? 'N/A'}
Valuation High: $${ctx.recast.valuationHigh?.toLocaleString() ?? 'N/A'}
Multiple Range: ${ctx.recast.assumptions?.multipleLow ?? '?'}x - ${ctx.recast.assumptions?.multipleHigh ?? '?'}x`)
  }

  // Lease data
  if (ctx.leaseReport) {
    try {
      const parsed = typeof ctx.leaseReport.parsed === 'string'
        ? JSON.parse(ctx.leaseReport.parsed)
        : ctx.leaseReport.parsed
      if (parsed?.snapshotTable) {
        const rows = parsed.snapshotTable
          .map((r: any) => `${r.field}: ${r.finding}`)
          .join('\n')
        sections.push(`=== LEASE DATA ===\n${rows}`)
      }
      if (parsed?.summary) {
        sections.push(`Lease Summary: ${typeof parsed.summary === 'string' ? parsed.summary : JSON.stringify(parsed.summary)}`)
      }
    } catch { /* parsed field may not be in expected shape */ }
  }

  // Competitor analysis
  if (ctx.competitorReport) {
    try {
      const data = typeof ctx.competitorReport.reportData === 'string'
        ? JSON.parse(ctx.competitorReport.reportData)
        : ctx.competitorReport.reportData
      if (data) {
        const competitors = data.competitors
          ?.slice(0, 5)
          .map((c: any) => `${c.name}: Rating ${c.rating}, ${c.distance}`)
          .join('\n') || 'None'
        const marketSummary = data.marketSummary || data.summary || ''
        sections.push(`=== COMPETITOR LANDSCAPE ===
${competitors}
${marketSummary ? `Market Summary: ${marketSummary}` : ''}`)
      }
    } catch { /* gracefully ignore */ }
  }

  // Digital presence
  if (ctx.digitalPresence) {
    try {
      const data = typeof ctx.digitalPresence.reportData === 'string'
        ? JSON.parse(ctx.digitalPresence.reportData)
        : ctx.digitalPresence.reportData
      if (data) {
        const parts = [`Overall Score: ${data.overallScore ?? 'N/A'}/5`]
        if (data.googleRating) parts.push(`Google Rating: ${data.googleRating}`)
        if (data.reviewCount) parts.push(`Review Count: ${data.reviewCount}`)
        if (data.websiteScore) parts.push(`Website Score: ${data.websiteScore}`)
        if (data.socialMediaScore) parts.push(`Social Media Score: ${data.socialMediaScore}`)
        sections.push(`=== DIGITAL PRESENCE ===\n${parts.join('\n')}`)
      }
    } catch { /* gracefully ignore */ }
  }

  // Insurance review
  if (ctx.insuranceDoc) {
    try {
      if (ctx.insuranceDoc.aiReviewSummary) {
        sections.push(`=== INSURANCE REVIEW ===
Status: ${ctx.insuranceDoc.aiReviewStatus || 'Reviewed'}
Summary: ${ctx.insuranceDoc.aiReviewSummary}`)
      }
    } catch { /* gracefully ignore */ }
  }

  // Employee obligations
  if (ctx.employeeReport) {
    try {
      const data = typeof ctx.employeeReport.reportData === 'string'
        ? JSON.parse(ctx.employeeReport.reportData)
        : ctx.employeeReport.reportData
      if (data) {
        const parts: string[] = []
        if (data.totalEmployees) parts.push(`Total Employees: ${data.totalEmployees}`)
        if (data.fullTimeCount) parts.push(`Full-Time: ${data.fullTimeCount}`)
        if (data.partTimeCount) parts.push(`Part-Time: ${data.partTimeCount}`)
        if (data.totalPayroll) parts.push(`Annual Payroll: $${data.totalPayroll.toLocaleString()}`)
        if (data.benefits) parts.push(`Benefits: ${JSON.stringify(data.benefits)}`)
        if (data.summary) parts.push(`Summary: ${data.summary}`)
        if (parts.length > 0) {
          sections.push(`=== EMPLOYEE OBLIGATIONS ===\n${parts.join('\n')}`)
        }
      }
    } catch { /* gracefully ignore */ }
  }

  return sections.join('\n\n') || 'Limited data available. Generate reasonable placeholder content for a pet resort acquisition teaser.'
}
