import type {
  WS111Report,
  WS111Flag,
  InventoryDocument,
  TaxReturnSummary,
  TaxLiability,
  AuditRecord,
  StateLocalTaxRecord,
  PayrollTaxRecord,
  DealImplication,
  BuyerSummary,
} from '@/types/ws1-11-types'

export function parseWS111Markdown(
  markdown: string,
  clientName: string
): { report: WS111Report; flags: WS111Flag[] } {
  const sections = splitSections(markdown)

  const documents = parseDocumentTable(sections[1] ?? '')
  const taxReturnSummary = parseTaxReturns(sections[2] ?? '')
  const outstandingLiabilities = parseLiabilities(sections[3] ?? '')
  const auditHistory = parseAudits(sections[4] ?? '')
  const stateLocalCompliance = parseStateLocal(sections[5] ?? '')
  const payrollTaxReview = parsePayroll(sections[6] ?? '')
  const dealStructureImplications = parseDealImplications(sections[7] ?? '')
  const buyerSummary = parseBuyerSummary(sections[8] ?? '')
  const flagSection =
    sections[9] ??
    Object.entries(sections).find(([, content]) => /flag summary/i.test(content))?.[1] ??
    ''
  const parsedFlags = parseFlags(flagSection, markdown)
  const flags =
    parsedFlags.length > 0
      ? parsedFlags
      : synthesizeFlagsFromReport({
          documents,
          taxReturnSummary,
          outstandingLiabilities,
          auditHistory,
          stateLocalCompliance,
          payrollTaxReview,
          dealStructureImplications,
        })

  return {
    report: {
      clientName,
      generatedAt: new Date().toISOString(),
      hitlStatus: 'in-progress',
      documents,
      taxReturnSummary,
      outstandingLiabilities,
      auditHistory,
      stateLocalCompliance,
      payrollTaxReview,
      dealStructureImplications,
      buyerSummary,
    },
    flags,
  }
}

function splitSections(markdown: string): Record<number, string> {
  const result: Record<number, string> = {}
  const sectionRegex = /^#{1,3}\s*SECTION\s*(\d+)/gim
  let match: RegExpExecArray | null
  const positions: Array<{ num: number; start: number }> = []

  while ((match = sectionRegex.exec(markdown)) !== null) {
    positions.push({ num: parseInt(match[1], 10), start: match.index })
  }

  for (let i = 0; i < positions.length; i++) {
    const end = i + 1 < positions.length ? positions[i + 1].start : markdown.length
    result[positions[i].num] = markdown.slice(positions[i].start, end)
  }

  return result
}

function parseDocumentTable(section: string): InventoryDocument[] {
  const rows = parseTable(section)
  return rows.map((row, i) => ({
    id: `doc-${i}`,
    filename: row[0] ?? '',
    docType: row[1] ?? '',
    taxYearsCovered: row[2] ?? '',
    date: row[3] ?? '',
    status: parseStatus(row[4]) as any,
    statusNote: row[4]?.includes('-') ? row[4].split('-').slice(1).join('-').trim() : '',
  }))
}

function parseTaxReturns(section: string): TaxReturnSummary[] {
  return parseStructuredBlocks(section, [
    'Tax Year', 'Entity Name', 'Return Type', 'Filing Status', 'Filing Date',
    'Gross Revenue', 'Taxable Income', 'Total Tax Due', 'Total Tax Paid',
    'Balance Due', 'Notes', 'Source Document',
  ]).map((block, i) => ({
    id: `return-${i}`,
    taxYear: block['Tax Year'] ?? '',
    entityName: block['Entity Name'] ?? '',
    returnType: block['Return Type'] ?? '',
    filingStatus: normalizeFilingStatus(block['Filing Status']),
    filingDate: block['Filing Date'] ?? '',
    grossRevenue: block['Gross Revenue'] ?? '',
    taxableIncome: block['Taxable Income'] ?? '',
    totalTaxDue: block['Total Tax Due'] ?? '',
    totalTaxPaid: block['Total Tax Paid'] ?? '',
    balanceDue: block['Balance Due'] ?? block['Balance Due / (Refund)'] ?? '',
    notes: block['Notes'] ?? '',
    sourceRef: block['Source Document'] ?? '',
  }))
}

