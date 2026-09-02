import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAgentMessage, type AgentMessageBlock } from '@/lib/llm-completion'
import {
  assertOpenAiConfiguredForAnalyze,
  parseAnalyzeProvider,
  resolveAnalyzeModelId,
} from '@/lib/agent-analyze-provider'
import { runWithAgentLlmContext } from '@/lib/agent-llm-context'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return new Response('clientId required', { status: 400 })

  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: { sectionSubmissions: true },
  })
  if (!client) return new Response('Client not found', { status: 404 })

  const submissions = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object'
    ? client.sectionSubmissions
    : {}) as Record<string, any>
  const report = submissions.loiReview ?? null

  return NextResponse.json({ report })
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const clientId = formData.get('clientId') as string
    const clientName = formData.get('clientName') as string

    if (!clientId) return new Response('Missing clientId', { status: 400 })

    const provider = parseAnalyzeProvider(formData.get('provider'))
    const modelId = resolveAnalyzeModelId(provider, formData.get('modelId'))
    if (provider === 'openai') {
      const gate = await assertOpenAiConfiguredForAnalyze()
      if (gate) return gate
    }

    const client = await prisma.clientProfile.findUnique({
      where: { id: clientId },
      select: { businessName: true, sectionSubmissions: true },
    })
    if (!client) return new Response('Client not found', { status: 404 })

    const fileEntries: Array<{ name: string; base64: string; mediaType: string }> = []
    const files = formData.getAll('files') as File[]
    for (const file of files) {
      if (!file || typeof file === 'string') continue
      const buffer = Buffer.from(await file.arrayBuffer())
      fileEntries.push({
        name: file.name,
        base64: buffer.toString('base64'),
        mediaType: file.type || 'application/octet-stream',
      })
    }

    if (fileEntries.length === 0) {
      return new Response('At least one LOI document is required', { status: 400 })
    }

    const documentContext = `\n\n## Uploaded LOI Documents\n${fileEntries.map(f => `- ${f.name} (${f.mediaType})`).join('\n')}`

    const contentBlocks: AgentMessageBlock[] = []

    for (const file of fileEntries) {
      if (file.mediaType === 'application/pdf') {
        contentBlocks.push({
          type: 'document',
          title: file.name,
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: file.base64,
          },
        })
      } else {
        const decoded = Buffer.from(file.base64, 'base64').toString('utf-8')
        contentBlocks.push({
          type: 'text',
          text: `--- Content from ${file.name} ---\n${decoded}\n--- End of ${file.name} ---`,
        })
      }
    }

    contentBlocks.push({
      type: 'text',
      text: `Review and compare all Letters of Intent (LOIs) submitted for **${clientName || client.businessName}**.${documentContext}

Analyze each LOI across the following 10 evaluation dimensions and produce a comprehensive comparative report:

## 1. LOI Summary Table
Create a side-by-side comparison table of each LOI across ALL 10 evaluation dimensions below. Use a table format with each LOI as a column and each dimension as a row.

| Dimension | LOI 1 (Buyer Name) | LOI 2 (Buyer Name) | ... |

The 10 evaluation dimensions are:

### Dimension 1: Headline Purchase Price
Total consideration offered, structure (all-cash, stock, mix), any adjustments or deductions from headline number.

### Dimension 2: Deal Structure
Asset purchase vs stock purchase, tax implications for seller, entity structure considerations.

### Dimension 3: Net Working Capital
NWC peg/target amount, true-up mechanism (dollar-for-dollar or threshold), measurement date, definition of included/excluded items.

### Dimension 4: Earnout & Holdback Provisions
Contingent consideration terms, earnout metrics and periods, escrow amounts and release schedule, holdback percentages and conditions.

### Dimension 5: Due Diligence Requirements & Timing
Scope of due diligence, access requirements, timeline for completion, information requests, exclusions.

### Dimension 6: Financing Contingencies & Proof of Funds
Funding certainty (committed vs uncommitted financing), financing conditions, proof of funds provided, lender involvement.

### Dimension 7: Proposed Timeline to Close
Expected signing-to-closing period, key milestones, drop-dead date, extension provisions.

### Dimension 8: Closing Conditions
Material adverse change (MAC) clause scope, regulatory approvals needed, third-party consents required, employment/non-compete conditions.

### Dimension 9: Exclusivity Scope
No-shop period duration, break-up fee amount, tail provisions, fiduciary out clauses.

### Dimension 10: Buyer Type & Operational Credibility
Strategic vs financial buyer, relevant industry experience, acquisition track record, integration plans, management retention expectations.

## 2. Flag Summary
For each LOI, identify and categorize flagged terms:
- **Deal-Risk** (red): Terms that could materially harm the seller or derail the transaction
- **Negotiation** (amber): Terms that are below market or require pushback but are negotiable
- **Informational** (green): Notable terms for awareness that are within market norms

Present as a table: | LOI | Flag | Dimension | Severity | Description | Recommended Action |

## 3. Negotiation Priorities
For each LOI, provide a ranked list of items to negotiate, ordered by financial impact and risk:
1. Highest-priority items (must negotiate before advancing)
2. Medium-priority items (should negotiate, significant value at stake)
3. Lower-priority items (nice to have, minor value)

Include specific suggested counter-positions for each item.

## 4. Recommendation
Which LOI(s) should be advanced to the next stage and why. Consider:
- Total economic value (headline price + structure + earnout probability)
- Closing certainty (financing, conditions, timeline)
- Seller-friendliness of terms
- Buyer credibility and execution risk
Rank the LOIs from strongest to weakest with clear rationale.

## 5. Missing Terms
For each LOI, identify standard M&A terms that are NOT addressed:
- Representations & warranties scope
- Indemnification caps and baskets
- Non-compete/non-solicit terms
- Transition services
- Employee treatment
- IP assignment
- Confidentiality provisions
Flag any missing term that creates ambiguity or risk for the seller.

Format the entire report in clean markdown with tables, bold emphasis, and clear hierarchy. Use specific dollar amounts, percentages, and dates from the documents wherever possible.`,
    })

    const systemPrompt = `You are a senior M&A advisor specializing in reviewing and comparing Letters of Intent (LOIs) for middle-market transactions at Cantara Advisors.

You have deep expertise in deal structuring, purchase price negotiations, earnout mechanics, working capital adjustments, and closing conditions. You have reviewed hundreds of LOIs across various industries and deal sizes.

Your role is to provide the seller's advisory team with a comprehensive, objective comparison of all received LOIs so they can make an informed decision about which buyer(s) to advance into exclusivity and due diligence.

Your analysis must evaluate each LOI across these 10 evaluation dimensions:
1. **Headline Purchase Price** — total consideration, structure (cash/stock/mix)
2. **Deal Structure** — asset vs stock purchase, tax implications
3. **Net Working Capital** — NWC peg, true-up mechanisms, target amount
4. **Earnout & Holdback Provisions** — contingent consideration, escrow terms, holdback amounts
5. **Due Diligence Requirements & Timing** — scope, access requirements, timeline
6. **Financing Contingencies & Proof of Funds** — funding certainty, financing conditions
7. **Proposed Timeline to Close** — signing to closing period, key milestones
8. **Closing Conditions** — material adverse change, regulatory approvals, consents needed
9. **Exclusivity Scope** — no-shop period, break-up fees, tail provisions
10. **Buyer Type & Operational Credibility** — strategic vs financial, experience, integration plans

Your reports must be:
- **Thorough**: Every material term in each LOI must be captured and compared.
- **Balanced**: Present objective analysis — flag both favorable and unfavorable terms.
- **Actionable**: Each flag must include a recommended negotiation position.
- **Quantified**: Include specific dollar amounts, percentages, and timelines.
- **Seller-focused**: Frame analysis from the seller's perspective and interests.
- **Beautiful formatting**: Use markdown with clear hierarchy, comparison tables, bullet points, and bold emphasis.

Return markdown only. Do not include any preamble or meta-commentary.`

    const markdown = await runWithAgentLlmContext({ provider, modelId }, () =>
      createAgentMessage({
        system: systemPrompt,
        content: contentBlocks,
        maxTokens: 16000,
        temperature: 0.15,
      }),
    )

    const report = {
      clientName: clientName || client.businessName,
      generatedAt: new Date().toISOString(),
      markdown,
      inputs: {
        documentNames: fileEntries.map(f => f.name),
      },
    }

    const current = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object'
      ? client.sectionSubmissions
      : {}) as Record<string, any>

    await prisma.clientProfile.update({
      where: { id: clientId },
      data: {
        sectionSubmissions: {
          ...current,
          loiReview: report,
        },
      },
    })

    return NextResponse.json({ report })
  } catch (error) {
    console.error('[loi-review] POST error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const clientId = String(body.clientId || '')
  const markdown = typeof body.markdown === 'string' ? body.markdown : null

  if (!clientId || markdown === null) {
    return new Response('clientId and markdown required', { status: 400 })
  }

  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: { sectionSubmissions: true },
  })
  if (!client) return new Response('Client not found', { status: 404 })

  const current = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object'
    ? client.sectionSubmissions
    : {}) as Record<string, any>

  const existing = current.loiReview
  if (!existing) {
    return new Response('Generate the LOI review before editing.', { status: 404 })
  }

  const report = {
    ...existing,
    markdown,
    updatedAt: new Date().toISOString(),
  }

  await prisma.clientProfile.update({
    where: { id: clientId },
    data: {
      sectionSubmissions: {
        ...current,
        loiReview: report,
      },
    },
  })

  return NextResponse.json({ report })
}
