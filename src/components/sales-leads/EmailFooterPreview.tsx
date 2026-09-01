'use client'

import { useEffect, useRef } from 'react'

const PREVIEW_ROOT_ID = 'cantara-email-footer-preview'

/** Preview-only: drop embedded dark-mode CSS so light text/backgrounds stay visible in admin UI. */
function htmlForAdminPreview(html: string) {
  return html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
}

function buildPreviewDocument(html: string) {
  const previewHtml = htmlForAdminPreview(html)
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="color-scheme" content="light" />
  <style>
    html, body {
      margin: 0;
      padding: 8px;
      background: #ffffff;
      color: #1f2742;
    }
    #${PREVIEW_ROOT_ID} table {
      border-collapse: collapse;
    }
    #${PREVIEW_ROOT_ID} td,
    #${PREVIEW_ROOT_ID} div,
    #${PREVIEW_ROOT_ID} a {
      color: inherit;
    }
    #${PREVIEW_ROOT_ID} .cd-name,
    #${PREVIEW_ROOT_ID} .cd-title,
    #${PREVIEW_ROOT_ID} .cd-link,
    #${PREVIEW_ROOT_ID} a.cd-link {
      color: #1F2742 !important;
    }
    #${PREVIEW_ROOT_ID} .cd-logo-l,
    #${PREVIEW_ROOT_ID} .cd-li-l {
      display: block !important;
    }
    #${PREVIEW_ROOT_ID} .cd-logo-d,
    #${PREVIEW_ROOT_ID} .cd-li-d {
      display: none !important;
    }
  </style>
</head>
<body>
  <div id="${PREVIEW_ROOT_ID}">${previewHtml}</div>
</body>
</html>`
}

export function EmailFooterPreview({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const resize = () => {
      const doc = iframe.contentDocument
      if (!doc) return
      const height = Math.max(
        doc.documentElement?.scrollHeight ?? 0,
        doc.body?.scrollHeight ?? 0,
        120,
      )
      iframe.style.height = `${height + 8}px`
    }

    iframe.addEventListener('load', resize)
    resize()
    const timer = window.setTimeout(resize, 100)
    return () => {
      iframe.removeEventListener('load', resize)
      window.clearTimeout(timer)
    }
  }, [html])

  return (
    <iframe
      ref={iframeRef}
      title="Email footer preview"
      srcDoc={buildPreviewDocument(html)}
      sandbox="allow-same-origin"
      className="w-full min-h-[120px] border-0 bg-white rounded-lg"
    />
  )
}
