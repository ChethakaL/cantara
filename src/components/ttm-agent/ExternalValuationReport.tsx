'use client'

import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx-js-style'
import JSZip from 'jszip'
import mammoth from 'mammoth'
import { Download, FileSpreadsheet, FileText, Loader2, Upload, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui'
import type { AgentAiProvider } from '@/lib/agent-model-provider'
import { Ws2WorkbookView } from '@/components/ttm-agent/Ws2WorkbookView'
import type { TtmAnalysisView, Ws2RecastView } from '@/lib/ttm-agent/types'

type Report = { id: string; clientId: string; fileName: string; mimeType: string; fileSize: number; reportJson: any; createdAt: string }
const fileUrl = (report: Report, download = false) => `/api/ttm-agent/external-report/${report.id}/file?clientId=${encodeURIComponent(report.clientId)}${download ? '&download=1' : ''}`
const fmt = (v: unknown) => typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(v ?? '—')

function rgb(value: any) {
  if (!value?.rgb) return undefined
  const hex = String(value.rgb).replace(/^FF(?=[0-9A-F]{6}$)/i, '')
  return /^[0-9A-F]{6}$/i.test(hex) ? `#${hex}` : undefined
}

function cssForCell(cell: any) {
  const s = cell?.s || {}
  const style: Record<string, string | number> = {}
  const bg = rgb(s.fill?.fgColor) || rgb(s.fill?.bgColor)
  const fg = rgb(s.font?.color)
  if (bg) style.backgroundColor = bg
  if (fg) style.color = fg
  if (s.font?.bold) style.fontWeight = 700
  if (s.font?.italic) style.fontStyle = 'italic'
  if (s.font?.underline) style.textDecoration = 'underline'
  if (s.font?.sz) style.fontSize = `${Math.max(10, Math.min(28, s.font.sz))}px`
  if (s.font?.name) style.fontFamily = s.font.name
  if (s.alignment?.horizontal) style.textAlign = s.alignment.horizontal === 'center' ? 'center' : s.alignment.horizontal === 'right' ? 'right' : 'left'
  if (s.alignment?.vertical) style.verticalAlign = s.alignment.vertical === 'center' ? 'middle' : s.alignment.vertical
  if (s.alignment?.wrapText) style.whiteSpace = 'pre-wrap'
  for (const edge of ['top', 'right', 'bottom', 'left']) {
    const border = s.border?.[edge]
    if (border?.style) {
      const color = rgb(border.color) || '#cbd5e1'
      const width = border.style === 'thick' ? 2 : border.style === 'medium' ? 1.5 : 1
      style[`border${edge[0].toUpperCase()}${edge.slice(1)}`] = `${width}px solid ${color}`
    }
  }
  return style
}

function xmlColor(node: Element | null) {
  if (!node) return undefined
  const value = node.getAttribute('rgb') || ''
  const hex = value.replace(/^FF(?=[0-9A-F]{6}$)/i, '')
  return /^[0-9A-F]{6}$/i.test(hex) ? `#${hex}` : undefined
}

function xmlStyleMap(xml: string) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const children = (node: Element | null, tag: string) => node ? Array.from(node.getElementsByTagName(tag)) : []
  const attr = (node: Element | undefined, key: string) => node?.getAttribute(key) || undefined
  const fontNodes = children(doc.querySelector('fonts'), 'font')
  const fillNodes = children(doc.querySelector('fills'), 'fill')
  const borderNodes = children(doc.querySelector('borders'), 'border')
  const fonts = fontNodes.map(font => ({
    color: xmlColor(font.getElementsByTagName('color')[0] || null),
    bold: !!font.getElementsByTagName('b').length,
    italic: !!font.getElementsByTagName('i').length,
    underline: !!font.getElementsByTagName('u').length,
    fontSize: Number(attr(font.getElementsByTagName('sz')[0], 'val')) || undefined,
    fontFamily: attr(font.getElementsByTagName('name')[0], 'val'),
  }))
  const fills = fillNodes.map(fill => {
    const pattern = fill.getElementsByTagName('patternFill')[0]
    return xmlColor(pattern?.getElementsByTagName('fgColor')[0] || null) || xmlColor(pattern?.getElementsByTagName('bgColor')[0] || null)
  })
  const borders = borderNodes.map(border => Object.fromEntries(['top', 'right', 'bottom', 'left'].flatMap(edge => {
    const node = border.getElementsByTagName(edge)[0]
    if (!node || !node.getAttribute('style')) return []
    const color = xmlColor(node.getElementsByTagName('color')[0] || null) || '#cbd5e1'
    const width = node.getAttribute('style') === 'thick' ? 2 : node.getAttribute('style') === 'medium' ? 1.5 : 1
    return [[`border${edge[0].toUpperCase()}${edge.slice(1)}`, `${width}px solid ${color}`]]
  })))
  const xfs = children(doc.querySelector('cellXfs'), 'xf')
  return xfs.map(xf => {
    const style: Record<string, string | number> = {}
    const font = fonts[Number(attr(xf, 'fontId')) || 0]
    const fill = fills[Number(attr(xf, 'fillId')) || 0]
    const border = borders[Number(attr(xf, 'borderId')) || 0]
    if (fill) style.backgroundColor = fill
    if (font?.color) style.color = font.color
    if (font?.bold) style.fontWeight = 700
    if (font?.italic) style.fontStyle = 'italic'
    if (font?.underline) style.textDecoration = 'underline'
    if (font?.fontSize) style.fontSize = `${Math.max(10, Math.min(28, font.fontSize))}px`
    if (font?.fontFamily) style.fontFamily = font.fontFamily
    Object.assign(style, border)
    const alignment = xf.getElementsByTagName('alignment')[0]
    const horizontal = attr(alignment, 'horizontal')
    const vertical = attr(alignment, 'vertical')
    if (horizontal) style.textAlign = horizontal === 'center' ? 'center' : horizontal === 'right' ? 'right' : 'left'
    if (vertical) style.verticalAlign = vertical === 'center' ? 'middle' : vertical
    if (attr(alignment, 'wrapText') === '1') style.whiteSpace = 'pre-wrap'
    return style
  })
}

