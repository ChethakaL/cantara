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
  willingToParticipate: 'yes' | 'no' | 'unknown'
  notes: string
}

export function buildAdvisorsReportHtml(
  advisors: Advisor[],
  clientName: string,
): string {
  const willingCount = advisors.filter(a => a.willingToParticipate === 'yes').length
  const willingLabel = (s: string) => s === 'yes' ? 'Yes' : s === 'no' ? 'No' : 'Unknown'

  // KPIs
  const kpis = [
    { label: 'Total Advisors', value: String(advisors.length) },
    { label: 'Willing to Participate', value: String(willingCount) },
  ]

  // Advisors table
  const tableContent = advisors.length > 0
    ? buildHtmlTable(
        ['Role', 'Name', 'Company', 'Email', 'Phone', 'Willing to Participate'],
        advisors.map(a => [
          a.role || '\u2014',
          a.name,
          a.company || '\u2014',
          a.email || '\u2014',
          a.phone || '\u2014',
          willingLabel(a.willingToParticipate),
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
