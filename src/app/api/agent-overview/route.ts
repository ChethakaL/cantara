import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnthropicApiKey } from '@/lib/secure-settings'
import { getClientWorkstreamAgents, normalizeAgentStatusKey } from '@/lib/workstream-agents'
import type { AgentOverviewReport } from '@/lib/report-export/build-agent-overview-report'

export const dynamic = 'force-dynamic'

type AgentStatus = {
  agentId: string
  agentName: string
  completed: boolean
  completedAt: string | null
  source: string | null
  excerpt: string | null
}

type StoredOverviewReports = Record<string, AgentOverviewReport>

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return new Response('Admin access required', { status: 403 })
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return new Response('clientId required', { status: 400 })

  const data = await buildOverviewState(clientId)
  if (!data) return new Response('Client not found', { status: 404 })
  const stored = getStoredReports(data.client.sectionSubmissions)[data.workstreamKey] ?? null
  return NextResponse.json(publicOverviewState(data, stored))
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return new Response('Admin access required', { status: 403 })
  const body = await req.json().catch(() => ({}))
  const clientId = String(body.clientId || '')
  if (!clientId) return new Response('clientId required', { status: 400 })

  const data = await buildOverviewState(clientId)
  if (!data) return new Response('Client not found', { status: 404 })
  if (!data.complete) {
      return NextResponse.json({ error: 'All agents in this workstream must be completed.', incompleteAgents: data.incompleteAgents }, { status: 409 })
  }

  const markdown = await generateSummaryMarkdown({
    clientName: data.client.businessName,
    workstreamLabel: data.workstreamLabel,
    agents: data.agents,
  })

  const report: AgentOverviewReport = {
    workstreamLabel: data.workstreamLabel,
    clientName: data.client.businessName,
    generatedAt: new Date().toISOString(),
    generatedBy: 'Cantara Admin',
    markdown,
    agents: data.agents.map(({ agentId, agentName, completed, completedAt }) => ({ agentId, agentName, completed, completedAt })),
  }

  const current = (data.client.sectionSubmissions && typeof data.client.sectionSubmissions === 'object' ? data.client.sectionSubmissions : {}) as Record<string, unknown>
  const reports = getStoredReports(current)
  await prisma.clientProfile.update({
    where: { id: clientId },
    data: {
      sectionSubmissions: {
        ...current,
        agentOverviewReports: {
          ...reports,
          [data.workstreamKey]: report,
        },
      },
    },
  })

  return NextResponse.json(publicOverviewState(data, report))
}

function isAdmin(req: NextRequest) {
  return req.cookies.get('cantara_role')?.value?.toLowerCase() === 'admin'
}

async function buildOverviewState(clientId: string) {
  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    include: { customWorkstream: { include: { agents: true } }, ClientWorkstreamAgents: true },
  })
  if (!client) return null

  const workstreamKey = String(client.customWorkstreamId || client.workstream || 'unassigned').toLowerCase()
  const workstreamLabel = client.customWorkstream?.name || labelWorkstream(String(client.workstream || 'Unassigned'))
  const selectedAgents = getClientWorkstreamAgents({
    workstream: (client.workstream?.toLowerCase() as any) ?? null,
    customWorkstream: client.customWorkstream as any,
    workstreamAgents: client.ClientWorkstreamAgents as any,
  })
  const agents = await Promise.all(selectedAgents.map(agent => buildAgentStatus(clientId, agent.agentId, agent.agentName)))
  const incompleteAgents = agents.filter(agent => !agent.completed).map(agent => agent.agentName)

  return {
    client,
    workstreamKey,
    workstreamLabel,
    agents,
    complete: agents.length > 0 && incompleteAgents.length === 0,
    incompleteAgents,
  }
}

async function buildAgentStatus(clientId: string, agentId: string, agentName: string): Promise<AgentStatus> {
  const key = normalizeAgentStatusKey(agentId)
  const latest = await latestAgentRecord(clientId, key)
  return {
    agentId,
    agentName,
    completed: Boolean(latest),
    completedAt: latest?.createdAt ?? null,
    source: latest?.source ?? null,
    excerpt: latest?.excerpt ?? null,
  }
}

