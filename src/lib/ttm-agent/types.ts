export const TTM_REQUIRED_DOCUMENT_IDS = [
  "monthly_pl_excel",
  "monthly_bs_excel",
  "accountant_statements",
  "ar_aging_detail",
] as const;

export const WS2_RECAST_REQUIRED_DOCUMENT_IDS = [
  "addback_disclosure",
] as const;

/** @deprecated V2 used separate doc IDs — kept for migration compatibility */
export const WS2_RECAST_LEGACY_DOCUMENT_IDS = [
  "shareholder_remuneration_36m",
  "personal_expenses_36m",
  "non_recurring_expenses_36m",
  "tenant_improvements_36m",
] as const;

export const WS2_RECAST_OPTIONAL_DOCUMENT_IDS = ["leases", "quickbooks_api", "owner_gm_assessment"] as const;

export type TtmRequiredDocumentId = (typeof TTM_REQUIRED_DOCUMENT_IDS)[number];
export type Ws2RecastRequiredDocumentId = (typeof WS2_RECAST_REQUIRED_DOCUMENT_IDS)[number];
export type Ws2RecastLegacyDocumentId = (typeof WS2_RECAST_LEGACY_DOCUMENT_IDS)[number];
export type Ws2RecastOptionalDocumentId = (typeof WS2_RECAST_OPTIONAL_DOCUMENT_IDS)[number];
export type TtmOptionalDocumentId = "quickbooks_api";
export type TtmDocumentId = TtmRequiredDocumentId | TtmOptionalDocumentId;
export type Ws2DocumentId = TtmRequiredDocumentId | Ws2RecastRequiredDocumentId | Ws2RecastLegacyDocumentId | Ws2RecastOptionalDocumentId;

export type WorkbookFormat = "qb" | "standalone";
export type LedgerKind = "pl" | "bs";
export type DataQualitySection = "A" | "B" | "C" | "D" | "E";
export type FlagSeverity = "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type FlagResolutionAction = "RESOLVE" | "OVERRIDE" | "ESCALATE_CLIENT";
export type TtmRunStatus = "RUNNING" | "HITL_PENDING" | "APPROVED" | "FAILED";
export type TtmHitlStatus = "PENDING_REVIEW" | "IN_REVIEW" | "APPROVED";
export type AgentDispatchStatus = "BLOCKED_HITL" | "READY" | "RELEASED";
export type Ws2DerivedAgentId =
  | "ws2_3_rev_vertical_v1"
  | "ws2_4_benchmark_v1"
  | "ws2_5_labor_v1"
  | "ws2_10_report_generator_v1";
export type Ws2DerivedReportStatus = "RUNNING" | "COMPLETE" | "FAILED";

export interface PreparedDocumentTextBlock {
  sheetName: string;
  text: string;
}

export interface PreparedDocumentInput {
  documentId: Ws2DocumentId;
  fileName: string;
  mimeType: string;
  size: number;
  textBlocks?: PreparedDocumentTextBlock[];
  base64?: string;
}

export interface InputDocumentSnapshot {
  documentId: string;
  fileName: string;
  mimeType: string;
  size: number;
  localPath: string;
  createdAt: string;
}

export interface NormalizedLedgerRow {
  accountName: string;
  accountCode: string | null;
  valuesByMonth: Record<string, number>;
  total: number;
  sourceSheet: string;
  rowIndex: number;
}

export interface ParsedMonthlyWorkbook {
  documentId: Extract<TtmDocumentId, "monthly_pl_excel" | "monthly_bs_excel">;
  format: WorkbookFormat;
  headerRowIndex: number;
  monthKeys: string[];
  accountColumnIndex: number;
  codeColumnIndex: number | null;
  rows: NormalizedLedgerRow[];
  notes: string[];
}

export interface MappedLedgerRow extends NormalizedLedgerRow {
  cantaraCode: string | null;
  category: string | null;
  categoryType: "revenue" | "cogs" | "opex" | "working_capital" | "other";
  mappingMethod: "exact" | "alias" | "fuzzy" | "claude" | "unmapped";
  mappingConfidence: number;
  candidateCodes: string[];
  isMajor: boolean;
}

export interface AccountantStatementYear {
  fiscalYear: string;
  revenue: number | null;
  cogs: number | null;
  grossProfit: number | null;
  opEx: number | null;
  netIncome: number | null;
}

export interface ParsedAccountantStatements {
  sourceType: "xlsx" | "pdf";
  confidence: FlagSeverity;
  years: AccountantStatementYear[];
  notes: string[];
}

export interface ArAgingEntry {
  customerName: string;
  current: number;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  days90Plus: number;
  total: number;
}

export interface ParsedArAging {
  headerRowIndex: number;
  sourceSheet: string;
  entries: ArAgingEntry[];
  notes: string[];
}

export interface SectionReportItem {
  title: string;
  severity: FlagSeverity;
  description: string;
  payload: Record<string, unknown>;
}

export interface DataQualitySectionReport {
  title: string;
  status: "clear" | "issues" | "skipped";
  note?: string;
  items: SectionReportItem[];
}

export interface DataQualityReport {
  generatedAt: string;
  sectionOrder: DataQualitySection[];
  sections: Record<DataQualitySection, DataQualitySectionReport>;
  counts: Record<DataQualitySection, number>;
}

export interface CategoryBreakdown {
  code: string;
  category: string;
  value: number;
}

export interface StructuredMonth {
  month: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number | null;
  opEx: number;
  ebitdaPreRecast: number;
  breakdown: CategoryBreakdown[];
}

