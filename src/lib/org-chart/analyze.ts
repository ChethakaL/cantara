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
