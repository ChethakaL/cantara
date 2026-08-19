import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hasAIConfigured, requireAIClient, resolveModel } from '@/lib/ai-client'
import { gatherCompletedAgentOutputs } from '@/lib/completed-agent-outputs'
import {
  CHECKLIST_SUBMISSION_KEY,
  ROADMAP_SUBMISSION_KEY,
  createChecklistItem,
  extractSaleReadinessChecklist,
  readChecklistSubmission,
  readRoadmapSubmission,
  type SaleReadinessChecklistItem,
  type SaleReadinessRoadmapStage,
} from '@/lib/sale-readiness-checklist'
import { getClientWorkstreamAgents } from '@/lib/workstream-agents'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const ROADMAP_LABEL = 'Sales Readiness Roadmap'

type RoadmapReport = {
  workstream?: string
  workstreamLabel: string
  clientName: string
  generatedAt: string
  updatedAt?: string
  markdown: string
  stage: SaleReadinessRoadmapStage
  checklist?: SaleReadinessChecklistItem[]
  sourceAgents?: string[]
}

function inferStage(report: Record<string, any> | null): SaleReadinessRoadmapStage {
  if (!report) return 'checklist'
  if (report.stage === 'checklist' || report.stage === 'report') return report.stage
  return typeof report.markdown === 'string' && report.markdown.trim().length > 0 ? 'report' : 'checklist'
}

function withChecklist(report: Record<string, any> | null, checklistItems: SaleReadinessChecklistItem[] | undefined, sourceAgents?: string[]): RoadmapReport | null {
  if (!report && !checklistItems?.length) return null
  const stage = inferStage(report)
  return {
    workstream: 'sales-readiness',
    workstreamLabel: ROADMAP_LABEL,
    clientName: report?.clientName ?? 'Client',
    generatedAt: report?.generatedAt ?? new Date().toISOString(),
    updatedAt: report?.updatedAt,
    markdown: typeof report?.markdown === 'string' ? report.markdown : '',
    stage,
    checklist: checklistItems ?? (Array.isArray(report?.checklist) ? report.checklist : []),
    sourceAgents: sourceAgents ?? (Array.isArray(report?.sourceAgents) ? report.sourceAgents : []),
  }
}

async function loadClient(clientId: string) {
  return prisma.clientProfile.findUnique({
    where: { id: clientId },
    include: { customWorkstream: { include: { agents: true } }, ClientWorkstreamAgents: true },
  })
}

