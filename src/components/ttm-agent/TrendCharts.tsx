'use client'

import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Card, Badge } from '@/components/ui'
import type { AnnualModel } from '@/lib/ttm-agent/types'

function MetricDelta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-slate-400">n/a</span>
  const positive = value >= 0
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${positive ? 'text-emerald-600' : 'text-rose-600'}`}>
      {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}

export function TrendCharts({ annualModel }: { annualModel: AnnualModel | null }) {
  if (!annualModel) return null

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-800">3-Year Annual Model</h4>
            <p className="text-xs text-slate-400 mt-1">FY1 oldest through FY3 most recent</p>
          </div>
          <Badge color="blue">{annualModel.years.length} fiscal years</Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {annualModel.years.map((year) => (
            <div key={year.fiscalYear} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">{year.fiscalYear}</p>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span>Revenue</span>
                  <span className="font-medium">${year.totalRevenue.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Gross Margin</span>
                  <span className="font-medium">{year.grossMarginPct?.toFixed(1) ?? 'n/a'}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>EBITDA (pre-recast)</span>
                  <span className="font-medium">${year.ebitdaPreRecast.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>OpEx</span>
                  <span className="font-medium">${year.totalOpEx.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h4 className="text-sm font-semibold text-slate-800">YoY Trend Indicators</h4>
        <div className="mt-4 space-y-3">
          {annualModel.trends.map((trend) => (
            <div key={`${trend.fromFiscalYear}-${trend.toFiscalYear}`} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm font-medium text-slate-700">
                  {trend.fromFiscalYear} → {trend.toFiscalYear}
                </p>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Revenue</p>
                    <MetricDelta value={trend.revenueYoYPct} />
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">GM Points</p>
                    <MetricDelta value={trend.grossMarginPointChange} />
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">EBITDA</p>
                    <MetricDelta value={trend.ebitdaYoYPct} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {annualModel.anomalies.length > 0 && (
        <Card className="p-5">
          <h4 className="text-sm font-semibold text-slate-800">Trend Anomalies</h4>
          <div className="mt-4 space-y-2">
            {annualModel.anomalies.map((anomaly) => (
              <div key={anomaly} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {anomaly}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
