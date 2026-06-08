import { prisma } from '@/lib/prisma'

/** Non-null documentId for bundled deadline reminders (PostgreSQL unique treats NULLs as distinct). */
export const DEADLINE_REMINDER_BUNDLE_DOCUMENT_ID = '__deadline_bundle__'
export const TEAM_MEMBER_INVITE_REMINDER_DAYS = -1
export const TEAM_MEMBER_INVITE_TARGET_DEADLINE = new Date(0)

export type ClientEmailNotificationType = 'TEAM_MEMBER_INVITE' | 'DOCUMENT_DEADLINE_REMINDER'
export type ClientEmailNotificationStatus = 'SENT' | 'FAILED'

export function normalizeDeadlineForNotification(iso: string): Date {
  const date = new Date(iso)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0, 0))
}

export async function wasClientEmailNotificationSent(args: {
  clientId: string
  type: ClientEmailNotificationType
  recipientEmail: string
  reminderDaysBefore?: number | null
  documentId?: string | null
  targetDeadline?: Date | null
}) {
  const existing = await (prisma as any).clientEmailNotification.findFirst({
    where: {
      clientId: args.clientId,
      type: args.type,
      recipientEmail: args.recipientEmail.toLowerCase(),
      reminderDaysBefore: args.reminderDaysBefore ?? null,
      documentId: args.documentId ?? null,
      targetDeadline: args.targetDeadline ?? null,
      status: 'SENT',
    },
    select: { id: true },
  })
  return Boolean(existing)
}

export async function recordClientEmailNotification(args: {
  clientId: string
  type: ClientEmailNotificationType
  recipientEmail: string
  subject: string
  reminderDaysBefore?: number | null
  documentId?: string | null
  targetDeadline?: Date | null
  payload?: Record<string, unknown> | null
  status?: ClientEmailNotificationStatus
  errorMessage?: string | null
}) {
  const recipientEmail = args.recipientEmail.toLowerCase()
  const status = args.status ?? 'SENT'
  const documentId = args.documentId ?? null
  const reminderDaysBefore = args.reminderDaysBefore ?? null
  const targetDeadline = args.targetDeadline ?? null

  const where = {
    clientId_type_recipientEmail_reminderDaysBefore_documentId_targetDeadline: {
      clientId: args.clientId,
      type: args.type,
      recipientEmail,
      reminderDaysBefore,
      documentId,
      targetDeadline,
    },
  }

  return (prisma as any).clientEmailNotification.upsert({
    where,
    create: {
      clientId: args.clientId,
      type: args.type,
      recipientEmail,
      reminderDaysBefore,
      documentId,
      targetDeadline,
      subject: args.subject,
      payload: args.payload ?? undefined,
      status,
      errorMessage: args.errorMessage ?? null,
    },
    update: {
      subject: args.subject,
      payload: args.payload ?? undefined,
      status,
      errorMessage: args.errorMessage ?? null,
      sentAt: new Date(),
    },
  })
}
