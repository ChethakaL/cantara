import { createAgentMessage, type AgentMessageBlock } from '@/lib/llm-completion'
import {
  canRunOpenAiWebSearch,
  resolveOpenAiWebSearchModel,
  runOpenAiWebSearch,
} from '@/lib/openai-web-search'

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

type SearchSnippet = { title: string; url: string; content: string; query?: string }

async function openAiLitigationSearch(args: {
  businessName: string
  ownerName: string
  state: string
  county?: string
  city?: string
  searchQueries: string[]
}): Promise<SearchSnippet[]> {
  if (!(await canRunOpenAiWebSearch())) {
    console.warn('[Litigation Search] OPENAI_API_KEY not configured; skipping web search')
    return []
  }

  const location = [args.city, args.county ? `${args.county} County` : null, args.state]
    .filter(Boolean)
    .join(', ')

  const prompt = `You are collecting public-web evidence for an M&A litigation and lien search.

Business: "${args.businessName}"
Owner: "${args.ownerName}"
Location: ${location || args.state}

Search the public web using these queries:
${args.searchQueries.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Look for court records, lawsuits, litigation, liens, judgments, UCC filings, bankruptcy filings, and similar public records related to this business and/or owner.

Return ONLY a JSON array (max 20 items):
[
  {
    "title": "Result title",
    "url": "https://source-url",
    "content": "Key facts found (parties, case type, dates, amounts, filing details)",
    "query": "Which search query this came from"
  }
]

Rules:
- Prefer official court, secretary of state, county recorder, and reputable legal-news sources
- Include exact names, dates, case numbers, and dollar amounts when present
- Skip irrelevant marketing pages
- If little is found, return an empty array []
- Return ONLY the JSON array`

  try {
    const rawText = await runOpenAiWebSearch({
      prompt,
      model: resolveOpenAiWebSearchModel(),
      preferLowCostTool: true,
    })

    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    const snippets: SearchSnippet[] = []

    try {
      const parsed = JSON.parse(cleaned)
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (!item || typeof item !== 'object') continue
          const record = item as Record<string, unknown>
          const content = String(record.content ?? record.snippet ?? '').trim()
          if (!content) continue
          snippets.push({
            title: String(record.title ?? 'Search result'),
            url: String(record.url ?? '').trim(),
            content: content.slice(0, 4000),
            query: String(record.query ?? '').trim() || undefined,
          })
        }
      }
    } catch {
      // Fall through to prose fallback.
    }

    if (!snippets.length && rawText.trim()) {
      snippets.push({
        title: 'OpenAI web search research',
        url: '',
        content: rawText.slice(0, 4000),
      })
    }

    return snippets
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[Litigation Search] OpenAI web search failed:', message)
    return []
  }
}

async function buildLitigationPrompt(
  args: { businessName: string; ownerName: string; state: string; county?: string; city?: string },
  searchQueries: string[],
) {
  const results = await openAiLitigationSearch({ ...args, searchQueries })
  const snippets = results.map((result) => {
    const queryLine = result.query ? `Query: ${result.query}\n` : ''
    return `${queryLine}Title: ${result.title}\nURL: ${result.url}\nContent: ${result.content}`
  })

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
