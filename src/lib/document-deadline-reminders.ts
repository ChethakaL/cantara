import {
  DOCUMENT_DEADLINE_REMINDER_DAYS,
  formatDeadlineLabel,
  getDaysUntilDeadline,
  getEffectiveDocumentDeadline,
  type DocumentDeadlineReminderDay,
} from '@/lib/document-deadlines'
import {
  clientDocumentAppliesToProgress,
  completedUnitsForDocument,
  filterClientPortalDocuments,
  getMultiYearUploadProgress,
  progressUnitsForDocument,
  type DocumentStatusLookup,
} from '@/lib/client-portal-documents'
import {
  DEADLINE_REMINDER_BUNDLE_DOCUMENT_ID,
  normalizeDeadlineForNotification,
  recordClientEmailNotification,
  wasClientEmailNotificationSent,
} from '@/lib/client-email-notifications'
import {
  getDocsForAgentSelections,
  getDocsForWorkstream,
  getValuationDocsForWorkstream,
  mergeDocumentCategories,
  type DocumentDef,
} from '@/lib/documentData'
import { applyAgentDocumentRequirements } from '@/lib/workstream-agent-mapping'
import { isComposioMailConfiguredAsync } from '@/lib/composio'
import { sendClientPortalNotificationEmail } from '@/lib/client-portal-notification-email'
import {
  getClientNotificationPreferences,
  resolveNotificationRecipient,
} from '@/lib/client-notification-preferences'
import { getProjectEnv } from '@/lib/project-env'
import { prisma } from '@/lib/prisma'
import type { DocumentStatus, Workstream, BusinessType } from '@/lib/store'

const VALUATION_SECTION_ID = 'valuation'

export type OutstandingDocumentReminder = {
  documentId: string
  documentName: string
  sectionId: string
  sectionLabel: string
  deadlineIso: string
  daysUntilDue: number
}

export type DocumentDeadlineReminderRunSummary = {
  clientsScanned: number
  emailsSent: number
  emailsSkippedAlreadySent: number
  emailsFailed: number
  remindersQueued: number
  emailsPlanned?: number
  dryRun?: boolean
  errors: string[]
}

function buildLoginUrl() {
  const base = getProjectEnv('NEXT_PUBLIC_APP_URL') || getProjectEnv('NEXTAUTH_URL') || 'http://localhost:3000'
  return `${base.replace(/\/$/, '')}/login/client`
}

function buildReminderEmail(args: {
  recipientName: string
  businessName: string
  reminderDaysBefore: DocumentDeadlineReminderDay
  dueDateLabel: string
  documents: OutstandingDocumentReminder[]
  loginUrl: string
}) {
  const docList = args.documents
    .map(doc => `<li><strong>${doc.documentName}</strong> (due ${formatDeadlineLabel(doc.deadlineIso)})</li>`)
    .join('')

  const dayPhrase =
    args.reminderDaysBefore === 1
      ? 'tomorrow'
      : `in ${args.reminderDaysBefore} days`

  return `
    <p>Hi ${args.recipientName},</p>
    <p>This is a reminder from Cantara Pet Advisors for <strong>${args.businessName}</strong>.</p>
    <p>You have <strong>${args.documents.length}</strong> document${args.documents.length === 1 ? '' : 's'} still needed on the client portal. The due date is <strong>${args.dueDateLabel}</strong> (${dayPhrase}).</p>
    <ul>${docList}</ul>
    <p>Please sign in to upload the missing files or update your checklist:</p>
    <p><a href="${args.loginUrl}">${args.loginUrl}</a></p>
    <p>If you have already uploaded these items, you can ignore this message.</p>
    <p>Thank you,<br/>Cantara Pet Advisors</p>
  `
}

function toStatusLookup(
  documentStatuses: Record<string, DocumentStatus>,
): DocumentStatusLookup {
  return (id: string) => documentStatuses[id]
}

