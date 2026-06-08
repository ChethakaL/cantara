import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnthropicApiKey } from '@/lib/secure-settings'
import { getClientWorkstreamAgents, normalizeAgentStatusKey } from '@/lib/workstream-agents'

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
  const key = `assessmentReport_${workstream}`
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

  // Gather all agent excerpts for this workstream
  const agentData = await gatherAgentData(clientId, workstream)

  const wsLabel = workstream === 'ws1' ? 'Workstream 1 — Risk Mitigation' : 'Workstream 2 — Profitability & Growth'

  const apiKey = await getAnthropicApiKey()
  if (!apiKey) return new Response('API key not configured', { status: 500 })

  const anthropic = new Anthropic({ apiKey })

  const result = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    temperature: 0.15,
    system: `You are a senior M&A advisory analyst at Cantara Pet Advisors. You produce beautiful, comprehensive, investment-grade assessment reports that synthesize findings from multiple due diligence agents into a single cohesive document.

Your reports are read by managing directors, buyers, and deal teams. They must be:
- **Exhaustive**: Cover every agent's findings — do not skip or summarize away important details
- **Cross-referenced**: Connect findings across agents (e.g., lease issues + insurance gaps = compounded risk)
- **Quantified**: Include dollar amounts, percentages, counts, and dates wherever available
- **Actionable**: Every finding should connect to a recommendation
- **Beautiful formatting**: Use markdown with clear hierarchy, tables, bullet points, and bold emphasis

Return markdown only. Do not include any preamble or meta-commentary.`,
    messages: [{
      role: 'user',
      content: `Generate a comprehensive ${wsLabel} Assessment Report for **${client.businessName}**.

This is a high-stakes M&A due diligence assessment. The report MUST be detailed, thorough, and suitable for presentation to a buyer's deal team.

## Required Structure

# ${wsLabel} — Due Diligence Assessment Report

## Executive Summary
Write 3-4 paragraphs covering:
- Overall assessment of the business across all ${workstream === 'ws1' ? 'risk and legal' : 'profitability and growth'} dimensions
- Key strengths that enhance deal attractiveness
- Critical risks or gaps that require attention
- Recommended deal structure considerations (escrow, indemnification, representations & warranties)

## Risk Heat Map
Create a table with ALL agent categories:
| Category | Risk Level | Key Finding | Impact on Deal |
|----------|-----------|-------------|----------------|
(Use High/Medium/Low risk levels. Be specific about findings.)

${workstream === 'ws1' ? `## Legal & Compliance Assessment
### Entity & Corporate Standing
### Ownership Structure & Transfer Readiness
### Contracts & Agreements Analysis
### Litigation & Liens Exposure
### Insurance Coverage Assessment
### Permits, Zoning & Regulatory Compliance
### Employment & Labor Compliance
### Tax Compliance & Liability

## Operational Risk Assessment
### Lease & Real Estate
### Key Person Dependencies
### Vendor & Technology Dependencies
### Organizational Structure

## Financial Risk Indicators
(Cross-reference from valuation agent findings if available)` :

`## Financial Performance Assessment
### Revenue Analysis & Trends
### Profitability & EBITDA Quality
### Revenue by Vertical / Service Line
### Expense Benchmarking vs Industry

## Market Position Assessment
### Competitive Landscape
### Digital Presence & Online Reputation
### Pricing Strategy vs Competitors
### Market Share & Growth Opportunities

## Sales & Growth Assessment
### Sales Process Maturity
### Customer Acquisition & Retention
### Revenue Concentration Risk
### Growth Trajectory

## Operational Performance
### Facility Assessment
### Capacity & Scalability`}

## Cross-Agent Risk Correlations
Identify where findings from different agents compound or contradict each other. For example:
- Insurance gaps + active litigation = heightened exposure
- Strong revenue growth + key person dependency = transition risk
- Good compliance + poor documentation = fixable but risky

## Quantified Risk Summary
Create a detailed table:
| Risk Category | Estimated Exposure | Probability | Expected Impact | Recommended Mitigation |
|--------------|-------------------|-------------|-----------------|----------------------|

## Recommendations for Deal Team
- Numbered list of specific, actionable recommendations
- Each should reference which agent(s) surfaced the finding
- Include timeline recommendations (pre-closing vs post-closing)

## Data Gaps & Additional Diligence Needed
List any areas where agent data was limited and what additional investigation is recommended.

---

## Agent Data Available

${agentData.map(a => `### ${a.agentName}
${a.excerpt || 'No data available for this agent.'}`).join('\n\n')}`,
    }],
  })

  const markdown = result.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim()

  const report = {
    workstream,
    workstreamLabel: wsLabel,
    clientName: client.businessName,
    generatedAt: new Date().toISOString(),
    markdown,
  }

  // Save to sectionSubmissions
  const current = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object' ? client.sectionSubmissions : {}) as Record<string, any>
  await prisma.clientProfile.update({
    where: { id: clientId },
    data: {
      sectionSubmissions: {
        ...current,
        [`assessmentReport_${workstream}`]: report,
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
        select: { [textField]: true, createdAt: true },
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
      const client = await prisma.clientProfile.findUnique({ where: { id: clientId }, select: { sectionSubmissions: true } })
      const submissions = (client?.sectionSubmissions && typeof client.sectionSubmissions === 'object' ? client.sectionSubmissions : {}) as Record<string, any>
      const data = submissions[key]
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
    await addFromSubmissions('Employee Staffing & Compensation', 'employeeCompReport')
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
