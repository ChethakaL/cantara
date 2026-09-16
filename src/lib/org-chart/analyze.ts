import type { AgentAiProvider } from '@/lib/agent-model-provider'
import { requireAIClient, resolveModel } from '@/lib/ai-client'
import { createAgentMessage } from '@/lib/llm-completion'

export interface OrgChartAnalysis {
  summary: string
  totalHeadcount: number | null
  roles: Array<{
    name: string
    title: string
    department: string
    reportsTo: string
    keyPerson: boolean
    transitionRisk: 'high' | 'medium' | 'low'
    notes: string
  }>
  keyPersonDependencies: Array<{
    person: string
    title: string
    risk: string
    mitigation: string
  }>
  roleGaps: string[]
  transitionReadiness: 'high' | 'medium' | 'low'
  recommendations: string[]
  generatedAt: string
}

export async function analyzeOrgChart(args: {
  fileName: string
  base64: string
  mediaType: string
  provider?: AgentAiProvider
  modelId?: string
}): Promise<OrgChartAnalysis> {
  const provider = args.provider ?? 'bedrock'
  const content: any[] = []

  if (args.mediaType === 'application/pdf') {
    content.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: args.base64 },
    })
  } else if (args.mediaType.startsWith('image/')) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: args.mediaType, data: args.base64 },
    })
  } else if (args.mediaType.includes('spreadsheet') || args.mediaType.includes('excel') || args.fileName.endsWith('.xlsx') || args.fileName.endsWith('.xls') || args.fileName.endsWith('.csv')) {
    // For Excel/CSV, send as document
    content.push({
      type: 'document',
      source: { type: 'base64', media_type: args.mediaType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', data: args.base64 },
    })
  }

  content.push({
    type: 'text',
    text: `You are an M&A organizational analyst reviewing an org chart for a pet care business being prepared for sale.

Analyze this document (${args.fileName}) and extract the organizational structure. Focus on:
1. Complete headcount and role inventory
2. Key-person dependencies (people whose departure would materially impact operations)
3. Owner/GM dependency assessment
4. Role gaps that a buyer would need to fill
5. Transition readiness — how smoothly could this business transfer to a new owner?

Return ONLY valid JSON:
{
  "summary": "2-4 sentence assessment of the org structure and transition readiness",
  "totalHeadcount": <number or null>,
  "roles": [
    {
      "name": "Person name",
      "title": "Job title",
      "department": "Department/area",
      "reportsTo": "Manager name or 'Owner'",
      "keyPerson": true/false,
      "transitionRisk": "high|medium|low",
      "notes": "Relevant notes for M&A context"
    }
  ],
  "keyPersonDependencies": [
    {
      "person": "Name",
      "title": "Title",
      "risk": "What happens if they leave",
      "mitigation": "How to mitigate this risk"
    }
  ],
  "roleGaps": ["Roles missing that a buyer would likely need to fill"],
  "transitionReadiness": "high|medium|low",
  "recommendations": ["Specific recommendations for improving transition readiness"]
}`,
  })

  let rawText: string
  if (provider === 'openai') {
    rawText = await createAgentMessage({
      provider,
      model: args.modelId,
      system: '',
      content: content as Parameters<typeof createAgentMessage>[0]['content'],
      maxTokens: 4000,
      temperature: 0,
    })
  } else {
    const client = await requireAIClient()
    const response = await client.messages.create({
      model: resolveModel('claude-opus-4-5'),
      max_tokens: 4000,
      temperature: 0,
      messages: [{ role: 'user', content }],
    })
    rawText = response.content
      .filter((b) => b.type === 'text')
      .map((b) => ('text' in b ? b.text : ''))
      .join('')
  }
  rawText = rawText.trim()
  const cleaned = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
  const parsed = JSON.parse(cleaned)
  return { ...parsed, generatedAt: new Date().toISOString() }
}

function parseOrgChartReanalyzeJson(rawText: string): Record<string, unknown> {
  const cleaned = rawText.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
  try {
    return JSON.parse(cleaned) as Record<string, unknown>
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>
      } catch {
        /* fall through */
      }
    }
  }
  throw new Error('Org chart reanalyze returned unparseable JSON. Please retry.')
}

