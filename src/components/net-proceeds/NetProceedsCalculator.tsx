'use client'

import { useState, useMemo } from 'react'
import { Calculator, DollarSign, Percent, Download, RotateCcw, Plus, Trash2 } from 'lucide-react'
import { Card, Button, Input, cn } from '@/components/ui'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DebtInstrument {
  id: string
  description: string
  currentBalance: string
  avgMonthlyPayment: string
}

interface OtherCostItem {
  id: string
  description: string
  amount: string
}

interface NetProceedsState {
  enterpriseValuation: string
  estimatedCashAtClosing: string
  monthsToClose: string
  debtInstruments: DebtInstrument[]
  actualWorkingCapital: string
  targetWorkingCapital: string
  deferredRevenue: string
  precloseDistribution: string
  // Deferred consideration
  escrowHoldback: string
  sellerNote: string
  earnout: string
  rolloverEquity: string
  otherDeferredConsideration: string
  // Transaction costs
  legalFees: string
  advisoryFee: string
  accounting: string
  managementBonuses: string
  payrollTaxOnBonuses: string
  rwInsurancePremium: string
  otherCosts: OtherCostItem[]
  // Tax
  federalTaxRate: string
  stateTaxRate: string
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

function makeDebtInstrument(): DebtInstrument {
  return { id: crypto.randomUUID(), description: '', currentBalance: '', avgMonthlyPayment: '' }
}

function makeOtherCost(): OtherCostItem {
  return { id: crypto.randomUUID(), description: '', amount: '' }
}

const DEFAULT_STATE: NetProceedsState = {
  enterpriseValuation: '',
  estimatedCashAtClosing: '',
  monthsToClose: '',
  debtInstruments: [makeDebtInstrument()],
  actualWorkingCapital: '',
  targetWorkingCapital: '',
  deferredRevenue: '',
  precloseDistribution: '',
  escrowHoldback: '',
  sellerNote: '',
  earnout: '',
  rolloverEquity: '',
  otherDeferredConsideration: '',
  legalFees: '',
  advisoryFee: '',
  accounting: '',
  managementBonuses: '',
  payrollTaxOnBonuses: '',
  rwInsurancePremium: '',
  otherCosts: [],
  federalTaxRate: '',
  stateTaxRate: '',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Result display helpers
// ---------------------------------------------------------------------------

function ResultRow({
  label,
  value,
  source,
  bold,
  highlight,
  negative,
  indent,
}: {
  label: string
  value: number
  source?: string
  bold?: boolean
  highlight?: boolean
  negative?: boolean
  indent?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between py-2.5 px-4',
        highlight ? 'bg-amber-50 rounded-xl border border-amber-200 my-1 mx-2' : 'border-b border-slate-50',
        bold && 'font-semibold',
        indent && 'pl-8'
      )}
    >
      <div className="flex-1">
        <p className={cn('text-sm', bold ? 'text-slate-900' : 'text-slate-700', indent && 'text-xs')}>{label}</p>
        {source && <p className="text-[10px] text-slate-400 mt-0.5">{source}</p>}
      </div>
      <p
        className={cn(
          'text-sm font-mono tabular-nums',
          highlight
            ? 'text-amber-700 text-base font-bold'
            : negative || value < 0
              ? 'text-rose-600'
              : 'text-slate-800'
        )}
      >
        {formatUSD(value)}
      </p>
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pt-3 pb-1">
      <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">{children}</p>
    </div>
  )
}

function SectionDivider() {
  return <div className="border-t border-slate-100 my-1" />
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  clientId: string
  clientName: string
}

