import {
  generateReportHtml,
  type ReportConfig,
  type ReportSection,
} from './generate-report-html'

export function buildMarkdownReportHtml(args: {
  title: string
  subtitle?: string
  clientName: string
  generatedAt?: string | Date | null
  markdown: string
}): string {
  const sections = markdownToSections(args.markdown)
  const config: ReportConfig = {
    title: args.title,
    subtitle: args.subtitle ?? 'Generated Analysis Report',
    clientName: args.clientName,
    generatedAt: args.generatedAt ? new Date(args.generatedAt).toISOString() : new Date().toISOString(),
    sections: sections.length
      ? sections
      : [{ title: args.title, content: '<p>No report content available.</p>' }],
  }

  return generateReportHtml(config)
}

function markdownToSections(markdown: string): ReportSection[] {
  const lines = String(markdown ?? '').replace(/\r\n/g, '\n').split('\n')
  const sections: ReportSection[] = []
  let currentTitle = 'Report'
  let currentLines: string[] = []

  const flush = () => {
    const content = renderMarkdownBlock(currentLines.join('\n').trim())
    if (content.trim()) {
      sections.push({ title: cleanInline(currentTitle), content })
    }
    currentLines = []
  }

  for (const line of lines) {
    const heading = line.match(/^#{1,3}\s+(.+?)\s*$/)
    if (heading) {
      flush()
      currentTitle = heading[1]
    } else {
      currentLines.push(line)
    }
  }
  flush()

  return sections
}

function renderMarkdownBlock(block: string): string {
  if (!block) return ''
  const lines = block.split('\n')
  const html: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i += 1
      continue
    }

    if (isTableStart(lines, i)) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i])
        i += 1
      }
      html.push(renderTable(tableLines))
      continue
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''))
        i += 1
      }
      html.push(`<ul class="report-list">${items.map(item => `<li>${formatInline(item)}</li>`).join('')}</ul>`)
      continue
    }

    const paragraph: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !isTableStart(lines, i) &&
      !/^\s*[-*]\s+/.test(lines[i])
    ) {
      paragraph.push(lines[i])
      i += 1
    }
    html.push(`<p>${formatInline(paragraph.join(' '))}</p>`)
  }

  return html.join('\n')
}

function isTableStart(lines: string[], index: number) {
  const line = lines[index] ?? ''
  const next = lines[index + 1] ?? ''
  return line.includes('|') && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(next)
}

function renderTable(lines: string[]) {
  const rows = lines
    .filter(line => !/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line))
    .map(parseTableRow)
    .filter(row => row.length > 0)
  if (rows.length === 0) return ''

  const [headers, ...bodyRows] = rows
  return `<table class="report-table">
    <thead><tr>${headers.map(header => `<th>${formatInline(header)}</th>`).join('')}</tr></thead>
    <tbody>${bodyRows.map(row => `<tr>${headers.map((_, index) => `<td>${formatInline(row[index] ?? '')}</td>`).join('')}</tr>`).join('\n')}</tbody>
  </table>`
}

function parseTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell => cell.trim())
}

function formatInline(input: string) {
  return escapeHtml(cleanInline(input))
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

function cleanInline(input: string) {
  return String(input ?? '')
    .replace(/[🔴🟡🟢⚠️✅]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
