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
  status: AgentRunStatus
  runAt: string | null
  tabKey: string | null
  missingDocs?: { id: string; name: string }[]
}

const AGENT_LABELS: Record<string, { label: string; tabKey: string }> = {
  ttm: { label: 'Valuation Agent', tabKey: 'ttm' },
  ttmAnalysis: { label: 'Valuation Agent', tabKey: 'ttm' },
  employee_obligations: { label: 'Employee Obligations', tabKey: 'employee-obligations' },
  employeeObligations: { label: 'Employee Obligations', tabKey: 'employee-obligations' },
  employee_comp: { label: 'Employee Staffing & Compensation', tabKey: 'employee-comp' },
  employeeComp: { label: 'Employee Staffing & Compensation', tabKey: 'employee-comp' },
  insurance_review: { label: 'Insurance Review', tabKey: 'insurance' },
  insuranceReview: { label: 'Insurance Review', tabKey: 'insurance' },
  lease_analysis: { label: 'Lease Analysis', tabKey: 'lease' },
  lease: { label: 'Lease Analysis', tabKey: 'lease' },
  litigation_search: { label: 'Litigation & Liens', tabKey: 'litigation' },
  litigationSearch: { label: 'Litigation & Liens', tabKey: 'litigation' },
  contract_analysis: { label: 'Material Contracts', tabKey: 'contract' },
  contract: { label: 'Material Contracts', tabKey: 'contract' },
  org_chart_review: { label: 'Org Chart Review', tabKey: 'org-chart' },
  orgChart: { label: 'Org Chart Review', tabKey: 'org-chart' },
  owner_gm_assessment: { label: 'Owner & GM Assessment', tabKey: 'owner-gm-assessment' },
  ownerGmAssessment: { label: 'Owner & GM Assessment', tabKey: 'owner-gm-assessment' },
  ownership_verification: { label: 'Ownership Verification', tabKey: 'ownership-verification' },
  ownershipVerification: { label: 'Ownership Verification', tabKey: 'ownership-verification' },
  permits_zoning: { label: 'Permits & Zoning', tabKey: 'permits-zoning' },
  permitsZoning: { label: 'Permits & Zoning', tabKey: 'permits-zoning' },
  professional_advisors: { label: 'Professional Advisors', tabKey: 'advisors' },
  professionalAdvisors: { label: 'Professional Advisors', tabKey: 'advisors' },
  vendor_directory: { label: 'Software & Vendors', tabKey: 'vendor-directory' },
  vendorDirectory: { label: 'Software & Vendors', tabKey: 'vendor-directory' },
  legal_entity_search: { label: 'Legal Reports & Entity Search', tabKey: 'legal-entity-search' },
  legalEntitySearch: { label: 'Legal Reports & Entity Search', tabKey: 'legal-entity-search' },
  tax_liability_review: { label: 'Tax Liability Review', tabKey: 'tax-liability-review' },
  taxLiabilityReview: { label: 'Tax Liability Review', tabKey: 'tax-liability-review' },
  competitor_analysis: { label: 'Competitor Analysis', tabKey: 'competitor' },
  competitor: { label: 'Competitor Analysis', tabKey: 'competitor' },
  digital_presence: { label: 'Digital Presence', tabKey: 'digital' },
  digitalPresence: { label: 'Digital Presence', tabKey: 'digital' },
  facility_review: { label: 'Facility Review Agent', tabKey: 'facility-review' },
  facilityReview: { label: 'Facility Review Agent', tabKey: 'facility-review' },
  pricing_analysis: { label: 'Competitive Pricing Analysis', tabKey: 'pricing-analysis' },
  pricingAnalysis: { label: 'Competitive Pricing Analysis', tabKey: 'pricing-analysis' },
  pricing_vertical: { label: 'Pricing by Vertical', tabKey: 'pricing-vertical' },
  pricingVertical: { label: 'Pricing by Vertical', tabKey: 'pricing-vertical' },
  sales_process_review: { label: 'Sales Process Review', tabKey: 'sales-process-review' },
  salesProcessReview: { label: 'Sales Process Review', tabKey: 'sales-process-review' },
  cim: { label: 'CIM Generator', tabKey: 'cim' },
  teaser: { label: 'Deal Teaser Generator', tabKey: 'teaser' },
  net_proceeds: { label: 'Net Proceeds Calculator', tabKey: 'net-proceeds' },
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


function hitlIsApproved(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const hitl = (value as { hitlStatus?: string }).hitlStatus
  return hitl === 'complete' || hitl === 'APPROVED'
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
    safeFind(() => prisma.clientDocument.findFirst({ where: { clientId, documentId: 'sales_process_transcript' }, orderBy: { createdAt: 'desc' }, select: { aiReviewSummary: true, aiReviewStatus: true, createdAt: true } })),
    safeFind(() => prisma.clientDocument.findMany({ where: { clientId }, select: { documentId: true } })),
  ])

  const runChecks: Record<string, { hasRun: boolean; approved: boolean; runAt: string | null }> = {
    ttmAnalysis: {
      hasRun: Boolean(ttm || submissions.valuation),
      approved: ttm?.status === 'APPROVED' || manualApproval(approvals, 'ttm', 'ttmAnalysis'),
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
      approved: hitlIsApproved(employeeObligations?.metadata) || manualApproval(approvals, 'employee_obligations', 'employeeObligations'),
      runAt: employeeObligations?.createdAt?.toISOString() ?? null,
    },
    ownershipVerification: {
      hasRun: Boolean(ownershipVerification || submissions.ownershipVerification),
      approved: hitlIsApproved(ownershipVerification?.metadata) || hitlIsApproved(submissions.ownershipVerification) || manualApproval(approvals, 'ownership_verification', 'ownershipVerification'),
      runAt: ownershipVerification?.createdAt?.toISOString() ?? null,
    },
    permitsZoning: {
      hasRun: Boolean(permitsZoning || submissions.permitsZoning),
      approved: hitlIsApproved(permitsZoning?.metadata) || hitlIsApproved(submissions.permitsZoning) || manualApproval(approvals, 'permits_zoning', 'permitsZoning'),
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
      approved: hitlIsApproved(submissions.insuranceReview) || manualApproval(approvals, 'insurance_review', 'insuranceReview'),
      runAt: insuranceDoc?.createdAt?.toISOString() ?? null,
    },
    salesProcessReview: {
      hasRun: Boolean(salesDoc?.aiReviewSummary || salesDoc?.aiReviewStatus || submissions.salesProcessReview),
      approved: hitlIsApproved(submissions.salesProcessReview) || manualApproval(approvals, 'sales_process_review', 'salesProcessReview'),
      runAt: salesDoc?.createdAt?.toISOString() ?? null,
    },
    digitalPresence: {
      hasRun: Boolean(submissions.digitalPresence),
      approved: hitlIsApproved(submissions.digitalPresence) || manualApproval(approvals, 'digital_presence', 'digitalPresence'),
      runAt: (submissions.digitalPresence as { generatedAt?: string })?.generatedAt ?? null,
    },
    litigationSearch: {
      hasRun: Boolean(submissions.litigationSearch),
      approved: hitlIsApproved(submissions.litigationSearch) || manualApproval(approvals, 'litigation_search', 'litigationSearch'),
      runAt: (submissions.litigationSearch as { generatedAt?: string })?.generatedAt ?? null,
    },
    employeeComp: {
      hasRun: Boolean(submissions.employeeCompReport || submissions.employeeComp),
      approved: hitlIsApproved(submissions.employeeCompReport ?? submissions.employeeComp) || manualApproval(approvals, 'employee_comp', 'employeeComp'),
      runAt: null,
    },
    ownerGmAssessment: {
      hasRun: Boolean(submissions.ownerGmAssessment),
      approved: hitlIsApproved(submissions.ownerGmAssessment) || manualApproval(approvals, 'owner_gm_assessment', 'ownerGmAssessment'),
      runAt: null,
    },
    professionalAdvisors: {
      hasRun: Boolean(submissions.professionalAdvisors),
      approved: hitlIsApproved(submissions.professionalAdvisors) || manualApproval(approvals, 'professional_advisors', 'professionalAdvisors'),
      runAt: null,
    },
    vendorDirectory: {
      hasRun: Boolean(submissions.vendorDirectory),
      approved: hitlIsApproved(submissions.vendorDirectory) || manualApproval(approvals, 'vendor_directory', 'vendorDirectory'),
      runAt: null,
    },
    facilityReview: {
      hasRun: Boolean(submissions.facilityReview),
      approved: hitlIsApproved(submissions.facilityReview) || manualApproval(approvals, 'facility_review', 'facilityReview'),
      runAt: (submissions.facilityReview as { generatedAt?: string })?.generatedAt ?? null,
    },
    pricingAnalysis: {
      hasRun: Boolean(submissions.pricingAnalysis),
      approved: hitlIsApproved(submissions.pricingAnalysis) || manualApproval(approvals, 'pricing_analysis', 'pricingAnalysis'),
      runAt: null,
    },
    pricingVertical: {
      hasRun: Boolean(submissions.pricingVertical),
      approved: hitlIsApproved(submissions.pricingVertical) || manualApproval(approvals, 'pricing_vertical', 'pricingVertical'),
      runAt: null,
    },
    orgChart: {
      hasRun: Boolean(submissions.orgChart),
      approved: hitlIsApproved(submissions.orgChart) || manualApproval(approvals, 'org_chart_review', 'orgChart'),
      runAt: null,
    },
    cim: {
      hasRun: Boolean(cimReport?.data),
      approved: manualApproval(approvals, 'cim', 'cim') || Boolean((cimReport?.data as { approved?: boolean })?.approved),
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
    }
    const check = runChecks[statusKey] ?? { hasRun: false, approved: false, runAt: null }

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
      status: toStatus(check.hasRun, check.approved, hasRequiredDocs, isPartialDocs, hasDocRequirements),
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
    }

    runs.push({
      agentId: key,
      agentKey: key,
      label: meta.label,
      status: toStatus(check.hasRun, check.approved, false, false, false),
      runAt: check.runAt,
      tabKey: meta.tabKey,
    })
  }

  const statusOrder: Record<AgentRunStatus, number> = { in_review: 0, approved: 1, docs_uploaded: 2, partial_docs: 3, docs_missing: 4, not_started: 5 }
  runs.sort((a, b) => {
    const byStatus = statusOrder[a.status] - statusOrder[b.status]
    if (byStatus !== 0) return byStatus
    return a.label.localeCompare(b.label)
  })

  return NextResponse.json({ runs })
}

export async function PATCH(req: NextRequest) {
  const { clientId, agentId, status } = await req.json()
  if (!clientId || !agentId || !status) return new Response('clientId, agentId, and status required', { status: 400 })
  if (status !== 'approved' && status !== 'in_review') return new Response('status must be approved or in_review', { status: 400 })

  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: { sectionSubmissions: true },
  })
  if (!client) return new Response('Not Found', { status: 404 })

  const existing = (client.sectionSubmissions as Record<string, unknown>) ?? {}
  const approvals = { ...((existing.agentApprovals as Record<string, unknown>) ?? {}) }
  const statusKey = normalizeAgentStatusKey(agentId)

  if (status === 'approved') {
    approvals[agentId] = { status: 'approved', approvedAt: new Date().toISOString() }
    approvals[statusKey] = { status: 'approved', approvedAt: new Date().toISOString() }
  } else {
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
