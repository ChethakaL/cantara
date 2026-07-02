import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientWorkstreamAgents, normalizeAgentStatusKey } from '@/lib/workstream-agents'
import { clientPortalReleasedAt, isClientPortalAgentReleased } from '@/lib/client-approved-agents'

export const dynamic = 'force-dynamic'

type OutputItem = {
  agentId: string
  agentKey: string
  agentName: string
  approvedAt: string | null
  markdown: string
  data: unknown
}

const AGENT_OUTPUTS: Record<string, { label: string; source: 'table' | 'submission'; table?: string; field?: string; key?: string }> = {
  ttmAnalysis: { label: 'Valuation Agent', source: 'table', table: 'ttmAnalysis', field: 'reportMarkdown' },
  lease: { label: 'Lease Analysis', source: 'table', table: 'leaseAnalysis', field: 'report' },
  contract: { label: 'Material Contracts', source: 'table', table: 'contractAnalysis', field: 'report' },
  competitor: { label: 'Competitor Analysis', source: 'table', table: 'competitorAnalysis', field: 'report' },
  employeeObligations: { label: 'Employee Obligations', source: 'table', table: 'employeeObligationsReport', field: 'markdown' },
  ownershipVerification: { label: 'Ownership Verification', source: 'table', table: 'ownershipVerificationReport', field: 'markdown' },
  permitsZoning: { label: 'Permits & Zoning', source: 'table', table: 'permitsZoningReport', field: 'markdown' },
  legalEntitySearch: { label: 'Legal Reports & Entity Search', source: 'table', table: 'legalEntitySearchReport', field: 'markdown' },
  taxLiabilityReview: { label: 'Tax Liability Review', source: 'table', table: 'taxLiabilityReport', field: 'markdown' },
  employeeComp: { label: 'Employee Staffing & Compensation', source: 'submission', key: 'employeeCompReport' },
  insuranceReview: { label: 'Insurance Review', source: 'submission', key: 'insuranceReview' },
  litigationSearch: { label: 'Litigation & Liens', source: 'submission', key: 'litigationSearch' },
  orgChart: { label: 'Org Chart Review', source: 'submission', key: 'orgChart' },
  ownerGmAssessment: { label: 'Owner & GM Assessment', source: 'submission', key: 'ownerGmAssessment' },
  professionalAdvisors: { label: 'Professional Advisors', source: 'submission', key: 'professionalAdvisors' },
  vendorDirectory: { label: 'Software & Vendors', source: 'submission', key: 'vendorDirectory' },
  digitalPresence: { label: 'Digital Presence', source: 'submission', key: 'digitalPresence' },
  facilityReview: { label: 'Facility Review Agent', source: 'submission', key: 'facilityReview' },
  occupancyReview: { label: 'Occupancy Review', source: 'submission', key: 'occupancyReview' },
  pricingAnalysis: { label: 'Competitive Pricing Analysis', source: 'submission', key: 'pricingAnalysis' },
  pricingVertical: { label: 'Pricing by Vertical', source: 'submission', key: 'pricingVertical' },
  salesProcessReview: { label: 'Sales Process Review', source: 'submission', key: 'salesProcessReview' },
  clientLocationMap: { label: 'Client Location Map', source: 'submission', key: 'clientLocationMap' },
  cim: { label: 'CIM Generator', source: 'table', table: 'cimReport', field: 'data' },
  teaser: { label: 'Deal Teaser Generator', source: 'table', table: 'teaserReport', field: 'data' },
  net_proceeds: { label: 'Net Proceeds Calculator', source: 'submission', key: 'netProceeds' },
  ws1Assessment: { label: 'WS1 Assessment Report', source: 'submission', key: 'assessmentReport_ws1' },
  ws2Assessment: { label: 'WS2 Assessment Report', source: 'submission', key: 'assessmentReport_ws2' },
  ws1Roadmap: { label: 'WS1 Sales Readiness Roadmap', source: 'submission', key: 'improvementRoadmap_ws1' },
  ws2Roadmap: { label: 'WS2 Sales Readiness Roadmap', source: 'submission', key: 'improvementRoadmap_ws2' },
}

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return new Response('clientId required', { status: 400 })

  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    include: { customWorkstream: { include: { agents: true } }, ClientWorkstreamAgents: true },
  })
  if (!client) return new Response('Client not found', { status: 404 })

  const submissions = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object'
    ? client.sectionSubmissions
    : {}) as Record<string, any>
  const releases = (client.clientRelease && typeof client.clientRelease === 'object'
    ? client.clientRelease
    : {}) as Record<string, any>
  const assignedAgents = getClientWorkstreamAgents({
    workstream: (client.workstream?.toLowerCase() as any) ?? null,
    customWorkstream: client.customWorkstream as any,
    workstreamAgents: client.ClientWorkstreamAgents as any,
  })

  const outputs: OutputItem[] = []
  const seen = new Set<string>()
  const legalEntityAdvisorToRun = submissions.legalEntityAdvisorToRun === true

  for (const agent of assignedAgents) {
    const agentKey = normalizeAgentStatusKey(agent.agentId)
    if (seen.has(agentKey)) continue
    seen.add(agentKey)

    if (agentKey === 'legalEntitySearch' && legalEntityAdvisorToRun) {
      const report = await prisma.legalEntitySearchReport.findFirst({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      })
      if (!report) {
        outputs.push({
          agentId: agent.agentId,
          agentKey,
          agentName: AGENT_OUTPUTS.legalEntitySearch.label,
          approvedAt: null,
          markdown: 'Advisor is running this search.',
          data: { type: 'advisorToRunPlaceholder' },
        })
      }
      continue
    }

    if (!isClientPortalAgentReleased(releases, agent.agentId)) continue

    const config = AGENT_OUTPUTS[agentKey]
    if (!config) continue
    const output = await readOutput(
      clientId,
      submissions,
      config,
      agentKey,
      client.businessName || 'Client',
      client.businessAddress || '',
    )
    if (!output.markdown.trim() && !output.data) continue

    outputs.push({
      agentId: agent.agentId,
      agentKey,
      agentName: config.label || agent.agentName,
      approvedAt: clientPortalReleasedAt(releases, agent.agentId) ?? null,
      markdown: output.markdown,
      data: output.data,
    })
  }

  return NextResponse.json({ outputs })
}

