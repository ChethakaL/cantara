import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hasAIConfigured, requireAIClient, resolveModel } from '@/lib/ai-client'

export const dynamic = 'force-dynamic'

function computeOccupancyMetrics(
  monthlyData: Array<{month: string; boardingDogs: number; daycareDogs: number}>,
  capacityModel: { totalDailyCapacity?: number; boardingRuns?: number; daycareSpots?: number }
) {
  const totalCapacity = capacityModel.totalDailyCapacity ??
    ((capacityModel.boardingRuns ?? 0) + (capacityModel.daycareSpots ?? 0))

  const monthlyTotals = monthlyData.map(m => {
    const total = m.boardingDogs + m.daycareDogs
    return {
      month: m.month,
      boardingDogs: m.boardingDogs,
      daycareDogs: m.daycareDogs,
      total,
      utilization: totalCapacity > 0 ? +(total / totalCapacity * 100).toFixed(1) : 0,
      boardingMix: total > 0 ? +(m.boardingDogs / total * 100).toFixed(1) : 0,
      daycareMix: total > 0 ? +(m.daycareDogs / total * 100).toFixed(1) : 0,
    }
  })

  const sorted = [...monthlyTotals].sort((a, b) => b.utilization - a.utilization)
  const peakMonths = sorted.slice(0, 3).map(m => m.month)
  const troughMonths = sorted.slice(-3).reverse().map(m => m.month)
  const avgUtilization = monthlyTotals.length > 0
    ? +(monthlyTotals.reduce((s, m) => s + m.utilization, 0) / monthlyTotals.length).toFixed(1)
    : 0
  const resolvedDaycareSpots = capacityModel.daycareSpots ??
    (capacityModel.totalDailyCapacity && capacityModel.boardingRuns
      ? capacityModel.totalDailyCapacity - capacityModel.boardingRuns
      : 0)
  const daycareDisplacementPct = totalCapacity > 0
    ? +(resolvedDaycareSpots / totalCapacity * 100).toFixed(1)
    : 0

  return { monthlyTotals, peakMonths, troughMonths, avgUtilization, daycareDisplacementPct, totalCapacity }
}
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
  const inputs = submissions.occupancyReviewInputs ?? null

  return NextResponse.json({ report, inputs })
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const clientId = formData.get('clientId') as string
    const clientName = formData.get('clientName') as string
    // Legacy fields (backwards compat)
    const totalBoardingRuns = formData.get('totalBoardingRuns') as string
    const totalDaycareSpots = formData.get('totalDaycareSpots') as string
    const totalGroomingStations = formData.get('totalGroomingStations') as string
    const analysisPeriod = formData.get('analysisPeriod') as string
    // New capacity model fields
    const totalDailyCapacityStr = formData.get('totalDailyCapacity') as string
    const boardingRunsStr = formData.get('boardingRuns') as string
    const daycareSpotsStr = formData.get('daycareSpots') as string
    const groomingStationsStr = formData.get('groomingStations') as string
    const monthlyDataStr = formData.get('monthlyData') as string

    // Parse numeric capacity fields
    const totalDailyCapacityNum = totalDailyCapacityStr ? parseInt(totalDailyCapacityStr) : 0
    const boardingRunsNum = boardingRunsStr ? parseInt(boardingRunsStr) : 0
    const daycareSpotsNum = daycareSpotsStr ? parseInt(daycareSpotsStr) : 0
    const groomingStationsNum = groomingStationsStr ? parseInt(groomingStationsStr) : 0

    // Parse monthly data
    const parsedMonthlyData = monthlyDataStr ? JSON.parse(monthlyDataStr) as Array<{month: string; boardingDogs: number; daycareDogs: number}> : []

    // Build capacity model
    const capacityModel = {
      totalDailyCapacity: totalDailyCapacityNum || undefined,
      boardingRuns: boardingRunsNum || undefined,
      daycareSpots: daycareSpotsNum || undefined,
      groomingStations: groomingStationsNum || undefined,
    }

    // Compute metrics
    const computed = parsedMonthlyData.length > 0 ? computeOccupancyMetrics(parsedMonthlyData, capacityModel) : null

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
      text: `Generate a buyer-facing occupancy analysis report for **${clientName || client.businessName}**.

${computed ? `
Capacity Model:
- Total Daily Capacity: ${computed.totalCapacity} dogs
${capacityModel.boardingRuns ? `- Boarding Runs: ${capacityModel.boardingRuns}` : ''}
${capacityModel.daycareSpots != null ? `- Daycare Spots: ${capacityModel.daycareSpots}` : (capacityModel.totalDailyCapacity && capacityModel.boardingRuns ? `- Daycare Spots (residual): ${computed.totalCapacity - capacityModel.boardingRuns}` : '')}

24-Month Data Summary:
- Average Utilization: ${computed.avgUtilization}%
- Peak Months: ${computed.peakMonths.join(', ')}
- Trough Months: ${computed.troughMonths.join(', ')}
- Daycare Displacement: ${computed.daycareDisplacementPct}%

Full Monthly Data:
${computed.monthlyTotals.map(m => `${m.month}: Boarding ${m.boardingDogs}, Daycare ${m.daycareDogs}, Total ${m.total}, Utilization ${m.utilization}%`).join('\n')}
` : `Capacity inputs: ${capacityLines.join(', ')}`}

Generate the report in EXACTLY this order with EXACTLY these section headings:

## 1. Methodology Note
Explain how the capacity utilization model was built. Reference the owner-stated total capacity. Explain: utilization = total dogs (boarding + daycare combined) / total daily capacity per day.

## 2. Capacity Model Note
Detail the specific capacity figures used: total daily capacity, boarding runs, daycare spots (note if daycare = residual capacity Total − Boarding Runs, or if stated directly). Include grooming stations if provided.

## 3. Combined Capacity Utilization — 24-Month Trend
Present the full monthly data in a formatted table:
| Month | Boarding Dogs | Daycare Dogs | Total Dogs | Utilization % | Boarding Mix | Daycare Mix |

Summarize: peak months, trough months, average utilization, and notable patterns.

## 4. Trade-off Commentary
Analyze the boarding vs daycare trade-off. Daycare displacement percentage is ${computed?.daycareDisplacementPct ?? 'N/A'}% — discuss whether current service mix optimizes total revenue. Examine if a boarding-heavy night displacing a daycare slot is revenue-positive or negative based on typical pricing.

## 5. Growth Headroom Implication
For a prospective buyer: at average utilization of ${computed?.avgUtilization ?? 'N/A'}%, how many additional dogs per day represent upside? What does trough-month capacity imply about growth potential? Provide specific numbers and implications for deal valuation.

Return markdown only. No preamble.`,
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
      capacityModel,
      monthlyData: parsedMonthlyData,
      computed,
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