function parseLiabilities(section: string): TaxLiability[] {
  return parseStructuredBlocks(section, [
    'Type', 'Description', 'Tax Year', 'Original Amount', 'Current Balance',
    'Penalties & Interest', 'Payment Plan', 'Payment Plan Details', 'Status',
    'Tax Lien Filed', 'Source Document',
  ]).map((block, i) => ({
    id: `liability-${i}`,
    type: normalizeLiabilityType(block['Type']),
    description: block['Description'] ?? '',
    taxYear: block['Tax Year'] ?? block['Tax Year(s)'] ?? '',
    originalAmount: block['Original Amount'] ?? '',
    currentBalance: block['Current Balance'] ?? '',
    penaltiesInterest: block['Penalties & Interest'] ?? '',
    paymentPlan: normalizeYesNo(block['Payment Plan']),
    paymentPlanDetails: block['Payment Plan Details'] ?? '',
    status: normalizeLiabilityStatus(block['Status']),
    lienFiled: normalizeYesNo(block['Tax Lien Filed']),
    sourceRef: block['Source Document'] ?? '',
  }))
}

function parseAudits(section: string): AuditRecord[] {
  return parseStructuredBlocks(section, [
    'Tax Authority', 'Tax Year', 'Audit Type', 'Status',
    'Adjustment Amount', 'Additional Tax Assessed', 'Penalties',
    'Outcome', 'Date Initiated', 'Date Closed', 'Source Document',
  ]).map((block, i) => ({
    id: `audit-${i}`,
    taxAuthority: block['Tax Authority'] ?? '',
    taxYearsAudited: block['Tax Year'] ?? block['Tax Year(s) Audited'] ?? block['Tax Years Audited'] ?? '',
    auditType: block['Audit Type'] ?? '',
    status: normalizeAuditStatus(block['Status']),
    adjustmentAmount: block['Adjustment Amount'] ?? '',
    additionalTaxAssessed: block['Additional Tax Assessed'] ?? '',
    penalties: block['Penalties'] ?? block['Penalties Assessed'] ?? '',
    outcome: block['Outcome'] ?? '',
    dateInitiated: block['Date Initiated'] ?? '',
    dateClosed: block['Date Closed'] ?? '',
    sourceRef: block['Source Document'] ?? '',
  }))
}

function parseStateLocal(section: string): StateLocalTaxRecord[] {
  return parseStructuredBlocks(section, [
    'State', 'Tax Type', 'Filing Status', 'Nexus Established',
    'Last Filed Year', 'Outstanding Balance', 'Notes', 'Source Document',
  ]).map((block, i) => ({
    id: `state-${i}`,
    state: block['State'] ?? '',
    taxType: block['Tax Type'] ?? '',
    filingStatus: normalizeStateFilingStatus(block['Filing Status']),
    nexusEstablished: normalizeYesNo(block['Nexus Established']),
    lastFiledYear: block['Last Filed Year'] ?? '',
    outstandingBalance: block['Outstanding Balance'] ?? '',
    notes: block['Notes'] ?? '',
    sourceRef: block['Source Document'] ?? '',
  }))
}

function parsePayroll(section: string): PayrollTaxRecord[] {
  return parseStructuredBlocks(section, [
    'Period', 'Type', 'Status', 'Amount Due', 'Amount Paid',
    'Balance', 'Trust Fund Issue', 'Notes', 'Source Document',
  ]).map((block, i) => ({
    id: `payroll-${i}`,
    period: block['Period'] ?? '',
    type: block['Type'] ?? '',
    status: normalizePayrollStatus(block['Status']),
    amountDue: block['Amount Due'] ?? '',
    amountPaid: block['Amount Paid'] ?? '',
    balance: block['Balance'] ?? '',
    trustFundIssue: normalizeYesNo(block['Trust Fund Issue']),
    notes: block['Notes'] ?? '',
    sourceRef: block['Source Document'] ?? '',
  }))
}

function parseDealImplications(section: string): DealImplication[] {
  return parseStructuredBlocks(section, [
    'Area', 'Risk Level', 'Description', 'Estimated Exposure',
    'Recommended Action', 'Deal Structure Impact', 'Source Document',
  ]).map((block, i) => ({
    id: `deal-${i}`,
    area: block['Area'] ?? '',
    risk: normalizeRisk(block['Risk Level']),
    description: block['Description'] ?? '',
    estimatedExposure: block['Estimated Exposure'] ?? '',
    recommendedAction: block['Recommended Action'] ?? '',
    dealStructureImpact: block['Deal Structure Impact'] ?? '',
    sourceRef: block['Source Document'] ?? '',
  }))
}

