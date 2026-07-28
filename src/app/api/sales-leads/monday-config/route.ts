import { NextRequest, NextResponse } from 'next/server'
import { getMondayBoards, getMondayBoardColumns } from '@/lib/composio'
import {
  getStoredSalesLeadMondaySettings,
  saveStoredSalesLeadMondaySettings,
} from '@/lib/secure-settings'
import { normalizeSalesLeadMondayMapping } from '@/lib/sales-leads/monday-settings'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const stored = await getStoredSalesLeadMondaySettings()
    const requestedBoardId = req.nextUrl.searchParams.get('boardId')?.trim()
    const boardId = requestedBoardId || stored.boardId
    const [boards, columns] = await Promise.all([
      getMondayBoards().catch(err => {
        console.warn('[monday-config] getMondayBoards error:', err?.message || err)
        return []
      }),
      boardId ? getMondayBoardColumns(boardId).catch(err => {
        console.warn('[monday-config] getMondayBoardColumns error:', err?.message || err)
        return []
      }) : Promise.resolve([]),
    ])

    return NextResponse.json({
      configured: Boolean(stored.boardId && Object.keys(stored.columnMapping).length > 0),
      boardId: requestedBoardId ? requestedBoardId : stored.boardId,
      mapping: stored.columnMapping,
      callerMapping: stored.callerMapping,
      boards,
      columns,
    })
  } catch (error) {
    console.error('[sales-leads/monday-config] GET failed', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Monday configuration.' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const boardId = String(body.boardId || '').trim()
    if (!boardId) {
      return NextResponse.json({ error: 'Board ID is required.' }, { status: 400 })
    }
    await saveStoredSalesLeadMondaySettings({
      boardId,
      columnMapping: normalizeSalesLeadMondayMapping(body.mapping),
      callerMapping:
        body.callerMapping && typeof body.callerMapping === 'object'
          ? body.callerMapping
          : {},
    })
    return NextResponse.json({ success: true, boardId })
  } catch (error) {
    console.error('[sales-leads/monday-config] POST failed', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save Monday configuration.' },
      { status: 500 },
    )
  }
}
