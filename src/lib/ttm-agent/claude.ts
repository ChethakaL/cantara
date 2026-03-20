import Anthropic from "@anthropic-ai/sdk";
import {
  buildAccountantPdfPrompt,
  buildGlMappingPrompt,
  buildSummaryPrompt,
  TTM_AGENT_MAX_TOKENS,
  TTM_AGENT_MODEL,
  TTM_AGENT_SYSTEM_PROMPT,
  TTM_AGENT_TEMPERATURE,
} from "@/lib/ttm-agent/prompt";
import { ParsedAccountantStatements, TtmAgentSummary } from "@/lib/ttm-agent/types";

type MappingSuggestion = {
  accountName: string;
  accountCode: string | null;
  cantaraCode: string | null;
  confidence: number;
  rationale: string;
};

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

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
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
  console.log(rawText);
  console.log(`[TTM Claude] ${label} response end`);
}

export async function suggestCantaraMappings(
  accounts: Array<{ accountName: string; accountCode: string | null; statementKind: "pl" | "bs" }>,
  allowedCodes: string[],
) {
  if (!accounts.length) return [] as MappingSuggestion[];

  const client = getClient();
  if (!client) return [] as MappingSuggestion[];

  try {
    const result = await withAnthropicRetry("TTM GL mapping suggestion", () =>
      client.messages.create({
        model: TTM_AGENT_MODEL,
        max_tokens: TTM_AGENT_MAX_TOKENS,
        temperature: TTM_AGENT_TEMPERATURE,
        system: TTM_AGENT_SYSTEM_PROMPT,
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
  const client = getClient();
  if (!client) {
    throw new Error("ANTHROPIC_API_KEY is required to parse accountant statement PDFs.");
  }

  const result = await withAnthropicRetry("TTM accountant PDF extraction", () =>
    client.messages.create({
      model: TTM_AGENT_MODEL,
      max_tokens: TTM_AGENT_MAX_TOKENS,
      temperature: TTM_AGENT_TEMPERATURE,
      system: TTM_AGENT_SYSTEM_PROMPT,
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
  const client = getClient();
  if (!client) {
    return {
      overview: "TTM analysis completed. Review the structured model and Data Quality Report for details.",
      mappingNotes: [],
      anomalyNotes: [],
      qualitySummary: "Claude summary unavailable because ANTHROPIC_API_KEY is not configured.",
    } satisfies TtmAgentSummary;
  }

  try {
    const result = await withAnthropicRetry("TTM summary generation", () =>
      client.messages.create({
        model: TTM_AGENT_MODEL,
        max_tokens: TTM_AGENT_MAX_TOKENS,
        temperature: TTM_AGENT_TEMPERATURE,
        system: TTM_AGENT_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: buildSummaryPrompt(payload) }],
          },
        ],
      }),
    );

    logClaudeResponse("Summary", result);
    return parseJson<TtmAgentSummary>(extractText(result));
  } catch (error) {
    console.warn("Claude summary generation unavailable. Falling back to deterministic summary copy.", error);
    return {
      overview: "TTM analysis completed. Review the structured model, working capital section, and Data Quality Report for details.",
      mappingNotes: [],
      anomalyNotes: [],
      qualitySummary: "Automated summary is temporarily unavailable because the Claude service could not be reached.",
    } satisfies TtmAgentSummary;
  }
}