async function readStyledWorkbook(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: 'array', cellStyles: true })
  let xmlStyles: Record<string, string | number>[] = []
  const stylesBySheet: Array<Record<string, number>> = []
  try {
    const zip = await JSZip.loadAsync(buffer)
    const stylesXml = await zip.file('xl/styles.xml')?.async('text')
    if (stylesXml) xmlStyles = xmlStyleMap(stylesXml)
    const workbookXml = await zip.file('xl/workbook.xml')?.async('text')
    const relationshipsXml = await zip.file('xl/_rels/workbook.xml.rels')?.async('text')
    if (workbookXml && relationshipsXml) {
      const workbookDoc = new DOMParser().parseFromString(workbookXml, 'application/xml')
      const relDoc = new DOMParser().parseFromString(relationshipsXml, 'application/xml')
      const rels = new Map(Array.from(relDoc.getElementsByTagName('Relationship')).map(rel => [rel.getAttribute('Id') || '', rel.getAttribute('Target') || '']))
      const sheetNodes = Array.from(workbookDoc.getElementsByTagName('sheet'))
      for (const sheetNode of sheetNodes) {
        const relationId = sheetNode.getAttribute('r:id') || sheetNode.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || ''
        let target = rels.get(relationId) || ''
        if (target.startsWith('/')) target = target.slice(1)
        else if (!target.startsWith('xl/')) target = `xl/${target}`
        const sheetXml = await zip.file(target)?.async('text')
        const sheetDoc = sheetXml ? new DOMParser().parseFromString(sheetXml, 'application/xml') : null
        const styles: Record<string, number> = {}
        for (const cell of Array.from(sheetDoc?.getElementsByTagName('c') || [])) {
          const ref = cell.getAttribute('r'), styleIndex = cell.getAttribute('s')
          if (ref && styleIndex) styles[ref] = Number(styleIndex)
        }
        stylesBySheet.push(styles)
      }
    }
  } catch { /* legacy XLS/CSV use SheetJS' available cell style information */ }
  return workbook.SheetNames.map((name, sheetIndex) => {
    const sheet = workbook.Sheets[name]
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1')
    const maxRow = Math.min(range.e.r, range.s.r + 999)
    const maxCol = Math.min(range.e.c, range.s.c + 79)
    const merges = (sheet['!merges'] || []) as Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>
    const covered = new Set<string>()
    const spans = new Map<string, { rowSpan: number; colSpan: number }>()
    for (const merge of merges) {
      spans.set(`${merge.s.r}:${merge.s.c}`, { rowSpan: merge.e.r - merge.s.r + 1, colSpan: merge.e.c - merge.s.c + 1 })
      for (let r = merge.s.r; r <= merge.e.r; r++) for (let c = merge.s.c; c <= merge.e.c; c++) if (r !== merge.s.r || c !== merge.s.c) covered.add(`${r}:${c}`)
    }
    const rows = []
    for (let r = range.s.r; r <= maxRow; r++) {
      const cells = []
      for (let c = range.s.c; c <= maxCol; c++) {
        if (covered.has(`${r}:${c}`)) { cells.push({ covered: true }); continue }
        const address = XLSX.utils.encode_cell({ r, c })
        const cell = sheet[address]
        const value = cell?.w ?? cell?.v ?? ''
        const styleIndex = stylesBySheet[sheetIndex]?.[address]
        cells.push({ text: String(value), style: { ...(styleIndex === undefined ? {} : xmlStyles[styleIndex] || {}), ...cssForCell(cell) }, ...(spans.get(`${r}:${c}`) || {}), width: `${Math.min(520, Math.max(64, (sheet['!cols']?.[c]?.wch ?? 12) * 8))}px` })
      }
      rows.push({ cells, height: sheet['!rows']?.[r]?.hpt ? `${sheet['!rows'][r].hpt}px` : undefined })
    }
    return { name, rows, truncated: range.e.r > maxRow || range.e.c > maxCol }
  })
}

