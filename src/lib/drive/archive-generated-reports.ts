/**
 * Build Drive archive tasks for every agent/report we can reconstruct as HTML.
 * Used by Sync All — keeps sync-all/route.ts from growing into a mega-file.
 */
import { buildAdvisorsReportHtml } from "@/lib/report-export/build-advisors-report";
import { buildAssessmentReportHtml } from "@/lib/report-export/build-assessment-report";
import { buildBuyerReportHtml } from "@/lib/report-export/build-buyer-report";
import { buildCompetitorReportHtml } from "@/lib/report-export/build-competitor-report";
import { buildContractReportHtml } from "@/lib/report-export/build-contract-report";
import { buildDigitalPresenceReportHtml } from "@/lib/report-export/build-digital-presence-report";
import { buildEmployeeCompReportHtml } from "@/lib/report-export/build-employee-comp-report";
import { buildEmployeeObligationsReportHtml } from "@/lib/report-export/build-employee-obligations-report";
import { buildFacilityReviewReportHtml } from "@/lib/report-export/build-facility-review-report";
import { buildImprovementRoadmapHtml } from "@/lib/report-export/build-improvement-roadmap-report";
import { buildInsuranceReportHtml } from "@/lib/report-export/build-insurance-report";
import { buildLeaseReportHtml } from "@/lib/report-export/build-lease-report";
import { buildLegalEntitySearchReportHtml } from "@/lib/report-export/build-legal-entity-search-report";
import { buildLitigationReportHtml } from "@/lib/report-export/build-litigation-report";
import { buildLoiReviewReportHtml } from "@/lib/report-export/build-loi-review-report";
import { buildMarkdownReportHtml } from "@/lib/report-export/build-markdown-report";
import { buildOccupancyReviewReportHtml } from "@/lib/report-export/build-occupancy-review-report";
import { buildOrgChartReportHtml } from "@/lib/report-export/build-org-chart-report";
import { buildOwnerGmReportHtml } from "@/lib/report-export/build-owner-gm-report";
import { buildOwnershipVerificationReportHtml } from "@/lib/report-export/build-ownership-verification-report";
import { buildPermitsZoningReportHtml } from "@/lib/report-export/build-permits-zoning-report";
import { buildPricingAnalysisReportHtml } from "@/lib/report-export/build-pricing-analysis-report";
import { buildPricingVerticalReportHtml } from "@/lib/report-export/build-pricing-vertical-report";
import { buildSalesReviewReportHtml } from "@/lib/report-export/build-sales-review-report";
import { buildTaxLiabilityReportHtml } from "@/lib/report-export/build-tax-liability-report";
import { buildVendorReportHtml } from "@/lib/report-export/build-vendor-report";
import { parseReport as parseContractReport } from "@/lib/contract-analysis/parse-report";
import { parseReport as parseLeaseReport } from "@/lib/lease-analysis/parse-report";
import { parseWS16Markdown } from "@/lib/ws1-6/parser";
import { parseWS18Markdown } from "@/lib/ws1-8/parser";
import { parseWS19Markdown } from "@/lib/ws1-9/parser";
import { parseWS110Markdown } from "@/lib/ws1-10/parser";
import { parseWS111Markdown } from "@/lib/ws1-11/parser";
import { generateCimHtml } from "@/lib/cim/generate-html";
import { generateTeaserHtml } from "@/lib/teaser/generate-html";
import type { LitigationSearchResult } from "@/lib/litigation-search/search";
import { AGENT_RUN_KEYS } from "@/lib/agent-run-keys";

export type ArchiveReportTask = {
  label: string;
  agentFolder: string;
  fileName: string;
  overwritePrefix?: string;
  /** Lazy — only build HTML/PDF when Drive does not already have this report. */
  buildHtml: () => string;
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function safeFileName(input: string) {
  return input.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").replace(/\s+/g, " ").trim().slice(0, 180) || "report";
}

function latestBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    const key = keyFn(item);
    const existing = map.get(key);
    const itemDate = new Date((item as any).updatedAt || (item as any).createdAt || 0).getTime();
    const existingDate = existing
      ? new Date((existing as any).updatedAt || (existing as any).createdAt || 0).getTime()
      : 0;
    if (!existing || itemDate > existingDate) map.set(key, item);
  }
  return Array.from(map.values());
}

