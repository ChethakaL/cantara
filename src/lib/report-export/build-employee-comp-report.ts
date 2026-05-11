import type { EmployeeCompRow, EmployeeCompReport } from '@/lib/employee-comp/analyze'
import {
  generateReportHtml,
  buildHtmlTable,
  type ReportConfig,
} from './generate-report-html'

function fmt(val: number | null): string {
  if (val === null || val === undefined) return '\u2014'
  return val.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
}

export function buildEmployeeCompReportHtml(
  employees: EmployeeCompRow[],
  summary: EmployeeCompReport['summary'],
  clientName: string,
): string {
  // Employee roster table
  const rosterContent = employees.length > 0
    ? buildHtmlTable(
        ['Name', 'Title', 'Location', 'Type', 'Full Time Employees', 'Part Time Employees', 'Hourly/Salary', 'Rate', 'Hire Date', 'Benefit Class'],
        employees.map(e => [
          e.employeeName || '\u2014',
          e.jobTitle || '\u2014',
          e.workLocation || '\u2014',
          e.employeeType || '\u2014',
          e.employeeType.toLowerCase().includes('full') ? '1' : '',
          e.employeeType.toLowerCase().includes('part') ? '1' : '',
          e.payType,
          e.payType === 'Hourly'
            ? (e.hourlyRate !== null ? `$${e.hourlyRate.toFixed(2)}/hr` : '\u2014')
            : fmt(e.annualSalary),
          e.hireDate || '\u2014',
          e.benefitClassDescription || e.benefitClassCode || '\u2014',
        ]),
      )
    : '<p>No employee data available.</p>'

  // Location breakdown
  const locationRows = Object.entries(summary.locationBreakdown).map(([loc, count]) => [loc, String(count)])
  const locationContent = locationRows.length > 0
    ? buildHtmlTable(['Location', 'Headcount'], locationRows)
    : '<p>No location data.</p>'

  // Role breakdown
  const roleRows = Object.entries(summary.roleBreakdown).map(([role, count]) => [role, String(count)])
  const roleContent = roleRows.length > 0
    ? buildHtmlTable(['Role', 'Headcount'], roleRows)
    : '<p>No role data.</p>'

  const config: ReportConfig = {
    title: 'Employee Staffing & Compensation Report',
    subtitle: 'Workforce Compensation Analysis',
    clientName,
    generatedAt: new Date().toISOString(),
    sections: [
      { title: 'Employee Roster', content: rosterContent },
      { title: 'Summary by Location', content: locationContent },
      { title: 'Summary by Role', content: roleContent },
    ],
  }

  return generateReportHtml(config)
}
