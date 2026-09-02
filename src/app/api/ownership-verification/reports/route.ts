import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET — load the saved WS1-8 report for a client
export async function GET(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('clientId')
    if (!clientId) return new Response('Missing clientId', { status: 400 })

    const reports = await (prisma as any).ownershipVerificationReport.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ report: reports[0] ?? null, reports })
  } catch (error: any) {
    // Gracefully handle missing table (model exists in schema but migration not run)
    if (error?.code === 'P2021') {
      return NextResponse.json({ report: null })
    }
    console.error('[WS1-8] Report fetch error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

// POST — save a completed WS1-8 report
export async function POST(req: NextRequest) {
  try {
    const { clientId, markdown, documentNames, metadata, aiProvider, aiModel } = await req.json()
    if (!clientId || !markdown) {
      return new Response('Missing clientId or markdown', { status: 400 })
    }

    const report = await (prisma as any).ownershipVerificationReport.create({
      data: {
        clientId,
        markdown,
        documentNames: documentNames ?? [],
        metadata: metadata ?? undefined,
        aiProvider: aiProvider || 'bedrock',
        aiModel: aiModel || null,
        createdAt: new Date(),
      },
    })

    return NextResponse.json({ report })
  } catch (error) {
    console.error('[WS1-8] Report save error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

// PATCH — persist admin review metadata and/or edited final markdown for the latest report
export async function PATCH(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('clientId')
    const reportId = req.nextUrl.searchParams.get('id')
    if (!clientId) return new Response('Missing clientId', { status: 400 })

    const { metadata, markdown } = await req.json()

    const target = reportId
      ? await (prisma as any).ownershipVerificationReport.findFirst({ where: { id: reportId, clientId } })
      : await (prisma as any).ownershipVerificationReport.findFirst({
          where: { clientId },
          orderBy: { createdAt: 'desc' },
        })

    if (!target) return new Response('Report not found', { status: 404 })

    const report = await (prisma as any).ownershipVerificationReport.update({
      where: { id: target.id },
      data: {
        ...(metadata !== undefined ? { metadata } : {}),
        ...(typeof markdown === 'string' ? { markdown } : {}),
      },
    })

    return NextResponse.json({ report })
  } catch (error) {
    console.error('[WS1-8] Report metadata update error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

// DELETE — reset all WS1-8 reports for a client
export async function DELETE(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('clientId')
    if (!clientId) return new Response('Missing clientId', { status: 400 })

    await (prisma as any).ownershipVerificationReport.deleteMany({
      where: { clientId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[WS1-8] Report delete error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
