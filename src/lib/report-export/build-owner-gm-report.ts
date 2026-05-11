import {
  generateReportHtml,
  buildInfoGrid,
  buildBulletList,
  buildHtmlTable,
  type ReportConfig,
} from './generate-report-html'

import type { OwnerGmAssessment } from '@/lib/owner-gm-assessment/types'

export function buildOwnerGmReportHtml(
  assessment: OwnerGmAssessment,
  clientName: string,
): string {
  // ── Owner Profiles section ──
  const ownerRows = assessment.owners.map(o => [
    o.name || 'Unknown',
    o.title || '—',
    o.role || '—',
    o.hoursPerWeek != null ? `${o.hoursPerWeek}` : '—',
    o.criticalHoursPerWeek != null ? `${o.criticalHoursPerWeek}` : '—',
    o.postCloseIntention || '—',
    o.dependencyRating,
  ])
  const ownerTable = buildHtmlTable(
    ['Name', 'Title', 'Role', 'Hrs/Wk', 'Critical Hrs', 'Post-Close', 'Dependency'],
    ownerRows,
  )

  // Owner detail cards
  const ownerDetails = assessment.owners.map(o => {
    const pairs = [
      { label: 'Post-Close Role', value: o.postCloseRole || '—' },
      { label: 'Post-Close Duration', value: o.postCloseDuration || '—' },
      { label: 'Stay Required', value: o.stayRequired === true ? 'Yes' : o.stayRequired === false ? 'No' : 'Unknown' },
      { label: 'Replacement Experience', value: o.replacementExperience || '—' },
      { label: 'Replacement Hours/Wk', value: o.replacementHours != null ? `${o.replacementHours}` : '—' },
      { label: 'Internal Successor', value: o.internalSuccessor || '—' },
      { label: 'External Hire Cost', value: o.externalHireCost || '—' },
    ]
    const grid = buildInfoGrid(pairs)
    const relationships = o.criticalRelationships?.length
      ? `<p style="font-weight:700;margin-top:12px;">Critical Relationships</p>` + buildBulletList(o.criticalRelationships)
      : ''
    const replacementRoles = o.replacementRoles?.length
      ? `<p style="font-weight:700;margin-top:12px;">Replacement Roles Needed</p>` + buildBulletList(o.replacementRoles)
      : ''
    const notes = o.dependencyNotes
      ? `<p style="font-weight:700;margin-top:12px;">Dependency Notes</p><p>${o.dependencyNotes}</p>`
      : ''

    return `<p style="font-weight:700;font-size:14px;margin-top:16px;">${o.name || 'Owner'} — ${o.dependencyRating} Dependency</p>${grid}${relationships}${replacementRoles}${notes}`
  }).join('')

  const ownerContent = ownerTable + ownerDetails

  // ── GM Profile section ──
  const gm = assessment.gm
  const gmPairs = [
    { label: 'In Place', value: gm.inPlace ? 'Yes' : 'No' },
    { label: 'Name', value: gm.name || '—' },
    { label: 'Full/Part Time', value: gm.fullOrPartTime || '—' },
    { label: 'Total Tenure', value: gm.totalTenure || '—' },
    { label: 'GM Tenure', value: gm.gmTenure || '—' },
    { label: 'Hourly/Salaried', value: gm.hourlyOrSalaried || '—' },
    { label: 'Compensation', value: gm.compensation || '—' },
    { label: 'Market Aligned', value: gm.marketAligned || '—' },
    { label: 'Content with Comp', value: gm.contentWithComp === true ? 'Yes' : gm.contentWithComp === false ? 'No' : 'Unknown' },
    { label: 'Independence Score', value: gm.independenceScore != null ? `${gm.independenceScore}/10` : '—' },
    { label: 'Aware of Sale', value: gm.awareOfSale === true ? 'Yes' : gm.awareOfSale === false ? 'No' : 'Unknown' },
    { label: 'Supportive of Sale', value: gm.supportive === true ? 'Yes' : gm.supportive === false ? 'No' : 'Unknown' },
    { label: 'Retention Commitment', value: gm.retentionCommitment || '—' },
    { label: 'Retention Risk', value: gm.retentionRiskRating || '—' },
  ]
  const gmGrid = buildInfoGrid(gmPairs)
  const gmDayToDay = gm.dayToDayOwnership
    ? `<p style="font-weight:700;margin-top:12px;">Day-to-Day Ownership</p><p>${gm.dayToDayOwnership}</p>`
    : ''
  const gmStrengths = gm.strengths?.length
    ? `<p style="font-weight:700;margin-top:12px;">Strengths</p>` + buildBulletList(gm.strengths)
    : ''
  const gmGaps = gm.gaps?.length
    ? `<p style="font-weight:700;margin-top:12px;">Gaps / Development Areas</p>` + buildBulletList(gm.gaps)
    : ''
  const gmSolo = gm.soloExperience
    ? `<p style="font-weight:700;margin-top:12px;">Solo Experience</p><p>${gm.soloExperience}</p>` +
      (gm.soloOutcome ? `<p><em>Outcome:</em> ${gm.soloOutcome}</p>` : '')
    : ''
  const gmHesitations = gm.hesitations?.length
    ? `<p style="font-weight:700;margin-top:12px;">Hesitations</p>` + buildBulletList(gm.hesitations)
    : ''
  const gmRetentionNotes = gm.retentionNotes
    ? `<p style="font-weight:700;margin-top:12px;">Retention Notes</p><p>${gm.retentionNotes}</p>`
    : ''

  const gmContent = gmGrid + gmDayToDay + gmStrengths + gmGaps + gmSolo + gmHesitations + gmRetentionNotes

  // ── Senior Team section ──
  const teamRows = assessment.seniorTeam.map(m => [
    m.name || '—',
    m.title || '—',
    m.tenure || '—',
    m.responsibilities || '—',
    m.hourlyOrSalaried || '—',
    m.couldStepUp === true ? 'Yes' : m.couldStepUp === false ? 'No' : '—',
  ])
  const teamContent = teamRows.length
    ? buildHtmlTable(['Name', 'Title', 'Tenure', 'Responsibilities', 'Type', 'Could Step Up'], teamRows)
    : '<p>No senior team members identified in transcript.</p>'

  // ── Flags section ──
  const severityOrder: Record<string, number> = { 'deal-risk': 0, negotiation: 1, informational: 2, positive: 3 }
  const sortedFlags = [...(assessment.flags || [])].sort(
    (a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9),
  )
  const flagColorMap: Record<string, string> = {
    'deal-risk': 'red',
    negotiation: 'orange',
    positive: 'green',
    informational: 'orange',
  }
  const flagsContent = sortedFlags.length
    ? sortedFlags.map(f => {
        const color = flagColorMap[f.severity] || 'orange'
        return `<div class="flag-item ${color}"><div class="flag-title">[${f.section}] ${f.title}</div><div class="flag-detail">${f.description}</div></div>`
      }).join('\n')
    : '<p>No flags generated.</p>'

  // ── Recommendations ──
  const recsContent = assessment.recommendations?.length
    ? `<ol style="margin:8px 0 12px 18px;padding:0;font-size:12px;color:#475569;line-height:1.7;">${assessment.recommendations.map((r, i) => `<li style="margin-bottom:6px;">${r}</li>`).join('')}</ol>`
    : '<p>No recommendations generated.</p>'

  // ── Counsel Items ──
  const counselContent = assessment.counselItems?.length
    ? buildBulletList(assessment.counselItems)
    : '<p>No counsel items generated.</p>'

  const config: ReportConfig = {
    title: 'Owner & GM Involvement Assessment',
    subtitle: 'Transition Readiness & Dependency Analysis',
    clientName,
    generatedAt: assessment.generatedAt || new Date().toISOString(),
    summary: assessment.executiveSummary,
    kpis: [
      { label: 'Owner Dependency', value: assessment.ownerDependencyRating },
      { label: 'GM Retention Risk', value: assessment.gmRetentionRisk },
      { label: 'Bench Strength', value: assessment.benchStrength },
      { label: 'Transition Readiness', value: assessment.overallTransitionReadiness },
    ],
    sections: [
      { title: 'Owner Profiles', content: ownerContent },
      { title: 'General Manager Profile', content: gmContent },
      { title: 'Senior Management Bench', content: teamContent },
      { title: 'Assessment Flags', content: flagsContent },
      { title: 'Recommendations', content: recsContent },
      { title: 'Counsel Items', content: counselContent },
    ],
  }

  return generateReportHtml(config)
}
