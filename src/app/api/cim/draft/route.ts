import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId')
  if (!clientId) return new Response('clientId required', { status: 400 })

  try {
    const model = (prisma as any).cimReport || (prisma as any).CimReport
    if (!model) throw new Error('CimReport model not found in Prisma client')
    
    const draft = await model.findUnique({
      where: { clientId }
    })
    return NextResponse.json({ draft: draft?.data || null })
  } catch (error: any) {
    console.error('CIM draft fetch error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { clientId, data } = await req.json()
    if (!clientId) return new Response('clientId required', { status: 400 })

    const model = (prisma as any).cimReport || (prisma as any).CimReport
    if (!model) throw new Error('CimReport model not found in Prisma client')

    await model.upsert({
      where: { clientId },
      update: {
        data,
        updatedAt: new Date()
      },
      create: {
        clientId,
        data
      }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('CIM draft save error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
