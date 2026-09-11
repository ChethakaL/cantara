import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readRoadmapSubmission } from '@/lib/sale-readiness-checklist'
import {
  parseAnalyzeProvider,
  resolveAnalyzeModelId,
  assertOpenAiConfiguredForAnalyze,
} from '@/lib/agent-analyze-provider'
import { runWithAgentLlmContext } from '@/lib/agent-llm-context'
import { createAgentMessage } from '@/lib/llm-completion'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  const workstream = req.nextUrl.searchParams.get('workstream') as 'ws1' | 'ws2'
  if (!clientId || !workstream) return new Response('clientId and workstream required', { status: 400 })

  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: { sectionSubmissions: true },
  })
  if (!client) return new Response('Client not found', { status: 404 })

  const submissions = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object' ? client.sectionSubmissions : {}) as Record<string, any>
  const key = `buyerReport_${workstream}`
  const report = submissions[key] ?? null
  const roadmap = readRoadmapSubmission(submissions)
  const roadmapReady = Boolean(roadmap?.stage === 'report' && roadmap.markdown?.trim())

  const sources = await checkAgentSources(clientId, workstream, submissions)

  return NextResponse.json({ report, roadmapReady, sources })
}

export async function DELETE(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  const workstream = req.nextUrl.searchParams.get('workstream') as 'ws1' | 'ws2'
  if (!clientId || !workstream) return new Response('clientId and workstream required', { status: 400 })

  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: { sectionSubmissions: true },
  })
  if (!client) return new Response('Client not found', { status: 404 })

  const current = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object'
    ? client.sectionSubmissions
    : {}) as Record<string, any>
  const key = `buyerReport_${workstream}`
  delete current[key]

  await prisma.clientProfile.update({
    where: { id: clientId },
    data: { sectionSubmissions: current },
  })

  return NextResponse.json({ success: true })
}


export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const clientId = String(body.clientId || '')
  const workstream = String(body.workstream || '') as 'ws1' | 'ws2'
  const provider = parseAnalyzeProvider(body.provider)
  const modelId = resolveAnalyzeModelId(provider, body.modelId)
  if (!clientId || !['ws1', 'ws2'].includes(workstream)) {
    return new Response('clientId and workstream (ws1|ws2) required', { status: 400 })
  }
  if (provider === 'openai') {
    const gate = await assertOpenAiConfiguredForAnalyze()
    if (gate) return gate
  }

  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    include: { customWorkstream: { include: { agents: true } }, ClientWorkstreamAgents: true },
  })
  if (!client) return new Response('Client not found', { status: 404 })

  const submissions = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object' ? client.sectionSubmissions : {}) as Record<string, any>
  const roadmapReport = readRoadmapSubmission(submissions)
  if (!roadmapReport || roadmapReport.stage !== 'report' || !roadmapReport.markdown?.trim()) {
    return NextResponse.json({ error: 'Run and submit the Sales Readiness Roadmap before generating the buyer report.' }, { status: 409 })
  }
  const agentData = await gatherAgentData(clientId, workstream)

  const wsLabel = workstream === 'ws1' ? 'Workstream 1 — Risk Mitigation' : 'Workstream 2 — Profitability & Growth'
  const clientName = client.businessName

  const systemPrompt = `You are a senior M&A advisor at Cantara Pet Advisors creating a buyer-facing report designed to present a business acquisition opportunity in the most compelling yet transparent way.

Your buyer reports are:
- **Compelling**: Highlight the opportunity, growth potential, and strengths that make this an attractive acquisition
- **Transparent**: Acknowledge areas that need attention without being alarmist — frame them as manageable and already being addressed
- **Professional**: Written for sophisticated buyers and their deal teams — investment-grade quality
- **Data-driven**: Include specific numbers, metrics, and quantified opportunities wherever possible
- **Balanced**: Show both the opportunity and the realistic picture — buyers respect honesty

CRITICAL RULES:
- Frame findings positively where possible — "growth opportunity" not "weakness"
- Present risks as "areas for buyer consideration" with clear mitigation paths
- Use GREEN/YELLOW/RED status indicators for category readiness
- Do NOT reveal internal advisor notes, seller-specific improvement plans, or confidential deal strategy
- Do NOT include seller contact info, internal pricing discussions, or negotiation strategy
- This is a MARKETING document that must also be TRUTHFUL

Return markdown only. Do not include any preamble.`

  const userPrompt = `Generate a comprehensive ${wsLabel} Buyer Report for **${clientName}**.

This is a BUYER-FACING document. It presents the business to potential acquirers, highlighting strengths, quantifying the opportunity, and transparently addressing areas that need attention. The goal is to encourage serious buyer interest while maintaining credibility.

## Required Structure — Follow EXACTLY

# ${clientName}
## ${wsLabel} — Buyer Due Diligence Summary

## Investment Highlights

Write 4-6 compelling bullet points that summarize why this is an attractive acquisition. Each should be specific and quantified where possible. Think: What would make a buyer lean forward?

## Business Overview

Brief 2-3 paragraph overview of the business covering:
- What the business does, its market, and its history
- Key operational strengths
- Position in the market

## Diligence Summary

Create a summary table showing readiness across all categories:

| Category | Status | Summary | Buyer Consideration |
|----------|--------|---------|---------------------|
| Category Name | 🟢 GREEN / 🟡 YELLOW / 🔴 RED | One-line summary | What this means for the buyer (opportunity, risk level, action needed) |

${workstream === 'ws1' ? `Categories: Legal & Corporate Standing, Ownership & Transfer Readiness, Contracts & Agreements, Litigation & Liens, Insurance Coverage, Permits & Zoning, Employment & HR, Tax Compliance` :
`Categories: Revenue & Profitability, Pricing Strategy, Digital Presence & Reputation, Competitive Position, Sales Process, Facility Condition, Customer Mix, Growth Potential`}

Status definitions:
- 🟢 GREEN = Strong position. Clean diligence expected.
- 🟡 YELLOW = Adequate with minor items to address. Normal for a business of this size.
- 🔴 RED = Requires attention. Seller is aware and actively addressing (provide details).

${workstream === 'ws1' ? `## Legal & Compliance Profile
Summarize the business's legal standing, corporate structure, ownership clarity, and compliance posture. Highlight strengths. Note any items being addressed.

