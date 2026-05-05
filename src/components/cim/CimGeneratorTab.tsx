'use client'

import { useState } from 'react'
import { Bot, ChevronDown, ChevronRight, Download, Eye, FileText, Loader2, Plus, Printer, RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import { Card, Button, Input, Badge, Textarea, cn } from '@/components/ui'
import { CimInputData, DEFAULT_CIM_INPUT } from '@/lib/cim/types'
import { generateCimHtml } from '@/lib/cim/generate-html'

interface Props {
  clientId: string
  clientName: string
}

const CIM_PREREQUISITES = [
  { label: 'Financial Analysis & Valuation', tag: 'WS2-1' },
  { label: 'Lease Analysis', tag: '' },
  { label: 'Competitor Analysis', tag: '' },
  { label: 'Employee Obligations Report', tag: 'WS1-6' },
  { label: 'Digital Presence Report', tag: '' },
  { label: 'Org Chart Review', tag: '' },
]

// Collapsible section wrapper
function Section({ title, number, children, defaultOpen = true }: { title: string; number: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-5 text-left hover:bg-slate-50/50 transition-colors"
      >
        <span className="w-6 h-6 rounded-lg bg-slate-800 text-amber-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0">{number}</span>
        <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest flex-1">{title}</p>
        {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">{children}</div>}
    </Card>
  )
}

export default function CimGeneratorTab({ clientId, clientName }: Props) {
  const [status, setStatus] = useState<'idle' | 'auto-filling' | 'editing' | 'preview'>('idle')
  const [data, setData] = useState<CimInputData>(DEFAULT_CIM_INPUT)
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)

  function set<K extends keyof CimInputData>(key: K, value: CimInputData[K]) {
    setData(prev => ({ ...prev, [key]: value }))
  }

  function setThesisBullet(index: number, value: string) {
    setData(prev => {
      const updated = [...prev.investmentThesis]
      updated[index] = value
      return { ...prev, investmentThesis: updated }
    })
  }

  function setArrayItem(key: keyof CimInputData, index: number, value: string) {
    setData(prev => {
      const arr = [...(prev[key] as string[])]
      arr[index] = value
      return { ...prev, [key]: arr }
    })
  }

  function addArrayItem(key: keyof CimInputData) {
    setData(prev => {
      const arr = [...(prev[key] as string[]), '']
      return { ...prev, [key]: arr }
    })
  }

  function removeArrayItem(key: keyof CimInputData, index: number) {
    setData(prev => {
      const arr = [...(prev[key] as string[])]
      arr.splice(index, 1)
      return { ...prev, [key]: arr }
    })
  }

  const autoFill = async () => {
    setStatus('auto-filling')
    setError(null)
    try {
      const res = await fetch('/api/cim/auto-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      })
      if (!res.ok) throw new Error(await res.text() || 'Failed to auto-fill')
      const filled = await res.json()
      const inputData = filled.autoFilled || filled
      setData(inputData)
      setStatus('editing')
    } catch (err: any) {
      setError(err.message || 'Auto-fill failed')
      setStatus('idle')
    }
  }

  const generate = () => {
    try {
      setError(null)
      const html = generateCimHtml(data)
      setGeneratedHtml(html)
      setStatus('preview')
    } catch (err: any) {
      setError(err.message || 'Failed to generate CIM')
    }
  }

  const downloadHtml = () => {
    if (!generatedHtml) return
    const blob = new Blob([generatedHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${clientName.replace(/\s+/g, '-').toLowerCase()}-cim-${new Date().toISOString().slice(0, 10)}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const printCim = () => {
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                <FileText className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">CIM Generator</h3>
                <p className="text-xs text-slate-400 mt-0.5">Generate a Confidential Information Memorandum from client data across all agents.</p>
              </div>
            </div>
            <a
              href="/brand/Cantara_CIM_Reference_Template.pdf"
              download
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              CIM Reference Template
            </a>
          </div>
        </Card>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        {/* Prerequisite Documents */}
        <Card className="p-5 space-y-4">
          <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest">Prerequisite Documents</p>
          <p className="text-xs text-slate-500">The following analyses should be completed before generating the CIM. Auto-fill pulls data from each.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {CIM_PREREQUISITES.map((prereq, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3">
                <span className="w-6 h-6 rounded-lg bg-slate-800 text-amber-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">{prereq.label}</p>
                  {prereq.tag && <p className="text-[10px] text-slate-400">{prereq.tag}</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Acknowledgment */}
        <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50 transition-colors">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={e => setAcknowledged(e.target.checked)}
            className="mt-0.5 accent-amber-500"
          />
          <span className="text-sm text-slate-600">
            I confirm that the prerequisite analyses listed above have been completed (or are intentionally skipped) for this client.
          </span>
        </label>

        <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/30 p-12 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-amber-600" />
          </div>
          <h4 className="text-lg font-semibold text-slate-800">Auto-Fill from Client Data</h4>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Pull data from the Valuation Agent, Lease Analysis, Competitor Analysis, and other agents to pre-populate the CIM. Financial data is mapped directly; narrative sections are AI-generated. You can review and edit everything before generating.
          </p>
          <Button size="lg" onClick={autoFill} disabled={!acknowledged}>
            <Sparkles className="w-4 h-4" />
            Auto-Fill CIM
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
        <p className="text-sm text-slate-500">Gathering data from all agents and generating CIM content...</p>
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
                <h3 className="text-sm font-semibold text-slate-800">CIM Preview</h3>
                <p className="text-xs text-slate-400">Review the generated CIM below. Print or download as needed.</p>
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
              <Button size="sm" onClick={printCim}>
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
            title="CIM Preview"
          />
        </div>
      </div>
    )
  }

  // ---------- EDITING STATE ----------
  return (
    <div className="space-y-6">
      {/* Top bar */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-50 border border-amber-200">
              <FileText className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">CIM — Edit & Review</h3>
              <p className="text-xs text-slate-400">Review the auto-filled data below. Edit any fields, then generate the CIM.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={autoFill}>
              <Sparkles className="w-3.5 h-3.5" />
              Re-fill
            </Button>
            <Button size="sm" onClick={generate}>
              <Bot className="w-3.5 h-3.5" />
              Generate CIM
            </Button>
          </div>
        </div>
      </Card>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {/* 1. Cover & Branding */}
      <Section title="Cover & Branding" number="01">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Business Name" value={data.businessName} onChange={e => set('businessName', e.target.value)} />
          <Input label="Subtitle" value={data.subtitle} onChange={e => set('subtitle', e.target.value)} />
          <Input label="Region" value={data.region} onChange={e => set('region', e.target.value)} />
          <Input label="Service Lines" value={data.serviceLines} onChange={e => set('serviceLines', e.target.value)} />
        </div>
      </Section>

      {/* 2. Executive Summary */}
      <Section title="Executive Summary" number="02">
        <Textarea label="Investment Overview" value={data.investmentOverview} onChange={e => set('investmentOverview', e.target.value)} rows={3} />

        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pt-2">Investment Thesis Bullets</p>
        <div className="space-y-2">
          {data.investmentThesis.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-slate-400 w-4">{i + 1}.</span>
              <Input value={b} onChange={e => setThesisBullet(i, e.target.value)} className="flex-1" />
              <button onClick={() => { const arr = [...data.investmentThesis]; arr.splice(i, 1); set('investmentThesis', arr) }} className="text-slate-300 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => set('investmentThesis', [...data.investmentThesis, ''])}>
            <Plus className="w-3 h-3" /> Add Bullet
          </Button>
        </div>

        <Textarea label="Seller Overview" value={data.sellerOverview} onChange={e => set('sellerOverview', e.target.value)} rows={3} />
        <Textarea label="Transaction Overview" value={data.transactionOverview} onChange={e => set('transactionOverview', e.target.value)} rows={3} />
      </Section>

      {/* 3. Business Overview */}
      <Section title="Business Overview" number="03">
        <Textarea label="Business Description" value={data.businessDescription} onChange={e => set('businessDescription', e.target.value)} rows={3} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Textarea label="Facility Profile" value={data.facilityProfile} onChange={e => set('facilityProfile', e.target.value)} rows={3} />
          <Textarea label="Ownership & Management" value={data.ownershipManagement} onChange={e => set('ownershipManagement', e.target.value)} rows={3} />
          <Textarea label="Client Profile" value={data.clientProfile} onChange={e => set('clientProfile', e.target.value)} rows={3} />
          <Textarea label="Staff & Operations" value={data.staffOperations} onChange={e => set('staffOperations', e.target.value)} rows={3} />
          <Textarea label="Real Estate" value={data.realEstate} onChange={e => set('realEstate', e.target.value)} rows={3} />
          <Textarea label="Technology" value={data.technology} onChange={e => set('technology', e.target.value)} rows={3} />
        </div>
        <Textarea label="Permits & Zoning" value={data.permitsZoning} onChange={e => set('permitsZoning', e.target.value)} rows={2} />
      </Section>

      {/* 4. Financial Performance */}
      <Section title="Financial Performance" number="04" defaultOpen={false}>
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Financial Highlights</p>
        <div className="space-y-2">
          {(data.financialHighlights || []).map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={b} onChange={e => setArrayItem('financialHighlights', i, e.target.value)} className="flex-1" />
              <button onClick={() => removeArrayItem('financialHighlights', i)} className="text-slate-300 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => addArrayItem('financialHighlights')}>
            <Plus className="w-3 h-3" /> Add Highlight
          </Button>
        </div>

        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pt-4">Income Statement</p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-2 text-slate-500 font-medium">Line Item</th>
                <th className="text-left py-2 px-2 text-slate-500 font-medium">FY1</th>
                <th className="text-left py-2 px-2 text-slate-500 font-medium">FY2</th>
                <th className="text-left py-2 px-2 text-slate-500 font-medium">FY3</th>
                <th className="text-left py-2 px-2 text-slate-500 font-medium">TTM</th>
              </tr>
            </thead>
            <tbody>
              {(data.incomeStatement || []).map((row, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-1.5 px-2">
                    <Input value={row.label} onChange={e => {
                      const rows = [...data.incomeStatement]; rows[i] = { ...rows[i], label: e.target.value }; set('incomeStatement', rows)
                    }} className="text-xs" />
                  </td>
                  <td className="py-1.5 px-2">
                    <Input value={row.fy1} onChange={e => {
                      const rows = [...data.incomeStatement]; rows[i] = { ...rows[i], fy1: e.target.value }; set('incomeStatement', rows)
                    }} className="text-xs w-20" />
                  </td>
                  <td className="py-1.5 px-2">
                    <Input value={row.fy2} onChange={e => {
                      const rows = [...data.incomeStatement]; rows[i] = { ...rows[i], fy2: e.target.value }; set('incomeStatement', rows)
                    }} className="text-xs w-20" />
                  </td>
                  <td className="py-1.5 px-2">
                    <Input value={row.fy3} onChange={e => {
                      const rows = [...data.incomeStatement]; rows[i] = { ...rows[i], fy3: e.target.value }; set('incomeStatement', rows)
                    }} className="text-xs w-20" />
                  </td>
                  <td className="py-1.5 px-2">
                    <Input value={row.ttm} onChange={e => {
                      const rows = [...data.incomeStatement]; rows[i] = { ...rows[i], ttm: e.target.value }; set('incomeStatement', rows)
                    }} className="text-xs w-20" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Textarea label="Income Footnote" value={data.incomeFootnote} onChange={e => set('incomeFootnote', e.target.value)} rows={2} />

        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pt-4">Service Line Breakdown</p>
        <div className="space-y-2">
          {(data.serviceLineBreakdown || []).map((sl, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={sl.name} placeholder="Service" onChange={e => {
                const arr = [...data.serviceLineBreakdown]; arr[i] = { ...arr[i], name: e.target.value }; set('serviceLineBreakdown', arr)
              }} className="flex-1" />
              <Input value={sl.ttmRevenue} placeholder="Revenue" onChange={e => {
                const arr = [...data.serviceLineBreakdown]; arr[i] = { ...arr[i], ttmRevenue: e.target.value }; set('serviceLineBreakdown', arr)
              }} className="w-24" />
              <Input value={sl.pctOfTotal} placeholder="%" onChange={e => {
                const arr = [...data.serviceLineBreakdown]; arr[i] = { ...arr[i], pctOfTotal: e.target.value }; set('serviceLineBreakdown', arr)
              }} className="w-20" />
              <button onClick={() => {
                const arr = [...data.serviceLineBreakdown]; arr.splice(i, 1); set('serviceLineBreakdown', arr)
              }} className="text-slate-300 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => set('serviceLineBreakdown', [...data.serviceLineBreakdown, { name: '', ttmRevenue: '', pctOfTotal: '' }])}>
            <Plus className="w-3 h-3" /> Add Service Line
          </Button>
        </div>
      </Section>

      {/* 5. EBITDA Normalization */}
      <Section title="EBITDA Normalization" number="05" defaultOpen={false}>
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Normalization Notes</p>
        <div className="space-y-2">
          {(data.normalizationNotes || []).map((n, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={n} onChange={e => setArrayItem('normalizationNotes', i, e.target.value)} className="flex-1" />
              <button onClick={() => removeArrayItem('normalizationNotes', i)} className="text-slate-300 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => addArrayItem('normalizationNotes')}>
            <Plus className="w-3 h-3" /> Add Note
          </Button>
        </div>

        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pt-4">Normalization Items</p>
        <div className="space-y-2">
          {(data.normalizationItems || []).map((ni, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={ni.item} placeholder="Item" onChange={e => {
                const arr = [...data.normalizationItems]; arr[i] = { ...arr[i], item: e.target.value }; set('normalizationItems', arr)
              }} className="flex-1" />
              <Input value={ni.ttmAmount} placeholder="Amount" onChange={e => {
                const arr = [...data.normalizationItems]; arr[i] = { ...arr[i], ttmAmount: e.target.value }; set('normalizationItems', arr)
              }} className="w-24" />
              <Input value={ni.commentary} placeholder="Commentary" onChange={e => {
                const arr = [...data.normalizationItems]; arr[i] = { ...arr[i], commentary: e.target.value }; set('normalizationItems', arr)
              }} className="flex-1" />
              <button onClick={() => {
                const arr = [...data.normalizationItems]; arr.splice(i, 1); set('normalizationItems', arr)
              }} className="text-slate-300 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => set('normalizationItems', [...data.normalizationItems, { item: '', ttmAmount: '', commentary: '' }])}>
            <Plus className="w-3 h-3" /> Add Item
          </Button>
        </div>
        <Textarea label="Normalization Footnote" value={data.normalizationFootnote} onChange={e => set('normalizationFootnote', e.target.value)} rows={2} />
      </Section>

      {/* 6. Value Creation */}
      <Section title="Value Creation" number="06" defaultOpen={false}>
        <Textarea label="Introduction" value={data.valueCreationIntro} onChange={e => set('valueCreationIntro', e.target.value)} rows={2} />
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pt-2">Initiatives</p>
        <div className="space-y-3">
          {(data.valueCreationItems || []).map((vc, i) => (
            <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input value={vc.initiative} placeholder="Initiative name" onChange={e => {
                  const arr = [...data.valueCreationItems]; arr[i] = { ...arr[i], initiative: e.target.value }; set('valueCreationItems', arr)
                }} className="flex-1" />
                <button onClick={() => {
                  const arr = [...data.valueCreationItems]; arr.splice(i, 1); set('valueCreationItems', arr)
                }} className="text-slate-300 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input value={vc.description} placeholder="Description" onChange={e => {
                  const arr = [...data.valueCreationItems]; arr[i] = { ...arr[i], description: e.target.value }; set('valueCreationItems', arr)
                }} />
                <Input value={vc.timing} placeholder="Timing" onChange={e => {
                  const arr = [...data.valueCreationItems]; arr[i] = { ...arr[i], timing: e.target.value }; set('valueCreationItems', arr)
                }} />
                <Input value={vc.revenueImpact} placeholder="Revenue Impact" onChange={e => {
                  const arr = [...data.valueCreationItems]; arr[i] = { ...arr[i], revenueImpact: e.target.value }; set('valueCreationItems', arr)
                }} />
                <Input value={vc.dependencies} placeholder="Dependencies" onChange={e => {
                  const arr = [...data.valueCreationItems]; arr[i] = { ...arr[i], dependencies: e.target.value }; set('valueCreationItems', arr)
                }} />
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => set('valueCreationItems', [...data.valueCreationItems, { initiative: '', description: '', timing: '', revenueImpact: '', dependencies: '' }])}>
            <Plus className="w-3 h-3" /> Add Initiative
          </Button>
        </div>
      </Section>

      {/* 7. Operations & Management */}
      <Section title="Operations & Management" number="07" defaultOpen={false}>
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">General Manager</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Name" value={data.gmProfile.name} onChange={e => set('gmProfile', { ...data.gmProfile, name: e.target.value })} />
          <Input label="Tenure" value={data.gmProfile.tenure} onChange={e => set('gmProfile', { ...data.gmProfile, tenure: e.target.value })} />
          <Input label="Certifications" value={data.gmProfile.certifications} onChange={e => set('gmProfile', { ...data.gmProfile, certifications: e.target.value })} />
          <Input label="Transition Plan" value={data.gmProfile.transition} onChange={e => set('gmProfile', { ...data.gmProfile, transition: e.target.value })} />
        </div>
        <Textarea label="Responsibilities" value={data.gmProfile.responsibilities} onChange={e => set('gmProfile', { ...data.gmProfile, responsibilities: e.target.value })} rows={2} />

        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pt-4">Staffing Overview</p>
        <div className="space-y-2">
          {(data.staffingOverview || []).map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={s} onChange={e => setArrayItem('staffingOverview', i, e.target.value)} className="flex-1" />
              <button onClick={() => removeArrayItem('staffingOverview', i)} className="text-slate-300 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => addArrayItem('staffingOverview')}>
            <Plus className="w-3 h-3" /> Add
          </Button>
        </div>

        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pt-4">Technology Stack</p>
        <div className="space-y-2">
          {(data.technologyStack || []).map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={t} onChange={e => setArrayItem('technologyStack', i, e.target.value)} className="flex-1" />
              <button onClick={() => removeArrayItem('technologyStack', i)} className="text-slate-300 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => addArrayItem('technologyStack')}>
            <Plus className="w-3 h-3" /> Add
          </Button>
        </div>

        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pt-4">Marketing Overview</p>
        <div className="space-y-2">
          {(data.marketingOverview || []).map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={m} onChange={e => setArrayItem('marketingOverview', i, e.target.value)} className="flex-1" />
              <button onClick={() => removeArrayItem('marketingOverview', i)} className="text-slate-300 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => addArrayItem('marketingOverview')}>
            <Plus className="w-3 h-3" /> Add
          </Button>
        </div>

        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pt-4">Marketing Opportunities</p>
        <div className="space-y-2">
          {(data.marketingOpportunities || []).map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={m} onChange={e => setArrayItem('marketingOpportunities', i, e.target.value)} className="flex-1" />
              <button onClick={() => removeArrayItem('marketingOpportunities', i)} className="text-slate-300 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => addArrayItem('marketingOpportunities')}>
            <Plus className="w-3 h-3" /> Add
          </Button>
        </div>
      </Section>

      {/* 8. Real Estate */}
      <Section title="Real Estate" number="08" defaultOpen={false}>
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Facility Details</p>
        <div className="space-y-2">
          {(data.facilityDetails || []).map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={f.label} placeholder="Label" onChange={e => {
                const arr = [...data.facilityDetails]; arr[i] = { ...arr[i], label: e.target.value }; set('facilityDetails', arr)
              }} className="w-40" />
              <Input value={f.value} placeholder="Value" onChange={e => {
                const arr = [...data.facilityDetails]; arr[i] = { ...arr[i], value: e.target.value }; set('facilityDetails', arr)
              }} className="flex-1" />
              <button onClick={() => {
                const arr = [...data.facilityDetails]; arr.splice(i, 1); set('facilityDetails', arr)
              }} className="text-slate-300 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => set('facilityDetails', [...data.facilityDetails, { label: '', value: '' }])}>
            <Plus className="w-3 h-3" /> Add Detail
          </Button>
        </div>

        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pt-4">Lease Details</p>
        <div className="space-y-2">
          {(data.leaseDetails || []).map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={l.label} placeholder="Label" onChange={e => {
                const arr = [...data.leaseDetails]; arr[i] = { ...arr[i], label: e.target.value }; set('leaseDetails', arr)
              }} className="w-40" />
              <Input value={l.value} placeholder="Value" onChange={e => {
                const arr = [...data.leaseDetails]; arr[i] = { ...arr[i], value: e.target.value }; set('leaseDetails', arr)
              }} className="flex-1" />
              <button onClick={() => {
                const arr = [...data.leaseDetails]; arr.splice(i, 1); set('leaseDetails', arr)
              }} className="text-slate-300 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => set('leaseDetails', [...data.leaseDetails, { label: '', value: '' }])}>
            <Plus className="w-3 h-3" /> Add Detail
          </Button>
        </div>
      </Section>

      {/* 9. Competitive Landscape */}
      <Section title="Competitive Landscape" number="09" defaultOpen={false}>
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Competitive Intro</p>
        <div className="space-y-2">
          {(data.competitiveIntro || []).map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={c} onChange={e => setArrayItem('competitiveIntro', i, e.target.value)} className="flex-1" />
              <button onClick={() => removeArrayItem('competitiveIntro', i)} className="text-slate-300 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => addArrayItem('competitiveIntro')}>
            <Plus className="w-3 h-3" /> Add Bullet
          </Button>
        </div>

        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pt-4">Competitors</p>
        <div className="space-y-3">
          {(data.competitors || []).map((c, i) => (
            <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input value={c.name} placeholder="Name" onChange={e => {
                  const arr = [...data.competitors]; arr[i] = { ...arr[i], name: e.target.value }; set('competitors', arr)
                }} className="flex-1" />
                <button onClick={() => {
                  const arr = [...data.competitors]; arr.splice(i, 1); set('competitors', arr)
                }} className="text-slate-300 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Input value={c.distance} placeholder="Distance" onChange={e => {
                  const arr = [...data.competitors]; arr[i] = { ...arr[i], distance: e.target.value }; set('competitors', arr)
                }} />
                <Input value={c.services} placeholder="Services" onChange={e => {
                  const arr = [...data.competitors]; arr[i] = { ...arr[i], services: e.target.value }; set('competitors', arr)
                }} />
                <Input value={c.capacity} placeholder="Capacity" onChange={e => {
                  const arr = [...data.competitors]; arr[i] = { ...arr[i], capacity: e.target.value }; set('competitors', arr)
                }} />
                <Input value={c.rating} placeholder="Rating" onChange={e => {
                  const arr = [...data.competitors]; arr[i] = { ...arr[i], rating: e.target.value }; set('competitors', arr)
                }} />
              </div>
              <Textarea value={c.commentary} placeholder="Commentary" onChange={e => {
                const arr = [...data.competitors]; arr[i] = { ...arr[i], commentary: e.target.value }; set('competitors', arr)
              }} rows={2} />
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => set('competitors', [...data.competitors, { name: '', distance: '', services: '', capacity: '', rating: '', commentary: '' }])}>
            <Plus className="w-3 h-3" /> Add Competitor
          </Button>
        </div>
      </Section>

      {/* 10. Transaction Details */}
      <Section title="Transaction Details" number="10" defaultOpen={false}>
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Transaction Terms</p>
        <div className="space-y-2">
          {(data.transactionTerms || []).map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={t.label} placeholder="Label" onChange={e => {
                const arr = [...data.transactionTerms]; arr[i] = { ...arr[i], label: e.target.value }; set('transactionTerms', arr)
              }} className="w-40" />
              <Input value={t.value} placeholder="Value" onChange={e => {
                const arr = [...data.transactionTerms]; arr[i] = { ...arr[i], value: e.target.value }; set('transactionTerms', arr)
              }} className="flex-1" />
              <button onClick={() => {
                const arr = [...data.transactionTerms]; arr.splice(i, 1); set('transactionTerms', arr)
              }} className="text-slate-300 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => set('transactionTerms', [...data.transactionTerms, { label: '', value: '' }])}>
            <Plus className="w-3 h-3" /> Add Term
          </Button>
        </div>

        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pt-4">Data Room Contents</p>
        <div className="space-y-2">
          {(data.dataRoomContents || []).map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={d.category} placeholder="Category" onChange={e => {
                const arr = [...data.dataRoomContents]; arr[i] = { ...arr[i], category: e.target.value }; set('dataRoomContents', arr)
              }} className="w-40" />
              <Input value={d.items} placeholder="Documents" onChange={e => {
                const arr = [...data.dataRoomContents]; arr[i] = { ...arr[i], items: e.target.value }; set('dataRoomContents', arr)
              }} className="flex-1" />
              <button onClick={() => {
                const arr = [...data.dataRoomContents]; arr.splice(i, 1); set('dataRoomContents', arr)
              }} className="text-slate-300 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => set('dataRoomContents', [...data.dataRoomContents, { category: '', items: '' }])}>
            <Plus className="w-3 h-3" /> Add Category
          </Button>
        </div>

        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pt-4">Process Steps</p>
        <div className="space-y-2">
          {(data.processSteps || []).map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={s.step} placeholder="Step" onChange={e => {
                const arr = [...data.processSteps]; arr[i] = { ...arr[i], step: e.target.value }; set('processSteps', arr)
              }} className="w-20" />
              <Input value={s.title} placeholder="Title" onChange={e => {
                const arr = [...data.processSteps]; arr[i] = { ...arr[i], title: e.target.value }; set('processSteps', arr)
              }} className="w-40" />
              <Input value={s.description} placeholder="Description" onChange={e => {
                const arr = [...data.processSteps]; arr[i] = { ...arr[i], description: e.target.value }; set('processSteps', arr)
              }} className="flex-1" />
              <button onClick={() => {
                const arr = [...data.processSteps]; arr.splice(i, 1); set('processSteps', arr)
              }} className="text-slate-300 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => set('processSteps', [...data.processSteps, { step: '', title: '', description: '' }])}>
            <Plus className="w-3 h-3" /> Add Step
          </Button>
        </div>
      </Section>

      {/* 11. Contact */}
      <Section title="Contact Information" number="11">
        <div className="grid grid-cols-3 gap-3">
          <Input label="Contact Name" value={data.contactName} onChange={e => set('contactName', e.target.value)} />
          <Input label="Title" value={data.contactTitle} onChange={e => set('contactTitle', e.target.value)} />
          <Input label="Email" value={data.contactEmail} onChange={e => set('contactEmail', e.target.value)} />
        </div>
      </Section>

      {/* Generate Button */}
      <div className="flex justify-end">
        <Button size="lg" onClick={generate}>
          <Bot className="w-4 h-4" />
          Generate CIM
        </Button>
      </div>
    </div>
  )
}
