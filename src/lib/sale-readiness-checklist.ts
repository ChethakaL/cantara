import { parseMarkdownBlocks } from '@/lib/markdown-blocks'
import { generateReportHtml } from '@/lib/report-export/generate-report-html'

export type SaleReadinessChecklistItem = {
  id: string
  category: string
  item: string
  status: string
  actionNeeded: string
  advisorApproved: boolean
  approvedAt?: string | null
  clientCompleted: boolean
  clientCompletedAt?: string | null
}

export const ROADMAP_SUBMISSION_KEY = 'improvementRoadmap'
export const CHECKLIST_SUBMISSION_KEY = 'saleReadinessChecklist'

export type SaleReadinessRoadmapStage = 'checklist' | 'report'
export type SaleReadinessChecklistOrder = 'category' | 'status' | 'manual'

export function sortSaleReadinessChecklist(
  items: SaleReadinessChecklistItem[],
  order: SaleReadinessChecklistOrder = 'category',
): SaleReadinessChecklistItem[] {
  if (order === 'manual') return [...items]
  const statusRank = (status: string) => {
    const value = status.toLowerCase()
    if (value.includes('red') || status.includes('🔴')) return 0
    if (value.includes('yellow') || status.includes('🟡')) return 1
    if (value.includes('green') || status.includes('🟢')) return 2
    return 3
  }
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const primary = order === 'status'
        ? statusRank(a.item.status) - statusRank(b.item.status)
        : a.item.category.localeCompare(b.item.category, undefined, { sensitivity: 'base' })
      return primary || a.index - b.index
    })
    .map(({ item }) => item)
}

function markdownTableCells(line: string) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(cell => cell.trim().replace(/\\\|/g, '|'))
}

export function reorderSaleReadinessChecklistMarkdown(
  markdown: string,
  items: SaleReadinessChecklistItem[],
  order: SaleReadinessChecklistOrder,
): string {
  const lines = markdown.split('\n')
  const orderedItems = sortSaleReadinessChecklist(items, order)
  const sortIndex = new Map(orderedItems.map((item, index) => [`${item.category.toLowerCase()}|${item.item.toLowerCase()}`, index]))
  for (let heading = 0; heading < lines.length; heading += 1) {
    if (!/^##\s+sale[- ]readiness checklist\s*$/i.test(lines[heading].trim())) continue
    let header = heading + 1
    while (header < lines.length && !lines[header].trim().startsWith('|')) header += 1
    if (header + 1 >= lines.length || !/^\|[\s\-:|]+\|$/.test(lines[header + 1].trim())) continue
    const headers = markdownTableCells(lines[header]).map(value => value.toLowerCase().replace(/[^a-z]/g, ''))
    const categoryColumn = headers.findIndex(value => value === 'category')
    const itemColumn = headers.findIndex(value => value === 'item' || value === 'actionitem')
    if (categoryColumn < 0 || itemColumn < 0 || !headers.some(value => value === 'status')) continue
    let end = header + 2
    while (end < lines.length && lines[end].trim().startsWith('|') && !/^\|[\s\-:|]+\|$/.test(lines[end].trim())) end += 1
    const rowLines = lines.slice(header + 2, end)
    const rowOrder = (line: string) => {
      const cells = markdownTableCells(line)
      const category = (cells[categoryColumn] ?? '').replace(/\*\*/g, '').replace(/__/g, '').toLowerCase()
      const item = (cells[itemColumn] ?? '').replace(/\*\*/g, '').replace(/__/g, '').replace(/^☐\s*/, '').replace(/^☑\s*/, '').toLowerCase()
      return sortIndex.get(`${category}|${item}`) ?? Number.MAX_SAFE_INTEGER
    }
    rowLines.sort((a, b) => rowOrder(a) - rowOrder(b))
    lines.splice(header + 2, rowLines.length, ...rowLines)
    heading = end
  }
  return lines.join('\n')
}

export type SaleReadinessChecklistState = {
  workstream?: string
  clientName: string
  generatedAt: string
  updatedAt?: string
  items: SaleReadinessChecklistItem[]
}

export function readRoadmapSubmission(submissions: Record<string, any>) {
  return submissions[ROADMAP_SUBMISSION_KEY]
    ?? submissions.improvementRoadmap_ws2
    ?? submissions.improvementRoadmap_ws1
    ?? null
}

export function readChecklistSubmission(submissions: Record<string, any>) {
  return submissions[CHECKLIST_SUBMISSION_KEY]
    ?? submissions.saleReadinessChecklist_ws2
    ?? submissions.saleReadinessChecklist_ws1
    ?? null
}

function cleanCell(value: string | undefined): string {
  return String(value ?? '')
    .replace(/\\\|/g, '|')
    .replace(/^☐\s*/, '')
    .replace(/^☑\s*/, '')
    .replace(/^\*\*([\s\S]*?)\*\*$/, '$1')
    .replace(/^__([\s\S]*?)__$/, '$1')
    .trim()
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function stableId(parts: string[]): string {
  const input = parts.join('|').toLowerCase()
  let hash = 5381
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i)
  }
  return `chk_${(hash >>> 0).toString(36)}`
}

