import { prisma } from '@/lib/prisma'

export type ClientNotificationPreferences = {
  emailEnabled: boolean
  notificationEmail: string
}

const DEFAULT_PREFS: ClientNotificationPreferences = {
  emailEnabled: true,
  notificationEmail: '',
}

export function parseNotificationPreferences(raw: unknown): ClientNotificationPreferences {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PREFS }
  const obj = raw as Record<string, unknown>
  const legacyEmail = typeof obj.email === 'boolean' ? obj.email : undefined
  const emailEnabled =
    typeof obj.emailEnabled === 'boolean'
      ? obj.emailEnabled
      : legacyEmail !== undefined
        ? legacyEmail
        : DEFAULT_PREFS.emailEnabled
  const notificationEmail =
    typeof obj.notificationEmail === 'string'
      ? obj.notificationEmail.trim()
      : typeof obj.emailAddress === 'string'
        ? obj.emailAddress.trim()
        : ''
  return { emailEnabled, notificationEmail }
}

export async function getClientNotificationPreferences(clientId: string): Promise<ClientNotificationPreferences & { fallbackEmail: string }> {
  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: {
      email: true,
      sectionSubmissions: true,
      User: { select: { email: true } },
    },
  })
  if (!client) return { ...DEFAULT_PREFS, fallbackEmail: '' }

  const submissions = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object'
    ? client.sectionSubmissions
    : {}) as Record<string, unknown>
  const parsed = parseNotificationPreferences(submissions.notificationPreferences)
  const fallbackEmail = (client.email || client.User?.email || '').trim()

  return {
    emailEnabled: parsed.emailEnabled,
    notificationEmail: parsed.notificationEmail || fallbackEmail,
    fallbackEmail,
  }
}

export async function saveClientNotificationPreferences(
  clientId: string,
  prefs: ClientNotificationPreferences,
): Promise<ClientNotificationPreferences> {
  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: { sectionSubmissions: true, email: true, User: { select: { email: true } } },
  })
  if (!client) throw new Error('Client not found')

  const fallbackEmail = (client.email || client.User?.email || '').trim()
  const normalized: ClientNotificationPreferences = {
    emailEnabled: prefs.emailEnabled,
    notificationEmail: prefs.notificationEmail.trim() || fallbackEmail,
  }

  const current = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object'
    ? client.sectionSubmissions
    : {}) as Record<string, unknown>

  await prisma.clientProfile.update({
    where: { id: clientId },
    data: {
      sectionSubmissions: {
        ...current,
        notificationPreferences: normalized,
      } as any,
    },
  })

  return normalized
}

export function resolveNotificationRecipient(
  prefs: ClientNotificationPreferences & { fallbackEmail: string },
): { shouldSend: boolean; email: string } {
  if (!prefs.emailEnabled) return { shouldSend: false, email: '' }
  const email = (prefs.notificationEmail || prefs.fallbackEmail).trim().toLowerCase()
  if (!email) return { shouldSend: false, email: '' }
  return { shouldSend: true, email }
}
