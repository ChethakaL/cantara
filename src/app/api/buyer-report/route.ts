import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hasAIConfigured, requireAIClient, resolveModel } from '@/lib/ai-client'

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

  return NextResponse.json({ report })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const clientId = String(body.clientId || '')
  const workstream = String(body.workstream || '') as 'ws1' | 'ws2'
  if (!clientId || !['ws1', 'ws2'].includes(workstream)) {
    return new Response('clientId and workstream (ws1|ws2) required', { status: 400 })
  }

  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    include: { customWorkstream: { include: { agents: true } }, ClientWorkstreamAgents: true },
  })
  if (!client) return new Response('Client not found', { status: 404 })

  const submissions = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object' ? client.sectionSubmissions : {}) as Record<string, any>
  const assessmentReport = submissions[`assessmentReport_${workstream}`]
  const agentData = await gatherAgentData(clientId, workstream)

  const wsLabel = workstream === 'ws1' ? 'Workstream 1 — Risk Mitigation' : 'Workstream 2 — Profitability & Growth'
  const clientName = client.businessName

  if (!(await hasAIConfigured())) return new Response('AI not configured', { status: 500 })

  const anthropic = await requireAIClient()

  const result = await anthropic.messages.create({
    model: resolveModel('claude-sonnet-4-20250514'),
    max_tokens: 16000,
    temperature: 0.15,
    system: `You are a senior M&A advisor at Cantara Pet Advisors creating a buyer-facing report designed to present a business acquisition opportunity in the most compelling yet transparent way.

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

Return markdown only. Do not include any preamble.`,
    messages: [{
      role: 'user',
      content: `Generate a comprehensive ${wsLabel} Buyer Report for **${clientName}**.

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

${assessmentReport?.markdown ? `### Internal Assessment Summary\n${truncate(assessmentReport.markdown, 6000)}` : ''}

${agentData.map(a => `### ${a.agentName}\n${a.excerpt || 'No data available.'}`).join('\n\n')}`,
    }],
  })

  const markdown = result.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim()

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