function markdownHtml(title: string, clientName: string, markdown: string, generatedAt?: string | Date | null) {
  return buildMarkdownReportHtml({ title, clientName, markdown, generatedAt });
}

function combineLitigation(report: Record<string, unknown> | null): LitigationSearchResult | null {
  if (!report) return null;
  const searchResult = (report.searchResult as LitigationSearchResult | undefined) || null;
  const docResult = (report.docResult as LitigationSearchResult | undefined) || null;
  if (!searchResult && !docResult) {
    // Legacy shape: whole report is the result
    if (report.findings || report.riskLevel) return report as unknown as LitigationSearchResult;
    return null;
  }
  if (searchResult && !docResult) return searchResult;
  if (!searchResult && docResult) return docResult;
  const risk =
    searchResult!.riskLevel === "high" || docResult!.riskLevel === "high"
      ? "high"
      : searchResult!.riskLevel === "medium" || docResult!.riskLevel === "medium"
        ? "medium"
        : searchResult!.riskLevel === "low" || docResult!.riskLevel === "low"
          ? "low"
          : "clear";
  return {
    riskLevel: risk,
    summary: `Public Records Search: ${searchResult!.summary}\n\nDocument Analysis: ${docResult!.summary}`,
    findings: [...(searchResult!.findings || []), ...(docResult!.findings || [])],
    searchesPerformed: [...(searchResult!.searchesPerformed || []), ...(docResult!.searchesPerformed || [])],
    generatedAt: docResult!.generatedAt || searchResult!.generatedAt,
  };
}

function pushTask(
  tasks: ArchiveReportTask[],
  args: {
    label: string;
    agentFolder: string;
    fileName: string;
    overwritePrefix?: string;
    buildHtml: () => string | null | undefined;
  },
) {
  tasks.push({
    label: args.label,
    agentFolder: args.agentFolder,
    fileName: safeFileName(args.fileName),
    overwritePrefix: args.overwritePrefix,
    buildHtml: () => (args.buildHtml() || "").trim(),
  });
}

function submissions(client: any): Record<string, unknown> {
  return asObject(client.sectionSubmissions) || {};
}

function latestRun(client: any, agentKey: string) {
  const runs = Array.isArray(client.AgentAnalysisRuns) ? client.AgentAnalysisRuns : [];
  return latestBy(
    runs.filter((r: any) => r.agentKey === agentKey),
    () => "latest",
  )[0] as any | undefined;
}

/**
 * Collect archive tasks for one client. Missing reports are skipped (not errors).
 */
