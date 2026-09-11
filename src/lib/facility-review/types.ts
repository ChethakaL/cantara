export type FacilityRating = 'Excellent' | 'Good' | 'Needs Attention' | 'Critical'
export type FacilityImpact = 'High' | 'Medium' | 'Low'
export type FacilityEffort = 'High' | 'Medium' | 'Low'

export interface FacilityZoneScore {
  zone: string
  weight: number
  score: number
  rating: FacilityRating
  commentary: string
  keyFindings: string[]
  /** Optional UI/report fields used by newer Facility Review editor. */
  narrative?: string
  strengths?: string[]
  concerns?: string[]
  photoCount?: number
}

export interface FacilityImprovement {
  improvement: string
  zone: string
  valueImpact: FacilityImpact
  effort: FacilityEffort
  timing: string
  /** Optional UI aliases used by newer Facility Review editor. */
  estimatedCost?: string
  impact?: FacilityImpact
}

export interface FacilityReviewReport {
  businessName: string
  location: string
  assessmentDate: string
  preparedBy: string
  reportVersion: string
  nextReview: string
  overallScore: number
  overallRating: FacilityRating
  overallNarrative: string
  zones: FacilityZoneScore[]
  prioritizedImprovements: FacilityImprovement[]
  maintenanceHistorySummary?: string
  capitalExpenditureOutlook?: Array<{
    item: string
    estimatedCostRange: string
    timing: string
  }>
  complianceLicensingSnapshot?: string
  brandCurbAppealAssessment?: string
  cantaraAdvisoryCommentary?: string
  methodologyDisclosure?: string
  imageCoverageNotes: string[]
  buyerRiskSummary: string
  generatedAt: string
  modelUsed: string
}
