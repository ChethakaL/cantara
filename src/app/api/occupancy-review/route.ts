import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hasAIConfigured, requireAIClient, resolveModel } from '@/lib/ai-client'

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
  const report = submissions.occupancyReview ?? null

  return NextResponse.json({ report })
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const clientId = formData.get('clientId') as string
    const clientName = formData.get('clientName') as string
    const totalBoardingRuns = formData.get('totalBoardingRuns') as string
    const totalDaycareSpots = formData.get('totalDaycareSpots') as string
    const totalGroomingStations = formData.get('totalGroomingStations') as string
    const analysisPeriod = formData.get('analysisPeriod') as string

    if (!clientId) return new Response('Missing clientId', { status: 400 })

    const client = await prisma.clientProfile.findUnique({
      where: { id: clientId },
      select: { businessName: true, sectionSubmissions: true },
    })
    if (!client) return new Response('Client not found', { status: 404 })

    if (!(await hasAIConfigured())) return new Response('AI not configured', { status: 500 })

    // Process uploaded files
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

    // Build document context
    let documentContext = ''
    if (fileEntries.length > 0) {
      documentContext = `\n\n## Uploaded Documents\n${fileEntries.map(f => `- ${f.name} (${f.mediaType})`).join('\n')}`
    }

    // Build capacity context
    const capacityLines: string[] = []
    if (totalBoardingRuns) capacityLines.push(`- Total boarding runs/suites: ${totalBoardingRuns}`)
    if (totalDaycareSpots) capacityLines.push(`- Total daycare spots: ${totalDaycareSpots}`)
    if (totalGroomingStations) capacityLines.push(`- Total grooming stations: ${totalGroomingStations}`)
    if (analysisPeriod) capacityLines.push(`- Analysis period: ${analysisPeriod}`)
    const capacityContext = capacityLines.length > 0
      ? `\n\n## Capacity Information Provided\n${capacityLines.join('\n')}`
      : ''

    // Build Claude message content blocks
    const contentBlocks: Anthropic.ContentBlockParam[] = []

    // Add document content blocks (PDF as document, others as text)
    for (const file of fileEntries) {
      if (file.mediaType === 'application/pdf') {
        contentBlocks.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: file.base64,
          },
        } as any)
      } else {
        // For CSV/XLSX, decode and include as text
        const decoded = Buffer.from(file.base64, 'base64').toString('utf-8')
        contentBlocks.push({
          type: 'text',
          text: `--- Content from ${file.name} ---\n${decoded}\n--- End of ${file.name} ---`,
        })
      }
    }

    // Add the main analysis prompt
    contentBlocks.push({
      type: 'text',
      text: `Analyze the occupancy and capacity data for **${clientName || client.businessName}**.${capacityContext}${documentContext}

Extract exact numbers from the documents provided. Calculate monthly occupancy = occupied units / total units. Compare to pet resort industry benchmarks.

Produce a comprehensive occupancy review report with the following sections:

## 1. Capacity Overview
Total boarding runs/suites, daycare spots, grooming stations. Document the full capacity inventory.

## 2. Occupancy Rate Analysis
Monthly occupancy rates for each service line. Identify peak vs trough periods. Calculate trailing 12-month average occupancy. Present data in a table format:
| Month | Boarding Occupancy | Daycare Occupancy | Grooming Utilization |

## 3. Seasonal Demand Patterns
Holiday peaks (Thanksgiving, Christmas, Spring Break, July 4th), summer patterns, weekday vs weekend demand differences. Identify the top 5 highest-demand periods and the 5 lowest-demand periods.

## 4. Revenue per Available Unit (RevPAU)
Calculate RevPAU (like hotel RevPAR but for pet resorts): Revenue / Available Unit-Nights. Break down by boarding, daycare, and grooming. Compare month-over-month trends.

## 5. Benchmark Comparison
Compare against pet resort industry benchmarks:
- Boarding average occupancy: 65-75%
- Daycare average occupancy: 50-60%
- Grooming utilization: 70-80%
- Peak season boarding: 85-95%
Present as a table with Metric | This Business | Industry Benchmark | Variance | Assessment

## 6. Capacity Utilization Assessment
Are they under-capacity or over-capacity? Is there room for growth? Calculate unused capacity value (vacant units x average rate). Identify bottlenecks.

## 7. Pricing Optimization Opportunities
Peak pricing opportunities, package deal potential, off-peak discount strategies, dynamic pricing potential. Estimate revenue impact of each opportunity.

## 8. Recommendations
Specific, actionable recommendations to improve occupancy and revenue. Prioritize by impact and ease of implementation. Include estimated financial impact where possible.

## 9. Flag Summary
Categorize findings into:
- **Deal-Risk Flags**: Issues that could materially affect valuation or deal structure
- **Negotiation Flags**: Items that should be addressed in deal negotiations
- **Informational Flags**: Notable findings for buyer awareness

Format the entire report in clean markdown with tables, bold emphasis, and clear hierarchy. Include specific numbers and percentages from the documents wherever possible.`,
    })

    const anthropic = await requireAIClient()

    const result = await anthropic.messages.create({
      model: resolveModel('claude-sonnet-4-20250514'),
      max_tokens: 12000,
      temperature: 0.15,
      system: `You are a senior pet resort industry analyst specializing in occupancy optimization and capacity utilization for M&A due diligence at Cantara Pet Advisors.

You produce detailed, data-driven occupancy analysis reports that help buyers and sellers understand the true capacity and revenue potential of pet care businesses.

Your reports must be:
- **Data-driven**: Extract exact numbers from documents. Calculate monthly occupancy = occupied units / total units.
- **Benchmarked**: Compare against pet resort industry benchmarks (boarding avg 65-75%, daycare avg 50-60%, grooming 70-80%).
- **Quantified**: Include dollar amounts, percentages, occupancy rates, and RevPAU calculations.
- **Actionable**: Every finding should connect to a revenue optimization opportunity.
- **Beautiful formatting**: Use markdown with clear hierarchy, tables, bullet points, and bold emphasis.

Return markdown only. Do not include any preamble or meta-commentary.`,
      messages: [{ role: 'user', content: contentBlocks }],
    })

    const markdown = result.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim()

    const report = {
      clientName: clientName || client.businessName,
      generatedAt: new Date().toISOString(),
      markdown,
      inputs: {
        totalBoardingRuns: totalBoardingRuns || null,
        totalDaycareSpots: totalDaycareSpots || null,
        totalGroomingStations: totalGroomingStations || null,
        analysisPeriod: analysisPeriod || null,
        documentNames: fileEntries.map(f => f.name),
      },
    }

    // Save to sectionSubmissions.occupancyReview
    const current = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object'
      ? client.sectionSubmissions
      : {}) as Record<string, any>

    await prisma.clientProfile.update({
      where: { id: clientId },
      data: {
        sectionSubmissions: {
          ...current,
          occupancyReview: report,
        },
      },
    })

    return NextResponse.json({ report })
  } catch (error) {
    console.error('[occupancy-review] POST error:', error)
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

  const existing = current.occupancyReview
  if (!existing) {
    return new Response('Generate the occupancy review before editing.', { status: 404 })
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
        occupancyReview: report,
      },
    },
  })

  return NextResponse.json({ report })
}
