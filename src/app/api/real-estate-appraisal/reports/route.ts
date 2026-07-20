import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return new Response('clientId required', { status: 400 })
  try {
    const report = await prisma.realEstateAppraisalReport.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(report)
  } catch (error) {
    console.error('[real-estate-appraisal/reports]', error)
    return NextResponse.json(null)
  }
}
