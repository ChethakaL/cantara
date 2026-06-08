import type {
  WS110Report,
  WS110Flag,
  InventoryDocument,
  EntityStandingRecord,
  UCCFiling,
  RegisteredAgentRecord,
  GoodStandingCertificate,
  TrademarkRecord,
  BuyerSummary,
} from '@/types/ws1-10-types'

export function parseWS110Markdown(
  markdown: string,
  clientName: string
): { report: WS110Report; flags: WS110Flag[] } {
  const sections = splitSections(markdown)

  const documents = parseDocumentTable(sections[1] ?? '')
  const entityStanding = parseEntityStanding(sections[2] ?? '')
  const uccFilings = parseUCCFilings(sections[3] ?? '')
  const registeredAgentStatus = parseRegisteredAgents(sections[4] ?? '')
  const goodStandingCertificates = parseGoodStanding(sections[5] ?? '')
  const trademarkRecords = parseTrademarks(sections[6] ?? '')
  const buyerSummary = parseBuyerSummary(sections[7] ?? '')
  const flags = parseFlags(sections[8] ?? '')

  return {
    report: {
      clientName,
      generatedAt: new Date().toISOString(),
      hitlStatus: 'in-progress',
      documents,
      entityStanding,
      uccFilings,
      registeredAgentStatus,
      goodStandingCertificates,
      trademarkRecords,
      buyerSummary,
    },
    flags,
  }
}

function splitSections(markdown: string): Record<number, string> {
  const result: Record<number, string> = {}
  const sectionRegex = /## SECTION (\d+)/g
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
    entitiesCovered: row[2] ?? '',
    date: row[3] ?? '',
    status: parseStatus(row[4]) as any,
    statusNote: row[4]?.includes('-') ? row[4].split('-').slice(1).join('-').trim() : '',
  }))
}

function parseEntityStanding(section: string): EntityStandingRecord[] {
  return parseStructuredBlocks(section, [
    'Entity Name', 'Entity Type', 'State of Formation', 'Filing Number',
    'Status', 'Last Annual Report', 'Registered Agent', 'Notes', 'Source Document',
  ]).map((block, i) => ({
    id: `entity-${i}`,
    entityName: block['Entity Name'] ?? '',
    entityType: block['Entity Type'] ?? '',
    stateOfFormation: block['State of Formation'] ?? '',
    filingNumber: block['Filing Number'] ?? '',
    status: normalizeEntityStatus(block['Status']),
    lastAnnualReportDate: block['Last Annual Report'] ?? '',
    registeredAgent: block['Registered Agent'] ?? '',
    notes: block['Notes'] ?? '',
    sourceRef: block['Source Document'] ?? '',
  }))
}

function parseUCCFilings(section: string): UCCFiling[] {
  return parseStructuredBlocks(section, [
    'Filing Number', 'Filing Date', 'Expiration Date', 'Debtor Name',
    'Secured Party', 'Collateral Description', 'Status', 'Amount', 'Source Document',
  ]).map((block, i) => ({
    id: `ucc-${i}`,
    filingNumber: block['Filing Number'] ?? '',
    filingDate: block['Filing Date'] ?? '',
    expirationDate: block['Expiration Date'] ?? '',
    debtorName: block['Debtor Name'] ?? '',
    securedParty: block['Secured Party'] ?? '',
    collateralDescription: block['Collateral Description'] ?? '',
    status: normalizeUCCStatus(block['Status']),
    amount: block['Amount'] ?? '',
    sourceRef: block['Source Document'] ?? '',
  }))
}

function parseRegisteredAgents(section: string): RegisteredAgentRecord[] {
  return parseStructuredBlocks(section, [
    'Entity Name', 'Registered Agent', 'Agent Address', 'Appointment Date',
    'Status', 'Notes', 'Source Document',
  ]).map((block, i) => ({
    id: `agent-${i}`,
    entityName: block['Entity Name'] ?? '',
    agentName: block['Registered Agent'] ?? '',
    agentAddress: block['Agent Address'] ?? '',
    appointmentDate: block['Appointment Date'] ?? '',
    status: normalizeAgentStatus(block['Status']),
    notes: block['Notes'] ?? '',
    sourceRef: block['Source Document'] ?? '',
  }))
}

function parseGoodStanding(section: string): GoodStandingCertificate[] {
  return parseStructuredBlocks(section, [
    'Entity Name', 'State', 'Certificate Date', 'Expiration Date',
    'Status', 'Notes', 'Source Document',
  ]).map((block, i) => ({
    id: `cert-${i}`,
    entityName: block['Entity Name'] ?? '',
    state: block['State'] ?? '',
    certificateDate: block['Certificate Date'] ?? '',
    expirationDate: block['Expiration Date'] ?? '',
    status: normalizeGoodStandingStatus(block['Status']),
    notes: block['Notes'] ?? '',
    sourceRef: block['Source Document'] ?? '',
  }))
}

