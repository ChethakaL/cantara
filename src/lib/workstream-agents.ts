import type { Workstream } from '@/lib/store'

export type WorkstreamAgentSelection = {
  agentId: string
  agentName: string
  documentIds?: string[]
}

type PropertyOwnership = 'lease' | 'owns' | '' | null | undefined

export const SYSTEM_WORKSTREAM_AGENTS: Record<Exclude<Workstream, null>, WorkstreamAgentSelection[]> = {
  ws1: [
    { agentId: 'ttm', agentName: 'Valuation Agent', documentIds: ['monthly_pl_excel', 'monthly_bs_excel', 'accountant_statements'] },
    { agentId: 'employee_obligations', agentName: 'Employee Obligations Agent', documentIds: ['employee_list', 'key_employee_contracts'] },
    { agentId: 'employee_comp', agentName: 'Employee Staffing & Compensation Agent', documentIds: ['employee_list'] },
    { agentId: 'insurance_review', agentName: 'Insurance Review Agent', documentIds: ['insurance_policies', 'insurance_claims_12m'] },
    { agentId: 'lease_analysis', agentName: 'Lease Analysis Agent', documentIds: ['leases'] },
    { agentId: 'real_estate_appraisal', agentName: 'Real Estate Appraisal Agent', documentIds: ['real_estate_appraisal'] },
    { agentId: 'litigation_search', agentName: 'Litigation & Liens Agent', documentIds: ['litigation_search_docs', 'pending_litigation'] },
    { agentId: 'contract_analysis', agentName: 'Material Contracts Agent', documentIds: [] },
    { agentId: 'org_chart_review', agentName: 'Org Chart Review Agent', documentIds: [] },
    { agentId: 'owner_gm_assessment', agentName: 'Owner & GM Assessment Agent', documentIds: ['employee_list', 'org_chart', 'sop_manual'] },
    { agentId: 'ownership_verification', agentName: 'Ownership Verification Agent', documentIds: ['articles_org', 'shareholder_agreement', 'ownership_structure'] },
    { agentId: 'permits_zoning', agentName: 'Permits & Zoning Agent', documentIds: ['business_licenses', 'zoning_approval', 'certificate_occupancy', 'building_permits'] },
    { agentId: 'vendor_directory', agentName: 'Software & Vendors Agent', documentIds: [] },
    { agentId: 'client_location_map', agentName: 'Client Location Map Agent', documentIds: [] },
    { agentId: 'legal_entity_search', agentName: 'Legal Reports & Entity Search Agent', documentIds: ['articles_org', 'shareholder_agreement', 'ownership_structure', 'business_licenses'] },
    { agentId: 'tax_liability_review', agentName: 'Tax Liability Review Agent', documentIds: ['tax_returns_3yr', 'irs_941_940_3yr', 'contractor_1099_agreements', 'sales_use_tax_3yr', 'irs_tax_notices_3yr'] },
    { agentId: 'ws1_assessment', agentName: 'WS1 Assessment Report', documentIds: [] },
    { agentId: 'ws1_roadmap', agentName: 'WS1 Sales Readiness Roadmap', documentIds: [] },
  ],
  ws2: [
    { agentId: 'ttm', agentName: 'Valuation Agent', documentIds: ['monthly_pl_excel', 'monthly_bs_excel', 'accountant_statements'] },
    { agentId: 'competitor_analysis', agentName: 'Competitor Analysis Agent', documentIds: [] },
    { agentId: 'digital_presence', agentName: 'Digital Presence Agent', documentIds: [] },
    { agentId: 'facility_review', agentName: 'Facility Review Agent', documentIds: ['health_safety', 'violations'] },
    { agentId: 'occupancy_review', agentName: 'Occupancy Review Agent', documentIds: ['occupancy_review'] },
    { agentId: 'pricing_analysis', agentName: 'Competitive Pricing Analysis Agent', documentIds: ['pricing_schedule', 'revenue_breakdown'] },
    { agentId: 'pricing_vertical', agentName: 'Pricing by Vertical Agent', documentIds: ['revenue_breakdown', 'pricing_schedule'] },
    { agentId: 'sales_process_review', agentName: 'Sales Process Review Agent', documentIds: ['sales_process_transcript', 'pricing_schedule'] },
    { agentId: 'client_location_map', agentName: 'Client Location Map Agent', documentIds: [] },
    { agentId: 'ws2_assessment', agentName: 'WS2 Assessment Report', documentIds: [] },
    { agentId: 'ws2_roadmap', agentName: 'WS2 Sales Readiness Roadmap', documentIds: [] },
  ],
  ma: [
    { agentId: 'ttm', agentName: 'Valuation Agent', documentIds: ['monthly_pl_excel', 'monthly_bs_excel', 'accountant_statements'] },
    { agentId: 'cim', agentName: 'CIM Generator Agent', documentIds: [] },
    { agentId: 'teaser', agentName: 'Deal Teaser Generator Agent', documentIds: [] },
    { agentId: 'net_proceeds', agentName: 'Net Proceeds Calculator Agent', documentIds: [] },
    { agentId: 'ownership_verification', agentName: 'Ownership Verification Agent', documentIds: ['articles_org', 'shareholder_agreement', 'ownership_structure'] },
    { agentId: 'litigation_search', agentName: 'Litigation & Liens Agent', documentIds: ['litigation_search_docs', 'pending_litigation'] },
    { agentId: 'professional_advisors', agentName: 'Professional Advisors Agent', documentIds: [] },
  ],
  both: [],
}