const TRANSITION_READINESS_VALUES = new Set(['high', 'medium', 'low'])

/**
 * Re-score narrative from advisor-edited roles / headcount (no document re-upload).
 * roles[] and totalHeadcount are treated as ground truth and are NOT modified — only
 * summary, keyPersonDependencies commentary, roleGaps, transitionReadiness, and
 * recommendations refresh.
 */
export async function reanalyzeOrgChartFromEdits(
  existingReport: OrgChartAnalysis,
  options?: { provider?: AgentAiProvider; modelId?: string },
): Promise<OrgChartAnalysis> {
  const provider = options?.provider ?? 'bedrock'

  const authoritative = {
    totalHeadcount: existingReport.totalHeadcount,
    roles: existingReport.roles,
  }

  const prompt = `You are an M&A organizational analyst reviewing an org chart for a pet care business being prepared for sale.

An advisor manually corrected the role roster and/or total headcount on an existing Org Chart Review report. REWRITE the summary, key-person dependency commentary, role gaps, transition readiness, and recommendations to match this corrected roster. There is no document to re-read in this pass — the roster below is the sole source of truth.

## CRITICAL — advisor-edited roster is ground truth
- Do NOT invent roles, rename people, or change totalHeadcount — treat the roster below as final and unchangeable.
- Base key-person dependencies, role gaps, transition readiness, and recommendations STRICTLY on this roster (titles, departments, reportsTo, keyPerson flags, transitionRisk levels, and notes).
- Every entry in keyPersonDependencies must reference a person who appears in the roster (prioritize those with keyPerson: true or transitionRisk: "high").
- If most roles show high transitionRisk or many are flagged keyPerson, transitionReadiness must reflect that risk — do not soften it. If risk is low, do not manufacture dependency issues.

## AUTHORITATIVE ADVISOR-EDITED ROSTER
${JSON.stringify(authoritative, null, 2)}

Return ONLY valid JSON (no markdown, no code fences, no commentary before or after) with EXACTLY these keys:
{
  "summary": "2-4 sentence assessment of the org structure and transition readiness given the roster above",
  "keyPersonDependencies": [
    {
      "person": "Name (must match a name from the roster)",
      "title": "Title",
      "risk": "What happens if they leave",
      "mitigation": "How to mitigate this risk"
    }
  ],
  "roleGaps": ["Roles missing that a buyer would likely need to fill"],
  "transitionReadiness": "high|medium|low",
  "recommendations": ["Specific recommendations for improving transition readiness"]
}`

  let rawText: string
  if (provider === 'openai') {
    rawText = await createAgentMessage({
      provider,
      model: options?.modelId,
      system: '',
      content: prompt,
      maxTokens: 3000,
      temperature: 0,
    })
  } else {
    const client = await requireAIClient()
    const response = await client.messages.create({
      model: resolveModel('claude-opus-4-5'),
      max_tokens: 3000,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    })
    rawText = response.content
      .filter((b) => b.type === 'text')
      .map((b) => ('text' in b ? b.text : ''))
      .join('')
  }

  let parsed: Record<string, unknown>
  try {
    parsed = parseOrgChartReanalyzeJson(rawText)
  } catch (err) {
    console.error('[Org Chart] Reanalyze parse failed:', rawText.slice(0, 500))
    throw err instanceof Error ? err : new Error('Org chart reanalyze returned unparseable JSON. Please retry.')
  }

  return {
    ...existingReport,
    summary:
      typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary : existingReport.summary,
    keyPersonDependencies: Array.isArray(parsed.keyPersonDependencies)
      ? (parsed.keyPersonDependencies as OrgChartAnalysis['keyPersonDependencies'])
      : existingReport.keyPersonDependencies,
    roleGaps: Array.isArray(parsed.roleGaps) ? (parsed.roleGaps as string[]) : existingReport.roleGaps,
    transitionReadiness: TRANSITION_READINESS_VALUES.has(String(parsed.transitionReadiness))
      ? (parsed.transitionReadiness as OrgChartAnalysis['transitionReadiness'])
      : existingReport.transitionReadiness,
    recommendations: Array.isArray(parsed.recommendations)
      ? (parsed.recommendations as string[])
      : existingReport.recommendations,
    generatedAt: new Date().toISOString(),
  }
}
