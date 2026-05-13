'use client'

import { useState } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui'

interface Props {
  html: string
  fileName: string
  label?: string
}

export function ExportReportButton({ html, fileName, label }: Props) {
  const [saving, setSaving] = useState(false)

  const saveReportToDrive = async () => {
    if (typeof window === 'undefined') return
    const match = window.location.pathname.match(/\/admin\/client\/([^/]+)/)
    const clientId = match?.[1]
    if (!clientId) return

    setSaving(true)
    try {
      await fetch('/api/drive/save-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, fileName, html }),
      })
    } catch {
      // Drive archival is best-effort; printing should still proceed.
    } finally {
      setSaving(false)
    }
  }

  const handlePrint = () => {
    void saveReportToDrive()
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
        {saving ? 'Saving...' : label || 'Export PDF'}
      </Button>
    </div>
  )
}
