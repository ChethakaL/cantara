import { createAgentMessage, type AgentMessageBlock } from '@/lib/llm-completion'
import { createChecklistItem, type SaleReadinessChecklistItem } from '@/lib/sale-readiness-checklist'

export type ChecklistDelta = {
  update: Array<Pick<SaleReadinessChecklistItem, 'id' | 'category' | 'item' | 'status' | 'actionNeeded'>>
  add: Array<Pick<SaleReadinessChecklistItem, 'category' | 'item' | 'status' | 'actionNeeded'>>
  remove: string[]
}

export type ChecklistContentChange = {
  updated: Array<{ before: SaleReadinessChecklistItem; after: SaleReadinessChecklistItem }>
  added: SaleReadinessChecklistItem[]
  removed: SaleReadinessChecklistItem[]
}

const EMPTY_DELTA: ChecklistDelta = { update: [], add: [], remove: [] }

function parseJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim()
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed)
  const body = fence ? fence[1] : trimmed
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('Model did not return JSON.')
  return JSON.parse(body.slice(start, end + 1)) as Record<string, unknown>
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function sanitizeChecklistDelta(raw: unknown, existingIds: Set<string>): ChecklistDelta {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const update = Array.isArray(source.update) ? source.update : []
  const add = Array.isArray(source.add) ? source.add : []
  const remove = Array.isArray(source.remove) ? source.remove : []
  const seen = new Set<string>()

  return {
    update: update.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return []
      const row = entry as Record<string, unknown>
      const id = asText(row.id)
      if (!id || !existingIds.has(id) || seen.has(id)) return []
      seen.add(id)
      const category = asText(row.category)
      const item = asText(row.item)
      if (!category || !item) return []
      return [{
        id,
        category,
        item,
        status: asText(row.status) || '🟡 YELLOW',
        actionNeeded: asText(row.actionNeeded),
      }]
    }),
    add: add.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return []
      const row = entry as Record<string, unknown>
      const category = asText(row.category)
      const item = asText(row.item)
      if (!category || !item) return []
      return [{
        category,
        item,
        status: asText(row.status) || '🟡 YELLOW',
        actionNeeded: asText(row.actionNeeded),
      }]
    }),
    remove: remove
      .map((id) => asText(id))
      .filter((id) => id && existingIds.has(id) && !seen.has(id)),
  }
}

/** Apply a model delta. Untouched items keep their text and approval/completion. */
export function mergeChecklistDelta(
  existing: SaleReadinessChecklistItem[],
  delta: ChecklistDelta,
): SaleReadinessChecklistItem[] {
  const existingIds = new Set(existing.map((item) => item.id))
  const safe = sanitizeChecklistDelta(delta, existingIds)
  const remove = new Set(safe.remove)
  const updates = new Map(safe.update.map((item) => [item.id, item]))

  const kept = existing
    .filter((item) => !remove.has(item.id))
    .map((item) => {
      const next = updates.get(item.id)
      if (!next) return item
      return {
        ...item,
        category: next.category,
        item: next.item,
        status: next.status,
        actionNeeded: next.actionNeeded,
      }
    })

  const added = safe.add.map((item) => createChecklistItem(item))
  return [...kept, ...added]
}

function contentKey(item: SaleReadinessChecklistItem) {
  return [item.category, item.item, item.status, item.actionNeeded].map((part) => part.trim()).join('\n')
}

export function diffChecklist(
  before: SaleReadinessChecklistItem[],
  after: SaleReadinessChecklistItem[],
): ChecklistContentChange {
  const afterById = new Map(after.map((item) => [item.id, item]))
  const beforeIds = new Set(before.map((item) => item.id))
  const updated: ChecklistContentChange['updated'] = []
  const removed: SaleReadinessChecklistItem[] = []
  for (const item of before) {
    const next = afterById.get(item.id)
    if (!next) removed.push(item)
    else if (contentKey(item) !== contentKey(next)) updated.push({ before: item, after: next })
  }
  return {
    updated,
    removed,
    added: after.filter((item) => !beforeIds.has(item.id)),
  }
}

export function checklistDeltaIsEmpty(change: ChecklistContentChange) {
  return change.updated.length === 0 && change.added.length === 0 && change.removed.length === 0
}

function markdownTableCells(line: string) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((cell) => cell.trim())
}

