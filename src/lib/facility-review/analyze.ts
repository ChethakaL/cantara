import Anthropic from '@anthropic-ai/sdk'
import type { FacilityRating, FacilityReviewReport } from './types'
import type { AgentAiProvider } from '@/lib/agent-model-provider'
import { requireAIClient, resolveModel } from '@/lib/ai-client'
import { createAgentMessage, type AgentMessageBlock } from '@/lib/llm-completion'

const DEFAULT_MODEL = 'claude-sonnet-4-20250514'
const DEFAULT_MAX_TOKENS = Number(process.env.FACILITY_REVIEW_MAX_TOKENS) || 16000

const ZONE_WEIGHTS = [
  ['Exterior & Curb Appeal', 10],
  ['Reception & Client-Facing Areas', 15],
  ['Boarding & Daycare Areas', 25],
  ['Grooming Suite', 15],
  ['Outdoor Play Areas', 20],
  ['Staff & Operational Areas', 15],
] as const

const FACILITY_REPORT_JSON_SCHEMA = `Return ONLY valid JSON matching this shape:
{
  "businessName": string,
  "location": string,
  "assessmentDate": "Month YYYY",
  "preparedBy": "Cantara Pet Business Advisors",
  "reportVersion": "v1.0 — Baseline",
  "nextReview": "Upon completion of improvement milestones",
  "overallScore": number,
  "overallRating": "Excellent|Good|Needs Attention|Critical",
  "overallNarrative": "one strong paragraph, 2-4 sentences",
  "zones": [
    {
      "zone": "Exterior & Curb Appeal|Reception & Client-Facing Areas|Boarding & Daycare Areas|Grooming Suite|Outdoor Play Areas|Staff & Operational Areas",
      "weight": number,
      "score": number,
      "rating": "Excellent|Good|Needs Attention|Critical",
      "commentary": "one paragraph, 3-5 sentences, buyer-focused",
      "keyFindings": ["specific visible finding or missing evidence"]
    }
  ],
  "prioritizedImprovements": [
    {
      "improvement": "specific action",
      "zone": "short zone name",
      "valueImpact": "High|Medium|Low",
      "effort": "High|Medium|Low",
      "timing": "Week 1|Within 30 days|Within 60 days|Within 90 days|Ongoing — data room prep"
    }
  ],
  "maintenanceHistorySummary": "one paragraph. If maintenance records were not uploaded, say records were not provided and list what should be compiled before market.",
  "capitalExpenditureOutlook": [
    {
      "item": "near-term capex item or documentation item",
      "estimatedCostRange": "Not estimated from images|$x - $y",
      "timing": "Year 1|Year 1-2|Year 2-3|Before marketing"
    }
  ],
  "complianceLicensingSnapshot": "one paragraph. Do not claim licenses are current unless user notes prove it.",
  "brandCurbAppealAssessment": "one paragraph focused on market photography and first impression.",
  "cantaraAdvisoryCommentary": "one paragraph tying facility quality to buyer confidence and sale readiness.",
  "methodologyDisclosure": "one paragraph explaining image-based limitations, no independent inspection, confidential advisory use.",
  "imageCoverageNotes": ["which zones/images were well covered or under-covered"],
  "buyerRiskSummary": "one paragraph on likely buyer diligence concerns",
  "generatedAt": "",
  "modelUsed": ""
}`

const SCORING_RULES = `Scoring:
- Excellent = 85-100
- Good = 70-84
- Needs Attention = 50-69
- Critical = below 50
- Fixed zone weights: Exterior & Curb Appeal 10, Reception & Client-Facing Areas 15, Boarding & Daycare Areas 25, Grooming Suite 15, Outdoor Play Areas 20, Staff & Operational Areas 15.

Important scoring rule:
- Do not score a zone Critical only because it is missing from uploaded images.
- If photos are missing or a zone is not visible, use the provided factual notes for service dates, compliance, capex history, and known issues.
- Critical requires a visible severe condition, major safety concern, explicit disclosure, or explicit advisor note, not absence of photos alone.
- Separate "facility condition" from "image coverage". Missing coverage should create recommendations to capture optional photos, not invented defects.

Write in same executive tone as Cantara sample: direct, sale-readiness focused, buyer-risk language, specific remediation, no generic AI caveats in main commentary. Mention "from image review" only in coverage notes.`

