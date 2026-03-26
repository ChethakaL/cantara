'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, ClipboardCheck, FileText } from 'lucide-react'
import { AdminReviewDashboard } from '@/components/ttm-agent/AdminReviewDashboard'
import { Ws21StructuredReport } from '@/components/ttm-agent/Ws21StructuredReport'
import { Badge, Button, Card } from '@/components/ui'
import type { TtmAnalysisView } from '@/lib/ttm-agent/types'

function formatCurrency(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `$${value.toLocaleString()}` : 'n/a'
}

function formatPct(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)}%` : 'n/a'
}

function humanizeStatus(status: TtmAnalysisView['status']) {
  if (status === 'HITL_PENDING') return 'HITL Pending'
  if (status === 'APPROVED') return 'Approved'
  if (status === 'FAILED') return 'Failed'
  return status
}

function summarizePrimaryAreas(analysis: TtmAnalysisView) {
  return analysis.flags
    .filter((flag) => flag.resolutionStatus !== 'ACTIONED')
    .slice(0, 3)
    .map((flag) => ({
      title: flag.title,
      description: flag.description ?? 'Review detail available in the queue below.',
      section: flag.section,
    }))
}

function cleanSectionTitle(title: string) {
  return title.replace(/^Section [A-E] - /, '')
}

function DetailSection({
  id,
  title,
  description,
  icon,
  open,
  onToggle,
  children,
}: {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl bg-slate-100 p-2 text-slate-600">{icon}</div>
            <div>
              <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
              <p className="mt-1 text-xs text-slate-400">{description}</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={onToggle}>
            {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            {open ? 'Hide' : 'Show'}
          </Button>
        </div>
        {open && <div className="mt-4">{children}</div>}
      </Card>
    </section>
  )
}

export function Ws21ReviewWorkspace({
  analysis,
  actorName,
  onUpdated,
}: {
  analysis: TtmAnalysisView
  actorName: string
  onUpdated: (analysis: TtmAnalysisView) => void
}) {
  const [openSections, setOpenSections] = useState({
    report: false,
  })

  const unresolvedCount = analysis.flags.filter((flag) => flag.resolutionStatus !== 'ACTIONED').length
  const sectionCounts = analysis.dataQualityReport?.counts ?? { A: 0, B: 0, C: 0, D: 0, E: 0 }
  const primaryAreas = useMemo(() => summarizePrimaryAreas(analysis), [analysis])

  const focusSections = Object.entries(sectionCounts)
    .filter(([, count]) => count > 0)
    .map(([section, count]) => ({
      section,
      count,
      title: cleanSectionTitle(analysis.dataQualityReport?.sections[section as keyof typeof sectionCounts]?.title ?? `Section ${section}`),
    }))

  return (
    <div className="space-y-6">
      <section id="ws21-pack" className="scroll-mt-24">
        <Card className="overflow-hidden border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50/70 px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">WS2-1 Financial Review</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">Review what needs attention</h3>
                <p className="mt-2 text-sm text-slate-500">
                  Run #{analysis.version} · {new Date(analysis.createdAt).toLocaleString()} · {actorName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge color={analysis.status === 'APPROVED' ? 'green' : analysis.status === 'FAILED' ? 'red' : 'gold'}>
                  {humanizeStatus(analysis.status)}
                </Badge>
                <Badge color={unresolvedCount > 0 ? 'gold' : 'green'}>
                  {unresolvedCount > 0 ? `${unresolvedCount} Open` : 'Ready to Approve'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="px-6 py-6">
            <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-amber-600" />
                  <h4 className="text-sm font-semibold text-slate-800">What needs review</h4>
                </div>
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-medium text-slate-900">
                    {unresolvedCount > 0
                      ? `${unresolvedCount} item${unresolvedCount === 1 ? '' : 's'} need review before WS2-2 can run.`
                      : 'All review items are actioned and ready for approval.'}
                  </p>
                </div>
                {primaryAreas.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {primaryAreas.map((area) => (
                      <div key={`${area.section}-${area.title}`} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Badge color="gold">Section {area.section}</Badge>
                          <p className="text-sm font-semibold text-slate-900">{area.title}</p>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{area.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 p-5">
                <h4 className="text-sm font-semibold text-slate-800">Financial snapshot</h4>
                <p className="mt-1 text-xs text-slate-500">Pre-recast view from WS2-1. Add-backs are handled later in WS2-2.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">TTM revenue</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(analysis.ttmSummary?.totalRevenue)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Gross margin</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{formatPct(analysis.ttmSummary?.grossMarginPct)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Pre-recast EBITDA</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(analysis.ttmSummary?.ebitdaPreRecast)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Model confidence</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{analysis.structuredModel?.confidence ?? 'Not available'}</p>
                  </div>
                </div>
              </div>
            </div>

            {focusSections.length > 0 && (
              <div className="mt-5">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-slate-500" />
                  <h4 className="text-sm font-semibold text-slate-800">Sections in focus</h4>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {focusSections.map(({ section, count, title }) => (
                    <div key={section} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <Badge color="slate">Section {section}</Badge>
                        <Badge color="gold">{count} {count === 1 ? 'item' : 'items'}</Badge>
                      </div>
                      <p className="mt-3 text-sm font-semibold leading-6 text-slate-900">{title}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      </section>

      <section id="ws21-review" className="scroll-mt-24">
        <AdminReviewDashboard
          analysis={analysis}
          actorName={actorName}
          onUpdated={onUpdated}
        />
      </section>

      <DetailSection
        id="ws21-report"
        title="Full WS2-1 Report"
        description="Open the organized WS2-1 report when you need the full model context in a reviewer-friendly layout."
        icon={<FileText className="h-4 w-4" />}
        open={openSections.report}
        onToggle={() => setOpenSections((current) => ({ ...current, report: !current.report }))}
      >
        <Ws21StructuredReport analysis={analysis} />
      </DetailSection>
    </div>
  )
}
