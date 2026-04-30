import {
  generateReportHtml,
  buildHtmlTable,
  type ReportConfig,
} from './generate-report-html'

interface VendorItem {
  id: string
  name: string
  vendor: string
  category: string
  annualCost: number
  contractStatus: string
  transferable: 'yes' | 'no' | 'unknown'
  loginAccess: string
  notes: string
}

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

export function buildVendorReportHtml(
  items: VendorItem[],
  clientName: string,
): string {
  const totalCost = items.reduce((sum, i) => sum + (Number(i.annualCost) || 0), 0)
  const transferableCount = items.filter(i => i.transferable === 'yes').length
  const transferLabel = (s: string) => s === 'yes' ? 'Yes' : s === 'no' ? 'No' : 'Unknown'

  // KPIs
  const kpis = [
    { label: 'Total Items', value: String(items.length) },
    { label: 'Total Annual Cost', value: fmtCurrency(totalCost) },
    { label: 'Transferable', value: String(transferableCount) },
  ]

  // Inventory table with total row
  const rows = items.map(i => [
    i.name,
    i.vendor || '\u2014',
    i.category || '\u2014',
    fmtCurrency(i.annualCost),
    i.contractStatus || '\u2014',
    transferLabel(i.transferable),
  ])

  // Add total row
  rows.push(['Total', '', '', fmtCurrency(totalCost), '', ''])

  const tableContent = items.length > 0
    ? buildHtmlTable(
        ['Name', 'Vendor', 'Category', 'Annual Cost', 'Contract Status', 'Transferable'],
        rows,
        { totalRow: true },
      )
    : '<p>No vendor items recorded.</p>'

  const config: ReportConfig = {
    title: 'Software & Vendor Report',
    subtitle: 'Subscription & Vendor Inventory',
    clientName,
    generatedAt: new Date().toISOString(),
    kpis,
    sections: [
      { title: 'Vendor Inventory', content: tableContent },
    ],
  }

  return generateReportHtml(config)
}