function StyledWorkbookPreview({ sheets }: { sheets: any[] }) {
  return <div className="max-h-[75vh] overflow-auto">{sheets.map(sheet => <div key={sheet.name} className="mb-5"><p className="sticky top-0 z-10 border-y bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">{sheet.name}{sheet.truncated ? ' · preview limited to first 1,000 rows / 80 columns; download for the complete workbook' : ''}</p><div className="overflow-auto"><table className="border-collapse text-xs"><tbody>{sheet.rows.map((row: any, i: number) => <tr key={i} style={{ height: row.height }}>{row.cells.map((cell: any, j: number) => cell.covered ? null : <td key={j} rowSpan={cell.rowSpan} colSpan={cell.colSpan} style={{ border: '1px solid #e2e8f0', ...cell.style, minWidth: cell.width, maxWidth: 520, padding: '5px 8px', whiteSpace: cell.style?.whiteSpace || 'nowrap' }}>{cell.text}</td>)}</tr>)}</tbody></table></div></div>)}</div>
}

function adaptExternalReport(report: Report): { analysis: TtmAnalysisView; recast: Ws2RecastView } {
  const data = report.reportJson || {}
  const periods = Array.isArray(data.periods) ? data.periods : []
  const value = (period: any, key: string) => typeof period?.[key] === 'number' && Number.isFinite(period[key]) ? period[key] : null
  const categories = (period: any, key: string) => Array.isArray(period?.[key]) ? period[key].filter((row: any) => typeof row?.value === 'number').map((row: any, i: number) => ({ code: row.code || `external-${key}-${i}`, category: row.category || row.name || row.code || '—', value: row.value })) : []
  const years = periods.filter((p: any) => !/^ltm$/i.test(p.key || p.label || '')).slice(-3).map((p: any, i: number) => ({
    fiscalYear: p.label || p.key || `FY${i + 1}`, periodStart: p.start || '', periodEnd: p.end || '', accountantYearKey: null,
    revenueByCategory: categories(p, 'revenueByCategory'), cogsByCategory: categories(p, 'cogsByCategory'), opExByCategory: categories(p, 'opExByCategory'),
    totalRevenue: value(p, 'revenue') ?? Number.NaN, totalCogs: value(p, 'cogs') ?? Number.NaN, grossProfit: value(p, 'grossProfit') ?? Number.NaN,
    grossMarginPct: value(p, 'grossMarginPct'), totalOpEx: value(p, 'operatingExpenses') ?? Number.NaN, ebitdaPreRecast: value(p, 'preRecastEbitda') ?? Number.NaN, netIncome: value(p, 'netIncome'),
  }))
  const ltm = periods.find((p: any) => /^ltm$/i.test(p.key || p.label || '')) || periods[0] || {}
  const normLines = (Array.isArray(data.normalizationItems) ? data.normalizationItems : []).map((item: any, i: number) => ({ id: `external-${i}`, description: item.description || '—', source: item.source || item.reason || undefined, byPeriod: item.byPeriod || {} }))
  const valuationResult = data.valuationResult || {
    preRecast: Object.fromEntries(periods.map((p: any) => [String(p.key || p.label).toUpperCase(), value(p, 'preRecastEbitda')]).filter(([, n]: any) => n != null)),
    normalizedEbitda: Object.fromEntries(periods.map((p: any) => [String(p.key || p.label).toUpperCase(), value(p, 'normalizedEbitda')]).filter(([, n]: any) => n != null)),
    fourWallEbitda: Object.fromEntries(periods.map((p: any) => [String(p.key || p.label).toUpperCase(), value(p, 'fourWallEbitda')]).filter(([, n]: any) => n != null)),
    valuation: Object.fromEntries(periods.map((p: any) => [String(p.key || p.label).toUpperCase(), p.enterpriseValue]).filter(([, n]: any) => n)), normLines,
  }
  const analysis = {
    id: `external-${report.id}`, clientId: report.clientId, version: 1, status: 'APPROVED', hitlStatus: 'APPROVED', inputFingerprint: '', model: 'external', temperature: 0, maxTokens: 0,
    inputSnapshot: [], normalizedData: null, structuredModel: null, ttmSummary: {
      startMonth: ltm.start || '', endMonth: ltm.end || '', revenueByCategory: categories(ltm, 'revenueByCategory'), cogsByCategory: categories(ltm, 'cogsByCategory'), opExByCategory: categories(ltm, 'opExByCategory'),
      totalRevenue: value(ltm, 'revenue') ?? Number.NaN, totalCogs: value(ltm, 'cogs') ?? Number.NaN, grossProfit: value(ltm, 'grossProfit') ?? Number.NaN, grossMarginPct: value(ltm, 'grossMarginPct'), totalOpEx: value(ltm, 'operatingExpenses') ?? Number.NaN, ebitdaPreRecast: value(ltm, 'preRecastEbitda') ?? Number.NaN, ebitdaMarginPct: null, netIncome: value(ltm, 'netIncome'),
    }, annualModel: { years, trends: [], anomalies: [] }, workingCapital: null, dataQualityReport: null, summary: null, reportMarkdown: null, errorMessage: null, approvedAt: report.createdAt, approvedByName: 'External report', createdAt: report.createdAt, updatedAt: report.createdAt, flags: [], dispatchTasks: [], derivedReports: [],
  } as unknown as TtmAnalysisView
  const range = data.valuationRange || {}
  const recast = {
    id: `external-${report.id}`, clientId: report.clientId, ttmAnalysisId: analysis.id, version: 1, status: 'APPROVED', hitlStatus: 'APPROVED', model: 'external', temperature: 0, maxTokens: 0,
    assumptions: { multipleLow: value(data, 'multipleLow') ?? range.multipleLow ?? null, multipleMid: value(data, 'multipleMid') ?? range.multipleMid ?? null, multipleHigh: value(data, 'multipleHigh') ?? range.multipleHigh ?? null, replacementSalary: null, relatedPartyOwnership: false, fmrEstimate: null },
    reportMarkdown: null, parsedReport: { externalReport: true, llmValuationResult: { ...valuationResult, normLines } }, workbookKey: null, workbookUrl: null,
    normalizedEbitda: value(ltm, 'normalizedEbitda'), valuationLow: value(range, 'low'), valuationMid: value(range, 'mid'), valuationHigh: value(range, 'high'), errorMessage: null, approvedAt: report.createdAt, approvedByName: 'External report', createdAt: report.createdAt, updatedAt: report.createdAt, flags: [],
  } as unknown as Ws2RecastView
  return { analysis, recast }
}

