'use client'

import { useState, useMemo } from 'react'
import { Calculator, DollarSign, Percent, Download, RotateCcw } from 'lucide-react'
import { Card, Button, Input, cn } from '@/components/ui'

interface NetProceedsState {
  enterpriseValuation: string
  cash: string
  debt: string
  actualWorkingCapital: string
  targetWorkingCapital: string
  legalFees: string
  advisoryFee: string
  accounting: string
  managementBonuses: string
  insurancePremium: string
  otherFees: string
  rolloverPercent: string
}

const DEFAULT_STATE: NetProceedsState = {
  enterpriseValuation: '',
  cash: '',
  debt: '',
  actualWorkingCapital: '',
  targetWorkingCapital: '',
  legalFees: '',
  advisoryFee: '',
  accounting: '',
  managementBonuses: '',
  insurancePremium: '',
  otherFees: '',
  rolloverPercent: '',
}

function parseNum(value: string): number {
  const cleaned = value.replace(/[,$\s]/g, '')
  const num = Number(cleaned)
  return isNaN(num) ? 0 : num
}

function formatUSD(value: number): string {
  const neg = value < 0
  const abs = Math.abs(value)
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(abs)
  return neg ? `(${formatted})` : formatted
}

function ResultRow({
  label,
  value,
  source,
  bold,
  highlight,
  negative,
}: {
  label: string
  value: number
  source?: string
  bold?: boolean
  highlight?: boolean
  negative?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between py-3 px-4',
        highlight ? 'bg-amber-50 rounded-xl border border-amber-200' : 'border-b border-slate-50',
        bold && 'font-semibold'
      )}
    >
      <div className="flex-1">
        <p className={cn('text-sm', bold ? 'text-slate-900' : 'text-slate-700')}>{label}</p>
        {source && <p className="text-[10px] text-slate-400 mt-0.5">{source}</p>}
      </div>
      <p
        className={cn(
          'text-sm font-mono tabular-nums',
          highlight ? 'text-amber-700 text-base font-bold' : negative || value < 0 ? 'text-rose-600' : 'text-slate-800'
        )}
      >
        {formatUSD(value)}
      </p>
    </div>
  )
}

interface Props {
  clientId: string
  clientName: string
}

