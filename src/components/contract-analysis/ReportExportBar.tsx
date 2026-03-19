'use client'
import { Download, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui'

interface Props {
  reportMarkdown: string
  clientName: string
  onNewAnalysis: () => void
  onDelete?: () => void
}

export function ReportExportBar({ reportMarkdown, clientName, onNewAnalysis, onDelete }: Props) {
  const handleExport = () => {
    const blob = new Blob([reportMarkdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    a.href = url
    a.download = `contract-analysis-${clientName.replace(/\s+/g, '_')}-${timestamp}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
        <Download className="w-3.5 h-3.5" /> Export
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
