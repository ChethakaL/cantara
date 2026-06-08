// ── WS1-10: Legal Reports & Entity Search ──────────────────────────────────

export interface WS110Report {
  clientName: string
  generatedAt: string
  hitlStatus: 'in-progress' | 'complete'

  // Section 1: Document inventory
  documents: InventoryDocument[]

  // Section 2: Entity standing
  entityStanding: EntityStandingRecord[]

  // Section 3: UCC filings
  uccFilings: UCCFiling[]

  // Section 4: Registered agent status
  registeredAgentStatus: RegisteredAgentRecord[]

  // Section 5: Certificate of good standing
  goodStandingCertificates: GoodStandingCertificate[]

  // Section 6: Trademark search
  trademarkRecords: TrademarkRecord[]

  // Section 7: Buyer summary
  buyerSummary: BuyerSummary
}

export interface InventoryDocument {
  id: string
  filename: string
  docType: string
  entitiesCovered: string
  date: string
  status: 'complete' | 'incomplete' | 'missing'
  statusNote: string
}

export interface EntityStandingRecord {
  id: string
  entityName: string
  entityType: string
  stateOfFormation: string
  filingNumber: string
  status: 'active' | 'inactive' | 'dissolved' | 'delinquent' | 'revoked' | 'unknown'
  lastAnnualReportDate: string
  registeredAgent: string
  notes: string
  sourceRef: string
}

export interface UCCFiling {
  id: string
  filingNumber: string
  filingDate: string
  expirationDate: string
  debtorName: string
  securedParty: string
  collateralDescription: string
  status: 'active' | 'terminated' | 'expired' | 'amended' | 'unknown'
  amount: string
  sourceRef: string
}

export interface RegisteredAgentRecord {
  id: string
  entityName: string
  agentName: string
  agentAddress: string
  appointmentDate: string
  status: 'current' | 'expired' | 'changed' | 'unknown'
  notes: string
  sourceRef: string
}

export interface GoodStandingCertificate {
  id: string
  entityName: string
  state: string
  certificateDate: string
  expirationDate: string
  status: 'valid' | 'expired' | 'not-obtained' | 'pending' | 'unknown'
  notes: string
  sourceRef: string
}

export interface TrademarkRecord {
  id: string
  markName: string
  registrationNumber: string
  filingDate: string
  registrationDate: string
  expirationDate: string
  status: 'registered' | 'pending' | 'abandoned' | 'cancelled' | 'expired' | 'unknown'
  classOfGoods: string
  owner: string
  notes: string
  sourceRef: string
}

export interface BuyerSummary {
  entityStandingOverview: string
  uccExposureSummary: string
  registeredAgentCompliance: string
  goodStandingStatus: string
  trademarkProtection: string
  transitionConsiderations: string
  counselItems: string[]
}

export interface WS110Flag {
  id: string
  domain: 'entity-standing' | 'ucc-filings' | 'registered-agent' | 'good-standing' | 'trademark' | 'general'
  severity: 'deal-risk' | 'negotiation' | 'informational'
  title: string
  description: string
  sourceRef: string
  status: 'pending' | 'confirmed' | 'na'
}

export interface WS110Persistence {
  markdown: string
  createdAt: string
  metadata?: any
}
