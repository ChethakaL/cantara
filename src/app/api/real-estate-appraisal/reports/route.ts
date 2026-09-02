import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return new Response('clientId required', { status: 400 })
  try {
    const reports = await prisma.realEstateAppraisalReport.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ report: reports[0] ?? null, reports })
  } catch (error) {
    console.error('[real-estate-appraisal/reports]', error)
    return NextResponse.json({ report: null, reports: [] })
  }
}
