export type MarkdownTableBlock = {
  type: 'table'
  headers: string[]
  rows: string[][]
}

export type MarkdownTextBlock = {
  type: 'text'
  content: string
}

export type MarkdownBlock = MarkdownTableBlock | MarkdownTextBlock

function parseTableRow(line: string): string[] {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|')) return []
  const parts = trimmed.split('|')
  return parts.slice(1, parts.length - 1).map(cell => cell.trim())
}

function isTableSeparator(line: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(line.trim())
}

export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.split('\n')
  const blocks: MarkdownBlock[] = []
  let textBuffer: string[] = []

  const flushText = () => {
    const content = textBuffer.join('\n').trim()
    if (content) blocks.push({ type: 'text', content })
    textBuffer = []
  }

  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    const nextLine = lines[index + 1] ?? ''

    if (line.trim().startsWith('|') && isTableSeparator(nextLine)) {
      flushText()
      const headers = parseTableRow(line)
      index += 2
      const rows: string[][] = []
      while (index < lines.length && lines[index].trim().startsWith('|') && !isTableSeparator(lines[index])) {
        const row = parseTableRow(lines[index])
        if (row.length) {
          rows.push(row.length === headers.length ? row : [...row, ...Array(Math.max(0, headers.length - row.length)).fill('')])
        }
        index += 1
      }
      blocks.push({ type: 'table', headers, rows })
      continue
    }

    textBuffer.push(line)
    index += 1
  }

  flushText()
  return blocks.length ? blocks : [{ type: 'text', content: markdown }]
}

function escapeTableCell(value: string): string {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

export function serializeMarkdownBlocks(blocks: MarkdownBlock[]): string {
  return blocks
    .map(block => {
      if (block.type === 'text') return block.content.trim()
      const header = `| ${block.headers.map(escapeTableCell).join(' | ')} |`
      const separator = `| ${block.headers.map(() => '---').join(' | ')} |`
      const rows = block.rows.map(row => {
        const cells = block.headers.map((_, cellIndex) => escapeTableCell(row[cellIndex] ?? ''))
        return `| ${cells.join(' | ')} |`
      })
      return [header, separator, ...rows].join('\n')
    })
    .filter(Boolean)
    .join('\n\n')
}