function ratingForScore(score: number): FacilityRating {
  if (score >= 85) return 'Excellent'
  if (score >= 70) return 'Good'
  if (score >= 50) return 'Needs Attention'
  return 'Critical'
}

function parseClaudeJson(rawText: string): FacilityReviewReport {
  const cleaned = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
  try {
    return JSON.parse(cleaned) as FacilityReviewReport
  } catch (error) {
    const looksTruncated = cleaned.length > 8000 && !cleaned.trimEnd().endsWith('}')
    if (looksTruncated) {
      throw new Error(
        'Facility report JSON was truncated before completion. Try again with fewer photos or shorter meeting notes.',
      )
    }
    throw error
  }
}

function isCoverageGapOnly(text: string): boolean {
  const normalized = text.toLowerCase()
  const hasCoverageGap = [
    'not visible',
    'not shown',
    'under-covered',
    'under covered',
    'unverified',
    'undocumented',
    'no evidence',
    'no image',
    'missing documentation',
    'not assessed',
    'unknown',
  ].some(term => normalized.includes(term))

  const hasVisibleCriticalDefect = [
    'rust',
    'broken',
    'damaged',
    'compromised',
    'unsafe',
    'standing water',
    'mold',
    'exposed wire',
    'hazard',
    'severe wear',
  ].some(term => normalized.includes(term))

  return hasCoverageGap && !hasVisibleCriticalDefect
}

function normalizeReport(report: FacilityReviewReport, modelUsed: string): FacilityReviewReport {
  const zones = ZONE_WEIGHTS.map(([zone, weight]) => {
    const found = report.zones?.find(z => z.zone === zone)
    const rawScore = Math.max(0, Math.min(100, Math.round(Number(found?.score ?? 0))))
    const combinedText = `${found?.commentary || ''} ${(found?.keyFindings || []).join(' ')}`
    const score = isCoverageGapOnly(combinedText) ? Math.max(rawScore, 55) : rawScore
    return {
      zone,
      weight,
      score,
      rating: ratingForScore(score),
      commentary: found?.commentary || 'Insufficient image coverage to assess this zone with confidence.',
      narrative: found?.narrative || found?.commentary || 'Insufficient image coverage to assess this zone with confidence.',
      keyFindings: Array.isArray(found?.keyFindings) ? found!.keyFindings.slice(0, 5) : [],
      strengths: found?.strengths,
      concerns: found?.concerns,
    }
  })

  const weightedScore = Math.round(
    zones.reduce((sum, zone) => sum + zone.score * (zone.weight / 100), 0)
  )

  return {
    ...report,
    overallScore: weightedScore,
    overallRating: ratingForScore(weightedScore),
    zones,
    prioritizedImprovements: Array.isArray(report.prioritizedImprovements)
      ? report.prioritizedImprovements.slice(0, 10)
      : [],
    imageCoverageNotes: Array.isArray(report.imageCoverageNotes) ? report.imageCoverageNotes.slice(0, 6) : [],
    generatedAt: new Date().toISOString(),
    modelUsed,
  }
}

