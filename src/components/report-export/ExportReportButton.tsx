'use client'

import { useState } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui'

interface Props {
  html: string
  fileName: string
  label?: string
  advisorAction?: boolean
  waitForImages?: boolean
}

export function ExportReportButton({ html, fileName, label, advisorAction = true, waitForImages }: Props) {
  const [saving, setSaving] = useState(false)
  const [loadingImages, setLoadingImages] = useState(false)

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

  const handlePrint = async () => {
    void saveReportToDrive()
    const printableHtml = html
      .replaceAll('src="/brand/', `src="${window.location.origin}/brand/`)
      .replaceAll('src="/api/', `src="${window.location.origin}/api/`)

    if (waitForImages) {
      setLoadingImages(true)
      const parser = new DOMParser()
      const doc = parser.parseFromString(printableHtml, 'text/html')
      const imgs = Array.from(doc.querySelectorAll('img'))
      await Promise.all(imgs.map(img => {
        return new Promise(resolve => {
          const image = new Image()
          image.onload = resolve
          image.onerror = resolve
          image.src = img.src
        })
      }))
      setLoadingImages(false)
    }

    const win = window.open('', '_blank')
    if (!win) return

    let finalHtml = printableHtml
    if (waitForImages) {
      finalHtml += `<script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 250);
        };
      </script>`
    }

    win.document.write(finalHtml)
    win.document.close()
    if (!waitForImages) {
      setTimeout(() => win.print(), 500)
    }
  }

  return (
    <div className="flex items-center gap-2" data-advisor-action={advisorAction ? true : undefined}>
      <Button size="sm" onClick={handlePrint} disabled={loadingImages}>
        <Printer className="w-3.5 h-3.5" />
        {loadingImages ? 'Loading...' : saving ? 'Saving...' : label || 'Export PDF'}
      </Button>
    </div>
  )
}
