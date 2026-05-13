export interface InsuranceReviewResult {
  summary: string;
  claimType: string;
  incidentDate: string;
  withinLast12Months: boolean | null;
  incidentCause: string;
  amountClaimed: string;
  amountRequested: string;
  status: string;
  keyFacts: string[];
}

export function serializeInsuranceReview(review: InsuranceReviewResult) {
  return JSON.stringify(review);
}

export function parseStoredInsuranceReview(raw: string | null | undefined): InsuranceReviewResult | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<InsuranceReviewResult>;
    if (typeof parsed.summary === "string") {
      return {
        summary: parsed.summary,
        claimType: parsed.claimType ?? "unknown",
        incidentDate: parsed.incidentDate ?? "Unknown",
        withinLast12Months: parsed.withinLast12Months ?? null,
        incidentCause: parsed.incidentCause ?? "Unknown",
        amountClaimed: parsed.amountClaimed ?? "Unknown",
        amountRequested: parsed.amountRequested ?? "Unknown",
        status: parsed.status ?? "unknown",
        keyFacts: parsed.keyFacts ?? [],
      };
    }
  } catch {}

  return {
    summary: raw,
    claimType: "unknown",
    incidentDate: "Unknown",
    withinLast12Months: null,
    incidentCause: "Unknown",
    amountClaimed: "Unknown",
    amountRequested: "Unknown",
    status: "unknown",
    keyFacts: [],
  };
}
