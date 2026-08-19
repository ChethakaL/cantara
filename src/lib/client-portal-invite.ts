import { buildClientPortalInviteEmail } from '@/lib/client-invite-email'
import { getPreferredComposioMailFromEmail } from '@/lib/composio/mail'

export const CLIENT_PORTAL_INVITE_REMINDER_DAYS = -1
export const CLIENT_PORTAL_INVITE_TARGET_DEADLINE = new Date(0)
// Prisma compound unique inputs require a concrete value for documentId.
// This sentinel identifies the invitation itself (not a client document).
export const CLIENT_PORTAL_INVITE_DOCUMENT_ID = '__portal_invite__'

export function getClientPortalInviteSubject(businessName: string) {
  return `Welcome to the Cantara portal — ${businessName}`
}

export function buildClientPortalInviteDraft(args: {
  businessName: string
  contactName: string
  email: string
  password: string
  loginUrl: string
  businessCategory?: string
  advisorName?: string
  settingsUrl?: string
}) {
  const subject = getClientPortalInviteSubject(args.businessName)
  const bodyHtml = buildClientPortalInviteEmail({
    businessName: args.businessName,
    contactName: args.contactName,
    email: args.email,
    password: args.password,
    loginUrl: args.loginUrl,
    businessCategories: args.businessCategory,
    advisorName: args.advisorName,
    settingsUrl: args.settingsUrl,
  })

  return { subject, bodyHtml, fromEmail: getPreferredComposioMailFromEmail() }
}