async function runFacilityAnalysis(args: {
  businessName: string
  location: string
  prompt: string
  images: Array<{ fileName: string; base64: string; mediaType: string }>
  notesDocument?: { fileName: string; base64: string; mediaType: 'application/pdf' | 'text/plain' }
  supportingDocuments?: Array<{ fileName: string; base64: string; mediaType: 'application/pdf' | 'text/plain' }>
  provider?: AgentAiProvider
  modelId?: string
}): Promise<FacilityReviewReport> {
  const provider = args.provider ?? 'bedrock'
  const logicalModel = process.env.FACILITY_REVIEW_MODEL || DEFAULT_MODEL
  const model = resolveModel(logicalModel)
  const supportingDocuments = args.supportingDocuments ?? []

  const content: AgentMessageBlock[] = []

  if (args.notesDocument) {
    content.push({
      type: 'document',
      title: args.notesDocument.fileName,
      source: {
        type: 'base64',
        media_type: args.notesDocument.mediaType,
        data: args.notesDocument.base64,
      },
    })
    content.push({
      type: 'text',
      text: `Attached advisor meeting notes document: ${args.notesDocument.fileName}`,
    })
  }

  for (const doc of supportingDocuments) {
    content.push({
      type: 'document',
      title: doc.fileName,
      source: {
        type: 'base64',
        media_type: doc.mediaType,
        data: doc.base64,
      },
    })
    content.push({
      type: 'text',
      text: `Attached additional supporting document: ${doc.fileName}`,
    })
  }

  content.push(
    ...args.images.flatMap((image, index) => [
      {
        type: 'image' as const,
        source: {
          media_type: image.mediaType,
          data: image.base64,
        },
      },
      {
        type: 'text' as const,
        text: `Image ${index + 1}: ${image.fileName}`,
      },
    ]),
  )

  content.push({
    type: 'text',
    text: `${args.prompt}

${SCORING_RULES}

${FACILITY_REPORT_JSON_SCHEMA}`,
  })

  let rawText: string
  if (provider === 'openai') {
    rawText = await createAgentMessage({
      provider,
      model: args.modelId,
      system: '',
      content,
      maxTokens: DEFAULT_MAX_TOKENS,
      temperature: 0,
    })
  } else {
    const client = await requireAIClient()
    const anthropicContent: Anthropic.Messages.ContentBlockParam[] = []

    if (args.notesDocument) {
      anthropicContent.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: args.notesDocument.mediaType,
          data: args.notesDocument.base64,
        },
        title: args.notesDocument.fileName,
      } as Anthropic.Messages.ContentBlockParam)
      anthropicContent.push({
        type: 'text',
        text: `Attached advisor meeting notes document: ${args.notesDocument.fileName}`,
      })
    }

    for (const doc of supportingDocuments) {
      anthropicContent.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: doc.mediaType,
          data: doc.base64,
        },
        title: doc.fileName,
      } as Anthropic.Messages.ContentBlockParam)
      anthropicContent.push({
        type: 'text',
        text: `Attached additional supporting document: ${doc.fileName}`,
      })
    }

    anthropicContent.push(
      ...args.images.flatMap((image, index) => [
        {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: image.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: image.base64,
          },
        },
        {
          type: 'text' as const,
          text: `Image ${index + 1}: ${image.fileName}`,
        },
      ]),
    )

    anthropicContent.push({
      type: 'text',
      text: `${args.prompt}

${SCORING_RULES}

${FACILITY_REPORT_JSON_SCHEMA}`,
    })

    const response = await client.messages.create({
      model,
      max_tokens: DEFAULT_MAX_TOKENS,
      temperature: 0,
      messages: [{ role: 'user', content: anthropicContent }],
    })

    if (response.stop_reason === 'max_tokens') {
      throw new Error(
        `Facility report generation hit the ${DEFAULT_MAX_TOKENS} token output limit. Try fewer visit photos or shorter meeting notes.`,
      )
    }

    rawText = response.content
      .filter((block) => block.type === 'text')
      .map((block) => ('text' in block ? block.text : ''))
      .join('')
  }

  rawText = rawText.trim()
  return normalizeReport(parseClaudeJson(rawText), logicalModel)
}

