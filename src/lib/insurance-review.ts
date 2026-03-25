import Anthropic from "@anthropic-ai/sdk";

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

function extractText(result: Anthropic.Messages.Message) {
  return result.content
    .filter((block) => block.type === "text")
    .map((block) => ("text" in block ? block.text : ""))
    .join("")
    .trim();
}

export async function summarizeInsuranceClaimPdf(args: {
  fileName: string;
  base64: string;
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is required to summarize insurance claim documents.");
  }

  const client = new Anthropic({ apiKey });
  const prompt = `You are the Insurance Review Agent for a business sale-readiness and M&A diligence portal.

Review the uploaded insurance claim PDF and return ONLY valid JSON with this exact structure:
{
  "summary": "<2-4 sentence plain-English summary>",
  "claimType": "<fire|water|theft|liability|workers_comp|property_damage|business_interruption|other|unknown>",
  "incidentDate": "<ISO date YYYY-MM-DD or Unknown>",
  "withinLast12Months": <true|false|null>,
  "incidentCause": "<short phrase or Unknown>",
  "amountClaimed": "<currency amount or Unknown>",
  "amountRequested": "<currency amount or Unknown>",
  "status": "<submitted|approved|partially_approved|denied|paid|pending|unknown>",
  "keyFacts": ["<fact 1>", "<fact 2>", "<fact 3>"]
}

Rules:
- Base the answer only on the provided PDF.
- The summary must be commercially useful for an advisor.
- If the document supports it, say what happened, when it happened, and how much was requested or claimed.
- If the PDF comments on business/shop condition, trading status, operational status, premises inspection outcome, or whether the premises are in good standing, include that in the summary and include it explicitly in keyFacts.
- If the PDF mentions assessor observations, surveyor findings, inspection remarks, or business continuity details, make sure those are captured in keyFacts and do not omit them.
- Determine whether the claim falls within the last 12 months relative to today. If it is older than 12 months, set "withinLast12Months" to false.
- Example style: "Insurance claim appears related to a fire loss. The insured requested approximately $42,000 for property damage and business interruption. Claim status appears pending based on the provided notice."
- Do not generate extra warnings, issues, or flags except the 12-month timing outcome reflected by "withinLast12Months".
- keyFacts should capture the most decision-useful facts from the document, not generic restatements. Prioritize incident details, claim outcome, amount, business operational status, and premises/shop inspection findings when present.
- Use "Unknown" when a field is not clearly stated.`;

  const response = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1200,
    temperature: 0,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: args.base64,
            },
          },
          {
            type: "text",
            text: `${prompt}\n\nFile name: ${args.fileName}`,
          },
        ],
      },
    ],
  });

  const rawText = extractText(response);
  const cleaned = rawText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(cleaned) as InsuranceReviewResult;
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