SYSTEM_WORKSTREAM_AGENTS.both = [...SYSTEM_WORKSTREAM_AGENTS.ws1, ...SYSTEM_WORKSTREAM_AGENTS.ws2].filter(
  (agent, index, agents) => agents.findIndex(item => item.agentId === agent.agentId) === index,
)

function shouldIncludeLeaseAgent(propertyOwnership: PropertyOwnership) {
  return propertyOwnership !== 'owns'
}

function filterLeaseAgentSelection(
  agents: WorkstreamAgentSelection[],
  propertyOwnership: PropertyOwnership,
) {
  if (shouldIncludeLeaseAgent(propertyOwnership)) {
    return agents.filter(agent => agent.agentId !== 'real_estate_appraisal')
  }
  const filtered = agents.filter(agent => agent.agentId !== 'lease_analysis')
  if (filtered.some(agent => agent.agentId === 'real_estate_appraisal')) return filtered
  return [...filtered, { agentId: 'real_estate_appraisal', agentName: 'Real Estate Appraisal Agent', documentIds: ['real_estate_appraisal'] }]
}

export function getClientWorkstreamAgents(client: {
  workstream?: Workstream
  customWorkstream?: { agents?: WorkstreamAgentSelection[] } | null
  workstreamAgents?: WorkstreamAgentSelection[] | null
  propertyOwnership?: PropertyOwnership
}) {
  let agents: WorkstreamAgentSelection[] = []
  if (client.workstreamAgents?.length) {
    agents = filterLeaseAgentSelection(client.workstreamAgents, client.propertyOwnership)
  } else if (client.customWorkstream?.agents?.length) {
    agents = filterLeaseAgentSelection(client.customWorkstream.agents, client.propertyOwnership)
  } else if (client.workstream) {
    agents = filterLeaseAgentSelection(SYSTEM_WORKSTREAM_AGENTS[client.workstream] ?? [], client.propertyOwnership)
  }

  if (client.workstream !== 'ma') {
    return agents.filter(agent => agent.agentId !== 'professional_advisors')
  }
  return agents
}

export function normalizeAgentStatusKey(agentId: string) {
  const aliases: Record<string, string> = {
    ttm: 'ttmAnalysis',
    lease_analysis: 'lease',
    real_estate_appraisal: 'realEstateAppraisal',
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
    occupancy_review: 'occupancyReview',
    pricing_analysis: 'pricingAnalysis',
    pricing_vertical: 'pricingVertical',
    sales_process_review: 'salesProcessReview',
    client_location_map: 'clientLocationMap',
    legal_entity_search: 'legalEntitySearch',
    tax_liability_review: 'taxLiabilityReview',
    ws1_assessment: 'ws1Assessment',
    ws2_assessment: 'ws2Assessment',
    ws1_roadmap: 'ws1Roadmap',
    ws2_roadmap: 'ws2Roadmap',
  }
  return aliases[agentId] ?? agentId
}