## Operational Readiness
Cover contracts, insurance, permits, vendor relationships, and key person considerations. Frame positively — emphasize stability and transferability.

## Employment & HR Profile
Staffing levels, compensation structure, compliance. Highlight team stability and any competitive advantages in talent.

## Risk Mitigation Summary
Honestly address any material risks, but pair each with the mitigation plan or buyer remedy (e.g., escrow, rep & warranty, post-closing adjustment).` :

`## Financial Performance
Revenue trends, profitability, EBITDA quality. Highlight growth trajectory and earnings stability. Include specific numbers.

## Market Position & Competition
Competitive landscape, market share, pricing position. Emphasize competitive advantages and market opportunity.

## Growth Opportunities
Specific, quantified growth levers available to a buyer. What could a well-resourced acquirer do that the current owner hasn't? (e.g., expand services, digital marketing, new locations, pricing optimization)

## Operational Strengths
Facility condition, sales process maturity, digital presence. Highlight what's working well and what a buyer inherits.`}

## Key Metrics at a Glance

Create a clean metrics table:
| Metric | Value | Context |
|--------|-------|---------|
(Include revenue, growth rate, customer count, facility size, team size, years in operation, and any other relevant metrics from the data)

## Buyer Considerations & Next Steps

Numbered list of 5-7 recommended next steps for an interested buyer. Be specific:
- What additional diligence to request
- Key meetings to schedule (management, key employees, landlord)
- Areas to focus on during site visits
- Timeline expectations

---

## Source Data

### Sales Readiness Roadmap
${truncate(roadmapReport.markdown, 10000)}

