/** Split generated draft text from an HTML email signature block, if present. */
export function splitEmailDraftBody(body: string): { message: string; htmlFooter: string | null } {
  const trimmed = body.trim()
  if (!trimmed) return { message: '', htmlFooter: null }

  const htmlStart = trimmed.search(/<(?:style|table|div|html)\b/i)
  if (htmlStart === -1) return { message: body, htmlFooter: null }

  const message = trimmed.slice(0, htmlStart).trimEnd()
  const htmlFooter = trimmed.slice(htmlStart).trim()
  return { message, htmlFooter: htmlFooter || null }
}

export function combineEmailDraftBody(message: string, htmlFooter: string | null | undefined): string {
  const msg = message.trimEnd()
  const footer = String(htmlFooter ?? '').trim()
  if (!footer) return msg
  return msg ? `${msg}\n\n${footer}` : footer
}
