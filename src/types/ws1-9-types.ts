// WS1-9 Business Permits & Zoning — TypeScript Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

export type FlagSeverity = 'deal-risk' | 'negotiation' | 'positive' | 'informational'
export type FlagStatus   = 'pending' | 'confirmed' | 'na'
export type RiskLevel    = 'High' | 'Medium' | 'Low' | 'Unknown'
export type DocStatus    = 'complete' | 'incomplete' | 'missing'
export type PermitStatus = 'Current' | 'Expired' | 'Expiring Soon' | 'Pending' | 'Unknown'
export type ZoningCompliance = 'Compliant' | 'Non-Compliant' | 'Conditional' | 'Unknown'
export type GrandfatherRisk = 'High' | 'Medium' | 'Low' | 'Unknown'

export interface WS19Persistence {
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

export interface WS19Flag {
  id: string
  domain: 'Permits' | 'Zoning' | 'CUP' | 'Grandfathering' | 'General'
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
    | 'Business License'
    | 'Kennel License'
    | 'Health Permit'
    | 'Fire Permit'
    | 'Zoning Verification'
    | 'Certificate of Occupancy'
    | 'Conditional Use Permit'
    | 'Signage Permit'
    | 'Building Permit'
    | 'Environmental Permit'
    | 'Variance Approval'
    | 'Other'
  issuingAuthority: string
  date: string
  status: DocStatus
  statusNote?: string
}

export interface PermitRecord {
  id: string
  permitType: string
  permitNumber: string
  issuingAuthority: string
  issueDate: string
  expirationDate: string
  status: PermitStatus
  renewalProcess: string
  conditions: string
  sourceRef: string
}

export interface ZoningRecord {
  id: string
  propertyAddress: string
  zoningDesignation: string
  permittedUses: string[]
  currentUse: string
  complianceStatus: ZoningCompliance
  restrictions: string[]
  setbacks: string
  parkingRequirements: string
  noiseOrdinance: string
  sourceRef: string
}

export interface ConditionalUsePermit {
  id: string
  cupNumber: string
  issuingAuthority: string
  issueDate: string
  approvedUse: string
  conditions: string[]
  complianceStatus: ZoningCompliance
  renewalRequired: boolean
  renewalDate: string
  transferability: 'Transferable' | 'Non-Transferable' | 'Requires Approval' | 'Unknown'
  sourceRef: string
}

export interface GrandfatheringItem {
  id: string
  nonConformingUse: string
  originalApprovalDate: string
  currentBasis: string
  triggerEvents: string[]
  riskLevel: GrandfatherRisk
  mitigationOptions: string
  sourceRef: string
}

export interface BuyerSummary {
  permitsOverview: string
  zoningCompliance: string
  conditionalUseStatus: string
  grandfatheringRisk: string
  transferConsiderations: string
  counselItems: string[]
}

export interface WS19Report {
  clientName: string
  generatedAt: string
  hitlStatus: 'pending' | 'in-progress' | 'complete'
  documents: InventoryDocument[]
  permits: PermitRecord[]
  zoning: ZoningRecord[]
  conditionalUsePermits: ConditionalUsePermit[]
  grandfathering: GrandfatheringItem[]
  buyerSummary: BuyerSummary
}
