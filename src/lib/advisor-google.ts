import {
  createAdvisorMailConnectLink,
  disconnectAdvisorMail,
  persistAdvisorMailConnection,
  getAdvisorMailConnection,
} from '@/lib/advisor-mail'
import {
  createAdvisorCalendarConnectLink,
  disconnectAdvisorCalendar,
  getAdvisorCalendarConnection,
} from '@/lib/composio/calendar'
import { createGoogleDriveConnectLink, disconnectGoogleDrive, getGoogleDriveConnection } from '@/lib/composio/drive'

export type GoogleServiceStatus = {
  gmail: boolean
  calendar: boolean
  drive: boolean
  email: string | null
}

export async function getAdvisorGoogleServicesStatus(userId: string): Promise<GoogleServiceStatus> {
  const [mail, calendar, drive] = await Promise.all([
    getAdvisorMailConnection(userId).catch(() => null),
    getAdvisorCalendarConnection(userId).catch(() => null),
    getGoogleDriveConnection().catch(() => null),
  ])
  return {
    gmail: Boolean(mail?.active),
    calendar: Boolean(calendar),
    drive: Boolean(drive?.status === 'ACTIVE' && !drive.is_disabled),
    email: mail?.connectedEmail ?? mail?.email ?? null,
  }
}

export function googleServicesContinueUrl(origin: string, next: 'calendar' | 'drive') {
  return `${origin}/api/advisor/google-services/continue?next=${next}`
}

function adminConnectedUrl(origin: string) {
  return `${origin}/admin?google=connected`
}

export async function startAdvisorGoogleConnectChain(userId: string, origin: string) {
  const status = await getAdvisorGoogleServicesStatus(userId)
  if (!status.gmail) {
    return createAdvisorMailConnectLink(userId, googleServicesContinueUrl(origin, 'calendar'))
  }
  if (!status.calendar) {
    await persistAdvisorMailConnection(userId)
    return createAdvisorCalendarConnectLink(userId, googleServicesContinueUrl(origin, 'drive'))
  }
  if (!status.drive) {
    return createGoogleDriveConnectLink(adminConnectedUrl(origin))
  }
  return { redirect_url: adminConnectedUrl(origin), connected_account_id: '' }
}

export async function continueAdvisorGoogleConnectChain(
  userId: string,
  origin: string,
  next: 'calendar' | 'drive',
  connectedAccountId?: string | null,
) {
  if (next === 'calendar') {
    await persistAdvisorMailConnection(userId, connectedAccountId).catch(err =>
      console.warn('[google-services] persist gmail after oauth', err),
    )
    const calendar = await getAdvisorCalendarConnection(userId).catch(() => null)
    if (calendar) return continueAdvisorGoogleConnectChain(userId, origin, 'drive')
    return createAdvisorCalendarConnectLink(userId, googleServicesContinueUrl(origin, 'drive'))
  }

  const drive = await getGoogleDriveConnection().catch(() => null)
  if (drive?.status === 'ACTIVE' && !drive.is_disabled) {
    return { redirect_url: adminConnectedUrl(origin), connected_account_id: drive.id }
  }
  return createGoogleDriveConnectLink(adminConnectedUrl(origin))
}

export async function disconnectAdvisorGoogleServices(userId: string) {
  await Promise.all([
    disconnectAdvisorMail(userId).catch(err => console.warn('[google-services] gmail disconnect', err)),
    disconnectAdvisorCalendar(userId).catch(err => console.warn('[google-services] calendar disconnect', err)),
    disconnectGoogleDrive().catch(err => console.warn('[google-services] drive disconnect', err)),
  ])
}
