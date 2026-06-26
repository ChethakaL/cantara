import Anthropic from '@anthropic-ai/sdk'
import type { FacilityRating, FacilityReviewReport } from './types'
import { requireAIClient, resolveModel } from "@/lib/ai-client"

const DEFAULT_MODEL = 'claude-sonnet-4-20250514'

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
  return JSON.parse(cleaned) as FacilityReviewReport
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
      keyFindings: Array.isArray(found?.keyFindings) ? found!.keyFindings.slice(0, 5) : [],
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
}): Promise<FacilityReviewReport> {
  const logicalModel = process.env.FACILITY_REVIEW_MODEL || DEFAULT_MODEL
  const model = resolveModel(logicalModel)
  const client = await requireAIClient()

  const content: Anthropic.Messages.ContentBlockParam[] = args.images.flatMap((image, index) => [
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
  ])

  content.push({
    type: 'text',
    text: `${args.prompt}

${SCORING_RULES}

${FACILITY_REPORT_JSON_SCHEMA}`,
  })

  const response = await client.messages.create({
    model,
    max_tokens: 5200,
    temperature: 0,
    messages: [{ role: 'user', content }],
  })

  const rawText = response.content
    .filter(block => block.type === 'text')
    .map(block => ('text' in block ? block.text : ''))
    .join('')
    .trim()

  return normalizeReport(parseClaudeJson(rawText), logicalModel)
}

export async function analyzeFacilityImages(args: {
  businessName: string
  location: string
  notes?: string
  images: Array<{ fileName: string; base64: string; mediaType: string }>
}): Promise<FacilityReviewReport> {
  return runFacilityAnalysis({
    businessName: args.businessName,
    location: args.location,
    images: args.images,
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
}): Promise<FacilityReviewReport> {
  const imageNote = args.images.length
    ? `${args.images.length} advisor visit photo(s) are attached as supporting evidence.`
    : 'No visit photos were uploaded — base the assessment only on the advisor notes below.'

  return runFacilityAnalysis({
    businessName: args.businessName,
    location: args.location,
    images: args.images,
    prompt: `Create the SAME Cantara Pet Business Advisors Facility Assessment Report format used for standard seller intake reviews — with overall score, zone scores, prioritized improvements, and all standard report sections.

This is an ADVISOR-RUN facility review from a site visit. The seller intake form was NOT used. Use ONLY the advisor meeting notes and any uploaded visit photos.

Business name: ${args.businessName}
Location: ${args.location || 'Unknown'}
${imageNote}

Advisor meeting notes and visit observations:
${args.meetingNotes}

Use sale-readiness buyer lens for pet boarding, daycare, grooming, training, and veterinary-adjacent facilities. Treat advisor notes as the primary source of truth. Use photos only as supporting evidence. Do not invent conditions not supported by the notes or visible images.
Set reportVersion to "v1.0 — Advisor Visit".`,
  })
}
