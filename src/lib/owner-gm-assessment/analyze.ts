import type { OwnerGmAssessment } from "./types";
import { createAgentMessage, type AgentMessageBlock } from "@/lib/llm-completion";
import { extractTranscriptText } from "@/lib/sales-review/analyze";

const SYSTEM_PROMPT = `You are the Owner & GM Involvement Assessment Agent for Cantara, a business sale-readiness and M&A diligence platform.

You will receive a call transcript from a discovery or diligence call with a business owner. Your job is to analyze the transcript against a structured 40-question framework and extract every data point you can find.

## 40-Question Framework

### Section 1 — Owner Involvement

#### 1A | Roles & Structure
1. How many owners are involved in the business? (AI Signal: Identifies ownership complexity. Multiple owners = higher transition risk)
2. What is each owner's title and role? (Maps ownership structure. Flags whether multiple owners have active operational roles)
3. Walk me through a typical week — what are you actually doing day to day? (Open narrative reveals true dependency. AI flags operational vs. strategic involvement)
4. How many hours per week working in the business? (Quantifies owner involvement. High hours = high dependency risk)
5. Of those hours, how many require you specifically — things only you can do/approve? (Identifies non-delegatable functions. Critical for dependency rating)

#### 1B | Post-Close Intentions
6. After the business sells, do you want to stay involved? (Yes/No anchor. Determines transition framing)
7. If yes — what role post-close? (Distinguishes value-add advisory from operational dependency)
8. How long would you remain in that role? (Flags clean exit vs extended engagement)
9. Is continued involvement a requirement to move forward with a sale? (Hard flag. Required stay-on significantly limits buyer pool)
10. Are there decisions/relationships a buyer couldn't step into without you? (Uncovers hidden dependency. Rate severity of transition risk)

#### 1C | Role Replacement
11. When you step back, what roles will a buyer need to fill? (Maps gap between owner exit and operational continuity)
12. What level of experience would that person need? (Calibrates replacement difficulty)
13. How many hours/week would that role require? (Quantifies replacement cost for buyer pro forma)
14. Is there anyone internally who could grow into that role? (Identifies succession bench strength)
15. If external hire required, what annual cost? (Normalization input for valuation)

### Section 2 — General Manager

#### 2A | Role & Tenure
16. Is there a GM currently in place? (No GM = immediate red flag)
17. Full or part time? (Part-time GM = elevated dependency risk)
18. How long with the company total? (Tenure = loyalty signal)
19. How long in the GM role specifically? (Under 1 year = elevated transition risk)
20. Hourly or salaried? (Role formalization indicator)
21. Current compensation? (Buyer modeling data)
22. In line with market rate? (Under-market = retention risk; over-market = normalization issue)
23. Content with compensation? (Comp-driven flight risk)
24. What does the GM own day to day — decisions without involving you? (Distinguishes true GM from supervisor in title only)

#### 2B | Performance & Capability
25. GM's greatest strengths? (AI tags operational vs. people vs. financial strengths)
26. GM's gaps or development areas? (Flags gaps in financial management, leadership, client relations)
27. On 1-10, confidence GM could run business independently today? (Below 7 = significant risk)
28. Has GM ever run business alone for extended period? (Tests real-world independence)
29. How did it go? (Validates real-world vs perceived capability)

#### 2C | Sale Awareness & Retention
30. Does GM know you're considering selling? (Awareness flag)
31. Had conversation about GM's future post-sale? (No conversation = risk)
32. Is GM supportive of selling? (Unsupportive = elevated flight risk)
33. GM hesitations about sale? (Identifies specific retention concerns)
34. How committed is GM to staying post-sale? (Calibrate against tenure and awareness)
35. Willing to involve GM in transition process? (Yes = stronger buyer confidence)

### Section 3 — Senior Management Bench
36. Other people in senior/lead roles? (Baseline bench assessment)
37. Each person's title and tenure? (AI rates bench strength: Strong/Moderate/Thin)
38. What is each responsible for? (Flags gaps in functional coverage)
39. Salary or hourly? (Commitment indicator)
40. If GM left, could anyone step up? (True bench depth test)

## Rating Criteria

### Owner Dependency Rating
- **High**: Owner works 40+ hrs/week, many critical-only hours, no internal successor, stay is required for sale
- **Medium**: Owner works 20-40 hrs/week, some delegatable functions, partial succession plan
- **Low**: Owner primarily strategic, strong delegation, clear succession path

### GM Retention Risk
- **High**: GM unaware of sale, no retention conversation, unsupportive, independence score <7, under-market comp
- **Medium**: GM aware but uncommitted, some hesitations, moderate independence
- **Low**: GM aware, supportive, committed to staying, strong independence, fair comp

### Bench Strength
- **Strong**: 3+ senior roles filled, clear functional coverage, someone could step up for GM
- **Moderate**: 1-2 senior roles, partial coverage, limited step-up capability
- **Thin**: No senior team beyond GM, single points of failure

### Overall Transition Readiness
- **High**: Low owner dependency + Low GM retention risk + Strong bench
- **Medium**: Mixed ratings across categories
- **Low**: High owner dependency OR High GM retention risk OR Thin bench

## Flags to Generate
- **deal-risk**: Owner required to stay, no GM in place, GM unaware of sale, independence score <7, thin bench with no step-up
- **negotiation**: Above-market comp (normalization), required transition period, external hire costs
- **positive**: Strong GM independence, supportive GM, strong bench, clean owner exit
- **informational**: Part-time GM, multiple owners, comp details for modeling

## Output Format
Return ONLY valid JSON matching this exact structure (no markdown, no code fences, no commentary before or after the JSON):
{
  "generatedAt": "<ISO timestamp>",
  "ownerDependencyRating": "High" | "Medium" | "Low",
  "gmRetentionRisk": "High" | "Medium" | "Low",
  "benchStrength": "Strong" | "Moderate" | "Thin",
  "overallTransitionReadiness": "High" | "Medium" | "Low",
  "executiveSummary": "<3-5 sentence summary of key findings>",
  "owners": [
    {
      "name": "<string>",
      "title": "<string>",
      "role": "<string>",
      "hoursPerWeek": <number|null>,
      "criticalHoursPerWeek": <number|null>,
      "postCloseIntention": "stay" | "exit" | "undecided" | null,
      "postCloseRole": "<string>",
      "postCloseDuration": "<string>",
      "stayRequired": <boolean|null>,
      "criticalRelationships": ["<string>"],
      "replacementRoles": ["<string>"],
      "replacementExperience": "<string>",
      "replacementHours": <number|null>,
      "internalSuccessor": "<string>",
      "externalHireCost": "<string>",
      "dependencyRating": "High" | "Medium" | "Low",
      "dependencyNotes": "<string>"
    }
  ],
  "gm": {
    "inPlace": <boolean>,
    "name": "<string>",
    "fullOrPartTime": "Full-Time" | "Part-Time" | null,
    "totalTenure": "<string>",
    "gmTenure": "<string>",
    "hourlyOrSalaried": "Hourly" | "Salaried" | null,
    "compensation": "<string>",
    "marketAligned": "Above" | "At Market" | "Below" | "Unknown",
    "contentWithComp": <boolean|null>,
    "dayToDayOwnership": "<string>",
    "strengths": ["<string>"],
    "gaps": ["<string>"],
    "independenceScore": <number 1-10 | null>,
    "soloExperience": "<string>",
    "soloOutcome": "<string>",
    "awareOfSale": <boolean|null>,
    "retentionConversation": <boolean|null>,
    "supportive": <boolean|null>,
    "hesitations": ["<string>"],
    "retentionCommitment": "High" | "Medium" | "Low" | "Unknown",
    "willingToInvolveInTransition": <boolean|null>,
    "retentionRiskRating": "High" | "Medium" | "Low",
    "retentionNotes": "<string>"
  },
  "seniorTeam": [
    {
      "name": "<string>",
      "title": "<string>",
      "tenure": "<string>",
      "responsibilities": "<string>",
      "hourlyOrSalaried": "Hourly" | "Salaried" | null,
      "couldStepUp": <boolean|null>
    }
  ],
  "flags": [
    {
      "id": "<unique-id>",
      "section": "Owner" | "GM" | "Bench" | "General",
      "severity": "deal-risk" | "negotiation" | "positive" | "informational",
      "title": "<short title>",
      "description": "<1-2 sentence detail>"
    }
  ],
  "recommendations": ["<string>"],
  "counselItems": ["<string>"]
}

Rules:
- Base ALL answers strictly on what is stated or clearly implied in the transcript.
- Use null or empty strings when information is not available in the transcript.
- Do NOT fabricate or assume data not present in the transcript.
- The executiveSummary should be commercially useful for an M&A advisor.
- Generate flags proactively — every deal-risk or positive signal should be flagged.
- Recommendations should be actionable next steps for the advisory team.
- counselItems are talking points to raise with the owner in follow-up conversations.`;

