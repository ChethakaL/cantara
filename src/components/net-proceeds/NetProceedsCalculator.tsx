'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { Calculator, DollarSign, Percent, Download, RotateCcw, Plus, Trash2, Save } from 'lucide-react'
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
  sellerObligations: OtherCostItem[]
  monthsToClose: string
  debtInstruments: DebtInstrument[]
  actualWorkingCapital: string
  targetWorkingCapital: string
  deferredRevenue: string
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
  otherCosts: OtherCostItem[]
  // Tax
  federalTaxRate: string
  stateTaxRate: string
  federalTaxMode: 'percent' | 'dollar'
  stateTaxMode: 'percent' | 'dollar'
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
  sellerObligations: [],
  monthsToClose: '',
  debtInstruments: [makeDebtInstrument()],
  actualWorkingCapital: '',
  targetWorkingCapital: '',
  deferredRevenue: '',
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
  otherCosts: [],
  federalTaxRate: '',
  stateTaxRate: '',
  federalTaxMode: 'percent',
  stateTaxMode: 'percent',
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

// Ensure arrays loaded from the API have valid `id` fields
function ensureIds<T extends { id?: string }>(items: T[] | undefined, fallback: () => T): T[] {
  if (!items || !Array.isArray(items)) return []
  return items.map((item) => ({
    ...item,
    id: item.id || crypto.randomUUID(),
  }))
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
  highlightYellow,
  negative,
  indent,
}: {
  label: string
  value: number
  source?: string
  bold?: boolean
  highlight?: boolean
  highlightYellow?: boolean
  negative?: boolean
  indent?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between py-2.5 px-4',
        highlightYellow
          ? 'bg-yellow-100 rounded-xl border border-yellow-300 my-1 mx-2'
          : highlight
            ? 'bg-amber-50 rounded-xl border border-amber-200 my-1 mx-2'
            : 'border-b border-slate-50',
        bold && 'font-semibold',
        indent && 'pl-8'
      )}
    >
      <div className="flex-1">
        <p
          className={cn(
            'text-sm',
            highlightYellow
              ? 'text-yellow-800 text-base font-bold'
              : bold
                ? 'text-slate-900'
                : 'text-slate-700',
            indent && 'text-xs'
          )}
        >
          {label}
        </p>
        {source && <p className="text-[10px] text-slate-400 mt-0.5">{source}</p>}
      </div>
      <p
        className={cn(
          'text-sm font-mono tabular-nums',
          highlightYellow
            ? 'text-yellow-800 text-base font-bold'
            : highlight
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
// Tax Mode Toggle
// ---------------------------------------------------------------------------

function TaxModeToggle({
  mode,
  onChange,
}: {
  mode: 'percent' | 'dollar'
  onChange: (mode: 'percent' | 'dollar') => void
}) {
  return (
    <div className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 text-[10px] font-medium overflow-hidden">
      <button
        type="button"
        onClick={() => onChange('percent')}
        className={cn(
          'px-2 py-1 transition-colors',
          mode === 'percent' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:bg-slate-100'
        )}
      >
        %
      </button>
      <button
        type="button"
        onClick={() => onChange('dollar')}
        className={cn(
          'px-2 py-1 transition-colors',
          mode === 'dollar' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:bg-slate-100'
        )}
      >
        $
      </button>
    </div>
  )
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
  const [savedBadge, setSavedBadge] = useState(false)

  // Load saved data on mount
  useEffect(() => {
    async function loadSaved() {
      try {
        const res = await fetch(`/api/client-data/${clientId}?section=netProceeds`)
        if (!res.ok) return
        const json = await res.json()
        const loaded = (json?.data ?? json) as Partial<NetProceedsState> | null
        if (loaded) {
          setForm({
            ...DEFAULT_STATE,
            ...loaded,
            debtInstruments: ensureIds(loaded.debtInstruments, makeDebtInstrument).length > 0
              ? ensureIds(loaded.debtInstruments, makeDebtInstrument)
              : [makeDebtInstrument()],
            sellerObligations: ensureIds(loaded.sellerObligations, makeOtherCost),
            otherCosts: ensureIds(loaded.otherCosts, makeOtherCost),
          })
        }
      } catch {
        // silently ignore load errors
      }
    }
    loadSaved()
  }, [clientId])

  // Save draft handler
  const handleSaveDraft = useCallback(async () => {
    try {
      await fetch(`/api/client-data/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'netProceeds', data: form }),
      })
      setSavedBadge(true)
      setTimeout(() => setSavedBadge(false), 2000)
    } catch {
      // silently ignore save errors
    }
  }, [clientId, form])

  // Simple field setter
  function set(key: keyof Omit<NetProceedsState, 'debtInstruments' | 'otherCosts' | 'sellerObligations'>, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function setTaxMode(key: 'federalTaxMode' | 'stateTaxMode', value: 'percent' | 'dollar') {
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

  // Seller obligation helpers
  function updateSellerObligation(id: string, field: keyof Omit<OtherCostItem, 'id'>, value: string) {
    setForm((prev) => ({
      ...prev,
      sellerObligations: prev.sellerObligations.map((o) => (o.id === id ? { ...o, [field]: value } : o)),
    }))
  }
  function addSellerObligation() {
    setForm((prev) => ({ ...prev, sellerObligations: [...prev.sellerObligations, makeOtherCost()] }))
  }
  function removeSellerObligation(id: string) {
    setForm((prev) => ({ ...prev, sellerObligations: prev.sellerObligations.filter((o) => o.id !== id) }))
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

    // Seller obligations
    const obligationDetails = form.sellerObligations.map((o) => ({
      ...o,
      parsedAmount: parseNum(o.amount),
    }))
    const totalSellerObligations = obligationDetails.reduce((sum, o) => sum + o.parsedAmount, 0)

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

    // Base purchase price — deferredRevenue is now subtracted
    const basePurchasePrice = ev + cashAtClosing + wcAdjustment - deferredRevenue - totalSellerObligations

    // Deferred / withheld consideration
    const escrow = parseNum(form.escrowHoldback)
    const sellerNote = parseNum(form.sellerNote)
    const earnout = parseNum(form.earnout)
    const rollover = parseNum(form.rolloverEquity)
    const otherDeferred = parseNum(form.otherDeferredConsideration)
    const totalWithheld = escrow + sellerNote + earnout + rollover + otherDeferred

    // Cash consideration at close (pre-tax) — kept for internal use but removed from waterfall
    const cashConsiderationPreTax = basePurchasePrice - totalWithheld

    // Transaction costs (no R&W Insurance)
    const legal = parseNum(form.legalFees)
    const advisory = parseNum(form.advisoryFee)
    const acct = parseNum(form.accounting)
    const bonuses = parseNum(form.managementBonuses)
    const payrollTax = parseNum(form.payrollTaxOnBonuses)
    const otherCostsTotal = form.otherCosts.reduce((sum, c) => sum + parseNum(c.amount), 0)
    const totalTransactionCosts = legal + advisory + acct + bonuses + payrollTax + otherCostsTotal

    // Net cash to seller at closing (pre-tax)
    const netCashAtClosingPreTax = cashConsiderationPreTax - totalDebt - totalTransactionCosts

    // Taxes: support % or $ mode
    const fedRateInput = parseNum(form.federalTaxRate)
    const stateRateInput = parseNum(form.stateTaxRate)

    const fedTaxAmount = form.federalTaxMode === 'dollar'
      ? fedRateInput
      : netCashAtClosingPreTax * (fedRateInput / 100)
    const stateTaxAmount = form.stateTaxMode === 'dollar'
      ? stateRateInput
      : netCashAtClosingPreTax * (stateRateInput / 100)
    const estimatedTaxesAtClose = fedTaxAmount + stateTaxAmount

    // Combined rate for deferred tax calc (only meaningful in percent mode)
    const fedRatePercent = form.federalTaxMode === 'percent' ? fedRateInput / 100 : 0
    const stateRatePercent = form.stateTaxMode === 'percent' ? stateRateInput / 100 : 0
    const combinedRate = fedRatePercent + stateRatePercent

    // Post-tax cash at closing
    const netCashPostTax = netCashAtClosingPreTax - estimatedTaxesAtClose

    // Taxes on deferred/withheld
    // If fixed dollar, don't double-count
    const deferredTaxAmount = (form.federalTaxMode === 'dollar' && form.stateTaxMode === 'dollar')
      ? 0
      : totalWithheld * combinedRate
    const netDeferredPostTax = totalWithheld - deferredTaxAmount

    // Memo totals
    const totalNetProceedsPreTax = netCashAtClosingPreTax + totalWithheld
    const totalEstimatedTaxes = estimatedTaxesAtClose + deferredTaxAmount
    const estimatedTotalProceedsPostTax = totalNetProceedsPreTax - totalEstimatedTaxes

    // Tax label helpers
    const fedTaxLabel = form.federalTaxMode === 'dollar'
      ? formatUSD(fedRateInput)
      : `${fedRateInput}%`
    const stateTaxLabel = form.stateTaxMode === 'dollar'
      ? formatUSD(stateRateInput)
      : `${stateRateInput}%`

    return {
      ev,
      cashAtClosing,
      obligationDetails,
      totalSellerObligations,
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
      otherCostsTotal,
      totalTransactionCosts,
      netCashAtClosingPreTax,
      fedRateInput,
      stateRateInput,
      fedTaxAmount,
      stateTaxAmount,
      estimatedTaxesAtClose,
      combinedRate,
      netCashPostTax,
      deferredTaxAmount,
      netDeferredPostTax,
      totalNetProceedsPreTax,
      totalEstimatedTaxes,
      estimatedTotalProceedsPostTax,
      fedTaxLabel,
      stateTaxLabel,
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
      '--- Estimated Cash at Closing ---',
      `Estimated Cash at Closing,${formatUSD(calc.cashAtClosing)}`,
      '',
      '--- Other Seller Cash Obligations ---',
    ]
    for (const o of calc.obligationDetails) {
      lines.push(`${o.description || 'Unnamed'},${formatUSD(o.parsedAmount)}`)
    }
    lines.push(`Total Seller Obligations,${formatUSD(calc.totalSellerObligations)}`)
    lines.push('')
    lines.push('--- Tax Inputs ---')
    lines.push(`Federal Tax (${form.federalTaxMode === 'percent' ? 'Rate' : 'Amount'}),${calc.fedTaxLabel}`)
    lines.push(`State Tax (${form.stateTaxMode === 'percent' ? 'Rate' : 'Amount'}),${calc.stateTaxLabel}`)
    lines.push('')
    lines.push('--- Debt Schedule ---')
    lines.push(`Estimated Months to Close,${calc.monthsToClose}`)
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
    lines.push(`Payroll Taxes on Management Bonuses,${formatUSD(calc.payrollTax)}`)
    for (const c of form.otherCosts) {
      lines.push(`${c.description || 'Other'},${formatUSD(parseNum(c.amount))}`)
    }
    lines.push(`Total Transaction Costs,${formatUSD(calc.totalTransactionCosts)}`)
    lines.push('')
    lines.push('--- Net Proceeds Summary ---')
    lines.push(`1. Enterprise Value (EV),${formatUSD(calc.ev)}`)
    lines.push(`2. + Estimated Cash at Closing,${formatUSD(calc.cashAtClosing)}`)
    lines.push(`3. + Working Capital Adjustment,${formatUSD(calc.wcAdjustment)}`)
    lines.push(`4. - Deferred Revenue / Prepaid Adj,${formatUSD(-calc.deferredRevenue)}`)
    lines.push(`5. - Other Seller Cash Obligations,${formatUSD(-calc.totalSellerObligations)}`)
    lines.push(`6. = Base Purchase Price,${formatUSD(calc.basePurchasePrice)}`)
    lines.push(`7. - Total Withheld/Deferred,${formatUSD(-calc.totalWithheld)}`)
    lines.push(`8. - Total Debt Payoffs,${formatUSD(-calc.totalDebt)}`)
    lines.push(`9. - Total Transaction Costs,${formatUSD(-calc.totalTransactionCosts)}`)
    lines.push(`10. = Net Cash to Seller at Closing (Pre-Tax),${formatUSD(calc.netCashAtClosingPreTax)}`)
    lines.push(`11. - Estimated Taxes on Cash at Closing (Fed ${calc.fedTaxLabel} + State ${calc.stateTaxLabel}),${formatUSD(-calc.estimatedTaxesAtClose)}`)
    lines.push(`12. = Estimated Cash to Seller at Closing (Post-Tax),${formatUSD(calc.netCashPostTax)}`)
    lines.push('')
    lines.push('--- Memo ---')
    lines.push(`Total Withheld/Deferred (recap),${formatUSD(calc.totalWithheld)}`)
    lines.push(`- Estimated Taxes on Withheld/Deferred,${formatUSD(-calc.deferredTaxAmount)}`)
    lines.push(`= Estimated Cash to Seller on Withheld/Deferred (Post-Tax),${formatUSD(calc.netDeferredPostTax)}`)
    lines.push(`13. Total Net Proceeds Pre-Tax (incl. Deferred),${formatUSD(calc.totalNetProceedsPreTax)}`)
    lines.push(`14. = Estimated Total Proceeds on Sale (Post-Tax),${formatUSD(calc.estimatedTotalProceedsPostTax)}`)

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
                Cantara Seller Net Proceeds Template v9 — detailed waterfall from enterprise value to estimated after-tax proceeds.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </Button>
            <Button variant="outline" size="sm" onClick={handleSaveDraft} className="relative">
              <Save className="w-3.5 h-3.5" />
              Save Draft
              {savedBadge && (
                <span className="absolute -top-2 -right-2 text-[9px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-medium animate-pulse">
                  Draft saved
                </span>
              )}
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
          {/* 1. Enterprise Valuation */}
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

          {/* 2. Estimated Cash at Closing */}
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

          {/* 3. Working Capital */}
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

          {/* 4. Other Seller Cash Obligations — dynamic list */}
          <Card className="p-4 space-y-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Other Seller Cash Obligations</p>
            {form.sellerObligations.map((item, idx) => (
              <div key={item.id} className="flex items-end gap-2">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <Input
                    label={idx === 0 ? 'Description' : undefined}
                    placeholder="e.g. Tenant improvements"
                    value={item.description}
                    onChange={(e) => updateSellerObligation(item.id, 'description', e.target.value)}
                  />
                  <Input
                    label={idx === 0 ? 'Amount ($)' : undefined}
                    placeholder="50,000"
                    value={item.amount}
                    onChange={(e) => updateSellerObligation(item.id, 'amount', e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeSellerObligation(item.id)}
                  className="p-2 mb-0.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addSellerObligation} className="w-full">
              <Plus className="w-3.5 h-3.5" />
              Add obligation
            </Button>
            <p className="text-[10px] text-slate-400">Items like tenant improvements that the seller must pay</p>
          </Card>

          {/* 5. Tax Inputs */}
          <Card className="p-4 space-y-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5" />
              Tax Inputs
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-600">
                    Federal Tax {form.federalTaxMode === 'percent' ? 'Rate (%)' : 'Amount ($)'}
                  </label>
                  <TaxModeToggle
                    mode={form.federalTaxMode}
                    onChange={(m) => setTaxMode('federalTaxMode', m)}
                  />
                </div>
                <Input
                  placeholder={form.federalTaxMode === 'percent' ? '20' : '500,000'}
                  value={form.federalTaxRate}
                  onChange={(e) => set('federalTaxRate', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-600">
                    State Tax {form.stateTaxMode === 'percent' ? 'Rate (%)' : 'Amount ($)'}
                  </label>
                  <TaxModeToggle
                    mode={form.stateTaxMode}
                    onChange={(m) => setTaxMode('stateTaxMode', m)}
                  />
                </div>
                <Input
                  placeholder={form.stateTaxMode === 'percent' ? '5' : '100,000'}
                  value={form.stateTaxRate}
                  onChange={(e) => set('stateTaxRate', e.target.value)}
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-400">Manual input by seller&apos;s accountant. Toggle between % rate or $ fixed amount.</p>
          </Card>

          {/* 6. Debt Schedule */}
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

          {/* 7. Consideration Withheld / Deferred */}
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

          {/* 8. Transaction Costs (no R&W Insurance) */}
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
                label="Payroll Taxes on Management Bonuses"
                placeholder="10,000"
                value={form.payrollTaxOnBonuses}
                onChange={(e) => set('payrollTaxOnBonuses', e.target.value)}
              />
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

              {/* 2. Estimated Cash at Closing */}
              <ResultRow label="2. + Estimated Cash at Closing" value={calc.cashAtClosing} source="Seller's accountant estimate" />

              {/* 3. Working Capital Adjustment */}
              <ResultRow
                label="3. + Working Capital Adjustment"
                value={calc.wcAdjustment}
                source={`Closing WC ${formatUSD(calc.actualWC)} − Target WC ${formatUSD(calc.targetWC)}`}
              />

              {/* 4. Deferred Revenue / Prepaid Adj — now subtracted */}
              <ResultRow label={`4. \u2212 Deferred Revenue / Prepaid Adjustment`} value={-calc.deferredRevenue} negative />

              {/* 5. Other Seller Cash Obligations — sub-items */}
              <SectionHeader>Other Seller Cash Obligations</SectionHeader>
              {calc.obligationDetails.map((o) =>
                o.parsedAmount > 0 ? (
                  <ResultRow key={o.id} label={o.description || 'Unnamed obligation'} value={o.parsedAmount} indent />
                ) : null
              )}
              <ResultRow label={`5. \u2212 Other Seller Cash Obligations`} value={-calc.totalSellerObligations} bold negative />

              <SectionDivider />

              {/* 6. Base Purchase Price */}
              <ResultRow label="6. = Base Purchase Price" value={calc.basePurchasePrice} bold />

              <SectionDivider />

              {/* Withheld / Deferred */}
              <SectionHeader>Withheld / Deferred Consideration</SectionHeader>
              {calc.escrow > 0 && <ResultRow label="Escrow / Holdback" value={calc.escrow} indent />}
              {calc.sellerNote > 0 && <ResultRow label="Seller Note (Principal)" value={calc.sellerNote} indent />}
              {calc.earnout > 0 && <ResultRow label="Earnout / Contingent Consideration" value={calc.earnout} indent />}
              {calc.rollover > 0 && <ResultRow label="Rollover Equity / Reinvestment" value={calc.rollover} indent />}
              {calc.otherDeferred > 0 && <ResultRow label="Other Deferred Consideration" value={calc.otherDeferred} indent />}
              <ResultRow label={`7. \u2212 Total Withheld/Deferred`} value={-calc.totalWithheld} bold negative />

              <SectionDivider />

              {/* Debt Payoffs */}
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
              <ResultRow label={`8. \u2212 Total Debt Payoffs`} value={-calc.totalDebt} bold negative />

              <SectionDivider />

              {/* Transaction Costs */}
              <SectionHeader>Transaction Costs</SectionHeader>
              {calc.legal > 0 && <ResultRow label="Legal Fees" value={calc.legal} indent />}
              {calc.advisory > 0 && <ResultRow label="Advisory Fee" value={calc.advisory} indent />}
              {calc.acct > 0 && <ResultRow label="Accounting" value={calc.acct} indent />}
              {calc.bonuses > 0 && <ResultRow label="Management Bonuses" value={calc.bonuses} indent />}
              {calc.payrollTax > 0 && <ResultRow label="Payroll Taxes on Management Bonuses" value={calc.payrollTax} indent />}
              {form.otherCosts.map((c) => {
                const amt = parseNum(c.amount)
                return amt > 0 ? <ResultRow key={c.id} label={c.description || 'Other'} value={amt} indent /> : null
              })}
              <ResultRow label={`9. \u2212 Total Transaction Costs`} value={-calc.totalTransactionCosts} bold negative />

              <SectionDivider />

              {/* 10. Net Cash to Seller at Closing (Pre-Tax) */}
              <div className="my-1" />
              <ResultRow label="10. = Net Cash to Seller at Closing (Pre-Tax)" value={calc.netCashAtClosingPreTax} bold highlight />
              <div className="my-1" />

              <SectionDivider />

              {/* 11. Estimated Taxes on Cash at Closing */}
              <ResultRow
                label={`11. \u2212 Estimated Taxes on Cash at Closing (Fed ${calc.fedTaxLabel} + State ${calc.stateTaxLabel})`}
                value={-calc.estimatedTaxesAtClose}
                negative
              />

              <SectionDivider />

              {/* 12. Estimated Cash to Seller at Closing (Post-Tax) */}
              <div className="my-1" />
              <ResultRow label="12. = Estimated Cash to Seller at Closing (Post-Tax)" value={calc.netCashPostTax} bold highlight />
              <div className="my-1" />

              <SectionDivider />

              {/* Memo Lines */}
              <SectionHeader>Memo</SectionHeader>
              <ResultRow label="Total Withheld/Deferred (recap)" value={calc.totalWithheld} indent />
              <ResultRow label={`\u2212 Estimated Taxes on Withheld/Deferred`} value={-calc.deferredTaxAmount} indent negative />
              <ResultRow label="= Estimated Cash to Seller on Withheld/Deferred (Post-Tax)" value={calc.netDeferredPostTax} indent bold />

              <SectionDivider />

              <ResultRow label="13. Total Net Proceeds Pre-Tax (incl. Deferred)" value={calc.totalNetProceedsPreTax} bold highlight />

              <SectionDivider />

              <div className="my-1" />
              <ResultRow label="14. = Estimated Total Proceeds on Sale (Post-Tax)" value={calc.estimatedTotalProceedsPostTax} bold highlight />
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