export default function NetProceedsCalculator({ clientId, clientName }: Props) {
  const [form, setForm] = useState<NetProceedsState>(DEFAULT_STATE)

  function set(key: keyof NetProceedsState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const calc = useMemo(() => {
    const ev = parseNum(form.enterpriseValuation)
    const cash = parseNum(form.cash)
    const debt = parseNum(form.debt)
    const netDebt = cash - debt

    const actualWC = parseNum(form.actualWorkingCapital)
    const targetWC = parseNum(form.targetWorkingCapital)
    const wcAdjustment = actualWC - targetWC

    const legal = parseNum(form.legalFees)
    const advisory = parseNum(form.advisoryFee)
    const acct = parseNum(form.accounting)
    const bonuses = parseNum(form.managementBonuses)
    const insurance = parseNum(form.insurancePremium)
    const other = parseNum(form.otherFees)
    const totalTransactionCosts = legal + advisory + acct + bonuses + insurance + other

    const netProceeds = ev + netDebt + wcAdjustment - totalTransactionCosts

    const rolloverPct = parseNum(form.rolloverPercent) / 100
    const rolloverAmount = ev * rolloverPct
    const netProceedsAfterRollover = netProceeds - rolloverAmount

    return {
      ev,
      cash,
      debt,
      netDebt,
      actualWC,
      targetWC,
      wcAdjustment,
      legal,
      advisory,
      acct,
      bonuses,
      insurance,
      other,
      totalTransactionCosts,
      netProceeds,
      rolloverPct,
      rolloverAmount,
      netProceedsAfterRollover,
    }
  }, [form])

  function handleReset() {
    setForm(DEFAULT_STATE)
  }

  function handleExport() {
    const lines = [
      `Net Proceeds Calculator — ${clientName}`,
      `Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      '',
      `Enterprise Valuation,USD,Model,${formatUSD(calc.ev)}`,
      '',
      `Cash,USD,Uploaded Historicals,${formatUSD(calc.cash)}`,
      `Debt,USD,Uploaded Historicals,${formatUSD(calc.debt)}`,
      `Net Debt,USD,,${formatUSD(calc.netDebt)}`,
      '',
      `Actual Working Capital,USD,Uploaded Historicals,${formatUSD(calc.actualWC)}`,
      `Target Working Capital,USD,PE Firm Requirement,${formatUSD(calc.targetWC)}`,
      `Net Adjustment,USD,,${formatUSD(calc.wcAdjustment)}`,
      '',
      'Transaction Costs,,,',
      `Legal fees,USD,PE Firm,${formatUSD(calc.legal)}`,
      `Advisory fee,USD,PE Firm,${formatUSD(calc.advisory)}`,
      `Accounting,USD,PE Firm,${formatUSD(calc.acct)}`,
      `Management bonuses,USD,PE Firm,${formatUSD(calc.bonuses)}`,
      `Insurance Premium,USD,PE Firm,${formatUSD(calc.insurance)}`,
      `Other fees,USD,PE Firm,${formatUSD(calc.other)}`,
      `Total,USD,,${formatUSD(calc.totalTransactionCosts)}`,
      '',
      `Net Proceeds,USD,,${formatUSD(calc.netProceeds)}`,
      '',
      `Rollover Equity,%,${(calc.rolloverPct * 100).toFixed(0)}%,${formatUSD(calc.rolloverAmount)}`,
      '',
      `Net Proceeds After Rollover Equity,USD,Result,${formatUSD(calc.netProceedsAfterRollover)}`,
    ]

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `net-proceeds-${clientName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasInput = calc.ev > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
              <Calculator className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Net Proceeds Calculator</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Estimate seller net proceeds from an enterprise valuation after adjustments, transaction costs, and rollover equity.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </Button>
            {hasInput && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="space-y-5">
          {/* Enterprise Valuation */}
          <Card className="p-4 space-y-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" />
              Enterprise Valuation
            </p>
            <Input
              label="Enterprise Valuation (USD)"
              placeholder="10,000,000"
              value={form.enterpriseValuation}
              onChange={(e) => set('enterpriseValuation', e.target.value)}
            />
            <p className="text-[10px] text-slate-400">Source: Model / Valuation Agent output</p>
          </Card>

          {/* Net Debt */}
          <Card className="p-4 space-y-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Net Debt</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Cash" placeholder="500,000" value={form.cash} onChange={(e) => set('cash', e.target.value)} />
              <Input label="Debt" placeholder="3,000,000" value={form.debt} onChange={(e) => set('debt', e.target.value)} />
            </div>
            <p className="text-[10px] text-slate-400">Source: Uploaded Historicals</p>
          </Card>

          {/* Working Capital */}
          <Card className="p-4 space-y-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Working Capital Adjustment</p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Actual Working Capital"
                placeholder="500,000"
                value={form.actualWorkingCapital}
                onChange={(e) => set('actualWorkingCapital', e.target.value)}
              />
              <Input
                label="Target Working Capital"
                placeholder="700,000"
                value={form.targetWorkingCapital}
                onChange={(e) => set('targetWorkingCapital', e.target.value)}
              />
            </div>
            <p className="text-[10px] text-slate-400">Target source: PE Firm Requirement</p>
          </Card>

          {/* Transaction Costs */}
          <Card className="p-4 space-y-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Transaction Costs</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Legal fees" placeholder="60,000" value={form.legalFees} onChange={(e) => set('legalFees', e.target.value)} />
              <Input label="Advisory fee" placeholder="100,000" value={form.advisoryFee} onChange={(e) => set('advisoryFee', e.target.value)} />
              <Input label="Accounting" placeholder="40,000" value={form.accounting} onChange={(e) => set('accounting', e.target.value)} />
              <Input label="Management bonuses" placeholder="80,000" value={form.managementBonuses} onChange={(e) => set('managementBonuses', e.target.value)} />
              <Input label="Insurance Premium" placeholder="10,000" value={form.insurancePremium} onChange={(e) => set('insurancePremium', e.target.value)} />
              <Input label="Other fees" placeholder="10,000" value={form.otherFees} onChange={(e) => set('otherFees', e.target.value)} />
            </div>
            <p className="text-[10px] text-slate-400">Source: PE Firm estimates</p>
          </Card>

          {/* Rollover Equity */}
          <Card className="p-4 space-y-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5" />
              Rollover Equity
            </p>
            <Input
              label="Rollover Equity (%)"
              placeholder="20"
              value={form.rolloverPercent}
              onChange={(e) => set('rolloverPercent', e.target.value)}
            />
            <p className="text-[10px] text-slate-400">Founder decision — percentage of enterprise value retained as equity in the acquiring entity.</p>
          </Card>
        </div>

        {/* Results Panel */}
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Net Proceeds Summary</p>
            </div>
            <div>
              <ResultRow label="Enterprise Valuation" value={calc.ev} source="Model" bold />

              <div className="px-4 pt-3 pb-1">
                <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Net Debt</p>
              </div>
              <ResultRow label="Cash" value={calc.cash} source="Uploaded Historicals" />
              <ResultRow label="Debt" value={calc.debt} source="Uploaded Historicals" />
              <ResultRow label="Net Debt" value={calc.netDebt} bold negative={calc.netDebt < 0} />

              <div className="px-4 pt-3 pb-1">
                <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Working Capital</p>
              </div>
              <ResultRow label="Actual Working Capital" value={calc.actualWC} source="Uploaded Historicals" />
              <ResultRow label="Target Working Capital" value={calc.targetWC} source="PE Firm Requirement" />
              <ResultRow label="Net Adjustment" value={calc.wcAdjustment} bold negative={calc.wcAdjustment < 0} />

              <div className="px-4 pt-3 pb-1">
                <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Transaction Costs</p>
              </div>
              <ResultRow label="Legal fees" value={calc.legal} source="PE Firm" />
              <ResultRow label="Advisory fee" value={calc.advisory} source="PE Firm" />
              <ResultRow label="Accounting" value={calc.acct} source="PE Firm" />
              <ResultRow label="Management bonuses" value={calc.bonuses} source="PE Firm" />
              <ResultRow label="Insurance Premium" value={calc.insurance} source="PE Firm" />
              <ResultRow label="Other fees" value={calc.other} source="PE Firm" />
              <ResultRow label="Total Transaction Costs" value={-calc.totalTransactionCosts} bold negative />

              <div className="my-2" />
              <ResultRow label="Net Proceeds" value={calc.netProceeds} bold highlight />

              {calc.rolloverPct > 0 && (
                <>
                  <div className="my-3" />
                  <div className="px-4 pt-2 pb-1">
                    <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Rollover Equity</p>
                  </div>
                  <ResultRow
                    label={`Rollover (${(calc.rolloverPct * 100).toFixed(0)}% of EV)`}
                    value={-calc.rolloverAmount}
                    source="Founder Decision"
                    negative
                  />
                  <div className="my-2" />
                  <ResultRow label="Net Proceeds After Rollover" value={calc.netProceedsAfterRollover} bold highlight />
                </>
              )}
            </div>
          </Card>

          {!hasInput && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <Calculator className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-400">Enter an enterprise valuation to see the net proceeds calculation.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
