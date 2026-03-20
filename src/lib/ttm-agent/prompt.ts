export const TTM_AGENT_MODEL = "claude-sonnet-4-20250514";
export const TTM_AGENT_TEMPERATURE = 0;
export const TTM_AGENT_MAX_TOKENS = 8000;

export const TTM_AGENT_SYSTEM_PROMPT = `You are the TTM Financial Structuring Agent for Cantara Pet Advisors.

Your responsibilities are limited to:
- interpreting already-normalized financial data
- resolving ambiguous GL mappings to the Cantara taxonomy
- extracting accountant statement totals from PDF statements
- writing concise Craig-facing summaries and anomaly explanations

You are NOT the spreadsheet parser. Numeric calculations, thresholds, and gating decisions are handled by deterministic application code.

When asked for JSON:
- return JSON only
- do not include markdown fences
- do not include commentary before or after the JSON
- use null for any field you cannot support confidently`;

export function buildGlMappingPrompt(
  accounts: Array<{ accountName: string; accountCode: string | null; statementKind: "pl" | "bs" }>,
  allowedCodes: string[],
) {
  return `Resolve the following ambiguous GL mappings into the Cantara taxonomy.

Allowed codes: ${allowedCodes.join(", ")}

Return JSON in this shape:
{
  "mappings": [
    {
      "accountName": "string",
      "accountCode": "string|null",
      "cantaraCode": "string|null",
      "confidence": 0.0,
      "rationale": "string"
    }
  ]
}

Accounts:
${JSON.stringify(accounts, null, 2)}`;
}

export function buildAccountantPdfPrompt(fileName: string) {
  return `Extract the accountant-prepared annual financial statement totals from the attached PDF "${fileName}".

Return JSON in this exact shape:
{
  "confidence": "HIGH|MEDIUM|LOW",
  "notes": ["string"],
  "years": [
    {
      "fiscalYear": "2022",
      "revenue": 0,
      "cogs": 0,
      "grossProfit": 0,
      "opEx": 0,
      "netIncome": 0
    }
  ]
}

Rules:
- identify exactly the 3 fiscal years present when possible
- numbers must be numeric, not strings
- use null when a line is not explicitly present in the statement
- do not calculate values unless the statement makes them explicit
- do not include any text outside the JSON`;
}

export function buildSummaryPrompt(payload: Record<string, unknown>) {
  return `Create a concise Craig-facing summary of this completed TTM analysis.

Return JSON in this exact shape:
{
  "overview": "string",
  "mappingNotes": ["string"],
  "anomalyNotes": ["string"],
  "qualitySummary": "string"
}

Payload:
${JSON.stringify(payload, null, 2)}`;
}
