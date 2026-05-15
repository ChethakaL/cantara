import type { Flag, FlagReviewStatus, LeaseReport, SnapshotRow } from "./types";

/** Section 2.3 is the canonical home for the operative rent schedule in buyer-facing output. */
export function isRentFindingSection(id: string, title?: string): boolean {
  if (id === "2.3") return true;
  const t = (title ?? "").trim().toLowerCase();
  return t === "rent" || t.startsWith("rent ");
}

/** Snapshot rows that duplicate the full rent schedule table (belongs only in §2.3). */
export function isRentScheduleSnapshotRow(row: SnapshotRow): boolean {
  const field = (row.field ?? "").trim().toLowerCase();
  if (/complete rent schedule|^rent schedule$/i.test(field)) return true;

  const finding = row.finding ?? "";
  const hasRentTableHeader =
    /\|\s*lease\s*year/i.test(finding) &&
    (/\|\s*per\s*annum/i.test(finding) || /\|\s*per\s*month/i.test(finding));
  const pipeRows = finding.split("\n").filter((l) => l.trim().startsWith("|")).length;
  return hasRentTableHeader && pipeRows >= 2;
}

/** Buyer package snapshot: summary table only — no full rent schedule grid. */
export function filterSnapshotRowsForBuyerPackage(rows: SnapshotRow[]): SnapshotRow[] {
  return normalizeSummaryRows(rows).filter((row) => !isRentScheduleSnapshotRow(row));
}

/**
 * Remove markdown/HTML rent schedule tables from §2.3 narrative when we render a structured table separately.
 */
export function stripRentScheduleFromFindingContent(content: string): string {
  const lines = content.split("\n");
  const kept: string[] = [];
  let skippingTable = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|")) {
      skippingTable = true;
      continue;
    }
    if (skippingTable && trimmed === "") {
      skippingTable = false;
      continue;
    }
    if (!skippingTable) kept.push(line);
  }

  let text = kept.join("\n");
  text = text.replace(
    /\*\*Complete Rent Schedule\*\*[^\n]*\n([\s\S]*?)(?=\n\*\*[A-Za-z]|\n###|\n---|\n$)/gi,
    "",
  );
  text = text.replace(/<table[\s\S]*?<\/table>/gi, "");
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

const HIDDEN_SUMMARY_FIELDS = new Set([
  "Legal Address / Legal Description",
  "Security Deposit",
]);

const SUMMARY_FIELD_RENAMES: Record<string, string> = {
  "Property Location (common address)": "Property Location",
  "Expiration / Termination Date": "Initial Term Expiration",
  "Expiration/Termination Date": "Initial Term Expiration",
};

export function normalizeSummaryRows(rows: SnapshotRow[]): SnapshotRow[] {
  return rows
    .filter((row) => !HIDDEN_SUMMARY_FIELDS.has(row.field?.trim() ?? ""))
    .map((row) => ({
      ...row,
      field: SUMMARY_FIELD_RENAMES[row.field?.trim() ?? ""] ?? row.field?.trim() ?? "",
    }));
}

export function isVisibleFlag(flag: Flag): boolean {
  return flag.reviewStatus !== "not_applicable";
}

export function getVisibleFlags(flags: Flag[]): Flag[] {
  return flags.filter(isVisibleFlag);
}

export function setFlagReviewStatus(
  report: LeaseReport,
  tone: "red" | "orange" | "green",
  index: number,
  reviewStatus?: FlagReviewStatus,
): LeaseReport {
  return updateFlagReview(report, tone, index, { reviewStatus });
}

export function setFlagReviewNotes(
  report: LeaseReport,
  tone: "red" | "orange" | "green",
  index: number,
  reviewNotes?: string,
): LeaseReport {
  return updateFlagReview(report, tone, index, {
    reviewNotes: normalizeReviewNotes(reviewNotes),
  });
}

export function reevaluateFlagInReport(
  report: LeaseReport,
  currentTone: "red" | "orange" | "green",
  index: number,
  nextTone: "red" | "orange" | "green" | "remove",
  nextFlag: Flag,
): LeaseReport {
  const currentKey = getFlagKey(currentTone);
  const currentFlags = report[currentKey];
  const target = currentFlags[index];

  if (!target) return report;

  const remainingCurrentFlags = currentFlags.filter((_, flagIndex) => flagIndex !== index);
  const candidate: Flag = {
    ...nextFlag,
    reviewStatus: target.reviewStatus,
    reviewNotes: target.reviewNotes,
    reevaluatedAt: nextFlag.reevaluatedAt ?? new Date().toISOString(),
    reevaluatedFromTone: currentTone,
    reevaluationReasoning: nextFlag.reevaluationReasoning,
  };

  const nextReport: LeaseReport = {
    ...report,
    [currentKey]: remainingCurrentFlags,
  };

  if (nextTone === "remove") {
    return updateReportPart3(nextReport);
  }

  const destinationKey = getFlagKey(nextTone);
  return updateReportPart3({
    ...nextReport,
    [destinationKey]: [...nextReport[destinationKey], candidate],
  });
}

function updateFlagReview(
  report: LeaseReport,
  tone: "red" | "orange" | "green",
  index: number,
  updates: Partial<Pick<Flag, "reviewStatus" | "reviewNotes">>,
): LeaseReport {
  const flagKey = getFlagKey(tone);
  const nextFlags = report[flagKey].map((flag, flagIndex) =>
    flagIndex === index ? { ...flag, ...updates } : flag,
  );

  return updateReportPart3({
    ...report,
    [flagKey]: nextFlags,
  });
}

function getFlagKey(tone: "red" | "orange" | "green") {
  if (tone === "red") return "redFlags" as const;
  if (tone === "orange") return "orangeFlags" as const;
  return "greenFlags" as const;
}

function normalizeReviewNotes(reviewNotes?: string) {
  const trimmed = reviewNotes?.trim();
  return trimmed ? trimmed : undefined;
}

function renderFlagSection(flags: Flag[]) {
  const visibleFlags = getVisibleFlags(flags);
  if (!visibleFlags.length) {
    return "_None._";
  }

  return visibleFlags
    .map((flag) =>
      [
        `**Issue:** ${flag.issue}`,
        `**Why It Matters:** ${flag.whyItMatters}`,
        `**Source & Quote:** ${flag.sourceSection}`,
      ].join("\n"),
    )
    .join("\n\n");
}

function buildPart3Markdown(report: LeaseReport) {
  return [
    "## PART 3 — FLAG ANALYSIS",
    "",
    "### 🔴 RED FLAGS — Significant Issues Requiring Immediate Attention",
    "",
    renderFlagSection(report.redFlags),
    "",
    "### 🟡 ORANGE FLAGS — Items Requiring Clarification or Negotiation",
    "",
    renderFlagSection(report.orangeFlags),
    "",
    "### 🟢 GREEN FLAGS — Tenant-Favorable Provisions",
    "",
    renderFlagSection(report.greenFlags),
  ].join("\n");
}

function updateReportPart3(report: LeaseReport): LeaseReport {
  const start = "---START_PART3---";
  const end = "---END_PART3---";
  const sectionBody = buildPart3Markdown(report);
  const nextRaw =
    report.raw.includes(start) && report.raw.includes(end)
      ? report.raw.replace(
          new RegExp(`${escapeRegex(start)}[\\s\\S]*?${escapeRegex(end)}`),
          `${start}\n${sectionBody}\n${end}`,
        )
      : report.raw;

  return {
    ...report,
    raw: nextRaw,
  };
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
