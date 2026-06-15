import { NextRequest, NextResponse } from 'next/server'
import {
  deleteTaxLiabilityReports,
  getLatestTaxLiabilityReport,
  saveTaxLiabilityReport,
  updateLatestTaxLiabilityReport,
} from '@/lib/tax-liability-review/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('clientId')
    if (!clientId) return new Response('Missing clientId', { status: 400 })

    const report = await getLatestTaxLiabilityReport(clientId)
    return NextResponse.json({ report })
  } catch (error) {
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

    const report = await saveTaxLiabilityReport({
      clientId,
      markdown,
      documentNames,
      metadata,
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
    const report = await updateLatestTaxLiabilityReport(clientId, { metadata, markdown })
    if (!report) return new Response('Report not found', { status: 404 })

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

    await deleteTaxLiabilityReports(clientId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[WS1-11] Report delete error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
