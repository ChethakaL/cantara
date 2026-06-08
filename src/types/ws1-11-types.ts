// ── WS1-11: Tax Liability Review ────────────────────────────────────────────

export interface WS111Report {
  clientName: string
  generatedAt: string
  hitlStatus: 'in-progress' | 'complete'

  // Section 1: Document inventory
  documents: InventoryDocument[]

  // Section 2: Tax return summary
  taxReturnSummary: TaxReturnSummary[]

  // Section 3: Outstanding liabilities
  outstandingLiabilities: TaxLiability[]

  // Section 4: Audit history
  auditHistory: AuditRecord[]

  // Section 5: State & local tax compliance
  stateLocalCompliance: StateLocalTaxRecord[]

  // Section 6: Payroll tax review
  payrollTaxReview: PayrollTaxRecord[]

  // Section 7: Deal structure implications
  dealStructureImplications: DealImplication[]

  // Section 8: Buyer summary
  buyerSummary: BuyerSummary
}

export interface InventoryDocument {
  id: string
  filename: string
  docType: string
  taxYearsCovered: string
  date: string
  status: 'complete' | 'incomplete' | 'missing'
  statusNote: string
}

export interface TaxReturnSummary {
  id: string
  taxYear: string
  entityName: string
  returnType: string // e.g., "1120S", "1065", "1040 Schedule C"
  filingStatus: 'filed' | 'extended' | 'late-filed' | 'not-filed' | 'unknown'
  filingDate: string
  grossRevenue: string
  taxableIncome: string
  totalTaxDue: string
  totalTaxPaid: string
  balanceDue: string
  notes: string
  sourceRef: string
}

export interface TaxLiability {
  id: string
  type: 'federal' | 'state' | 'local' | 'payroll' | 'sales-tax' | 'property-tax' | 'other'
  description: string
  taxYear: string
  originalAmount: string
  currentBalance: string
  penaltiesInterest: string
  paymentPlan: 'yes' | 'no' | 'unknown'
  paymentPlanDetails: string
  status: 'outstanding' | 'in-collection' | 'under-appeal' | 'resolved' | 'unknown'
  lienFiled: 'yes' | 'no' | 'unknown'
  sourceRef: string
}

export interface AuditRecord {
  id: string
  taxAuthority: string
  taxYearsAudited: string
  auditType: string // e.g., "desk audit", "field audit", "correspondence"
  status: 'open' | 'closed-no-change' | 'closed-adjustment' | 'in-progress' | 'unknown'
  adjustmentAmount: string
  additionalTaxAssessed: string
  penalties: string
  outcome: string
  dateInitiated: string
  dateClosed: string
  sourceRef: string
}

export interface StateLocalTaxRecord {
  id: string
  state: string
  taxType: string // e.g., "income", "franchise", "sales & use", "gross receipts"
  filingStatus: 'current' | 'delinquent' | 'exempt' | 'not-registered' | 'unknown'
  nexusEstablished: 'yes' | 'no' | 'unknown'
  lastFiledYear: string
  outstandingBalance: string
  notes: string
  sourceRef: string
}

export interface PayrollTaxRecord {
  id: string
  period: string
  type: string // e.g., "941", "940", "state withholding"
  status: 'current' | 'delinquent' | 'penalty-assessed' | 'unknown'
  amountDue: string
  amountPaid: string
  balance: string
  trustFundIssue: 'yes' | 'no' | 'unknown'
  notes: string
  sourceRef: string
}

export interface DealImplication {
  id: string
  area: string
  risk: 'high' | 'medium' | 'low'
  description: string
  estimatedExposure: string
  recommendedAction: string
  dealStructureImpact: string // e.g., "escrow holdback", "indemnification", "price adjustment"
  sourceRef: string
}

export interface BuyerSummary {
  overallTaxHealthAssessment: string
  outstandingLiabilitySummary: string
  auditRiskAssessment: string
  stateComplianceOverview: string
  payrollTaxStatus: string
  dealStructureRecommendations: string
  estimatedTotalExposure: string
  transitionConsiderations: string
  counselItems: string[]
}

export interface WS111Flag {
  id: string
  domain: 'tax-returns' | 'outstanding-liabilities' | 'audit' | 'state-local' | 'payroll' | 'deal-structure' | 'general'
  severity: 'deal-risk' | 'negotiation' | 'informational'
  title: string
  description: string
  sourceRef: string
  status: 'pending' | 'confirmed' | 'na'
}

export interface WS111Persistence {
  markdown: string
  createdAt: string
  metadata?: any
}
