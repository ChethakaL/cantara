import Anthropic from '@anthropic-ai/sdk'
import { getAnthropicApiKey } from "@/lib/secure-settings"

export interface LitigationSearchResult {
  summary: string
  findings: Array<{
    type: 'litigation' | 'lien' | 'judgment' | 'ucc_filing' | 'bankruptcy' | 'other'
    title: string
    description: string
    severity: 'high' | 'medium' | 'low' | 'clear'
    source: string
    date?: string
  }>
  riskLevel: 'high' | 'medium' | 'low' | 'clear'
  searchesPerformed: string[]
  generatedAt: string
}

function extractJsonObject(text: string): string {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return cleaned
  return cleaned.slice(start, end + 1)
}

export async function searchPublicRecords(args: {
  businessName: string
  ownerName: string
  state: string
  county?: string
  city?: string
}): Promise<LitigationSearchResult> {
  const apiKey = await getAnthropicApiKey()
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY required')

  const client = new Anthropic({ apiKey })

  const searchQueries = [
    `${args.businessName} ${args.ownerName} court records ${args.county ? args.county + ' County' : ''} ${args.state}`,
    `${args.businessName} UCC filing ${args.state} secretary of state`,
    `${args.businessName} ${args.ownerName} lawsuit litigation`,
    `${args.businessName} lien judgment ${args.state}`,
    `${args.ownerName} bankruptcy filing`,
  ]

  const prompt = `You are a litigation and lien search analyst for an M&A advisory firm. Use the web_search tool to search public web sources for litigation, liens, judgments, UCC filings, or bankruptcy filings related to this business and its owner.

Business: ${args.businessName}
Owner: ${args.ownerName}
State: ${args.state}
${args.county ? `County: ${args.county}` : ''}
${args.city ? `City: ${args.city}` : ''}

Run these searches with web_search:
${searchQueries.map((query, i) => `${i + 1}. ${query}`).join('\n')}

Look for:
1. Court records and lawsuits involving the business or owner
2. UCC filings against the business
3. Tax liens or other liens
4. Judgments against the business or owner
5. Bankruptcy filings

After searching, return JSON:

{
  "summary": "2-4 sentence summary of overall findings",
  "findings": [
    {
      "type": "litigation|lien|judgment|ucc_filing|bankruptcy|other",
      "title": "Brief title of finding",
      "description": "What was found, including dates and amounts if available",
      "severity": "high|medium|low|clear",
      "source": "URL or source description",
      "date": "Date if known"
    }
  ],
  "riskLevel": "high|medium|low|clear",
  "searchesPerformed": ["list of search queries executed"]
}

If nothing is found, return riskLevel "clear" with an empty findings array and a summary stating no public records were found in searched public web sources. Return ONLY valid JSON. Do not say you will search; perform the searches first.`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    temperature: 0,
    tools: [{
      type: 'web_search_20260209' as any,
      name: 'web_search',
      max_uses: 8,
      allowed_callers: ['direct'],
    }],
    messages: [{ role: 'user', content: prompt }],
  })

  const searchRequests = response.usage?.server_tool_use?.web_search_requests ?? 0
  const textBlocks = response.content.filter((b) => b.type === 'text')
  const rawText = textBlocks.map((b) => ('text' in b ? b.text : '')).join('').trim()
  const cleaned = extractJsonObject(rawText)

  try {
    const parsed = JSON.parse(cleaned)
    if (searchRequests === 0) {
      throw new Error('Claude returned JSON without using web_search')
    }
    return {
      ...parsed,
      searchesPerformed: Array.isArray(parsed.searchesPerformed) ? parsed.searchesPerformed : searchQueries,
      generatedAt: new Date().toISOString(),
    }
  } catch {
    return {
      summary: searchRequests > 0
        ? 'Claude web search ran, but the analysis response could not be parsed into the required report JSON.'
        : 'Claude did not invoke web_search. Please retry; if this persists, check Anthropic web search availability for this API key/model.',
      findings: [],
      riskLevel: 'low' as const,
      searchesPerformed: searchQueries,
      generatedAt: new Date().toISOString(),
    }
  }
}

export async function analyzeUploadedDocument(args: {
  fileName: string
  base64: string
  mediaType: string
}): Promise<LitigationSearchResult> {
  const apiKey = await getAnthropicApiKey()
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY required')

  const client = new Anthropic({ apiKey })

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
  }

  content.push({
    type: 'text',
    text: `You are a litigation and lien search analyst for an M&A advisory firm. Review this uploaded document (${args.fileName}) and extract all litigation, lien, judgment, UCC filing, or bankruptcy information.

Return ONLY valid JSON:
{
  "summary": "2-4 sentence summary",
  "findings": [
    {
      "type": "litigation|lien|judgment|ucc_filing|bankruptcy|other",
      "title": "Brief title",
      "description": "Details including dates and amounts",
      "severity": "high|medium|low|clear",
      "source": "Document: ${args.fileName}",
      "date": "Date if known"
    }
  ],
  "riskLevel": "high|medium|low|clear",
  "searchesPerformed": ["Document review: ${args.fileName}"]
}`,
  })

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 3000,
    temperature: 0,
    messages: [{ role: 'user', content }],
  })

  const rawText = response.content
    .filter((b) => b.type === 'text')
    .map((b) => ('text' in b ? b.text : ''))
    .join('').trim()
  const cleaned = extractJsonObject(rawText)
  const parsed = JSON.parse(cleaned)
  return { ...parsed, generatedAt: new Date().toISOString() }
}
