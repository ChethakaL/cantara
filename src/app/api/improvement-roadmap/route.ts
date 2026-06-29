import Anthropic from '@anthropic-ai/sdk'
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

  if (!(await hasAIConfigured())) return new Response('AI not configured', { status: 500 })

  const anthropic = await requireAIClient()

  const result = await anthropic.messages.create({
    model: resolveModel('claude-sonnet-4-20250514'),
    max_tokens: 16000,
    temperature: 0.15,
    system: `You are a senior M&A advisor at Cantara Pet Advisors who specializes in helping sellers prepare their businesses for acquisition. You create clear, actionable Sales Readiness Roadmaps that tell sellers exactly what to fix, in what order, and why it matters for their deal.

Your reports are:
- **Empathetic**: Written directly to the seller, acknowledging their work while being honest about gaps
- **Visual**: Use GREEN/YELLOW/RED status indicators for every category — never numerical scores
- **Deal-focused**: Every item explains its impact on the deal (will it slow closing, reduce price, scare buyers?)
- **Specific**: Each action item has clear steps, not vague recommendations
- **Realistic**: Include reasonable timelines and acknowledge resource constraints

CRITICAL RULES:
- Do NOT include numerical scores, target scores, readiness scores, or any scoring system with numbers
- Do NOT include cost estimates or "Estimated Cost" columns
- Do NOT include valuation multiples or dollar value impact estimates
- ALWAYS use the exact status indicators: 🟢 GREEN, 🟡 YELLOW, 🔴 RED
- ALWAYS include "Impact on Deal" for every action item and in the summary table

Return markdown only. Do not include any preamble.`,
    messages: [{
      role: 'user',
      content: `Generate a comprehensive ${wsLabel} Sales Readiness Roadmap for **${clientName}**.

This is a SELLER-FACING document. It shows the seller clearly what their current status is and exactly what they need to do to become sale-ready. Be encouraging but honest.

## Required Structure — Follow EXACTLY

# Sales Readiness Roadmap
## ${wsLabel}

## Dear ${clientName.split(' ')[0] || 'Seller'},
Write a warm 2-3 paragraph letter:
- Their business's current readiness level (use plain language, no scores)
- The biggest opportunities to improve sale readiness
- Your confidence in their ability to prepare

## Sale-Readiness Overview

Create a summary table using GREEN/YELLOW/RED indicators. This is the most important visual in the report.
Use the exact category names consistently in every section. For example, if the summary uses "Legal & Corporate Standing", every later reference must use "Legal & Corporate Standing", not "Legal & Corporate".

| Category | Status | Summary | Impact on Deal |
|----------|--------|---------|----------------|
| Category Name | 🟢 GREEN / 🟡 YELLOW / 🔴 RED | One-line summary of current state | How this affects the deal (e.g., "Could delay closing by 2-4 weeks", "Buyer will likely request price reduction", "No impact — ready for diligence") |

${workstream === 'ws1' ? `Categories to assess: Legal & Corporate Standing, Ownership & Transfer Readiness, Contracts & Agreements, Litigation & Liens, Insurance Coverage, Permits & Zoning, Employment & HR, Tax Compliance, Key Person Dependencies, Vendor & Technology` :
`Categories to assess: Revenue & Profitability, Pricing Strategy, Digital Presence & Marketing, Competitive Positioning, Sales Process Maturity, Facility & Operations, Customer Concentration, Growth Trajectory`}

Status definitions:
- 🟢 GREEN = Sale-ready, no action needed. Buyer diligence will pass smoothly.
- 🟡 YELLOW = Needs attention. Fixable, but if left unaddressed could slow the deal or reduce certainty.
- 🔴 RED = Critical gap. Must be resolved before listing or it will materially impact the deal.

## Sale-Readiness Checklist

Create a comprehensive checklist organized by category. This should come before the improvement roadmap because it is the quickest client-facing action view.

| ✅ | Category | Item | Status | Action Needed |
|----|----------|------|--------|---------------|
| ☐ | Category | Specific document or action | 🟢/🟡/🔴 | What to do |

Include at least 15-25 checklist items covering all categories. Mark status as 🟢 (have it), 🟡 (needs update), or 🔴 (missing).
Do not recommend requiring a standalone Seller Non-Compete. If non-compete or restrictive covenant protection is relevant, frame it as a purchase agreement topic instead.

## Sale-Readiness Improvement Roadmap

### Phase 1: Immediate Actions (0-30 Days)
For each action item, use this format:

**Action Item Name** — 🔴 RED / 🟡 YELLOW
- **What**: Description of what needs to be done
- **Why**: Plain-language explanation of why this matters to the seller
- **Impact on Deal**: Specific impact (e.g., "Without this, buyers will request a 10-15% escrow holdback" or "This is a deal-breaker — no buyer will proceed without it")
- **How**: Step-by-step actions to resolve
- **Owner**: Who should handle this (you, your accountant, your attorney, etc.)
- **Timeline**: Realistic timeframe

### Phase 2: Short-Term Actions (30-90 Days)
${workstream === 'ws1' ? `Organize by:
#### Legal & Corporate Standing
#### Ownership & Transfer Readiness
#### Contracts & Agreements
#### Litigation & Liens
#### Insurance Coverage
#### Permits & Zoning
#### Employment & HR
#### Tax Compliance
#### Key Person Dependencies
#### Vendor & Technology` :
`Organize by:
#### Revenue & Profitability
#### Pricing Strategy
#### Digital Presence & Marketing
#### Competitive Positioning
#### Sales Process Maturity
#### Facility & Operations
#### Customer Concentration
#### Growth Trajectory`}

Same format per item (What, Why, Impact on Deal, How, Owner, Timeline)

### Phase 3: Medium-Term Actions (90-180 Days)
Strategic improvements. Same format.

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
  const key = `improvementRoadmap_${workstream}`
  const existing = current[key]
  if (!existing) {
    return new Response('Generate the improvement roadmap before editing.', { status: 404 })
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
