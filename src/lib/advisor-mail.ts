import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { composioFetch, tryComposioFetch, createComposioAuthLink, ComposioConnectedAccount } from '@/lib/composio/client'
import { extractComposioMailEmail, getComposioMailAuthConfigId } from '@/lib/composio/mail'

export function advisorComposioUserId(userId: string) {
  return `cantara-advisor:${userId}`
}

export async function getLoggedInAdvisor() {
  const raw = cookies().get('cantara_admin_email')?.value || ''
  let email = raw
  try {
    email = decodeURIComponent(raw).trim().toLowerCase()
  } catch {
    email = raw.trim().toLowerCase()
  }
  if (!email) return null
  return prisma.user.findFirst({ where: { email, role: 'ADMIN' } })
}

export async function persistAdvisorMailConnection(userId: string, connectedAccountId?: string | null) {
  const composioUserId = advisorComposioUserId(userId)
  let accountId = (connectedAccountId || '').trim()
  if (!accountId) {
    const params = new URLSearchParams({
      limit: '10',
      account_type: 'ALL',
      order_by: 'updated_at',
      order_direction: 'desc',
    })
    params.append('user_ids', composioUserId)
    params.append('toolkit_slugs', 'GMAIL')
    const list = await composioFetch<{ items?: ComposioConnectedAccount[] }>(`/connected_accounts?${params}`)
    const match = (list.items ?? []).find(item => item.status === 'ACTIVE' && !item.is_disabled) || list.items?.[0]
    accountId = match?.id || ''
  }
  if (!accountId) return null
  return prisma.advisorMailConnection.upsert({
    where: { userId },
    update: { composioUserId, connectedAccountId: accountId, status: 'PENDING' },
    create: { userId, composioUserId, connectedAccountId: accountId },
  })
}

export async function createAdvisorMailConnectLink(userId: string, callbackUrl: string) {
  const authConfigId = await getComposioMailAuthConfigId()
  const composioUserId = advisorComposioUserId(userId)
  const link = await createComposioAuthLink({
    authConfigId,
    userId: composioUserId,
    callbackUrl,
    alias: `cantara-gmail-${Date.now()}`,
    allowMultiple: true,
  })
  if (link.connected_account_id) {
    await persistAdvisorMailConnection(userId, link.connected_account_id)
  }
  return link
}

export async function getAdvisorMailConnection(userId: string) {
  const saved = await prisma.advisorMailConnection.findUnique({ where: { userId } })
  const composioUserId = advisorComposioUserId(userId)
  let accountId = saved?.connectedAccountId
  if (!accountId) {
    const params = new URLSearchParams({
      limit: '10',
      account_type: 'ALL',
      order_by: 'updated_at',
      order_direction: 'desc',
    })
    params.append('user_ids', composioUserId)
    params.append('toolkit_slugs', 'GMAIL')
    const list = await tryComposioFetch<{ items?: ComposioConnectedAccount[] }>(`/connected_accounts?${params}`)
    accountId = (list?.items ?? []).find(item => item.status === 'ACTIVE' && !item.is_disabled)?.id
    if (accountId) await persistAdvisorMailConnection(userId, accountId)
  }
  if (!accountId) return null
  const direct = await tryComposioFetch<ComposioConnectedAccount>(`/connected_accounts/${accountId}`)
  if (!direct) return saved ? { ...saved, active: false, connectedEmail: saved.email } : null
  const active = direct.status === 'ACTIVE' && !direct.is_disabled
  let email = extractComposioMailEmail(direct)
  if (active && !email) email = (await getComposioMailProfileForConnection(direct)).email
  const row = await prisma.advisorMailConnection.upsert({
    where: { userId },
    update: { composioUserId, connectedAccountId: accountId, status: direct.status, email: email || saved?.email || null },
    create: { userId, composioUserId, connectedAccountId: accountId, status: direct.status, email: email || null },
  })
  return { ...row, ...direct, active, connectedEmail: email || row.email }
}

async function getComposioMailProfileForConnection(connection: ComposioConnectedAccount) {
  try {
    const res = await composioFetch<{ data?: unknown }>(`/tools/execute/GMAIL_GET_PROFILE`, {
      method: 'POST',
      body: JSON.stringify({ connected_account_id: connection.id, user_id: connection.user_id, arguments: {} }),
    })
    return { email: extractComposioMailEmail(res.data) }
  } catch {
    return { email: null }
  }
}

export async function disconnectAdvisorMail(userId: string) {
  const saved = await prisma.advisorMailConnection.findUnique({ where: { userId } })
  if (saved?.connectedAccountId) {
    await tryComposioFetch(`/connected_accounts/${saved.connectedAccountId}`, { method: 'DELETE' })
  }
  if (saved) await prisma.advisorMailConnection.delete({ where: { userId } }).catch(() => undefined)
}

export async function sendAdvisorEmail(args: {
  userId: string
  to: string
  extraTo?: string[]
  cc?: string[]
  displayName?: string
  subject: string
  body: string
}) {
  const connection = await getAdvisorMailConnection(args.userId)
  if (!connection?.active) throw new Error('Connect your Gmail in Settings before sending email.')
  const extraTo = (args.extraTo || []).filter(Boolean)
  const cc = (args.cc || []).filter(Boolean)
  const res = await composioFetch<{ successful?: boolean; error?: string; data?: unknown }>('/tools/execute/GMAIL_SEND_EMAIL', {
    method: 'POST',
    body: JSON.stringify({
      connected_account_id: connection.connectedAccountId,
      user_id: connection.composioUserId,
      arguments: {
        recipient_email: args.to,
        subject: args.subject,
        body: args.body,
        is_html: true,
        ...(extraTo.length ? { extra_recipients: extraTo } : {}),
        ...(cc.length ? { cc } : {}),
      },
    }),
  })
  if (res.successful === false) throw new Error(res.error || 'Gmail send failed')
  return res.data ?? { success: true }
}
