import type { 
  WS16Report, 
  Flag, 
  FlagSeverity, 
  InventoryDocument, 
  AgreementRow, 
  NonCompeteBlock, 
  BenefitRow, 
  ContractorRow, 
  KeyPersonRow, 
  BuyerSummary,
  CoverageGap,
  TransitionComplexity
} from '@/types/ws1-6-types'

/**
 * Parses the raw Markdown report into the structured JSON object for UI tabs.
 */
export function parseWS16Markdown(markdown: string, clientName: string): { report: Partial<WS16Report>; flags: Flag[] } {
  const report: Partial<WS16Report> = {
    clientName,
    generatedAt: new Date().toISOString(),
    coverageGaps: [],
    contractors: [],
    keyPersonNarrative: '',
  }

  const flags: Flag[] = []

  const getValue = (row: Record<string, any>, ...keys: string[]) => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
        return String(row[key]).trim()
      }
    }
    return ''
  }

  const parseBoolean = (value: string): boolean | null => {
    const normalized = clean(value).toLowerCase()
    if (!normalized) return null
    if (/^(y|yes)\b/.test(normalized)) return true
    if (/^(n|no)\b/.test(normalized)) return false
    return null
  }

  const parseSeverity = (value: string): FlagSeverity => {
    const normalized = clean(value).toLowerCase()
    if (normalized.includes('🔴') || normalized.includes('deal') || normalized.includes('red')) return 'deal-risk'
    if (normalized.includes('🟡') || normalized.includes('negotiation') || normalized.includes('amber')) return 'negotiation'
    if (normalized.includes('🟢') || normalized.includes('positive') || normalized.includes('green')) return 'positive'
    return 'informational'
  }

  const parseComplexity = (value: string): TransitionComplexity => {
    const normalized = clean(value).toLowerCase()
    if (normalized.includes('high')) return 'High'
    if (normalized.includes('medium')) return 'Medium'
    if (normalized.includes('low')) return 'Low'
    return 'Unknown'
  }

  const parseRiskLevel = (value: string): KeyPersonRow['riskLevel'] => {
    const normalized = clean(value).toLowerCase()
    if (normalized.includes('high')) return 'High'
    if (normalized.includes('medium')) return 'Medium'
    if (normalized.includes('low')) return 'Low'
    return 'Unknown'
  }

  const normalizeTransferability = (value: string): BenefitRow['assetSaleTransferable'] => {
    const normalized = clean(value).toLowerCase()
    if (!normalized) return 'Unknown'
    if (normalized.startsWith('yes')) return 'Yes'
    if (normalized.startsWith('no')) return 'No'
    if (normalized.includes('statutory')) return 'Statutory'
    if (normalized.includes('unclear')) return 'Unclear'
    return 'Unknown'
  }

  const normalizeDomain = (value: string): Flag['domain'] => {
    const normalized = clean(value).toLowerCase()
    if (normalized.includes('benefit')) return 'Benefits'
    if (normalized.includes('non-compete') || normalized.includes('noncompete')) return 'Non-competes'
    if (normalized.includes('employment coverage') || normalized.includes('agreement')) return 'Agreements'
    if (normalized.includes('key person')) return 'Key-people'
    if (normalized.includes('ic risk') || normalized.includes('contractor')) return 'Contractors'
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
  const s8 = getSection(8)

  if (s1) {
    report.documents = parseTable(s1).map((row, i) => ({
      id: `doc-${i}`,
      filename: getValue(row, 'document_name', 'document'),
      docType: (getValue(row, 'document_type', 'type') || 'Other') as any,
      partiesCovered: getValue(row, 'employees_or_parties_covered', 'parties_covered'),
      date: getValue(row, 'date'),
      status: (() => {
        const completenessFlag = getValue(row, 'completeness_flag').toLowerCase()
        if (completenessFlag.startsWith('complete')) return 'complete'
        if (completenessFlag.includes('missing')) return 'missing'
        return 'incomplete'
      })(),
      statusNote: (() => {
        const completenessFlag = getValue(row, 'completeness_flag')
        const match = completenessFlag.match(/^complete\s*-\s*(.+)$/i)
        return match ? clean(match[1]) : undefined
      })(),
    }))
    const match = s1.match(/Coverage Gap[^:]*:\s*(.+)/i)
    if (match) {
      report.coverageGaps?.push({
        category: 'Missing Document',
        reason: clean(match[1]),
        status: 'missing'
      })
    }
  }

  if (s2) {
    report.agreements = parseTable(s2).map((row, i) => ({
      role: getValue(row, 'role___title', 'role_title', 'role'),
      agreementType: getValue(row, 'agreement_type'),
      term: getValue(row, 'fixed_term_or_at_will', 'term'),
      hasNonCompete: parseBoolean(getValue(row, 'non_compete_attached_y_n')),
      hasNonSolicit: parseBoolean(getValue(row, 'non_solicitation_attached_y_n')),
      hasNDA: parseBoolean(getValue(row, 'nda_confidentiality_attached_y_n', 'nda_attached_y_n')),
      sourceRef: getValue(row, 'source_document', 'source'),
      isKeyPerson: false,
    }))
  }

  if (s3) {
    // Non-competes are generated as sub-sections, not a table.
    const ncBlocks = s3.split(/\*\*Covered Party:\*\*/i).slice(1)
    report.nonCompetes = ncBlocks.map((block, i) => {
      const getLine = (key: string) => {
        const m = block.match(new RegExp(`\\*\\*${key}:\\*\\*\\s*(.+)`, 'i'))
        return m ? clean(m[1]) : ''
      }
      return {
        id: `nc-${i}`,
        party: clean(block.split('\n')[0]),
        isCritical: block.toLowerCase().includes('owner/seller') || block.toLowerCase().includes('owner non-compete'),
        sourceDoc: getLine('Agreement Source'),
        sourceSection: '',
        geographicScope: getLine('Geographic Scope'),
        duration: getLine('Duration'),
        coveredActivities: getLine('Covered Activities').split(',').map(item => item.trim()).filter(Boolean),
        considerationNote: getLine('Consideration Adequacy'),
        stateEnforceabilityNote: getLine('State Enforceability Note'),
        flag: parseSeverity(getLine('Flag')),
        flagExplanation: getLine('Flag'),
      }
    })
  }

  if (s4) {
    report.benefits = parseTable(s4).map((row, i) => ({
      benefitType: getValue(row, 'benefit_type'),
      employerContribution: getValue(row, 'employer_contribution', 'cost'),
      contractuallyBound: parseBoolean(getValue(row, 'contractually_bound_y_n', 'contractually_bound')),
      assetSaleTransferable: normalizeTransferability(getValue(row, 'transferable_on_asset_sale', 'transferable')),
      estimatedAnnualCost: getValue(row, 'estimated_annual_cost', 'cost'),
      transitionComplexity: parseComplexity(getValue(row, 'transition_complexity')),
    }))
  }

  if (s5) {
    if (s5.toLowerCase().includes('no independent contractor relationships identified')) {
      report.contractors = []
    } else {
      const icBlocks = s5.split(/\*\*Contractor Role:\*\*/i).slice(1)
      report.contractors = icBlocks.map((block, i) => {
        const getLine = (key: string) => {
          const m = block.match(new RegExp(`\\*\\*${key}:\\*\\*\\s*(.+)`, 'i'))
          return m ? m[1].trim() : ''
        }
        return {
          id: `ic-${i}`,
          role: block.split('\n')[0].trim() || '',
          agreementProvided: !!getLine('Agreement Provided').toLowerCase().includes('y'),
          misclassRisk: getLine('Misclassification Risk') as any,
          riskFactors: getLine('Risk Factors Present').split(',').map(item => item.trim()).filter(Boolean),
          flag: parseSeverity(getLine('Flag')),
        }
      })
    }
  }

  if (s6) {
    report.keyPeople = parseTable(s6).map((row, i) => ({
      role: getValue(row, 'role'),
      employmentType: getValue(row, 'employment_type'),
      hasNonCompete: parseBoolean(getValue(row, 'non_compete', 'non_compete_y_n')),
      hasAgreement: parseBoolean(getValue(row, 'emp__agreement', 'emp_agreement', 'emp_agreement_y_n', 'agreement_y_n')),
      riskLevel: parseRiskLevel(getValue(row, 'risk_level')),
      transitionNotes: getValue(row, 'transition_notes'),
    }))
    const narrativeMatch = s6.match(/\*\*Key Person Narrative:?\*\*\s*([\s\S]+?)(?=\n---|\n## SECTION|\s*$)/i)
    if (narrativeMatch) report.keyPersonNarrative = narrativeMatch[1].trim()
  }

  if (s7) {
    const getPara = (key: string) => {
      const m = s7.match(new RegExp(`\\*\\*${key}:\\*\\*\\s*([\\s\\S]+?)(?=\\n\\*\\*|$)`, 'i'))
      return m ? m[1].trim() : ''
    }
    const getList = (key: string) => {
      const m = s7.match(new RegExp(`\\*\\*${key}:\\*\\*\\s*\\n([\\s\\S]+?)(?=\\n\\*\\*|$)`, 'i'))
      if (!m) return []
      return m[1]
        .trim()
        .split('\n')
        .filter(l => l.trim().startsWith('-') || l.trim().startsWith('•'))
        .map(l => l.replace(/^[-•]/, '').trim())
        .filter(item => item && item !== '--')
    }
    
    // Fallback if formatting varied slightly
    const paragraphs = s7.split(/\n\s*\n/)
    
    report.buyerSummary = {
      workforceOverview: getPara('Workforce Overview') || paragraphs[0] || 'No summary available.',
      nonCompeteProtections: getPara('Non-Compete Protections') || '',
      assumedBenefitObligations: getPara('Assumed Benefit Obligations') || '',
      retirementAndPTO: getPara('Retirement Plan & PTO Obligations') || getPara('Retirement Plan \\& PTO Obligations') || '',
      independentContractorRisk: getPara('Independent Contractor Risk') || '',
      transitionConsiderations: getPara('Transition Considerations') || '',
      counselItems: getList("Items Requiring Buyer's Employment Counsel Review")
    }
    // ensure fallback counseling items
    if (!report.buyerSummary.counselItems || report.buyerSummary.counselItems.length === 0) {
      report.buyerSummary.counselItems = s7
        .split('\n')
        .filter(l => l.trim().startsWith('-') || l.trim().startsWith('•'))
        .map(l => l.replace(/^[-•]/, '').trim())
        .filter(item => item && item !== '--')
    }
  }

  if (s8) {
    const table = parseTable(s8)
    table.forEach((row, idx) => {
      flags.push({
        id: `flag-${idx}`,
        domain: normalizeDomain(getValue(row, 'domain')),
        severity: parseSeverity(getValue(row, 'flag_severity')),
        title: getValue(row, 'flag_description', 'finding'),
        description: getValue(row, 'flag_description'),
        sourceRef: getValue(row, 'source_reference', 'source'),
        status: 'pending'
      })
    })
  }

  return { report, flags }
}
