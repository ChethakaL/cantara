import { generateReportHtml } from './generate-report-html'

type RoadmapReport = {
  workstream: string
  workstreamLabel: string
  clientName: string
  generatedAt: string
  markdown: string
}

export function buildImprovementRoadmapHtml(report: RoadmapReport): string {
  const sections = parseMarkdownSections(report.markdown)

  return generateReportHtml({
    title: `${report.workstreamLabel} Assessment & Improvement Roadmap`,
    subtitle: 'Seller Sale Readiness & Improvement Plan',
    clientName: report.clientName,
    generatedAt: report.generatedAt,
    summaryHtml: sections.length > 0 ? markdownToHtml(sections[0].content) : undefined,
    kpis: [
      { label: 'Workstream', value: report.workstreamLabel.split('—')[0]?.trim() || report.workstream.toUpperCase() },
      { label: 'Report Type', value: 'Assessment & Improvement Roadmap' },
      { label: 'For', value: 'Seller' },
      { label: 'Prepared By', value: 'Cantara AI' },
    ],
    sections: sections.slice(1).map(s => ({
      title: s.title,
      content: markdownToHtml(s.content),
    })),
  })
}

function parseMarkdownSections(markdown: string): Array<{ title: string; content: string }> {
  const result: Array<{ title: string; content: string }> = []
  const lines = markdown.split('\n')
  let currentTitle = 'Overview'
  let currentContent: string[] = []

  for (const line of lines) {
    const h2Match = line.match(/^## (.+)/)
    if (h2Match) {
      if (currentContent.length > 0 || result.length > 0) {
        result.push({ title: currentTitle, content: currentContent.join('\n') })
      }
      currentTitle = h2Match[1].trim()
      currentContent = []
      continue
    }
    if (/^# /.test(line)) continue
    currentContent.push(line)
  }
  if (currentContent.length > 0) {
    result.push({ title: currentTitle, content: currentContent.join('\n') })
  }

  return result
}

/** Convert status emoji/text to styled HTML badge */
function renderStatusBadge(text: string): string {
  const s = text.toUpperCase()
  if (s.includes('🟢') || s.includes('GREEN')) {
    return '<span style="display:inline-block;background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;">🟢 Green</span>'
  }
  if (s.includes('🟡') || s.includes('YELLOW')) {
    return '<span style="display:inline-block;background:#fffbeb;border:1px solid #fde68a;color:#92400e;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;">🟡 Yellow</span>'
  }
  if (s.includes('🔴') || s.includes('RED')) {
    return '<span style="display:inline-block;background:#fef2f2;border:1px solid #fca5a5;color:#991b1b;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;">🔴 Red</span>'
  }
  return formatInline(text)
}

function isStatusCell(text: string): boolean {
  const s = text.toUpperCase()
  return s.includes('🟢') || s.includes('🟡') || s.includes('🔴') || s.includes('GREEN') || s.includes('YELLOW') || (s === 'RED' || s.includes('🔴'))
}

function markdownToHtml(markdown: string): string {
  const lines = String(markdown ?? '').replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let list: string[] = []
  let inTable = false
  let tableRows: string[][] = []

  const flushList = () => {
    if (!list.length) return
    html.push(`<ul class="report-list">${list.map(item => `<li>${formatInline(item)}</li>`).join('')}</ul>`)
    list = []
  }

  const flushTable = () => {
    if (!inTable || tableRows.length < 2) { inTable = false; tableRows = []; return }
    const headers = tableRows[0]
    const rows = tableRows.slice(2) // skip separator
    html.push(`<table class="report-table"><thead><tr>${headers.map(h => `<th>${formatInline(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => {
      // Render status cells as badges
      if (isStatusCell(c)) {
        return `<td>${renderStatusBadge(c)}</td>`
      }
      // Render checklist cells
      if (c.trim() === '☐') {
        return `<td style="text-align:center;"><span style="color:#cbd5e1;font-size:16px;">☐</span></td>`
      }
      if (c.trim() === '☑' || c.trim() === '✅') {
        return `<td style="text-align:center;"><span style="color:#10b981;font-size:16px;">☑</span></td>`
      }
      return `<td>${formatInline(c)}</td>`
    }).join('')}</tr>`).join('')}</tbody></table>`)
    inTable = false
    tableRows = []
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList()
      inTable = true
      tableRows.push(trimmed.split('|').slice(1, -1).map(c => c.trim()))
      continue
    } else if (inTable) {
      flushTable()
    }

    if (!trimmed) { flushList(); continue }
    if (/^#{3,4}\s+/.test(trimmed)) {
      flushList()
      html.push(`<h3 style="font-size:14px;font-weight:800;color:#21263C;margin:16px 0 8px;">${formatInline(trimmed.replace(/^#{3,4}\s+/, ''))}</h3>`)
      continue
    }
    if (/^[-*]\s+/.test(trimmed)) { list.push(trimmed.replace(/^[-*]\s+/, '')); continue }
    if (/^\d+\.\s+/.test(trimmed)) { list.push(trimmed.replace(/^\d+\.\s+/, '')); continue }
    flushList()
    html.push(`<p>${formatInline(trimmed)}</p>`)
  }
  flushList()
  flushTable()

  return html.join('\n') || '<p>No content available.</p>'
}

function formatInline(input: string) {
  return escapeHtml(input)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

function escapeHtml(input: string) {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
