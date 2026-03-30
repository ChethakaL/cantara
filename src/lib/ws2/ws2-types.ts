// ─────────────────────────────────────────────────────────────────────────────
// WS2 Report Types
// Cantara Pet Advisors Portal — Babalilm AI FZ-LLC
// ─────────────────────────────────────────────────────────────────────────────

export type FlagSeverity = "HIGH" | "MEDIUM" | "LOW";
export type TrafficLight = "GREEN" | "YELLOW" | "RED";
export type AgentStatus = "PENDING" | "RUNNING" | "COMPLETE" | "APPROVED" | "FAILED";

// ── Period Labels ─────────────────────────────────────────────────────────────
export interface PeriodCoverage {
  fy1Label: string;      // e.g. "FY 2022"
  fy1Range: string;      // e.g. "2022-01 — 2022-12"
  fy2Label: string;
  fy2Range: string;
  fy3Label: string;
  fy3Range: string;
  ttmLabel: string;      // e.g. "TTM Jan 2024 — Dec 2024"
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

// ── GL Mapping ────────────────────────────────────────────────────────────────
export interface GLMappingRow {
  accountName: string;
  glCode: string;
  cantaraCode: string;
  status: "AUTO-MAPPED" | "CRAIG-CLASSIFIED" | "FLAGGED-AMBIGUOUS" | "UNMAPPED";
}

// ── P&L Line ─────────────────────────────────────────────────────────────────
export interface PLLine {
  label: string;
  cantaraCode?: string;
  fy1: number;
  fy2: number;
  fy3: number;
  ttm: number;
  isTotal?: boolean;
  isSection?: boolean;
  isEbitda?: boolean;
  excludedFromEbitda?: boolean; // D&A, Interest
}

export interface AnnualPL {
  periodCoverage: PeriodCoverage;
  revenueLines: PLLine[];
  cogsLines: PLLine[];
  expenseLines: PLLine[];
  // Computed totals
  totalRevenue: { fy1: number; fy2: number; fy3: number; ttm: number };
  totalCogs: { fy1: number; fy2: number; fy3: number; ttm: number };
  grossProfit: { fy1: number; fy2: number; fy3: number; ttm: number };
  grossMargin: { fy1: number; fy2: number; fy3: number; ttm: number };
  totalOpex: { fy1: number; fy2: number; fy3: number; ttm: number };
  ebitdaPreRecast: { fy1: number; fy2: number; fy3: number; ttm: number };
  ebitdaMargin: { fy1: number; fy2: number; fy3: number; ttm: number };
  yoyRevenueGrowth: { fy1toFy2: number; fy2toFy3: number };
  netIncome: { fy1: number; fy2: number; fy3: number; ttm: number };
}

// ── Working Capital ───────────────────────────────────────────────────────────
export interface WorkingCapital {
  asOfDate: string;
  cash: number;
  accountsReceivable: number;
  inventory: number;
  prepaidExpenses: number;
  totalCurrentAssets: number;
  accountsPayable: number;
  accruedLiabilities: number;
  deferredRevenue: number;
  totalCurrentLiabilities: number;
  netWorkingCapital: number;
  trailingThreeMonthAvgNWC: number;
  arAgingBuckets: {
    current: number;
    days1to30: number;
    days31to60: number;
    days61to90: number;
    days90plus: number;
    total: number;
  };
  arVarianceToBalanceSheet: number;
}

// ── Data Quality ──────────────────────────────────────────────────────────────
export interface DQFlag {
  section: "A" | "B" | "C" | "D" | "E";
  severity: FlagSeverity;
  title: string;
  description: string;
  resolution?: string;
  resolved: boolean;
}

export interface DataQualityReport {
  flags: DQFlag[];
  totalFlags: number;
  resolvedFlags: number;
  sectionCounts: Record<string, number>;
  glClassificationRequests: GLMappingRow[];
  accountantDiscrepancies: {
    fiscalYear: string;
    lineItem: string;
    rollup: number;
    accountant: number;
    varianceDollar: number;
    variancePct: number;
  }[];
}

// ── WS2-1 Output ─────────────────────────────────────────────────────────────
export interface WS21Output {
  status: AgentStatus;
  approvedAt?: string;
  approvedBy?: string;
  runId: string;
  generatedAt: string;
  glMapping: GLMappingRow[];
  annualPL: AnnualPL;
  workingCapital: WorkingCapital;
  dataQuality: DataQualityReport;
  summaryText: string;
}

// ── Add-Back Item ─────────────────────────────────────────────────────────────
export type AddBackCategory = 1 | 2 | 3 | 4 | 5;
export type AddBackStatus =
  | "VERIFIED"
  | "FLAGGED-MAJOR"
  | "FLAGGED-MINOR"
  | "FLAGGED-SUSPICIOUS"
  | "FLAGGED-RECURRING"
  | "MISSING-DATA"
  | "DEFAULT"
  | "CALCULATED"
  | "CRAIG-OVERRIDE";

export interface AddBackItem {
  id: string;           // e.g. "1a", "2b"
  category: AddBackCategory;
  description: string;
  glAccount?: string;
  glCode?: string;
  ttmAmount: number;    // positive = add-back, negative = deduction
  fy3Amount?: number;
  fy2Amount?: number;
  fy1Amount?: number;
  status: AddBackStatus;
  statusNote?: string;
  craigOverrideAmount?: number;
  craigOverrideReason?: string;
}

export interface RecastSchedule {
  ttmEbitdaPreRecast: number;
  addBackItems: AddBackItem[];
  totalAddBacks: number;
  normalizedEbitdaTTM: number;
  normalizedEbitdaFY3?: number;
  normalizedEbitdaFY2?: number;
  normalizedEbitdaFY1?: number;
  normalizedMarginTTM: number;
  totalAddBacksFY3?: number;
  totalAddBacksFY2?: number;
  totalAddBacksFY1?: number;
  flagsForCraig: { itemId: string; issue: string; dollarImpact: number }[];
}

// ── Valuation ─────────────────────────────────────────────────────────────────
export interface ValuationByYear {
  fiscalYear: string;
  normalizedEbitda: number;
  margin: number | null;
  valuationMid: number;
}

export interface ValuationRange {
  normalizedEbitda: number;
  multipleAssumptions: { low: number; mid: number; high: number };
  valuationLow: number;
  valuationMid: number;
  valuationHigh: number;
  revenueMultipleLow: number;
  revenueMultipleMid: number;
  revenueMultipleHigh: number;
  revenueTrendFlag?: string;
  replacementSalary: number;
  replacementSalaryIsDefault: boolean;
  relatedPartyOwnership: boolean;
  fmrAdjustment?: number;
  byYear?: ValuationByYear[];
}

// ── WS2-2 Output ─────────────────────────────────────────────────────────────
export interface WS22Output {
  status: AgentStatus;
  approvedAt?: string;
  runId: string;
  generatedAt: string;
  recastSchedule: RecastSchedule;
  valuation: ValuationRange;
  craigInputs: {
    multipleRangeLow: number;
    multipleRangeMid: number;
    multipleRangeHigh: number;
    replacementSalary: number;
    relatedPartyOwnership: boolean;
    fmrEstimate?: number;
    enteredAt: string;
  };
}

// ── WS2-3 Revenue by Vertical ─────────────────────────────────────────────────
export interface VerticalRow {
  name: string;
  fy1Dollar: number;
  fy1Pct: number;
  fy2Dollar: number;
  fy2Pct: number;
  fy3Dollar: number;
  fy3Pct: number;
  ttmDollar: number;
  ttmPct: number;
  yoyFy1toFy2: number;
  yoyFy2toFy3: number;
  health: TrafficLight;
  healthNote: string;
}

export interface WS23Output {
  status: AgentStatus;
  generatedAt: string;
  verticals: VerticalRow[];
  boardingPlusDaycareConcentration: { fy1: number; fy2: number; fy3: number; ttm: number };
  concentrationFlags: string[];
  unmappedRevenue: string[];
  businessModelFlag?: string;
}

// ── WS2-4 Expense Benchmarks ──────────────────────────────────────────────────
export interface BenchmarkRow {
  category: string;
  benchmarkLow: number;
  benchmarkHigh: number;
  fy1Dollar: number;
  fy1Pct: number;
  fy2Dollar: number;
  fy2Pct: number;
  fy3Dollar: number;
  fy3Pct: number;
  ttmDollar: number;
  ttmPct: number;
  flag: TrafficLight;
  flagNote?: string;
  yoyFy1toFy2: number;
  yoyFy2toFy3: number;
}

export interface WS24Output {
  status: AgentStatus;
  generatedAt: string;
  benchmarks: BenchmarkRow[];
  overallHealth: TrafficLight;
  overallHealthNote: string;
  improvementOpportunities: string[];
}

// ── WS2-5 Labor Analysis ──────────────────────────────────────────────────────
export interface LaborRow {
  category: string;
  ttmAmount: number;
  ttmPct: number;
  fy3Amount: number;
  fy3Pct: number;
  fy2Pct: number;
  fy1Pct: number;
}

export interface WS25Output {
  status: AgentStatus;
  generatedAt: string;
  laborRows: LaborRow[];
  directLaborPct: number;           // staff + mgmt excl. owner
  buyerAdjustedLaborPct: number;
  benchmarkStatus: TrafficLight;
  benchmarkNote: string;
  ownerWeeklyHours?: number;
  ownerInvolvementFlag?: string;
  trendAssessment: TrafficLight;
  trendNote: string;
  flags: string[];
}

// ── Full WS2 Report ────────────────────────────────────────────────────────────
export interface WS2Report {
  clientName: string;
  clientId: string;
  engagementId: string;
  reportGeneratedAt: string;
  ws21: WS21Output;
  ws22?: WS22Output;
  ws23?: WS23Output;
  ws24?: WS24Output;
  ws25?: WS25Output;
  rawAnalysis?: unknown;
  rawRecast?: unknown;
  rawDerivedReports?: unknown[];
}