function propertyOwnership(submissions: Record<string, unknown>) {
  return submissions.propertyOwnership === 'lease' || submissions.propertyOwnership === 'owns'
    ? (submissions.propertyOwnership as 'lease' | 'owns')
    : ''
}

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return new Response('clientId required', { status: 400 })

  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: { sectionSubmissions: true },
  })
  if (!client) return new Response('Client not found', { status: 404 })

  const submissions = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object' ? client.sectionSubmissions : {}) as Record<string, any>
  const stored = readRoadmapSubmission(submissions)
  const checklistState = readChecklistSubmission(submissions)
  const checklistItems = Array.isArray(checklistState?.items)
    ? checklistState.items
    : Array.isArray(stored?.checklist) ? stored.checklist : []

  return NextResponse.json({ report: withChecklist(stored, checklistItems) })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const clientId = String(body.clientId || '')
  const stage = String(body.stage || 'checklist') as SaleReadinessRoadmapStage
  if (!clientId || (stage !== 'checklist' && stage !== 'report')) {
    return new Response('clientId and stage (checklist|report) required', { status: 400 })
  }

  const client = await loadClient(clientId)
  if (!client) return new Response('Client not found', { status: 404 })
  if (!(await hasAIConfigured())) return new Response('AI not configured', { status: 500 })

  const submissions = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object' ? client.sectionSubmissions : {}) as Record<string, any>
  const assignedAgents = getClientWorkstreamAgents({
    workstream: (client.workstream?.toLowerCase() as any) ?? null,
    customWorkstream: client.customWorkstream as any,
    workstreamAgents: client.ClientWorkstreamAgents as any,
    propertyOwnership: propertyOwnership(submissions),
  })
  const agentData = await gatherCompletedAgentOutputs(clientId, assignedAgents)
  if (!agentData.length) {
    return NextResponse.json({ error: 'No completed agent outputs found. Run at least one agent first.' }, { status: 409 })
  }

  const clientName = client.businessName
  const sourceAgents = agentData.map(agent => agent.agentName)
  const existingReport = readRoadmapSubmission(submissions)
  const existingChecklist = readChecklistSubmission(submissions)
  const submittedItems = Array.isArray(body.checklist)
    ? body.checklist.map((raw: any) => createChecklistItem(raw))
    : null
  const existingItems: SaleReadinessChecklistItem[] = submittedItems
    ?? (Array.isArray(existingChecklist?.items)
      ? existingChecklist.items
      : Array.isArray(existingReport?.checklist) ? existingReport.checklist : [])

  if (stage === 'checklist') {
    const markdown = await generateChecklistMarkdown({ clientName, agentData })
    const checklistItems = extractSaleReadinessChecklist(markdown, existingItems)
    if (!checklistItems.length) {
      return NextResponse.json({ error: 'The checklist could not be generated from the current agent outputs. Try again after more agents have run.' }, { status: 422 })
    }
    const report = await saveRoadmap(clientId, submissions, {
      workstream: 'sales-readiness',
      workstreamLabel: ROADMAP_LABEL,
      clientName,
      generatedAt: new Date().toISOString(),
      markdown: '',
      stage: 'checklist',
      checklist: checklistItems,
      sourceAgents,
    }, checklistItems)
    return NextResponse.json({ report })
  }

  const approved = existingItems.filter(item => item.advisorApproved && (item.item || item.category))
  if (!approved.length) {
    return NextResponse.json({ error: 'Approve at least one checklist item before generating the full report.' }, { status: 409 })
  }

  const markdown = await generateFullReportMarkdown({
    clientName,
    agentData,
    approved,
    skipped: existingItems.filter(item => !item.advisorApproved),
  })
  const report = await saveRoadmap(clientId, submissions, {
    workstream: 'sales-readiness',
    workstreamLabel: ROADMAP_LABEL,
    clientName,
    generatedAt: existingReport?.generatedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    markdown,
    stage: 'report',
    checklist: existingItems,
    sourceAgents,
  }, existingItems)
  return NextResponse.json({ report })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const clientId = String(body.clientId || '')
  const markdown = typeof body.markdown === 'string' ? body.markdown : null

  if (!clientId || markdown === null) {
    return new Response('clientId and markdown required', { status: 400 })
  }

  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: { sectionSubmissions: true },
  })
  if (!client) return new Response('Client not found', { status: 404 })

  const current = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object'
    ? client.sectionSubmissions
    : {}) as Record<string, any>
  const existing = readRoadmapSubmission(current)
  if (!existing) {
    return new Response('Generate the sales readiness roadmap before editing.', { status: 404 })
  }
  const existingChecklist = readChecklistSubmission(current)
  const checklistItems: SaleReadinessChecklistItem[] = Array.isArray(existingChecklist?.items)
    ? existingChecklist.items
    : Array.isArray(existing.checklist) ? existing.checklist : []

  const report = await saveRoadmap(clientId, current, {
    ...existing,
    workstreamLabel: ROADMAP_LABEL,
    markdown,
    checklist: checklistItems,
    stage: 'report',
    updatedAt: new Date().toISOString(),
  }, checklistItems)

  return NextResponse.json({ report })
}

