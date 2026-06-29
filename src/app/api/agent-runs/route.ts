import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getLatestTaxLiabilityReport } from '@/lib/tax-liability-review/storage'
import { getClientWorkstreamAgents, normalizeAgentStatusKey } from '@/lib/workstream-agents'
import { VALUATION_DOCS, DOCUMENT_CATEGORIES } from '@/lib/documentData'

export const dynamic = 'force-dynamic'

export type AgentRunStatus = 'not_started' | 'docs_uploaded' | 'partial_docs' | 'docs_missing' | 'in_review' | 'approved'

export type AgentRunRecord = {
  agentId: string
  agentKey: string
  label: string
  category: string
  status: AgentRunStatus
  assignedTo: string | null
  runAt: string | null
  tabKey: string | null
  missingDocs?: { id: string; name: string }[]
}

export type AgentReviewer = {
  id: string
  name: string
  email: string
}

const AGENT_LABELS: Record<string, { label: string; tabKey: string; category: string }> = {
  ttm: { label: 'Valuation Agent', tabKey: 'ttm', category: 'Valuation' },
  ttmAnalysis: { label: 'Valuation Agent', tabKey: 'ttm', category: 'Valuation' },
  employee_obligations: { label: 'Employee Obligations', tabKey: 'employee-obligations', category: 'WS1 — Risk & Legal' },
  employeeObligations: { label: 'Employee Obligations', tabKey: 'employee-obligations', category: 'WS1 — Risk & Legal' },
  employee_comp: { label: 'Employee Staffing & Compensation', tabKey: 'employee-comp', category: 'WS1 — Risk & Legal' },
  employeeComp: { label: 'Employee Staffing & Compensation', tabKey: 'employee-comp', category: 'WS1 — Risk & Legal' },
  insurance_review: { label: 'Insurance Review', tabKey: 'insurance', category: 'WS1 — Risk & Legal' },
  insuranceReview: { label: 'Insurance Review', tabKey: 'insurance', category: 'WS1 — Risk & Legal' },
  lease_analysis: { label: 'Lease Analysis', tabKey: 'lease', category: 'WS1 — Risk & Legal' },
  lease: { label: 'Lease Analysis', tabKey: 'lease', category: 'WS1 — Risk & Legal' },
  litigation_search: { label: 'Litigation & Liens', tabKey: 'litigation', category: 'WS1 — Risk & Legal' },
  litigationSearch: { label: 'Litigation & Liens', tabKey: 'litigation', category: 'WS1 — Risk & Legal' },
  contract_analysis: { label: 'Material Contracts', tabKey: 'contract', category: 'WS1 — Risk & Legal' },
  contract: { label: 'Material Contracts', tabKey: 'contract', category: 'WS1 — Risk & Legal' },
  org_chart_review: { label: 'Org Chart Review', tabKey: 'org-chart', category: 'WS1 — Risk & Legal' },
  orgChart: { label: 'Org Chart Review', tabKey: 'org-chart', category: 'WS1 — Risk & Legal' },
  owner_gm_assessment: { label: 'Owner & GM Assessment', tabKey: 'owner-gm-assessment', category: 'WS1 — Risk & Legal' },
  ownerGmAssessment: { label: 'Owner & GM Assessment', tabKey: 'owner-gm-assessment', category: 'WS1 — Risk & Legal' },
  ownership_verification: { label: 'Ownership Verification', tabKey: 'ownership-verification', category: 'WS1 — Risk & Legal' },
  ownershipVerification: { label: 'Ownership Verification', tabKey: 'ownership-verification', category: 'WS1 — Risk & Legal' },
  permits_zoning: { label: 'Permits & Zoning', tabKey: 'permits-zoning', category: 'WS1 — Risk & Legal' },
  permitsZoning: { label: 'Permits & Zoning', tabKey: 'permits-zoning', category: 'WS1 — Risk & Legal' },
  professional_advisors: { label: 'Professional Advisors', tabKey: 'advisors', category: 'WS1 — Risk & Legal' },
  professionalAdvisors: { label: 'Professional Advisors', tabKey: 'advisors', category: 'WS1 — Risk & Legal' },
  vendor_directory: { label: 'Software & Vendors', tabKey: 'vendor-directory', category: 'WS1 — Risk & Legal' },
  vendorDirectory: { label: 'Software & Vendors', tabKey: 'vendor-directory', category: 'WS1 — Risk & Legal' },
  legal_entity_search: { label: 'Legal Reports & Entity Search', tabKey: 'legal-entity-search', category: 'WS1 — Risk & Legal' },
  legalEntitySearch: { label: 'Legal Reports & Entity Search', tabKey: 'legal-entity-search', category: 'WS1 — Risk & Legal' },
  tax_liability_review: { label: 'Tax Liability Review', tabKey: 'tax-liability-review', category: 'WS1 — Risk & Legal' },
  taxLiabilityReview: { label: 'Tax Liability Review', tabKey: 'tax-liability-review', category: 'WS1 — Risk & Legal' },
  competitor_analysis: { label: 'Competitor Analysis', tabKey: 'competitor', category: 'WS2 — Performance' },
  competitor: { label: 'Competitor Analysis', tabKey: 'competitor', category: 'WS2 — Performance' },
  digital_presence: { label: 'Digital Presence', tabKey: 'digital', category: 'WS2 — Performance' },
  digitalPresence: { label: 'Digital Presence', tabKey: 'digital', category: 'WS2 — Performance' },
  facility_review: { label: 'Facility Review Agent', tabKey: 'facility-review', category: 'WS2 — Performance' },
  facilityReview: { label: 'Facility Review Agent', tabKey: 'facility-review', category: 'WS2 — Performance' },
  pricing_analysis: { label: 'Competitive Pricing Analysis', tabKey: 'pricing-analysis', category: 'WS2 — Performance' },
  pricingAnalysis: { label: 'Competitive Pricing Analysis', tabKey: 'pricing-analysis', category: 'WS2 — Performance' },
  pricing_vertical: { label: 'Pricing by Vertical', tabKey: 'pricing-vertical', category: 'WS2 — Performance' },
  pricingVertical: { label: 'Pricing by Vertical', tabKey: 'pricing-vertical', category: 'WS2 — Performance' },
  sales_process_review: { label: 'Sales Process Review', tabKey: 'sales-process-review', category: 'WS2 — Performance' },
  salesProcessReview: { label: 'Sales Process Review', tabKey: 'sales-process-review', category: 'WS2 — Performance' },
  client_location_map: { label: 'Client Location Map', tabKey: 'client-location-map', category: 'WS2 — Performance' },
  clientLocationMap: { label: 'Client Location Map', tabKey: 'client-location-map', category: 'WS2 — Performance' },
  cim: { label: 'CIM Generator', tabKey: 'cim', category: 'M&A Sale Process' },
  teaser: { label: 'Deal Teaser Generator', tabKey: 'teaser', category: 'M&A Sale Process' },
  net_proceeds: { label: 'Net Proceeds Calculator', tabKey: 'net-proceeds', category: 'M&A Sale Process' },
}