const MAX_TRANSCRIPT_CHARS = 240_000;

function isPdf(mediaType: string, fileName: string) {
  return mediaType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
}

function isDocx(mediaType: string, fileName: string) {
  const lower = fileName.toLowerCase();
  return (
    mediaType.includes("wordprocessingml")
    || mediaType === "application/msword"
    || lower.endsWith(".docx")
    || lower.endsWith(".doc")
  );
}

function isPlainText(mediaType: string, fileName: string) {
  const lower = fileName.toLowerCase();
  return mediaType.startsWith("text/") || lower.endsWith(".txt") || lower.endsWith(".md");
}

function stripJsonFence(text: string) {
  const t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t);
  if (fence) return fence[1].trim();
  return t;
}

function parseAssessmentJson(rawText: string): OwnerGmAssessment {
  const cleaned = stripJsonFence(rawText);
  try {
    return JSON.parse(cleaned) as OwnerGmAssessment;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as OwnerGmAssessment;
      } catch {
        /* fall through */
      }
    }
  }
  throw new Error(
    "The model did not return a valid Owner & GM assessment. Try a clearer transcript file (TXT, DOCX, or text-based PDF).",
  );
}

export async function analyzeOwnerGmTranscript(args: {
  fileName: string;
  base64: string;
  mediaType: string;
}): Promise<OwnerGmAssessment> {
  const buffer = Buffer.from(args.base64, "base64");
  const mediaType = args.mediaType || "application/octet-stream";
  const fileName = args.fileName || "transcript";
  const contentBlocks: AgentMessageBlock[] = [];

  if (mediaType.startsWith("image/")) {
    contentBlocks.push({
      type: "image",
      source: {
        media_type: mediaType,
        data: args.base64,
      },
    });
    contentBlocks.push({
      type: "text",
      text: `Analyze this call transcript image against the 40-question Owner & GM Involvement framework. Extract every data point available and produce the full assessment JSON.\n\nFile name: ${fileName}`,
    });
  } else {
    let transcriptText = "";
    try {
      if (isPdf(mediaType, fileName) || isDocx(mediaType, fileName) || isPlainText(mediaType, fileName)) {
        transcriptText = (await extractTranscriptText(buffer, mediaType, fileName)).trim();
      } else {
        transcriptText = buffer.toString("utf-8").trim();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to read transcript file";
      throw new Error(`Could not read transcript from ${fileName}. ${message}`);
    }

    // Scanned PDFs often have no extractable text — still attach the PDF for Claude/Bedrock.
    if (!transcriptText && isPdf(mediaType, fileName)) {
      contentBlocks.push({
        type: "document",
        title: fileName,
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: args.base64,
        },
      });
      contentBlocks.push({
        type: "text",
        text: `The attached PDF may be scanned. Read the call transcript from the document and analyze it against the 40-question Owner & GM Involvement framework. Return ONLY the assessment JSON.\n\nFile name: ${fileName}`,
      });
    } else if (!transcriptText) {
      throw new Error(
        `Could not extract readable text from ${fileName}. Upload a TXT, DOCX, or text-based PDF transcript.`,
      );
    } else {
      contentBlocks.push({
        type: "text",
        text: `[Call transcript from file: ${fileName}]\n\n${transcriptText.slice(0, MAX_TRANSCRIPT_CHARS)}`,
      });
      contentBlocks.push({
        type: "text",
        text: `Analyze this call transcript against the 40-question Owner & GM Involvement framework. Extract every data point available and produce the full assessment JSON.\n\nFile name: ${fileName}`,
      });
    }
  }

  const rawText = await createAgentMessage({
    system: SYSTEM_PROMPT,
    content: contentBlocks,
    maxTokens: 6000,
    temperature: 0,
  });

  const assessment = parseAssessmentJson(rawText);
  if (!assessment.generatedAt) {
    assessment.generatedAt = new Date().toISOString();
  }
  return assessment;
}