function escapeCell(value: string) {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function checklistRow(headers: string[], item: SaleReadinessChecklistItem) {
  const cells = headers.map((header) => {
    if (header === 'category') return escapeCell(item.category)
    if (header === 'item' || header === 'actionitem') return escapeCell(item.item)
    if (header === 'status') return escapeCell(item.status)
    if (header === 'actionneeded' || header === 'action') return escapeCell(item.actionNeeded)
    if (header === '' || header === 'check' || header === 'done') return '☐'
    return ''
  })
  return `| ${cells.join(' | ')} |`
}

function rowIdentity(cells: string[], categoryColumn: number, itemColumn: number) {
  const clean = (value: string) => value.replace(/\*\*/g, '').replace(/__/g, '').replace(/^☐\s*/, '').replace(/^☑\s*/, '').trim().toLowerCase()
  return `${clean(cells[categoryColumn] ?? '')}|${clean(cells[itemColumn] ?? '')}`
}

/** Replace only checklist-table rows for items that were added, edited, or removed. */
export function patchChecklistTable(markdown: string, change: ChecklistContentChange): string {
  if (!markdown.trim() || checklistDeltaIsEmpty(change)) return markdown
  const lines = markdown.split('\n')
  for (let heading = 0; heading < lines.length; heading += 1) {
    if (!/^##\s+sale[- ]readiness checklist\s*$/i.test(lines[heading].trim())) continue
    let header = heading + 1
    while (header < lines.length && !lines[header].trim().startsWith('|')) header += 1
    if (header + 1 >= lines.length || !/^\|[\s\-:|]+\|$/.test(lines[header + 1].trim())) continue
    const headers = markdownTableCells(lines[header]).map((value) => value.toLowerCase().replace(/[^a-z]/g, ''))
    const categoryColumn = headers.findIndex((value) => value === 'category')
    const itemColumn = headers.findIndex((value) => value === 'item' || value === 'actionitem')
    if (categoryColumn < 0 || itemColumn < 0) continue
    let end = header + 2
    while (end < lines.length && lines[end].trim().startsWith('|') && !/^\|[\s\-:|]+\|$/.test(lines[end].trim())) end += 1

    const beforeKey = (item: SaleReadinessChecklistItem) => `${item.category.trim().toLowerCase()}|${item.item.trim().toLowerCase()}`
    const updates = new Map(change.updated.map((entry) => [beforeKey(entry.before), entry.after]))
    const removals = new Set(change.removed.map(beforeKey))
    const nextRows: string[] = []
    for (const line of lines.slice(header + 2, end)) {
      const cells = markdownTableCells(line)
      const key = rowIdentity(cells, categoryColumn, itemColumn)
      if (removals.has(key)) continue
      const updated = updates.get(key)
      nextRows.push(updated ? checklistRow(headers, updated) : line)
    }
    for (const item of change.added) nextRows.push(checklistRow(headers, item))
    lines.splice(header + 2, end - (header + 2), ...nextRows)
    return lines.join('\n')
  }
  return markdown
}

function normalizeMatch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function findItemBlockRange(lines: string[], category: string, item: string): { start: number; end: number } | null {
  const itemNorm = normalizeMatch(item)
  const categoryNorm = normalizeMatch(category)
  if (itemNorm.length < 4) return null
  let start = -1
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (!/^\s*(\*\*|###\s+)/.test(line)) continue
    const lineNorm = normalizeMatch(line)
    if (lineNorm.includes(itemNorm) && (categoryNorm.length < 3 || lineNorm.includes(categoryNorm) || itemNorm.length >= 12)) {
      start = index
      break
    }
  }
  if (start < 0) return null
  let end = lines.length
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index]) || /^\s*\*\*[^*].+\*\*/.test(lines[index]) || /^###\s+/.test(lines[index])) {
      end = index
      break
    }
  }
  return { start, end }
}

function sectionHeading(item: SaleReadinessChecklistItem) {
  const status = item.status.toLowerCase()
  if (status.includes('red') || item.status.includes('🔴')) return '## Red Flag Action Items'
  if (status.includes('yellow') || item.status.includes('🟡')) return '## Yellow Flag Action Items'
  return null
}

function insertBlock(markdown: string, heading: string, block: string): string {
  const lines = markdown.split('\n')
  const index = lines.findIndex((line) => line.trim().toLowerCase() === heading.toLowerCase())
  if (index < 0) return `${markdown.trim()}\n\n${heading}\n\n${block.trim()}\n`
  let insertAt = index + 1
  while (insertAt < lines.length && lines[insertAt].trim() && !lines[insertAt].trim().startsWith('|') && !/^\*\*/.test(lines[insertAt].trim()) && !/^###\s+/.test(lines[insertAt])) {
    insertAt += 1
  }
  lines.splice(insertAt, 0, '', block.trim(), '')
  return lines.join('\n')
}

export function spliceNarrativeBlock(
  markdown: string,
  before: Pick<SaleReadinessChecklistItem, 'category' | 'item'>,
  replacement: string | null,
  insertNear?: SaleReadinessChecklistItem,
): string {
  const lines = markdown.split('\n')
  const range = findItemBlockRange(lines, before.category, before.item)
  if (range) {
    const next = replacement?.trim() ? [replacement.trim(), ''] : []
    lines.splice(range.start, range.end - range.start, ...next)
    return lines.join('\n')
  }
  if (!replacement?.trim() || !insertNear) return markdown
  const heading = sectionHeading(insertNear)
  return heading ? insertBlock(markdown, heading, replacement) : markdown
}

type NarrativeRewrite = {
  id: string
  markdown: string
}

