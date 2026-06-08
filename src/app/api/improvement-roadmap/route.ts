import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnthropicApiKey } from '@/lib/secure-settings'

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
  const key = `improvementRoadmap_${workstream}`
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

  // Get assessment report data if available, plus raw agent data
  const submissions = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object' ? client.sectionSubmissions : {}) as Record<string, any>
  const assessmentReport = submissions[`assessmentReport_${workstream}`]
  const agentData = await gatherAgentData(clientId, workstream)

  const wsLabel = workstream === 'ws1' ? 'Workstream 1 — Risk Mitigation' : 'Workstream 2 — Profitability & Growth'
  const clientName = client.businessName

  const apiKey = await getAnthropicApiKey()
  if (!apiKey) return new Response('API key not configured', { status: 500 })

  const anthropic = new Anthropic({ apiKey })

  const result = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    temperature: 0.15,
    system: `You are a senior M&A advisor at Cantara Pet Advisors who specializes in helping sellers prepare their businesses for acquisition. You create detailed, actionable improvement roadmaps that tell sellers exactly what to fix, in what order, and by when to maximize their sale price and deal certainty.

Your roadmaps are:
- **Empathetic**: Written directly to the seller, acknowledging their work while being honest about gaps
- **Prioritized**: Organized by impact on deal value and deal certainty
- **Specific**: Each action item has clear steps, not vague recommendations
- **Quantified**: Where possible, estimate the value impact of each improvement
- **Realistic**: Include reasonable timelines and acknowledge resource constraints
- **Beautiful formatting**: Use markdown with clear hierarchy, tables, and progress indicators

Return markdown only. Do not include any preamble.`,
    messages: [{
      role: 'user',
      content: `Generate a comprehensive ${wsLabel} Improvement Roadmap for **${clientName}**.

This roadmap is for the SELLER — it tells them what they need to fix, improve, or prepare to be sale-ready and maximize their business value. It should be encouraging but honest.

## Required Structure

# Sale Readiness Improvement Roadmap
## ${wsLabel}

## Dear ${clientName.split(' ')[0] || 'Seller'},
Write a warm 2-3 paragraph letter to the seller summarizing:
- Their business's current readiness level
- The biggest opportunities to increase value
- Your confidence in their ability to prepare

## Overall Readiness Score
Create a readiness scorecard:
| Category | Current Score | Target Score | Gap | Priority |
|----------|--------------|-------------|-----|----------|
(Score 1-10 for each major category. Be honest but fair.)

**Overall Readiness: X/10** — with explanation

## Immediate Actions (0-30 Days)
### Critical — Must Fix Before Listing
For each item:
- **What**: Specific description of the issue
- **Why**: How it affects deal value or deal certainty
- **How**: Step-by-step actions to resolve
- **Cost**: Estimated cost to fix
- **Value Impact**: Estimated impact on deal value
- **Owner**: Who should handle this (seller, accountant, attorney, etc.)

### Quick Wins — Easy Improvements with High Impact
Same format as above

## Short-Term Actions (30-90 Days)
${workstream === 'ws1' ? `### Legal & Corporate Cleanup
### Insurance & Compliance Updates
### Employment & HR Documentation
### Contract Review & Renewal Strategy
### Tax & Financial Cleanup` :
`### Revenue & Pricing Optimization
### Digital Presence & Marketing Improvements
### Sales Process Improvements
### Competitive Positioning
### Facility & Operations Improvements`}

## Medium-Term Actions (90-180 Days)
Strategic improvements that take longer but significantly increase value

## Documentation Checklist
Create a comprehensive checklist:
| Document | Status | Action Needed | Deadline |
|----------|--------|---------------|----------|
(Mark as: Have / Missing / Needs Update / N/A)

## Estimated Value Impact Summary
| Improvement Category | Est. Value Increase | Confidence | Timeline |
|---------------------|-------------------|------------|----------|
(Quantify where possible)

**Total Estimated Value Increase: $X — $Y** (range)

## Professional Resources Needed
| Resource | Why Needed | Estimated Cost | When |
|----------|-----------|----------------|------|

## Next Steps
Numbered list of the first 5 things the seller should do this week

---

## Source Data

${assessmentReport?.markdown ? `### Assessment Report Summary\n${truncate(assessmentReport.markdown, 6000)}` : ''}

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
        [`improvementRoadmap_${workstream}`]: report,
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
    await addFromSubmissions('Org Chart', 'orgChart')
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