const DOCUMENT_NAMES: Record<string, string> = {}
for (const doc of VALUATION_DOCS) {
  DOCUMENT_NAMES[doc.id] = doc.name
}
for (const cat of DOCUMENT_CATEGORIES) {
  for (const doc of cat.documents) {
    DOCUMENT_NAMES[doc.id] = doc.name
  }
}



function manualApproval(
  approvals: Record<string, unknown> | null | undefined,
  agentId: string,
  statusKey: string,
): boolean {
  const entry = approvals?.[agentId] ?? approvals?.[statusKey]
  if (!entry || typeof entry !== 'object') return false
  return (entry as { status?: string }).status === 'approved'
}

function toStatus(
  hasRun: boolean,
  approved: boolean,
  hasRequiredDocs: boolean,
  isPartialDocs: boolean,
  hasDocRequirements: boolean,
): AgentRunStatus {
  if (!hasRun) {
    if (hasDocRequirements) {
      if (hasRequiredDocs) return 'docs_uploaded'
      if (isPartialDocs) return 'partial_docs'
      return 'docs_missing'
    }
    return 'not_started'
  }
  if (approved) return 'approved'
  return 'in_review'
}

async function safeFind<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn()
  } catch (error) {
    console.error('[agent-runs] query failed:', error)
    return null
  }
}

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return new Response('clientId required', { status: 400 })

  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    include: { customWorkstream: { include: { agents: true } }, ClientWorkstreamAgents: true },
  })
  if (!client) return new Response('Not Found', { status: 404 })

  const reviewerRows = await prisma.user.findMany({
    where: {
      role: 'ADMIN',
      NOT: [
        { email: 'chethaka.sl@gmail.com' },
        { email: 'admin@cantara.demo' },
      ],
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  })
  const reviewers = reviewerRows
    .filter(user => !/chethaka/i.test(`${user.name} ${user.email}`))
    .map(user => ({ id: user.id, name: user.name, email: user.email }))

  const submissions = (client.sectionSubmissions as Record<string, unknown>) ?? {}
  const approvals = (submissions.agentApprovals as Record<string, unknown>) ?? {}
  const assignedAgents = getClientWorkstreamAgents({
    workstream: (client.workstream?.toLowerCase() as 'ws1' | 'ws2' | 'ma' | 'both' | null) ?? null,
    customWorkstream: client.customWorkstream as { agents?: { agentId: string; agentName: string; documentIds?: string[] }[] } | null,
    workstreamAgents: client.ClientWorkstreamAgents as { agentId: string; agentName: string; documentIds?: string[] }[] | null,
  })

  const [
    ttm,
    lease,
    contract,
    competitor,
    employeeObligations,
    ownershipVerification,
    permitsZoning,
    legalEntitySearch,
    taxReport,
    cimReport,
    teaserReport,
    insuranceDoc,
    salesDoc,
    uploadedDocs,
  ] = await Promise.all([
    safeFind(() => prisma.ttmAnalysis.findFirst({ where: { clientId }, orderBy: { createdAt: 'desc' }, select: { status: true, createdAt: true, approvedAt: true } })),
    safeFind(() => prisma.leaseAnalysis.findFirst({ where: { clientId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } })),
    safeFind(() => prisma.contractAnalysis.findFirst({ where: { clientId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } })),
    safeFind(() => prisma.competitorAnalysis.findFirst({ where: { clientId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } })),
    safeFind(() => prisma.employeeObligationsReport.findFirst({ where: { clientId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true, metadata: true } })),
    safeFind(() => prisma.ownershipVerificationReport.findFirst({ where: { clientId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true, metadata: true } })),
    safeFind(() => prisma.permitsZoningReport.findFirst({ where: { clientId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true, metadata: true } })),
    safeFind(() => prisma.legalEntitySearchReport.findFirst({ where: { clientId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } })),
    getLatestTaxLiabilityReport(clientId).catch(() => null),
    safeFind(() => prisma.cimReport.findUnique({ where: { clientId }, select: { updatedAt: true, data: true } })),
    safeFind(() => prisma.teaserReport.findUnique({ where: { clientId }, select: { updatedAt: true, data: true } })),
    safeFind(() => prisma.clientDocument.findFirst({ where: { clientId, documentId: 'insurance_claims_12m' }, orderBy: { createdAt: 'desc' }, select: { aiReviewSummary: true, aiReviewStatus: true, createdAt: true } })),
    safeFind(() => prisma.clientDocument.findFirst({ where: { clientId, documentId: 'sales_process_transcript' }, orderBy: { createdAt: 'desc' }, select: { aiReviewSummary: true, aiReviewStatus: true, aiReviewedAt: true, createdAt: true } })),
    safeFind(() => prisma.clientDocument.findMany({ where: { clientId }, select: { documentId: true } })),
  ])

  const runChecks: Record<string, { hasRun: boolean; approved: boolean; runAt: string | null }> = {
    ttmAnalysis: {
      hasRun: Boolean(ttm || submissions.valuation),
      // Client portal only releases output after Mark Approved in Agent Status — not DB APPROVED alone.
      approved: manualApproval(approvals, 'ttm', 'ttmAnalysis'),
      runAt: ttm?.approvedAt?.toISOString() ?? ttm?.createdAt?.toISOString() ?? null,
    },
    lease: {
      hasRun: Boolean(lease),
      approved: manualApproval(approvals, 'lease_analysis', 'lease'),
      runAt: lease?.createdAt?.toISOString() ?? null,
    },
    contract: {
      hasRun: Boolean(contract),
      approved: manualApproval(approvals, 'contract_analysis', 'contract'),
      runAt: contract?.createdAt?.toISOString() ?? null,
    },
    competitor: {
      hasRun: Boolean(competitor),
      approved: manualApproval(approvals, 'competitor_analysis', 'competitor'),
      runAt: competitor?.createdAt?.toISOString() ?? null,
    },
    employeeObligations: {
      hasRun: Boolean(employeeObligations),
      approved: manualApproval(approvals, 'employee_obligations', 'employeeObligations'),
      runAt: employeeObligations?.createdAt?.toISOString() ?? null,
    },
    ownershipVerification: {
      hasRun: Boolean(ownershipVerification || submissions.ownershipVerification),
      approved: manualApproval(approvals, 'ownership_verification', 'ownershipVerification'),
      runAt: ownershipVerification?.createdAt?.toISOString() ?? null,
    },
    permitsZoning: {
      hasRun: Boolean(permitsZoning || submissions.permitsZoning),
      approved: manualApproval(approvals, 'permits_zoning', 'permitsZoning'),
      runAt: permitsZoning?.createdAt?.toISOString() ?? null,
    },
    legalEntitySearch: {
      hasRun: Boolean(legalEntitySearch),
      approved: manualApproval(approvals, 'legal_entity_search', 'legalEntitySearch'),
      runAt: legalEntitySearch?.createdAt?.toISOString() ?? null,
    },
    taxLiabilityReview: {
      hasRun: Boolean(taxReport),
      approved: manualApproval(approvals, 'tax_liability_review', 'taxLiabilityReview'),
      runAt: taxReport?.createdAt?.toISOString?.() ?? null,
    },
    insuranceReview: {
      hasRun: Boolean(insuranceDoc?.aiReviewSummary || insuranceDoc?.aiReviewStatus || submissions.insuranceReview),
      approved: manualApproval(approvals, 'insurance_review', 'insuranceReview'),
      runAt: insuranceDoc?.createdAt?.toISOString() ?? null,
    },
    salesProcessReview: {
      hasRun: Boolean(salesDoc?.aiReviewSummary || salesDoc?.aiReviewStatus || submissions.salesProcessReview),
      approved: manualApproval(approvals, 'sales_process_review', 'salesProcessReview'),
      runAt: salesDoc?.aiReviewedAt?.toISOString() ?? salesDoc?.createdAt?.toISOString() ?? null,
    },
    digitalPresence: {
      hasRun: Boolean(submissions.digitalPresence),
      approved: manualApproval(approvals, 'digital_presence', 'digitalPresence'),
      runAt: (submissions.digitalPresence as { generatedAt?: string })?.generatedAt ?? null,
    },
    litigationSearch: {
      hasRun: Boolean(submissions.litigationSearch),
      approved: manualApproval(approvals, 'litigation_search', 'litigationSearch'),
      runAt: (submissions.litigationSearch as { generatedAt?: string })?.generatedAt ?? null,
    },
    employeeComp: {
      hasRun: Boolean(submissions.employeeCompReport || submissions.employeeComp),
      approved: manualApproval(approvals, 'employee_comp', 'employeeComp'),
      runAt: null,
    },
    ownerGmAssessment: {
      hasRun: Boolean(submissions.ownerGmAssessment),
      approved: manualApproval(approvals, 'owner_gm_assessment', 'ownerGmAssessment'),
      runAt: null,
    },
    professionalAdvisors: {
      hasRun: Boolean(submissions.professionalAdvisors),
      approved: manualApproval(approvals, 'professional_advisors', 'professionalAdvisors'),
      runAt: null,
    },
    vendorDirectory: {
      hasRun: Boolean(submissions.vendorDirectory),
      approved: manualApproval(approvals, 'vendor_directory', 'vendorDirectory'),
      runAt: null,
    },
    facilityReview: {
      hasRun: Boolean(submissions.facilityReview),
      approved: manualApproval(approvals, 'facility_review', 'facilityReview'),
      runAt: (submissions.facilityReview as { generatedAt?: string })?.generatedAt ?? null,
    },
    pricingAnalysis: {
      hasRun: Boolean(submissions.pricingAnalysis),
      approved: manualApproval(approvals, 'pricing_analysis', 'pricingAnalysis'),
      runAt: null,
    },
    pricingVertical: {
      hasRun: Boolean(submissions.pricingVertical),
      approved: manualApproval(approvals, 'pricing_vertical', 'pricingVertical'),
      runAt: null,
    },
    clientLocationMap: {
      hasRun: Boolean(
        (submissions.clientLocationMap as { clients?: unknown[] } | undefined)?.clients?.length
        || submissions.clientLocationMap,
      ),
      approved: manualApproval(approvals, 'client_location_map', 'clientLocationMap'),
      runAt: (submissions.clientLocationMap as { updatedAt?: string; generatedAt?: string })?.updatedAt
        ?? (submissions.clientLocationMap as { generatedAt?: string })?.generatedAt
        ?? null,
    },
    orgChart: {
      hasRun: Boolean(submissions.orgChart),
      approved: manualApproval(approvals, 'org_chart_review', 'orgChart'),
      runAt: null,
    },
    cim: {
      hasRun: Boolean(cimReport?.data),
      approved: manualApproval(approvals, 'cim', 'cim'),
      runAt: cimReport?.updatedAt?.toISOString() ?? null,
    },
    teaser: {
      hasRun: Boolean(teaserReport?.data),
      approved: manualApproval(approvals, 'teaser', 'teaser'),
      runAt: teaserReport?.updatedAt?.toISOString() ?? null,
    },
    net_proceeds: {
      hasRun: Boolean(submissions.netProceeds),
      approved: manualApproval(approvals, 'net_proceeds', 'net_proceeds'),
      runAt: null,
    },
  }

  const uploadedDocIds = new Set((uploadedDocs ?? []).map(d => d.documentId).filter(Boolean) as string[])
  const seen = new Set<string>()
  const runs: AgentRunRecord[] = []

  for (const agent of assignedAgents) {
    const statusKey = normalizeAgentStatusKey(agent.agentId)
    if (seen.has(statusKey)) continue
    seen.add(statusKey)

    const meta = AGENT_LABELS[agent.agentId] ?? AGENT_LABELS[statusKey] ?? {
      label: agent.agentName,
      tabKey: agent.agentId.replace(/_/g, '-'),
      category: 'Other',
    }
    const check = runChecks[statusKey] ?? { hasRun: false, approved: false, runAt: null }
    const assignmentEntry = (approvals[agent.agentId] ?? approvals[statusKey]) as { assignedTo?: string | null } | undefined

    const requiredDocIds = agent.documentIds ?? []
    const hasDocRequirements = requiredDocIds.length > 0
    const missingDocs = requiredDocIds
      .filter(id => !uploadedDocIds.has(id))
      .map(id => ({ id, name: DOCUMENT_NAMES[id] ?? id }))

    const uploadedCount = requiredDocIds.length - missingDocs.length
    const hasRequiredDocs = hasDocRequirements && missingDocs.length === 0
    const isPartialDocs = hasDocRequirements && uploadedCount > 0 && missingDocs.length > 0

    runs.push({
      agentId: agent.agentId,
      agentKey: statusKey,
      label: meta.label,
      category: meta.category,
      status: toStatus(check.hasRun, check.approved, hasRequiredDocs, isPartialDocs, hasDocRequirements),
      assignedTo: assignmentEntry?.assignedTo ?? null,
      runAt: check.runAt,
      tabKey: meta.tabKey,
      missingDocs,
    })
  }

  // Also include any agents that have run but are not explicitly in the active workstream list
  for (const [key, check] of Object.entries(runChecks)) {
    if (!check.hasRun) continue
    if (seen.has(key)) continue
    seen.add(key)

    const meta = AGENT_LABELS[key] ?? {
      label: key,
      tabKey: key.replace(/_/g, '-'),
      category: 'Other',
    }
    const assignmentEntry = approvals[key] as { assignedTo?: string | null } | undefined

    runs.push({
      agentId: key,
      agentKey: key,
      label: meta.label,
      category: meta.category,
      status: toStatus(check.hasRun, check.approved, false, false, false),
      assignedTo: assignmentEntry?.assignedTo ?? null,
      runAt: check.runAt,
      tabKey: meta.tabKey,
    })
  }

  const categoryOrder: Record<string, number> = {
    Valuation: 0,
    'WS1 — Risk & Legal': 1,
    'WS2 — Performance': 2,
    'Reports & Roadmaps': 3,
    'M&A Sale Process': 4,
    Other: 5,
  }
  const statusOrder: Record<AgentRunStatus, number> = { docs_missing: 0, not_started: 1, docs_uploaded: 2, partial_docs: 3, in_review: 4, approved: 5 }
  runs.sort((a, b) => {
    const byCategory = (categoryOrder[a.category] ?? 99) - (categoryOrder[b.category] ?? 99)
    if (byCategory !== 0) return byCategory
    const byStatus = statusOrder[a.status] - statusOrder[b.status]
    if (byStatus !== 0) return byStatus
    return a.label.localeCompare(b.label)
  })

  return NextResponse.json({ runs, reviewers })
}