async function readOutput(
  clientId: string,
  submissions: Record<string, any>,
  config: { source: 'table' | 'submission'; table?: string; field?: string; key?: string },
  agentKey: string,
  clientName: string,
  businessAddress: string,
) {
  if (agentKey === 'ttmAnalysis') return readValuationOutput(clientId, clientName)

  if (agentKey === 'digitalPresence') {
    const report = submissions.digitalPresence
    if (!report) return { markdown: '', data: null }
    return {
      markdown: '',
      data: {
        type: 'digitalPresence',
        report,
      },
    }
  }

  if (agentKey === 'salesProcessReview') {
    return readSalesProcessReviewOutput(clientId)
  }

  if (agentKey === 'clientLocationMap') {
    const mapData = submissions.clientLocationMap
    if (!mapData?.clients?.length) return { markdown: '', data: null }
    return {
      markdown: '',
      data: {
        type: 'clientLocationMap',
        clientId,
        clientName,
        businessAddress,
        mapData,
      },
    }
  }

  if (config.source === 'submission') {
    return serializeValue(config.key ? submissions[config.key] : null)
  }

  const delegate = config.table ? (prisma as any)[config.table] : null
  if (!delegate?.findFirst && !delegate?.findUnique) return { markdown: '', data: null }
  try {
    const row = config.table === 'cimReport' || config.table === 'teaserReport'
      ? await delegate.findUnique({ where: { clientId }, select: { [config.field || 'data']: true } })
      : await delegate.findFirst({
          where: { clientId },
          orderBy: { createdAt: 'desc' },
          select: { [config.field || 'report']: true },
        })
    return serializeValue(row?.[config.field || 'report'])
  } catch {
    return { markdown: '', data: null }
  }
}

