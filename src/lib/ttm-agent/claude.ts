import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "@/lib/secure-settings"
import {
  buildAccountantPdfPrompt,
  buildGlMappingPrompt,
  TTM_AGENT_MAX_TOKENS,
  TTM_AGENT_MODEL,
  TTM_AGENT_TEMPERATURE,
  TTM_AGENT_SYSTEM_PROMPT,
  WS2_BENCHMARK_MAX_TOKENS,
  WS2_BENCHMARK_SYSTEM_PROMPT,
  WS2_LABOR_MAX_TOKENS,
  WS2_LABOR_SYSTEM_PROMPT,
  WS2_RECAST_MAX_TOKENS,
  WS2_RECAST_SYSTEM_PROMPT,
  WS2_REVENUE_VERTICAL_MAX_TOKENS,
  WS2_REVENUE_VERTICAL_SYSTEM_PROMPT,
} from "@/lib/ttm-agent/prompt";
import { ParsedAccountantStatements, TtmAgentSummary } from "@/lib/ttm-agent/types";

type MappingSuggestion = {
  accountName: string;
  accountCode: string | null;
  cantaraCode: string | null;
  confidence: number;
  rationale: string;
};

const HELPER_SYSTEM_PROMPT = `You are a precise financial data extraction helper.

When asked for JSON:
- return JSON only
- do not include markdown fences
- do not include commentary before or after the JSON
- use null for any field you cannot support confidently`;

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableAnthropicError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  const causeCode =
    typeof (error as { cause?: { code?: unknown } }).cause?.code === "string"
      ? String((error as { cause?: { code?: string } }).cause?.code)
      : "";

  return (
    message.includes("connection error") ||
    message.includes("fetch failed") ||
    causeCode === "ECONNRESET" ||
    causeCode === "ETIMEDOUT" ||
    causeCode === "ENOTFOUND"
  );
}

async function withAnthropicRetry<T>(label: string, fn: () => Promise<T>) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      const retryable = isRetryableAnthropicError(error);
      const lastAttempt = attempt === maxAttempts;

      if (!retryable || lastAttempt) {
        throw error;
      }

      console.warn(`${label} failed on attempt ${attempt}/${maxAttempts}. Retrying...`, error);
      await sleep(400 * attempt);
    }
  }

  throw new Error(`${label} failed after retries.`);
}

