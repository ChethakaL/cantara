// WS1-8 Corporate Ownership Verification — TypeScript Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

export type FlagSeverity = 'deal-risk' | 'negotiation' | 'positive' | 'informational'
export type FlagStatus   = 'pending' | 'confirmed' | 'na'
export type FilingStatus = 'active' | 'expired' | 'pending' | 'unknown'
export type ComplianceStatus = 'compliant' | 'non-compliant' | 'unclear' | 'unknown'
export type EncumbranceStatus = 'active' | 'released' | 'expired' | 'unknown'

export interface WS18Persistence {
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

export interface WS18Flag {
  id: string
  domain: 'Entity-Structure' | 'Ownership' | 'Encumbrances' | 'State-Filings' | 'General'
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
    | 'Articles of Organization'
    | 'Operating Agreement'
    | 'Amendment'
    | 'Ownership Certificate'
    | 'UCC Search'
    | 'Good Standing Certificate'
    | 'Annual Report'
    | 'Foreign Qualification'
    | 'Title/Lien Search'
    | 'Other'
  partiesCovered: string
  date: string
  status: 'complete' | 'incomplete' | 'missing'
  statusNote?: string
}

export interface EntityRow {
  id: string
  entityName: string
  entityType: string         // LLC, Corp, LP, etc.
  stateOfFormation: string
  dateOfFormation: string
  ein?: string
  registeredAgent: string
  status: 'active' | 'inactive' | 'dissolved' | 'unknown'
  sourceRef: string
}

export interface OwnershipStake {
  id: string
  ownerName: string
  ownerType: string          // Individual, Entity, Trust, etc.
  entityOwned: string        // Which entity this stake is in
  ownershipPercentage: string
  classOfInterest: string    // Membership units, common stock, preferred, etc.
  votingRights: string
  transferRestrictions: string
  sourceRef: string
}

export interface EncumbranceRow {
  id: string
  type: string               // UCC Filing, Tax Lien, Judgment Lien, Mortgage, etc.
  filedAgainst: string       // Entity or individual
  securedParty: string
  filingDate: string
  expirationDate: string
  collateralDescription: string
  status: EncumbranceStatus
  amount?: string
  sourceRef: string
}

export interface StateFilingRow {
  id: string
  state: string
  filingType: string         // Annual Report, Good Standing, Foreign Qualification, etc.
  filingDate: string
  expirationDate: string
  status: FilingStatus
  complianceStatus: ComplianceStatus
  notes: string
  sourceRef: string
}

export interface BuyerSummary {
  entityStructureOverview: string
  ownershipClarity: string
  encumbranceExposure: string
  stateComplianceStatus: string
  transitionConsiderations: string
  counselItems: string[]
}

export interface WS18Report {
  clientName: string
  generatedAt: string
  hitlStatus: 'pending' | 'in-progress' | 'complete'
  documents: InventoryDocument[]
  entities: EntityRow[]
  ownershipStakes: OwnershipStake[]
  encumbrances: EncumbranceRow[]
  stateFilings: StateFilingRow[]
  buyerSummary: BuyerSummary
}