export default function NetProceedsCalculator({ clientId, clientName }: Props) {
  const [form, setForm] = useState<NetProceedsState>(DEFAULT_STATE)

  // Simple field setter
  function set(key: keyof Omit<NetProceedsState, 'debtInstruments' | 'otherCosts'>, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // Debt instrument helpers
  function updateDebt(id: string, field: keyof Omit<DebtInstrument, 'id'>, value: string) {
    setForm((prev) => ({
      ...prev,
      debtInstruments: prev.debtInstruments.map((d) => (d.id === id ? { ...d, [field]: value } : d)),
    }))
  }
  function addDebt() {
    setForm((prev) => ({ ...prev, debtInstruments: [...prev.debtInstruments, makeDebtInstrument()] }))
  }
  function removeDebt(id: string) {
    setForm((prev) => ({
      ...prev,
      debtInstruments: prev.debtInstruments.length > 1 ? prev.debtInstruments.filter((d) => d.id !== id) : prev.debtInstruments,
    }))
  }

  // Other cost helpers
  function updateOtherCost(id: string, field: keyof Omit<OtherCostItem, 'id'>, value: string) {
    setForm((prev) => ({
      ...prev,
      otherCosts: prev.otherCosts.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    }))
  }
  function addOtherCost() {
    setForm((prev) => ({ ...prev, otherCosts: [...prev.otherCosts, makeOtherCost()] }))
  }
  function removeOtherCost(id: string) {
    setForm((prev) => ({ ...prev, otherCosts: prev.otherCosts.filter((c) => c.id !== id) }))
  }

  // ---------------------------------------------------------------------------
  // Calculations
  // ---------------------------------------------------------------------------

  const calc = useMemo(() => {
    const ev = parseNum(form.enterpriseValuation)
    const cashAtClosing = parseNum(form.estimatedCashAtClosing)
    const monthsToClose = parseNum(form.monthsToClose)

    // Debt schedule
    const debtDetails = form.debtInstruments.map((d) => {
      const balance = parseNum(d.currentBalance)
      const avgPmt = parseNum(d.avgMonthlyPayment)
      const estimatedPayoff = Math.max(0, balance - avgPmt * monthsToClose)
      return { ...d, balance, avgPmt, estimatedPayoff }
    })
    const totalDebt = debtDetails.reduce((sum, d) => sum + d.estimatedPayoff, 0)

    // Working capital
    const actualWC = parseNum(form.actualWorkingCapital)
    const targetWC = parseNum(form.targetWorkingCapital)
    const wcAdjustment = actualWC - targetWC
    const deferredRevenue = parseNum(form.deferredRevenue)

    // Base purchase price
    const basePurchasePrice = ev + wcAdjustment + deferredRevenue

    // Deferred / withheld consideration
    const escrow = parseNum(form.escrowHoldback)
    const sellerNote = parseNum(form.sellerNote)
    const earnout = parseNum(form.earnout)
    const rollover = parseNum(form.rolloverEquity)
    const otherDeferred = parseNum(form.otherDeferredConsideration)
    const totalWithheld = escrow + sellerNote + earnout + rollover + otherDeferred

    // Cash consideration at close (pre-tax)
    const cashConsiderationPreTax = basePurchasePrice - totalWithheld

    // Transaction costs
    const legal = parseNum(form.legalFees)
    const advisory = parseNum(form.advisoryFee)
    const acct = parseNum(form.accounting)
    const bonuses = parseNum(form.managementBonuses)
    const payrollTax = parseNum(form.payrollTaxOnBonuses)
    const rwInsurance = parseNum(form.rwInsurancePremium)
    const otherCostsTotal = form.otherCosts.reduce((sum, c) => sum + parseNum(c.amount), 0)
    const totalTransactionCosts = legal + advisory + acct + bonuses + payrollTax + rwInsurance + otherCostsTotal

    // Net cash to seller at closing (pre-tax)
    const netCashAtClosingPreTax = cashConsiderationPreTax - totalDebt - totalTransactionCosts

    // Taxes
    const fedRate = parseNum(form.federalTaxRate) / 100
    const stateRate = parseNum(form.stateTaxRate) / 100
    const combinedRate = fedRate + stateRate
    // Gain basis: net cash pre-tax + deferred. Simplified: apply combined rate to total proceeds.
    const totalPreTaxProceeds = netCashAtClosingPreTax + cashAtClosing
    const estimatedTaxes = totalPreTaxProceeds * combinedRate

    // Post-tax cash at closing
    const netCashPostTax = netCashAtClosingPreTax - estimatedTaxes

    // Pre-close distribution
    const precloseDistribution = parseNum(form.precloseDistribution)

    // Memo totals
    const totalNetProceedsPreTax = netCashAtClosingPreTax + totalWithheld + precloseDistribution
    const estimatedAfterTaxProceeds = totalNetProceedsPreTax - estimatedTaxes

    return {
      ev,
      cashAtClosing,
      monthsToClose,
      debtDetails,
      totalDebt,
      actualWC,
      targetWC,
      wcAdjustment,
      deferredRevenue,
      basePurchasePrice,
      escrow,
      sellerNote,
      earnout,
      rollover,
      otherDeferred,
      totalWithheld,
      cashConsiderationPreTax,
      legal,
      advisory,
      acct,
      bonuses,
      payrollTax,
      rwInsurance,
      otherCostsTotal,
      totalTransactionCosts,
      netCashAtClosingPreTax,
      fedRate,
      stateRate,
      combinedRate,
      estimatedTaxes,
      netCashPostTax,
      precloseDistribution,
      totalNetProceedsPreTax,
      estimatedAfterTaxProceeds,
    }
  }, [form])

  function handleReset() {
    setForm(DEFAULT_STATE)
  }

  function handleExport() {
    const lines: string[] = [
      `Net Proceeds Calculator — ${clientName}`,
      `Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      '',
      '--- Enterprise Valuation ---',
      `Enterprise Value (EV),${formatUSD(calc.ev)}`,
      '',
      '--- Tax Inputs ---',
      `Federal Tax Rate,${(calc.fedRate * 100).toFixed(1)}%`,
      `State Tax Rate,${(calc.stateRate * 100).toFixed(1)}%`,
      '',
      '--- Estimated Cash at Closing ---',
      `Estimated Cash at Closing,${formatUSD(calc.cashAtClosing)}`,
      '',
      '--- Debt Schedule ---',
      `Estimated Months to Close,${calc.monthsToClose}`,
    ]
    for (const d of calc.debtDetails) {
      lines.push(`${d.description || 'Unnamed'},Balance: ${formatUSD(d.balance)},Avg Monthly Pmt: ${formatUSD(d.avgPmt)},Est. Payoff: ${formatUSD(d.estimatedPayoff)}`)
    }
    lines.push(`Total Debt Payoffs,${formatUSD(calc.totalDebt)}`)
    lines.push('')
    lines.push('--- Working Capital ---')
    lines.push(`Estimated Closing WC,${formatUSD(calc.actualWC)}`)
    lines.push(`Target WC (Peg),${formatUSD(calc.targetWC)}`)
    lines.push(`WC Adjustment,${formatUSD(calc.wcAdjustment)}`)
    lines.push(`Deferred Revenue / Prepaid Adj,${formatUSD(calc.deferredRevenue)}`)
    lines.push('')
    lines.push('--- Consideration Withheld / Deferred ---')
    lines.push(`Escrow / Holdback,${formatUSD(calc.escrow)}`)
    lines.push(`Seller Note (Principal),${formatUSD(calc.sellerNote)}`)
    lines.push(`Earnout / Contingent Consideration,${formatUSD(calc.earnout)}`)
    lines.push(`Rollover Equity / Reinvestment,${formatUSD(calc.rollover)}`)
    lines.push(`Other Deferred Consideration,${formatUSD(calc.otherDeferred)}`)
    lines.push(`Total Withheld/Deferred,${formatUSD(calc.totalWithheld)}`)
    lines.push('')
    lines.push('--- Transaction Costs ---')
    lines.push(`Legal Fees,${formatUSD(calc.legal)}`)
    lines.push(`Advisory Fee,${formatUSD(calc.advisory)}`)
    lines.push(`Accounting,${formatUSD(calc.acct)}`)
    lines.push(`Management Bonuses,${formatUSD(calc.bonuses)}`)
    lines.push(`Payroll Tax on Bonuses,${formatUSD(calc.payrollTax)}`)
    lines.push(`R&W Insurance Premium,${formatUSD(calc.rwInsurance)}`)
    for (const c of form.otherCosts) {
      lines.push(`${c.description || 'Other'},${formatUSD(parseNum(c.amount))}`)
    }
    lines.push(`Total Transaction Costs,${formatUSD(calc.totalTransactionCosts)}`)
    lines.push('')
    lines.push('--- Pre-close Cash Distribution ---')
    lines.push(`Pre-close Cash Distribution,${formatUSD(calc.precloseDistribution)}`)
    lines.push('')
    lines.push('--- Net Proceeds Summary ---')
    lines.push(`Enterprise Value (EV),${formatUSD(calc.ev)}`)
    lines.push(`+ Working Capital Adjustment,${formatUSD(calc.wcAdjustment)}`)
    lines.push(`+ Deferred Revenue / Prepaid Adj,${formatUSD(calc.deferredRevenue)}`)
    lines.push(`= Base Purchase Price,${formatUSD(calc.basePurchasePrice)}`)
    lines.push(`- Total Withheld/Deferred,${formatUSD(calc.totalWithheld)}`)
    lines.push(`= Cash Consideration at Close (Pre-Tax),${formatUSD(calc.cashConsiderationPreTax)}`)
    lines.push(`- Total Debt Payoffs,${formatUSD(calc.totalDebt)}`)
    lines.push(`- Total Transaction Costs,${formatUSD(calc.totalTransactionCosts)}`)
    lines.push(`= Net Cash to Seller at Closing (Pre-Tax),${formatUSD(calc.netCashAtClosingPreTax)}`)
    lines.push(`- Estimated Taxes (Fed ${(calc.fedRate * 100).toFixed(1)}% + State ${(calc.stateRate * 100).toFixed(1)}%),${formatUSD(calc.estimatedTaxes)}`)
    lines.push(`= Estimated Cash to Seller (Post-Tax),${formatUSD(calc.netCashPostTax)}`)
    lines.push('')
    lines.push('--- Memo ---')
    lines.push(`Total Withheld/Deferred (recap),${formatUSD(calc.totalWithheld)}`)
    lines.push(`Pre-close Cash Distribution,${formatUSD(calc.precloseDistribution)}`)
    lines.push(`Total Net Proceeds Pre-Tax,${formatUSD(calc.totalNetProceedsPreTax)}`)
    lines.push(`Estimated After-Tax Proceeds,${formatUSD(calc.estimatedAfterTaxProceeds)}`)

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
              <h3 className="text-sm font-semibold text-slate-800">Seller Net Proceeds Calculator</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Cantara Seller Net Proceeds Template v8 — detailed waterfall from enterprise value to estimated after-tax proceeds.
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
        {/* ================================================================ */}
        {/* INPUT PANEL                                                      */}
        {/* ================================================================ */}
        <div className="space-y-5">
          {/* Enterprise Valuation */}
          <Card className="p-4 space-y-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" />
              Enterprise Valuation
            </p>
            <Input
              label="Enterprise Value (mid-range, USD)"
              placeholder="10,000,000"
              value={form.enterpriseValuation}
              onChange={(e) => set('enterpriseValuation', e.target.value)}
            />
            <p className="text-[10px] text-slate-400">Default: mid-range of valuation output</p>
          </Card>

          {/* Tax Inputs */}
          <Card className="p-4 space-y-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5" />
              Tax Inputs
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Federal Tax Rate (%)"
                placeholder="20"
                value={form.federalTaxRate}
                onChange={(e) => set('federalTaxRate', e.target.value)}
              />
              <Input
                label="State Tax Rate (%)"
                placeholder="5"
                value={form.stateTaxRate}
                onChange={(e) => set('stateTaxRate', e.target.value)}
              />
            </div>
            <p className="text-[10px] text-slate-400">Manual input by seller&apos;s accountant</p>
          </Card>

          {/* Estimated Cash at Closing */}
          <Card className="p-4 space-y-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Estimated Cash at Closing</p>
            <Input
              label="Estimated Cash at Closing (USD)"
              placeholder="500,000"
              value={form.estimatedCashAtClosing}
              onChange={(e) => set('estimatedCashAtClosing', e.target.value)}
            />
            <p className="text-[10px] text-slate-400">Manual input by seller&apos;s accountant</p>
          </Card>

          {/* Debt Schedule */}
          <Card className="p-4 space-y-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Debt Schedule</p>
            <Input
              label="Estimated Months to Close"
              placeholder="6"
              value={form.monthsToClose}
              onChange={(e) => set('monthsToClose', e.target.value)}
            />
            {form.debtInstruments.map((debt, idx) => (
              <div key={debt.id} className="space-y-2 p-3 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-600">Debt Instrument #{idx + 1}</p>
                  {form.debtInstruments.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDebt(debt.id)}
                      className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <Input
                  label="Description"
                  placeholder="e.g. SBA Loan, Line of Credit"
                  value={debt.description}
                  onChange={(e) => updateDebt(debt.id, 'description', e.target.value)}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Current Balance ($)"
                    placeholder="1,000,000"
                    value={debt.currentBalance}
                    onChange={(e) => updateDebt(debt.id, 'currentBalance', e.target.value)}
                  />
                  <Input
                    label="Avg Monthly Payment ($)"
                    placeholder="15,000"
                    value={debt.avgMonthlyPayment}
                    onChange={(e) => updateDebt(debt.id, 'avgMonthlyPayment', e.target.value)}
                  />
                </div>
                {(parseNum(debt.currentBalance) > 0 || parseNum(debt.avgMonthlyPayment) > 0) && (
                  <p className="text-[10px] text-slate-500">
                    Est. payoff at closing:{' '}
                    <span className="font-mono font-medium text-slate-700">
                      {formatUSD(
                        Math.max(0, parseNum(debt.currentBalance) - parseNum(debt.avgMonthlyPayment) * parseNum(form.monthsToClose))
                      )}
                    </span>
                  </p>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addDebt} className="w-full">
              <Plus className="w-3.5 h-3.5" />
              Add debt instrument
            </Button>
          </Card>

          {/* Working Capital */}
          <Card className="p-4 space-y-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Working Capital</p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Estimated Closing WC"
                placeholder="500,000"
                value={form.actualWorkingCapital}
                onChange={(e) => set('actualWorkingCapital', e.target.value)}
              />
              <Input
                label="Target WC (Peg)"
                placeholder="700,000"
                value={form.targetWorkingCapital}
                onChange={(e) => set('targetWorkingCapital', e.target.value)}
              />
            </div>
            <Input
              label="Deferred Revenue / Prepaid Packages"
              placeholder="50,000"
              value={form.deferredRevenue}
              onChange={(e) => set('deferredRevenue', e.target.value)}
            />
          </Card>

          {/* Consideration Withheld / Deferred */}
          <Card className="p-4 space-y-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Consideration Withheld / Deferred</p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Escrow / Holdback ($)"
                placeholder="500,000"
                value={form.escrowHoldback}
                onChange={(e) => set('escrowHoldback', e.target.value)}
              />
              <Input
                label="Seller Note — Principal ($)"
                placeholder="1,000,000"
                value={form.sellerNote}
                onChange={(e) => set('sellerNote', e.target.value)}
              />
              <Input
                label="Earnout / Contingent (est.) ($)"
                placeholder="500,000"
                value={form.earnout}
                onChange={(e) => set('earnout', e.target.value)}
              />
              <Input
                label="Rollover Equity / Reinvestment ($)"
                placeholder="2,000,000"
                value={form.rolloverEquity}
                onChange={(e) => set('rolloverEquity', e.target.value)}
              />
            </div>
            <Input
              label="Other Deferred Consideration ($)"
              placeholder="0"
              value={form.otherDeferredConsideration}
              onChange={(e) => set('otherDeferredConsideration', e.target.value)}
            />
          </Card>

          {/* Transaction Costs */}
          <Card className="p-4 space-y-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Transaction Costs</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Legal Fees" placeholder="60,000" value={form.legalFees} onChange={(e) => set('legalFees', e.target.value)} />
              <Input label="Advisory Fee" placeholder="100,000" value={form.advisoryFee} onChange={(e) => set('advisoryFee', e.target.value)} />
              <Input label="Accounting" placeholder="40,000" value={form.accounting} onChange={(e) => set('accounting', e.target.value)} />
              <Input
                label="Management Bonuses"
                placeholder="80,000"
                value={form.managementBonuses}
                onChange={(e) => set('managementBonuses', e.target.value)}
              />
              <Input
                label="Payroll Taxes on Bonuses"
                placeholder="10,000"
                value={form.payrollTaxOnBonuses}
                onChange={(e) => set('payrollTaxOnBonuses', e.target.value)}
              />
              <div>
                <Input
                  label="R&W Insurance Premium"
                  placeholder="25,000"
                  value={form.rwInsurancePremium}
                  onChange={(e) => set('rwInsurancePremium', e.target.value)}
                />
                <p className="text-[10px] text-slate-400 mt-1">(if seller-paid)</p>
              </div>
            </div>

            {/* Dynamic other costs */}
            {form.otherCosts.map((cost, idx) => (
              <div key={cost.id} className="flex items-end gap-2">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <Input
                    label={idx === 0 ? 'Other Cost Description' : undefined}
                    placeholder="Description"
                    value={cost.description}
                    onChange={(e) => updateOtherCost(cost.id, 'description', e.target.value)}
                  />
                  <Input
                    label={idx === 0 ? 'Amount ($)' : undefined}
                    placeholder="10,000"
                    value={cost.amount}
                    onChange={(e) => updateOtherCost(cost.id, 'amount', e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeOtherCost(cost.id)}
                  className="p-2 mb-0.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addOtherCost} className="w-full">
              <Plus className="w-3.5 h-3.5" />
              Add cost
            </Button>
          </Card>

          {/* Pre-close Cash Distribution */}
          <Card className="p-4 space-y-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Pre-close Cash Distribution</p>
            <Input
              label="Pre-close Cash Distribution ($)"
              placeholder="100,000"
              value={form.precloseDistribution}
              onChange={(e) => set('precloseDistribution', e.target.value)}
            />
            <p className="text-[10px] text-slate-400">Cash swept / distributed prior to closing</p>
          </Card>
        </div>

        {/* ================================================================ */}
        {/* RESULTS PANEL                                                    */}
        {/* ================================================================ */}
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Net Proceeds Summary — Waterfall</p>
            </div>
            <div>
              {/* 1. Enterprise Value */}
              <ResultRow label="1. Enterprise Value (EV)" value={calc.ev} source="Mid-range valuation" bold />

              {/* 2. Working Capital Adjustment */}
              <ResultRow
                label="2. + Working Capital Adjustment"
                value={calc.wcAdjustment}
                source={`Closing WC ${formatUSD(calc.actualWC)} − Target WC ${formatUSD(calc.targetWC)}`}
              />

              {/* 3. Deferred Revenue / Prepaid Adj */}
              <ResultRow label="3. + Deferred Revenue / Prepaid Adjustment" value={calc.deferredRevenue} />

              <SectionDivider />

              {/* 4. Base Purchase Price */}
              <ResultRow label="4. = Base Purchase Price" value={calc.basePurchasePrice} bold />

              <SectionDivider />

              {/* 5. Total Withheld/Deferred */}
              <SectionHeader>Withheld / Deferred Consideration</SectionHeader>
              {calc.escrow > 0 && <ResultRow label="Escrow / Holdback" value={calc.escrow} indent />}
              {calc.sellerNote > 0 && <ResultRow label="Seller Note (Principal)" value={calc.sellerNote} indent />}
              {calc.earnout > 0 && <ResultRow label="Earnout / Contingent Consideration" value={calc.earnout} indent />}
              {calc.rollover > 0 && <ResultRow label="Rollover Equity / Reinvestment" value={calc.rollover} indent />}
              {calc.otherDeferred > 0 && <ResultRow label="Other Deferred Consideration" value={calc.otherDeferred} indent />}
              <ResultRow label="5. − Total Withheld/Deferred" value={-calc.totalWithheld} bold negative />

              <SectionDivider />

              {/* 6. Cash Consideration at Close (Pre-Tax) */}
              <ResultRow label="6. = Cash Consideration at Close (Pre-Tax)" value={calc.cashConsiderationPreTax} bold />

              <SectionDivider />

              {/* 7. Total Debt Payoffs */}
              <SectionHeader>Debt Payoffs at Closing</SectionHeader>
              {calc.debtDetails.map(
                (d) =>
                  d.estimatedPayoff > 0 && (
                    <ResultRow
                      key={d.id}
                      label={d.description || 'Unnamed debt'}
                      value={d.estimatedPayoff}
                      source={`Balance ${formatUSD(d.balance)} − ${calc.monthsToClose}mo × ${formatUSD(d.avgPmt)}/mo`}
                      indent
                    />
                  )
              )}
              <ResultRow label="7. − Total Debt Payoffs" value={-calc.totalDebt} bold negative />

              <SectionDivider />

              {/* 8. Total Transaction Costs */}
              <SectionHeader>Transaction Costs</SectionHeader>
              {calc.legal > 0 && <ResultRow label="Legal Fees" value={calc.legal} indent />}
              {calc.advisory > 0 && <ResultRow label="Advisory Fee" value={calc.advisory} indent />}
              {calc.acct > 0 && <ResultRow label="Accounting" value={calc.acct} indent />}
              {calc.bonuses > 0 && <ResultRow label="Management Bonuses" value={calc.bonuses} indent />}
              {calc.payrollTax > 0 && <ResultRow label="Payroll Taxes on Bonuses" value={calc.payrollTax} indent />}
              {calc.rwInsurance > 0 && <ResultRow label="R&W Insurance Premium" value={calc.rwInsurance} indent />}
              {form.otherCosts.map((c) => {
                const amt = parseNum(c.amount)
                return amt > 0 ? <ResultRow key={c.id} label={c.description || 'Other'} value={amt} indent /> : null
              })}
              <ResultRow label="8. − Total Transaction Costs" value={-calc.totalTransactionCosts} bold negative />

              <SectionDivider />

              {/* 9. Net Cash to Seller at Closing (Pre-Tax) */}
              <div className="my-1" />
              <ResultRow label="9. = Net Cash to Seller at Closing (Pre-Tax)" value={calc.netCashAtClosingPreTax} bold highlight />
              <div className="my-1" />

              {calc.cashAtClosing > 0 && (
                <>
                  <SectionDivider />
                  <ResultRow label="+ Estimated Cash at Closing" value={calc.cashAtClosing} source="Seller's accountant estimate" />
                </>
              )}

              <SectionDivider />

              {/* 10. Estimated Taxes */}
              <ResultRow
                label={`10. − Estimated Taxes (Fed ${(calc.fedRate * 100).toFixed(1)}% + State ${(calc.stateRate * 100).toFixed(1)}%)`}
                value={-calc.estimatedTaxes}
                negative
              />

              <SectionDivider />

              {/* 11. Estimated Cash to Seller (Post-Tax) */}
              <div className="my-1" />
              <ResultRow label="11. = Estimated Cash to Seller (Post-Tax)" value={calc.netCashPostTax} bold highlight />
              <div className="my-1" />

              <SectionDivider />

              {/* Memo Lines */}
              <SectionHeader>Memo</SectionHeader>
              <ResultRow label="Total Withheld/Deferred (recap)" value={calc.totalWithheld} indent />
              <ResultRow label="Pre-close Cash Distribution" value={calc.precloseDistribution} indent />
              <ResultRow label="Total Net Proceeds Pre-Tax" value={calc.totalNetProceedsPreTax} bold />
              <ResultRow label="Estimated After-Tax Proceeds" value={calc.estimatedAfterTaxProceeds} bold />
              <div className="py-2" />
            </div>
          </Card>

          {!hasInput && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <Calculator className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-400">Enter an enterprise valuation to see the net proceeds waterfall.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
