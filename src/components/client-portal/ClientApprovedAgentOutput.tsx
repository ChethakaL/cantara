'use client'

import { AgentClientPortalFrame } from '@/components/client-portal/AgentClientPortalFrame'
import LeaseAnalysisTab from '@/components/admin/LeaseAnalysis'
import ContractAnalysisTab from '@/components/admin/ContractAnalysis'
import InsuranceReviewTab from '@/components/admin/InsuranceReviewTab'
import DigitalPresenceTab from '@/components/digital-presence/DigitalPresenceTab'
import CompetitorAnalysisTab from '@/components/competitor-analysis/CompetitorAnalysisTab'
import FacilityReviewTab from '@/components/facility-review/FacilityReviewTab'
import ProfessionalAdvisorsTab from '@/components/advisors/ProfessionalAdvisorsTab'
import VendorDirectoryTab from '@/components/vendor-directory/VendorDirectoryTab'
import OrgChartReviewTab from '@/components/org-chart/OrgChartReviewTab'
import LitigationSearchTab from '@/components/litigation-search/LitigationSearchTab'
import EmployeeCompTab from '@/components/employee-comp/EmployeeCompTab'
import EmployeeObligationsTab from '@/components/ws1-6/EmployeeObligationsTab'
import OwnershipVerificationTab from '@/components/ws1-8/OwnershipVerificationTab'
import PermitsZoningTab from '@/components/ws1-9/PermitsZoningTab'
import OwnerGmAssessmentTab from '@/components/owner-gm-assessment/OwnerGmAssessmentTab'
import PricingAnalysisTab from '@/components/pricing-analysis/PricingAnalysisTab'
import PricingByVerticalTab from '@/components/pricing-vertical/PricingByVerticalTab'
import SalesProcessReviewTab from '@/components/sales-review/SalesProcessReviewTab'
import LegalEntitySearchTab from '@/components/legal-entity-search/LegalEntitySearchTab'
import TaxLiabilityReviewTab from '@/components/tax-liability-review/TaxLiabilityReviewTab'
import CimGeneratorTab from '@/components/cim/CimGeneratorTab'
import TeaserGeneratorTab from '@/components/teaser/TeaserGeneratorTab'
import NetProceedsCalculator from '@/components/net-proceeds/NetProceedsCalculator'
import ClientLocationMapTab from '@/components/client-location-map/ClientLocationMapTab'
import { Ws2WorkbookView } from '@/components/ttm-agent/Ws2WorkbookView'
import DigitalPresenceScorecard from '@/components/digital-presence/DigitalPresenceScorecard'

export type ClientApprovedClient = {
  id: string
  name: string
  company?: string | null
  businessAddress?: string | null
  businessCategory?: string | null
  websiteUrl?: string | null
  state?: string | null
  dba?: string | null
  totalEmployeesSelfReported?: number | string | null
  employmentTypeBreakdown?: string | null
}

type ClientApprovedAgentOutputProps = {
  agentKey: string
  agentName: string
  client: ClientApprovedClient
  prefetchedData?: unknown
  fallbackMarkdown?: string
}

function displayName(client: ClientApprovedClient) {
  return client.company || client.name
}

function ValuationApprovedView({ data, clientName, fallbackMarkdown }: { data: unknown; clientName: string; fallbackMarkdown?: string }) {
  const record = data && typeof data === 'object' ? data as Record<string, any> : {}
  if (record.analysis && record.recastView) {
    return (
      <Ws2WorkbookView
        analysis={record.analysis}
        recast={record.recastView}
        clientName={clientName}
        readOnly
      />
    )
  }
  if (fallbackMarkdown?.trim()) {
    return <pre className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{fallbackMarkdown}</pre>
  }
  return null
}

function renderDigitalPresenceApproved(data: unknown) {
  const record = data && typeof data === 'object' ? data as Record<string, unknown> : {}
  const report = (record.report ?? record) as Record<string, unknown>
  if (Array.isArray(report.channels) && typeof report.businessName === 'string') {
    return <DigitalPresenceScorecard report={report as any} readOnly />
  }
  return null
}

