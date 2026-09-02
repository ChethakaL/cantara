import { createAgentMessage, type AgentMessageBlock } from '@/lib/llm-completion'

const TAVILY_API_URL = 'https://api.tavily.com/search'
const FETCH_TIMEOUT_MS = 20000

async function tavilySearch(query: string, apiKey: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(TAVILY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'advanced',
        max_results: 5,
        include_answer: false,
        include_raw_content: false,
      }),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.results ?? []).map((r: { title?: string; url?: string; content?: string }) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      content: r.content ?? '',
    }))
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

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

async function buildLitigationPrompt(
  args: { businessName: string; ownerName: string; state: string; county?: string; city?: string },
  searchQueries: string[],
) {
  const tavilyKey = process.env.TAVILY_API_KEY?.trim()
  const snippets: string[] = []

  if (tavilyKey) {
    for (const query of searchQueries) {
      const results = await tavilySearch(query, tavilyKey)
      for (const result of results) {
        snippets.push(
          `Query: ${query}\nTitle: ${result.title}\nURL: ${result.url}\nContent: ${result.content}`,
        )
      }
    }
  }

  const researchBlock = snippets.length > 0
    ? snippets.join('\n\n---\n\n')
    : 'No web search results were returned. Base your analysis only on what is explicitly supported by the provided context.'

  return `You are a litigation and lien search analyst for an M&A advisory firm. Analyze the web search results below for litigation, liens, judgments, UCC filings, or bankruptcy filings related to this business and its owner.

Business: ${args.businessName}
Owner: ${args.ownerName}
State: ${args.state}
${args.county ? `County: ${args.county}` : ''}
${args.city ? `City: ${args.city}` : ''}

Search queries executed:
${searchQueries.map((query, i) => `${i + 1}. ${query}`).join('\n')}

Web search results:
${researchBlock}

Return JSON only:

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

If nothing relevant is found in the search results, return riskLevel "clear" with an empty findings array. Return ONLY valid JSON.`
}

export async function searchPublicRecords(args: {
  businessName: string
  ownerName: string
  state: string
  county?: string
  city?: string
}): Promise<LitigationSearchResult> {
  const searchQueries = [
    `${args.businessName} ${args.ownerName} court records ${args.county ? args.county + ' County' : ''} ${args.state}`,
    `${args.businessName} UCC filing ${args.state} secretary of state`,
    `${args.businessName} ${args.ownerName} lawsuit litigation`,
    `${args.businessName} lien judgment ${args.state}`,
    `${args.ownerName} bankruptcy filing`,
  ]

  const prompt = await buildLitigationPrompt(args, searchQueries)

  const rawText = await createAgentMessage({
    system: 'You are a litigation and lien search analyst for an M&A advisory firm. Return only valid JSON.',
    content: prompt,
    maxTokens: 4000,
    temperature: 0,
  })

  const cleaned = extractJsonObject(rawText)

  try {
    const parsed = JSON.parse(cleaned)
    return {
      ...parsed,
      searchesPerformed: Array.isArray(parsed.searchesPerformed) ? parsed.searchesPerformed : searchQueries,
      generatedAt: new Date().toISOString(),
    }
  } catch {
    return {
      summary: 'Web search results were gathered, but the analysis response could not be parsed into the required report JSON.',
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
  const content: AgentMessageBlock[] = []

  if (args.mediaType === 'application/pdf') {
    content.push({
      type: 'document',
      title: args.fileName,
      source: { type: 'base64', media_type: 'application/pdf', data: args.base64 },
    })
  } else if (args.mediaType.startsWith('image/')) {
    content.push({
      type: 'image',
      source: { media_type: args.mediaType, data: args.base64 },
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

  const rawText = await createAgentMessage({
    system: 'You are a litigation and lien search analyst for an M&A advisory firm. Return only valid JSON.',
    content,
    maxTokens: 3000,
    temperature: 0,
  })

  const cleaned = extractJsonObject(rawText)
  const parsed = JSON.parse(cleaned)
  return { ...parsed, generatedAt: new Date().toISOString() }
}