async function latestAgentRecord(clientId: string, key: string): Promise<{ createdAt: string; source: string; excerpt: string } | null> {
  const latest = async (delegate: any, select: Record<string, boolean>, source: string, textField: string) => {
    if (!delegate?.findFirst) return null
    const row = await delegate.findFirst({ where: { clientId }, orderBy: { createdAt: 'desc' }, select })
    if (!row) return null
    return {
      createdAt: new Date(row.createdAt || row.updatedAt || Date.now()).toISOString(),
      source,
      excerpt: excerpt(row[textField] ?? row.reportMarkdown ?? row.markdown ?? row.report ?? row.summary ?? row.parsed ?? row.parsedReport),
    }
  }

  if (key === 'ttm' || key === 'ttmAnalysis') {
    const ttm = await latest((prisma as any).ttmAnalysis, { createdAt: true, reportMarkdown: true, summary: true }, 'Valuation Agent', 'reportMarkdown')
    if (ttm) return ttm
  }
  if (key === 'lease') return latest((prisma as any).leaseAnalysis, { createdAt: true, report: true, parsed: true }, 'Lease Analysis', 'report')
  if (key === 'contract') return latest((prisma as any).contractAnalysis, { createdAt: true, report: true, parsed: true }, 'Material Contracts', 'report')
  if (key === 'competitor') return latest((prisma as any).competitorAnalysis, { createdAt: true, report: true, parsed: true }, 'Competitor Analysis', 'report')
  if (key === 'employeeObligations') return latest((prisma as any).employeeObligationsReport, { createdAt: true, markdown: true, metadata: true }, 'Employee Obligations', 'markdown')
  if (key === 'ownershipVerification') return latest((prisma as any).ownershipVerificationReport, { createdAt: true, markdown: true, metadata: true }, 'Ownership Verification', 'markdown')
  if (key === 'permitsZoning') return latest((prisma as any).permitsZoningReport, { createdAt: true, markdown: true, metadata: true }, 'Permits & Zoning', 'markdown')
  if (key === 'insuranceReview') {
    const doc = await (prisma as any).clientDocument.findFirst({
      where: { clientId, documentId: 'insurance_claims_12m' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, fileName: true, aiReviewSummary: true, aiReviewStatus: true, aiDetectedType: true, aiReviewFlags: true },
    })
    if (!doc?.aiReviewSummary && !doc?.aiReviewStatus) return null
    return {
      createdAt: new Date(doc.createdAt || Date.now()).toISOString(),
      source: 'Insurance Review',
      excerpt: excerpt({
        fileName: doc.fileName,
        status: doc.aiReviewStatus,
        claimType: doc.aiDetectedType,
        flags: doc.aiReviewFlags,
        summary: doc.aiReviewSummary,
      }),
    }
  }
  if (key === 'salesProcessReview') {
    const doc = await (prisma as any).clientDocument.findFirst({
      where: { clientId, documentId: 'sales_process_transcript' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, fileName: true, aiReviewSummary: true, aiReviewStatus: true, aiReviewFlags: true },
    })
    if (!doc?.aiReviewSummary && !doc?.aiReviewStatus) return null
    return {
      createdAt: new Date(doc.createdAt || Date.now()).toISOString(),
      source: 'Sales Process Review',
      excerpt: excerpt({
        fileName: doc.fileName,
        status: doc.aiReviewStatus,
        flags: doc.aiReviewFlags,
        summary: doc.aiReviewSummary,
      }),
    }
  }

  const client = await prisma.clientProfile.findUnique({ where: { id: clientId }, select: { sectionSubmissions: true, updatedAt: true } })
  const submissions = (client?.sectionSubmissions && typeof client.sectionSubmissions === 'object' ? client.sectionSubmissions : {}) as Record<string, any>
  const submission = key === 'ttm' || key === 'ttmAnalysis'
    ? submissions.valuation
    : key === 'employeeComp'
      ? submissions.employeeCompReport || submissions.employeeComp
      : submissions[key]
  if (!submission) return null
  return {
    createdAt: new Date(submission.submittedAt || submission.generatedAt || client?.updatedAt || Date.now()).toISOString(),
    source: key,
    excerpt: excerpt(submission),
  }
}

