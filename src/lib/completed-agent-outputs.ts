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
  { agentId: 'client_location_map', agentName: 'Client Location Map Agent' },
  { agentId: 'pricing_analysis', agentName: 'Competitive Pricing Analysis Agent' },
  { agentId: 'competitor_analysis', agentName: 'Competitor Analysis Agent' },
  { agentId: 'digital_presence', agentName: 'Digital Presence Agent' },
  { agentId: 'employee_obligations', agentName: 'Employee Obligations Agent' },
  { agentId: 'employee_comp', agentName: 'Employee Staffing & Compensation Agent' },
  { agentId: 'facility_review', agentName: 'Facility Review Agent' },
  { agentId: 'insurance_review', agentName: 'Insurance Review Agent' },
  { agentId: 'lease_analysis', agentName: 'Lease Analysis Agent' },
  { agentId: 'legal_entity_search', agentName: 'Legal Reports & Entity Search Agent' },
  { agentId: 'litigation_search', agentName: 'Litigation & Liens Agent' },
  { agentId: 'contract_analysis', agentName: 'Material Contracts Agent' },
  { agentId: 'occupancy_review', agentName: 'Occupancy Review Agent' },
  { agentId: 'org_chart_review', agentName: 'Org Chart Review Agent' },
  { agentId: 'owner_gm_assessment', agentName: 'Owner & GM Assessment Agent' },
  { agentId: 'ownership_verification', agentName: 'Ownership Verification Agent' },
  { agentId: 'permits_zoning', agentName: 'Permits & Zoning Agent' },
  { agentId: 'pricing_vertical', agentName: 'Pricing by Vertical Agent' },
  { agentId: 'professional_advisors', agentName: 'Professional Advisors Agent' },
  { agentId: 'real_estate_appraisal', agentName: 'Real Estate Appraisal Agent' },
  { agentId: 'sales_process_review', agentName: 'Sales Process Review Agent' },
  { agentId: 'vendor_directory', agentName: 'Software & Vendors Agent' },
  { agentId: 'tax_liability_review', agentName: 'Tax Liability Review Agent' },
]

export function isRoadmapSourceAgent(agentId: string) {
  return !SKIP_STATUS_KEYS.has(normalizeAgentStatusKey(agentId))
}

function isSourceAgent(agentId: string) {
  return isRoadmapSourceAgent(agentId)
}

const AGENT_TAB_KEYS: Record<string, string> = {
  ttm: 'ttm',
  client_location_map: 'client-location-map',
  pricing_analysis: 'pricing-analysis',
  competitor_analysis: 'competitor',
  digital_presence: 'digital',
  employee_obligations: 'employee-obligations',
  employee_comp: 'employee-comp',
  facility_review: 'facility-review',
  insurance_review: 'insurance',
  lease_analysis: 'lease',
  legal_entity_search: 'legal-entity-search',
  litigation_search: 'litigation',
  contract_analysis: 'contract',
  occupancy_review: 'occupancy-review',
  org_chart_review: 'org-chart',
  owner_gm_assessment: 'owner-gm-assessment',
  ownership_verification: 'ownership-verification',
  permits_zoning: 'permits-zoning',
  pricing_vertical: 'pricing-vertical',
  professional_advisors: 'advisors',
  real_estate_appraisal: 'real-estate-appraisal',
  sales_process_review: 'sales-process-review',
  vendor_directory: 'vendor-directory',
  tax_liability_review: 'tax-liability-review',
}

const AGENT_GROUPS: Record<string, 'WS1 — Risk Mitigation' | 'WS2 — Performance' | 'Shared'> = {
  ttm: 'Shared',
  client_location_map: 'Shared',
  employee_obligations: 'WS1 — Risk Mitigation',
  employee_comp: 'WS1 — Risk Mitigation',
  insurance_review: 'WS1 — Risk Mitigation',
  lease_analysis: 'WS1 — Risk Mitigation',
  legal_entity_search: 'WS1 — Risk Mitigation',
  litigation_search: 'WS1 — Risk Mitigation',
  contract_analysis: 'WS1 — Risk Mitigation',
  org_chart_review: 'WS1 — Risk Mitigation',
  owner_gm_assessment: 'WS1 — Risk Mitigation',
  ownership_verification: 'WS1 — Risk Mitigation',
  permits_zoning: 'WS1 — Risk Mitigation',
  professional_advisors: 'WS1 — Risk Mitigation',
  real_estate_appraisal: 'WS1 — Risk Mitigation',
  vendor_directory: 'WS1 — Risk Mitigation',
  tax_liability_review: 'WS1 — Risk Mitigation',
  pricing_analysis: 'WS2 — Performance',
  competitor_analysis: 'WS2 — Performance',
  digital_presence: 'WS2 — Performance',
  facility_review: 'WS2 — Performance',
  occupancy_review: 'WS2 — Performance',
  pricing_vertical: 'WS2 — Performance',
  sales_process_review: 'WS2 — Performance',
}