async function saveRoadmap(
  clientId: string,
  current: Record<string, any>,
  report: RoadmapReport,
  checklistItems: SaleReadinessChecklistItem[],
) {
  const nextReport = withChecklist(report, checklistItems, report.sourceAgents)!
  await prisma.clientProfile.update({
    where: { id: clientId },
    data: {
      sectionSubmissions: {
        ...current,
        [ROADMAP_SUBMISSION_KEY]: nextReport,
        [CHECKLIST_SUBMISSION_KEY]: {
          workstream: 'sales-readiness',
          clientName: nextReport.clientName,
          generatedAt: nextReport.generatedAt,
          updatedAt: nextReport.updatedAt,
          items: checklistItems,
        },
      },
    },
  })
  return nextReport
}

function agentDataBlock(agentData: Array<{ agentName: string; excerpt: string }>) {
  return agentData.map(agent => `### ${agent.agentName}\n${agent.excerpt}`).join('\n\n')
}

function checklistTable(items: SaleReadinessChecklistItem[]) {
  if (!items.length) return '_None._'
  return [
    '| Category | Item | Status | Action Needed |',
    '|----------|------|--------|---------------|',
    ...items.map(item => `| ${item.category} | ${item.item} | ${item.status} | ${item.actionNeeded} |`),
  ].join('\n')
}

async function generateChecklistMarkdown(args: {
  clientName: string
  agentData: Array<{ agentName: string; excerpt: string }>
}) {
  const anthropic = await requireAIClient()
  const result = await anthropic.messages.create({
    model: resolveModel('claude-sonnet-4-20250514'),
    max_tokens: 8000,
    temperature: 0.15,
    system: `You are a senior M&A advisor at Cantara Pet Advisors. You create a sale-readiness checklist from completed diligence agent outputs only. Do not invent findings that are not supported by the source data. Return markdown only.`,
    messages: [{
      role: 'user',
      content: `Create a Sale-Readiness Checklist for **${args.clientName}** using ONLY the completed agent outputs below.

Completed agents: ${args.agentData.map(agent => agent.agentName).join(', ')}

Rules:
- Cover only categories supported by the source outputs. Do not add WS1/WS2 filler categories with no evidence.
- Include 12-25 specific checklist items.
- ALWAYS use status indicators: 🟢 GREEN, 🟡 YELLOW, 🔴 RED.
- GREEN = sale-ready. YELLOW = needs attention. RED = critical gap.
- Do not include numerical scores, cost estimates, or valuation multiples.
- Do not recommend a standalone Seller Non-Compete. If relevant, frame it as a purchase agreement topic.

Return exactly this structure:

# Sales Readiness Checklist

## Sale-Readiness Checklist

| ✅ | Category | Item | Status | Action Needed |
|----|----------|------|--------|---------------|
| ☐ | Category | Specific document or action | 🟢 GREEN / 🟡 YELLOW / 🔴 RED | What to do |

## Source Data

${agentDataBlock(args.agentData)}`,
    }],
  })
  return result.content.filter(block => block.type === 'text').map(block => block.text).join('\n').trim()
}

