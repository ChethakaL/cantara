import { prisma } from '@/lib/prisma'
import { normalizeAgentStatusKey, type WorkstreamAgentSelection } from '@/lib/workstream-agents'

export type CompletedAgentOutput = {
  agentId: string
  agentName: string
  excerpt: string
}

const SKIP_STATUS_KEYS = new Set([
  'salesReadinessRoadmap',
  'ws1Assessment',
  'ws2Assessment',
  'cim',
  'teaser',
  'net_proceeds',
  'meeting_notes',
  'meetingNotes',
])

const KNOWN_SOURCE_AGENTS: WorkstreamAgentSelection[] = [
  { agentId: 'ttm', agentName: 'Valuation Agent' },
  { agentId: 'employee_obligations', agentName: 'Employee Obligations Agent' },
  { agentId: 'employee_comp', agentName: 'Employee Staffing & Compensation Agent' },
  { agentId: 'insurance_review', agentName: 'Insurance Review Agent' },
  { agentId: 'lease_analysis', agentName: 'Lease Analysis Agent' },
  { agentId: 'real_estate_appraisal', agentName: 'Real Estate Appraisal Agent' },
  { agentId: 'litigation_search', agentName: 'Litigation & Liens Agent' },
  { agentId: 'contract_analysis', agentName: 'Material Contracts Agent' },
  { agentId: 'org_chart_review', agentName: 'Org Chart Review Agent' },
  { agentId: 'owner_gm_assessment', agentName: 'Owner & GM Assessment Agent' },
  { agentId: 'ownership_verification', agentName: 'Ownership Verification Agent' },
  { agentId: 'permits_zoning', agentName: 'Permits & Zoning Agent' },
  { agentId: 'vendor_directory', agentName: 'Software & Vendors Agent' },
  { agentId: 'professional_advisors', agentName: 'Professional Advisors Agent' },
  { agentId: 'client_location_map', agentName: 'Client Location Map Agent' },
  { agentId: 'legal_entity_search', agentName: 'Legal Reports & Entity Search Agent' },
  { agentId: 'tax_liability_review', agentName: 'Tax Liability Review Agent' },
  { agentId: 'competitor_analysis', agentName: 'Competitor Analysis Agent' },
  { agentId: 'digital_presence', agentName: 'Digital Presence Agent' },
  { agentId: 'facility_review', agentName: 'Facility Review Agent' },
  { agentId: 'occupancy_review', agentName: 'Occupancy Review Agent' },
  { agentId: 'pricing_analysis', agentName: 'Competitive Pricing Analysis Agent' },
  { agentId: 'pricing_vertical', agentName: 'Pricing by Vertical Agent' },
  { agentId: 'sales_process_review', agentName: 'Sales Process Review Agent' },
]

function isSourceAgent(agentId: string) {
  return !SKIP_STATUS_KEYS.has(normalizeAgentStatusKey(agentId))
}

function excerpt(value: unknown, maxLen = 3500): string {
  const raw = typeof value === 'string' ? value : JSON.stringify(value ?? '')
  return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen)
}

async function latestFromTable(delegate: any, clientId: string, select: Record<string, boolean>, textField: string) {
  if (!delegate?.findFirst) return ''
  const row = await delegate.findFirst({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
    select,
  })
  if (!row) return ''
  return excerpt(row[textField] ?? row.reportMarkdown ?? row.markdown ?? row.report ?? row.summary ?? row.parsed ?? row.parsedReport)
}

function submissionValue(submissions: Record<string, any>, key: string) {
  if (key === 'ttm' || key === 'ttmAnalysis') return submissions.valuation
  if (key === 'employeeComp') return submissions.employeeCompReport || submissions.employeeComp
  return submissions[key]
}

