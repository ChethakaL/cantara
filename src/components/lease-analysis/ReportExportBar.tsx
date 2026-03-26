'use client'
import { Download, Trash2, Plus, FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx'
import { LeaseReport } from '@/lib/lease-analysis/types'
import { Button } from '@/components/ui'

interface Props {
  reportMarkdown: string
  clientName: string
  onNewAnalysis: () => void
  onDelete?: () => void
  report?: LeaseReport
}

export function ReportExportBar({ reportMarkdown, clientName, onNewAnalysis, onDelete, report }: Props) {
  const handleExportText = () => {
    const blob = new Blob([reportMarkdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    a.href = url
    a.download = `lease-analysis-${clientName.replace(/\\s+/g, '_')}-${timestamp}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportExcel = () => {
    if (!report) return
    const wb = XLSX.utils.book_new()
    
    if (report.snapshotTable?.length) {
      const wsSnapshot = XLSX.utils.json_to_sheet(report.snapshotTable)
      XLSX.utils.book_append_sheet(wb, wsSnapshot, 'Summary Snapshot')
    }

    const allFlags = [
      ...(report.redFlags || []).map(f => ({ ...f, Status: '🔴 RED' })),
      ...(report.orangeFlags || []).map(f => ({ ...f, Status: '🟡 YELLOW' })),
      ...(report.greenFlags || []).map(f => ({ ...f, Status: '🟢 GREEN' })),
    ].map(f => ({
      Severity: f.Status,
      Issue: f.issue,
      WhyItMatters: f.whyItMatters,
      SourceSection: f.sourceSection
    }))

    if (allFlags.length) {
      const wsFlags = XLSX.utils.json_to_sheet(allFlags)
      XLSX.utils.book_append_sheet(wb, wsFlags, 'Flags')
    }

    if (report.detailedFindings?.length) {
      const parsedFindings = report.detailedFindings.map(f => ({
        ID: f.id,
        Title: f.title,
        Content: f.content
      }))
      const wsFindings = XLSX.utils.json_to_sheet(parsedFindings)
      XLSX.utils.book_append_sheet(wb, wsFindings, 'Findings')
    }

    XLSX.writeFile(wb, `LeaseAnalysis_${clientName.replace(/\\s+/g, '_')}.xlsx`)
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleExportText} className="gap-2 text-slate-600">
        <Download className="w-3.5 h-3.5" /> TXT
      </Button>
      <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2 text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100">
        <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
      </Button>
      
      <Button variant="outline" size="sm" onClick={onNewAnalysis} className="gap-2">
        <Plus className="w-3.5 h-3.5" /> New Analysis
      </Button>

      {onDelete && (
        <Button
          variant="outline" size="sm"
          className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 border-rose-100 hover:border-rose-200"
          onClick={onDelete}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  )
}
