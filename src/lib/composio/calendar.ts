import {
  composioFetch,
  createComposioAuthLink,
  GOOGLECALENDAR_TOOLKIT_SLUG,
  ComposioAuthConfig,
  ComposioAuthConfigListItem,
  ComposioConnectedAccount,
} from './client'
import { advisorComposioUserId } from '@/lib/advisor-mail'

async function getGoogleCalendarAuthConfigId() {
  if (process.env.COMPOSIO_GOOGLE_CALENDAR_AUTH_CONFIG_ID) {
    return process.env.COMPOSIO_GOOGLE_CALENDAR_AUTH_CONFIG_ID
  }
  const params = new URLSearchParams({
    toolkit_slug: GOOGLECALENDAR_TOOLKIT_SLUG,
    is_composio_managed: 'true',
    limit: '20',
  })
  const list = await composioFetch<{ items?: ComposioAuthConfigListItem[] }>(`/auth_configs?${params}`)
  const existing = (list.items ?? []).find(item => {
    const authConfig = item.auth_config ?? item
    return item.toolkit?.slug?.toUpperCase() === GOOGLECALENDAR_TOOLKIT_SLUG && !authConfig.is_disabled && item.status !== 'DISABLED'
  })
  const existingId = existing?.auth_config?.id ?? existing?.id
  if (existingId) return existingId

  const created = await composioFetch<{ auth_config: ComposioAuthConfig; id?: string }>('/auth_configs', {
    method: 'POST',
    body: JSON.stringify({
      toolkit: { slug: GOOGLECALENDAR_TOOLKIT_SLUG },
      auth_config: {
        type: 'use_composio_managed_auth',
        credentials: {},
        restrict_to_following_tools: [
          'GOOGLECALENDAR_FIND_EVENT',
          'GOOGLECALENDAR_EVENTS_LIST',
          'GOOGLECALENDAR_LIST_CALENDARS',
        ],
      },
    }),
  })
  return created.auth_config?.id || created.id
}

export async function createAdvisorCalendarConnectLink(userId: string, callbackUrl: string) {
  const authConfigId = await getGoogleCalendarAuthConfigId()
  return createComposioAuthLink({
    authConfigId,
    userId: advisorComposioUserId(userId),
    callbackUrl,
    alias: `cantara-gcal-${Date.now()}`,
    allowMultiple: true,
  })
}

export async function getAdvisorCalendarConnection(userId: string) {
  const composioUserId = advisorComposioUserId(userId)
  const params = new URLSearchParams({
    limit: '10',
    account_type: 'ALL',
    order_by: 'updated_at',
    order_direction: 'desc',
  })
  params.append('user_ids', composioUserId)
  params.append('toolkit_slugs', GOOGLECALENDAR_TOOLKIT_SLUG)
  const connections = await composioFetch<{ items?: ComposioConnectedAccount[] }>(`/connected_accounts?${params}`)
  return (connections.items ?? []).find(item => item.status === 'ACTIVE' && !item.is_disabled) ?? null
}

export async function disconnectAdvisorCalendar(userId: string) {
  const composioUserId = advisorComposioUserId(userId)
  const params = new URLSearchParams({ limit: '50', account_type: 'ALL' })
  params.append('user_ids', composioUserId)
  params.append('toolkit_slugs', GOOGLECALENDAR_TOOLKIT_SLUG)
  const connections = await composioFetch<{ items?: Array<{ id: string }> }>(`/connected_accounts?${params}`)
  await Promise.all(
    (connections.items ?? []).map(conn =>
      composioFetch(`/connected_accounts/${conn.id}`, { method: 'DELETE' }).catch(err =>
        console.warn(`[calendar] Failed to delete connection ${conn.id}:`, err),
      ),
    ),
  )
}

export async function executeAdvisorCalendarTool<T = unknown>(
  userId: string,
  slug: string,
  argumentsPayload: Record<string, unknown>,
) {
  const connection = await getAdvisorCalendarConnection(userId)
  if (!connection) throw new Error('Connect Google Calendar before searching events.')
  const res = await composioFetch<{ successful?: boolean; error?: string; data?: T }>(`/tools/execute/${slug}`, {
    method: 'POST',
    body: JSON.stringify({
      connected_account_id: connection.id,
      user_id: connection.user_id || advisorComposioUserId(userId),
      arguments: argumentsPayload,
    }),
  })
  if (res.successful === false) throw new Error(res.error || 'Google Calendar request failed')
  return res.data
}