function parseBuyerSummary(section: string): BuyerSummary {
  const get = (label: string) => {
    const regex = new RegExp(`\\*\\*${label.replace(/[/()]/g, '\\$&')}:\\*\\*\\s*(.+?)(?=\\n\\*\\*|\\n##|$)`, 's')
    const match = section.match(regex)
    return match?.[1]?.trim() ?? ''
  }

  const counselMatch = section.match(/\*\*Items Requiring.*?:\*\*\s*([\s\S]*?)(?=\n##|$)/)
  const counselItems = (counselMatch?.[1] ?? '')
    .split('\n')
    .map(line => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)

  return {
    overallTaxHealthAssessment: get('Overall Tax Health Assessment'),
    outstandingLiabilitySummary: get('Outstanding Liability Summary'),
    auditRiskAssessment: get('Audit Risk Assessment'),
    stateComplianceOverview: get('State & Local Compliance Overview') || get('State Compliance Overview'),
    payrollTaxStatus: get('Payroll Tax Status'),
    dealStructureRecommendations: get('Deal Structure Recommendations'),
    estimatedTotalExposure: get('Estimated Total Tax Exposure') || get('Estimated Total Exposure'),
    transitionConsiderations: get('Transition Considerations'),
    counselItems,
  }
}

function parseFlags(section: string, fullMarkdown = ''): WS111Flag[] {
  const fromTable = parseTable(section)
  if (fromTable.length) {
    return fromTable.map((row, i) => ({
      id: `flag-${i}`,
      domain: normalizeFlagDomain(row[0]),
      severity: getSeverity(row[1]),
      title: row[2] ?? '',
      description: row[2] ?? '',
      sourceRef: row[3] ?? '',
      status: 'pending' as const,
    }))
  }

  const bulletSource = section.trim() || extractFlagSummaryBlock(fullMarkdown)
  const bulletFlags = bulletSource
    .split('\n')
    .map(line => line.trim())
    .filter(line => /^[-*]\s+/.test(line))
    .map((line, i) => {
      const text = line.replace(/^[-*]\s+/, '').trim()
      const severityMatch = text.match(/\*\*(deal-risk|negotiation|informational)\*\*/i)
      const severity = getSeverity(severityMatch?.[1])
      const cleaned = text.replace(/\*\*(deal-risk|negotiation|informational)\*\*:?\s*/i, '').trim()
      return {
        id: `flag-bullet-${i}`,
        domain: normalizeFlagDomain(cleaned),
        severity,
        title: cleaned,
        description: cleaned,
        sourceRef: '',
        status: 'pending' as const,
      }
    })
    .filter(flag => flag.title.length > 0 && !/^no (material )?flags/i.test(flag.title))

  return bulletFlags
}

function synthesizeFlagsFromReport(report: {
  documents: InventoryDocument[]
  taxReturnSummary: TaxReturnSummary[]
  outstandingLiabilities: TaxLiability[]
  auditHistory: AuditRecord[]
  stateLocalCompliance: StateLocalTaxRecord[]
  payrollTaxReview: PayrollTaxRecord[]
  dealStructureImplications: DealImplication[]
}): WS111Flag[] {
  const flags: WS111Flag[] = []
  let id = 0

  const add = (flag: Omit<WS111Flag, 'id' | 'status'>) => {
    flags.push({ ...flag, id: `flag-synth-${id++}`, status: 'pending' })
  }

  const trustFundQuarters = report.payrollTaxReview.filter(p => p.trustFundIssue === 'yes')
  if (trustFundQuarters.length) {
    const periods = trustFundQuarters.map(p => p.period.replace(/^Period:\s*/i, '')).join(', ')
    add({
      domain: 'payroll',
      severity: 'deal-risk',
      title: `Payroll trust fund deficiency — ${periods}`,
      description: trustFundQuarters
        .map(p => `${p.period}: balance ${p.balance}; ${p.notes}`.trim())
        .join(' '),
      sourceRef: trustFundQuarters[0]?.sourceRef ?? '',
    })
  }

  for (const liability of report.outstandingLiabilities) {
    if (isResolvedLiability(liability)) continue
    const text = `${liability.description} ${liability.status} ${liability.currentBalance}`.toLowerCase()
    const severity =
      liability.type === 'payroll' || /trust fund|tfrp/.test(text)
        ? 'deal-risk'
        : /contingent|risk/.test(text)
          ? 'negotiation'
          : 'negotiation'
    add({
      domain:
        liability.type === 'payroll'
          ? 'payroll'
          : liability.type === 'sales-tax' || liability.type === 'state'
            ? 'state-local'
            : 'outstanding-liabilities',
      severity,
      title: liability.description.slice(0, 120) || 'Outstanding tax liability',
      description: [liability.taxYear, liability.currentBalance, liability.penaltiesInterest]
        .filter(Boolean)
        .join(' — '),
      sourceRef: liability.sourceRef,
    })
  }

  for (const audit of report.auditHistory) {
    if (audit.status === 'closed-no-change' || audit.status === 'closed-adjustment') continue
    const text = `${audit.status} ${audit.outcome} ${audit.adjustmentAmount}`.toLowerCase()
    if (audit.status !== 'in-progress' && !/open|urgent|dispute|partially|proposed|npa/.test(text)) continue
    add({
      domain: 'audit',
      severity: /trust fund|tfrp|criminal/.test(text) ? 'deal-risk' : 'negotiation',
      title: `${audit.taxAuthority} — ${audit.taxYearsAudited}`.trim(),
      description: audit.outcome || audit.adjustmentAmount || audit.additionalTaxAssessed,
      sourceRef: audit.sourceRef,
    })
  }

  for (const state of report.stateLocalCompliance) {
    const balance = state.outstandingBalance.replace(/[^0-9.]/g, '')
    if (!balance || parseFloat(balance) <= 0) continue
    if (state.filingStatus === 'current' && !state.outstandingBalance.match(/\$[1-9]/)) continue
    add({
      domain: 'state-local',
      severity: 'negotiation',
      title: `${state.state} ${state.taxType} — outstanding balance`,
      description: state.outstandingBalance,
      sourceRef: state.sourceRef,
    })
  }

  for (const deal of report.dealStructureImplications) {
    if (deal.risk === 'low') continue
    add({
      domain: 'deal-structure',
      severity: deal.risk === 'high' ? 'deal-risk' : 'negotiation',
      title: deal.area || 'Deal structure implication',
      description: deal.description,
      sourceRef: deal.sourceRef,
    })
  }

  const incompleteDocs = report.documents.filter(d => d.status === 'incomplete' || d.status === 'missing')
  if (incompleteDocs.length > 0) {
    add({
      domain: 'tax-returns',
      severity: 'informational',
      title: 'Source documents incomplete or not directly uploaded',
      description: `${incompleteDocs.length} document(s) marked incomplete or missing; verify figures against filed returns and transcripts.`,
      sourceRef: incompleteDocs[0]?.filename ?? '',
    })
  }

  return dedupeFlags(flags)
}

function isResolvedLiability(liability: TaxLiability): boolean {
  if (liability.status === 'resolved') return true
  const text = `${liability.description} ${liability.currentBalance}`.toLowerCase()
  if (/open|disputed|outstanding|urgent|partially paid|contingent/.test(text)) return false
  return /paid in full|likely resolved|no deficiency identified/.test(text)
}

function dedupeFlags(flags: WS111Flag[]): WS111Flag[] {
  const seen = new Set<string>()
  return flags.filter(flag => {
    const key = `${flag.domain}|${flag.title.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function extractFlagSummaryBlock(markdown: string): string {
  const match = markdown.match(/##\s*SECTION\s*\d+\s*[—-]?\s*FLAG SUMMARY[\s\S]*?(?=\n##\s*SECTION|\n#\s|$)/i)
  return match?.[0] ?? ''
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseTable(section: string): string[][] {
  const lines = section.split('\n').filter(l => l.trim().startsWith('|'))
  if (lines.length < 3) return []
  return lines.slice(2).map(line =>
    line.split('|').slice(1, -1).map(cell => cell.trim())
  )
}

function parseStructuredBlocks(section: string, fields: string[]): Record<string, string>[] {
  const blocks: Record<string, string>[] = []
  let current: Record<string, string> | null = null

  for (const line of section.split('\n')) {
    for (const field of fields) {
      const escaped = field.replace(/[/()]/g, '\\$&')
      const regex = new RegExp(`^\\*\\*${escaped}:\\*\\*\\s*(.*)`, 'i')
      const match = line.match(regex)
      if (match) {
        if (field === fields[0] && current) {
          blocks.push(current)
        }
        if (field === fields[0]) {
          current = {}
        }
        if (current) {
          current[field] = match[1].trim()
        }
        break
      }
    }
  }
  if (current && Object.keys(current).length > 0) blocks.push(current)

  return blocks
}

function parseStatus(raw: string | undefined): 'complete' | 'incomplete' | 'missing' {
  const lower = (raw ?? '').toLowerCase()
  if (lower.includes('complete') && !lower.includes('incomplete')) return 'complete'
  if (lower.includes('missing')) return 'missing'
  return 'incomplete'
}

function normalizeFilingStatus(raw: string | undefined): TaxReturnSummary['filingStatus'] {
  const lower = (raw ?? '').toLowerCase()
  if (lower.includes('late')) return 'late-filed'
  if (lower.includes('extended') || lower.includes('extension')) return 'extended'
  if (lower.includes('not filed') || lower.includes('unfiled')) return 'not-filed'
  if (lower.includes('filed')) return 'filed'
  return 'unknown'
}

function normalizeLiabilityType(raw: string | undefined): TaxLiability['type'] {
  const lower = (raw ?? '').toLowerCase()
  if (lower.includes('federal')) return 'federal'
  if (lower.includes('payroll')) return 'payroll'
  if (lower.includes('sales')) return 'sales-tax'
  if (lower.includes('property')) return 'property-tax'
  if (lower.includes('local')) return 'local'
  if (lower.includes('state')) return 'state'
  return 'other'
}

function normalizeLiabilityStatus(raw: string | undefined): TaxLiability['status'] {
  const lower = (raw ?? '').toLowerCase()
  if (lower.includes('outstanding')) return 'outstanding'
  if (lower.includes('collection')) return 'in-collection'
  if (lower.includes('appeal')) return 'under-appeal'
  if (lower.includes('resolved') || lower.includes('paid in full')) return 'resolved'
  if (lower.includes('open') || lower.includes('disputed') || lower.includes('partially paid')) {
    return 'outstanding'
  }
  return 'unknown'
}

function normalizeAuditStatus(raw: string | undefined): AuditRecord['status'] {
  const lower = (raw ?? '').toLowerCase()
  if (lower.includes('open') || lower.includes('in progress') || lower.includes('in-progress')) {
    return 'in-progress'
  }
  if (lower.includes('no change') || lower.includes('no-change')) return 'closed-no-change'
  if (lower.includes('closed') && !lower.includes('not closed')) return 'closed-adjustment'
  if (lower.includes('proposed') || lower.includes('npa')) return 'in-progress'
  return 'unknown'
}

function normalizeStateFilingStatus(raw: string | undefined): StateLocalTaxRecord['filingStatus'] {
  const lower = (raw ?? '').toLowerCase()
  if (lower.includes('current')) return 'current'
  if (lower.includes('delinquent') || lower.includes('late')) return 'delinquent'
  if (lower.includes('exempt')) return 'exempt'
  if (lower.includes('not registered') || lower.includes('not-registered')) return 'not-registered'
  return 'unknown'
}

function normalizePayrollStatus(raw: string | undefined): PayrollTaxRecord['status'] {
  const lower = (raw ?? '').toLowerCase()
  if (lower.includes('current')) return 'current'
  if (lower.includes('delinquent') || lower.includes('late')) return 'delinquent'
  if (lower.includes('penalty')) return 'penalty-assessed'
  return 'unknown'
}

function normalizeRisk(raw: string | undefined): DealImplication['risk'] {
  const lower = (raw ?? '').toLowerCase()
  if (lower.includes('high')) return 'high'
  if (lower.includes('medium') || lower.includes('moderate')) return 'medium'
  return 'low'
}

function normalizeYesNo(raw: string | undefined): 'yes' | 'no' | 'unknown' {
  const lower = (raw ?? '').toLowerCase()
  if (lower.includes('yes')) return 'yes'
  if (lower.includes('no')) return 'no'
  return 'unknown'
}

function normalizeFlagDomain(raw: string | undefined): WS111Flag['domain'] {
  const lower = (raw ?? '').toLowerCase()
  if (lower.includes('return')) return 'tax-returns'
  if (lower.includes('liability') || lower.includes('outstanding')) return 'outstanding-liabilities'
  if (lower.includes('audit')) return 'audit'
  if (lower.includes('state') || lower.includes('local')) return 'state-local'
  if (lower.includes('payroll')) return 'payroll'
  if (lower.includes('deal')) return 'deal-structure'
  return 'general'
}

function getSeverity(raw: string | undefined): WS111Flag['severity'] {
  const lower = (raw ?? '').toLowerCase()
  if (lower.includes('deal-risk') || lower.includes('deal risk')) return 'deal-risk'
  if (lower.includes('negotiation')) return 'negotiation'
  return 'informational'
}
