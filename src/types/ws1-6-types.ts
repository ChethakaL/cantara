// WS1-6 Employee Obligations — TypeScript Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

export type FlagSeverity = 'deal-risk' | 'negotiation' | 'positive' | 'informational'
export type FlagStatus   = 'pending' | 'confirmed' | 'na'
export type RiskLevel    = 'High' | 'Medium' | 'Low' | 'Unknown'
export type DocStatus    = 'complete' | 'incomplete' | 'missing'
export type TransitionComplexity = 'High' | 'Medium' | 'Low' | 'Unknown'

export interface WS16Persistence {
  markdown: string
  createdAt: string
  aiProvider?: string | null
  aiModel?: string | null
  metadata?: {
    flags?: Array<{ id: string; status: FlagStatus }>
    releasedAt?: string | null
    downstream?: Record<string, unknown>
  }
}

export interface Flag {
  id: string
  domain: 'Agreements' | 'Non-competes' | 'Benefits' | 'Contractors' | 'Key-people' | 'General'
  severity: FlagSeverity
  title: string
  description: string
  sourceRef: string
  status: FlagStatus
}

export interface InventoryDocument {
  id: string
  filename: string
  docType:
    | 'Employment Agreement'
    | 'Non-Compete'
    | 'Handbook'
    | 'Benefits Summary'
    | 'Payroll Register'
    | 'Org Chart'
    | 'IC Agreement'
    | 'Offer Letter'
    | 'Severance'
    | 'Retirement Plan'
    | 'Other'
  partiesCovered: string
  date: string
  status: DocStatus
  statusNote?: string
}

export interface CoverageGap {
  item?: string
  category: string
  reason: string
  status: 'missing' | 'incomplete' | 'complete'
  note?: string
}

export interface AgreementRow {
  role: string
  agreementType: string
  term: string
  hasNonCompete: boolean | null
  hasNonSolicit: boolean | null
  hasNDA: boolean | null
  sourceRef: string
  isKeyPerson?: boolean
}

export interface NonCompeteBlock {
  id: string
  party: string
  isCritical: boolean
  sourceDoc: string
  sourceSection: string
  geographicScope: string
  duration: string
  coveredActivities: string[]
  considerationNote: string
  stateEnforceabilityNote: string
  flag: FlagSeverity
  flagExplanation: string
}

export interface BenefitRow {
  benefitType: string
  employerContribution: string
  contractuallyBound: boolean | null
  assetSaleTransferable: 'Yes' | 'No' | 'Unclear' | 'Statutory' | 'Unknown'
  estimatedAnnualCost: string
  transitionComplexity: TransitionComplexity
}

export interface ContractorRow {
  id: string
  role: string
  agreementProvided: boolean
  misclassRisk: 'High' | 'Moderate' | 'None Identified'
  riskFactors: string[]
  flag: FlagSeverity
}

export interface KeyPersonRow {
  role: string
  employmentType: string
  hasNonCompete: boolean | null
  hasAgreement: boolean | null
  riskLevel: RiskLevel
  transitionNotes: string
}

export interface BuyerSummary {
  workforceOverview: string
  nonCompeteProtections: string
  assumedBenefitObligations: string
  retirementAndPTO: string
  independentContractorRisk?: string
  transitionConsiderations: string
  counselItems: string[]
}

export interface WS16Report {
  clientName: string
  generatedAt: string
  hitlStatus: 'pending' | 'in-progress' | 'complete'
  coverageGaps: CoverageGap[]
  buyerSummary: BuyerSummary
  documents: InventoryDocument[]
  agreements: AgreementRow[]
  nonCompetes: NonCompeteBlock[]
  benefits: BenefitRow[]
  contractors: ContractorRow[]
  keyPeople: KeyPersonRow[]
  keyPersonNarrative: string
}
