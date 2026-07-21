import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return new Response('clientId required', { status: 400 })

  const [analysis, client] = await Promise.all([
    (prisma as any).ttmAnalysis.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      select: { normalizedData: true, annualModel: true },
    }),
    (prisma as any).clientProfile.findUnique({ where: { id: clientId }, select: { sectionSubmissions: true } }),
  ])

  const submissions = (client?.sectionSubmissions as Record<string, any>) ?? {}
  const saved = Array.isArray(submissions.revenueBreakdown) ? submissions.revenueBreakdown : null
  const normalized = (analysis?.normalizedData as Record<string, any> | null) ?? {}
  const mappedRows = Array.isArray(normalized.mappedPlRows) ? normalized.mappedPlRows : []
  const revenueRows = mappedRows.filter((row: any) => row?.categoryType === 'revenue')
  const monthKeys = Array.from(new Set(revenueRows.flatMap((row: any) => Object.keys(row.valuesByMonth ?? {})))).sort()
  const periods = [monthKeys.slice(0, 12), monthKeys.slice(12, 24), monthKeys.slice(-12)]
  const byCategory = new Map<string, { label: string; fy1: number; fy2: number; fy3: number; ttm: number }>()
  for (const row of revenueRows) {
    const label = String(row.category || row.accountName || 'Other Revenue').trim()
    const current = byCategory.get(label) ?? { label, fy1: 0, fy2: 0, fy3: 0, ttm: 0 }
    const totals = periods.map(months => months.reduce((sum, month) => sum + Number(row.valuesByMonth?.[month] ?? 0), 0))
    current.fy1 += totals[0] ?? 0
    current.fy2 += totals[1] ?? 0
    current.fy3 += totals[2] ?? 0
    current.ttm += totals[2] ?? 0
    byCategory.set(label, current)
  }
  const derived = Array.from(byCategory.values()).filter(line => Math.abs(line.fy1) + Math.abs(line.fy2) + Math.abs(line.fy3) > 0)

  return NextResponse.json({
    rows: saved ?? derived,
    derivedRows: derived,
    source: saved ? 'client' : derived.length ? 'p&l' : null,
    hasPlData: derived.length > 0,
  })
}