async function latestCompletedOutput(
  clientId: string,
  agentId: string,
  submissions: Record<string, any>,
): Promise<string> {
  const key = normalizeAgentStatusKey(agentId)

  if (key === 'ttm' || key === 'ttmAnalysis') {
    const ttm = await latestFromTable((prisma as any).ttmAnalysis, clientId, { createdAt: true, reportMarkdown: true, summary: true }, 'reportMarkdown')
    if (ttm) return ttm
  }
  if (key === 'lease') {
    const value = await latestFromTable((prisma as any).leaseAnalysis, clientId, { createdAt: true, report: true, parsed: true }, 'report')
    if (value) return value
  }
  if (key === 'realEstateAppraisal') {
    const value = await latestFromTable((prisma as any).realEstateAppraisalReport, clientId, { createdAt: true, markdown: true, metadata: true }, 'markdown')
    if (value) return value
  }
  if (key === 'contract') {
    const value = await latestFromTable((prisma as any).contractAnalysis, clientId, { createdAt: true, report: true, parsed: true }, 'report')
    if (value) return value
  }
  if (key === 'competitor') {
    const value = await latestFromTable((prisma as any).competitorAnalysis, clientId, { createdAt: true, report: true, parsed: true }, 'report')
    if (value) return value
  }
  if (key === 'employeeObligations') {
    const value = await latestFromTable((prisma as any).employeeObligationsReport, clientId, { createdAt: true, markdown: true, metadata: true }, 'markdown')
    if (value) return value
  }
  if (key === 'ownershipVerification') {
    const value = await latestFromTable((prisma as any).ownershipVerificationReport, clientId, { createdAt: true, markdown: true, metadata: true }, 'markdown')
    if (value) return value
  }
  if (key === 'permitsZoning') {
    const value = await latestFromTable((prisma as any).permitsZoningReport, clientId, { createdAt: true, markdown: true, metadata: true }, 'markdown')
    if (value) return value
  }
  if (key === 'legalEntitySearch') {
    const value = await latestFromTable((prisma as any).legalEntitySearchReport, clientId, { createdAt: true, markdown: true, metadata: true }, 'markdown')
    if (value) return value
  }
  if (key === 'taxLiabilityReview') {
    const value = await latestFromTable((prisma as any).taxLiabilityReport, clientId, { createdAt: true, markdown: true, metadata: true }, 'markdown')
    if (value) return value
  }
  if (key === 'insuranceReview') {
    const doc = await (prisma as any).clientDocument.findFirst({
      where: { clientId, documentId: 'insurance_claims_12m' },
      orderBy: { createdAt: 'desc' },
      select: { fileName: true, aiReviewSummary: true, aiReviewStatus: true, aiDetectedType: true, aiReviewFlags: true },
    })
    if (doc?.aiReviewSummary || doc?.aiReviewStatus) {
      return excerpt({
        fileName: doc.fileName,
        status: doc.aiReviewStatus,
        claimType: doc.aiDetectedType,
        flags: doc.aiReviewFlags,
        summary: doc.aiReviewSummary,
      })
    }
  }
  if (key === 'salesProcessReview') {
    const doc = await (prisma as any).clientDocument.findFirst({
      where: { clientId, documentId: 'sales_process_transcript' },
      orderBy: { createdAt: 'desc' },
      select: { fileName: true, aiReviewSummary: true, aiReviewStatus: true, aiReviewFlags: true },
    })
    if (doc?.aiReviewSummary || doc?.aiReviewStatus) {
      return excerpt({
        fileName: doc.fileName,
        status: doc.aiReviewStatus,
        flags: doc.aiReviewFlags,
        summary: doc.aiReviewSummary,
      })
    }
  }

  const submission = submissionValue(submissions, key)
  return submission ? excerpt(submission) : ''
}

export async function gatherCompletedAgentOutputs(
  clientId: string,
  assignedAgents: WorkstreamAgentSelection[] = [],
): Promise<CompletedAgentOutput[]> {
  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: { sectionSubmissions: true },
  })
  const submissions = (client?.sectionSubmissions && typeof client.sectionSubmissions === 'object'
    ? client.sectionSubmissions
    : {}) as Record<string, any>

  const candidates = [...assignedAgents, ...KNOWN_SOURCE_AGENTS]
  const seen = new Set<string>()
  const outputs: CompletedAgentOutput[] = []

  for (const agent of candidates) {
    if (!isSourceAgent(agent.agentId)) continue
    const statusKey = normalizeAgentStatusKey(agent.agentId)
    if (seen.has(statusKey)) continue
    seen.add(statusKey)

    const text = await latestCompletedOutput(clientId, agent.agentId, submissions)
    if (!text) continue
    outputs.push({
      agentId: agent.agentId,
      agentName: agent.agentName,
      excerpt: text,
    })
  }

  return outputs
}
