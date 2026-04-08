'use client'

import { Card, Badge } from '@/components/ui'
import type { WorkingCapitalSummary } from '@/lib/ttm-agent/types'

function formatCurrency(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `$${value.toLocaleString()}` : 'n/a'
}

function formatPct(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)}%` : 'n/a'
}

export function WCSummary({ summary }: { summary: WorkingCapitalSummary | null }) {
  if (!summary) return null

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-800">Working Capital Baseline</h4>
            <p className="text-xs text-slate-400 mt-1">Most recent month-end: {summary.month}</p>
          </div>
          <Badge color="green">NWC {formatCurrency(summary.netWorkingCapital)}</Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-3">Current Assets</p>
            <div className="space-y-2 text-sm text-slate-700">
              {summary.currentAssets.map((item) => (
                <div key={item.code} className="flex items-center justify-between">
                  <span>{item.category}</span>
                  <span className="font-medium">{formatCurrency(item.value)}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between font-semibold">
                <span>Total Current Assets</span>
                <span>{formatCurrency(summary.totalCurrentAssets)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-3">Current Liabilities</p>
            <div className="space-y-2 text-sm text-slate-700">
              {summary.currentLiabilities.map((item) => (
                <div key={item.code} className="flex items-center justify-between">
                  <span>{item.category}</span>
                  <span className="font-medium">{formatCurrency(item.value)}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between font-semibold">
                <span>Total Current Liabilities</span>
                <span>{formatCurrency(summary.totalCurrentLiabilities)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between">
          <span className="text-sm text-slate-600">Trailing 3-month average NWC</span>
          <span className="text-sm font-semibold text-slate-800">{formatCurrency(summary.trailingThreeMonthAverageNwc)}</span>
        </div>
      </Card>

    </div>
  )
}
