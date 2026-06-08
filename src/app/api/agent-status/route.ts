import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return new Response('clientId required', { status: 400 })

  const checks: Record<string, boolean> = {}

  // TTM / Valuation — newer runs use TtmAnalysis; older/client-side completion uses sectionSubmissions.valuation.
  try { checks.ttmAnalysis = !!(await prisma.ttmAnalysis.findFirst({ where: { clientId }, select: { id: true } })) } catch { checks.ttmAnalysis = false }

  // Lease Analysis — has its own table
  try { checks.lease = !!(await prisma.leaseAnalysis.findFirst({ where: { clientId }, select: { id: true } })) } catch { checks.lease = false }

  // Competitor Analysis — has its own table
  try { checks.competitor = !!(await prisma.competitorAnalysis.findFirst({ where: { clientId }, select: { id: true } })) } catch { checks.competitor = false }

  // Employee Obligations — has its own table
  try { checks.employeeObligations = !!(await prisma.employeeObligationsReport.findFirst({ where: { clientId }, select: { id: true } })) } catch { checks.employeeObligations = false }

  // Contract Analysis — has its own table
  try { checks.contract = !!(await prisma.contractAnalysis.findFirst({ where: { clientId }, select: { id: true } })) } catch { checks.contract = false }

  // Ownership Verification / Permits & Zoning — dedicated report tables
  try { checks.ownershipVerification = !!(await (prisma as any).ownershipVerificationReport.findFirst({ where: { clientId }, select: { id: true } })) } catch { checks.ownershipVerification = false }
  try { checks.permitsZoning = !!(await (prisma as any).permitsZoningReport.findFirst({ where: { clientId }, select: { id: true } })) } catch { checks.permitsZoning = false }

  // WS2 derived/follow-on agents — completion is persisted in dedicated or JSON-backed records.
  try { checks.facilityReview = !!(await (prisma as any).facilityReviewReport?.findFirst?.({ where: { clientId }, select: { id: true } })) } catch { checks.facilityReview = false }
  try { checks.pricingAnalysis = !!(await (prisma as any).pricingAnalysisReport?.findFirst?.({ where: { clientId }, select: { id: true } })) } catch { checks.pricingAnalysis = false }
  try { checks.pricingVertical = !!(await (prisma as any).pricingVerticalReport?.findFirst?.({ where: { clientId }, select: { id: true } })) } catch { checks.pricingVertical = false }
  try { checks.salesProcessReview = !!(await (prisma as any).salesReviewReport?.findFirst?.({ where: { clientId }, select: { id: true } })) } catch { checks.salesProcessReview = false }

  // Legal Entity Search — has its own table
  try { checks.legalEntitySearch = !!(await (prisma as any).legalEntitySearchReport.findFirst({ where: { clientId }, select: { id: true } })) } catch { checks.legalEntitySearch = false }

  // Tax Liability Review — has its own table
  try { checks.taxLiabilityReview = !!(await (prisma as any).taxLiabilityReport.findFirst({ where: { clientId }, select: { id: true } })) } catch { checks.taxLiabilityReview = false }

  // Insurance Review — saved on the uploaded insurance claim document review fields.
  try {
    const insuranceDoc = await (prisma as any).clientDocument.findFirst({
      where: { clientId, documentId: 'insurance_claims_12m' },
      orderBy: { createdAt: 'desc' },
      select: { aiReviewSummary: true, aiReviewStatus: true },
    })
    checks.insuranceReview = Boolean(insuranceDoc?.aiReviewSummary || insuranceDoc?.aiReviewStatus)
  } catch { checks.insuranceReview = false }

  // Sales Process Review — saved on the uploaded transcript document review fields.
  try {
    const salesDoc = await (prisma as any).clientDocument.findFirst({
      where: { clientId, documentId: 'sales_process_transcript' },
      orderBy: { createdAt: 'desc' },
      select: { aiReviewSummary: true, aiReviewStatus: true },
    })
    checks.salesProcessReview = checks.salesProcessReview || Boolean(salesDoc?.aiReviewSummary || salesDoc?.aiReviewStatus)
  } catch { checks.salesProcessReview = checks.salesProcessReview || false }

  // Digital Presence — stored in sectionSubmissions (NO dedicated table)
  try {
    const client = await prisma.clientProfile.findFirst({
      where: { id: clientId },
      select: { sectionSubmissions: true },
    })
    const submissions = client?.sectionSubmissions as Record<string, unknown> | null
    checks.ttmAnalysis = checks.ttmAnalysis || Boolean(submissions?.valuation)
    checks.digitalPresence = Boolean(submissions?.digitalPresence)
    checks.insuranceReview = checks.insuranceReview || Boolean(submissions?.insuranceReview)
    checks.litigationSearch = Boolean(submissions?.litigationSearch)
    checks.employeeComp = Boolean(submissions?.employeeCompReport || submissions?.employeeComp)
    checks.ownerGmAssessment = Boolean(submissions?.ownerGmAssessment)
    checks.professionalAdvisors = Boolean(submissions?.professionalAdvisors)
    checks.vendorDirectory = Boolean(submissions?.vendorDirectory)
    checks.facilityReview = checks.facilityReview || Boolean(submissions?.facilityReview)
    checks.pricingAnalysis = checks.pricingAnalysis || Boolean(submissions?.pricingAnalysis)
    checks.pricingVertical = checks.pricingVertical || Boolean(submissions?.pricingVertical)
    checks.salesProcessReview = checks.salesProcessReview || Boolean(submissions?.salesProcessReview)
  } catch { checks.digitalPresence = false }

  // Org Chart — stored in sectionSubmissions
  try {
    const client = await prisma.clientProfile.findFirst({
      where: { id: clientId },
      select: { sectionSubmissions: true },
    })
    const submissions = client?.sectionSubmissions as Record<string, unknown> | null
    checks.orgChart = Boolean(submissions?.orgChart)
    checks.ownershipVerification = checks.ownershipVerification || Boolean(submissions?.ownershipVerification)
    checks.permitsZoning = checks.permitsZoning || Boolean(submissions?.permitsZoning)
  } catch { checks.orgChart = false }

  return NextResponse.json(checks)
}