export default function ClientApprovedAgentOutput({
  agentKey,
  agentName,
  client,
  prefetchedData,
  fallbackMarkdown,
}: ClientApprovedAgentOutputProps) {
  const clientId = client.id
  const clientName = displayName(client)

  const frame = (node: React.ReactNode) => (
    <AgentClientPortalFrame readOnly>{node}</AgentClientPortalFrame>
  )

  switch (agentKey) {
    case 'ttmAnalysis':
      return frame(
        <ValuationApprovedView
          data={prefetchedData}
          clientName={clientName}
          fallbackMarkdown={fallbackMarkdown}
        />,
      )

    case 'digitalPresence': {
      const rendered = renderDigitalPresenceApproved(prefetchedData)
      if (rendered) return frame(rendered)
      return frame(
        <DigitalPresenceTab
          clientId={clientId}
          clientName={clientName}
          clientWebsite={client.websiteUrl ?? undefined}
          readOnly
        />,
      )
    }

    case 'clientLocationMap':
      return frame(
        <ClientLocationMapTab
          clientId={clientId}
          clientName={clientName}
          businessAddress={client.businessAddress || ''}
          readOnly
        />,
      )

    case 'lease':
      return frame(<LeaseAnalysisTab clientId={clientId} clientName={clientName} readOnly />)

    case 'contract':
      return frame(<ContractAnalysisTab clientId={clientId} clientName={clientName} readOnly />)

    case 'competitor':
      return frame(
        <CompetitorAnalysisTab
          clientId={clientId}
          businessName={clientName}
          businessAddress={client.businessAddress || ''}
          businessCategory={client.businessCategory || ''}
          websiteUrl={client.websiteUrl || ''}
          readOnly
        />,
      )

    case 'employeeObligations':
      return frame(
        <EmployeeObligationsTab
          clientId={clientId}
          clientName={clientName}
          state={client.state || 'Unknown'}
          dba={client.dba || undefined}
          totalEmployeesSelfReported={client.totalEmployeesSelfReported ?? undefined}
          employmentTypeBreakdown={client.employmentTypeBreakdown ?? undefined}
          readOnly
        />,
      )

    case 'insuranceReview':
      return frame(<InsuranceReviewTab clientId={clientId} clientName={clientName} readOnly />)

    case 'litigationSearch':
      return frame(
        <LitigationSearchTab
          clientId={clientId}
          clientName={clientName}
          businessAddress={client.businessAddress || ''}
          readOnly
        />,
      )

    case 'employeeComp':
      return frame(<EmployeeCompTab clientId={clientId} clientName={clientName} readOnly />)

    case 'orgChart':
      return frame(<OrgChartReviewTab clientId={clientId} clientName={clientName} readOnly />)

    case 'ownerGmAssessment':
      return frame(<OwnerGmAssessmentTab clientId={clientId} clientName={clientName} readOnly />)

    case 'ownershipVerification':
      return frame(<OwnershipVerificationTab clientId={clientId} clientName={clientName} readOnly />)

    case 'permitsZoning':
      return frame(<PermitsZoningTab clientId={clientId} clientName={clientName} readOnly />)

    case 'professionalAdvisors':
      return frame(<ProfessionalAdvisorsTab clientId={clientId} clientName={clientName} readOnly />)

    case 'vendorDirectory':
      return frame(<VendorDirectoryTab clientId={clientId} clientName={clientName} readOnly />)

    case 'facilityReview':
      return frame(
        <FacilityReviewTab
          clientId={clientId}
          clientName={clientName}
          businessAddress={client.businessAddress || ''}
          readOnly
        />,
      )

    case 'pricingAnalysis':
      return frame(<PricingAnalysisTab clientId={clientId} clientName={clientName} readOnly />)

    case 'pricingVertical':
      return frame(<PricingByVerticalTab clientId={clientId} clientName={clientName} readOnly />)

    case 'salesProcessReview':
      return frame(<SalesProcessReviewTab clientId={clientId} clientName={client.name} readOnly />)

    case 'legalEntitySearch':
      return frame(
        <LegalEntitySearchTab
          clientId={clientId}
          clientName={clientName}
          state={client.state}
          dba={client.dba || undefined}
          businessAddress={client.businessAddress || ''}
          readOnly
        />,
      )

    case 'taxLiabilityReview':
      return frame(<TaxLiabilityReviewTab clientId={clientId} clientName={clientName} readOnly />)

    case 'cim':
      return frame(<CimGeneratorTab clientId={clientId} clientName={clientName} readOnly />)

    case 'teaser':
      return frame(<TeaserGeneratorTab clientId={clientId} clientName={clientName} readOnly />)

    case 'net_proceeds':
      return frame(<NetProceedsCalculator clientId={clientId} clientName={clientName} readOnly />)

    default:
      if (fallbackMarkdown?.trim()) {
        return <pre className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{fallbackMarkdown}</pre>
      }
      return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          Approved output for {agentName} is not available in the client portal yet.
        </div>
      )
  }
}
