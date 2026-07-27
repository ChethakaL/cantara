'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import { AlertTriangle, CheckCircle, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react'
import { Badge, Button, Card } from '@/components/ui'

export default function ExcelImportModal({
  isOpen,
  onClose,
  onImportComplete,
}: {
  isOpen: boolean
  onClose: () => void
  onImportComplete: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [rows, setRows] = useState<any[]>([])
  const [preview, setPreview] = useState<any>(null)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setParsing(true)
    setError('')
    try {
      const buffer = await selected.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const firstSheetName = wb.SheetNames[0]
      const sheet = wb.Sheets[firstSheetName]
      const json: any[] = XLSX.utils.sheet_to_json(sheet)
      setRows(json)

      // Get pre-validation overview from API
      const res = await fetch('/api/sales-leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: json }),
      })
      if (!res.ok) throw new Error('Preview validation failed')
      const data = await res.json()
      setPreview(data)
    } catch (err: any) {
      setError(err.message || 'Could not parse Excel workbook')
    } finally {
      setParsing(false)
    }
  }

  const executeImport = async () => {
    if (!rows.length) return
    setImporting(true)
    setError('')
    try {
      const res = await fetch('/api/sales-leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      if (!res.ok) throw new Error('Import execution failed')
      const data = await res.json()
      onImportComplete()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to import sales leads')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={onClose} />
      <Card className="relative w-full max-w-4xl max-h-[90vh] flex flex-col p-6 overflow-hidden bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b pb-4 mb-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-cantara-gold" />
            <h2 className="text-lg font-semibold text-slate-800">
              Import Qualified Sales Leads (Excel Workbook)
            </h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
            {error}
          </div>
        )}

        {!preview ? (
          <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 p-6 text-center">
            <Upload className="w-10 h-10 text-slate-400 mb-3" />
            <p className="text-sm font-medium text-slate-700 mb-1">
              Select or drop your Excel Workbook (.xlsx, .xls)
            </p>
            <p className="text-xs text-slate-400 max-w-md mb-4">
              Upload sample datasets (e.g. Master sheet from Cantara - PHX Sample Data). Leads will be validated against ICP criteria before loading.
            </p>
            <label className="cursor-pointer">
              <span className="px-4 py-2 bg-[#21263C] text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5">
                {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                Browse Excel File
              </span>
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="hidden"
                disabled={parsing}
              />
            </label>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4">
            <div className="grid grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl text-center border">
              <div>
                <div className="text-xl font-bold text-slate-800">{preview.totalProcessed}</div>
                <div className="text-[11px] uppercase tracking-wider text-slate-400">Total Rows</div>
              </div>
              <div>
                <div className="text-xl font-bold text-emerald-600">{preview.importedCount}</div>
                <div className="text-[11px] uppercase tracking-wider text-emerald-600">Valid Leads</div>
              </div>
              <div>
                <div className="text-xl font-bold text-amber-600">{preview.skippedDuplicates}</div>
                <div className="text-[11px] uppercase tracking-wider text-amber-600">Duplicates</div>
              </div>
              <div>
                <div className="text-xl font-bold text-rose-600">{preview.invalidCount}</div>
                <div className="text-[11px] uppercase tracking-wider text-rose-600">Excluded (Franchise/Non-ICP)</div>
              </div>
            </div>

            <div className="border rounded-xl overflow-hidden max-h-[360px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[11px] uppercase text-slate-400 border-b">
                    <th className="p-3">#</th>
                    <th className="p-3">Business Name</th>
                    <th className="p-3">Location</th>
                    <th className="p-3">ICP Validation</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.results.map((res: any, idx: number) => {
                    const biz = res.row.businessName || res.row['Customer Name'] || res.row.Name || 'Unknown'
                    const loc = [res.row.city || res.row.City, res.row.state || res.row.State].filter(Boolean).join(', ')
                    return (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/60">
                        <td className="p-3 text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-medium text-slate-800">{biz}</td>
                        <td className="p-3 text-slate-500">{loc || 'N/A'}</td>
                        <td className="p-3">
                          {res.validation.valid ? (
                            <span className="text-emerald-600 flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" /> Ready for import
                            </span>
                          ) : (
                            <span className="text-rose-600 flex items-center gap-1" title={res.validation.reasons.join(', ')}>
                              <AlertTriangle className="w-3.5 h-3.5" /> {res.validation.reasons[0] || 'Non-ICP'}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {res.isDuplicate ? (
                            <Badge color="amber">Duplicate</Badge>
                          ) : res.validation.valid ? (
                            <Badge color="green">Import Target</Badge>
                          ) : (
                            <Badge color="red">Excluded</Badge>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="border-t pt-4 mt-4 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {preview && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPreview(null)}>
                Choose Another File
              </Button>
              <Button onClick={executeImport} disabled={importing || preview.importedCount === 0}>
                {importing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Import {preview.importedCount} Qualified Leads
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