export function buildClientGeneratedReportArchiveTasks(client: any, clientName: string): ArchiveReportTask[] {
  const tasks: ArchiveReportTask[] = [];
  const ss = submissions(client);

  // ── Dedicated analysis tables (existing Sync All coverage) ───────────────
  for (const item of latestBy(client.LeaseAnalysis ?? [], (item: any) => item.fileName || item.id) as any[]) {
    const parsed = asObject(item.parsed) ?? parseLeaseReport(item.report);
    pushTask(tasks, {
      label: `Lease Analysis: ${item.fileName || item.id}`,
      agentFolder: "Lease Analysis",
      fileName: `Lease Analysis - ${String(item.fileName || item.id).replace(/(\.pdf)+$/i, "")}`,
      buildHtml: () => buildLeaseReportHtml(parsed as any, clientName),
    });
  }

  for (const item of latestBy(client.ContractAnalysis ?? [], (item: any) => item.fileName || item.id) as any[]) {
    const parsed = asObject(item.parsed) ?? parseContractReport(item.report);
    pushTask(tasks, {
      label: `Contract Analysis: ${item.fileName || item.id}`,
      agentFolder: "Contract Analysis",
      fileName: `Contract Analysis - ${String(item.fileName || item.id).replace(/(\.pdf)+$/i, "")}`,
      buildHtml: () => buildContractReportHtml(parsed as any, clientName),
    });
  }

  for (const item of latestBy(client.CompetitorAnalyses ?? [], () => "latest") as any[]) {
    const parsed = asObject(item.parsed);
    pushTask(tasks, {
      label: "Competitor Analysis",
      agentFolder: "Competitor Analysis",
      fileName: "Competitor Analysis",
      overwritePrefix: "Competitor Analysis",
      buildHtml: () => parsed
        ? buildCompetitorReportHtml(parsed as any)
        : item.report
          ? markdownHtml("Competitor Analysis Report", clientName, String(item.report), item.createdAt)
          : null,
    });
  }

  for (const item of latestBy(client.EmployeeObligationsReports ?? [], () => "latest") as any[]) {
    if (!item.markdown) continue;
    const { report, flags } = parseWS16Markdown(item.markdown, clientName);
    pushTask(tasks, {
      label: "Employee Obligations",
      agentFolder: "Employee Obligations",
      fileName: "Employee Obligations",
      overwritePrefix: "Employee Obligations",
      buildHtml: () => buildEmployeeObligationsReportHtml(
        {
          documents: [],
          agreements: [],
          nonCompetes: [],
          benefits: [],
          contractors: [],
          keyPeople: [],
          keyPersonNarrative: "",
          coverageGaps: [],
          buyerSummary: {
            workforceOverview: "No summary available.",
            nonCompeteProtections: "",
            assumedBenefitObligations: "",
            retirementAndPTO: "",
            independentContractorRisk: "",
            transitionConsiderations: "",
            counselItems: [],
          },
          ...report,
        } as any,
        flags as any,
        clientName,
      ),
    });
  }

  for (const item of latestBy(client.TtmAnalyses ?? [], () => "latest") as any[]) {
    if (!item.reportMarkdown) continue;
    pushTask(tasks, {
      label: "TTM Analysis",
      agentFolder: "TTM Analysis",
      fileName: "TTM Analysis",
      overwritePrefix: "TTM Analysis",
      buildHtml: () => markdownHtml(`TTM Analysis v${item.version ?? ""}`.trim(), clientName, item.reportMarkdown, item.updatedAt),
    });
  }

  for (const item of latestBy(client.Ws2RecastAnalyses ?? [], () => "latest") as any[]) {
    if (!item.reportMarkdown) continue;
    pushTask(tasks, {
      label: "WS2 Recast",
      agentFolder: "WS2 Recast",
      fileName: "WS2 Recast",
      overwritePrefix: "WS2 Recast",
      buildHtml: () => markdownHtml(`WS2 Recast v${item.version ?? ""}`.trim(), clientName, item.reportMarkdown, item.updatedAt),
    });
  }

  for (const item of latestBy(client.Ws2DerivedReports ?? [], (item: any) => item.agentId) as any[]) {
    if (!item.reportMarkdown) continue;
    pushTask(tasks, {
      label: `WS2 Derived: ${item.agentId}`,
      agentFolder: "WS2 Derived",
      fileName: `WS2 Derived - ${item.agentId}`,
      overwritePrefix: `WS2 Derived - ${item.agentId}`,
      buildHtml: () => markdownHtml(`WS2 Derived ${item.agentId}`, clientName, item.reportMarkdown, item.updatedAt),
    });
  }

  // ── Dedicated report tables ──────────────────────────────────────────────
  for (const item of latestBy(client.RealEstateAppraisalReports ?? [], () => "latest") as any[]) {
    if (!item.markdown) continue;
    pushTask(tasks, {
      label: "Real Estate Appraisal",
      agentFolder: "Real Estate Appraisal",
      fileName: "Real Estate Appraisal",
      overwritePrefix: "Real Estate Appraisal",
      buildHtml: () => markdownHtml("Real Estate Appraisal", clientName, item.markdown, item.updatedAt),
    });
  }

  for (const item of latestBy(client.OwnershipVerificationReports ?? [], () => "latest") as any[]) {
    if (!item.markdown) continue;
    try {
      const { report, flags } = parseWS18Markdown(item.markdown, clientName);
      pushTask(tasks, {
        label: "Ownership Verification",
        agentFolder: "Ownership Verification",
        fileName: "Ownership Verification",
        overwritePrefix: "Ownership Verification",
        buildHtml: () => buildOwnershipVerificationReportHtml(report as any, flags as any, clientName),
      });
    } catch {
      pushTask(tasks, {
        label: "Ownership Verification",
        agentFolder: "Ownership Verification",
        fileName: "Ownership Verification",
        overwritePrefix: "Ownership Verification",
        buildHtml: () => markdownHtml("Ownership Verification", clientName, item.markdown, item.updatedAt),
      });
    }
  }

  for (const item of latestBy(client.PermitsZoningReports ?? [], () => "latest") as any[]) {
    if (!item.markdown) continue;
    try {
      const { report, flags } = parseWS19Markdown(item.markdown, clientName);
      pushTask(tasks, {
        label: "Permits & Zoning",
        agentFolder: "Permits & Zoning",
        fileName: "Permits & Zoning",
        overwritePrefix: "Permits & Zoning",
        buildHtml: () => buildPermitsZoningReportHtml(report as any, flags as any, clientName),
      });
    } catch {
      pushTask(tasks, {
        label: "Permits & Zoning",
        agentFolder: "Permits & Zoning",
        fileName: "Permits & Zoning",
        overwritePrefix: "Permits & Zoning",
        buildHtml: () => markdownHtml("Permits & Zoning", clientName, item.markdown, item.updatedAt),
      });
    }
  }

  for (const item of latestBy(client.LegalEntitySearchReports ?? [], () => "latest") as any[]) {
    if (!item.markdown) continue;
    try {
      const { report, flags } = parseWS110Markdown(item.markdown, clientName);
      pushTask(tasks, {
        label: "Legal Entity Search",
        agentFolder: "Legal Entity Search",
        fileName: "Legal Entity Search",
        overwritePrefix: "Legal Entity Search",
        buildHtml: () => buildLegalEntitySearchReportHtml(report as any, flags as any, clientName),
      });
    } catch {
      pushTask(tasks, {
        label: "Legal Entity Search",
        agentFolder: "Legal Entity Search",
        fileName: "Legal Entity Search",
        overwritePrefix: "Legal Entity Search",
        buildHtml: () => markdownHtml("Legal Entity Search", clientName, item.markdown, item.updatedAt),
      });
    }
  }

  for (const item of latestBy(client.TaxLiabilityReports ?? [], () => "latest") as any[]) {
    if (!item.markdown) continue;
    try {
      const { report, flags } = parseWS111Markdown(item.markdown, clientName);
      pushTask(tasks, {
        label: "Tax Liability Review",
        agentFolder: "Tax Liability Review",
        fileName: "Tax Liability Review",
        overwritePrefix: "Tax Liability Review",
        buildHtml: () => buildTaxLiabilityReportHtml(report as any, flags as any, clientName),
      });
    } catch {
      pushTask(tasks, {
        label: "Tax Liability Review",
        agentFolder: "Tax Liability Review",
        fileName: "Tax Liability Review",
        overwritePrefix: "Tax Liability Review",
        buildHtml: () => markdownHtml("Tax Liability Review", clientName, item.markdown, item.updatedAt),
      });
    }
  }

  const cim = client.CimReport;
  if (cim?.data) {
    const data = asObject(cim.data) || {};
    const storedHtml = typeof data.generatedHtml === "string" ? data.generatedHtml : null;
    pushTask(tasks, {
      label: "CIM",
      agentFolder: "CIM",
      fileName: "CIM",
      overwritePrefix: "CIM",
      buildHtml: () => storedHtml || generateCimHtml(data as any),
    });
  }

  const teaser = client.TeaserReport;
  if (teaser?.data) {
    const data = asObject(teaser.data) || {};
    const storedHtml = typeof data.generatedHtml === "string" ? data.generatedHtml : null;
    pushTask(tasks, {
      label: "Teaser",
      agentFolder: "Teaser",
      fileName: "Teaser",
      overwritePrefix: "Teaser",
      buildHtml: () => storedHtml || generateTeaserHtml(data as any),
    });
  }

  // ── AgentAnalysisRun agents ──────────────────────────────────────────────
  const digital = latestRun(client, AGENT_RUN_KEYS.digitalPresence) || asObject(ss.digitalPresence);
  if (digital) {
    const report = asObject((digital as any).report) || asObject(digital);
    if (report) {
      pushTask(tasks, {
        label: "Digital Presence",
        agentFolder: "Digital Presence",
        fileName: "Digital Presence",
        overwritePrefix: "Digital Presence",
        buildHtml: () => buildDigitalPresenceReportHtml(report as any),
      });
    }
  }

  const insurance = latestRun(client, AGENT_RUN_KEYS.insuranceReview);
  if (insurance) {
    const payload = asObject(insurance.report) || {};
    const summary = asObject(payload.summary) || payload;
    const docName =
      (asObject(payload.document) as any)?.fileName ||
      insurance.fileName ||
      "insurance-review";
    pushTask(tasks, {
      label: `Insurance Review: ${docName}`,
      agentFolder: "Insurance Review",
      fileName: `Insurance Review - ${String(docName).replace(/(\.pdf)+$/i, "")}`,
      overwritePrefix: "Insurance Review",
      buildHtml: () => buildInsuranceReportHtml(summary as any, String(docName), clientName),
    });
  }

  const employeeComp = latestRun(client, AGENT_RUN_KEYS.employeeComp) || asObject(ss.employeeCompReport) || asObject(ss.employeeComp);
  if (employeeComp) {
    const report = asObject((employeeComp as any).report) || asObject(employeeComp);
    const employees = Array.isArray((report as any)?.employees) ? (report as any).employees : null;
    const summary = asObject((report as any)?.summary);
    if (employees && summary) {
      pushTask(tasks, {
        label: "Employee Comp",
        agentFolder: "Employee Comp",
        fileName: "Employee Comp",
        overwritePrefix: "Employee Comp",
        buildHtml: () => buildEmployeeCompReportHtml(employees, summary as any, clientName),
      });
    }
  }

  const occupancy = latestRun(client, AGENT_RUN_KEYS.occupancyReview) || asObject(ss.occupancyReview);
  if (occupancy) {
    const report = asObject((occupancy as any).report) || asObject(occupancy);
    if (report) {
      pushTask(tasks, {
        label: "Occupancy Review",
        agentFolder: "Occupancy Review",
        fileName: "Occupancy Review",
        overwritePrefix: "Occupancy Review",
        buildHtml: () => buildOccupancyReviewReportHtml(report as any),
      });
    }
  }

  const litigationRun = latestRun(client, AGENT_RUN_KEYS.litigationSearch);
  const litigationPayload =
    asObject(litigationRun?.report) || asObject(ss.litigationSearch);
  const litigation = combineLitigation(litigationPayload);
  if (litigation) {
    pushTask(tasks, {
      label: "Litigation Search",
      agentFolder: "Litigation Search",
      fileName: "Litigation Search",
      overwritePrefix: "Litigation Search",
      buildHtml: () => buildLitigationReportHtml(litigation, clientName),
    });
  }

  const loi = latestRun(client, AGENT_RUN_KEYS.loiReview) || asObject(ss.loiReview);
  if (loi) {
    const report = asObject((loi as any).report) || asObject(loi);
    if (report) {
      pushTask(tasks, {
        label: "LOI Review",
        agentFolder: "LOI Review",
        fileName: "LOI Review",
        overwritePrefix: "LOI Review",
        buildHtml: () => buildLoiReviewReportHtml(report as any),
      });
    }
  }

  const pricing = latestRun(client, AGENT_RUN_KEYS.pricingAnalysis) || asObject(ss.pricingAnalysis);
  if (pricing) {
    const report = asObject((pricing as any).report) || asObject(pricing);
    if (report) {
      pushTask(tasks, {
        label: "Pricing Analysis",
        agentFolder: "Pricing Analysis",
        fileName: "Pricing Analysis",
        overwritePrefix: "Pricing Analysis",
        buildHtml: () => buildPricingAnalysisReportHtml(report as any, clientName),
      });
    }
  }

  const facility = latestRun(client, AGENT_RUN_KEYS.facilityReview) || asObject(ss.facilityReview);
  if (facility) {
    const report = asObject((facility as any).report) || asObject(facility);
    if (report && Array.isArray((report as any).zones)) {
      pushTask(tasks, {
        label: "Facility Review",
        agentFolder: "Facility Review",
        fileName: "Facility Review",
        overwritePrefix: "Facility Review",
        buildHtml: () => buildFacilityReviewReportHtml(report as any),
      });
    }
  }

  const ws1 = latestRun(client, AGENT_RUN_KEYS.ws1Assessment) || asObject(ss.assessmentReport_ws1) || asObject(ss.ws1Assessment);
  if (ws1) {
    const report = asObject((ws1 as any).report) || asObject(ws1);
    if (report) {
      pushTask(tasks, {
        label: "WS1 Assessment",
        agentFolder: "WS1 Assessment",
        fileName: `${clientName} - WS1 Internal Assessment`,
        overwritePrefix: "WS1 Internal Assessment",
        buildHtml: () => buildAssessmentReportHtml(report as any),
      });
    }
  }

  const ws2 = latestRun(client, AGENT_RUN_KEYS.ws2Assessment) || asObject(ss.assessmentReport_ws2) || asObject(ss.ws2Assessment);
  if (ws2) {
    const report = asObject((ws2 as any).report) || asObject(ws2);
    if (report) {
      pushTask(tasks, {
        label: "WS2 Assessment",
        agentFolder: "WS2 Assessment",
        fileName: `${clientName} - WS2 Internal Assessment`,
        overwritePrefix: "WS2 Internal Assessment",
        buildHtml: () => buildAssessmentReportHtml(report as any),
      });
    }
  }

  const orgChart = latestRun(client, AGENT_RUN_KEYS.orgChartReview) || asObject(ss.orgChartReview) || asObject(ss.orgChart);
  if (orgChart) {
    const report = asObject((orgChart as any).report) || asObject(orgChart);
    if (report && Array.isArray((report as any).roles)) {
      pushTask(tasks, {
        label: "Org Chart Review",
        agentFolder: "Org Chart Review",
        fileName: "Org Chart Review",
        overwritePrefix: "Org Chart Review",
        buildHtml: () => buildOrgChartReportHtml(report as any, clientName),
      });
    }
  }

  const sales = latestRun(client, AGENT_RUN_KEYS.salesProcessReview) || asObject(ss.salesProcessReview);
  if (sales) {
    const report = asObject((sales as any).report) || asObject(sales);
    if (report) {
      pushTask(tasks, {
        label: "Sales Process Review",
        agentFolder: "Sales Process Review",
        fileName: "Sales Process Review",
        overwritePrefix: "Sales Process Review",
        buildHtml: () => buildSalesReviewReportHtml(report as any, clientName),
      });
    }
  }

  const pricingVertical = latestRun(client, AGENT_RUN_KEYS.pricingVertical) || asObject(ss.pricingVertical);
  if (pricingVertical) {
    const report = asObject((pricingVertical as any).report) || asObject(pricingVertical);
    if (report) {
      pushTask(tasks, {
        label: "Pricing by Vertical",
        agentFolder: "Pricing by Vertical",
        fileName: "Pricing by Vertical",
        overwritePrefix: "Pricing by Vertical",
        buildHtml: () => buildPricingVerticalReportHtml(report as any, clientName),
      });
    }
  }

  const roadmap =
    latestRun(client, AGENT_RUN_KEYS.salesReadinessRoadmap) || asObject(ss.improvementRoadmap);
  if (roadmap) {
    const report = asObject((roadmap as any).report) || asObject(roadmap);
    if (report) {
      pushTask(tasks, {
        label: "Sales Readiness Roadmap",
        agentFolder: "Improvement Roadmap",
        fileName: `${clientName} - Sales Readiness Roadmap`,
        overwritePrefix: "Sales Readiness Roadmap",
        buildHtml: () => buildImprovementRoadmapHtml(report as any),
      });
    }
  }

  // Buyer reports may be stored per workstream
  for (const key of ["buyerReport", "buyerReport_ws1", "buyerReport_ws2"] as const) {
    const fromSs = asObject(ss[key]);
    const fromRun = key === "buyerReport" ? latestRun(client, AGENT_RUN_KEYS.buyerReport) : null;
    const source = fromRun || fromSs;
    if (!source) continue;
    const report = asObject((source as any).report) || asObject(source);
    if (!report) continue;
    const suffix = key === "buyerReport_ws2" ? "WS2" : key === "buyerReport_ws1" ? "WS1" : "Buyer";
    pushTask(tasks, {
      label: `Buyer Report (${suffix})`,
      agentFolder: "Buyer Report",
      fileName: `${clientName} - ${suffix} Buyer Report`,
      overwritePrefix: `${suffix} Buyer Report`,
      buildHtml: () => buildBuyerReportHtml(report as any),
    });
  }

  const ownerGm = latestRun(client, AGENT_RUN_KEYS.ownerGmAssessment) || asObject(ss.ownerGmAssessment);
  if (ownerGm) {
    const report = asObject((ownerGm as any).report) || asObject(ownerGm);
    if (report) {
      pushTask(tasks, {
        label: "Owner & GM Assessment",
        agentFolder: "Owner & GM Assessment",
        fileName: "Owner & GM Assessment",
        overwritePrefix: "Owner & GM Assessment",
        buildHtml: () => buildOwnerGmReportHtml(report as any, clientName),
      });
    }
  }

  // CIM / Teaser from AgentAnalysisRun if dedicated tables empty
  if (!cim?.data) {
    const cimRun = latestRun(client, AGENT_RUN_KEYS.cim);
    const data = asObject(cimRun?.report);
    if (data) {
      const storedHtml = typeof data.generatedHtml === "string" ? data.generatedHtml : null;
      pushTask(tasks, {
        label: "CIM",
        agentFolder: "CIM",
        fileName: "CIM",
        overwritePrefix: "CIM",
        buildHtml: () => storedHtml || (data.contactName ? generateCimHtml(data as any) : null),
      });
    }
  }
  if (!teaser?.data) {
    const teaserRun = latestRun(client, AGENT_RUN_KEYS.teaser);
    const data = asObject(teaserRun?.report);
    if (data) {
      const storedHtml = typeof data.generatedHtml === "string" ? data.generatedHtml : null;
      pushTask(tasks, {
        label: "Teaser",
        agentFolder: "Teaser",
        fileName: "Teaser",
        overwritePrefix: "Teaser",
        buildHtml: () => storedHtml || generateTeaserHtml(data as any),
      });
    }
  }

  // ── sectionSubmissions-only agents ───────────────────────────────────────
  const advisors = ss.professionalAdvisors;
  if (Array.isArray(advisors) && advisors.length > 0) {
    pushTask(tasks, {
      label: "Professional Advisors",
      agentFolder: "Professional Advisors",
      fileName: "Professional Advisors",
      overwritePrefix: "Professional Advisors",
      buildHtml: () => buildAdvisorsReportHtml(advisors as any, clientName),
    });
  }

  const vendors = ss.vendorDirectory;
  if (Array.isArray(vendors) && vendors.length > 0) {
    pushTask(tasks, {
      label: "Vendor Directory",
      agentFolder: "Vendor Directory",
      fileName: "Vendor Directory",
      overwritePrefix: "Vendor Directory",
      buildHtml: () => buildVendorReportHtml(vendors as any, clientName),
    });
  }

  // Fallback: any AgentAnalysisRun with markdown we didn't map above
  const handledKeys = new Set<string>(Object.values(AGENT_RUN_KEYS));
  for (const run of latestBy(client.AgentAnalysisRuns ?? [], (r: any) => r.agentKey) as any[]) {
    if (handledKeys.has(run.agentKey)) continue;
    if (!run.markdown) continue;
    const folder = String(run.agentKey || "Other Reports")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase());
    pushTask(tasks, {
      label: `Agent Run: ${run.agentKey}`,
      agentFolder: folder,
      fileName: run.fileName || run.agentKey,
      overwritePrefix: String(run.fileName || run.agentKey).slice(0, 80),
      buildHtml: () => markdownHtml(String(run.fileName || run.agentKey), clientName, run.markdown, run.updatedAt),
    });
  }

  return tasks;
}