function isDocumentUploaded(doc: DocumentDef, getStatus: DocumentStatusLookup): boolean {
  if (!clientDocumentAppliesToProgress(doc, getStatus(doc.id) ?? { id: doc.id, hasDoc: null, assignedTo: null, uploadedAt: null, fileName: null, notApplicable: false })) {
    return true
  }
  const status = getStatus(doc.id) ?? { id: doc.id, hasDoc: null, assignedTo: null, uploadedAt: null, fileName: null, notApplicable: false }
  const units = progressUnitsForDocument(doc, status, getStatus)
  if (units === 0) return true
  return completedUnitsForDocument(doc, status, getStatus) >= units
}

function collectOutstandingDocuments(args: {
  categories: Array<{ id: string; title: string; documents: DocumentDef[] }>
  valuationDocs: DocumentDef[]
  documentStatuses: Record<string, DocumentStatus>
  sectionDeadlines: Record<string, string>
  now: Date
}): OutstandingDocumentReminder[] {
  const outstanding: OutstandingDocumentReminder[] = []
  const getStatus = toStatusLookup(args.documentStatuses)

  const scanDoc = (doc: DocumentDef, sectionId: string, sectionLabel: string) => {
    if (!clientDocumentAppliesToProgress(doc, getStatus(doc.id) ?? { id: doc.id, hasDoc: null, assignedTo: null, uploadedAt: null, fileName: null, notApplicable: false })) {
      return
    }
    if (isDocumentUploaded(doc, getStatus)) return

    const deadlineIso = getEffectiveDocumentDeadline(doc.id, sectionId, args.documentStatuses, args.sectionDeadlines)
    if (!deadlineIso) return

    const daysUntilDue = getDaysUntilDeadline(deadlineIso, args.now)
    if (daysUntilDue === null || daysUntilDue < 0) return
    if (!DOCUMENT_DEADLINE_REMINDER_DAYS.includes(daysUntilDue as DocumentDeadlineReminderDay)) return

    outstanding.push({
      documentId: doc.id,
      documentName: doc.name,
      sectionId,
      sectionLabel,
      deadlineIso,
      daysUntilDue,
    })
  }

  for (const doc of args.valuationDocs) {
    scanDoc(doc, VALUATION_SECTION_ID, 'Business Valuation')
  }
  for (const category of args.categories) {
    for (const doc of category.documents) {
      scanDoc(doc, category.id, category.title)
    }
  }

  return outstanding
}

function groupRemindersBySendKey(items: OutstandingDocumentReminder[]) {
  const groups = new Map<string, { reminderDaysBefore: DocumentDeadlineReminderDay; deadlineIso: string; documents: OutstandingDocumentReminder[] }>()

  for (const item of items) {
    const deadlineKey = normalizeDeadlineForNotification(item.deadlineIso).toISOString()
    const key = `${item.daysUntilDue}|${deadlineKey}`
    const existing = groups.get(key)
    if (existing) {
      existing.documents.push(item)
      continue
    }
    groups.set(key, {
      reminderDaysBefore: item.daysUntilDue as DocumentDeadlineReminderDay,
      deadlineIso: item.deadlineIso,
      documents: [item],
    })
  }

  return Array.from(groups.values())
}

function mapDocumentStatuses(rows: Array<{ documentId: string; hasDoc: boolean | null; assignedTo: string | null; uploadedAt: Date | null; fileName: string | null; fileUrl: string | null; notApplicable: boolean; targetDeadline: Date | null }>): Record<string, DocumentStatus> {
  return Object.fromEntries(
    rows.map(row => [
      row.documentId,
      {
        id: row.documentId,
        hasDoc: row.hasDoc,
        assignedTo: row.assignedTo,
        uploadedAt: row.uploadedAt?.toISOString() ?? null,
        fileName: row.fileName ?? null,
        fileUrl: row.fileUrl ?? null,
        notApplicable: row.notApplicable,
        targetDeadline: row.targetDeadline?.toISOString() ?? null,
      },
    ]),
  )
}

