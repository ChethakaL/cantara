'use client'

import { Bot, CheckCircle2, Download, Eye, FileText, Loader2, Printer, RotateCcw, Save, Sparkles, Circle, AlertCircle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Card, Button, Input, Badge, Textarea, cn } from '@/components/ui'
import { TeaserInputData, DEFAULT_TEASER_INPUT } from '@/lib/teaser/types'
import { generateTeaserHtml } from '@/lib/teaser/generate-html'
import MondayLinker from '@/components/monday/MondayLinker'

interface Props {
  clientId: string
  clientName: string
}

export default function TeaserGeneratorTab({ clientId, clientName }: Props) {
  const [status, setStatus] = useState<'idle' | 'auto-filling' | 'editing' | 'preview'>('idle')
  const [data, setData] = useState<TeaserInputData>(DEFAULT_TEASER_INPUT)
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [teaserFileUrl, setTeaserFileUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [prereqs, setPrereqs] = useState<Record<string, boolean> | null>(null)

  // ── Load prerequisite agent status ──────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/agent-status?clientId=${clientId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setPrereqs(data) })
      .catch(() => {})
  }, [clientId])

  // ── Load Draft ─────────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadDraft() {
      try {
        const res = await fetch(`/api/teaser/draft?clientId=${clientId}`)
        if (res.ok) {
          const { draft } = await res.json()
          if (draft) {
            const merged = { ...DEFAULT_TEASER_INPUT, ...draft } as TeaserInputData
            if (!Array.isArray(merged.investmentHighlights) || merged.investmentHighlights.length !== 5) {
              merged.investmentHighlights = DEFAULT_TEASER_INPUT.investmentHighlights
            }
            setData(merged)
            setStatus('editing')
          }
        }
      } catch (e) {
        console.error('Failed to load Teaser draft:', e)
      }
    }
    void loadDraft()
  }, [clientId])

  const saveDraft = async () => {
    setSaving(true)
    setSaveSuccess(false)
    try {
      const res = await fetch('/api/teaser/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, data }),
      })
      if (!res.ok) throw new Error('Failed to save draft')
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

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
      const raw = filled.autoFilled || filled
      const inputData = { ...DEFAULT_TEASER_INPUT, ...raw } as TeaserInputData
      if (!Array.isArray(inputData.investmentHighlights) || inputData.investmentHighlights.length !== 5) {
        inputData.investmentHighlights = DEFAULT_TEASER_INPUT.investmentHighlights
      }
      setData(inputData)
      setStatus('editing')
    } catch (err: any) {
      setError(err.message || 'Auto-fill failed')
      setStatus('idle')
    }
  }

  const generate = () => {
    console.log('[Teaser] Generating with data:', data)
    try {
      setError(null)
      const html = generateTeaserHtml(data)
      console.log('[Teaser] HTML generated successfully, length:', html.length)
      setGeneratedHtml(html)
      setStatus('preview')
    } catch (err: any) {
      console.error('[Teaser] Generation error:', err)
      setError(err.message || 'Failed to generate teaser')
    }
  }

  const downloadHtml = () => {
    if (!generatedHtml) return
    const blob = new Blob([generatedHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const safeName = (clientName || 'client').replace(/\s+/g, '-').toLowerCase()
    a.download = `${safeName}-teaser-${new Date().toISOString().slice(0, 10)}.html`
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
  const TEASER_PREREQS = [
    { key: 'ttmAnalysis', label: 'Financial Analysis & Valuation (WS2-1)' },
    { key: 'lease', label: 'Lease Analysis' },
    { key: 'competitor', label: 'Competitor Analysis' },
    { key: 'employeeObligations', label: 'Employee Obligations (WS1-6)' },
    { key: 'digitalPresence', label: 'Digital Presence Report' },
  ]

  if (status === 'idle') {
    const completedCount = prereqs ? TEASER_PREREQS.filter(p => prereqs[p.key]).length : 0
    const allComplete = prereqs ? TEASER_PREREQS.every(p => prereqs[p.key]) : false

    return (
      <div className="space-y-6">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
              <FileText className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Deal Teaser Generator</h3>
              <p className="text-xs text-slate-400 mt-0.5">Generate a professional investment teaser from client data across all agents.</p>
            </div>
          </div>
          <a
            href="/samples/Cantara_Deal_Teaser_v2.docx"
            download="Cantara_Deal_Teaser_v2.docx"
            className="inline-flex items-center gap-2 font-medium transition-all rounded-lg border border-cantara-beige text-slate-700 hover:bg-cantara-beige/50 px-3 py-1.5 text-xs bg-white"
          >
            <Download className="w-3.5 h-3.5" />
            Download sample teaser
          </a>
        </div>
        </Card>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        {/* Prerequisite agent checklist */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">Prerequisite Agents</h4>
            {prereqs && (
              <Badge color={allComplete ? 'green' : completedCount > 0 ? 'gold' : 'red'}>
                {completedCount}/{TEASER_PREREQS.length} complete
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 mb-4">The teaser auto-fill pulls data from these agents. Missing agents will result in empty sections.</p>
          <div className="space-y-2">
            {TEASER_PREREQS.map(p => {
              const done = prereqs?.[p.key] ?? false
              return (
                <div key={p.key} className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm',
                  done ? 'bg-emerald-50 border border-emerald-100 text-emerald-800' : 'bg-slate-50 border border-slate-100 text-slate-500'
                )}>
                  {done ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> : <Circle className="w-4 h-4 text-slate-300 flex-shrink-0" />}
                  {p.label}
                </div>
              )
            })}
          </div>
          {prereqs && !allComplete && (
            <p className="text-xs text-amber-600 mt-3 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              Some agents haven&apos;t been run yet. You can still auto-fill, but some sections may be empty.
            </p>
          )}
        </Card>

        <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/30 p-8 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-amber-600" />
          </div>
          <h4 className="text-lg font-semibold text-slate-800">Auto-Fill from Client Data</h4>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Pull data from completed agents to pre-populate the teaser. You can review and edit everything before generating.
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

        <MondayLinker clientId={clientId} clientName={clientName} reportType="Teaser" fileUrl={teaserFileUrl} html={generatedHtml} />

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
    { key: 'facilityProfile' as const, label: 'Facility Profile (teaser PDF: one bullet per line)' },
    { key: 'ownershipManagement' as const, label: 'Ownership & Management (teaser PDF: one bullet per line)' },
    { key: 'clientProfile' as const, label: 'Client Profile (teaser PDF: one bullet per line)' },
    { key: 'staffOperations' as const, label: 'Staff & Operations (teaser PDF: one bullet per line)' },
    { key: 'realEstate' as const, label: 'Real Estate (teaser PDF: one bullet per line)' },
    { key: 'technology' as const, label: 'Technology (teaser PDF: one bullet per line)' },
    { key: 'permitsZoning' as const, label: 'Permits & Zoning (teaser PDF: one bullet per line)' },
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
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-slate-800">Deal Teaser — Edit & Review</h3>
                <a
                  href="/samples/Cantara_Deal_Teaser_v2.docx"
                  download="Cantara_Deal_Teaser_v2.docx"
                  className="flex items-center gap-1.5 text-[10px] font-medium text-amber-600 hover:text-amber-700 hover:underline"
                >
                  <Download className="w-3 h-3" />
                  Download sample teaser
                </a>
              </div>
              <p className="text-xs text-slate-400">Review the auto-filled data below. Edit any fields, then generate the teaser.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={saveDraft}
              disabled={saving}
              className="text-[10px] h-8"
            >
              {saving ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : saveSuccess ? (
                <CheckCircle2 className="w-3 h-3 text-green-500 mr-1" />
              ) : (
                <Save className="w-3 h-3 mr-1" />
              )}
              {saveSuccess ? 'Saved' : 'Save Draft'}
            </Button>
            <Button variant="outline" size="sm" onClick={autoFill} className="text-[10px] h-8">
              <Sparkles className="w-3.5 h-3.5" />
              Re-fill
            </Button>
            <Button size="sm" onClick={generate} className="text-[10px] h-8">
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
        <Input
          label="Cantara deal reference #"
          value={data.dealReference ?? ''}
          onChange={e => set('dealReference', e.target.value)}
          placeholder="e.g. CD-2026-0142"
        />
        <p className="text-[11px] text-slate-500">When filled in, this reference is printed on the teaser cover (exported PDF).</p>
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

      {/* Section 3: Business narrative (PDF sections 01 & 02) */}
      <Card className="p-5 space-y-4">
        <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest">Section 01 — Transaction snapshot</p>
        <Textarea
          label="Deal at a glance"
          value={data.businessOverview}
          onChange={e => set('businessOverview', e.target.value)}
          rows={3}
        />

        <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest pt-2">Section 02 — Business overview (Deal Teaser PDF only)</p>
        <p className="text-[11px] text-slate-500 -mt-1">
          These fields control <span className="font-medium text-slate-600">02 — Business overview</span> in the <span className="font-medium text-slate-600">Deal Teaser</span> export only. The CIM uses its own template.
        </p>
        <Input
          label='Headline under "Business Overview"'
          value={data.overviewHeadline}
          onChange={e => set('overviewHeadline', e.target.value)}
          placeholder="e.g. A Purpose-Built Premium Pet Resort"
        />
        <Textarea
          label="Summary under headline"
          value={data.section02LeadSummary}
          onChange={e => set('section02LeadSummary', e.target.value)}
          rows={3}
          placeholder="One paragraph as a single line — or several lines; each line becomes its own bullet in the teaser PDF."
        />
        <p className="text-[11px] text-slate-500">
          The labeled boxes below map to the teaser reference layout: each line becomes one bullet in the PDF (Facility Profile, Ownership &amp; Management, etc.).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {OVERVIEW_FIELDS.map(({ key, label }) => (
            <Textarea key={key} label={label} value={data[key]} onChange={e => set(key, e.target.value)} rows={4} />
          ))}
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
      </Card>

      {/* Section 5: Investment Highlights */}
      <Card className="p-5 space-y-4">
        <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest">Investment Highlights</p>

        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pt-2">Business Strengths (1-2)</p>
        <div className="space-y-4">
          {data.investmentHighlights.slice(0, 2).map((h, i) => (
            <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-slate-800 text-amber-400 flex items-center justify-center text-xs font-bold">0{i + 1}</span>
                <Input label="" placeholder="Strength title" value={h.title} onChange={e => setHighlight(i, 'title', e.target.value)} className="flex-1" />
              </div>
              <Textarea placeholder="Description..." value={h.description} onChange={e => setHighlight(i, 'description', e.target.value)} rows={2} />
            </div>
          ))}
        </div>

        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pt-2">Growth Opportunities (3-5)</p>
        <div className="space-y-4">
          {data.investmentHighlights.slice(2).map((h, i) => (
            <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-slate-800 text-amber-400 flex items-center justify-center text-xs font-bold">0{i + 3}</span>
                <Input label="" placeholder="Opportunity title" value={h.title} onChange={e => setHighlight(i + 2, 'title', e.target.value)} className="flex-1" />
              </div>
              <Textarea placeholder="Description..." value={h.description} onChange={e => setHighlight(i + 2, 'description', e.target.value)} rows={2} />
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