async function getClient() {
  const apiKey = await getAnthropicApiKey()
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

function extractText(result: Anthropic.Messages.Message) {
  return result.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

function stripCodeFences(raw: string) {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function parseJson<T>(raw: string): T {
  return JSON.parse(stripCodeFences(raw)) as T;
}

function logClaudeResponse(label: string, result: Anthropic.Messages.Message) {
  const rawText = extractText(result);
  console.log(`[TTM Claude] ${label} response start`);
  if (label === "WS2-2 report generation") {
    console.log("[suppressed raw WS2-2 draft; final saved WS2-2 result is logged by orchestrator]");
  } else {
    console.log(rawText);
  }
  console.log(`[TTM Claude] ${label} response end`);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function formatCurrency(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "n/a";
}

function formatPct(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(1)}%` : "n/a";
}

function buildDeterministicTtmSummary(payload: Record<string, unknown>): TtmAgentSummary {
  const ttmSummary = asRecord(payload.ttmSummary);
  const workingCapital = asRecord(payload.workingCapital);
  const annualTrends = Array.isArray(payload.annualTrends) ? payload.annualTrends.map(asRecord).filter(Boolean) as Record<string, unknown>[] : [];
  const qualityCounts = asRecord(payload.qualityCounts);

  const totalRevenue = asNumber(ttmSummary?.totalRevenue);
  const grossMarginPct = asNumber(ttmSummary?.grossMarginPct);
  const ebitdaPreRecast = asNumber(ttmSummary?.ebitdaPreRecast);
  const ebitdaMarginPct = asNumber(ttmSummary?.ebitdaMarginPct);
  const startMonth = typeof ttmSummary?.startMonth === "string" ? ttmSummary.startMonth : null;
  const endMonth = typeof ttmSummary?.endMonth === "string" ? ttmSummary.endMonth : null;

  const netWorkingCapital = asNumber(workingCapital?.netWorkingCapital);
  const trailingNwc = asNumber(workingCapital?.trailingThreeMonthAverageNwc);

  const ownerComp = (ttmSummary?.opExByCategory && Array.isArray(ttmSummary.opExByCategory)
    ? (ttmSummary.opExByCategory as unknown[])
        .map(asRecord)
        .filter(Boolean)
        .filter((item) => item.code === "OPX-LABOR-OWN")
        .reduce((sum, item) => sum + (asNumber(item.value) ?? 0), 0)
    : 0) || 0;

  const trend = annualTrends[annualTrends.length - 1] ?? null;
  const revenueYoY = asNumber(trend?.revenueYoYPct);
  const ebitdaYoY = asNumber(trend?.ebitdaYoYPct);
  const anomalies = asStringArray(payload.anomalies);

  const counts = {
    A: asNumber(qualityCounts?.A) ?? 0,
    B: asNumber(qualityCounts?.B) ?? 0,
    C: asNumber(qualityCounts?.C) ?? 0,
    D: asNumber(qualityCounts?.D) ?? 0,
    E: asNumber(qualityCounts?.E) ?? 0,
  };
  const totalFlags = counts.A + counts.B + counts.C + counts.D + counts.E;

  const overviewParts = [
    `TTM ${startMonth && endMonth ? `${startMonth} to ${endMonth}` : "analysis"} shows ${formatCurrency(totalRevenue)} revenue`,
    `with ${formatPct(grossMarginPct)} gross margin`,
    `and pre-recast EBITDA of ${formatCurrency(ebitdaPreRecast)} (${formatPct(ebitdaMarginPct)} margin)`,
  ];

  if (revenueYoY !== null) {
    overviewParts.push(`Revenue changed ${revenueYoY >= 0 ? "up" : "down"} ${Math.abs(revenueYoY).toFixed(1)}% YoY`);
  }

  const mappingNotes: string[] = [];
  if (ownerComp > 0) {
    mappingNotes.push(`Owner compensation is mapped to OPX-LABOR-OWN at ${formatCurrency(ownerComp)} in the TTM model.`);
  }
  if (counts.A === 0) {
    mappingNotes.push("All GL accounts were auto-mapped; Section A has no unresolved classification items.");
  }

  const anomalyNotes: string[] = [];
  if (ebitdaYoY !== null) {
    if (Math.abs(ebitdaYoY) > 500) {
      anomalyNotes.push(`EBITDA improved materially YoY from a near-breakeven or small-base prior year, so the percentage change is not decision-useful.`);
    } else {
      anomalyNotes.push(`EBITDA changed ${ebitdaYoY >= 0 ? "up" : "down"} ${Math.abs(ebitdaYoY).toFixed(1)}% YoY based on the structured annual model.`);
    }
  }
  if (netWorkingCapital !== null) {
    anomalyNotes.push(`Net working capital at the latest month-end is ${formatCurrency(netWorkingCapital)} with a 3-month average of ${formatCurrency(trailingNwc)}.`);
  }
  for (const anomaly of anomalies.slice(0, 2)) {
    anomalyNotes.push(anomaly);
  }

  const qualitySummaryParts = [
    `${totalFlags} data-quality item${totalFlags === 1 ? "" : "s"} flagged across Sections A-E.`,
    `Section counts: A=${counts.A}, B=${counts.B}, C=${counts.C}, D=${counts.D}, E=${counts.E}.`,
  ];
  if (counts.C > 0 || counts.E > 0) {
    qualitySummaryParts.push("Primary review areas are accountant-statement variances and working-capital checks.");
  }

  return {
    overview: `${overviewParts.join(" ")}.`,
    mappingNotes,
    anomalyNotes,
    qualitySummary: qualitySummaryParts.join(" "),
  };
}

export async function suggestCantaraMappings(
  accounts: Array<{ accountName: string; accountCode: string | null; statementKind: "pl" | "bs" }>,
  allowedCodes: string[],
) {
  if (!accounts.length) return [] as MappingSuggestion[];

  const client = await getClient();
  if (!client) return [] as MappingSuggestion[];

  try {
    const result = await withAnthropicRetry("TTM GL mapping suggestion", () =>
      client.messages.create({
        model: TTM_AGENT_MODEL,
        max_tokens: TTM_AGENT_MAX_TOKENS,
        temperature: TTM_AGENT_TEMPERATURE,
        system: HELPER_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: buildGlMappingPrompt(accounts, allowedCodes) }],
          },
        ],
      }),
    );

    logClaudeResponse("GL mapping", result);
    const parsed = parseJson<{ mappings: MappingSuggestion[] }>(extractText(result));
    return parsed.mappings ?? [];
  } catch (error) {
    console.warn("Claude mapping assistance unavailable. Continuing with deterministic mappings only.", error);
    return [] as MappingSuggestion[];
  }
}

export async function extractAccountantStatementsFromPdf(fileName: string, base64: string) {
  const client = await getClient();
  if (!client) {
    throw new Error("ANTHROPIC_API_KEY is required to parse accountant statement PDFs.");
  }

  const result = await withAnthropicRetry("TTM accountant PDF extraction", () =>
    client.messages.create({
      model: TTM_AGENT_MODEL,
      max_tokens: TTM_AGENT_MAX_TOKENS,
      temperature: TTM_AGENT_TEMPERATURE,
      system: HELPER_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            {
              type: "text",
              text: buildAccountantPdfPrompt(fileName),
            },
          ],
        },
      ],
    }),
  );

  logClaudeResponse("Accountant PDF extraction", result);
  return parseJson<ParsedAccountantStatements>(extractText(result));
}

export async function summarizeTtmAnalysis(payload: Record<string, unknown>) {
  return buildDeterministicTtmSummary(payload);
}

type ReportContentBlock =
  | { type: "text"; text: string }
  | {
      type: "document";
      source: {
        type: "base64";
        media_type: "application/pdf";
        data: string;
      };
    };

async function generateStructuredReport(args: {
  label: string;
  systemPrompt: string;
  maxTokens: number;
  content: ReportContentBlock[];
}) {
  const client = await getClient();
  if (!client) {
    throw new Error("ANTHROPIC_API_KEY is required to run WS2 financial agents.");
  }

  const result = await withAnthropicRetry(args.label, () =>
    client.messages.create({
      model: TTM_AGENT_MODEL,
      max_tokens: args.maxTokens,
      temperature: TTM_AGENT_TEMPERATURE,
      system: args.systemPrompt,
      messages: [
        {
          role: "user",
          content: args.content as Anthropic.Messages.MessageCreateParamsNonStreaming["messages"][number]["content"],
        },
      ],
    }),
  );

  logClaudeResponse(args.label, result);
  return extractText(result);
}

export async function generateWs21Report(content: ReportContentBlock[]) {
  return generateStructuredReport({
    label: "WS2-1 report generation",
    systemPrompt: TTM_AGENT_SYSTEM_PROMPT,
    maxTokens: TTM_AGENT_MAX_TOKENS,
    content,
  });
}

export async function generateWs22Report(content: ReportContentBlock[]) {
  return generateStructuredReport({
    label: "WS2-2 report generation",
    systemPrompt: WS2_RECAST_SYSTEM_PROMPT,
    maxTokens: WS2_RECAST_MAX_TOKENS,
    content,
  });
}

export async function generateWs23Report(content: ReportContentBlock[]) {
  return generateStructuredReport({
    label: "WS2-3 report generation",
    systemPrompt: WS2_REVENUE_VERTICAL_SYSTEM_PROMPT,
    maxTokens: WS2_REVENUE_VERTICAL_MAX_TOKENS,
    content,
  });
}

export async function generateWs24Report(content: ReportContentBlock[]) {
  return generateStructuredReport({
    label: "WS2-4 report generation",
    systemPrompt: WS2_BENCHMARK_SYSTEM_PROMPT,
    maxTokens: WS2_BENCHMARK_MAX_TOKENS,
    content,
  });
}

export async function generateWs25Report(content: ReportContentBlock[]) {
  return generateStructuredReport({
    label: "WS2-5 report generation",
    systemPrompt: WS2_LABOR_SYSTEM_PROMPT,
    maxTokens: WS2_LABOR_MAX_TOKENS,
    content,
  });
}
