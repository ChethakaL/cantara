/**
 * Shared text/HTML helpers for Cantara PDF report exports.
 */

export type SummaryBlockItem = {
  heading: string
  text: string
}

function escapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/** Bold `**segments**` in already-escaped or plain HTML fragments. */
export function applyInlineBoldToHtml(html: string): string {
  return html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
}

export function formatInlineMarkdown(text: string): string {
  return applyInlineBoldToHtml(escapeHtml(text))
}

/** Legacy cover blurb: one paragraph from all summary blocks (avoid duplicating structured section). */
export function formatCompactExecutiveSummaryHtml(items: SummaryBlockItem[]): string {
  const parts = items
    .map(item => item.text?.trim())
    .filter(Boolean)
  if (!parts.length) return ''
  return `<p style="margin:0;font-size:13px;line-height:1.7;color:#475569;">${parts.map(p => formatInlineMarkdown(p)).join(' ')}</p>`
}

/** Structured executive summary with bold subheadings (used as the main Executive Summary section). */
export function formatStructuredExecutiveSummaryHtml(items: SummaryBlockItem[]): string {
  return items
    .map(
      item =>
        `<p style="margin:0 0 14px 0;font-size:13px;line-height:1.7;color:#475569;"><strong style="color:#1e293b;font-size:13px;">${escapeHtml(item.heading)}</strong><br/>${formatInlineMarkdown(item.text ?? '')}</p>`,
    )
    .join('')
}

/** Plain-text executive summary for legacy cover `summary` field. */
export function formatSummaryBodyText(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  const paragraphs = trimmed.split(/\n\s*\n/).filter(p => p.trim())
  if (paragraphs.length <= 1) {
    return `<p style="margin:0;font-size:13px;line-height:1.7;color:#475569;">${formatInlineMarkdown(trimmed)}</p>`
  }
  return paragraphs
    .map(p => `<p style="margin:0 0 12px 0;font-size:13px;line-height:1.7;color:#475569;">${formatInlineMarkdown(p.trim())}</p>`)
    .join('')
}
