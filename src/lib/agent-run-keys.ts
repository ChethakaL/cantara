/** Canonical agent keys for AgentAnalysisRun storage (snake_case). */
export const AGENT_RUN_KEYS = {
  digitalPresence: 'digital_presence',
  insuranceReview: 'insurance_review',
  employeeComp: 'employee_comp',
  occupancyReview: 'occupancy_review',
  litigationSearch: 'litigation_search',
  loiReview: 'loi_review',
  pricingAnalysis: 'pricing_analysis',
  facilityReview: 'facility_review',
  ws1Assessment: 'ws1_assessment',
  ws2Assessment: 'ws2_assessment',
  orgChartReview: 'org_chart_review',
  salesProcessReview: 'sales_process_review',
  pricingVertical: 'pricing_vertical',
  salesReadinessRoadmap: 'sales_readiness_roadmap',
  cim: 'cim',
  teaser: 'teaser',
  buyerReport: 'buyer_report',
  ownerGmAssessment: 'owner_gm_assessment',
} as const

export type AgentRunKey = (typeof AGENT_RUN_KEYS)[keyof typeof AGENT_RUN_KEYS]

/** sectionSubmissions keys used before AgentAnalysisRun (for legacy import). */
export const LEGACY_SUBMISSION_KEYS: Partial<Record<AgentRunKey, string>> = {
  digital_presence: 'digitalPresence',
  insurance_review: 'insuranceReview',
  employee_comp: 'employeeComp',
  occupancy_review: 'occupancyReview',
  litigation_search: 'litigationSearch',
  loi_review: 'loiReview',
  pricing_analysis: 'pricingAnalysis',
  facility_review: 'facilityReview',
  ws1_assessment: 'ws1Assessment',
  ws2_assessment: 'ws2Assessment',
  org_chart_review: 'orgChartReview',
  sales_process_review: 'salesProcessReview',
  pricing_vertical: 'pricingVertical',
  sales_readiness_roadmap: 'improvementRoadmap',
  cim: 'cim',
  teaser: 'teaser',
  buyer_report: 'buyerReport',
  owner_gm_assessment: 'ownerGmAssessment',
}
