import type { OrgChartAnalysis } from '@/lib/org-chart/analyze'
import {
  generateReportHtml,
  buildHtmlTable,
  buildBulletList,
  type ReportConfig,
} from './generate-report-html'

export function buildOrgChartReportHtml(
  result: OrgChartAnalysis,
  clientName: string,
): string {
  const keyPersonCount = result.roles.filter(r => r.keyPerson).length
  const readinessLabel = result.transitionReadiness.charAt(0).toUpperCase() + result.transitionReadiness.slice(1)

  // KPIs
  const kpis = [
    { label: 'Total Headcount', value: result.totalHeadcount !== null ? String(result.totalHeadcount) : '\u2014' },
    { label: 'Transition Readiness', value: readinessLabel },
    { label: 'Key Persons', value: String(keyPersonCount) },
    { label: 'Role Gaps', value: String(result.roleGaps.length) },
  ]

  // Roles table
  const rolesContent = result.roles.length > 0
    ? buildHtmlTable(
        ['Name', 'Title', 'Department', 'Reports To', 'Key Person', 'Transition Risk'],
        result.roles.map(r => [
          r.name,
          r.title,
          r.department,
          r.reportsTo,
          r.keyPerson ? 'Yes' : 'No',
          r.transitionRisk.charAt(0).toUpperCase() + r.transitionRisk.slice(1),
        ]),
      )
    : '<p>No roles identified.</p>'

  // Key Person Dependencies
  const depsContent = result.keyPersonDependencies.length > 0
    ? result.keyPersonDependencies.map(dep =>
        `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin-bottom:10px;">
          <div style="font-weight:700;font-size:13px;color:#1e293b;">${dep.person} &mdash; ${dep.title}</div>
          <div style="font-size:12px;color:#475569;margin-top:4px;"><strong style="color:#b91c1c;">Risk:</strong> ${dep.risk}</div>
          <div style="font-size:12px;color:#475569;margin-top:2px;"><strong style="color:#166534;">Mitigation:</strong> ${dep.mitigation}</div>
        </div>`
      ).join('')
    : '<p>No key person dependencies identified.</p>'

  // Role Gaps
  const gapsContent = result.roleGaps.length > 0
    ? buildBulletList(result.roleGaps)
    : '<p>No role gaps identified.</p>'

  // Recommendations
  const recsContent = result.recommendations.length > 0
    ? `<ol style="margin:8px 0 12px 18px;padding:0;">${result.recommendations.map((r, i) =>
        `<li style="font-size:12px;color:#475569;margin-bottom:6px;line-height:1.6;">${r}</li>`
      ).join('')}</ol>`
    : '<p>No recommendations.</p>'

  const config: ReportConfig = {
    title: 'Org Chart Review Report',
    subtitle: 'Organizational Structure & Transition Readiness',
    clientName,
    generatedAt: result.generatedAt,
    summary: result.summary,
    kpis,
    sections: [
      { title: 'Roles', content: rolesContent },
      { title: 'Key Person Dependencies', content: depsContent },
      { title: 'Role Gaps', content: gapsContent },
      { title: 'Recommendations', content: recsContent },
    ],
  }

  return generateReportHtml(config)
}
