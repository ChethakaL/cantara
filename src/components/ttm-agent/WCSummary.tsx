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

      <Card className="p-5">
        <h4 className="text-sm font-semibold text-slate-800">AR Aging</h4>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          {[
            { label: 'Current', value: summary.arAging.current, pct: summary.arAging.pctCurrent },
            { label: '1-30', value: summary.arAging.days1To30, pct: summary.arAging.pct1To30 },
            { label: '31-60', value: summary.arAging.days31To60, pct: summary.arAging.pct31To60 },
            { label: '61-90', value: summary.arAging.days61To90, pct: summary.arAging.pct61To90 },
            { label: '90+', value: summary.arAging.days90Plus, pct: summary.arAging.pct90Plus },
          ].map((bucket) => (
            <div key={bucket.label} className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">{bucket.label}</p>
              <p className="mt-2 text-lg font-semibold text-slate-800">{formatCurrency(bucket.value)}</p>
              <p className="text-xs text-slate-500 mt-1">{formatPct(bucket.pct)} of AR</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Total AR</p>
            <p className="mt-2 text-lg font-semibold text-slate-800">{formatCurrency(summary.arAging.totalAr)}</p>
            <p className="text-xs text-slate-500 mt-1">
              {summary.arAging.reconcilesToBalanceSheet
                ? 'Reconciles to balance sheet AR'
                : `Variance to balance sheet AR: ${formatCurrency(summary.arAging.varianceToBalanceSheetAr)}`}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Top AR Concentrations</p>
            <div className="mt-3 space-y-2">
              {summary.arAging.topCustomers.length === 0 ? (
                <p className="text-sm text-slate-400">No customer-level aging rows detected.</p>
              ) : (
                summary.arAging.topCustomers.map((customer) => (
                  <div key={customer.customerName} className="flex items-center justify-between text-sm text-slate-700">
                    <span>{customer.customerName}</span>
                    <span className="font-medium">
                      {formatCurrency(customer.total)} · {formatPct(customer.pctOfTotal)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
