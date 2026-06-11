import Anthropic from "@anthropic-ai/sdk";
import { requireAIClient, resolveModel } from "@/lib/ai-client"
import type { OwnerGmAssessment } from "./types";

function extractText(result: Anthropic.Messages.Message) {
  return result.content
    .filter((block) => block.type === "text")
    .map((block) => ("text" in block ? block.text : ""))
    .join("")
    .trim();
}

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
Return ONLY valid JSON matching this exact structure (no markdown, no code fences):
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

export async function analyzeOwnerGmTranscript(args: {
  fileName: string;
  base64: string;
  mediaType: string;
}): Promise<OwnerGmAssessment> {
  const client = await requireAIClient();

  // Build the content block based on media type
  const contentBlocks: Anthropic.Messages.ContentBlockParam[] = [];

  if (args.mediaType === "application/pdf") {
    contentBlocks.push({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: args.base64,
      },
    });
  } else if (args.mediaType.startsWith("image/")) {
    contentBlocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: args.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data: args.base64,
      },
    });
  } else {
    // Text-based formats (TXT, DOCX treated as text, etc.)
    const text = Buffer.from(args.base64, "base64").toString("utf-8");
    contentBlocks.push({
      type: "text",
      text: `[Transcript content from file: ${args.fileName}]\n\n${text}`,
    });
  }

  contentBlocks.push({
    type: "text",
    text: `Analyze this call transcript against the 40-question Owner & GM Involvement framework. Extract every data point available and produce the full assessment JSON.\n\nFile name: ${args.fileName}`,
  });

  const response = await client.messages.create({
    model: resolveModel("claude-sonnet-4-20250514"),
    max_tokens: 6000,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: contentBlocks,
      },
    ],
  });

  const rawText = extractText(response);
  const cleaned = rawText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(cleaned) as OwnerGmAssessment;
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
