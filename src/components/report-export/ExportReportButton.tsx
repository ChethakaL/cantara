'use client'

import { Printer } from 'lucide-react'
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

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={handlePrint}>
        <Printer className="w-3.5 h-3.5" />
        {label || 'Export PDF'}
      </Button>
    </div>
  )
}
