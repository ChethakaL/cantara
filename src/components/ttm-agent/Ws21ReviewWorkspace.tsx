'use client'

import { useState } from 'react'
import { AdminReviewDashboard } from '@/components/ttm-agent/AdminReviewDashboard'
import { Ws21NormSchedule, type LlmExtraction, type NormOverrides } from '@/components/ttm-agent/Ws21NormSchedule'
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
  const [overrides, setOverrides] = useState<NormOverrides>({})

  const unresolvedCount = analysis.flags.filter((f) => f.resolutionStatus !== 'ACTIONED').length
  const isApproved = analysis.status === 'APPROVED'
  const isFailed = analysis.status === 'FAILED'

  const statusColor = isApproved ? 'green' : isFailed ? 'red' : 'gold'
  const statusLabel = isApproved ? 'Approved' : isFailed ? 'Failed' : analysis.status === 'HITL_PENDING' ? 'Review Required' : analysis.status

  // Extract the LLM extraction data from normalizedData
  const llmExtraction = (analysis.normalizedData as Record<string, unknown> | null)?.llmExtraction as LlmExtraction | undefined

  // Wrap onUpdated to persist overrides into normalizedData when approval happens
  const handleUpdated = (updated: TtmAnalysisView) => {
    // If the analysis just got approved and we have overrides, save them
    if (updated.status === 'APPROVED' && Object.keys(overrides).length > 0) {
      // Persist overrides to normalizedData.userOverrides via the API
      void saveOverrides(updated.id, overrides)
    }
    onUpdated(updated)
  }

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
        onUpdated={handleUpdated}
        normOverrides={overrides}
      />

      {/* Normalization Schedule — shown after flags, before approval */}
      {llmExtraction && !isApproved && (
        <Ws21NormSchedule
          extraction={llmExtraction}
          overrides={overrides}
          onOverridesChange={setOverrides}
        />
      )}
    </div>
  )
}

/** Fire-and-forget PATCH to persist user overrides after approval */
async function saveOverrides(analysisId: string, overrides: NormOverrides) {
  try {
    await fetch('/api/ttm-agent/hitl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'save-overrides',
        analysisId,
        userOverrides: overrides,
      }),
    })
  } catch {
    // Best-effort — overrides are also available in local state
    console.error('[Ws21ReviewWorkspace] Failed to persist normalization overrides')
  }
}
