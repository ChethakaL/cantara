export const TTM_REQUIRED_DOCUMENT_IDS = [
  "monthly_pl_excel",
  "monthly_bs_excel",
  "accountant_statements",
  "ar_aging_detail",
] as const;

export type TtmRequiredDocumentId = (typeof TTM_REQUIRED_DOCUMENT_IDS)[number];
export type TtmOptionalDocumentId = "quickbooks_api";
export type TtmDocumentId = TtmRequiredDocumentId | TtmOptionalDocumentId;

export type WorkbookFormat = "qb" | "standalone";
export type LedgerKind = "pl" | "bs";
export type DataQualitySection = "A" | "B" | "C" | "D" | "E";
export type FlagSeverity = "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type FlagResolutionAction = "RESOLVE" | "OVERRIDE" | "ESCALATE_CLIENT";
export type TtmRunStatus = "RUNNING" | "HITL_PENDING" | "APPROVED" | "FAILED";
export type TtmHitlStatus = "PENDING_REVIEW" | "IN_REVIEW" | "APPROVED";
export type AgentDispatchStatus = "BLOCKED_HITL" | "READY" | "RELEASED";

export interface InputDocumentSnapshot {
  documentId: TtmRequiredDocumentId;
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

export interface AnnualCategoryBreakdown {
  fiscalYear: string;
  breakdown: CategoryBreakdown[];
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
  errorMessage: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  createdAt: string;
  updatedAt: string;
  flags: TtmFlagView[];
  dispatchTasks: AgentDispatchTaskView[];
}

export interface TtmReadinessItem {
  documentId: TtmRequiredDocumentId;
  label: string;
  uploaded: boolean;
  fileName: string | null;
  uploadedAt: string | null;
}