function parseReanalyzeJson(rawText: string): Record<string, unknown> {
  const cleaned = stripJsonFence(rawText);
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        /* fall through */
      }
    }
  }
  throw new Error("Owner & GM reanalyze returned unparseable JSON. Please retry.");
}

/**
 * Re-score narrative from advisor-edited ratings / owner profiles / GM profile / senior team
 * (no transcript re-upload). Ratings, owners[], gm, and seniorTeam[] are treated as ground truth
 * and are NOT modified — only executiveSummary, flags, recommendations, and counselItems refresh.
 */
export async function reanalyzeOwnerGmFromEdits(
  existingAssessment: OwnerGmAssessment,
): Promise<OwnerGmAssessment> {
  const authoritative = {
    ownerDependencyRating: existingAssessment.ownerDependencyRating,
    gmRetentionRisk: existingAssessment.gmRetentionRisk,
    benchStrength: existingAssessment.benchStrength,
    overallTransitionReadiness: existingAssessment.overallTransitionReadiness,
    owners: existingAssessment.owners,
    gm: existingAssessment.gm,
    seniorTeam: existingAssessment.seniorTeam,
  };

  const prompt = `You are the Owner & GM Involvement Assessment Agent for Cantara, a business sale-readiness and M&A diligence platform.

An advisor manually corrected the ratings, owner profiles, GM profile, and/or senior management bench on an existing Owner & GM Involvement Assessment report. REWRITE the executive summary, flags, recommendations, and counsel items to match those corrected values. Do NOT re-run the transcript — there is no transcript in this pass.

## CRITICAL — advisor edits are ground truth
- The AUTHORITATIVE JSON below (ratings, owners, gm, seniorTeam) is final and must NOT be changed, re-derived, or contradicted.
- Base the executive summary, flags, recommendations, and counsel items STRICTLY on this authoritative data.
- If a rating reads "High" risk/dependency, the summary and flags MUST reflect that risk — do not soften it.
- If a rating reads "Low" risk/dependency or ratings improved, do not manufacture risk that isn't supported by the data.
- Do not fabricate names, titles, or facts not present in the authoritative data below.

## AUTHORITATIVE ADVISOR-EDITED DATA
${JSON.stringify(authoritative, null, 2)}

## Flags to Generate
- **deal-risk**: Owner required to stay, no GM in place, GM unaware of sale, independence score <7, thin bench with no step-up
- **negotiation**: Above-market comp (normalization), required transition period, external hire costs
- **positive**: Strong GM independence, supportive GM, strong bench, clean owner exit
- **informational**: Part-time GM, multiple owners, comp details for modeling

Return ONLY valid JSON (no markdown, no code fences, no commentary before or after) with EXACTLY these keys:
{
  "executiveSummary": "<3-5 sentence summary of key findings, commercially useful for an M&A advisor>",
  "flags": [
    {
      "id": "<unique-id>",
      "section": "Owner" | "GM" | "Bench" | "General",
      "severity": "deal-risk" | "negotiation" | "positive" | "informational",
      "title": "<short title>",
      "description": "<1-2 sentence detail>"
    }
  ],
  "recommendations": ["<actionable next step for the advisory team>"],
  "counselItems": ["<talking point to raise with the owner in follow-up conversations>"]
}`;

  const rawText = await createAgentMessage({
    system: "",
    content: prompt,
    maxTokens: 3000,
    temperature: 0,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parseReanalyzeJson(rawText);
  } catch (err) {
    console.error("[Owner & GM Assessment] Reanalyze parse failed:", rawText.slice(0, 500));
    throw err instanceof Error ? err : new Error("Owner & GM reanalyze returned unparseable JSON. Please retry.");
  }

  return {
    ...existingAssessment,
    executiveSummary:
      typeof parsed.executiveSummary === "string" && parsed.executiveSummary.trim()
        ? parsed.executiveSummary
        : existingAssessment.executiveSummary,
    flags: Array.isArray(parsed.flags)
      ? (parsed.flags as OwnerGmAssessment["flags"])
      : existingAssessment.flags,
    recommendations: Array.isArray(parsed.recommendations)
      ? (parsed.recommendations as string[])
      : existingAssessment.recommendations,
    counselItems: Array.isArray(parsed.counselItems)
      ? (parsed.counselItems as string[])
      : existingAssessment.counselItems,
    generatedAt: new Date().toISOString(),
  };
}

export function serializeOwnerGmAssessment(assessment: OwnerGmAssessment): string {
  return JSON.stringify(assessment);
}

export function parseStoredOwnerGmAssessment(raw: string | null | undefined): OwnerGmAssessment | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<OwnerGmAssessment>;
    if (typeof parsed.executiveSummary === "string" && parsed.owners) {
      return parsed as OwnerGmAssessment;
    }
  } catch {}
  return null;
}
