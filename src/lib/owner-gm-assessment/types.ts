export interface OwnerProfile {
  name: string
  title: string
  role: string
  hoursPerWeek: number | null
  criticalHoursPerWeek: number | null
  postCloseIntention: 'stay' | 'exit' | 'undecided' | null
  postCloseRole: string
  postCloseDuration: string
  stayRequired: boolean | null
  criticalRelationships: string[]
  replacementRoles: string[]
  replacementExperience: string
  replacementHours: number | null
  internalSuccessor: string
  externalHireCost: string
  dependencyRating: 'High' | 'Medium' | 'Low'
  dependencyNotes: string
}

export interface GmProfile {
  inPlace: boolean
  name: string
  fullOrPartTime: 'Full-Time' | 'Part-Time' | null
  totalTenure: string
  gmTenure: string
  hourlyOrSalaried: 'Hourly' | 'Salaried' | null
  compensation: string
  marketAligned: 'Above' | 'At Market' | 'Below' | 'Unknown'
  contentWithComp: boolean | null
  dayToDayOwnership: string
  strengths: string[]
  gaps: string[]
  independenceScore: number | null  // 1-10
  soloExperience: string
  soloOutcome: string
  awareOfSale: boolean | null
  retentionConversation: boolean | null
  supportive: boolean | null
  hesitations: string[]
  retentionCommitment: 'High' | 'Medium' | 'Low' | 'Unknown'
  willingToInvolveInTransition: boolean | null
  retentionRiskRating: 'High' | 'Medium' | 'Low'
  retentionNotes: string
}

export interface SeniorTeamMember {
  name: string
  title: string
  tenure: string
  responsibilities: string
  hourlyOrSalaried: 'Hourly' | 'Salaried' | null
  couldStepUp: boolean | null
}

export interface OwnerGmAssessment {
  generatedAt: string
  ownerDependencyRating: 'High' | 'Medium' | 'Low'
  gmRetentionRisk: 'High' | 'Medium' | 'Low'
  benchStrength: 'Strong' | 'Moderate' | 'Thin'
  overallTransitionReadiness: 'High' | 'Medium' | 'Low'
  executiveSummary: string
  owners: OwnerProfile[]
  gm: GmProfile
  seniorTeam: SeniorTeamMember[]
  flags: AssessmentFlag[]
  recommendations: string[]
  counselItems: string[]
}

export type FlagSeverity = 'deal-risk' | 'negotiation' | 'positive' | 'informational'

export interface AssessmentFlag {
  id: string
  section: 'Owner' | 'GM' | 'Bench' | 'General'
  severity: FlagSeverity
  title: string
  description: string
}