function enrichStatusesWithUploads(
  documentStatuses: Record<string, DocumentStatus>,
  uploads: Array<{ documentId: string | null; fileName: string; createdAt: Date }>,
) {
  const byDocId = new Map<string, Array<{ fileName: string; uploadedAt: string }>>()
  for (const row of uploads) {
    if (!row.documentId) continue
    const bucket = byDocId.get(row.documentId) ?? []
    bucket.push({ fileName: row.fileName, uploadedAt: row.createdAt.toISOString() })
    byDocId.set(row.documentId, bucket)
  }

  const next = { ...documentStatuses }
  for (const [documentId, files] of Array.from(byDocId.entries())) {
    const sorted = [...files].sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt))
    const latest = sorted[0]
    const current = next[documentId] ?? {
      id: documentId,
      hasDoc: null,
      assignedTo: null,
      uploadedAt: null,
      fileName: null,
      notApplicable: false,
    }
    next[documentId] = {
      ...current,
      hasDoc: current.hasDoc ?? true,
      fileName: current.fileName ?? (sorted.length === 1 ? latest.fileName : `${sorted.length} files uploaded`),
      uploadedAt: current.uploadedAt ?? latest.uploadedAt,
    }
  }

  for (const documentId of Object.keys(next)) {
    const status = next[documentId]
    if (getMultiYearUploadProgress(documentId, id => next[id] ?? status).completed > 0 && !status.fileName) {
      const progress = getMultiYearUploadProgress(documentId, id => next[id] ?? status)
      if (progress.completed >= progress.total && progress.total > 0) {
        next[documentId] = { ...status, fileName: progress.combinedFileName ?? 'Uploaded' }
      }
    }
  }

  return next
}

