import type {
  WS19Report,
  WS19Flag,
  FlagSeverity,
  InventoryDocument,
  PermitRecord,
  PermitStatus,
  ZoningRecord,
  ZoningCompliance,
  ConditionalUsePermit,
  GrandfatheringItem,
  GrandfatherRisk,
  BuyerSummary,
} from '@/types/ws1-9-types'

/**
 * Parses the raw Markdown report into the structured JSON object for UI tabs.
 */
export function parseWS19Markdown(markdown: string, clientName: string): { report: Partial<WS19Report>; flags: WS19Flag[] } {
  const report: Partial<WS19Report> = {
    clientName,
    generatedAt: new Date().toISOString(),
    documents: [],
    permits: [],
    zoning: [],
    conditionalUsePermits: [],
    grandfathering: [],
  }

  const flags: WS19Flag[] = []

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
    if (normalized.includes('negotiation') || normalized.includes('amber')) return 'negotiation'
    if (normalized.includes('positive') || normalized.includes('green')) return 'positive'
    return 'informational'
  }

  const parsePermitStatus = (value: string): PermitStatus => {
    const normalized = clean(value).toLowerCase()
    if (normalized.includes('expired')) return 'Expired'
    if (normalized.includes('expiring')) return 'Expiring Soon'
    if (normalized.includes('current') || normalized.includes('active') || normalized.includes('valid')) return 'Current'
    if (normalized.includes('pending')) return 'Pending'
    return 'Unknown'
  }

  const parseZoningCompliance = (value: string): ZoningCompliance => {
    const normalized = clean(value).toLowerCase()
    if (normalized.includes('non-compliant') || normalized.includes('noncompliant')) return 'Non-Compliant'
    if (normalized.includes('conditional')) return 'Conditional'
    if (normalized.includes('compliant')) return 'Compliant'
    return 'Unknown'
  }

  const parseGrandfatherRisk = (value: string): GrandfatherRisk => {
    const normalized = clean(value).toLowerCase()
    if (normalized.includes('high')) return 'High'
    if (normalized.includes('medium')) return 'Medium'
    if (normalized.includes('low')) return 'Low'
    return 'Unknown'
  }

  const normalizeDomain = (value: string): WS19Flag['domain'] => {
    const normalized = clean(value).toLowerCase()
    if (normalized.includes('permit') || normalized.includes('license')) return 'Permits'
    if (normalized.includes('grandfather') || normalized.includes('non-conform')) return 'Grandfathering'
    if (normalized.includes('cup') || normalized.includes('conditional use')) return 'CUP'
    if (normalized.includes('zoning')) return 'Zoning'
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

  // Section 1 — Document Inventory
  if (s1) {
    report.documents = parseTable(s1).map((row, i) => ({
      id: `doc-${i}`,
      filename: getValue(row, 'document_name', 'document'),
      docType: (getValue(row, 'document_type', 'type') || 'Other') as any,
      issuingAuthority: getValue(row, 'issuing_authority', 'authority'),
      date: getValue(row, 'date'),
      status: (() => {
        const completenessFlag = getValue(row, 'completeness_flag').toLowerCase()
        if (completenessFlag.startsWith('complete')) return 'complete'
        if (completenessFlag.includes('missing') || completenessFlag.includes('not uploaded')) return 'missing'
        return 'incomplete'
      })(),
      statusNote: (() => {
        const completenessFlag = getValue(row, 'completeness_flag')
        const match = completenessFlag.match(/^complete\s*-\s*(.+)$/i)
        return match ? clean(match[1]) : undefined
      })(),
    }))
  }

  // Section 2 — Permit Inventory
  if (s2) {
    report.permits = parseTable(s2).map((row, i) => ({
      id: `permit-${i}`,
      permitType: getValue(row, 'permit_type', 'type'),
      permitNumber: getValue(row, 'permit_number', 'number'),
      issuingAuthority: getValue(row, 'issuing_authority', 'authority'),
      issueDate: getValue(row, 'issue_date'),
      expirationDate: getValue(row, 'expiration_date'),
      status: parsePermitStatus(getValue(row, 'status')),
      renewalProcess: getValue(row, 'renewal_process', 'renewal'),
      conditions: getValue(row, 'conditions'),
      sourceRef: getValue(row, 'source_reference', 'source'),
    }))
  }

  // Section 3 — Zoning Analysis (sub-sections, not a table)
  if (s3) {
    const zoningBlocks = s3.split(/\*\*Property Address:\*\*/i).slice(1)
    report.zoning = zoningBlocks.map((block, i) => {
      const getLine = (key: string) => {
        const m = block.match(new RegExp(`\\*\\*${key}:\\*\\*\\s*(.+)`, 'i'))
        return m ? clean(m[1]) : ''
      }
      const getListItems = (key: string) => {
        const m = block.match(new RegExp(`\\*\\*${key}:\\*\\*\\s*([\\s\\S]+?)(?=\\n\\*\\*|$)`, 'i'))
        if (!m) return []
        return m[1]
          .trim()
          .split('\n')
          .filter(l => l.trim().startsWith('-') || l.trim().startsWith('*'))
          .map(l => l.replace(/^[-*]/, '').trim())
          .filter(Boolean)
      }
      // Parse restrictions sub-section
      const restrictionsBlock = block.match(/\*\*Restrictions:\*\*\s*([\s\S]+?)(?=\n\*\*Flag|\n---|\n## |$)/i)
      const restrictionLines = restrictionsBlock
        ? restrictionsBlock[1].split('\n').filter(l => l.trim().startsWith('-')).map(l => clean(l.replace(/^-/, '')))
        : []

      const getRestriction = (key: string) => {
        const line = restrictionLines.find(l => l.toLowerCase().includes(key.toLowerCase()))
        if (!line) return 'Not specified'
        const match = line.match(/:\s*(.+)/)
        return match ? clean(match[1]) : clean(line)
      }

      return {
        id: `zone-${i}`,
        propertyAddress: clean(block.split('\n')[0]),
        zoningDesignation: getLine('Zoning Designation'),
        permittedUses: getListItems('Permitted Uses').length > 0
          ? getListItems('Permitted Uses')
          : getLine('Permitted Uses').split(',').map(s => s.trim()).filter(Boolean),
        currentUse: getLine('Current Use'),
        complianceStatus: parseZoningCompliance(getLine('Compliance Status')),
        restrictions: restrictionLines,
        setbacks: getRestriction('Setback'),
        parkingRequirements: getRestriction('Parking'),
        noiseOrdinance: getRestriction('Noise'),
        sourceRef: getLine('Source') || getLine('Flag'),
      }
    })
  }

  // Section 4 — Conditional Use Permits (sub-sections)
  if (s4) {
    if (s4.toLowerCase().includes('no conditional use permits identified')) {
      report.conditionalUsePermits = []
    } else {
      const cupBlocks = s4.split(/\*\*CUP Number:\*\*/i).slice(1)
      report.conditionalUsePermits = cupBlocks.map((block, i) => {
        const getLine = (key: string) => {
          const m = block.match(new RegExp(`\\*\\*${key}:\\*\\*\\s*(.+)`, 'i'))
          return m ? clean(m[1]) : ''
        }
        const getListItems = (key: string) => {
          const m = block.match(new RegExp(`\\*\\*${key}:\\*\\*\\s*([\\s\\S]+?)(?=\\n\\*\\*|$)`, 'i'))
          if (!m) return []
          return m[1]
            .trim()
            .split('\n')
            .filter(l => l.trim().match(/^[-*\d]/))
            .map(l => l.replace(/^[-*\d.)\s]+/, '').trim())
            .filter(Boolean)
        }
        const transferability = getLine('Transferability').toLowerCase()
        let transferStatus: ConditionalUsePermit['transferability'] = 'Unknown'
        if (transferability.includes('non-transferable') || transferability.includes('not transferable')) transferStatus = 'Non-Transferable'
        else if (transferability.includes('requires') || transferability.includes('approval')) transferStatus = 'Requires Approval'
        else if (transferability.includes('transferable')) transferStatus = 'Transferable'

        return {
          id: `cup-${i}`,
          cupNumber: clean(block.split('\n')[0]),
          issuingAuthority: getLine('Issuing Authority'),
          issueDate: getLine('Issue Date'),
          approvedUse: getLine('Approved Use'),
          conditions: getListItems('Conditions of Approval'),
          complianceStatus: parseZoningCompliance(getLine('Compliance Status')),
          renewalRequired: getLine('Renewal Required').toLowerCase().startsWith('y'),
          renewalDate: getLine('Renewal Date'),
          transferability: transferStatus,
          sourceRef: getLine('Source') || getLine('Flag'),
        }
      })
    }
  }

  // Section 5 — Grandfathering Analysis (sub-sections)
  if (s5) {
    if (s5.toLowerCase().includes('no non-conforming use') || s5.toLowerCase().includes('no grandfathering issues')) {
      report.grandfathering = []
    } else {
      const gfBlocks = s5.split(/\*\*Non-Conforming Use:\*\*/i).slice(1)
      report.grandfathering = gfBlocks.map((block, i) => {
        const getLine = (key: string) => {
          const m = block.match(new RegExp(`\\*\\*${key}:\\*\\*\\s*(.+)`, 'i'))
          return m ? clean(m[1]) : ''
        }
        const getTriggerEvents = () => {
          const m = block.match(/\*\*Trigger Events[^:]*:\*\*\s*([\s\S]+?)(?=\n\*\*|$)/i)
          if (!m) return []
          return m[1]
            .trim()
            .split('\n')
            .filter(l => l.trim().startsWith('-') || l.trim().startsWith('*'))
            .map(l => l.replace(/^[-*]/, '').trim())
            .filter(Boolean)
        }
        return {
          id: `gf-${i}`,
          nonConformingUse: clean(block.split('\n')[0]),
          originalApprovalDate: getLine('Original Approval/Establishment Date') || getLine('Original Approval Date'),
          currentBasis: getLine('Current Legal Basis'),
          triggerEvents: getTriggerEvents(),
          riskLevel: parseGrandfatherRisk(getLine('Risk Level')),
          mitigationOptions: getLine('Mitigation Options'),
          sourceRef: getLine('Source') || getLine('Flag'),
        }
      })
    }
  }

  // Section 6 — Buyer Summary
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
      permitsOverview: getPara('Permits Overview') || paragraphs[0] || 'No summary available.',
      zoningCompliance: getPara('Zoning Compliance') || '',
      conditionalUseStatus: getPara('Conditional Use Permit Status') || getPara('Conditional Use Status') || '',
      grandfatheringRisk: getPara('Grandfathering Risk') || '',
      transferConsiderations: getPara('Transfer Considerations') || '',
      counselItems: getList("Items Requiring Buyer's Land Use Counsel Review"),
    }
    if (!report.buyerSummary.counselItems || report.buyerSummary.counselItems.length === 0) {
      report.buyerSummary.counselItems = s6
        .split('\n')
        .filter(l => l.trim().startsWith('-') || l.trim().startsWith('*'))
        .map(l => l.replace(/^[-*]/, '').trim())
        .filter(item => item && item !== '--')
    }
  }

  // Section 7 — Flags
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
