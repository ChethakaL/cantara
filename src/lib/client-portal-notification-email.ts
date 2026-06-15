import { sendEmailWithComposio } from '@/lib/composio'
import {
  recordClientEmailNotification,
  type ClientEmailNotificationType,
} from '@/lib/client-email-notifications'
import {
  getClientNotificationPreferences,
  resolveNotificationRecipient,
} from '@/lib/client-notification-preferences'

export async function sendClientPortalNotificationEmail(args: {
  clientId: string
  type: ClientEmailNotificationType
  subject: string
  body: string
  displayName?: string
  reminderDaysBefore?: number | null
  documentId?: string | null
  targetDeadline?: Date | null
  payload?: Record<string, unknown> | null
}): Promise<{ sent: boolean; skippedReason?: string }> {
  const prefs = await getClientNotificationPreferences(args.clientId)
  const recipient = resolveNotificationRecipient(prefs)

  if (!recipient.shouldSend) {
    return { sent: false, skippedReason: 'email_notifications_disabled' }
  }

  try {
    await sendEmailWithComposio({
      to: recipient.email,
      displayName: args.displayName || prefs.fallbackEmail.split('@')[0] || 'Client',
      subject: args.subject,
      body: args.body,
    })
    await recordClientEmailNotification({
      clientId: args.clientId,
      type: args.type,
      recipientEmail: recipient.email,
      subject: args.subject,
      reminderDaysBefore: args.reminderDaysBefore ?? null,
      documentId: args.documentId ?? null,
      targetDeadline: args.targetDeadline ?? null,
      payload: args.payload ?? null,
      status: 'SENT',
    })
    return { sent: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send email'
    await recordClientEmailNotification({
      clientId: args.clientId,
      type: args.type,
      recipientEmail: recipient.email,
      subject: args.subject,
      reminderDaysBefore: args.reminderDaysBefore ?? null,
      documentId: args.documentId ?? null,
      targetDeadline: args.targetDeadline ?? null,
      payload: args.payload ?? null,
      status: 'FAILED',
      errorMessage: message,
    })
    throw error
  }
}
