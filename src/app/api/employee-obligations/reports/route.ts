import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET — load the saved WS1-6 report for a client
export async function GET(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('clientId')
    if (!clientId) return new Response('Missing clientId', { status: 400 })

    const report = await (prisma as any).employeeObligationsReport.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ report: report ?? null })
  } catch (error) {
    console.error('[WS1-6] Report fetch error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

// POST — save a completed WS1-6 report
export async function POST(req: NextRequest) {
  try {
    const { clientId, markdown, documentNames, metadata } = await req.json()
    if (!clientId || !markdown) {
      return new Response('Missing clientId or markdown', { status: 400 })
    }

    const report = await (prisma as any).employeeObligationsReport.create({
      data: {
        clientId,
        markdown,
        documentNames: documentNames ?? [],
        metadata: metadata ?? undefined,
        createdAt: new Date(),
      },
    })

    return NextResponse.json({ report })
  } catch (error) {
    console.error('[WS1-6] Report save error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

// PATCH — persist admin review / release metadata for the latest report
export async function PATCH(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('clientId')
    if (!clientId) return new Response('Missing clientId', { status: 400 })

    const { metadata } = await req.json()

    const latest = await (prisma as any).employeeObligationsReport.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    })

    if (!latest) return new Response('Report not found', { status: 404 })

    const report = await (prisma as any).employeeObligationsReport.update({
      where: { id: latest.id },
      data: {
        metadata: metadata ?? undefined,
      },
    })

    return NextResponse.json({ report })
  } catch (error) {
    console.error('[WS1-6] Report metadata update error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

// DELETE — reset all WS1-6 reports for a client
export async function DELETE(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('clientId')
    if (!clientId) return new Response('Missing clientId', { status: 400 })

    await (prisma as any).employeeObligationsReport.deleteMany({
      where: { clientId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[WS1-6] Report delete error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
