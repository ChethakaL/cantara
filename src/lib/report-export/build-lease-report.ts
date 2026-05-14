import type { LeaseReport } from '@/lib/lease-analysis/types'
import { getVisibleFlags } from '@/lib/lease-analysis/report-utils'
import {
  generateReportHtml,
  buildHtmlTable,
  buildFlagListHtml,
  type ReportConfig,
} from './generate-report-html'

/** Summary report: snapshot table + flags (1-2 pages) */
export function buildLeaseSummaryHtml(report: LeaseReport, clientName: string): string {
  const redFlags = getVisibleFlags(report.redFlags || [])
  const orangeFlags = getVisibleFlags(report.orangeFlags || [])
  const greenFlags = getVisibleFlags(report.greenFlags || [])

  const snapshotRows = (report.snapshotTable || []).map(row => [row.field, row.finding])
  const snapshotContent = buildHtmlTable(['Key Item', 'Finding'], snapshotRows)

  const rentScheduleContent = (report.rentSchedule && report.rentSchedule.length > 0)
    ? '<h3 style="margin-top:16px;font-size:14px;font-weight:700;color:#21263C;">Rent Schedule</h3>' +
      buildHtmlTable(
        ['Lease Year', 'Months', 'Per Annum', 'Per Month'],
        report.rentSchedule.map(r => [r.leaseYear, r.months, r.perAnnum, r.perMonth]),
      )
    : ''

  const flagsContent = [
    redFlags.length ? `<p style="font-weight:700;margin-top:12px;color:#991B1B;">Red Flags (${redFlags.length})</p>` + buildFlagListHtml(redFlags, 'red') : '',
    orangeFlags.length ? `<p style="font-weight:700;margin-top:12px;color:#92400E;">Yellow Flags (${orangeFlags.length})</p>` + buildFlagListHtml(orangeFlags, 'orange') : '',
    greenFlags.length ? `<p style="font-weight:700;margin-top:12px;color:#166534;">Green Flags (${greenFlags.length})</p>` + buildFlagListHtml(greenFlags, 'green') : '',
  ].join('')

  const config: ReportConfig = {
    title: 'Lease Analysis Report',
    subtitle: 'Summary & Risk Assessment',
    clientName,
    generatedAt: report.generatedAt,
    flags: { red: redFlags.length, orange: orangeFlags.length, green: greenFlags.length },
    kpis: [
      { label: 'Red Flags', value: String(redFlags.length) },
      { label: 'Yellow Flags', value: String(orangeFlags.length) },
      { label: 'Green Flags', value: String(greenFlags.length) },
      { label: 'Key Terms', value: String(snapshotRows.length) },
    ],
    sections: [
      { title: 'Lease Snapshot', content: snapshotContent + rentScheduleContent },
      ...(flagsContent ? [{ title: 'Flag Analysis', content: flagsContent }] : []),
    ],
  }

  return generateReportHtml(config)
}

/** Addendum: full detailed findings (multi-page) */
export function buildLeaseAddendumHtml(report: LeaseReport, clientName: string): string {
  const findingsSections = (report.detailedFindings || []).map(f => {
    const isRentSection = f.id === '2.3' || f.title.toLowerCase().includes('rent')
    const hasScheduleData = report.rentSchedule && report.rentSchedule.length > 0

    // Include rent schedule as a proper HTML table under section 2.3
    let extra = ''
    if (isRentSection && hasScheduleData) {
      extra = '<div style="margin-top:12px;">' +
        buildHtmlTable(
          ['Lease Year', 'Months', 'Per Annum', 'Per Month'],
          report.rentSchedule!.map(r => [r.leaseYear, r.months, r.perAnnum, r.perMonth]),
        ) + '</div>'
    }

    // Strip raw markdown tables from the content to avoid duplicating the rent schedule
    // (the AI output often includes pipe-delimited tables that don't render well in HTML)
    let cleanContent = f.content
    if (isRentSection && hasScheduleData) {
      // Remove markdown table lines (lines starting with |) and separator lines (|---|)
      cleanContent = cleanContent
        .split('\n')
        .filter(line => !line.trim().startsWith('|'))
        .join('\n')
    }

    return {
      title: `${f.id} — ${f.title}`,
      content: `<div style="font-size:13px;line-height:1.7;color:#475569;">${cleanContent.replace(/\n/g, '<br/>')}</div>${extra}`,
    }
  })

  const docInventory = (report.documentInventory || []).length > 0
    ? [{
        title: 'Document Inventory',
        content: buildHtmlTable(
          ['Document', 'Type', 'Date', 'Status'],
          report.documentInventory.map(d => [d.document, d.documentType || '', d.date || '', d.status || '']),
        ),
      }]
    : []

  const config: ReportConfig = {
    title: 'Lease Analysis — Detailed Findings',
    subtitle: 'Addendum',
    clientName,
    generatedAt: report.generatedAt,
    sections: [...findingsSections, ...docInventory],
  }

  return generateReportHtml(config)
}

/** Buyer-facing report: snapshot + rent schedule + detailed findings, NO flags */
export function buildLeaseBuyerReportHtml(report: LeaseReport, clientName: string): string {
  const snapshotRows = (report.snapshotTable || []).map(row => [row.field, row.finding])
  const snapshotContent = buildHtmlTable(['Key Item', 'Finding'], snapshotRows)

  const findingsSections = (report.detailedFindings || []).map(f => {
    const isRentSection = f.id === '2.3' || f.title.toLowerCase().includes('rent')
    const hasScheduleData = report.rentSchedule && report.rentSchedule.length > 0

    let extra = ''
    if (isRentSection && hasScheduleData) {
      extra = '<div style="margin-top:12px;">' +
        buildHtmlTable(
          ['Lease Year', 'Months', 'Per Annum', 'Per Month'],
          report.rentSchedule!.map(r => [r.leaseYear, r.months, r.perAnnum, r.perMonth]),
        ) + '</div>'
    }

    let cleanContent = f.content
    if (isRentSection && hasScheduleData) {
      cleanContent = cleanContent
        .split('\n')
        .filter(line => !line.trim().startsWith('|'))
        .join('\n')
    }

    return {
      title: `${f.id} — ${f.title}`,
      content: `<div style="font-size:13px;line-height:1.7;color:#475569;">${cleanContent.replace(/\n/g, '<br/>')}</div>${extra}`,
    }
  })

  const docInventory = (report.documentInventory || []).length > 0
    ? [{
        title: 'Document Inventory',
        content: buildHtmlTable(
          ['Document', 'Type', 'Date', 'Status'],
          report.documentInventory.map(d => [d.document, d.documentType || '', d.date || '', d.status || '']),
        ),
      }]
    : []

  const config: ReportConfig = {
    title: 'Lease Analysis Report',
    subtitle: 'Lease Summary — Buyer Package',
    clientName,
    generatedAt: report.generatedAt,
    kpis: [
      { label: 'Key Terms', value: String(snapshotRows.length) },
      { label: 'Sections', value: String((report.detailedFindings || []).length) },
      { label: 'Rent Schedule', value: String((report.rentSchedule || []).length) },
    ],
    sections: [
      { title: 'Lease Snapshot', content: snapshotContent },
      ...findingsSections,
      ...docInventory,
    ],
  }

  return generateReportHtml(config)
}

/** Legacy: combined report (kept for backwards compat) */
export function buildLeaseReportHtml(report: LeaseReport, clientName: string): string {
  return buildLeaseSummaryHtml(report, clientName)
}
