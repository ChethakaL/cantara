import { buildHtmlTable, generateReportHtml } from './generate-report-html'

export type AgentOverviewReport = {
  workstreamLabel: string
  clientName: string
  generatedAt: string
  generatedBy?: string
  markdown: string
  agents: Array<{
    agentId: string
    agentName: string
    completed: boolean
    completedAt?: string | null
  }>
}

export function buildAgentOverviewReportHtml(report: AgentOverviewReport): string {
  const completed = report.agents.filter(agent => agent.completed).length
  const agentTable = buildHtmlTable(
    ['Agent', 'Status', 'Completed At'],
    report.agents.map(agent => [
      agent.agentName,
      agent.completed ? 'Complete' : 'Incomplete',
      agent.completedAt ? new Date(agent.completedAt).toLocaleString('en-US') : '-',
    ]),
  )

  return generateReportHtml({
    title: 'Agent Overview Report',
    subtitle: report.workstreamLabel,
    clientName: report.clientName,
    generatedAt: report.generatedAt,
    summary: firstParagraph(report.markdown),
    kpis: [
      { label: 'Workstream', value: report.workstreamLabel },
      { label: 'Agents Complete', value: `${completed}/${report.agents.length}` },
      { label: 'Prepared By', value: 'Cantara Admin' },
    ],
    sections: [
      { title: 'Executive Overview', content: markdownToHtml(report.markdown) },
      { title: 'Agent Completion', content: agentTable },
    ],
  })
}

function firstParagraph(markdown: string) {
  return String(markdown ?? '')
    .split(/\n{2,}/)
    .map(part => part.replace(/^#+\s*/, '').trim())
    .find(Boolean) ?? ''
}

function markdownToHtml(markdown: string) {
  const lines = String(markdown ?? '').replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let list: string[] = []

  const flushList = () => {
    if (!list.length) return
    html.push(`<ul class="report-list">${list.map(item => `<li>${formatInline(item)}</li>`).join('')}</ul>`)
    list = []
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      flushList()
      continue
    }
    if (/^#{1,4}\s+/.test(trimmed)) {
      flushList()
      html.push(`<h3 style="font-size:14px;font-weight:800;color:#21263C;margin:16px 0 8px;">${formatInline(trimmed.replace(/^#{1,4}\s+/, ''))}</h3>`)
      continue
    }
    if (/^[-*]\s+/.test(trimmed)) {
      list.push(trimmed.replace(/^[-*]\s+/, ''))
      continue
    }
    flushList()
    html.push(`<p>${formatInline(trimmed)}</p>`)
  }
  flushList()

  return html.join('\n') || '<p>No overview content available.</p>'
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