export async function analyzeFacilityImages(args: {
  businessName: string
  location: string
  notes?: string
  images: Array<{ fileName: string; base64: string; mediaType: string }>
  provider?: AgentAiProvider
  modelId?: string
}): Promise<FacilityReviewReport> {
  return runFacilityAnalysis({
    businessName: args.businessName,
    location: args.location,
    images: args.images,
    provider: args.provider,
    modelId: args.modelId,
    prompt: `Create Cantara Pet Business Advisors Facility Assessment Report from the seller intake responses and any uploaded facility images.

Business name: ${args.businessName}
Location: ${args.location || 'Unknown'}
Seller intake responses, admin notes, and image labels:
${args.notes || 'None'}

Use sale-readiness buyer lens for pet boarding, daycare, grooming, training, and veterinary-adjacent facilities. Be practical. Infer only visible conditions.
- Where the seller disclosed "None" for known issues, treat that as seller-provided disclosure, not independent verification.`,
  })
}

export async function analyzeAdvisorFacilityReview(args: {
  businessName: string
  location: string
  meetingNotes: string
  images: Array<{ fileName: string; base64: string; mediaType: string }>
  notesDocument?: { fileName: string; base64: string; mediaType: 'application/pdf' | 'text/plain' }
  supportingDocuments?: Array<{ fileName: string; base64: string; mediaType: 'application/pdf' | 'text/plain' }>
  provider?: AgentAiProvider
  modelId?: string
}): Promise<FacilityReviewReport> {
  const imageNote = args.images.length
    ? `${args.images.length} advisor visit photo(s) are attached as supporting evidence.`
    : 'No visit photos were uploaded — base the assessment only on the advisor notes below.'
  const documentNote = args.notesDocument
    ? `An uploaded meeting notes file (${args.notesDocument.fileName}) is attached as a native document. Prefer its contents when pasted notes are empty or incomplete.`
    : ''
  const supportingDocs = args.supportingDocuments ?? []
  const supportingNote = supportingDocs.length
    ? [
        `${supportingDocs.length} additional supporting document(s) are attached as native document files for the model to read directly: ${supportingDocs.map((d) => d.fileName).join(', ')}.`,
        'Treat these attached files as authoritative context. Incorporate material facts into zone findings, CapEx/improvements, and narratives.',
        'When a finding comes from a supporting document, briefly name the source file in commentary or keyFindings (e.g. "per attached CapEx schedule.pdf").',
      ].join(' ')
    : ''

  return runFacilityAnalysis({
    businessName: args.businessName,
    location: args.location,
    images: args.images,
    notesDocument: args.notesDocument,
    supportingDocuments: supportingDocs.length ? supportingDocs : undefined,
    provider: args.provider,
    modelId: args.modelId,
    prompt: `Create the SAME Cantara Pet Business Advisors Facility Assessment Report format used for standard seller intake reviews — with overall score, zone scores, prioritized improvements, and all standard report sections.

This is an ADVISOR-RUN facility review from a site visit. The seller intake form was NOT used. Use the advisor meeting notes, any uploaded visit photos, and any additional supporting documents attached as files.

Business name: ${args.businessName}
Location: ${args.location || 'Unknown'}
${imageNote}
${documentNote}
${supportingNote}

Advisor meeting notes and visit observations:
${args.meetingNotes || '(No pasted notes — use the attached meeting notes document.)'}

Use sale-readiness buyer lens for pet boarding, daycare, grooming, training, and veterinary-adjacent facilities. Treat advisor notes as the primary source of truth. Use photos and attached supporting documents as corroborating evidence. Do not invent conditions not supported by the notes, attached documents, or visible images.
Set reportVersion to "v1.0 — Advisor Visit".`,
  })
}

