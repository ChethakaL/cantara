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

export type SaleReadinessChecklistState = {
  workstream: 'ws1' | 'ws2'
  clientName: string
  generatedAt: string
  updatedAt?: string
  items: SaleReadinessChecklistItem[]
}

function cleanCell(value: string | undefined): string {
  return String(value ?? '')
    .replace(/\\\|/g, '|')
    .replace(/^☐\s*/, '')
    .replace(/^☑\s*/, '')
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

function isChecklistHeading(content: string): boolean {
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
