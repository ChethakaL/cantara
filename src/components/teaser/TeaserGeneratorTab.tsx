'use client'

import { useState } from 'react'
import { Bot, Download, Eye, FileText, Loader2, Printer, RotateCcw, Sparkles } from 'lucide-react'
import { Card, Button, Input, Badge, Textarea, cn } from '@/components/ui'
import { TeaserInputData, DEFAULT_TEASER_INPUT } from '@/lib/teaser/types'
import { generateTeaserHtml } from '@/lib/teaser/generate-html'

interface Props {
  clientId: string
  clientName: string
}

export default function TeaserGeneratorTab({ clientId, clientName }: Props) {
  const [status, setStatus] = useState<'idle' | 'auto-filling' | 'editing' | 'preview'>('idle')
  const [data, setData] = useState<TeaserInputData>(DEFAULT_TEASER_INPUT)
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof TeaserInputData>(key: K, value: TeaserInputData[K]) {
    setData(prev => ({ ...prev, [key]: value }))
  }

  function setHighlight(index: number, field: 'title' | 'description', value: string) {
    setData(prev => {
      const updated = [...prev.investmentHighlights]
      updated[index] = { ...updated[index], [field]: value }
      return { ...prev, investmentHighlights: updated }
    })
  }

  const autoFill = async () => {
    setStatus('auto-filling')
    setError(null)
    try {
      const res = await fetch('/api/teaser/auto-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      })
      if (!res.ok) throw new Error(await res.text() || 'Failed to auto-fill')
      const filled = await res.json()
      // The response may have a nested structure with autoFilled key or be flat
      const inputData = filled.autoFilled || filled
      setData(inputData)
      setStatus('editing')
    } catch (err: any) {
      setError(err.message || 'Auto-fill failed')
      setStatus('idle')
    }
  }

  const generate = () => {
    const html = generateTeaserHtml(data)
    setGeneratedHtml(html)
    setStatus('preview')
  }

  const downloadHtml = () => {
    if (!generatedHtml) return
    const blob = new Blob([generatedHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${clientName.replace(/\s+/g, '-').toLowerCase()}-teaser-${new Date().toISOString().slice(0, 10)}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const printTeaser = () => {
    if (!generatedHtml) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(generatedHtml)
    win.document.close()
    setTimeout(() => win.print(), 500)
  }

  // ---------- IDLE STATE ----------
  if (status === 'idle') {
    return (
      <div className="space-y-6">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
              <FileText className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Deal Teaser Generator</h3>
              <p className="text-xs text-slate-400 mt-0.5">Generate a professional investment teaser from client data across all agents.</p>
            </div>
          </div>
        </Card>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/30 p-12 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-amber-600" />
          </div>
          <h4 className="text-lg font-semibold text-slate-800">Auto-Fill from Client Data</h4>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Pull data from the Valuation Agent, Lease Analysis, Competitor Analysis, and other agents to pre-populate the teaser. You can review and edit everything before generating.
          </p>
          <Button size="lg" onClick={autoFill}>
            <Sparkles className="w-4 h-4" />
            Auto-Fill Teaser
          </Button>
        </div>
      </div>
    )
  }

  // ---------- AUTO-FILLING STATE ----------
  if (status === 'auto-filling') {
    return (
      <div className="py-24 flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        <p className="text-sm text-slate-500">Gathering data from all agents...</p>
      </div>
    )
  }

  // ---------- PREVIEW STATE ----------
  if (status === 'preview' && generatedHtml) {
    return (
      <div className="space-y-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                <Eye className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Teaser Preview</h3>
                <p className="text-xs text-slate-400">Review the generated teaser below. Print or download as needed.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setStatus('editing')}>
                <RotateCcw className="w-3.5 h-3.5" />
                Back to Edit
              </Button>
              <Button variant="outline" size="sm" onClick={downloadHtml}>
                <Download className="w-3.5 h-3.5" />
                Download HTML
              </Button>
              <Button size="sm" onClick={printTeaser}>
                <Printer className="w-3.5 h-3.5" />
                Print / Save PDF
              </Button>
            </div>
          </div>
        </Card>

        <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-lg">
          <iframe
            srcDoc={generatedHtml}
            className="w-full border-0"
            style={{ height: '80vh' }}
            title="Deal Teaser Preview"
          />
        </div>
      </div>
    )
  }

  // ---------- EDITING STATE ----------
  const OVERVIEW_FIELDS = [
    { key: 'facilityProfile' as const, label: 'Facility Profile' },
    { key: 'ownershipManagement' as const, label: 'Ownership & Management' },
    { key: 'clientProfile' as const, label: 'Client Profile' },
    { key: 'staffOperations' as const, label: 'Staff & Operations' },
    { key: 'realEstate' as const, label: 'Real Estate' },
    { key: 'permitsZoning' as const, label: 'Permits & Zoning' },
  ]

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-50 border border-amber-200">
              <FileText className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Deal Teaser — Edit & Review</h3>
              <p className="text-xs text-slate-400">Review the auto-filled data below. Edit any fields, then generate the teaser.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={autoFill}>
              <Sparkles className="w-3.5 h-3.5" />
              Re-fill
            </Button>
            <Button size="sm" onClick={generate}>
              <Bot className="w-3.5 h-3.5" />
              Generate Teaser
            </Button>
          </div>
        </div>
      </Card>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {/* Section 1: Branding */}
      <Card className="p-5 space-y-4">
        <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest">Cover & Branding</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input label="Business Display Name" value={data.businessDisplayName} onChange={e => set('businessDisplayName', e.target.value)} />
          <Input label="Subtitle" value={data.teaserSubtitle} onChange={e => set('teaserSubtitle', e.target.value)} />
          <Input label="Region" value={data.regionLabel} onChange={e => set('regionLabel', e.target.value)} />
        </div>
      </Card>

      {/* Section 2: Transaction Snapshot */}
      <Card className="p-5 space-y-4">
        <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest">Transaction Snapshot</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Input label="Deal Type" value={data.dealType} onChange={e => set('dealType', e.target.value)} />
          <Input label="Location" value={data.location} onChange={e => set('location', e.target.value)} />
          <Input label="Revenue Range" value={data.revenueRange} onChange={e => set('revenueRange', e.target.value)} />
          <Input label="Service Model" value={data.serviceModel} onChange={e => set('serviceModel', e.target.value)} />
          <Input label="Facility Capacity" value={data.facilityCapacity} onChange={e => set('facilityCapacity', e.target.value)} />
          <Input label="Process Stage" value={data.processStage} onChange={e => set('processStage', e.target.value)} />
        </div>
      </Card>

      {/* Section 3: Business Overview */}
      <Card className="p-5 space-y-4">
        <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest">Business Overview</p>
        <div className="space-y-3">
          <Textarea label="Business Overview" value={data.businessOverview} onChange={e => set('businessOverview', e.target.value)} rows={3} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {OVERVIEW_FIELDS.map(({ key, label }) => (
              <Textarea key={key} label={label} value={data[key]} onChange={e => set(key, e.target.value)} rows={3} />
            ))}
          </div>
        </div>
      </Card>

      {/* Section 4: Financial Highlights */}
      <Card className="p-5 space-y-4">
        <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest">Financial Highlights</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Input label="Annual Revenue" value={data.annualRevenue} onChange={e => set('annualRevenue', e.target.value)} />
          <Input label="Revenue Growth" value={data.revenueGrowth} onChange={e => set('revenueGrowth', e.target.value)} />
          <Input label="Normalized EBITDA" value={data.normalizedEbitda} onChange={e => set('normalizedEbitda', e.target.value)} />
          <Input label="EBITDA Margin" value={data.ebitdaMargin} onChange={e => set('ebitdaMargin', e.target.value)} />
          <Input label="Revenue Mix" value={data.revenueMix} onChange={e => set('revenueMix', e.target.value)} />
          <Input label="Buyer Capex" value={data.buyerCapex} onChange={e => set('buyerCapex', e.target.value)} />
        </div>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-4">Headline KPIs</p>
        <div className="grid grid-cols-3 gap-3">
          <Input label="TTM Revenue (headline)" value={data.ttmRevenue} onChange={e => set('ttmRevenue', e.target.value)} />
          <Input label="EBITDA Margin (headline)" value={data.normalizedEbitdaMargin} onChange={e => set('normalizedEbitdaMargin', e.target.value)} />
          <Input label="Total Capacity (headline)" value={data.totalCapacity} onChange={e => set('totalCapacity', e.target.value)} />
        </div>
      </Card>

      {/* Section 5: Investment Highlights */}
      <Card className="p-5 space-y-4">
        <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest">Investment Highlights</p>
        <div className="space-y-4">
          {data.investmentHighlights.map((h, i) => (
            <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-slate-800 text-amber-400 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                <Input label="" placeholder="Highlight title" value={h.title} onChange={e => setHighlight(i, 'title', e.target.value)} className="flex-1" />
              </div>
              <Textarea placeholder="Description..." value={h.description} onChange={e => setHighlight(i, 'description', e.target.value)} rows={2} />
            </div>
          ))}
        </div>
      </Card>

      {/* Section 6: Contact */}
      <Card className="p-5 space-y-4">
        <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest">Contact Information</p>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Contact Name" value={data.contactName} onChange={e => set('contactName', e.target.value)} />
          <Input label="Title" value={data.contactTitle} onChange={e => set('contactTitle', e.target.value)} />
          <Input label="Email" value={data.contactEmail} onChange={e => set('contactEmail', e.target.value)} />
        </div>
      </Card>

      {/* Generate Button */}
      <div className="flex justify-end">
        <Button size="lg" onClick={generate}>
          <Bot className="w-4 h-4" />
          Generate Teaser
        </Button>
      </div>
    </div>
  )
}
