import {
  Prisma,
  SalesLeadCallResult,
  SalesLeadStage,
  SalesLeadSyncStatus,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getProjectEnv } from '@/lib/project-env'
import { sendSalesLeadEmail } from '@/lib/sales-leads/email-provider'
import {
  changeStage,
  processDueDate,
  recordCallResult,
  SalesLeadWorkflowError,
  startEmail,
  type WorkflowEffect,
  type WorkflowResult,
} from '@/lib/sales-leads/workflow'
import { buildSalesLeadEmailDraft, SalesLeadEmailConfigurationError } from '@/lib/sales-leads/email-provider'

type DbLead = Awaited<ReturnType<typeof getSalesLeadOrThrow>>

function workflowLead(lead: DbLead) {
  return {
    currentStage: lead.currentStage,
    assignedCallerId: lead.assignedCallerId,
    nextActionDate: lead.nextActionDate,
    bookingDateTime: lead.bookingDateTime,
  }
}

export async function getSalesLeadOrThrow(id: string) {
  const lead = await prisma.salesLead.findUnique({ where: { id } })
  if (!lead) throw new SalesLeadWorkflowError('Lead not found.', 'LEAD_NOT_FOUND')
  return lead
}

function jsonPayload(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

async function queueEffect(
  tx: Prisma.TransactionClient,
  lead: DbLead,
  effect: WorkflowEffect,
  payload: Record<string, unknown>,
) {
  if (effect.type === 'SEND_EMAIL') return

  if (effect.type === 'QUEUE_MONDAY_SYNC') {
    if (!lead.mondayItemId || !lead.mondayBoardId) return
    await tx.salesLeadSyncEvent.create({
      data: {
        leadId: lead.id,
        direction: 'OUTBOUND_MONDAY',
        status: 'PENDING',
        payload: jsonPayload(payload),
      },
    })
    return
  }

  const boardId =
    effect.destination === 'NURTURE'
      ? getProjectEnv('SALES_LEAD_NURTURE_BOARD_ID')
      : getProjectEnv('SALES_LEAD_DEALS_BOARD_ID')
  await tx.salesLeadSyncEvent.create({
    data: {
      leadId: lead.id,
      direction: `HANDOFF_${effect.destination}`,
      status: boardId ? 'PENDING' : 'BLOCKED_CONFIGURATION',
      payload: jsonPayload({ ...payload, destinationBoardId: boardId || null }),
      error: boardId ? null : `${effect.destination} board mapping is not configured.`,
    },
  })
}

async function applyResult(lead: DbLead, result: WorkflowResult) {
  return prisma.$transaction(async tx => {
    const updated = await tx.salesLead.update({
      where: { id: lead.id },
      data: {
        ...result.patch,
        ...(result.patch.currentStage && result.patch.currentStage !== lead.currentStage
          ? {
              emailApprovalStatus: 'NONE',
              pendingEmailTemplate: null,
              emailDraftSubject: null,
              emailDraftBody: null,
            }
          : {}),
        syncStatus:
          lead.mondayItemId && lead.mondayBoardId
            ? SalesLeadSyncStatus.PENDING
            : SalesLeadSyncStatus.NOT_LINKED,
      },
    })
    await tx.salesLeadActivity.create({
      data: {
        leadId: lead.id,
        type: result.activityType,
        summary: result.summary,
        metadata: jsonPayload({ patch: result.patch, effects: result.effects }),
      },
    })
    for (const effect of result.effects) {
      await queueEffect(tx, lead, effect, {
        leadId: lead.id,
        currentStage: updated.currentStage,
        updatedAt: updated.updatedAt.toISOString(),
      })
    }
    return updated
  })
}

export async function sendSequenceEmail(id: string, template: 1 | 2, now = new Date()) {
  const lead = await getSalesLeadOrThrow(id)
  const result = startEmail(workflowLead(lead), template, now)
  await sendSalesLeadEmail(lead, template)
  return applyResult(lead, result)
}

export async function requestSalesLeadEmailApproval(id: string, template: 1 | 2) {
  const lead = await getSalesLeadOrThrow(id)
  const expected = template === 1 ? SalesLeadStage.EMAIL_1_DUE : SalesLeadStage.EMAIL_2_DUE
  if (lead.currentStage !== expected) {
    throw new SalesLeadWorkflowError(`Email ${template} can only be prepared from ${expected}.`, 'INVALID_EMAIL_STAGE')
  }
  if (lead.emailApprovalStatus === 'PENDING' && lead.pendingEmailTemplate === template) return lead
  if (!lead.ownerEmail) throw new SalesLeadEmailConfigurationError('The lead does not have an email address.')
  const draft = await buildSalesLeadEmailDraft(lead, template)
  return prisma.$transaction(async tx => {
    const updated = await tx.salesLead.update({
      where: { id },
      data: {
        emailApprovalStatus: 'PENDING',
        pendingEmailTemplate: template,
        emailDraftSubject: draft.subject,
        emailDraftBody: draft.body,
      },
    })
    await tx.salesLeadActivity.create({
      data: { leadId: id, type: 'email_draft_created', summary: `Email ${template} draft is awaiting human approval.` },
    })
    return updated
  })
}

export async function approveSalesLeadEmail(id: string, approvedBy: string) {
  const lead = await getSalesLeadOrThrow(id)
  if (lead.emailApprovalStatus !== 'PENDING' || !lead.pendingEmailTemplate) {
    throw new SalesLeadWorkflowError('Only a pending email draft can be approved.', 'EMAIL_APPROVAL_REQUIRED')
  }
  if (!lead.emailDraftSubject || !lead.emailDraftBody) {
    throw new SalesLeadWorkflowError('The email draft is incomplete.', 'EMAIL_DRAFT_REQUIRED')
  }
  const template = lead.pendingEmailTemplate === 1 ? 1 : 2
  const result = startEmail(workflowLead(lead), template)
  const sent = await sendSalesLeadEmail(lead, template)
  if (!sent.success) throw new SalesLeadWorkflowError(sent.error || 'Email send failed.', 'EMAIL_SEND_FAILED')
  return prisma.$transaction(async tx => {
    const updated = await tx.salesLead.update({
      where: { id },
      data: {
        ...result.patch,
        emailApprovalStatus: 'SENT',
        emailApprovedAt: new Date(),
        emailApprovedBy: approvedBy || 'Admin',
        emailSentAt: new Date(),
        syncStatus: lead.mondayItemId && lead.mondayBoardId ? SalesLeadSyncStatus.PENDING : SalesLeadSyncStatus.NOT_LINKED,
      },
    })
    await tx.salesLeadActivity.create({
      data: { leadId: id, type: `email_${template}_sent`, summary: `Email ${template} sent after human approval.`, metadata: jsonPayload({ approvedBy }) },
    })
    return updated
  })
}

export async function rejectSalesLeadEmail(id: string, rejectedBy: string) {
  const lead = await getSalesLeadOrThrow(id)
  if (lead.emailApprovalStatus !== 'PENDING') {
    throw new SalesLeadWorkflowError('Only a pending email draft can be rejected.', 'EMAIL_APPROVAL_REQUIRED')
  }
  return prisma.$transaction(async tx => {
    const updated = await tx.salesLead.update({ where: { id }, data: { emailApprovalStatus: 'REJECTED' } })
    await tx.salesLeadActivity.create({ data: { leadId: id, type: 'email_draft_rejected', summary: `Email draft rejected by ${rejectedBy || 'Admin'}.` } })
    return updated
  })
}

export async function recordSalesLeadCall(args: {
  id: string
  result: SalesLeadCallResult
  disposition?: SalesLeadStage
  callbackDate?: Date | null
  now?: Date
}) {
  const lead = await getSalesLeadOrThrow(args.id)
  return applyResult(
    lead,
    recordCallResult({
      lead: workflowLead(lead),
      result: args.result,
      disposition: args.disposition,
      callbackDate: args.callbackDate,
      now: args.now,
    }),
  )
}

export async function setSalesLeadStage(args: {
  id: string
  stage: SalesLeadStage
  nextActionDate?: Date | null
  bookingDateTime?: Date | null
  allowRestart?: boolean
}) {
  const lead = await getSalesLeadOrThrow(args.id)
  return applyResult(
    lead,
    changeStage({
      lead: workflowLead(lead),
      stage: args.stage,
      nextActionDate: args.nextActionDate,
      bookingDateTime: args.bookingDateTime,
      allowRestart: args.allowRestart,
    }),
  )
}

export async function processSalesLeadDueDates(now = new Date()) {
  const candidates = await prisma.salesLead.findMany({
    where: {
      currentStage: {
        in: [
          SalesLeadStage.EMAIL_1_DUE,
          SalesLeadStage.EMAIL_1_SENT,
          SalesLeadStage.EMAIL_2_DUE,
          SalesLeadStage.EMAIL_2_SENT,
        ],
      },
      nextActionDate: { lte: now },
    },
    orderBy: { nextActionDate: 'asc' },
  })
  const processed: string[] = []
  const errors: Array<{ leadId: string; message: string }> = []
  for (const lead of candidates) {
    try {
      if (lead.currentStage === SalesLeadStage.EMAIL_1_DUE) {
        await requestSalesLeadEmailApproval(lead.id, 1)
      } else if (lead.currentStage === SalesLeadStage.EMAIL_2_DUE) {
        await requestSalesLeadEmailApproval(lead.id, 2)
      } else {
        const result = processDueDate(workflowLead(lead), now)
        if (!result) continue
        await applyResult(lead, result)
      }
      processed.push(lead.id)
    } catch (error) {
      errors.push({
        leadId: lead.id,
        message: error instanceof Error ? error.message : 'Due action failed.',
      })
    }
  }
  return { examined: candidates.length, processed: processed.length, leadIds: processed, errors }
}

export async function updateSalesLeadFields(
  id: string,
  data: Prisma.SalesLeadUpdateInput,
  summary = 'Lead details updated.',
) {
  const lead = await getSalesLeadOrThrow(id)
  const updated = await prisma.$transaction(async tx => {
    const result = await tx.salesLead.update({ where: { id }, data })
    await tx.salesLeadActivity.create({
      data: {
        leadId: id,
        type: 'details_updated',
        summary,
        metadata: jsonPayload(data),
      },
    })
    if (lead.mondayItemId && lead.mondayBoardId) {
      await tx.salesLeadSyncEvent.create({
        data: {
          leadId: id,
          direction: 'OUTBOUND_MONDAY',
          status: 'PENDING',
          payload: jsonPayload({ leadId: id, updatedAt: result.updatedAt.toISOString() }),
        },
      })
    }
    return result
  })
  return updated
}
