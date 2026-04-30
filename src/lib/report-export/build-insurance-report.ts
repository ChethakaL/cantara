import {
  generateReportHtml,
  buildInfoGrid,
  buildBulletList,
  type ReportConfig,
} from './generate-report-html'

interface InsuranceSummary {
  summary: string
  claimType?: string | null
  incidentDate?: string | null
  withinLast12Months?: boolean | null
  status?: string | null
  amountClaimed?: string | null
  amountRequested?: string | null
  incidentCause?: string | null
  flags?: string[]
  keyFacts?: string[]
}

export function buildInsuranceReportHtml(
  summary: InsuranceSummary,
  fileName: string,
  clientName: string,
): string {
  const infoGrid = buildInfoGrid([
    { label: 'Claim Status', value: formatStatus(summary.status) },
    { label: 'Incident Date', value: summary.incidentDate || 'Unknown' },
    { label: 'Claim Type', value: summary.claimType || 'Unknown' },
    { label: 'Cause', value: summary.incidentCause || 'Unknown' },
    { label: 'Amount Requested', value: summary.amountRequested || 'Unknown' },
    { label: 'Amount Claimed', value: summary.amountClaimed || 'Unknown' },
  ])

  const keyFactsContent = summary.keyFacts?.length
    ? `<p style="font-weight:700;margin-top:12px;">Key Facts</p>` + buildBulletList(summary.keyFacts)
    : ''

  const flagsContent = summary.flags?.length
    ? `<p style="font-weight:700;margin-top:12px;">Flags</p>` + buildBulletList(summary.flags)
    : ''

  const config: ReportConfig = {
    title: 'Insurance Claim Review',
    subtitle: 'Claim Summary & Risk Assessment',
    clientName,
    generatedAt: new Date().toISOString(),
    summary: summary.summary,
    kpis: [
      { label: 'Status', value: formatStatus(summary.status) },
      { label: 'Within 12 Mo', value: summary.withinLast12Months === true ? 'Yes' : summary.withinLast12Months === false ? 'No' : 'Unknown' },
      { label: 'Source', value: fileName },
    ],
    sections: [
      { title: 'Claim Details', content: infoGrid },
      ...(keyFactsContent ? [{ title: 'Key Facts', content: keyFactsContent }] : []),
      ...(flagsContent ? [{ title: 'Flags & Notes', content: flagsContent }] : []),
    ],
  }

  return generateReportHtml(config)
}

function formatStatus(status: string | null | undefined): string {
  switch (status?.toLowerCase()) {
    case 'denied': return 'Denied'
    case 'in_process': return 'In Process'
    case 'paid_in_part': return 'Paid in Part'
    case 'paid_in_full': return 'Paid in Full'
    case 'pending': return 'Pending'
    default: return 'Unknown'
  }
}
