import type { Workstream } from '@/lib/store'

export type WorkstreamAgentSelection = {
  agentId: string
  agentName: string
  documentIds?: string[]
}

export const SYSTEM_WORKSTREAM_AGENTS: Record<Exclude<Workstream, null>, WorkstreamAgentSelection[]> = {
  ws1: [
    { agentId: 'ttm', agentName: 'Valuation Agent', documentIds: [] },
    { agentId: 'employee_obligations', agentName: 'Employee Obligations Agent', documentIds: ['employee_list', 'key_employee_contracts', 'employee_comp_payroll'] },
    { agentId: 'employee_comp', agentName: 'Employee Staffing & Compensation Agent', documentIds: [] },
    { agentId: 'insurance_review', agentName: 'Insurance Review Agent', documentIds: ['insurance_policies', 'insurance_claims_12m'] },
    { agentId: 'lease_analysis', agentName: 'Lease Analysis Agent', documentIds: ['leases'] },
    { agentId: 'litigation_search', agentName: 'Litigation & Liens Agent', documentIds: ['litigation_search_docs', 'pending_litigation'] },
    { agentId: 'contract_analysis', agentName: 'Material Contracts Agent', documentIds: [] },
    { agentId: 'org_chart_review', agentName: 'Org Chart Review Agent', documentIds: [] },
    { agentId: 'owner_gm_assessment', agentName: 'Owner & GM Assessment Agent', documentIds: ['employee_list', 'org_chart', 'sop_manual'] },
    { agentId: 'ownership_verification', agentName: 'Ownership Verification Agent', documentIds: ['articles_org', 'shareholder_agreement', 'ownership_structure'] },
    { agentId: 'permits_zoning', agentName: 'Permits & Zoning Agent', documentIds: ['business_licenses', 'zoning_approval', 'certificate_occupancy', 'building_permits'] },
    { agentId: 'professional_advisors', agentName: 'Professional Advisors Agent', documentIds: [] },
    { agentId: 'vendor_directory', agentName: 'Software & Vendors Agent', documentIds: ['vendor_contracts', 'material_contracts', 'software_subscriptions'] },
  ],
  ws2: [
    { agentId: 'ttm', agentName: 'Valuation Agent', documentIds: [] },
    { agentId: 'competitor_analysis', agentName: 'Competitor Analysis Agent', documentIds: [] },
    { agentId: 'digital_presence', agentName: 'Digital Presence Agent', documentIds: [] },
    { agentId: 'facility_review', agentName: 'Facility Review Agent', documentIds: ['health_safety', 'violations'] },
    { agentId: 'pricing_analysis', agentName: 'Competitive Pricing Analysis Agent', documentIds: ['pricing_schedule', 'revenue_breakdown'] },
    { agentId: 'pricing_vertical', agentName: 'Pricing by Vertical Agent', documentIds: ['revenue_breakdown', 'pricing_schedule'] },
    { agentId: 'sales_process_review', agentName: 'Sales Process Review Agent', documentIds: ['sales_process_transcript', 'pricing_schedule'] },
  ],
  ma: [
    { agentId: 'ttm', agentName: 'Valuation Agent', documentIds: [] },
    { agentId: 'cim', agentName: 'CIM Generator Agent', documentIds: [] },
    { agentId: 'teaser', agentName: 'Deal Teaser Generator Agent', documentIds: [] },
    { agentId: 'net_proceeds', agentName: 'Net Proceeds Calculator Agent', documentIds: [] },
    { agentId: 'ownership_verification', agentName: 'Ownership Verification Agent', documentIds: ['articles_org', 'shareholder_agreement', 'ownership_structure'] },
    { agentId: 'litigation_search', agentName: 'Litigation & Liens Agent', documentIds: ['litigation_search_docs', 'pending_litigation'] },
  ],
  both: [],
}

SYSTEM_WORKSTREAM_AGENTS.both = [...SYSTEM_WORKSTREAM_AGENTS.ws1, ...SYSTEM_WORKSTREAM_AGENTS.ws2].filter(
  (agent, index, agents) => agents.findIndex(item => item.agentId === agent.agentId) === index,
)

export function getClientWorkstreamAgents(client: {
  workstream?: Workstream
  customWorkstream?: { agents?: WorkstreamAgentSelection[] } | null
  workstreamAgents?: WorkstreamAgentSelection[] | null
}) {
  if (client.customWorkstream?.agents?.length) return client.customWorkstream.agents
  if (client.workstreamAgents?.length) return client.workstreamAgents
  return client.workstream ? (SYSTEM_WORKSTREAM_AGENTS[client.workstream] ?? []) : []
}

export function normalizeAgentStatusKey(agentId: string) {
  const aliases: Record<string, string> = {
    ttm: 'ttmAnalysis',
    lease_analysis: 'lease',
    contract_analysis: 'contract',
    competitor_analysis: 'competitor',
    employee_obligations: 'employeeObligations',
    digital_presence: 'digitalPresence',
    org_chart_review: 'orgChart',
    insurance_review: 'insuranceReview',
    litigation_search: 'litigationSearch',
    employee_comp: 'employeeComp',
    owner_gm_assessment: 'ownerGmAssessment',
    ownership_verification: 'ownershipVerification',
    permits_zoning: 'permitsZoning',
    professional_advisors: 'professionalAdvisors',
    vendor_directory: 'vendorDirectory',
    facility_review: 'facilityReview',
    pricing_analysis: 'pricingAnalysis',
    pricing_vertical: 'pricingVertical',
    sales_process_review: 'salesProcessReview',
  }
  return aliases[agentId] ?? agentId
}
