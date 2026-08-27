import { executeMondayGraphqlDirect } from '@/lib/composio/monday-api'
import { getMondayBoardColumns } from '@/lib/composio/monday-columns'
import { updateMondayBoardItem } from '@/lib/composio/monday-items'

export type MondayColumnValue = {
  id: string
  text?: string
  value?: string
  type?: string
  title?: string
}

export type MondayBoardColumn = { id: string; title: string }

export type MondayItem = {
  id: string
  name: string
  column_values: MondayColumnValue[]
}

/** Read display text from a Monday column_value by title hints. */
export function columnTextByTitle(columns: MondayColumnValue[], titles: string[]) {
  const wanted = titles.map(t => t.toLowerCase())
  for (const col of columns) {
    const title = String(col.title || '').toLowerCase()
    if (!wanted.some(w => title === w || title.includes(w))) continue
    const text = String(col.text || '').trim()
    if (text) return text
    if (col.value) {
      try {
        const parsed = JSON.parse(String(col.value))
        if (parsed?.label) return String(parsed.label)
        if (parsed?.email) return String(parsed.email)
        if (parsed?.text) return String(parsed.text)
      } catch {
        /* ignore */
      }
    }
  }
  return null
}

export function resolveColumnId(
  boardColumns: MondayBoardColumn[],
  configuredId: string | null,
  titleHints: string[]
) {
  if (configuredId) return configuredId
  const hints = titleHints.map(h => h.toLowerCase())
  const match = boardColumns.find(c =>
    hints.some(h => c.title.toLowerCase() === h || c.title.toLowerCase().includes(h))
  )
  return match?.id || null
}

export async function listMondayBoardColumns(boardId: string): Promise<MondayBoardColumn[]> {
  try {
    const cols = await getMondayBoardColumns(boardId)
    return (cols || []).map((c: any) => ({
      id: String(c.id),
      title: String(c.title || c.name || ''),
    }))
  } catch {
    return []
  }
}

export async function fetchMondayItemById(itemId: string): Promise<MondayItem | null> {
  const result = await executeMondayGraphqlDirect({
    query: `
      query ($ids: [ID!]!) {
        items (ids: $ids) {
          id
          name
          column_values { id text value type }
        }
      }
    `,
    variables: { ids: [itemId] },
  })

  const item = (result as any)?.data?.items?.[0]
  if (!item) return null

  return {
    id: String(item.id),
    name: String(item.name || ''),
    column_values: (item.column_values || []) as MondayColumnValue[],
  }
}

function enrichWithTitles(columnValues: MondayColumnValue[], boardColumns: MondayBoardColumn[]) {
  const byId = new Map(boardColumns.map(c => [c.id, c.title]))
  return columnValues.map(cv => ({
    ...cv,
    title: cv.title || byId.get(String(cv.id)) || '',
  }))
}

/** Load a Monday item and attach column titles from the board. */
export async function loadMondayDealItem(boardId: string, itemId: string) {
  const item = await fetchMondayItemById(itemId)
  if (!item) return null
  const boardColumns = await listMondayBoardColumns(boardId)
  const columnValues = enrichWithTitles(item.column_values || [], boardColumns)
  return { item, boardColumns, columnValues }
}

/**
 * Gate Monday writes behind dry-run / updateMonday flags.
 * Returns a writer that records what it would / did update.
 */
export function createMondayUpdateGate(args: {
  boardId: string
  itemId: string
  dryRun: boolean
  updateMonday: boolean
  updateMondayEnvKey: string
  log: string[]
}) {
  return async function maybeUpdateMonday(
    columnValues: Record<string, unknown>,
    label: string
  ) {
    if (!args.updateMonday && args.dryRun) {
      args.log.push(`dry-run skip Monday: ${label}`)
      return
    }
    if (!args.updateMonday && !args.dryRun) {
      args.log.push(`skip Monday (${args.updateMondayEnvKey}=false): ${label}`)
      return
    }
    await updateMondayBoardItem({
      boardId: args.boardId,
      itemId: args.itemId,
      columnValues,
    })
    args.log.push(label)
  }
}

/** Search a board for the first item whose column equals value (Make "Search records"). */
export async function findMondayItemByColumnValue(args: {
  boardId: string
  columnId: string
  value: string
}): Promise<string | null> {
  try {
    const result = await executeMondayGraphqlDirect({
      query: `
        query ($boardId: ID!, $columnId: String!, $value: String!) {
          items_page_by_column_values (
            board_id: $boardId
            columns: [{ column_id: $columnId, column_values: [$value] }]
            limit: 5
          ) {
            items { id name }
          }
        }
      `,
      variables: {
        boardId: args.boardId,
        columnId: args.columnId,
        value: args.value,
      },
    })
    const items = (result as any)?.data?.items_page_by_column_values?.items || []
    if (Array.isArray(items) && items[0]?.id) return String(items[0].id)
  } catch (e) {
    console.warn('[monday-deal] items_page_by_column_values failed', e)
  }
  return null
}