function parseTrademarks(section: string): TrademarkRecord[] {
  return parseStructuredBlocks(section, [
    'Mark Name', 'Registration Number', 'Filing Date', 'Registration Date',
    'Expiration Date', 'Status', 'Class of Goods/Services', 'Owner', 'Notes', 'Source Document',
  ]).map((block, i) => ({
    id: `tm-${i}`,
    markName: block['Mark Name'] ?? '',
    registrationNumber: block['Registration Number'] ?? '',
    filingDate: block['Filing Date'] ?? '',
    registrationDate: block['Registration Date'] ?? '',
    expirationDate: block['Expiration Date'] ?? '',
    status: normalizeTrademarkStatus(block['Status']),
    classOfGoods: block['Class of Goods/Services'] ?? '',
    owner: block['Owner'] ?? '',
    notes: block['Notes'] ?? '',
    sourceRef: block['Source Document'] ?? '',
  }))
}

function parseBuyerSummary(section: string): BuyerSummary {
  const get = (label: string) => {
    const regex = new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+?)(?=\\n\\*\\*|\\n##|$)`, 's')
    const match = section.match(regex)
    return match?.[1]?.trim() ?? ''
  }

  const counselMatch = section.match(/\*\*Items Requiring.*?:\*\*\s*([\s\S]*?)(?=\n##|$)/)
  const counselItems = (counselMatch?.[1] ?? '')
    .split('\n')
    .map(line => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)

  return {
    entityStandingOverview: get('Entity Standing Overview'),
    uccExposureSummary: get('UCC Exposure Summary'),
    registeredAgentCompliance: get('Registered Agent Compliance'),
    goodStandingStatus: get('Good Standing Status'),
    trademarkProtection: get('Trademark Protection'),
    transitionConsiderations: get('Transition Considerations'),
    counselItems,
  }
}

function parseFlags(section: string): WS110Flag[] {
  const rows = parseTable(section)
  return rows.map((row, i) => ({
    id: `flag-${i}`,
    domain: normalizeDomain(row[0]),
    severity: getSeverity(row[1]),
    title: row[2] ?? '',
    description: row[2] ?? '',
    sourceRef: row[3] ?? '',
    status: 'pending' as const,
  }))
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
      const regex = new RegExp(`^\\*\\*${field.replace(/[/()]/g, '\\$&')}:\\*\\*\\s*(.*)`, 'i')
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

function normalizeEntityStatus(raw: string | undefined): EntityStandingRecord['status'] {
  const lower = (raw ?? '').toLowerCase()
  if (lower.includes('active')) return 'active'
  if (lower.includes('dissolved')) return 'dissolved'
  if (lower.includes('delinquent')) return 'delinquent'
  if (lower.includes('revoked')) return 'revoked'
  if (lower.includes('inactive')) return 'inactive'
  return 'unknown'
}

function normalizeUCCStatus(raw: string | undefined): UCCFiling['status'] {
  const lower = (raw ?? '').toLowerCase()
  if (lower.includes('active')) return 'active'
  if (lower.includes('terminated')) return 'terminated'
  if (lower.includes('expired')) return 'expired'
  if (lower.includes('amended')) return 'amended'
  return 'unknown'
}

function normalizeAgentStatus(raw: string | undefined): RegisteredAgentRecord['status'] {
  const lower = (raw ?? '').toLowerCase()
  if (lower.includes('current')) return 'current'
  if (lower.includes('expired')) return 'expired'
  if (lower.includes('changed')) return 'changed'
  return 'unknown'
}

function normalizeGoodStandingStatus(raw: string | undefined): GoodStandingCertificate['status'] {
  const lower = (raw ?? '').toLowerCase()
  if (lower.includes('valid')) return 'valid'
  if (lower.includes('expired')) return 'expired'
  if (lower.includes('not') && lower.includes('obtained')) return 'not-obtained'
  if (lower.includes('pending')) return 'pending'
  return 'unknown'
}

function normalizeTrademarkStatus(raw: string | undefined): TrademarkRecord['status'] {
  const lower = (raw ?? '').toLowerCase()
  if (lower.includes('registered') && !lower.includes('un')) return 'registered'
  if (lower.includes('pending')) return 'pending'
  if (lower.includes('abandoned')) return 'abandoned'
  if (lower.includes('cancelled')) return 'cancelled'
  if (lower.includes('expired')) return 'expired'
  return 'unknown'
}

function normalizeDomain(raw: string | undefined): WS110Flag['domain'] {
  const lower = (raw ?? '').toLowerCase()
  if (lower.includes('entity') || lower.includes('standing')) return 'entity-standing'
  if (lower.includes('ucc')) return 'ucc-filings'
  if (lower.includes('agent')) return 'registered-agent'
  if (lower.includes('good standing') || lower.includes('certificate')) return 'good-standing'
  if (lower.includes('trademark') || lower.includes('mark')) return 'trademark'
  return 'general'
}

function getSeverity(raw: string | undefined): WS110Flag['severity'] {
  const lower = (raw ?? '').toLowerCase()
  if (lower.includes('deal-risk') || lower.includes('deal risk')) return 'deal-risk'
  if (lower.includes('negotiation')) return 'negotiation'
  return 'informational'
}
