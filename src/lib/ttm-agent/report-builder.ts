import { DataQualityReport, DataQualitySection, FlagSeverity, SectionReportItem } from "@/lib/ttm-agent/types";

const SECTION_TITLES: Record<DataQualitySection, string> = {
  A: "Section A - GL Classification Requests",
  B: "Section B - QB vs. Excel Discrepancies",
  C: "Section C - Accountant Statement vs. Monthly P&L Discrepancies",
  D: "Section D - Period & Coverage Issues",
  E: "Section E - Working Capital Flags",
};

export function buildDataQualityReport(sectionItems: Record<DataQualitySection, SectionReportItem[]>) {
  const generatedAt = new Date().toISOString();
  const counts = {
    A: sectionItems.A.length,
    B: sectionItems.B.length,
    C: sectionItems.C.length,
    D: sectionItems.D.length,
    E: sectionItems.E.length,
  };

  const report: DataQualityReport = {
    generatedAt,
    sectionOrder: ["A", "B", "C", "D", "E"],
    counts,
    sections: {
      A: {
        title: SECTION_TITLES.A,
        status: sectionItems.A.length ? "issues" : "clear",
        items: sectionItems.A,
      },
      B: {
        title: SECTION_TITLES.B,
        status: "skipped",
        note: "Skipped - QuickBooks not connected",
        items: sectionItems.B,
      },
      C: {
        title: SECTION_TITLES.C,
        status: sectionItems.C.length ? "issues" : "clear",
        items: sectionItems.C,
      },
      D: {
        title: SECTION_TITLES.D,
        status: sectionItems.D.length ? "issues" : "clear",
        items: sectionItems.D,
      },
      E: {
        title: SECTION_TITLES.E,
        status: sectionItems.E.length ? "issues" : "clear",
        items: sectionItems.E,
      },
    },
  };

  return report;
}

export function flattenFlagsForPersistence(sectionItems: Record<DataQualitySection, SectionReportItem[]>) {
  return (Object.keys(sectionItems) as DataQualitySection[]).flatMap((section) =>
    sectionItems[section].map((item) => ({
      section,
      severity: item.severity,
      title: item.title,
      description: item.description,
      payload: item.payload,
    })),
  ) as Array<{
    section: DataQualitySection;
    severity: FlagSeverity;
    title: string;
    description: string;
    payload: Record<string, unknown>;
  }>;
}