export function createChecklistItem(partial: Partial<SaleReadinessChecklistItem> = {}): SaleReadinessChecklistItem {
  const rawCategory = String(partial.category ?? '').trim()
  const cleanCategory = rawCategory.replace(/^\*\*([\s\S]*?)\*\*$/, '$1').replace(/^__([\s\S]*?)__$/, '$1').trim()
  return {
    id: partial.id || `chk_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    category: cleanCategory,
    item: String(partial.item ?? '').trim(),
    status: String(partial.status ?? '🟡 YELLOW').trim() || '🟡 YELLOW',
    actionNeeded: String(partial.actionNeeded ?? '').trim(),
    advisorApproved: Boolean(partial.advisorApproved),
    approvedAt: partial.approvedAt ?? null,
    clientCompleted: Boolean(partial.clientCompleted),
    clientCompletedAt: partial.clientCompletedAt ?? null,
  }
}

function isChecklistHeading(content: string) {
  return /(^|\n)#{2,3}\s+sale-readiness checklist\b/i.test(content)
    || /(^|\n)#{2,3}\s+checklist\b/i.test(content)
}

export function extractSaleReadinessChecklist(
  markdown: string,
  existingItems: SaleReadinessChecklistItem[] = [],
): SaleReadinessChecklistItem[] {
  const blocks = parseMarkdownBlocks(markdown)
  const existingById = new Map(existingItems.map(item => [item.id, item]))
  const existingBySignature = new Map(existingItems.map(item => [
    `${item.category.toLowerCase()}|${item.item.toLowerCase()}|${item.actionNeeded.toLowerCase()}`,
    item,
  ]))

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]
    if (block.type !== 'text' || !isChecklistHeading(block.content)) continue

    const table = blocks.slice(index + 1).find(next => next.type === 'table')
    if (!table || table.type !== 'table') return []

    const headers = table.headers.map(normalizeHeader)
    const categoryIndex = headers.findIndex(h => h === 'category')
    const itemIndex = headers.findIndex(h => h === 'item' || h === 'actionitem')
    const statusIndex = headers.findIndex(h => h === 'status')
    const actionIndex = headers.findIndex(h => h === 'actionneeded' || h === 'action')

    if (categoryIndex === -1 || itemIndex === -1 || actionIndex === -1) return []

    return table.rows
      .map((row): SaleReadinessChecklistItem | null => {
        const category = cleanCell(row[categoryIndex])
        const item = cleanCell(row[itemIndex])
        const status = cleanCell(row[statusIndex])
        const actionNeeded = cleanCell(row[actionIndex])
        if (!category || !item) return null

        const id = stableId([category, item, actionNeeded])
        const existing = existingById.get(id)
          ?? existingBySignature.get(`${category.toLowerCase()}|${item.toLowerCase()}|${actionNeeded.toLowerCase()}`)

        return {
          id,
          category,
          item,
          status,
          actionNeeded,
          advisorApproved: existing?.advisorApproved ?? false,
          approvedAt: existing?.approvedAt ?? null,
          clientCompleted: existing?.clientCompleted ?? false,
          clientCompletedAt: existing?.clientCompletedAt ?? null,
        }
      })
      .filter((item): item is SaleReadinessChecklistItem => item !== null)
  }

  return []
}

function esc(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function statusHtml(status: string): string {
  const upper = status.toUpperCase()
  const tone = upper.includes('RED') || status.includes('🔴')
    ? ['#fef2f2', '#fca5a5', '#991b1b']
    : upper.includes('YELLOW') || status.includes('🟡')
      ? ['#fffbeb', '#fde68a', '#92400e']
      : ['#ecfdf5', '#a7f3d0', '#065f46']
  return `<span style="display:inline-block;border:1px solid ${tone[1]};background:${tone[0]};color:${tone[2]};border-radius:999px;padding:2px 8px;font-size:11px;font-weight:700;">${esc(status || 'Open')}</span>`
}

export function buildSaleReadinessChecklistPdfHtml(args: {
  clientName: string
  workstreamLabel: string
  generatedAt: string
  items: SaleReadinessChecklistItem[]
}): string {
  const rows = args.items.map(item => `
    <tr>
      <td style="text-align:center;font-size:16px;color:#94a3b8;">${item.clientCompleted ? '☑' : '☐'}</td>
      <td>${esc(item.category)}</td>
      <td><strong>${esc(item.item)}</strong></td>
      <td>${statusHtml(item.status)}</td>
      <td>${esc(item.actionNeeded)}</td>
    </tr>
  `).join('')

  const table = `
    <table class="report-table">
      <thead>
        <tr>
          <th style="width:44px;">Done</th>
          <th>Category</th>
          <th>Checklist Item</th>
          <th>Status</th>
          <th>Action Needed</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `

  return generateReportHtml({
    title: `${args.workstreamLabel} Checklist`,
    subtitle: 'Sale Readiness Action Checklist',
    clientName: args.clientName,
    generatedAt: args.generatedAt,
    kpis: [
      { label: 'Checklist Items', value: String(args.items.length) },
      { label: 'Report Type', value: 'Sale Readiness' },
      { label: 'Prepared By', value: 'Cantara' },
    ],
    sections: [
      {
        title: 'Checklist',
        content: table,
      },
    ],
  })
}

export function exportSaleReadinessChecklistExcel(
  items: SaleReadinessChecklistItem[],
  clientName: string,
) {
  if (!items || !items.length) return
  // Dynamically require/import xlsx to support client-side bundle execution
  const XLSX = require('xlsx')

  const rows = items.map((item, index) => {
    let statusClean = item.status || 'Yellow'
    if (statusClean.includes('🔴') || statusClean.toUpperCase().includes('RED')) statusClean = 'Red'
    else if (statusClean.includes('🟡') || statusClean.toUpperCase().includes('YELLOW')) statusClean = 'Yellow'
    else if (statusClean.includes('🟢') || statusClean.toUpperCase().includes('GREEN')) statusClean = 'Green'

    return {
      '#': index + 1,
      'Approved': item.advisorApproved ? 'Yes' : 'No',
      'Category': item.category,
      'Item': item.item,
      'Status': statusClean,
      'Action Needed': item.actionNeeded,
      'Done': item.clientCompleted ? 'Yes' : 'No',
      'Completed Date': item.clientCompletedAt ? new Date(item.clientCompletedAt).toLocaleDateString() : '',
    }
  })

  const worksheet = XLSX.utils.json_to_sheet(rows)
  worksheet['!cols'] = [
    { wch: 5 },  // #
    { wch: 12 }, // Approved
    { wch: 25 }, // Category
    { wch: 45 }, // Item
    { wch: 12 }, // Status
    { wch: 55 }, // Action Needed
    { wch: 10 }, // Done
    { wch: 16 }, // Completed Date
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Checklist')

  const safeName = (clientName || 'Client').replace(/[^a-zA-Z0-9_-]/g, '_')
  XLSX.writeFile(workbook, `${safeName}_Sale_Readiness_Checklist.xlsx`)
}
