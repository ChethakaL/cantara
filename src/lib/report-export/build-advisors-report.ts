import {
  generateReportHtml,
  buildHtmlTable,
  type ReportConfig,
} from './generate-report-html'

interface Advisor {
  id: string
  role: string
  name: string
  company: string
  email: string
  phone: string
  notes: string
}

export function buildAdvisorsReportHtml(
  advisors: Advisor[],
  clientName: string,
): string {
  const kpis = [
    { label: 'Total Advisors', value: String(advisors.length) },
  ]

  const tableContent = advisors.length > 0
    ? buildHtmlTable(
        ['Role', 'Name', 'Company', 'Email', 'Phone', 'Notes'],
        advisors.map(a => [
          a.role || '\u2014',
          a.name,
          a.company || '\u2014',
          a.email || '\u2014',
          a.phone || '\u2014',
          a.notes || '\u2014',
        ]),
      )
    : '<p>No advisors recorded.</p>'

  const config: ReportConfig = {
    title: 'Professional Advisors Report',
    subtitle: 'Key Professional Contacts',
    clientName,
    generatedAt: new Date().toISOString(),
    kpis,
    sections: [
      { title: 'Advisors Directory', content: tableContent },
    ],
  }

  return generateReportHtml(config)
}
