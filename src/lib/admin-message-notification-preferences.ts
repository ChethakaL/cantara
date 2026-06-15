import { prisma } from '@/lib/prisma'

const PREFS_KEY = 'admin_message_notification_prefs'

export type AdminMessageNotificationPreferences = {
  emailCantaraEnabled: boolean
  cantaraNotificationEmail: string
}

export const DEFAULT_ADMIN_MESSAGE_PREFS: AdminMessageNotificationPreferences = {
  emailCantaraEnabled: true,
  cantaraNotificationEmail: process.env.CANTARA_NOTIFICATION_EMAIL || process.env.ADMIN_NOTIFICATION_EMAIL || '',
}

function parsePrefs(raw: unknown): AdminMessageNotificationPreferences {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    emailCantaraEnabled:
      typeof obj.emailCantaraEnabled === 'boolean'
        ? obj.emailCantaraEnabled
        : DEFAULT_ADMIN_MESSAGE_PREFS.emailCantaraEnabled,
    cantaraNotificationEmail:
      typeof obj.cantaraNotificationEmail === 'string'
        ? obj.cantaraNotificationEmail.trim()
        : DEFAULT_ADMIN_MESSAGE_PREFS.cantaraNotificationEmail,
  }
}

export async function getAdminMessageNotificationPreferences(): Promise<AdminMessageNotificationPreferences> {
  const row = await prisma.appSecret.findUnique({ where: { key: PREFS_KEY } })
  if (!row?.value) return { ...DEFAULT_ADMIN_MESSAGE_PREFS }
  try {
    return parsePrefs(JSON.parse(row.value))
  } catch {
    return { ...DEFAULT_ADMIN_MESSAGE_PREFS }
  }
}

export async function saveAdminMessageNotificationPreferences(
  prefs: Partial<AdminMessageNotificationPreferences>,
): Promise<AdminMessageNotificationPreferences> {
  const current = await getAdminMessageNotificationPreferences()
  const next = parsePrefs({ ...current, ...prefs })
  await prisma.appSecret.upsert({
    where: { key: PREFS_KEY },
    update: { value: JSON.stringify(next) },
    create: { key: PREFS_KEY, value: JSON.stringify(next) },
  })
  return next
}

export function resolveCantaraNotificationEmail(prefs: AdminMessageNotificationPreferences): string {
  if (!prefs.emailCantaraEnabled) return ''
  return prefs.cantaraNotificationEmail.trim().toLowerCase()
}
