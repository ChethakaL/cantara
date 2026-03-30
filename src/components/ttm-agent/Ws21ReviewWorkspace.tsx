'use client'

import { AdminReviewDashboard } from '@/components/ttm-agent/AdminReviewDashboard'
import { Badge } from '@/components/ui'
import type { TtmAnalysisView } from '@/lib/ttm-agent/types'

export function Ws21ReviewWorkspace({
  analysis,
  actorName,
  onUpdated,
}: {
  analysis: TtmAnalysisView
  actorName: string
  onUpdated: (analysis: TtmAnalysisView) => void
}) {
  const unresolvedCount = analysis.flags.filter((f) => f.resolutionStatus !== 'ACTIONED').length
  const isApproved = analysis.status === 'APPROVED'
  const isFailed = analysis.status === 'FAILED'

  const statusColor = isApproved ? 'green' : isFailed ? 'red' : 'gold'
  const statusLabel = isApproved ? 'Approved' : isFailed ? 'Failed' : analysis.status === 'HITL_PENDING' ? 'Review Required' : analysis.status

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-slate-900">WS2-1 Review</h3>
          <Badge color={statusColor}>{statusLabel}</Badge>
          {unresolvedCount > 0 && <Badge color="gold">{unresolvedCount} open</Badge>}
          {unresolvedCount === 0 && !isApproved && <Badge color="green">Ready to approve</Badge>}
        </div>
        <p className="text-xs text-slate-400">{new Date(analysis.createdAt).toLocaleString()}</p>
      </div>

      <AdminReviewDashboard
        analysis={analysis}
        actorName={actorName}
        onUpdated={onUpdated}
      />
    </div>
  )
}
