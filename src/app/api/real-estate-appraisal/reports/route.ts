import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

export async function PATCH(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('clientId')
    const reportId = req.nextUrl.searchParams.get('id')
    if (!clientId) return new Response('Missing clientId', { status: 400 })

    const { markdown } = await req.json()
    if (typeof markdown !== 'string') {
      return new Response('markdown required', { status: 400 })
    }

    const target = reportId
      ? await prisma.realEstateAppraisalReport.findFirst({ where: { id: reportId, clientId } })
      : await prisma.realEstateAppraisalReport.findFirst({
          where: { clientId },
          orderBy: { createdAt: 'desc' },
        })

    if (!target) return new Response('Report not found', { status: 404 })

    const report = await prisma.realEstateAppraisalReport.update({
      where: { id: target.id },
      data: { markdown },
    })

    return NextResponse.json({ report })
  } catch (error) {
    console.error('[real-estate-appraisal/reports] PATCH', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('clientId')
    const reportId = req.nextUrl.searchParams.get('id')
    if (!clientId) return new Response('Missing clientId', { status: 400 })

    const target = reportId
      ? await prisma.realEstateAppraisalReport.findFirst({ where: { id: reportId, clientId } })
      : await prisma.realEstateAppraisalReport.findFirst({
          where: { clientId },
          orderBy: { createdAt: 'desc' },
        })

    if (!target) return new Response('Report not found', { status: 404 })

    await prisma.realEstateAppraisalReport.delete({
      where: { id: target.id },
    })

    return NextResponse.json({ success: true, deletedId: target.id })
  } catch (error) {
    console.error('[real-estate-appraisal/reports] DELETE', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