const AGENT_NOTES: Record<string, string> = {
  ttm: 'Adjusted EBITDA, revenue trends, and valuation context for sale readiness.',
  client_location_map: 'Customer geographic reach and service-area concentration.',
  pricing_analysis: 'Competitive pricing position versus nearby operators.',
  competitor_analysis: 'Local competitor landscape and positioning.',
  digital_presence: 'Website, reviews, and online reputation health.',
  employee_obligations: 'Contracts, handbook, benefits, and workforce obligations.',
  employee_comp: 'Staffing levels, pay structure, and compensation risk.',
  facility_review: 'Facility condition and buyer-facing operational readiness.',
  insurance_review: 'Coverage adequacy, claims history, and insurance gaps.',
  lease_analysis: 'Lease terms, assignment risk, and landlord consent issues.',
  legal_entity_search: 'Entity standing, filings, and corporate cleanliness.',
  litigation_search: 'Litigation, liens, and dispute exposure.',
  contract_analysis: 'Material vendor/customer contract transferability.',
  occupancy_review: 'Capacity utilization and boarding/daycare demand trends.',
  org_chart_review: 'Management depth and key-person concentration.',
  owner_gm_assessment: 'Owner dependency and GM operating autonomy.',
  ownership_verification: 'Cap table, authority to sell, and ownership clarity.',
  permits_zoning: 'Licenses, permits, and zoning compliance posture.',
  pricing_vertical: 'Service-line pricing history and revenue mix.',
  professional_advisors: 'CPA, attorney, and other advisor relationships.',
  real_estate_appraisal: 'Owned real estate valuation support.',
  sales_process_review: 'Inquiry conversion and booking process quality.',
  vendor_directory: 'Critical software and vendor dependencies.',
  tax_liability_review: 'Tax filings, notices, and potential tax exposure.',
}

export type RoadmapAgentSource = {
  key: string
  name: string
  tabKey: string
  group: string
  required: false
  ready: boolean
  note: string
}

/** Workstream-aware optional source list for the Sales Readiness Roadmap start UI.
 * Shows assigned workstream agents (ready or not), plus any other completed
 * diligence agents advisors ran outside the assigned set.
 */
export async function listRoadmapAgentSources(
  clientId: string,
  assignedAgents: WorkstreamAgentSelection[] = [],
): Promise<RoadmapAgentSource[]> {
  const completed = await gatherCompletedAgentOutputs(clientId, assignedAgents)
  const readyKeys = new Set(completed.map(item => normalizeAgentStatusKey(item.agentId)))
  const completedByKey = new Map(
    completed.map(item => [normalizeAgentStatusKey(item.agentId), item] as const),
  )

  const assignedSourceAgents = assignedAgents.filter(agent => isSourceAgent(agent.agentId))
  const candidates: WorkstreamAgentSelection[] = [
    ...(assignedSourceAgents.length ? assignedSourceAgents : []),
    // Advisors often run agents outside the assigned workstream — surface those too.
    ...completed.map(item => ({ agentId: item.agentId, agentName: item.agentName })),
    // Fallback catalog when nothing is assigned yet.
    ...(!assignedSourceAgents.length ? KNOWN_SOURCE_AGENTS : []),
  ]

  const seen = new Set<string>()
  const sources: RoadmapAgentSource[] = []

  for (const agent of candidates) {
    if (!isSourceAgent(agent.agentId)) continue
    const statusKey = normalizeAgentStatusKey(agent.agentId)
    if (seen.has(statusKey)) continue
    seen.add(statusKey)

    const isAssigned = assignedSourceAgents.some(a => normalizeAgentStatusKey(a.agentId) === statusKey)
    const ready = readyKeys.has(statusKey)
    // Show: assigned agents always; non-assigned only if they have a completed output.
    if (!isAssigned && !ready) continue

    const completedMatch = completedByKey.get(statusKey)
    sources.push({
      key: agent.agentId,
      name: completedMatch?.agentName || agent.agentName,
      tabKey: AGENT_TAB_KEYS[agent.agentId] ?? agent.agentId,
      group: isAssigned
        ? (AGENT_GROUPS[agent.agentId] ?? 'Shared')
        : 'Also run (outside assigned workstream)',
      required: false,
      ready,
      note: isAssigned
        ? (AGENT_NOTES[agent.agentId] ?? 'Completed diligence output used when generating the checklist.')
        : `${AGENT_NOTES[agent.agentId] ?? 'Completed diligence output.'} Included because this agent was run even though it is outside the assigned workstream.`,
    })
  }

  const groupOrder = [
    'Shared',
    'WS1 — Risk Mitigation',
    'WS2 — Performance',
    'Also run (outside assigned workstream)',
  ]
  return sources.sort((a, b) => {
    const ga = groupOrder.indexOf(a.group)
    const gb = groupOrder.indexOf(b.group)
    if (ga !== gb) return (ga === -1 ? 99 : ga) - (gb === -1 ? 99 : gb)
    if (a.ready !== b.ready) return a.ready ? -1 : 1
    return a.name.localeCompare(b.name)
  })
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
