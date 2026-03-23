import {
  getWs21SystemPrompt,
  getWs22SystemPrompt,
  getWs23SystemPrompt,
  getWs24SystemPrompt,
  getWs25SystemPrompt,
  WS2_1_MAX_TOKENS,
  WS2_2_MAX_TOKENS,
  WS2_3_MAX_TOKENS,
  WS2_4_MAX_TOKENS,
  WS2_5_MAX_TOKENS,
  WS2_AGENT_MODEL,
  WS2_AGENT_TEMPERATURE,
} from "@/lib/ws2/architecture";

export const TTM_AGENT_MODEL = WS2_AGENT_MODEL;
export const TTM_AGENT_TEMPERATURE = WS2_AGENT_TEMPERATURE;
export const TTM_AGENT_MAX_TOKENS = WS2_1_MAX_TOKENS;
export const TTM_AGENT_SYSTEM_PROMPT = getWs21SystemPrompt();

export const WS2_RECAST_MAX_TOKENS = WS2_2_MAX_TOKENS;
export const WS2_RECAST_SYSTEM_PROMPT = getWs22SystemPrompt();
export const WS2_REVENUE_VERTICAL_MAX_TOKENS = WS2_3_MAX_TOKENS;
export const WS2_REVENUE_VERTICAL_SYSTEM_PROMPT = getWs23SystemPrompt();
export const WS2_BENCHMARK_MAX_TOKENS = WS2_4_MAX_TOKENS;
export const WS2_BENCHMARK_SYSTEM_PROMPT = getWs24SystemPrompt();
export const WS2_LABOR_MAX_TOKENS = WS2_5_MAX_TOKENS;
export const WS2_LABOR_SYSTEM_PROMPT = getWs25SystemPrompt();

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
