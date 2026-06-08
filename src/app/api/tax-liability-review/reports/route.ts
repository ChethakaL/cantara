import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('clientId')
    if (!clientId) return new Response('Missing clientId', { status: 400 })

    const report = await (prisma as any).taxLiabilityReport.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ report: report ?? null })
  } catch (error: any) {
    if (error?.code === 'P2021') {
      return NextResponse.json({ report: null })
    }
    console.error('[WS1-11] Report fetch error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { clientId, markdown, documentNames, metadata } = await req.json()
    if (!clientId || !markdown) {
      return new Response('Missing clientId or markdown', { status: 400 })
    }

    const report = await (prisma as any).taxLiabilityReport.create({
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
    console.error('[WS1-11] Report save error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('clientId')
    if (!clientId) return new Response('Missing clientId', { status: 400 })

    const { metadata, markdown } = await req.json()

    const latest = await (prisma as any).taxLiabilityReport.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    })

    if (!latest) return new Response('Report not found', { status: 404 })

    const report = await (prisma as any).taxLiabilityReport.update({
      where: { id: latest.id },
      data: {
        ...(metadata !== undefined ? { metadata } : {}),
        ...(typeof markdown === 'string' ? { markdown } : {}),
      },
    })

    return NextResponse.json({ report })
  } catch (error) {
    console.error('[WS1-11] Report metadata update error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('clientId')
    if (!clientId) return new Response('Missing clientId', { status: 400 })

    await (prisma as any).taxLiabilityReport.deleteMany({
      where: { clientId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[WS1-11] Report delete error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