function ReportSummary({ report }: { report: Report }) {
  const { analysis, recast } = adaptExternalReport(report)
  return <Ws2WorkbookView analysis={analysis} recast={recast} clientName={report.reportJson?.businessName || 'Business'} readOnly />
}

export function ExternalValuationReportViewer({ report }: { report: Report }) {
  const [mode, setMode] = useState<'report' | 'file'>('report')
  const [preview, setPreview] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const ext = report.fileName.toLowerCase().split('.').pop()
  const endpoint = `/api/client-approved-outputs/external-valuation-file?clientId=${encodeURIComponent(report.clientId)}&reportId=${encodeURIComponent(report.id)}`
  useEffect(() => {
    if (mode !== 'file' || ext === 'pdf') return
    let cancelled = false
    setLoading(true); setError('')
    fetch(endpoint).then(async res => {
      if (!res.ok) throw new Error('Unable to preview the released report file.')
      const buffer = await res.arrayBuffer()
      if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        return { kind: 'table', sheets: await readStyledWorkbook(buffer) }
      }
      if (ext === 'docx') return { kind: 'text', text: (await mammoth.extractRawText({ arrayBuffer: buffer })).value }
      return { kind: 'text', text: 'Preview is unavailable. Download the original file to view it.' }
    }).then(value => { if (!cancelled) setPreview(value) }).catch(err => { if (!cancelled) setError(err.message) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [mode, report.id, endpoint, ext])
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex gap-2"><Button size="sm" variant={mode === 'report' ? 'primary' : 'outline'} onClick={() => setMode('report')}>Report view</Button><Button size="sm" variant={mode === 'file' ? 'primary' : 'outline'} onClick={() => setMode('file')}>Original file</Button></div>
      <a className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm" href={`${endpoint}&download=1`}><Download className="h-4 w-4"/>Download original</a>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {mode === 'report' && <ReportSummary report={report}/>}
    {mode === 'file' && <div className="overflow-hidden rounded-xl border"><div className="flex items-center gap-2 border-b bg-slate-50 p-3 text-sm font-medium"><FileText className="h-4 w-4"/>{report.fileName}</div>{ext === 'pdf' ? <iframe title={report.fileName} src={endpoint} className="h-[75vh] w-full"/> : loading ? <div className="p-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin"/></div> : preview?.kind === 'table' ? <div className="max-h-[75vh] overflow-auto"><StyledWorkbookPreview sheets={preview.sheets}/></div> : <pre className="max-h-[75vh] overflow-auto whitespace-pre-wrap p-4 text-sm">{preview?.text || 'Loading preview…'}</pre>}</div>}
  </div>
}

export function ExternalValuationReport({ clientId, provider, onBack, readOnly = false }: { clientId: string; provider: AgentAiProvider; onBack: () => void; readOnly?: boolean }) {
  const [report, setReport] = useState<Report | null>(null)
  const [mode, setMode] = useState<'report' | 'file'>('report')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<any>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const load = async () => { const res = await fetch(`/api/ttm-agent/external-report?clientId=${encodeURIComponent(clientId)}`); const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Unable to load report'); setReport(data.report) }
  useEffect(() => { void load().catch((e) => setError(e.message)) }, [clientId])
  useEffect(() => {
    if (mode !== 'file' || !report) return
    const ext = report.fileName.toLowerCase().split('.').pop()
    if (ext === 'pdf') { setPreview(null); return }
    let cancelled = false
    setLoadingPreview(true)
    fetch(fileUrl(report)).then(async (res) => { if (!res.ok) throw new Error('Unable to preview file'); const buf = await res.arrayBuffer(); if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') { return { kind: 'table', sheets: await readStyledWorkbook(buf) } } if (ext === 'docx') { const result = await mammoth.extractRawText({ arrayBuffer: buf }); return { kind: 'text', text: result.value } } return { kind: 'text', text: 'Preview is unavailable for this file type. Download the original file to view it.' } }).then(value => { if (!cancelled) setPreview(value) }).catch(e => { if (!cancelled) setError(e.message) }).finally(() => { if (!cancelled) setLoadingPreview(false) })
    return () => { cancelled = true }
  }, [mode, report?.id])
  const upload = async (file?: File) => { if (!file) return; setUploading(true); setError(''); try { const form = new FormData(); form.set('clientId', clientId); form.set('provider', provider); form.set('file', file); const res = await fetch('/api/ttm-agent/external-report', { method: 'POST', body: form }); const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Unable to process report'); setReport(data.report); setMode('report') } catch (e) { setError(e instanceof Error ? e.message : 'Unable to process report') } finally { setUploading(false) } }
  const ext = report?.fileName.toLowerCase().split('.').pop()
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-bold text-slate-900">External valuation report</h3><p className="text-sm text-slate-500">Upload a client-prepared report and view its extracted summary or original file.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={onBack} className="gap-1.5"><ArrowLeft className="h-4 w-4"/>Cantara valuation</Button>{report && <><Button variant={mode === 'report' ? 'primary' : 'outline'} size="sm" onClick={() => setMode('report')}>Report view</Button><Button variant={mode === 'file' ? 'primary' : 'outline'} size="sm" onClick={() => { setError(''); setMode('file') }}>Original file</Button><a className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm" href={fileUrl(report, true)}><Download className="h-4 w-4"/>Download</a></>}{!readOnly && <label className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-sm text-white ${uploading ? 'opacity-60' : ''}`}><Upload className="h-4 w-4"/>{uploading ? 'Processing…' : report ? 'Replace report' : 'Upload report'}<input className="hidden" type="file" accept=".pdf,.xlsx,.xls,.csv,.docx" disabled={uploading} onChange={e => { void upload(e.target.files?.[0]); e.currentTarget.value = '' }}/></label>}</div></div>
    {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{uploading && <p className="mb-4 flex items-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin"/>Uploading and extracting report with Claude…</p>}
    {!report && !uploading && <div className="rounded-xl border border-dashed p-10 text-center"><FileSpreadsheet className="mx-auto h-9 w-9 text-slate-400"/><p className="mt-3 font-medium">No external valuation uploaded</p><p className="mt-1 text-sm text-slate-500">Supported files: PDF, Excel, CSV, and Word (.docx), up to 25 MB.</p></div>}
    {report && mode === 'report' && <ReportSummary report={report}/>}
    {report && mode === 'file' && <div className="overflow-hidden rounded-xl border"><div className="flex items-center gap-2 border-b bg-slate-50 p-3 text-sm font-medium"><FileText className="h-4 w-4"/>{report.fileName}</div>{ext === 'pdf' ? <iframe title={report.fileName} src={fileUrl(report)} className="h-[75vh] w-full"/> : loadingPreview ? <div className="p-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin"/></div> : preview?.kind === 'table' ? <div className="max-h-[75vh] overflow-auto"><StyledWorkbookPreview sheets={preview.sheets}/></div> : <pre className="max-h-[75vh] overflow-auto whitespace-pre-wrap p-4 text-sm">{preview?.text || 'Loading preview…'}</pre>}</div>}
  </section>
}
