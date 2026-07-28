import { NextRequest, NextResponse } from 'next/server'
import {
  getStoredSalesLeadMondaySettings,
  saveStoredSalesLeadMondaySettings,
} from '@/lib/secure-settings'
import { normalizeSalesLeadMondayMapping } from '@/lib/sales-leads/monday-settings'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json(await getStoredSalesLeadMondaySettings())
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load Sales Lead Monday settings.' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    await saveStoredSalesLeadMondaySettings({
      boardId: String(body.boardId || ''),
      columnMapping: normalizeSalesLeadMondayMapping(body.columnMapping),
      callerMapping: body.callerMapping && typeof body.callerMapping === 'object'
        ? body.callerMapping
        : {},
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save Sales Lead Monday settings.' },
      { status: 500 },
    )
  }
}
