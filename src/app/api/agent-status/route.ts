import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getLatestTaxLiabilityReport } from '@/lib/tax-liability-review/storage'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return new Response('clientId required', { status: 400 })

  try {
    const [
      ttmAnalysis,
      lease,
      realEstateAppraisal,
      competitor,
      employeeObligations,
      contract,
      ownershipVerification,
      permitsZoning,
      facilityReview,
      pricingAnalysis,
      pricingVertical,
      salesProcessReview,
      legalEntitySearch,
      taxLiabilityReport,
      insuranceDoc,
      salesDoc,
      clientProfile,
    ] = await Promise.all([
      prisma.ttmAnalysis.findFirst({ where: { clientId }, select: { id: true } }).catch(() => null),
      prisma.leaseAnalysis.findFirst({ where: { clientId }, select: { id: true } }).catch(() => null),
      (prisma as any).realEstateAppraisalReport?.findFirst?.({ where: { clientId }, select: { id: true } })?.catch(() => null) ?? null,
      prisma.competitorAnalysis.findFirst({ where: { clientId }, select: { id: true } }).catch(() => null),
      prisma.employeeObligationsReport.findFirst({ where: { clientId }, select: { id: true } }).catch(() => null),
      prisma.contractAnalysis.findFirst({ where: { clientId }, select: { id: true } }).catch(() => null),
      (prisma as any).ownershipVerificationReport?.findFirst?.({ where: { clientId }, select: { id: true } })?.catch(() => null) ?? null,
      (prisma as any).permitsZoningReport?.findFirst?.({ where: { clientId }, select: { id: true } })?.catch(() => null) ?? null,
      (prisma as any).facilityReviewReport?.findFirst?.({ where: { clientId }, select: { id: true } })?.catch(() => null) ?? null,
      (prisma as any).pricingAnalysisReport?.findFirst?.({ where: { clientId }, select: { id: true } })?.catch(() => null) ?? null,
      (prisma as any).pricingVerticalReport?.findFirst?.({ where: { clientId }, select: { id: true } })?.catch(() => null) ?? null,
      (prisma as any).salesReviewReport?.findFirst?.({ where: { clientId }, select: { id: true } })?.catch(() => null) ?? null,
      (prisma as any).legalEntitySearchReport?.findFirst?.({ where: { clientId }, select: { id: true } })?.catch(() => null) ?? null,
      getLatestTaxLiabilityReport(clientId).catch(() => null),
      (prisma as any).clientDocument?.findFirst?.({
        where: { clientId, documentId: 'insurance_claims_12m' },
        orderBy: { createdAt: 'desc' },
        select: { aiReviewSummary: true, aiReviewStatus: true },
      })?.catch(() => null) ?? null,
      (prisma as any).clientDocument?.findFirst?.({
        where: { clientId, documentId: 'sales_process_transcript' },
        orderBy: { createdAt: 'desc' },
        select: { aiReviewSummary: true, aiReviewStatus: true },
      })?.catch(() => null) ?? null,
      prisma.clientProfile.findFirst({
        where: { id: clientId },
        select: { sectionSubmissions: true },
      }).catch(() => null),
    ])

    const submissions = (clientProfile?.sectionSubmissions as Record<string, unknown> | null) ?? {}

    const checks: Record<string, boolean> = {
      ttmAnalysis: Boolean(ttmAnalysis || submissions.valuation),
      lease: Boolean(lease),
      realEstateAppraisal: Boolean(realEstateAppraisal),
      competitor: Boolean(competitor),
      employeeObligations: Boolean(employeeObligations),
      contract: Boolean(contract),
      ownershipVerification: Boolean(ownershipVerification || submissions.ownershipVerification),
      permitsZoning: Boolean(permitsZoning || submissions.permitsZoning),
      facilityReview: Boolean(facilityReview || submissions.facilityReview),
      pricingAnalysis: Boolean(pricingAnalysis || submissions.pricingAnalysis),
      pricingVertical: Boolean(pricingVertical || submissions.pricingVertical),
      salesProcessReview: Boolean(salesProcessReview || submissions.salesProcessReview || insuranceDoc?.aiReviewSummary || salesDoc?.aiReviewSummary),
      legalEntitySearch: Boolean(legalEntitySearch),
      taxLiabilityReview: Boolean(taxLiabilityReport),
      insuranceReview: Boolean(insuranceDoc?.aiReviewSummary || insuranceDoc?.aiReviewStatus || submissions.insuranceReview),
      digitalPresence: Boolean(submissions.digitalPresence),
      litigationSearch: Boolean(submissions.litigationSearch),
      employeeComp: Boolean(submissions.employeeCompReport || submissions.employeeComp),
      ownerGmAssessment: Boolean(submissions.ownerGmAssessment),
      professionalAdvisors: Array.isArray(submissions.professionalAdvisors) && submissions.professionalAdvisors.length > 0,
      vendorDirectory: Array.isArray(submissions.vendorDirectory) && submissions.vendorDirectory.length > 0,
      orgChart: Boolean(submissions.orgChart),
    }

    return NextResponse.json(checks)
  } catch (err) {
    console.error('[agent-status] error:', err)
    return NextResponse.json({})
  }
}
