import type { AgentAiProvider } from "@/lib/agent-model-provider";
import { requireAIClient, resolveModel } from "@/lib/ai-client";
import { getActiveAgentModelId, getActiveAgentProvider } from "@/lib/agent-llm-context";
import { createAgentMessage } from "@/lib/llm-completion";
import { InsuranceReviewResult, parseStoredInsuranceReview, serializeInsuranceReview } from "@/lib/insurance-review-shared";

export { parseStoredInsuranceReview, serializeInsuranceReview };

const INSURANCE_PROMPT = `You are the Insurance Review Agent for a business sale-readiness and M&A diligence portal.

Review the provided business insurance documents (which may include active business insurance policies and/or insurance claims from the last 12-24 months) and return ONLY valid JSON with this exact structure:
{
  "summary": "<2-4 sentence plain-English summary of insurance coverage, policy types, and any claim history>",
  "claimType": "<fire|water|theft|liability|workers_comp|property_damage|business_interruption|general_policy|other|none|unknown>",
  "incidentDate": "<ISO date YYYY-MM-DD or None or Unknown>",
  "withinLast12Months": <true|false|null>,
  "incidentCause": "<short phrase or None or Unknown>",
  "amountClaimed": "<currency amount or None or Unknown>",
  "amountRequested": "<currency amount or None or Unknown>",
  "status": "<denied|in_process|paid_in_part|paid_in_full|pending|active_no_claims|unknown>",
  "keyFacts": ["<fact 1>", "<fact 2>", "<fact 3>"]
}

For 'status':
- If insurance claim documents are present: 'denied' if the claim was rejected, 'in_process' if still being reviewed/processed, 'paid_in_part' if partially paid/settled, 'paid_in_full' if fully paid/settled, 'pending' if submitted but no decision yet.
- If only active insurance policies are present and no claims are noted: 'active_no_claims' (or 'unknown' if status is unclear).

Rules:
- Base the answer strictly on the provided insurance documents.
- The summary must be commercially useful for an advisor evaluating business insurance adequacy and liability risk.
- If policies are provided, identify coverage lines (e.g. General Liability, Commercial Property, Workers' Comp, Professional Liability), carrier names, policy limits, deductibles, and expiration dates.
- If claim documents are provided, state what happened, when it happened, amounts requested/claimed, and the resolution status.
- Determine whether any claim falls within the last 12 months relative to today. If older than 12 months, set "withinLast12Months" to false. If within 12 months, set "withinLast12Months" to true. If no claims are present, set to null.
- If the documents comment on premises inspection, business/shop condition, trading status, operational standing, or surveyor findings, include those explicitly in keyFacts.
- keyFacts should capture the most decision-useful facts: policy carriers, limits, deductibles, expiration dates, claim details (if any), and inspection findings.
- Use "None" or "Unknown" when a field is not stated or not applicable.`;

export interface InsuranceDocumentInput {
  fileName: string;
  base64: string;
  documentType?: 'insurance_policies' | 'insurance_claims_12m' | string;
}

export async function summarizeInsuranceDocuments(args: {
  files: InsuranceDocumentInput[];
  provider?: AgentAiProvider;
  modelId?: string;
}) {
  const provider = args.provider ?? getActiveAgentProvider();
  const modelId = args.modelId ?? getActiveAgentModelId();
  const fileList = args.files
    .map(
      (f, i) =>
        `${i + 1}. ${f.fileName} (${f.documentType === 'insurance_policies' ? 'Active Insurance Policy' : 'Insurance Claim'})`,
    )
    .join('\n');
  const userPrompt = `${INSURANCE_PROMPT}\n\nProvided Documents:\n${fileList}`;

  let rawText: string;
  if (provider === 'openai') {
    const contentBlocks: any[] = args.files.map((file) => ({
      type: 'document',
      title: file.fileName,
      source: { type: 'base64', media_type: 'application/pdf', data: file.base64 },
    }));
    contentBlocks.push({ type: 'text', text: userPrompt });

    rawText = await createAgentMessage({
      provider,
      model: modelId,
      system: '',
      content: contentBlocks,
      maxTokens: 1500,
      temperature: 0,
    });
  } else {
    const client = await requireAIClient();
    const contentBlocks: any[] = args.files.map((file) => ({
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: file.base64,
      },
    }));
    contentBlocks.push({ type: 'text', text: userPrompt });

    const response = await client.messages.create({
      model: resolveModel('claude-opus-4-5'),
      max_tokens: 1500,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: contentBlocks,
        },
      ],
    });
    rawText = response.content
      .filter((block) => block.type === 'text')
      .map((block) => ('text' in block ? block.text : ''))
      .join('')
      .trim();
  }

  const cleaned = rawText.replace(/^```json\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  return JSON.parse(cleaned) as InsuranceReviewResult;
}

export async function summarizeInsuranceClaimPdf(args: {
  fileName: string;
  base64: string;
  provider?: AgentAiProvider;
  modelId?: string;
}) {
  return summarizeInsuranceDocuments({
    files: [{ fileName: args.fileName, base64: args.base64, documentType: 'insurance_claims_12m' }],
    provider: args.provider,
    modelId: args.modelId,
  });
}
