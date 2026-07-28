import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAIClient, resolveModel } from '@/lib/ai-client'
import { updateSalesLeadFields } from '@/lib/sales-leads/service'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const lead = await prisma.salesLead.findUnique({
      where: { id: params.id },
    })

    if (!lead) {
      return NextResponse.json({ error: 'Sales lead not found' }, { status: 404 })
    }

    const ai = await getAIClient()
    if (!ai) {
      return NextResponse.json(
        { error: 'AI provider is not configured. Set ANTHROPIC_API_KEY or AWS Bedrock credentials.' },
        { status: 500 },
      )
    }

    const prompt = `You are an expert commercial real estate and M&A research analyst conducting deep background research on a pet resort business.

Business Name: "${lead.businessName}"
City: "${lead.city || 'Unknown'}"
State: "${lead.state || 'Unknown'}"
Website: "${lead.websiteUrl || 'N/A'}"
Owner Name: "${[lead.ownerFirstName, lead.ownerLastName].filter(Boolean).join(' ') || 'Unknown'}"
Indoor SqFt: ${lead.sqftIndoor || 'N/A'}, Outdoor SqFt: ${lead.sqftOutdoor || 'N/A'}, Combined SqFt: ${lead.sqftCombined || 'N/A'}
Google Rating: ${lead.googleRating || 'N/A'} (${lead.reviewCount || 'N/A'} reviews)

Conduct a structured research analysis answering the following 4 core intelligence questions:

1. What year did the business start / open?
2. How long have the current owners owned the business?
3. Has the business been sold previously (prior sale history)?
4. Rate the resort as Tier 1, Tier 2, or Tier 3 based on facility scale, review volume, and business profile:
   - Tier 1: Premier / Large-scale resort (>15k sqft or high revenue / 300+ reviews)
   - Tier 2: Mid-scale established pet resort (7k-15k sqft or 100-300 reviews)
   - Tier 3: Boutique / Smaller local boarding operation (<7k sqft or <100 reviews)

Format your response strictly as valid JSON with no markdown wrapping:
{
  "yearStarted": "e.g. 2012 (14 years in operation)",
  "ownershipTenure": "e.g. Owned by current owner since 2016 (10 years)",
  "priorSaleHistory": "e.g. Acquired in 2016 from founding owner; no prior corporate sales recorded.",
  "tierRating": "Tier 1 | Tier 2 | Tier 3",
  "tierReasoning": "Brief 1-sentence justification for the tier rating",
  "businessProfileSummary": "Concise 2-3 sentence executive profile of facility amenities, market standing, and acquisition signals."
}`

    const modelName = resolveModel('claude-sonnet-4-20250514')
    
    // Call AI client
    const response = await ai.messages.create({
      model: modelName,
      max_tokens: 1000,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    })

    const inputTokens = response.usage?.input_tokens ?? 0
    const outputTokens = response.usage?.output_tokens ?? 0
    // Estimate cost: $3 per M input, $15 per M output
    const estimatedCostUsd = Number(
      ((inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15).toFixed(5),
    )

    // Log token usage and cost for developer console tracking (NOT exposed to end user)
    console.log(
      `[AI Prospect Research] Lead: "${lead.businessName}" | Model: ${modelName} | Input Tokens: ${inputTokens} | Output Tokens: ${outputTokens} | Est. Cost: $${estimatedCostUsd}`,
    )

    const rawText = response.content[0]?.type === 'text' ? response.content[0].text : ''
    let jsonContent: any = null
    try {
      jsonContent = JSON.parse(rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim())
    } catch {
      jsonContent = {
        yearStarted: 'Not specified',
        ownershipTenure: 'Not specified',
        priorSaleHistory: 'No public sale records found',
        tierRating: lead.sqftCombined && lead.sqftCombined >= 15000 ? 'Tier 1' : 'Tier 2',
        tierReasoning: 'Based on location capacity and Google review profile.',
        businessProfileSummary: rawText.slice(0, 300),
      }
    }

    // Save structured report directly to database JSON field
    const cleanedNotes = (lead.notes || '')
      .replace(/<!-- AI_RESEARCH_JSON:[\s\S]*?-->/g, '')
      .replace(/\[AI Research Report\][\s\S]*?(?=\n\n|\n[^\n•]|$)/g, '')
      .trim()

    await prisma.salesLead.update({
      where: { id: lead.id },
      data: {
        aiResearchReport: jsonContent,
        notes: cleanedNotes || null,
      },
    })

    return NextResponse.json({
      success: true,
      report: jsonContent,
    })
  } catch (error: any) {
    console.error('[sales-leads/enrich] Error:', error)
    return NextResponse.json(
      { error: error.message || 'AI Prospect Research failed' },
      { status: 500 },
    )
  }
}