export async function runDocumentDeadlineReminders(
  now = new Date(),
  options?: { dryRun?: boolean },
): Promise<DocumentDeadlineReminderRunSummary> {
  const dryRun = Boolean(options?.dryRun)
  const summary: DocumentDeadlineReminderRunSummary = {
    clientsScanned: 0,
    emailsSent: 0,
    emailsSkippedAlreadySent: 0,
    emailsFailed: 0,
    remindersQueued: 0,
    emailsPlanned: 0,
    dryRun,
    errors: [],
  }

  const mailReady = await isComposioMailConfiguredAsync()
  if (!mailReady) {
    summary.errors.push('Composio mail is not configured; skipping deadline reminders.')
    return summary
  }

  const requirements = await (prisma as any).agentDocumentRequirement.findMany({
    select: { agentId: true, documentIds: true },
  })

  const clients = await prisma.clientProfile.findMany({
    include: {
      User: { select: { name: true, email: true } },
      ClientDocumentStatuses: true,
      ClientDocument: { select: { documentId: true, fileName: true, createdAt: true } },
      customWorkstream: { include: { agents: true } },
      ClientWorkstreamAgents: true,
    },
  })

  const loginUrl = buildLoginUrl()

  for (const rawClient of clients) {
    summary.clientsScanned += 1
    const client = applyAgentDocumentRequirements(rawClient, requirements)
    const prefs = await getClientNotificationPreferences(client.id)
    const recipient = resolveNotificationRecipient(prefs)
    if (!recipient.shouldSend) {
      summary.emailsSkippedAlreadySent += 1
      continue
    }
    const recipientEmail = recipient.email

    const workstream = (client.workstream ? String(client.workstream).toLowerCase() : null) as Workstream
    const businessType = (client.businessType ? String(client.businessType).toLowerCase() : 'single') as BusinessType
    if (!workstream) continue

    const sectionDeadlines = (client.sectionDeadlines as Record<string, string> | null) ?? {}
    let documentStatuses = mapDocumentStatuses(client.ClientDocumentStatuses ?? [])
    documentStatuses = enrichStatusesWithUploads(documentStatuses, client.ClientDocument ?? [])

    const categories = mergeDocumentCategories([
      ...(client.customWorkstream
        ? getDocsForAgentSelections(
            (client.customWorkstream.agents ?? []).map((agent: { agentId: string; agentName: string; documentIds: string[] }) => ({
              agentId: agent.agentId,
              agentName: agent.agentName,
              documentIds: agent.documentIds ?? [],
            })),
          )
        : getDocsForWorkstream(workstream, businessType)),
      ...getDocsForAgentSelections(
        (client.ClientWorkstreamAgents ?? []).map((agent: { agentId: string; agentName: string; documentIds: string[] }) => ({
          agentId: agent.agentId,
          agentName: agent.agentName,
          documentIds: agent.documentIds ?? [],
        })),
      ),
    ])
      .map(category => ({
        ...category,
        documents: filterClientPortalDocuments(category.documents),
      }))
      .filter(category => category.documents.length > 0)

    const valuationDocs = filterClientPortalDocuments(getValuationDocsForWorkstream(workstream))

    const outstanding = collectOutstandingDocuments({
      categories,
      valuationDocs,
      documentStatuses,
      sectionDeadlines,
      now,
    })

    if (!outstanding.length) continue

    const groups = groupRemindersBySendKey(outstanding)
    const recipientName = client.User?.name || client.businessName || 'there'
    const businessName = client.businessName || 'your company'

    for (const group of groups) {
      summary.remindersQueued += 1
      const targetDeadline = normalizeDeadlineForNotification(group.deadlineIso)
      const dueDateLabel = formatDeadlineLabel(group.deadlineIso) ?? group.deadlineIso
      const subject = `Cantara: ${group.documents.length} document${group.documents.length === 1 ? '' : 's'} due ${dueDateLabel}`

      const alreadySent = await wasClientEmailNotificationSent({
        clientId: client.id,
        type: 'DOCUMENT_DEADLINE_REMINDER',
        recipientEmail,
        reminderDaysBefore: group.reminderDaysBefore,
        documentId: DEADLINE_REMINDER_BUNDLE_DOCUMENT_ID,
        targetDeadline,
      })
      if (alreadySent) {
        summary.emailsSkippedAlreadySent += 1
        continue
      }

      const body = buildReminderEmail({
        recipientName,
        businessName,
        reminderDaysBefore: group.reminderDaysBefore,
        dueDateLabel,
        documents: group.documents,
        loginUrl,
      })

      try {
        if (dryRun) {
          summary.emailsPlanned = (summary.emailsPlanned ?? 0) + 1
          continue
        }

        await sendClientPortalNotificationEmail({
          clientId: client.id,
          type: 'DOCUMENT_DEADLINE_REMINDER',
          displayName: recipientName,
          subject,
          body,
          reminderDaysBefore: group.reminderDaysBefore,
          documentId: DEADLINE_REMINDER_BUNDLE_DOCUMENT_ID,
          targetDeadline,
          payload: {
            documentIds: group.documents.map(doc => doc.documentId),
            documentNames: group.documents.map(doc => doc.documentName),
            dueDate: group.deadlineIso,
          },
        })
        summary.emailsSent += 1
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to send reminder email'
        summary.emailsFailed += 1
        summary.errors.push(`${client.id}: ${message}`)
        await recordClientEmailNotification({
          clientId: client.id,
          type: 'DOCUMENT_DEADLINE_REMINDER',
          recipientEmail,
          reminderDaysBefore: group.reminderDaysBefore,
          documentId: DEADLINE_REMINDER_BUNDLE_DOCUMENT_ID,
          targetDeadline,
          subject,
          payload: { error: message, documentIds: group.documents.map(doc => doc.documentId) },
          status: 'FAILED',
          errorMessage: message,
        }).catch(() => undefined)
      }
    }
  }

  return summary
}