/** Re-score from advisor-edited zone notes / improvements (no image re-analysis). */
export async function reanalyzeFacilityReviewFromEdits(
  existingReport: FacilityReviewReport,
  options?: { provider?: AgentAiProvider; modelId?: string },
): Promise<FacilityReviewReport> {
  const provider = options?.provider ?? 'bedrock'
  const logicalModel = process.env.FACILITY_REVIEW_MODEL || DEFAULT_MODEL

  const inputZones = (existingReport.zones ?? []).map((z) => {
    const advisorNotes = (z.narrative || z.commentary || '').trim()
    return {
      zone: z.zone,
      weight: z.weight,
      currentScore: Math.max(0, Math.min(100, Math.round(Number(z.score ?? 0)))),
      currentRating: z.rating,
      advisorNotes,
      keyFindings: z.keyFindings,
      strengths: z.strengths,
      concerns: z.concerns,
    }
  })

  const authoritative = {
    businessName: existingReport.businessName,
    location: existingReport.location,
    zones: inputZones,
    prioritizedImprovements: existingReport.prioritizedImprovements,
  }

  const prompt = `You are Cantara Pet Business Advisors Facility Assessment Agent.

An advisor typed/edited zone notes (and possibly improvements) on an existing Facility Review report.
RE-SCORE each zone and REWRITE buyer-facing narratives from those advisor notes.

## CRITICAL
- Advisor notes on each zone are GROUND TRUTH for condition. If notes describe serious defects, LOWER the score even if currentScore is high.
- If advisor notes are empty for a zone, keep that zone's currentScore/currentRating unchanged.
- If notes describe major safety issues, severe damage, contamination, blocked access, or buyer-walkthrough blockers → score Critical (<50) or Needs Attention (50-69) as appropriate.
- If notes say issues were fixed / excellent condition → score can rise to Good (70-84) or Excellent (85-100).
- Do not invent defects not supported by advisor notes or existing findings.
- Update prioritizedImprovements to reflect the new scoring (add/remove/rewrite as needed).

## AUTHORITATIVE ADVISOR-EDITED DATA
${JSON.stringify(authoritative, null, 2)}

${SCORING_RULES}

Return ONLY valid JSON (no markdown) with EXACTLY these keys:
{
  "zones": [
    {
      "zone": "<exact zone name from input>",
      "score": <0-100>,
      "rating": "Excellent|Good|Needs Attention|Critical",
      "commentary": "3-5 sentence buyer-focused paragraph reflecting advisor notes",
      "narrative": "same as commentary (short zone summary shown in UI)",
      "keyFindings": ["specific finding", "..."],
      "strengths": ["optional"],
      "concerns": ["optional"]
    }
  ],
  "prioritizedImprovements": [
    {
      "improvement": "specific action",
      "zone": "short zone name",
      "valueImpact": "High|Medium|Low",
      "effort": "High|Medium|Low",
      "timing": "Week 1|Within 30 days|Within 60 days|Within 90 days|Ongoing — data room prep",
      "estimatedCost": "optional",
      "impact": "High|Medium|Low"
    }
  ],
  "overallNarrative": "2-4 sentences reflecting updated zone scores",
  "buyerRiskSummary": "one paragraph on likely buyer diligence concerns",
  "cantaraAdvisoryCommentary": "one paragraph on sale readiness",
  "brandCurbAppealAssessment": "one paragraph",
  "maintenanceHistorySummary": "one paragraph",
  "complianceLicensingSnapshot": "one paragraph",
  "capitalExpenditureOutlook": [{ "item": string, "estimatedCostRange": string, "timing": string }],
  "methodologyDisclosure": "one short paragraph"
}

Include EVERY zone from the input.`

  let rawText: string
  if (provider === 'openai') {
    rawText = await createAgentMessage({
      provider,
      model: options?.modelId,
      system: '',
      content: prompt,
      maxTokens: 8192,
      temperature: 0,
    })
  } else {
    const client = await requireAIClient()
    const response = await client.messages.create({
      model: resolveModel(logicalModel),
      max_tokens: 8192,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    })
    rawText = response.content
      .filter((block) => block.type === 'text')
      .map((block) => ('text' in block ? block.text : ''))
      .join('')
  }

  let parsed: Record<string, unknown>
  try {
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    parsed = JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned) as Record<string, unknown>
  } catch (err) {
    console.error('[Facility Review] Reanalyze parse failed:', rawText.slice(0, 500))
    throw err instanceof Error ? err : new Error('Facility reanalyze returned unparseable JSON. Please retry.')
  }

  const aiZones = Array.isArray(parsed.zones) ? (parsed.zones as Array<Record<string, unknown>>) : []
  const aiByZone = new Map(aiZones.map((z) => [String(z.zone || ''), z]))

  const zones = (existingReport.zones ?? []).map((existing) => {
    const ai = aiByZone.get(existing.zone)
    const advisorNotes = (existing.narrative || existing.commentary || '').trim()
    // No advisor notes → keep score; with notes → use AI score (fallback to existing).
    const rawScore = advisorNotes && ai?.score !== undefined
      ? Number(ai.score)
      : Number(existing.score ?? 0)
    const score = Math.max(0, Math.min(100, Math.round(rawScore)))
    const commentary =
      typeof ai?.commentary === 'string' && ai.commentary.trim()
        ? ai.commentary
        : typeof ai?.narrative === 'string' && ai.narrative.trim()
          ? ai.narrative
          : existing.commentary
    const narrative =
      typeof ai?.narrative === 'string' && ai.narrative.trim()
        ? ai.narrative
        : commentary
    return {
      ...existing,
      score,
      rating: ratingForScore(score),
      commentary,
      narrative,
      keyFindings: Array.isArray(ai?.keyFindings) ? (ai.keyFindings as string[]) : existing.keyFindings,
      strengths: Array.isArray(ai?.strengths) ? (ai.strengths as string[]) : existing.strengths,
      concerns: Array.isArray(ai?.concerns) ? (ai.concerns as string[]) : existing.concerns,
    }
  })

  const weightedScore = Math.round(
    ZONE_WEIGHTS.reduce((sum, [zoneName, weight]) => {
      const found = zones.find((z) => z.zone === zoneName)
      return sum + (found?.score ?? 0) * (weight / 100)
    }, 0),
  )

  return {
    ...existingReport,
    zones,
    overallScore: weightedScore,
    overallRating: ratingForScore(weightedScore),
    prioritizedImprovements: Array.isArray(parsed.prioritizedImprovements)
      ? (parsed.prioritizedImprovements as FacilityReviewReport['prioritizedImprovements'])
      : existingReport.prioritizedImprovements,
    overallNarrative:
      typeof parsed.overallNarrative === 'string' && parsed.overallNarrative.trim()
        ? parsed.overallNarrative
        : existingReport.overallNarrative,
    buyerRiskSummary:
      typeof parsed.buyerRiskSummary === 'string' && parsed.buyerRiskSummary.trim()
        ? parsed.buyerRiskSummary
        : existingReport.buyerRiskSummary,
    cantaraAdvisoryCommentary:
      typeof parsed.cantaraAdvisoryCommentary === 'string' && parsed.cantaraAdvisoryCommentary.trim()
        ? parsed.cantaraAdvisoryCommentary
        : existingReport.cantaraAdvisoryCommentary,
    brandCurbAppealAssessment:
      typeof parsed.brandCurbAppealAssessment === 'string' && parsed.brandCurbAppealAssessment.trim()
        ? parsed.brandCurbAppealAssessment
        : existingReport.brandCurbAppealAssessment,
    maintenanceHistorySummary:
      typeof parsed.maintenanceHistorySummary === 'string' && parsed.maintenanceHistorySummary.trim()
        ? parsed.maintenanceHistorySummary
        : existingReport.maintenanceHistorySummary,
    complianceLicensingSnapshot:
      typeof parsed.complianceLicensingSnapshot === 'string' && parsed.complianceLicensingSnapshot.trim()
        ? parsed.complianceLicensingSnapshot
        : existingReport.complianceLicensingSnapshot,
    capitalExpenditureOutlook: Array.isArray(parsed.capitalExpenditureOutlook)
      ? (parsed.capitalExpenditureOutlook as FacilityReviewReport['capitalExpenditureOutlook'])
      : existingReport.capitalExpenditureOutlook,
    methodologyDisclosure:
      typeof parsed.methodologyDisclosure === 'string' && parsed.methodologyDisclosure.trim()
        ? parsed.methodologyDisclosure
        : existingReport.methodologyDisclosure,
    imageCoverageNotes: existingReport.imageCoverageNotes,
    generatedAt: new Date().toISOString(),
    modelUsed: options?.modelId || logicalModel,
  }
}
