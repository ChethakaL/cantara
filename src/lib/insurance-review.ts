import type { AgentAiProvider } from "@/lib/agent-model-provider";
import { requireAIClient, resolveModel } from "@/lib/ai-client";
import { getActiveAgentModelId, getActiveAgentProvider } from "@/lib/agent-llm-context";
import { createAgentMessage } from "@/lib/llm-completion";
import { InsuranceReviewResult, parseStoredInsuranceReview, serializeInsuranceReview } from "@/lib/insurance-review-shared";

export { parseStoredInsuranceReview, serializeInsuranceReview };

const INSURANCE_PROMPT = `You are the Insurance Review Agent for a business sale-readiness and M&A diligence portal.

Review the uploaded insurance claim PDF and return ONLY valid JSON with this exact structure:
{
  "summary": "<2-4 sentence plain-English summary>",
  "claimType": "<fire|water|theft|liability|workers_comp|property_damage|business_interruption|other|unknown>",
  "incidentDate": "<ISO date YYYY-MM-DD or Unknown>",
  "withinLast12Months": <true|false|null>,
  "incidentCause": "<short phrase or Unknown>",
  "amountClaimed": "<currency amount or Unknown>",
  "amountRequested": "<currency amount or Unknown>",
  "status": "<denied|in_process|paid_in_part|paid_in_full|pending|unknown>",
  "keyFacts": ["<fact 1>", "<fact 2>", "<fact 3>"]
}

For 'status', determine the current resolution status of the claim: 'denied' if the claim was rejected, 'in_process' if still being reviewed/processed, 'paid_in_part' if partially paid/settled, 'paid_in_full' if fully paid/settled, 'pending' if submitted but no decision yet, 'unknown' if status cannot be determined.

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

export async function summarizeInsuranceClaimPdf(args: {
  fileName: string;
  base64: string;
  provider?: AgentAiProvider;
  modelId?: string;
}) {
  const provider = args.provider ?? getActiveAgentProvider();
  const modelId = args.modelId ?? getActiveAgentModelId();
  const userPrompt = `${INSURANCE_PROMPT}\n\nFile name: ${args.fileName}`;

  let rawText: string;
  if (provider === "openai") {
    rawText = await createAgentMessage({
      provider,
      model: modelId,
      system: "",
      content: [
        {
          type: "document",
          title: args.fileName,
          source: { type: "base64", media_type: "application/pdf", data: args.base64 },
        },
        { type: "text", text: userPrompt },
      ],
      maxTokens: 1200,
      temperature: 0,
    });
  } else {
    const client = await requireAIClient();
    const response = await client.messages.create({
      model: resolveModel("claude-opus-4-5"),
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
              text: userPrompt,
            },
          ],
        },
      ],
    });
    rawText = response.content
      .filter((block) => block.type === "text")
      .map((block) => ("text" in block ? block.text : ""))
      .join("")
      .trim();
  }

  const cleaned = rawText.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  return JSON.parse(cleaned) as InsuranceReviewResult;
}