export async function PATCH(req: NextRequest) {
  const { clientId, agentId, status, assignedTo } = await req.json()
  if (!clientId || !agentId) return new Response('clientId and agentId required', { status: 400 })
  if (status && status !== 'approved' && status !== 'in_review') return new Response('status must be approved or in_review', { status: 400 })

  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: { sectionSubmissions: true },
  })
  if (!client) return new Response('Not Found', { status: 404 })

  const existing = (client.sectionSubmissions as Record<string, unknown>) ?? {}
  const approvals = { ...((existing.agentApprovals as Record<string, unknown>) ?? {}) }
  const statusKey = normalizeAgentStatusKey(agentId)

  const existingEntry = (approvals[agentId] ?? approvals[statusKey] ?? {}) as Record<string, unknown>
  const nextAssignedTo = typeof assignedTo === 'string' ? assignedTo.trim() || null : existingEntry.assignedTo ?? null

  if (status === 'approved') {
    const approvedEntry = { ...existingEntry, status: 'approved', approvedAt: new Date().toISOString(), assignedTo: nextAssignedTo }
    approvals[agentId] = approvedEntry
    approvals[statusKey] = approvedEntry
  } else if (status === 'in_review') {
    const reviewEntry: Record<string, unknown> = { ...existingEntry, assignedTo: nextAssignedTo }
    delete reviewEntry.status
    delete reviewEntry.approvedAt
    approvals[agentId] = reviewEntry
    approvals[statusKey] = reviewEntry
  } else {
    const assignmentEntry = { ...existingEntry, assignedTo: nextAssignedTo }
    approvals[agentId] = assignmentEntry
    approvals[statusKey] = assignmentEntry
  }

  if (status === 'in_review' && !nextAssignedTo) {
    delete approvals[agentId]
    delete approvals[statusKey]
  }

  existing.agentApprovals = approvals

  await prisma.clientProfile.update({
    where: { id: clientId },
    data: { sectionSubmissions: existing as any },
  })

  return NextResponse.json({ ok: true })
}
