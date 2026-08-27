import { executeDocuSignTool } from '@/lib/composio/docusign'

/**
 * Prefer webhook account hint when present, else default / demo / first from OAuth userinfo.
 */
export async function resolveDocuSignAccountId(hint?: string | null): Promise<string | null> {
  if (hint && String(hint).trim()) return String(hint).trim()
  try {
    const info = await executeDocuSignTool<any>('DOCUSIGN_LIST_OAUTH_USERINFO', {})
    const accounts = info?.data?.accounts || []
    const preferred =
      accounts.find((a: any) => a.is_default) ||
      accounts.find((a: any) => String(a.base_uri || '').includes('demo')) ||
      accounts[0]
    return preferred?.account_id ? String(preferred.account_id) : null
  } catch {
    return null
  }
}

export function extractEnvelopeIdFromToolResult(created: any): string | null {
  const id = created?.data?.envelope_id || created?.data?.envelopeId || created?.data?.id || null
  return id ? String(id) : null
}

export function formatDocuSignToolError(created: any): string {
  if (typeof created?.error === 'string') return created.error
  return JSON.stringify(created?.error || created?.data || created)
}
