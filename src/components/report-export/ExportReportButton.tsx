'use client'

import { Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui'

interface Props {
  html: string
  fileName: string
  label?: string
}

export function ExportReportButton({ html, fileName, label }: Props) {
  const handlePrint = () => {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    setTimeout(() => win.print(), 500)
  }

  const handleDownload = () => {
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleDownload}>
        <Download className="w-3.5 h-3.5" />
        Download
      </Button>
      <Button size="sm" onClick={handlePrint}>
        <Printer className="w-3.5 h-3.5" />
        {label || 'Export PDF'}
      </Button>
    </div>
  )
}
