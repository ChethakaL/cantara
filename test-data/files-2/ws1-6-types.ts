// ─────────────────────────────────────────────────────────────────────────────
// WS1-6 Employee Obligations — TypeScript Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

export type FlagSeverity = 'deal-risk' | 'negotiation' | 'positive' | 'informational'
export type FlagStatus   = 'pending' | 'confirmed' | 'na'
export type RiskLevel    = 'High' | 'Medium' | 'Low' | 'Unknown'
export type DocStatus    = 'complete' | 'incomplete' | 'missing'
export type TransitionComplexity = 'High' | 'Medium' | 'Low' | 'Unknown'

// ── Document Inventory ───────────────────────────────────────────────────────
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
  category: string
  reason: string
}

// ── Agreement Coverage ───────────────────────────────────────────────────────
export interface AgreementRow {
  role: string
  agreementType: 'Employment Agreement' | 'Offer Letter' | 'Standalone Non-Compete' | 'At-will Only' | 'Unknown'
  term: 'At-will' | 'Fixed-term' | 'At-will, 30-day notice' | string
  hasNonCompete: boolean | null
  hasNonSolicit: boolean | null
  hasNDA: boolean | null
  sourceRef: string
  isKeyPerson?: boolean
}

// ── Non-Compete / Non-Solicitation ───────────────────────────────────────────
export interface NonCompeteBlock {
  id: string
  party: string
  isCritical: boolean // owner/seller flag
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

// ── Benefits ─────────────────────────────────────────────────────────────────
export interface BenefitRow {
  benefitType: string
  employerContribution: string
  contractuallyBound: boolean | null
  assetSaleTransferable: 'Yes' | 'No' | 'Unclear' | 'Statutory' | 'Unknown'
  estimatedAnnualCost: string
  transitionComplexity: TransitionComplexity
  sourceRef: string
}

// ── Contractors ──────────────────────────────────────────────────────────────
export type ICRisk = 'High' | 'Moderate' | 'Low' | 'None Identified'

export interface ContractorBlock {
  id: string
  role: string
  agreementProvided: boolean
  misclassRisk: ICRisk
  riskFactors: string[]
  flag: FlagSeverity
}

// ── Key People ───────────────────────────────────────────────────────────────
export interface KeyPersonRow {
  role: string
  employmentType: string
  hasNonCompete: boolean
  hasAgreement: boolean
  riskLevel: RiskLevel
  transitionNotes: string
}

// ── Flags ────────────────────────────────────────────────────────────────────
export interface Flag {
  id: string          // e.g. "F-01"
  severity: FlagSeverity
  domain: string
  title: string
  description: string
  sourceRef: string
  status: FlagStatus
}

// ── Buyer Summary ────────────────────────────────────────────────────────────
export interface BuyerSummary {
  workforceOverview: string
  nonCompeteProtections: string
  assumedBenefitObligations: string
  retirementAndPTO: string
  icRisk: string
  transitionConsiderations: string
  counselItems: string[]
}

// ── Top-level Report ─────────────────────────────────────────────────────────
export interface WS16Report {
  clientName: string
  dba?: string
  state: string
  generatedAt: string           // ISO date string
  documentCount: number
  hitlStatus: 'pending' | 'in-progress' | 'complete'

  // Section data
  documents: InventoryDocument[]
  coverageGaps: CoverageGap[]
  agreements: AgreementRow[]
  nonCompetes: NonCompeteBlock[]
  benefits: BenefitRow[]
  contractors: ContractorBlock[]
  keyPeople: KeyPersonRow[]
  keyPersonNarrative: string
  buyerSummary: BuyerSummary
  flags: Flag[]
}
