import type { WS19Report, WS19Flag } from '@/types/ws1-9-types'

function md(value: unknown) {
  return String(value ?? '').replace(/\|/g, '/').replace(/\n/g, ' ').trim()
}

function table(rows: string[][]) {
  if (rows.length === 0) return '_No rows._'
  return rows.map(row => `| ${row.map(md).join(' | ')} |`).join('\n')
}

export function serializeWS19Report(report: WS19Report, flags: WS19Flag[]) {
  const bs = report.buyerSummary

  const s3 = report.zoning.length
    ? report.zoning
        .map(
          z => `**Property Address:** ${md(z.propertyAddress)}
**Zoning Designation:** ${md(z.zoningDesignation)}
**Permitted Uses:**
${z.permittedUses.map(u => `- ${md(u)}`).join('\n') || '- Not specified'}
**Current Use:** ${md(z.currentUse)}
**Compliance Status:** ${md(z.complianceStatus)}
**Restrictions:**
- Setback: ${md(z.setbacks)}
- Parking: ${md(z.parkingRequirements)}
- Noise: ${md(z.noiseOrdinance)}
${z.restrictions.map(r => `- ${md(r)}`).join('\n')}
**Source:** ${md(z.sourceRef)}`
        )
        .join('\n\n')
    : 'No zoning records found.'

  const s4 = report.conditionalUsePermits.length
    ? report.conditionalUsePermits
        .map(
          cup => `**CUP Number:** ${md(cup.cupNumber)}
**Issuing Authority:** ${md(cup.issuingAuthority)}
**Issue Date:** ${md(cup.issueDate)}
**Approved Use:** ${md(cup.approvedUse)}
**Conditions of Approval:**
${cup.conditions.map(c => `- ${md(c)}`).join('\n') || '- None listed'}
**Compliance Status:** ${md(cup.complianceStatus)}
**Renewal Required:** ${cup.renewalRequired ? 'Yes' : 'No'}
**Renewal Date:** ${md(cup.renewalDate)}
**Transferability:** ${md(cup.transferability)}
**Source:** ${md(cup.sourceRef)}`
        )
        .join('\n\n')
    : 'No conditional use permits identified in uploaded documents.'

  const s5 = report.grandfathering.length
    ? report.grandfathering
        .map(
          gf => `**Non-Conforming Use:** ${md(gf.nonConformingUse)}
**Original Approval/Establishment Date:** ${md(gf.originalApprovalDate)}
**Current Legal Basis:** ${md(gf.currentBasis)}
**Trigger Events:**
${gf.triggerEvents.map(t => `- ${md(t)}`).join('\n') || '- None listed'}
**Risk Level:** ${md(gf.riskLevel)}
**Mitigation Options:** ${md(gf.mitigationOptions)}
**Source:** ${md(gf.sourceRef)}`
        )
        .join('\n\n')
    : 'No non-conforming use or grandfathering issues identified in uploaded documents.'

  return `# BUSINESS PERMITS & ZONING REPORT
**${report.clientName}**

---

## SECTION 1 — DOCUMENT INVENTORY

${table([
  ['Document Name', 'Document Type', 'Issuing Authority', 'Date', 'Completeness Flag'],
  ['---', '---', '---', '---', '---'],
  ...report.documents.map(doc => [
    doc.filename,
    doc.docType,
    doc.issuingAuthority,
    doc.date,
    doc.statusNote ? `${doc.status} - ${doc.statusNote}` : doc.status,
  ]),
])}

## SECTION 2 — PERMIT INVENTORY

${table([
  ['Permit Type', 'Permit Number', 'Issuing Authority', 'Issue Date', 'Expiration Date', 'Status', 'Renewal Process', 'Conditions', 'Source Reference'],
  ['---', '---', '---', '---', '---', '---', '---', '---', '---'],
  ...report.permits.map(p => [
    p.permitType,
    p.permitNumber,
    p.issuingAuthority,
    p.issueDate,
    p.expirationDate,
    p.status,
    p.renewalProcess,
    p.conditions,
    p.sourceRef,
  ]),
])}

## SECTION 3 — ZONING ANALYSIS

${s3}

## SECTION 4 — CONDITIONAL USE PERMITS

${s4}

## SECTION 5 — GRANDFATHERING & NON-CONFORMING USE ANALYSIS

${s5}

## SECTION 6 — BUYER-FACING SUMMARY

**Permits Overview:** ${md(bs.permitsOverview)}

**Zoning Compliance:** ${md(bs.zoningCompliance)}

**Conditional Use Permit Status:** ${md(bs.conditionalUseStatus)}

**Grandfathering Risk:** ${md(bs.grandfatheringRisk)}

**Transfer Considerations:** ${md(bs.transferConsiderations)}

**Items Requiring Buyer's Land Use Counsel Review:**
${(bs.counselItems ?? []).map(item => `- ${md(item)}`).join('\n')}

## SECTION 7 — FLAGS SUMMARY

${table([
  ['Domain', 'Flag Severity', 'Flag Description', 'Source Reference'],
  ['---', '---', '---', '---'],
  ...flags.map(flag => [flag.domain, flag.severity, flag.description || flag.title, flag.sourceRef]),
])}
`
}