async function readValuationOutput(clientId: string, clientName: string): Promise<{ markdown: string; data: unknown }> {
  const row = await prisma.ttmAnalysis.findFirst({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
    include: {
      flags: true,
      dispatchTasks: true,
      derivedReports: true,
      recastAnalyses: {
        where: { status: 'APPROVED' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { flags: true },
      },
    },
  })
  if (!row) return { markdown: '', data: null }
  const recast = row.recastAnalyses?.[0] ?? null
  const analysisView = {
    ...row,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    flags: row.flags.map((flag) => ({
      ...flag,
      resolvedAt: flag.resolvedAt?.toISOString() ?? null,
      createdAt: flag.createdAt.toISOString(),
      updatedAt: flag.updatedAt.toISOString(),
    })),
    dispatchTasks: row.dispatchTasks.map((task) => ({
      ...task,
      releasedAt: task.releasedAt?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    })),
    derivedReports: row.derivedReports.map((report) => ({
      ...report,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
    })),
    recastAnalyses: [],
  }
  const recastView = recast
    ? {
        ...recast,
        approvedAt: recast.approvedAt?.toISOString() ?? null,
        createdAt: recast.createdAt.toISOString(),
        updatedAt: recast.updatedAt.toISOString(),
        flags: recast.flags.map((flag) => ({
          ...flag,
          resolvedAt: flag.resolvedAt?.toISOString() ?? null,
          createdAt: flag.createdAt.toISOString(),
          updatedAt: flag.updatedAt.toISOString(),
        })),
      }
    : null
  return {
    markdown: row.reportMarkdown ?? '',
    data: {
      type: 'valuation',
      clientName,
      analysis: analysisView,
      recastView,
      ttmSummary: row.ttmSummary ?? null,
      annualModel: row.annualModel ?? null,
      summary: row.summary ?? null,
      recast: recast
        ? {
            normalizedEbitda: recast.normalizedEbitda,
            valuationLow: recast.valuationLow,
            valuationMid: recast.valuationMid,
            valuationHigh: recast.valuationHigh,
            assumptions: recast.assumptions,
            parsedReport: recast.parsedReport,
            approvedAt: recast.approvedAt?.toISOString() ?? null,
            approvedByName: recast.approvedByName ?? null,
          }
        : null,
    },
  }
}

function serializeValue(value: unknown): { markdown: string; data: unknown } {
  if (!value) return { markdown: '', data: null }
  if (typeof value === 'string') return { markdown: value, data: null }
  if (typeof value === 'object' && 'markdown' in value && typeof (value as any).markdown === 'string') return { markdown: (value as any).markdown, data: value }
  if (typeof value === 'object' && 'report' in value && typeof (value as any).report === 'string') return { markdown: (value as any).report, data: value }
  if (typeof value === 'object' && 'summary' in value && typeof (value as any).summary === 'string') return { markdown: (value as any).summary, data: value }
  return { markdown: '', data: value }
}

async function readSalesProcessReviewOutput(clientId: string): Promise<{ markdown: string; data: unknown }> {
  const document = await prisma.clientDocument.findFirst({
    where: { clientId, documentId: 'sales_process_transcript' },
    orderBy: { createdAt: 'desc' },
    select: { aiReviewSummary: true, aiReviewedAt: true },
  })
  if (!document?.aiReviewSummary) {
    const submission = await prisma.clientProfile.findUnique({
      where: { id: clientId },
      select: { sectionSubmissions: true },
    })
    const submissions = (submission?.sectionSubmissions && typeof submission.sectionSubmissions === 'object'
      ? submission.sectionSubmissions
      : {}) as Record<string, unknown>
    return serializeValue(submissions.salesProcessReview)
  }

  try {
    const result = JSON.parse(document.aiReviewSummary) as { summary?: string }
    const summary = typeof result?.summary === 'string' ? result.summary : ''
    return {
      markdown: summary,
      data: { type: 'salesProcessReview', result },
    }
  } catch {
    return { markdown: document.aiReviewSummary, data: { type: 'salesProcessReview', result: document.aiReviewSummary } }
  }
}