async function generateSummaryMarkdown(args: { clientName: string; workstreamLabel: string; agents: AgentStatus[] }) {
  const fallback = deterministicSummary(args)
  const apiKey = await getAnthropicApiKey()
  if (!apiKey) return fallback

  try {
    const anthropic = new Anthropic({ apiKey })
    const result = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6000,
      temperature: 0.2,
      system: 'You write thorough internal Cantara workstream summary reports for admins. Use only supplied agent outputs. Do not invent facts. Return markdown only.',
      messages: [{
        role: 'user',
        content: `Client: ${args.clientName}
Workstream: ${args.workstreamLabel}

Create one detailed executive overview report. It must be long enough to cover every completed agent. Do not skip agents, even if the excerpt is short.

Use exactly these sections:
## Executive Summary
## Agent-by-Agent Summary
For every completed agent below, create a subsection named "### [Agent Name]" with:
- What the agent reviewed
- Key findings
- Risks or gaps
- Recommended follow-up

## Cross-Agent Key Findings
## Cross-Agent Risks and Gaps
## Cross-Agent Opportunities
## Recommended Next Actions

Formatting rules:
- Use markdown headings, bullet lists, and tables where helpful.
- Include all agents listed below.
- If an agent has limited details, say what is available and what should be reviewed in the underlying report.
- Keep the executive summary concise, but make the agent-by-agent section substantive.

Agent outputs:
${args.agents.map(agent => `### ${agent.agentName}\nCompleted: ${agent.completed ? 'yes' : 'no'}\nExcerpt:\n${agent.excerpt || 'No excerpt available.'}`).join('\n\n')}`,
      }],
    })
    const text = result.content.filter(block => block.type === 'text').map(block => block.text).join('\n').trim()
    return text || fallback
  } catch (error) {
    console.error('[agent-overview] Claude summary failed; using fallback.', error)
    return fallback
  }
}

function deterministicSummary(args: { clientName: string; workstreamLabel: string; agents: AgentStatus[] }) {
  return `## Executive Summary
${args.clientName} has completed ${args.workstreamLabel}. This overview consolidates the completed agent outputs for admin review.

## Agent-by-Agent Summary
${args.agents.map(agent => `### ${agent.agentName}
- **Status:** ${agent.completed ? 'Completed' : 'Not completed'}
- **Summary:** ${agent.excerpt || 'Completed report available for admin review.'}
- **Recommended follow-up:** Review the underlying ${agent.agentName} output before final buyer-facing materials are prepared.`).join('\n\n')}

## Cross-Agent Key Findings
- The completed workstream agents provide a consolidated diligence view across financial, legal, operational, digital, staffing, and process areas.
- Review the agent-by-agent findings above for the specific evidence behind each conclusion.

## Cross-Agent Risks and Gaps
- Review each underlying agent report before sending any client-facing materials.
- Validate any recommendations that depend on external counsel, market data, or financial assumptions.

## Cross-Agent Opportunities
- Use the completed reports to identify pricing, process, staffing, digital presence, vendor, and transition planning improvements.

## Recommended Next Actions
- Use this overview as the admin starting point for final diligence discussion.
- Export the report as PDF and archive it with the workstream package.`
}

function getStoredReports(sectionSubmissions: unknown): StoredOverviewReports {
  const submissions = sectionSubmissions && typeof sectionSubmissions === 'object' ? sectionSubmissions as Record<string, unknown> : {}
  const reports = submissions.agentOverviewReports
  return reports && typeof reports === 'object' && !Array.isArray(reports) ? reports as StoredOverviewReports : {}
}

function labelWorkstream(value: string) {
  const labels: Record<string, string> = {
    WS1: 'Workstream 1 - Risk & Legal',
    WS2: 'Workstream 2 - Performance',
    BOTH: 'Workstream 1 and 2',
    MA: 'M&A Sale Process',
  }
  return labels[value.toUpperCase()] ?? value
}

function publicOverviewState(data: NonNullable<Awaited<ReturnType<typeof buildOverviewState>>>, report: AgentOverviewReport | null) {
  return {
    workstreamKey: data.workstreamKey,
    workstreamLabel: data.workstreamLabel,
    agents: data.agents.map(({ agentId, agentName, completed, completedAt }) => ({ agentId, agentName, completed, completedAt })),
    complete: data.complete,
    incompleteAgents: data.incompleteAgents,
    report,
  }
}

function excerpt(value: unknown) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value ?? '')
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3500)
}
