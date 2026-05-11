import type {
  WS18Report,
  WS18Flag,
  FlagSeverity,
  InventoryDocument,
  EntityRow,
  OwnershipStake,
  EncumbranceRow,
  StateFilingRow,
  BuyerSummary,
  EncumbranceStatus,
  FilingStatus,
  ComplianceStatus,
} from '@/types/ws1-8-types'

/**
 * Parses the raw Markdown report into the structured JSON object for UI tabs.
 */
export function parseWS18Markdown(markdown: string, clientName: string): { report: Partial<WS18Report>; flags: WS18Flag[] } {
  const report: Partial<WS18Report> = {
    clientName,
    generatedAt: new Date().toISOString(),
    documents: [],
    entities: [],
    ownershipStakes: [],
    encumbrances: [],
    stateFilings: [],
  }

  const flags: WS18Flag[] = []

  const getValue = (row: Record<string, any>, ...keys: string[]) => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
        return String(row[key]).trim()
      }
    }
    return ''
  }

  const parseSeverity = (value: string): FlagSeverity => {
    const normalized = clean(value).toLowerCase()
    if (normalized.includes('deal') || normalized.includes('red')) return 'deal-risk'
    if (normalized.includes('negotiation') || normalized.includes('amber') || normalized.includes('yellow')) return 'negotiation'
    if (normalized.includes('positive') || normalized.includes('green')) return 'positive'
    return 'informational'
  }

  const parseEncumbranceStatus = (value: string): EncumbranceStatus => {
    const normalized = clean(value).toLowerCase()
    if (normalized.includes('active')) return 'active'
    if (normalized.includes('released')) return 'released'
    if (normalized.includes('expired')) return 'expired'
    return 'unknown'
  }

  const parseFilingStatus = (value: string): FilingStatus => {
    const normalized = clean(value).toLowerCase()
    if (normalized.includes('active')) return 'active'
    if (normalized.includes('expired')) return 'expired'
    if (normalized.includes('pending')) return 'pending'
    return 'unknown'
  }

  const parseComplianceStatus = (value: string): ComplianceStatus => {
    const normalized = clean(value).toLowerCase()
    if (normalized.includes('non-compliant') || normalized.includes('noncompliant')) return 'non-compliant'
    if (normalized.includes('compliant')) return 'compliant'
    if (normalized.includes('unclear')) return 'unclear'
    return 'unknown'
  }

  const normalizeDomain = (value: string): WS18Flag['domain'] => {
    const normalized = clean(value).toLowerCase()
    if (normalized.includes('entity') || normalized.includes('structure')) return 'Entity-Structure'
    if (normalized.includes('ownership')) return 'Ownership'
    if (normalized.includes('encumbrance') || normalized.includes('lien') || normalized.includes('ucc')) return 'Encumbrances'
    if (normalized.includes('state') || normalized.includes('filing') || normalized.includes('compliance')) return 'State-Filings'
    return 'General'
  }

  const parseTable = (text: string) => {
    const lines = text.trim().split('\n')
    const tableStartIndex = lines.findIndex(l => l.includes('|'))
    if (tableStartIndex === -1) return []
    const headerLine = lines[tableStartIndex]
    const bodyLines = lines.slice(tableStartIndex + 2) // skip header separator
    const headers = headerLine.split('|').map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')).filter(Boolean)
    return bodyLines
      .filter(line => line.includes('|'))
      .map(line => {
        const parts = line.split('|').map(c => c.replace(/\*\*/g, '').trim())
        if (parts.length > 0 && parts[0] === '') parts.shift()
        if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop()
        return parts
      })
      .filter(cells => cells.length > 0)
      .map(cells => {
        const obj: any = {}
        headers.forEach((h, i) => {
          obj[h] = cells[i] || ''
        })
        return obj
      })
  }

  const getSection = (num: number) => {
    const regex = new RegExp(`## SECTION ${num}[^\\n]*`, 'i')
    const match = markdown.match(regex)
    if (!match) return ''
    const start = match.index! + match[0].length
    const nextMatch = markdown.slice(start).match(/## SECTION \d+/i)
    if (nextMatch) return markdown.slice(start, start + nextMatch.index!)
    return markdown.slice(start)
  }

  const clean = (s: string) => s.replace(/\*\*/g, '').trim()

  const s1 = getSection(1)
  const s2 = getSection(2)
  const s3 = getSection(3)
  const s4 = getSection(4)
  const s5 = getSection(5)
  const s6 = getSection(6)
  const s7 = getSection(7)

  // SECTION 1 — Document Inventory
  if (s1) {
    report.documents = parseTable(s1).map((row, i) => ({
      id: `doc-${i}`,
      filename: getValue(row, 'document_name', 'document'),
      docType: (getValue(row, 'document_type', 'type') || 'Other') as any,
      partiesCovered: getValue(row, 'entities_or_parties_covered', 'parties_covered'),
      date: getValue(row, 'date'),
      status: (() => {
        const completenessFlag = getValue(row, 'completeness_flag').toLowerCase()
        if (completenessFlag.startsWith('complete')) return 'complete' as const
        if (completenessFlag.includes('missing')) return 'missing' as const
        return 'incomplete' as const
      })(),
      statusNote: (() => {
        const completenessFlag = getValue(row, 'completeness_flag')
        const match = completenessFlag.match(/^complete\s*-\s*(.+)$/i)
        return match ? clean(match[1]) : undefined
      })(),
    }))
  }

  // SECTION 2 — Entity Structure
  if (s2) {
    report.entities = parseTable(s2).map((row, i) => ({
      id: `entity-${i}`,
      entityName: getValue(row, 'entity_name', 'entity'),
      entityType: getValue(row, 'entity_type', 'type'),
      stateOfFormation: getValue(row, 'state_of_formation', 'state'),
      dateOfFormation: getValue(row, 'date_of_formation', 'date'),
      ein: getValue(row, 'ein') || undefined,
      registeredAgent: getValue(row, 'registered_agent'),
      status: (() => {
        const s = getValue(row, 'status').toLowerCase()
        if (s.includes('active')) return 'active' as const
        if (s.includes('inactive')) return 'inactive' as const
        if (s.includes('dissolved')) return 'dissolved' as const
        return 'unknown' as const
      })(),
      sourceRef: getValue(row, 'source_document', 'source'),
    }))
  }

  // SECTION 3 — Ownership Breakdown
  if (s3) {
    // Ownership may have multiple sub-tables per entity. Parse all tables found.
    const allTables: any[][] = []
    const lines = s3.split('\n')
    let currentTable: string[] = []
    let inTable = false

    for (const line of lines) {
      if (line.includes('|')) {
        inTable = true
        currentTable.push(line)
      } else if (inTable && !line.includes('|')) {
        if (currentTable.length > 2) {
          allTables.push(parseTable(currentTable.join('\n')))
        }
        currentTable = []
        inTable = false
      }
    }
    if (currentTable.length > 2) {
      allTables.push(parseTable(currentTable.join('\n')))
    }

    const stakes: OwnershipStake[] = []
    for (const table of allTables) {
      for (const row of table) {
        stakes.push({
          id: `stake-${stakes.length}`,
          ownerName: getValue(row, 'owner_name', 'owner'),
          ownerType: getValue(row, 'owner_type', 'type'),
          entityOwned: getValue(row, 'entity_owned', 'entity'),
          ownershipPercentage: getValue(row, 'ownership_percentage', 'ownership___', 'percentage'),
          classOfInterest: getValue(row, 'class_of_interest', 'class'),
          votingRights: getValue(row, 'voting_rights', 'voting'),
          transferRestrictions: getValue(row, 'transfer_restrictions', 'restrictions'),
          sourceRef: getValue(row, 'source_document', 'source'),
        })
      }
    }
    report.ownershipStakes = stakes
  }

  // SECTION 4 — Encumbrances & Liens
  if (s4) {
    if (s4.toLowerCase().includes('no encumbrances or liens identified')) {
      report.encumbrances = []
    } else {
      const encBlocks = s4.split(/\*\*Type:\*\*/i).slice(1)
      report.encumbrances = encBlocks.map((block, i) => {
        const getLine = (key: string) => {
          const m = block.match(new RegExp(`\\*\\*${key}:\\*\\*\\s*(.+)`, 'i'))
          return m ? clean(m[1]) : ''
        }
        return {
          id: `enc-${i}`,
          type: clean(block.split('\n')[0]),
          filedAgainst: getLine('Filed Against'),
          securedParty: getLine('Secured Party / Lienholder') || getLine('Secured Party'),
          filingDate: getLine('Filing Date'),
          expirationDate: getLine('Expiration Date'),
          collateralDescription: getLine('Collateral Description'),
          status: parseEncumbranceStatus(getLine('Status')),
          amount: getLine('Amount') || undefined,
          sourceRef: getLine('Source Document') || getLine('Source'),
        }
      })
    }
  }

  // SECTION 5 — State Filing Compliance
  if (s5) {
    report.stateFilings = parseTable(s5).map((row, i) => ({
      id: `filing-${i}`,
      state: getValue(row, 'state'),
      filingType: getValue(row, 'filing_type', 'type'),
      filingDate: getValue(row, 'filing_date', 'date'),
      expirationDate: getValue(row, 'expiration_due_date', 'expiration_date', 'due_date'),
      status: parseFilingStatus(getValue(row, 'status')),
      complianceStatus: parseComplianceStatus(getValue(row, 'compliance_assessment', 'compliance')),
      notes: getValue(row, 'notes'),
      sourceRef: getValue(row, 'source_document', 'source'),
    }))
  }

  // SECTION 6 — Buyer-Facing Ownership Summary
  if (s6) {
    const getPara = (key: string) => {
      const m = s6.match(new RegExp(`\\*\\*${key}:\\*\\*\\s*([\\s\\S]+?)(?=\\n\\*\\*|$)`, 'i'))
      return m ? m[1].trim() : ''
    }
    const getList = (key: string) => {
      const m = s6.match(new RegExp(`\\*\\*${key}:\\*\\*\\s*\\n([\\s\\S]+?)(?=\\n\\*\\*|$)`, 'i'))
      if (!m) return []
      return m[1]
        .trim()
        .split('\n')
        .filter(l => l.trim().startsWith('-') || l.trim().startsWith('*'))
        .map(l => l.replace(/^[-*]/, '').trim())
        .filter(item => item && item !== '--')
    }

    const paragraphs = s6.split(/\n\s*\n/)

    report.buyerSummary = {
      entityStructureOverview: getPara('Entity Structure Overview') || paragraphs[0] || 'No summary available.',
      ownershipClarity: getPara('Ownership Clarity') || '',
      encumbranceExposure: getPara('Encumbrance Exposure') || '',
      stateComplianceStatus: getPara('State Compliance Status') || '',
      transitionConsiderations: getPara('Transition Considerations') || '',
      counselItems: getList("Items Requiring Buyer's Corporate Counsel Review"),
    }
    // Fallback counsel items
    if (!report.buyerSummary.counselItems || report.buyerSummary.counselItems.length === 0) {
      report.buyerSummary.counselItems = s6
        .split('\n')
        .filter(l => l.trim().startsWith('-') || l.trim().startsWith('*'))
        .map(l => l.replace(/^[-*]/, '').trim())
        .filter(item => item && item !== '--')
    }
  }

  // SECTION 7 — Flags Summary
  if (s7) {
    const table = parseTable(s7)
    table.forEach((row, idx) => {
      flags.push({
        id: `flag-${idx}`,
        domain: normalizeDomain(getValue(row, 'domain')),
        severity: parseSeverity(getValue(row, 'flag_severity')),
        title: getValue(row, 'flag_description', 'finding'),
        description: getValue(row, 'flag_description'),
        sourceRef: getValue(row, 'source_reference', 'source'),
        status: 'pending',
      })
    })
  }

  return { report, flags }
}
