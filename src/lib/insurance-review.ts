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

/**
 * Re-write the plain-English summary narrative from advisor-edited claim/policy fields and key facts
 * (no document re-analysis). Claim fields and keyFacts are treated as ground truth and are frozen —
 * only the `summary` narrative is regenerated so it stays aligned with the edited facts.
 */
export async function reanalyzeInsuranceReviewFromEdits(args: {
  existingSummary: InsuranceReviewResult;
  provider?: AgentAiProvider;
  modelId?: string;
}): Promise<InsuranceReviewResult> {
  const provider = args.provider ?? getActiveAgentProvider();
  const modelId = args.modelId ?? getActiveAgentModelId();
  const ex = args.existingSummary;

  const authoritative = {
    claimType: ex.claimType,
    incidentDate: ex.incidentDate,
    withinLast12Months: ex.withinLast12Months,
    incidentCause: ex.incidentCause,
    amountClaimed: ex.amountClaimed,
    amountRequested: ex.amountRequested,
    status: ex.status,
    keyFacts: ex.keyFacts,
  };

  const prompt = `You are the Insurance Review Agent for a business sale-readiness and M&A diligence portal.

An advisor manually corrected the claim/policy fields and key facts on an existing Insurance Review summary. REWRITE only the plain-English summary narrative to align with those corrected values. Do not invent new facts beyond what is listed below.

## AUTHORITATIVE ADVISOR-EDITED DATA (ground truth — do not contradict)
${JSON.stringify(authoritative, null, 2)}

Rules:
- The summary must be commercially useful for an advisor evaluating business insurance adequacy and liability risk.
- Accurately reflect claimType, status, incidentDate/withinLast12Months, incidentCause, amountClaimed/amountRequested, and keyFacts.
- 2-4 sentences, plain English, no markdown.
- If status is "active_no_claims", make clear there are no adverse claims driving the assessment.
- If withinLast12Months is false and there IS a claim, the summary must reflect that the incident is older than 12 months.
- Use "None" or "Unknown" language consistent with fields left as such.

Return ONLY valid JSON: { "summary": "<new summary>" }`;

  let rawText: string;
  if (provider === 'openai') {
    rawText = await createAgentMessage({
      provider,
      model: modelId,
      system: '',
      content: prompt,
      maxTokens: 600,
      temperature: 0,
    });
  } else {
    const client = await requireAIClient();
    const response = await client.messages.create({
      model: resolveModel('claude-opus-4-5'),
      max_tokens: 600,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    });
    rawText = response.content
      .filter((block) => block.type === 'text')
      .map((block) => ('text' in block ? block.text : ''))
      .join('')
      .trim();
  }

  let parsed: Record<string, unknown>;
  try {
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    parsed = JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned) as Record<string, unknown>;
  } catch (err) {
    console.error('[Insurance Review] Reanalyze parse failed:', rawText.slice(0, 500));
    throw err instanceof Error ? err : new Error('Insurance reanalyze returned unparseable JSON. Please retry.');
  }

  return {
    ...ex,
    summary: typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary : ex.summary,
  };
}
