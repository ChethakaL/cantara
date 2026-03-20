import type { Flag, FlagReviewStatus, LeaseReport, SnapshotRow } from "./types";

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
  const flagKey = getFlagKey(tone);
  const nextFlags = report[flagKey].map((flag, flagIndex) =>
    flagIndex === index ? { ...flag, reviewStatus } : flag,
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