${agentData.map(a => `### ${a.agentName}\n${a.excerpt || 'No data available.'}`).join('\n\n')}`

  const markdown = await runWithAgentLlmContext({ provider, modelId }, () =>
    createAgentMessage({
      system: systemPrompt,
      content: userPrompt,
      maxTokens: 16000,
      temperature: 0.15,
    }),
  )

  const report = {
    workstream,
    workstreamLabel: wsLabel,
    clientName,
    generatedAt: new Date().toISOString(),
    markdown,
  }

  const current = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object' ? client.sectionSubmissions : {}) as Record<string, any>
  await prisma.clientProfile.update({
    where: { id: clientId },
    data: {
      sectionSubmissions: {
        ...current,
        [`buyerReport_${workstream}`]: report,
      },
    },
  })

  return NextResponse.json({ report })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const clientId = String(body.clientId || '')
  const workstream = String(body.workstream || '') as 'ws1' | 'ws2'
  const markdown = typeof body.markdown === 'string' ? body.markdown : null

  if (!clientId || !['ws1', 'ws2'].includes(workstream) || markdown === null) {
    return new Response('clientId, workstream, and markdown required', { status: 400 })
  }

  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: { sectionSubmissions: true },
  })
  if (!client) return new Response('Client not found', { status: 404 })

  const current = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object'
    ? client.sectionSubmissions
    : {}) as Record<string, any>
  const key = `buyerReport_${workstream}`
  const existing = current[key]
  if (!existing) {
    return new Response('Generate the buyer report before editing.', { status: 404 })
  }

  const report = {
    ...existing,
    markdown,
    updatedAt: new Date().toISOString(),
  }

  await prisma.clientProfile.update({
    where: { id: clientId },
    data: {
      sectionSubmissions: {
        ...current,
        [key]: report,
      },
    },
  })

  return NextResponse.json({ report })
}

async function gatherAgentData(clientId: string, workstream: 'ws1' | 'ws2') {
  const agentSources: Array<{ agentName: string; excerpt: string }> = []

  const addFromTable = async (name: string, delegate: any, textField: string) => {
    try {
      const row = await delegate?.findFirst?.({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
        select: { [textField]: true },
      })
      agentSources.push({
        agentName: name,
        excerpt: row ? truncate(row[textField] ?? row.reportMarkdown ?? row.report ?? row.markdown ?? '', 4000) : '',
      })
    } catch {
      agentSources.push({ agentName: name, excerpt: '' })
    }
  }

  const addFromSubmissions = async (name: string, key: string) => {
    try {
      const c = await prisma.clientProfile.findUnique({ where: { id: clientId }, select: { sectionSubmissions: true } })
      const subs = (c?.sectionSubmissions && typeof c.sectionSubmissions === 'object' ? c.sectionSubmissions : {}) as Record<string, any>
      const data = subs[key]
      agentSources.push({
        agentName: name,
        excerpt: data ? truncate(typeof data === 'string' ? data : JSON.stringify(data), 4000) : '',
      })
    } catch {
      agentSources.push({ agentName: name, excerpt: '' })
    }
  }

  if (workstream === 'ws1') {
    await addFromTable('Valuation Agent', (prisma as any).ttmAnalysis, 'reportMarkdown')
    await addFromTable('Employee Obligations', (prisma as any).employeeObligationsReport, 'markdown')
    await addFromSubmissions('Employee Compensation', 'employeeCompReport')
    await addFromTable('Lease Analysis', (prisma as any).leaseAnalysis, 'report')
    await addFromTable('Material Contracts', (prisma as any).contractAnalysis, 'report')
    await addFromTable('Ownership Verification', (prisma as any).ownershipVerificationReport, 'markdown')
    await addFromTable('Permits & Zoning', (prisma as any).permitsZoningReport, 'markdown')
    await addFromTable('Legal Entity Search', (prisma as any).legalEntitySearchReport, 'markdown')
    await addFromTable('Tax Liability Review', (prisma as any).taxLiabilityReport, 'markdown')
    await addFromSubmissions('Insurance Review', 'insuranceReview')
    await addFromSubmissions('Litigation & Liens', 'litigationSearch')
    await addFromSubmissions('Org Chart Review', 'orgChart')
    await addFromSubmissions('Owner & GM Assessment', 'ownerGmAssessment')
    await addFromSubmissions('Professional Advisors', 'professionalAdvisors')
    await addFromSubmissions('Software & Vendors', 'vendorDirectory')
  } else {
    await addFromTable('Valuation Agent', (prisma as any).ttmAnalysis, 'reportMarkdown')
    await addFromTable('Competitor Analysis', (prisma as any).competitorAnalysis, 'report')
    await addFromSubmissions('Digital Presence', 'digitalPresence')
    await addFromSubmissions('Facility Review', 'facilityReview')
    await addFromSubmissions('Competitive Pricing', 'pricingAnalysis')
    await addFromSubmissions('Pricing by Vertical', 'pricingVertical')
    await addFromSubmissions('Sales Process Review', 'salesProcessReview')
  }

  return agentSources
}

function truncate(text: string, maxLen: number): string {
  const raw = typeof text === 'string' ? text : JSON.stringify(text ?? '')
  return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen)
}

async function checkAgentSources(clientId: string, workstream: 'ws1' | 'ws2', submissions: Record<string, any>) {
  const roadmap = readRoadmapSubmission(submissions)
  const roadmapReady = Boolean(roadmap?.stage === 'report' && roadmap.markdown?.trim())

  if (workstream === 'ws1') {
    const [
      ttm,
      empObligations,
      lease,
      contract,
      ownership,
      permits,
      legalEntity,
      taxLiability,
    ] = await Promise.all([
      (prisma as any).ttmAnalysis.findFirst({ where: { clientId }, select: { id: true } }).catch(() => null),
      (prisma as any).employeeObligationsReport.findFirst({ where: { clientId }, select: { id: true } }).catch(() => null),
      (prisma as any).leaseAnalysis.findFirst({ where: { clientId }, select: { id: true } }).catch(() => null),
      (prisma as any).contractAnalysis.findFirst({ where: { clientId }, select: { id: true } }).catch(() => null),
      (prisma as any).ownershipVerificationReport.findFirst({ where: { clientId }, select: { id: true } }).catch(() => null),
      (prisma as any).permitsZoningReport.findFirst({ where: { clientId }, select: { id: true } }).catch(() => null),
      (prisma as any).legalEntitySearchReport.findFirst({ where: { clientId }, select: { id: true } }).catch(() => null),
      (prisma as any).taxLiabilityReport.findFirst({ where: { clientId }, select: { id: true } }).catch(() => null),
    ])

    return [
      {
        key: 'roadmap',
        name: 'Sales Readiness Roadmap',
        tabKey: 'sales-readiness-roadmap',
        required: true,
        ready: roadmapReady,
        note: 'Strategic action plan and seller readiness rating. Required to generate buyer report.',
      },
      {
        key: 'ttm',
        name: 'Valuation (TTM)',
        tabKey: 'ttm',
        required: false,
        ready: Boolean(ttm),
        note: 'Trailing twelve months adjusted EBITDA, revenue trends, and valuation multiples.',
      },
      {
        key: 'employee-obligations',
        name: 'Employee Obligations',
        tabKey: 'employee-obligations',
        required: false,
        ready: Boolean(empObligations),
        note: 'Workforce analysis, key personnel, employment agreements, and retirement/PTO obligations.',
      },
      {
        key: 'employee-comp',
        name: 'Employee Compensation',
        tabKey: 'employee-comp',
        required: false,
        ready: Boolean(submissions.employeeCompReport),
        note: 'Payroll breakdown, wage benchmarking, bonus structures, and overtime analysis.',
      },
      {
        key: 'lease',
        name: 'Lease Analysis',
        tabKey: 'lease',
        required: false,
        ready: Boolean(lease),
        note: 'Lease terms, renewal options, rent schedule, assignment clauses, and landlord consent requirements.',
      },
      {
        key: 'contract',
        name: 'Material Contracts',
        tabKey: 'contract',
        required: false,
        ready: Boolean(contract),
        note: 'Key supplier and customer contracts, exclusivity provisions, and assignment rights.',
      },
      {
        key: 'ownership-verification',
        name: 'Ownership Verification',
        tabKey: 'ownership-verification',
        required: false,
        ready: Boolean(ownership),
        note: 'Cap table, equity structure, operating agreements, and ownership authority.',
      },
      {
        key: 'permits-zoning',
        name: 'Permits & Zoning',
        tabKey: 'permits-zoning',
        required: false,
        ready: Boolean(permits),
        note: 'Business license, kennel/health permits, zoning approvals, and certificate of occupancy.',
      },
      {
        key: 'legal-entity-search',
        name: 'Legal Entity Search',
        tabKey: 'legal-entity-search',
        required: false,
        ready: Boolean(legalEntity),
        note: 'Secretary of State standing, formation documents, and corporate filings.',
      },
      {
        key: 'tax-liability-review',
        name: 'Tax Liability Review',
        tabKey: 'tax-liability-review',
        required: false,
        ready: Boolean(taxLiability),
        note: 'Tax return filings, sales tax compliance, payroll withholding, and potential exposure.',
      },
      {
        key: 'insurance',
        name: 'Insurance Review',
        tabKey: 'insurance',
        required: false,
        ready: Boolean(submissions.insuranceReview),
        note: 'General liability, property, workers\' compensation policies, coverage limits, and claims history.',
      },
      {
        key: 'litigation',
        name: 'Litigation & Liens',
        tabKey: 'litigation',
        required: false,
        ready: Boolean(submissions.litigationSearch),
        note: 'Court docket searches, UCC lien filings, pending litigation, and dispute records.',
      },
      {
        key: 'org-chart',
        name: 'Org Chart Review',
        tabKey: 'org-chart',
        required: false,
        ready: Boolean(submissions.orgChart),
        note: 'Organizational hierarchy, reporting relationships, and management depth.',
      },
      {
        key: 'owner-gm-assessment',
        name: 'Owner & GM Assessment',
        tabKey: 'owner-gm-assessment',
        required: false,
        ready: Boolean(submissions.ownerGmAssessment),
        note: 'Owner dependency analysis, day-to-day role delegation, and GM autonomy.',
      },
      {
        key: 'advisors',
        name: 'Professional Advisors',
        tabKey: 'advisors',
        required: false,
        ready: Boolean(submissions.professionalAdvisors),
        note: 'Existing CPA, attorney, insurance broker, and wealth management contacts.',
      },
      {
        key: 'vendor-directory',
        name: 'Software & Vendors',
        tabKey: 'vendor-directory',
        required: false,
        ready: Boolean(submissions.vendorDirectory),
        note: 'Key software licenses, booking platforms, suppliers, and critical vendor terms.',
      },
    ]
  } else {
    const [
      ttm,
      competitor,
    ] = await Promise.all([
      (prisma as any).ttmAnalysis.findFirst({ where: { clientId }, select: { id: true } }).catch(() => null),
      (prisma as any).competitorAnalysis.findFirst({ where: { clientId }, select: { id: true } }).catch(() => null),
    ])

    return [
      {
        key: 'roadmap',
        name: 'Sales Readiness Roadmap',
        tabKey: 'sales-readiness-roadmap',
        required: true,
        ready: roadmapReady,
        note: 'Strategic action plan and seller readiness rating. Required to generate buyer report.',
      },
      {
        key: 'ttm',
        name: 'Valuation (TTM)',
        tabKey: 'ttm',
        required: false,
        ready: Boolean(ttm),
        note: 'TTM adjusted EBITDA, revenue trends, and valuation multiples.',
      },
      {
        key: 'competitor',
        name: 'Competitor Analysis',
        tabKey: 'competitor',
        required: false,
        ready: Boolean(competitor),
        note: 'Competitor landscape, service pricing comparison, and market share analysis.',
      },
      {
        key: 'digital',
        name: 'Digital Presence',
        tabKey: 'digital',
        required: false,
        ready: Boolean(submissions.digitalPresence),
        note: 'Website evaluation, Google Reviews, SEO authority, and customer reputation.',
      },
      {
        key: 'facility-review',
        name: 'Facility Review',
        tabKey: 'facility-review',
        required: false,
        ready: Boolean(submissions.facilityReview),
        note: 'Physical facility condition, expansion capacity, and equipment evaluation.',
      },
      {
        key: 'pricing-analysis',
        name: 'Competitive Pricing',
        tabKey: 'pricing-analysis',
        required: false,
        ready: Boolean(submissions.pricingAnalysis),
        note: 'Service pricing structure, revenue optimization opportunities, and discount analysis.',
      },
      {
        key: 'pricing-vertical',
        name: 'Pricing by Vertical',
        tabKey: 'pricing-vertical',
        required: false,
        ready: Boolean(submissions.pricingVertical),
        note: '24-month pricing schedule, revenue split across service lines, and historical rate increases.',
      },
      {
        key: 'sales-process-review',
        name: 'Sales Process Review',
        tabKey: 'sales-process-review',
        required: false,
        ready: Boolean(submissions.salesProcessReview),
        note: 'Inquiry conversion, booking discipline, customer follow-up, and sales performance.',
      },
    ]
  }
}