export interface StructuredFinancialModel {
  months: StructuredMonth[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

export interface TtmSummary {
  startMonth: string;
  endMonth: string;
  revenueByCategory: CategoryBreakdown[];
  cogsByCategory: CategoryBreakdown[];
  opExByCategory: CategoryBreakdown[];
  totalRevenue: number;
  totalCogs: number;
  grossProfit: number;
  grossMarginPct: number | null;
  totalOpEx: number;
  ebitdaPreRecast: number;
  ebitdaMarginPct: number | null;
}

export interface AnnualTrend {
  fromFiscalYear: string;
  toFiscalYear: string;
  revenueYoYPct: number | null;
  grossMarginPointChange: number | null;
  ebitdaYoYPct: number | null;
  opExPctByCode: Record<string, number | null>;
}

export interface AnnualModelYear {
  fiscalYear: string;
  periodStart: string;
  periodEnd: string;
  accountantYearKey: string | null;
  revenueByCategory: CategoryBreakdown[];
  cogsByCategory: CategoryBreakdown[];
  opExByCategory: CategoryBreakdown[];
  totalRevenue: number;
  totalCogs: number;
  grossProfit: number;
  grossMarginPct: number | null;
  totalOpEx: number;
  ebitdaPreRecast: number;
  netIncome: number | null;
}

export interface AnnualModel {
  years: AnnualModelYear[];
  trends: AnnualTrend[];
  anomalies: string[];
}

export interface WorkingCapitalComponent {
  code: string;
  category: string;
  value: number;
}

export interface WorkingCapitalSummary {
  month: string;
  currentAssets: WorkingCapitalComponent[];
  currentLiabilities: WorkingCapitalComponent[];
  totalCurrentAssets: number;
  totalCurrentLiabilities: number;
  netWorkingCapital: number;
  trailingThreeMonthAverageNwc: number | null;
  arAging: {
    totalAr: number;
    current: number;
    days1To30: number;
    days31To60: number;
    days61To90: number;
    days90Plus: number;
    pctCurrent: number | null;
    pct1To30: number | null;
    pct31To60: number | null;
    pct61To90: number | null;
    pct90Plus: number | null;
    topCustomers: Array<{ customerName: string; total: number; pctOfTotal: number | null }>;
    reconcilesToBalanceSheet: boolean;
    varianceToBalanceSheetAr: number;
  };
}

export interface TtmAgentSummary {
  overview: string;
  mappingNotes: string[];
  anomalyNotes: string[];
  qualitySummary: string;
}

export interface TtmFlagView {
  id: string;
  analysisId: string;
  section: DataQualitySection;
  severity: FlagSeverity;
  title: string;
  description: string | null;
  payload: Record<string, unknown>;
  resolutionStatus: "OPEN" | "ACTIONED";
  resolutionAction: FlagResolutionAction | null;
  resolutionNotes: string | null;
  escalatedRequirementId: string | null;
  resolvedAt: string | null;
  resolvedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentDispatchTaskView {
  id: string;
  analysisId: string;
  clientId: string;
  agentId: string;
  status: AgentDispatchStatus;
  payload: Record<string, unknown> | null;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TtmAnalysisView {
  id: string;
  clientId: string;
  version: number;
  status: TtmRunStatus;
  hitlStatus: TtmHitlStatus;
  inputFingerprint: string;
  model: string;
  temperature: number;
  maxTokens: number;
  inputSnapshot: InputDocumentSnapshot[];
  normalizedData: Record<string, unknown> | null;
  structuredModel: StructuredFinancialModel | null;
  ttmSummary: TtmSummary | null;
  annualModel: AnnualModel | null;
  workingCapital: WorkingCapitalSummary | null;
  dataQualityReport: DataQualityReport | null;
  summary: TtmAgentSummary | null;
  reportMarkdown: string | null;
  errorMessage: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  createdAt: string;
  updatedAt: string;
  flags: TtmFlagView[];
  dispatchTasks: AgentDispatchTaskView[];
  recastAnalyses?: Ws2RecastView[];
  derivedReports?: Ws2DerivedReportView[];
}

export interface Ws2RecastAssumptions {
  multipleLow: number | null;
  multipleMid: number | null;
  multipleHigh: number | null;
  replacementSalary: number | null;
  relatedPartyOwnership: boolean;
  fmrEstimate: number | null;
  notes?: string | null;
}

export interface Ws2RecastFlagView {
  id: string;
  recastAnalysisId: string;
  severity: FlagSeverity;
  title: string;
  description: string | null;
  payload: Record<string, unknown>;
  resolutionStatus: "OPEN" | "ACTIONED";
  resolutionAction: FlagResolutionAction | null;
  resolutionNotes: string | null;
  overrideAmount: number | null;
  resolvedAt: string | null;
  resolvedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Ws2RecastView {
  id: string;
  clientId: string;
  ttmAnalysisId: string;
  version: number;
  status: TtmRunStatus;
  hitlStatus: TtmHitlStatus;
  model: string;
  temperature: number;
  maxTokens: number;
  assumptions: Ws2RecastAssumptions;
  reportMarkdown: string | null;
  parsedReport: Record<string, unknown> | null;
  workbookKey: string | null;
  workbookUrl: string | null;
  normalizedEbitda: number | null;
  valuationLow: number | null;
  valuationMid: number | null;
  valuationHigh: number | null;
  errorMessage: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  createdAt: string;
  updatedAt: string;
  flags: Ws2RecastFlagView[];
}

export interface Ws2DerivedReportView {
  id: string;
  clientId: string;
  ttmAnalysisId: string;
  recastAnalysisId: string | null;
  agentId: Ws2DerivedAgentId;
  status: Ws2DerivedReportStatus;
  reportMarkdown: string | null;
  parsedReport: Record<string, unknown> | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TtmReadinessItem {
  documentId: Ws2DocumentId;
  label: string;
  uploaded: boolean;
  fileName: string | null;
  uploadedAt: string | null;
}