async function generateFullReportMarkdown(args: {
  clientName: string
  agentData: Array<{ agentName: string; excerpt: string }>
  approved: SaleReadinessChecklistItem[]
  skipped: SaleReadinessChecklistItem[]
}) {
  const firstName = args.clientName.split(' ')[0] || 'Seller'
  const anthropic = await requireAIClient()
  const result = await anthropic.messages.create({
    model: resolveModel('claude-sonnet-4-20250514'),
    max_tokens: 16000,
    temperature: 0.15,
    system: `You are a senior M&A advisor at Cantara Pet Advisors who specializes in helping sellers prepare their businesses for acquisition. You create clear, actionable Sales Readiness Roadmaps that tell sellers exactly what to fix, in what order, and why it matters for their deal.

Your reports are:
- **Empathetic**: Written directly to the seller, acknowledging their work while being honest about gaps
- **Visual**: Use GREEN/YELLOW/RED status indicators for every category — never numerical scores
- **Deal-focused**: Every item explains its impact on the deal
- **Specific**: Each action item has clear steps, not vague recommendations
- **Realistic**: Include reasonable timelines and acknowledge resource constraints

CRITICAL RULES:
- Build the action plan ONLY from advisor-approved checklist items
- Use the advisor's exact edited wording for Category, Item, Status, and Action Needed. Do not rewrite or "improve" those fields.
- Clearly tell the seller what the advisor approved and what was intentionally excluded
- Do NOT include numerical scores, target scores, readiness scores, or any scoring system with numbers
- Do NOT include cost estimates or "Estimated Cost" columns
- Do NOT include valuation multiples or dollar value impact estimates
- ALWAYS use the exact status indicators: 🟢 GREEN, 🟡 YELLOW, 🔴 RED
- ALWAYS include "Impact on Deal" for every action item and in the summary table
- Use the exact approved category names consistently in every section
- Do not recommend requiring a standalone Seller Non-Compete

Return markdown only. Do not include any preamble.`,
    messages: [{
      role: 'user',
      content: `Generate a comprehensive Sales Readiness Roadmap for **${args.clientName}**.

This is a SELLER-FACING document. The advisor has already reviewed and edited the checklist. Use the approved items EXACTLY as written — including the advisor's wording for category, item, status, and action needed. Do not replace their text with your own phrasing.

## Advisor-Approved Checklist Items
These items MUST drive the overview, checklist, red/yellow actions, and deep dive. Copy the Item and Action Needed text as the advisor wrote it.

${checklistTable(args.approved)}

## Checklist Items Intentionally Not Approved
Do not turn these into action items. Mention them only in Advisor Review Notes as items the advisor chose not to include.

${checklistTable(args.skipped)}

## Required Structure — Follow EXACTLY

# Sales Readiness Roadmap

## Dear ${firstName},
Write a warm 2-3 paragraph letter:
- Their business's current readiness level (use plain language, no scores)
- The biggest opportunities to improve sale readiness based on approved items
- Your confidence in their ability to prepare

## Advisor Review Notes
- How many checklist items were approved vs not approved
- That the rest of this report is based on the approved items
- A short list of excluded items, if any, and that they were intentionally left out of the action plan

## Sale-Readiness Overview

Create a summary table that rolls up the APPROVED checklist findings by category. Each row shows the COUNT of red, yellow, and green items within that category, plus a summary and deal impact.

| Category | 🔴 Red | 🟡 Yellow | 🟢 Green | Summary | Impact on Deal |
|----------|--------|-----------|----------|---------|----------------|

The counts in each row MUST match the approved checklist items for that same category.

Status definitions:
- 🟢 GREEN = Sale-ready, no action needed. Buyer diligence will pass smoothly.
- 🟡 YELLOW = Needs attention. Fixable, but if left unaddressed could slow the deal or reduce certainty.
- 🔴 RED = Critical gap. Must be resolved before listing or it will materially impact the deal.

## Sale-Readiness Checklist

Repeat the approved checklist only.

| ✅ | Category | Item | Status | Action Needed |
|----|----------|------|--------|---------------|
| ☐ | Category | Specific document or action | 🟢/🟡/🔴 | What to do |

## Red Flag Action Items

List ALL 🔴 RED items from the APPROVED checklist, grouped by category:

**[Category Name] — [Issue Name]** 🔴 RED
- **What**: What specifically needs to be done
- **Why**: Why this matters to the seller
- **Impact on Deal**: Specific impact if left unresolved
- **How**: Step-by-step actions to resolve
- **Owner**: Who handles this (you, your accountant, your attorney)

## Yellow Flag Action Items

List ALL 🟡 YELLOW items from the APPROVED checklist, grouped by category. Same format as above.

## Deep Dive by Category

Provide a thorough category-by-category breakdown for APPROVED findings only. Use the approved category names as headings. For each item: What, Why, Impact on Deal, How, Owner.

---

## Source Data

Completed agents: ${args.agentData.map(agent => agent.agentName).join(', ')}

${agentDataBlock(args.agentData)}`,
    }],
  })
  return result.content.filter(block => block.type === 'text').map(block => block.text).join('\n').trim()
}
