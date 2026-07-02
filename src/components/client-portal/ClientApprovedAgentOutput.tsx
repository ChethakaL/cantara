'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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
import OccupancyReviewTab from '@/components/occupancy-review/OccupancyReviewTab'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import { generateReportHtml } from '@/lib/report-export/generate-report-html'
import { buildImprovementRoadmapHtml } from '@/lib/report-export/build-improvement-roadmap-report'
import { parseMarkdownBlocks, serializeMarkdownBlocks, type MarkdownBlock } from '@/lib/markdown-blocks'
import { type SaleReadinessChecklistItem } from '@/lib/sale-readiness-checklist'
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

function escapeHtml(value: string) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function GenericReleasedReport({ agentName, clientName, markdown }: { agentName: string; clientName: string; markdown: string }) {
  const html = generateReportHtml({
    title: agentName,
    subtitle: 'Released Advisor Report',
    clientName,
    generatedAt: new Date().toISOString(),
    sections: [{
      title: 'Report',
      content: `<pre style="white-space:pre-wrap;font-family:Inter,system-ui,sans-serif;font-size:13px;line-height:1.7;color:#334155;">${escapeHtml(markdown)}</pre>`,
    }],
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportReportButton html={html} fileName={`${clientName} - ${agentName}.pdf`} label="Download PDF" advisorAction={false} />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-slate-700">{markdown}</pre>
      </div>
    </div>
  )
}

function isStatusText(value: string) {
  const text = String(value ?? '').toUpperCase()
  return text.includes('RED') || text.includes('YELLOW') || text.includes('GREEN') || value.includes('🔴') || value.includes('🟡') || value.includes('🟢')
}

function statusClasses(value: string) {
  const text = String(value ?? '').toUpperCase()
  if (text.includes('RED') || value.includes('🔴')) return 'border-rose-200 bg-rose-50 text-rose-700'
  if (text.includes('YELLOW') || value.includes('🟡')) return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusClasses(value)}`}>
      {value}
    </span>
  )
}

function MarkdownTable({ block }: { block: Extract<MarkdownBlock, { type: 'table' }> }) {
  return (
    <div className="my-6 overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {block.headers.map((header, index) => (
              <th key={`${header}-${index}`} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="align-top">
              {block.headers.map((_, cellIndex) => {
                const value = row[cellIndex] ?? ''
                return (
                  <td key={cellIndex} className="px-4 py-3 text-sm leading-6 text-slate-700">
                    {isStatusText(value) ? <StatusBadge value={value} /> : value}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const roadmapMarkdownComponents = {
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="mb-5 border-b-2 border-emerald-200 pb-3 text-2xl font-bold tracking-tight text-slate-900">{children}</h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="mb-3 mt-10 border-b border-slate-200 pb-2 text-lg font-bold tracking-tight text-slate-900">{children}</h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mb-2 mt-6 text-sm font-bold text-slate-800">{children}</h3>
  ),
  h4: ({ children }: { children?: ReactNode }) => (
    <h4 className="mb-2 mt-4 text-sm font-semibold text-slate-700">{children}</h4>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="mb-4 text-sm leading-7 text-slate-700">{children}</p>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-bold text-slate-900">{children}</strong>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="mb-5 list-disc space-y-2 pl-5 text-sm text-slate-700 marker:text-emerald-500">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="mb-5 list-decimal space-y-2 pl-5 text-sm text-slate-700 marker:text-emerald-500">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="leading-7">{children}</li>
  ),
  hr: () => <hr className="my-8 border-slate-200" />,
}

function isChecklistHeading(content: string) {
  return /(^|\n)#{2,3}\s+sale-readiness checklist\b/i.test(content)
    || /(^|\n)#{2,3}\s+checklist\b/i.test(content)
}

function buildChecklistBlock(items: SaleReadinessChecklistItem[]): Extract<MarkdownBlock, { type: 'table' }> {
  return {
    type: 'table',
    headers: ['Done', 'Category', 'Item', 'Status', 'Action Needed'],
    rows: items.map(item => [
      item.clientCompleted ? '☑' : '☐',
      item.category,
      item.item,
      item.status || 'Open',
      item.actionNeeded,
    ]),
  }
}

function buildReleasedRoadmapMarkdown(markdown: string, items: SaleReadinessChecklistItem[]) {
  const blocks = parseMarkdownBlocks(markdown)
  let replaceNextTable = false
  const filteredBlocks: MarkdownBlock[] = []

  for (const block of blocks) {
    if (block.type === 'text') {
      filteredBlocks.push(block)
      if (isChecklistHeading(block.content)) replaceNextTable = true
      continue
    }

    if (replaceNextTable) {
      filteredBlocks.push(buildChecklistBlock(items))
      replaceNextTable = false
      continue
    }

    filteredBlocks.push(block)
  }

  return serializeMarkdownBlocks(filteredBlocks)
}

function ClientChecklistTable({
  clientId,
  workstream,
  items,
  onChange,
}: {
  clientId: string
  workstream: 'ws1' | 'ws2'
  items: SaleReadinessChecklistItem[]
  onChange: (items: SaleReadinessChecklistItem[]) => void
}) {
  const [updating, setUpdating] = useState<string | null>(null)

  const toggle = async (item: SaleReadinessChecklistItem) => {
    setUpdating(item.id)
    try {
      const res = await fetch('/api/sale-readiness-checklist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          workstream,
          itemId: item.id,
          clientCompleted: !item.clientCompleted,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update checklist.')
      onChange((data.checklist?.items ?? []).filter((next: SaleReadinessChecklistItem) => next.advisorApproved))
    } finally {
      setUpdating(null)
    }
  }

  if (!items.length) {
    return (
      <div className="my-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        No checklist items have been released by your advisor yet.
      </div>
    )
  }

  return (
    <div className="my-6 overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="w-12 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Done</th>
            <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Category</th>
            <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Item</th>
            <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Status</th>
            <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Action Needed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map(item => (
            <tr key={item.id} className={item.clientCompleted ? 'bg-emerald-50/40' : 'bg-white'}>
              <td className="px-4 py-3 align-top">
                <input
                  type="checkbox"
                  checked={item.clientCompleted}
                  disabled={updating === item.id}
                  onChange={() => void toggle(item)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
              </td>
              <td className="px-4 py-3 align-top text-sm font-medium leading-6 text-slate-600">{item.category}</td>
              <td className={`px-4 py-3 align-top text-sm font-medium leading-6 ${item.clientCompleted ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{item.item}</td>
              <td className="px-4 py-3 align-top"><StatusBadge value={item.status || 'Open'} /></td>
              <td className="px-4 py-3 align-top text-sm leading-6 text-slate-700">{item.actionNeeded}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RoadmapReleasedReport({
  clientId,
  clientName,
  agentName,
  markdown,
  workstream,
}: {
  clientId: string
  clientName: string
  agentName: string
  markdown: string
  workstream: 'ws1' | 'ws2'
}) {
  const [items, setItems] = useState<SaleReadinessChecklistItem[]>([])

  useEffect(() => {
    let cancelled = false
    async function loadChecklist() {
      const res = await fetch(`/api/sale-readiness-checklist?clientId=${encodeURIComponent(clientId)}&workstream=${workstream}&approvedOnly=1`, { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      if (!cancelled) setItems(data.checklist?.items ?? [])
    }
    void loadChecklist()
    return () => { cancelled = true }
  }, [clientId, workstream])

  const blocks = useMemo(() => parseMarkdownBlocks(markdown), [markdown])
  const exportMarkdown = useMemo(() => buildReleasedRoadmapMarkdown(markdown, items), [markdown, items])
  const html = useMemo(() => buildImprovementRoadmapHtml({
    workstream,
    workstreamLabel: workstream === 'ws1' ? 'WS1 — Risk Mitigation' : 'WS2 — Profitability & Growth',
    clientName,
    generatedAt: new Date().toISOString(),
    markdown: exportMarkdown,
  }), [clientName, exportMarkdown, workstream])
  let replaceNextTable = false

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportReportButton html={html} fileName={`${clientName} - ${agentName}.pdf`} label="Download PDF" advisorAction={false} />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        {blocks.map((block, index) => {
          if (block.type === 'text') {
            if (isChecklistHeading(block.content)) replaceNextTable = true
            return (
              <ReactMarkdown key={index} remarkPlugins={[remarkGfm]} components={roadmapMarkdownComponents as any}>
                {block.content}
              </ReactMarkdown>
            )
          }
          if (replaceNextTable) {
            replaceNextTable = false
            return (
              <ClientChecklistTable
                key={index}
                clientId={clientId}
                workstream={workstream}
                items={items}
                onChange={setItems}
              />
            )
          }
          return <MarkdownTable key={index} block={block} />
        })}
      </div>
    </div>
  )
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

  const frame = (node: ReactNode) => (
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

    case 'occupancyReview':
      return frame(<OccupancyReviewTab clientId={clientId} clientName={clientName} readOnly />)

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

    case 'ws1Roadmap':
      if (fallbackMarkdown?.trim()) {
        return frame(
          <RoadmapReleasedReport
            clientId={clientId}
            clientName={clientName}
            agentName={agentName}
            markdown={fallbackMarkdown}
            workstream="ws1"
          />,
        )
      }
      return null

    case 'ws2Roadmap':
      if (fallbackMarkdown?.trim()) {
        return frame(
          <RoadmapReleasedReport
            clientId={clientId}
            clientName={clientName}
            agentName={agentName}
            markdown={fallbackMarkdown}
            workstream="ws2"
          />,
        )
      }
      return null

    default:
      if (fallbackMarkdown?.trim()) {
        return frame(<GenericReleasedReport agentName={agentName} clientName={clientName} markdown={fallbackMarkdown} />)
      }
      return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          Approved output for {agentName} is not available in the client portal yet.
        </div>
      )
  }
}