export async function proposeChecklistDelta(args: {
  items: SaleReadinessChecklistItem[]
  changedAgents: Array<{ agentName: string; excerpt: string }>
  removedAgentNames: string[]
  externalNote?: string
  blocks?: AgentMessageBlock[]
}): Promise<ChecklistDelta> {
  if (!args.changedAgents.length && !args.removedAgentNames.length) return EMPTY_DELTA
  const items = args.items.map((item) => ({
    id: item.id,
    category: item.category,
    item: item.item,
    status: item.status,
    actionNeeded: item.actionNeeded,
  }))
  const agentBlock = args.changedAgents.map((agent) => `### ${agent.agentName}\n${agent.excerpt.slice(0, 8000)}`).join('\n\n')
  const text = await createAgentMessage({
    system: 'You update an existing sale-readiness checklist. Return JSON only. Do not rewrite the checklist.',
    content: [
      ...(args.blocks ?? []),
      { type: 'text', text: `Update ONLY checklist items that are clearly about the changed agents below. Leave every other item out of the JSON.

Changed agents and their latest outputs:
${agentBlock || '_None._'}

Agents removed from this roadmap (remove only items that exist solely because of these agents):
${args.removedAgentNames.length ? args.removedAgentNames.join(', ') : '_None._'}

${args.externalNote || ''}

Current checklist:
${JSON.stringify(items)}

Return JSON:
{
  "update": [{ "id": "existing id", "category": "", "item": "", "status": "🟢 GREEN | 🟡 YELLOW | 🔴 RED", "actionNeeded": "" }],
  "add": [{ "category": "", "item": "", "status": "🟢 GREEN | 🟡 YELLOW | 🔴 RED", "actionNeeded": "" }],
  "remove": ["existing id"]
}

Rules:
- update.id and remove ids MUST be copied from the current checklist.
- If an item is not about a changed or removed agent, do not include it.
- Advisor wording on unrelated items must not be repeated or revised.
- Items about a changed agent may be rewritten to match that agent's latest output.
- If nothing should change, return {"update":[],"add":[],"remove":[]}.` },
    ],
    maxTokens: 6000,
    temperature: 0,
  })
  const existingIds = new Set(args.items.map((item) => item.id))
  return sanitizeChecklistDelta(parseJsonObject(text), existingIds)
}

export async function rewriteChangedNarrative(args: {
  markdown: string
  change: ChecklistContentChange
}): Promise<string> {
  let markdown = patchChecklistTable(args.markdown, args.change)
  const targets = [
    ...args.change.updated.map((entry) => ({ kind: 'update' as const, before: entry.before, after: entry.after })),
    ...args.change.added.map((item) => ({ kind: 'add' as const, before: item, after: item })),
    ...args.change.removed.map((item) => ({ kind: 'remove' as const, before: item, after: item })),
  ]
  if (!targets.length) return markdown

  const excerpts = targets.map((target) => {
    const lines = markdown.split('\n')
    const range = findItemBlockRange(lines, target.before.category, target.before.item)
    return {
      id: target.after.id,
      kind: target.kind,
      before: target.before,
      after: target.after,
      currentBlock: range ? lines.slice(range.start, range.end).join('\n') : '',
    }
  })

  const text = await createAgentMessage({
    system: 'You rewrite only the roadmap sections for specific checklist items. Return JSON only.',
    content: `These checklist items changed. Rewrite only their narrative blocks. Do not mention unchanged items.

${JSON.stringify(excerpts.map((entry) => ({
  id: entry.id,
  kind: entry.kind,
  previous: { category: entry.before.category, item: entry.before.item, status: entry.before.status, actionNeeded: entry.before.actionNeeded },
  next: { category: entry.after.category, item: entry.after.item, status: entry.after.status, actionNeeded: entry.after.actionNeeded },
  currentBlock: entry.currentBlock,
})))}

Return JSON:
{ "blocks": [{ "id": "checklist item id", "markdown": "**Category — Item** 🔴 RED\\n- **What**: ...\\n- **Why**: ...\\n- **Impact on Deal**: ...\\n- **How**: ...\\n- **Owner**: ..." }] }

For kind "remove", return an empty markdown string.
Use the next item wording exactly. Do not include unchanged items.`,
    maxTokens: 6000,
    temperature: 0.15,
  })

  const parsed = parseJsonObject(text)
  const blocks = Array.isArray(parsed.blocks) ? parsed.blocks : []
  const byId = new Map<string, NarrativeRewrite>()
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue
    const row = block as Record<string, unknown>
    const id = asText(row.id)
    if (!id) continue
    byId.set(id, { id, markdown: typeof row.markdown === 'string' ? row.markdown : '' })
  }

  for (const target of targets) {
    const rewrite = byId.get(target.after.id)
    const replacement = target.kind === 'remove'
      ? null
      : rewrite?.markdown?.trim()
        ? rewrite.markdown
        : null
    if (target.kind !== 'remove' && !replacement) continue
    markdown = spliceNarrativeBlock(
      markdown,
      target.before,
      replacement,
      target.kind === 'remove' ? undefined : target.after,
    )
  }
  return markdown
}
