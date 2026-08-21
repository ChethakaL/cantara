import { SalesLeadContactType, SalesLeadStage, SalesLeadSyncStatus } from '@prisma/client'
import {
  createMondayBoardItem,
  getMondayBoardItems,
  updateMondayBoardItem,
} from '@/lib/composio'
import { prisma } from '@/lib/prisma'
import { getProjectEnv } from '@/lib/project-env'
import { getStoredSalesLeadMondaySettings } from '@/lib/secure-settings'
import { CALL_RESULT_LABELS, STAGE_LABELS, SalesLeadWorkflowError } from '@/lib/sales-leads/workflow'
import { matchMondayPersonName, type MatchableCaller } from '@/lib/sales-leads/caller-match'
import {
  recordSalesLeadCall,
  setSalesLeadStage,
  updateSalesLeadFields,
} from '@/lib/sales-leads/service'

export type MondayMapping = Partial<Record<
  | 'businessName' | 'assignedCaller' | 'currentStage' | 'lastCallResult' | 'nextActionDate' | 'stageStartDate' | 'lastContactDate'
  | 'state' | 'city' | 'websiteUrl' | 'googleRating' | 'reviewCount' | 'sqftIndoor'
  | 'sqftOutdoor' | 'sqftCombined' | 'locationType' | 'preCallBriefUrl' | 'ownerFirstName'
  | 'ownerLastName' | 'ownerPhone' | 'sourceLinkPhone' | 'ownerEmail' | 'sourceLinkEmail'
  | 'businessPosition' | 'officePhone'
  | 'bookingDateTime' | 'notes' | 'email1Draft' | 'call1Script' | 'email2Draft' | 'call2Script'
  | 'resortAddress' | 'locationCount' | 'generalEmail' | 'generalPhone',
  string
>>

function parseObject(value: string | undefined) {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function dateValue(value: Date | null, includeTime = false) {
  if (!value) return null
  const iso = value.toISOString()
  return includeTime ? { date: iso.slice(0, 10), time: iso.slice(11, 19) } : { date: iso.slice(0, 10) }
}

function linkValue(value: string | null) {
  return value ? { url: value, text: value } : null
}

function emailValue(value: string | null) {
  return value ? { email: value, text: value } : null
}

function phoneValue(value: string | null) {
  return value ? { phone: value, countryShortName: 'US' } : null
}

function researchReportUrl(leadId: string) {
  const base = getProjectEnv('NEXT_PUBLIC_APP_URL') || getProjectEnv('APP_URL') || ''
  return `${(base || 'https://advisor.cantarapet.com').replace(/\/$/, '')}/research-report/${leadId}`
}

export async function salesLeadMondayConfiguration() {
  const boardIdEnv = getProjectEnv('SALES_LEAD_MONDAY_BOARD_ID') || ''
  const mappingEnv = parseObject(getProjectEnv('SALES_LEAD_MONDAY_COLUMN_MAPPING')) as MondayMapping
  const callerMappingEnv = parseObject(getProjectEnv('SALES_LEAD_MONDAY_CALLER_MAPPING')) as Record<string, string | number>

  if (boardIdEnv && Object.keys(mappingEnv).length > 0) {
    return { boardId: boardIdEnv, mapping: mappingEnv, callerMapping: callerMappingEnv }
  }

  const stored = await getStoredSalesLeadMondaySettings()
  const boardId = boardIdEnv || stored.boardId || ''
  const mapping = Object.keys(mappingEnv).length > 0 ? mappingEnv : stored.columnMapping as MondayMapping
  const callerMapping = Object.keys(callerMappingEnv).length > 0
    ? callerMappingEnv
    : stored.callerMapping as Record<string, string | number>

  return { boardId, mapping, callerMapping }
}

export function mondayColumnValues(
  lead: any,
  mapping: MondayMapping,
  callerMapping: Record<string, string | number>,
) {
  const values: Record<string, unknown> = {}
  const put = (key: keyof MondayMapping, value: unknown) => {
    const columnId = mapping[key]
    if (columnId) values[columnId] = value
  }
  const mondayCallerId = lead.assignedCallerId ? callerMapping[lead.assignedCallerId] : null
  put('assignedCaller', mondayCallerId ? { personsAndTeams: [{ id: Number(mondayCallerId), kind: 'person' }] } : null)
  put('currentStage', { label: STAGE_LABELS[lead.currentStage as SalesLeadStage] })
  put('lastCallResult', lead.lastCallResult ? { label: CALL_RESULT_LABELS[lead.lastCallResult] } : null)
  put('nextActionDate', dateValue(lead.nextActionDate))
  put('stageStartDate', dateValue(lead.stageStartDate))
  put('lastContactDate', dateValue(lead.lastContactDate))
  put('state', lead.state || null)
  put('city', lead.city || null)
  put('websiteUrl', linkValue(lead.websiteUrl))
  put('googleRating', lead.googleRating)
  put('reviewCount', lead.reviewCount)
  put('sqftIndoor', lead.sqftIndoor)
  put('sqftOutdoor', lead.sqftOutdoor)
  put('sqftCombined', lead.sqftCombined)
  put('locationType', lead.locationType ? { label: lead.locationType } : null)
  const savedBriefUrl = lead.preCallBriefUrl && /^https?:\/\//i.test(lead.preCallBriefUrl)
    ? lead.preCallBriefUrl
    : lead.aiResearchReport ? researchReportUrl(lead.id) : null
  put('preCallBriefUrl', linkValue(savedBriefUrl))
  put('ownerFirstName', lead.ownerFirstName || null)
  put('ownerLastName', lead.ownerLastName || null)
  put('ownerPhone', phoneValue(lead.ownerPhone))
  put('businessPosition', lead.businessPosition || null)
  put('officePhone', phoneValue(lead.officePhone))
  put('sourceLinkPhone', linkValue(lead.sourceLinkPhone))
  put('ownerEmail', emailValue(lead.ownerEmail))
  put('sourceLinkEmail', linkValue(lead.sourceLinkEmail))
  put('bookingDateTime', dateValue(lead.bookingDateTime, true))
  put('notes', lead.notes || null)
  const email1Draft = lead.emailDraftSubject && lead.emailDraftBody
    ? `Subject: ${lead.emailDraftSubject}\n\n${lead.emailDraftBody}`
    : null
  // Monday long_text columns require an object payload, not a bare string.
  put('email1Draft', email1Draft ? { text: email1Draft } : null)
  put('call1Script', lead.call1Script ? { text: lead.call1Script } : null)
  put('email2Draft', lead.email2Draft ? { text: lead.email2Draft } : null)
  put('call2Script', lead.call2Script ? { text: lead.call2Script } : null)
  put('resortAddress', lead.resortAddress || null)
  put('locationCount', lead.locationCount || null)
  put('generalEmail', emailValue(lead.generalEmail || lead.ownerEmail || null))
  put('generalPhone', phoneValue(lead.generalPhone || lead.ownerPhone || null))
  return values
}

/** In-process mutex so concurrent outbox/webhook workers cannot create twice for one lead. */
const leadSyncGates = new Map<string, Promise<unknown>>()

async function withLeadSyncGate<T>(leadId: string, fn: () => Promise<T>): Promise<T> {
  const previous = leadSyncGates.get(leadId) ?? Promise.resolve()
  let release!: () => void
  const gate = new Promise<void>(resolve => {
    release = resolve
  })
  const chained = previous.catch(() => undefined).then(() => gate)
  leadSyncGates.set(leadId, chained)
  await previous.catch(() => undefined)
  try {
    return await fn()
  } finally {
    release()
    if (leadSyncGates.get(leadId) === chained) leadSyncGates.delete(leadId)
  }
}

async function findMondayItemIdByBusinessName(boardId: string, businessName: string) {
  const needle = businessName.trim().toLowerCase()
  if (!needle) return null
  const items = await getMondayBoardItems(boardId)
  const match = items.find(item => item.name.trim().toLowerCase() === needle)
  return match?.id ? String(match.id) : null
}

export async function syncSalesLeadToMonday(leadId: string) {
  // Do NOT wrap Monday HTTP calls in a Prisma interactive transaction. The prior
  // advisory-lock transaction timed out (30s) after create_item succeeded, so
  // mondayItemId never saved and retries created duplicate Monday rows.
  return withLeadSyncGate(leadId, async () => {
    const lead = await prisma.salesLead.findUnique({ where: { id: leadId } })
    if (!lead) throw new Error('Sales lead not found.')
    const config = await salesLeadMondayConfiguration()
    const boardId = lead.mondayBoardId || config.boardId
    if (!boardId || Object.keys(config.mapping).length === 0) {
      throw new Error('Sales Lead Monday board and column mapping are not configured.')
    }
    const columnValues = mondayColumnValues(lead, config.mapping, config.callerMapping)

    let itemId = lead.mondayItemId
    if (itemId) {
      await updateMondayBoardItem({ boardId, itemId, columnValues })
    } else {
      // Re-link an existing Monday row by exact name before creating (recovers
      // from earlier creates whose DB link-back failed).
      itemId = await findMondayItemIdByBusinessName(boardId, lead.businessName)
      if (itemId) {
        await updateMondayBoardItem({ boardId, itemId, columnValues })
      } else {
        itemId = await createMondayBoardItem({
          boardId,
          itemName: lead.businessName,
          columnValues,
        })
      }
    }

    return prisma.salesLead.update({
      where: { id: lead.id },
      data: {
        mondayBoardId: boardId,
        mondayItemId: itemId,
        mondayLastSyncedAt: new Date(),
        syncStatus: SalesLeadSyncStatus.SYNCED,
      },
    })
  })
}

/**
 * Backfill records created before Monday sync was configured. Existing items
 * are matched by exact business name first so retries cannot create duplicates.
 */
async function backfillUnlinkedSalesLeads() {
  const config = await salesLeadMondayConfiguration()
  if (!config.boardId || Object.keys(config.mapping).length === 0) return { linked: 0, queued: 0 }

  const unlinked = await prisma.salesLead.findMany({
    where: { OR: [{ mondayItemId: null }, { mondayBoardId: null }] },
    select: { id: true, businessName: true, mondayItemId: true, mondayBoardId: true },
  })
  if (!unlinked.length) return { linked: 0, queued: 0 }

  const mondayItems = await getMondayBoardItems(config.boardId)
  const itemByName = new Map(mondayItems.map(item => [item.name.trim().toLowerCase(), item]))
  let linked = 0
  let queued = 0

  for (const lead of unlinked) {
    const existing = itemByName.get(lead.businessName.trim().toLowerCase())
    if (existing?.id) {
      await prisma.salesLead.update({
        where: { id: lead.id },
        data: {
          mondayBoardId: config.boardId,
          mondayItemId: existing.id,
          syncStatus: SalesLeadSyncStatus.PENDING,
        },
      })
      linked += 1
      continue
    }

    const existingEvent = await prisma.salesLeadSyncEvent.findFirst({
      where: { leadId: lead.id, direction: 'OUTBOUND_MONDAY' },
      select: { id: true },
    })
    if (!existingEvent) {
      await prisma.salesLeadSyncEvent.create({
        data: {
          leadId: lead.id,
          direction: 'OUTBOUND_MONDAY',
          status: 'PENDING',
          payload: { reason: 'configured_board_backfill' },
        },
      })
      queued += 1
    }
  }
  return { linked, queued }
}

export async function processSalesLeadSyncOutbox(limit = 50) {
  const backfill = await backfillUnlinkedSalesLeads()

  // Recover leads stuck PENDING after stage changes that never queued an outbox row
  // (e.g. older email-approve path) so Monday Sync / cron can push Cantara → Monday.
  const stuckPending = await prisma.salesLead.findMany({
    where: {
      syncStatus: SalesLeadSyncStatus.PENDING,
      mondayItemId: { not: null },
      mondayBoardId: { not: null },
    },
    select: { id: true },
    take: limit,
  })
  for (const lead of stuckPending) {
    const existing = await prisma.salesLeadSyncEvent.findFirst({
      where: { leadId: lead.id, direction: 'OUTBOUND_MONDAY', status: { in: ['PENDING', 'ERROR'] } },
      select: { id: true },
    })
    if (!existing) {
      await prisma.salesLeadSyncEvent.create({
        data: {
          leadId: lead.id,
          direction: 'OUTBOUND_MONDAY',
          status: 'PENDING',
          payload: { reason: 'pending_sync_status_recovery' },
        },
      })
    }
  }

  const events = await prisma.salesLeadSyncEvent.findMany({
    // Allow more retries so leads stuck after the transaction-timeout bug can recover.
    where: { status: { in: ['PENDING', 'ERROR'] }, direction: 'OUTBOUND_MONDAY', attempts: { lt: 25 } },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })
  let succeeded = 0
  let failed = 0
  for (const event of events) {
    try {
      await syncSalesLeadToMonday(event.leadId)
      await prisma.salesLeadSyncEvent.update({
        where: { id: event.id },
        data: { status: 'COMPLETE', processedAt: new Date(), attempts: { increment: 1 }, error: null },
      })
      succeeded += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Monday sync failed.'
      await prisma.$transaction([
        prisma.salesLeadSyncEvent.update({
          where: { id: event.id },
          data: { status: 'ERROR', attempts: { increment: 1 }, error: message },
        }),
        prisma.salesLead.update({
          where: { id: event.leadId },
          data: { syncStatus: SalesLeadSyncStatus.ERROR },
        }),
      ])
      failed += 1
    }
  }
  return { examined: events.length, succeeded, failed, backfill, recoveredPending: stuckPending.length }
}

export async function processSalesLeadHandoffOutbox(limit = 25) {
  const events = await prisma.salesLeadSyncEvent.findMany({
    where: {
      status: { in: ['PENDING', 'BLOCKED_CONFIGURATION', 'ERROR'] },
      direction: { in: ['HANDOFF_NURTURE', 'HANDOFF_DEALS_CRM'] },
      attempts: { lt: 5 },
    },
    include: { lead: true },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })
  const callerMapping = parseObject(getProjectEnv('SALES_LEAD_MONDAY_CALLER_MAPPING')) as Record<string, string | number>
  let succeeded = 0
  let blocked = 0
  let failed = 0

  for (const event of events) {
    const nurture = event.direction === 'HANDOFF_NURTURE'
    const boardId = getProjectEnv(nurture ? 'SALES_LEAD_NURTURE_BOARD_ID' : 'SALES_LEAD_DEALS_BOARD_ID')
    const mapping = parseObject(
      getProjectEnv(nurture ? 'SALES_LEAD_NURTURE_COLUMN_MAPPING' : 'SALES_LEAD_DEALS_COLUMN_MAPPING'),
    ) as MondayMapping
    if (!boardId || Object.keys(mapping).length === 0) {
      await prisma.salesLeadSyncEvent.update({
        where: { id: event.id },
        data: {
          status: 'BLOCKED_CONFIGURATION',
          error: `${nurture ? 'Nurture' : 'Deals/CRM'} board mapping is not configured.`,
        },
      })
      blocked += 1
      continue
    }
    try {
      const destinationItemId = await createMondayBoardItem({
        boardId,
        itemName: event.lead.businessName,
        columnValues: mondayColumnValues(event.lead, mapping, callerMapping),
      })
      await prisma.salesLeadSyncEvent.update({
        where: { id: event.id },
        data: {
          status: 'COMPLETE',
          processedAt: new Date(),
          attempts: { increment: 1 },
          error: null,
          payload: { destinationBoardId: boardId, destinationItemId },
        },
      })
      succeeded += 1
    } catch (error) {
      await prisma.salesLeadSyncEvent.update({
        where: { id: event.id },
        data: {
          status: 'ERROR',
          attempts: { increment: 1 },
          error: error instanceof Error ? error.message : 'Handoff failed.',
        },
      })
      failed += 1
    }
  }
  return { examined: events.length, succeeded, blocked, failed }
}

function columnById(item: any, columnId: string | undefined) {
  if (!columnId) return null
  return (item.columnValues || []).find((column: any) => column.id === columnId) || null
}

function columnText(item: any, columnId: string | undefined) {
  return String(columnById(item, columnId)?.text || '').trim()
}

function columnDate(item: any, columnId: string | undefined) {
  const column = columnById(item, columnId)
  if (!column) return null
  try {
    const value = typeof column.value === 'string' ? JSON.parse(column.value) : column.value
    const date = value?.date ? `${value.date}${value.time ? `T${value.time}` : 'T12:00:00'}` : column.text
    const parsed = date ? new Date(date) : null
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null
  } catch {
    const parsed = column.text ? new Date(column.text) : null
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null
  }
}

function columnPersonId(item: any, columnId: string | undefined) {
  const column = columnById(item, columnId)
  if (!column?.value) return null
  try {
    const value = typeof column.value === 'string' ? JSON.parse(column.value) : column.value
    return String(value?.personsAndTeams?.[0]?.id || value?.personsAndTeamsIds?.[0] || '') || null
  } catch {
    return null
  }
}

const stageByLabel = Object.fromEntries(
  Object.entries(STAGE_LABELS).map(([stage, label]) => [label.toLowerCase(), stage]),
) as Record<string, SalesLeadStage>
const callResultByLabel = Object.fromEntries(
  Object.entries(CALL_RESULT_LABELS).map(([result, label]) => [label.toLowerCase(), result]),
) as Record<string, any>

function columnNumber(item: any, columnId: string | undefined) {
  const text = columnText(item, columnId).replace(/,/g, '')
  if (!text) return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

function resolveAssignedCallerId(
  item: any,
  mapping: MondayMapping,
  callerByMondayId: Map<string, string>,
  callers: MatchableCaller[],
) {
  const mondayPersonId = columnPersonId(item, mapping.assignedCaller)
  const fromIdMap = mondayPersonId ? callerByMondayId.get(mondayPersonId) || null : null
  const assignedText = columnText(item, mapping.assignedCaller)
  const fromName = matchMondayPersonName(assignedText, callers)

  if (fromIdMap || fromName) {
    console.log('[sales-leads] Assigned lead from Monday', {
      item: item.name,
      assignedText: assignedText || null,
      mondayPersonId,
      matchedBy: fromIdMap ? 'callerMapping' : 'name',
      matchedUserId: fromIdMap || fromName?.id || null,
      matchedUserName: fromIdMap
        ? callers.find(caller => caller.id === fromIdMap)?.name || fromIdMap
        : fromName?.name || null,
    })
  } else if (assignedText || mondayPersonId) {
    console.warn('[sales-leads] Assigned lead on Monday did not match a Cantara admin', {
      item: item.name,
      assignedText: assignedText || null,
      mondayPersonId,
    })
  }

  return fromIdMap || fromName?.id || null
}

function fieldsFromMondayItem(
  item: any,
  mapping: MondayMapping,
  callerByMondayId: Map<string, string>,
  callers: MatchableCaller[],
) {
  const ownerEmail = columnText(item, mapping.ownerEmail)
  const generalEmail = columnText(item, mapping.generalEmail)
  const ownerPhone = columnText(item, mapping.ownerPhone)
  const generalPhone = columnText(item, mapping.generalPhone)
  const businessPosition = columnText(item, mapping.businessPosition)
  const officePhone = columnText(item, mapping.officePhone)
  const assignedCallerId = resolveAssignedCallerId(item, mapping, callerByMondayId, callers)
  const stage = stageByLabel[columnText(item, mapping.currentStage).toLowerCase()] || SalesLeadStage.NEW

  return {
    assignedCallerId,
    currentStage: stage,
    nextActionDate: columnDate(item, mapping.nextActionDate),
    stageStartDate: columnDate(item, mapping.stageStartDate),
    lastContactDate: columnDate(item, mapping.lastContactDate),
    bookingDateTime: columnDate(item, mapping.bookingDateTime),
    state: columnText(item, mapping.state) || null,
    city: columnText(item, mapping.city) || null,
    websiteUrl: columnText(item, mapping.websiteUrl) || null,
    googleRating: columnNumber(item, mapping.googleRating),
    reviewCount: columnNumber(item, mapping.reviewCount) != null ? Math.round(columnNumber(item, mapping.reviewCount)!) : null,
    sqftIndoor: columnNumber(item, mapping.sqftIndoor) != null ? Math.round(columnNumber(item, mapping.sqftIndoor)!) : null,
    sqftOutdoor: columnNumber(item, mapping.sqftOutdoor) != null ? Math.round(columnNumber(item, mapping.sqftOutdoor)!) : null,
    sqftCombined: columnNumber(item, mapping.sqftCombined) != null ? Math.round(columnNumber(item, mapping.sqftCombined)!) : null,
    locationType: columnText(item, mapping.locationType) || null,
    preCallBriefUrl: columnText(item, mapping.preCallBriefUrl) || null,
    ownerFirstName: columnText(item, mapping.ownerFirstName) || null,
    ownerLastName: columnText(item, mapping.ownerLastName) || null,
    ownerPhone: ownerPhone || generalPhone || null,
    businessPosition: businessPosition || null,
    officePhone: officePhone || null,
    phoneType: ownerPhone ? SalesLeadContactType.DIRECT : SalesLeadContactType.GENERAL,
    sourceLinkPhone: columnText(item, mapping.sourceLinkPhone) || null,
    ownerEmail: ownerEmail || generalEmail || null,
    emailType: ownerEmail ? SalesLeadContactType.DIRECT : SalesLeadContactType.GENERAL,
    sourceLinkEmail: columnText(item, mapping.sourceLinkEmail) || null,
    notes: columnText(item, mapping.notes) || null,
  }
}

async function createLeadFromMondayItem(args: {
  item: any
  boardId: string
  mapping: MondayMapping
  callerByMondayId: Map<string, string>
  callers: MatchableCaller[]
}) {
  const businessName = String(args.item.name || '').trim()
  const mondayItemId = String(args.item.id)
  const fields = fieldsFromMondayItem(args.item, args.mapping, args.callerByMondayId, args.callers)

  const created = await prisma.salesLead.create({
    data: {
      businessName,
      mondayBoardId: args.boardId,
      mondayItemId,
      mondayLastSyncedAt: new Date(),
      syncStatus: SalesLeadSyncStatus.SYNCED,
      ...fields,
    },
  })
  await prisma.salesLeadActivity.create({
    data: {
      leadId: created.id,
      type: 'created',
      summary: 'Lead imported from Monday.com.',
    },
  })
  await prisma.salesLeadSyncEvent.create({
    data: {
      leadId: created.id,
      direction: 'INBOUND_MONDAY',
      status: 'COMPLETE',
      payload: { itemId: mondayItemId, reason: 'created_from_monday' },
      processedAt: new Date(),
    },
  })
  return created
}

export async function reconcileSalesLeadsFromMonday(itemId?: string) {
  const config = await salesLeadMondayConfiguration()
  if (!config.boardId || Object.keys(config.mapping).length === 0) {
    throw new Error('Sales Lead Monday board and column mapping are not configured.')
  }
  const items = (await getMondayBoardItems(config.boardId)).filter(item => !itemId || String(item.id) === String(itemId))
  const itemIds = items.map(item => String(item.id))
  const leads = await prisma.salesLead.findMany({
    where: {
      OR: [
        { mondayItemId: { in: itemIds } },
        { mondayBoardId: config.boardId },
        { mondayItemId: null },
      ],
    },
  })
  const leadByItemId = new Map(leads.filter(lead => lead.mondayItemId).map(lead => [lead.mondayItemId as string, lead]))
  const leadByName = new Map(leads.map(lead => [lead.businessName.trim().toLowerCase(), lead]))
  const callerByMondayId = new Map(
    Object.entries(config.callerMapping).map(([userId, mondayId]) => [String(mondayId), userId]),
  )
  const callers = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, name: true, email: true },
  })
  let updated = 0
  let created = 0
  const createdNames: string[] = []
  const errors: Array<{ itemId: string; message: string }> = []

  for (const item of items) {
    const mondayItemId = String(item.id)
    const businessName = String(item.name || '').trim()
    if (!businessName) {
      errors.push({ itemId: mondayItemId, message: 'Skipped: Monday item has no business name.' })
      continue
    }

    let lead = leadByItemId.get(mondayItemId)
    if (!lead) {
      const named = leadByName.get(businessName.toLowerCase())
      if (named && !named.mondayItemId) {
        lead = await prisma.salesLead.update({
          where: { id: named.id },
          data: { mondayItemId, mondayBoardId: config.boardId },
        })
        leadByItemId.set(mondayItemId, lead)
      } else if (named && named.mondayItemId && named.mondayItemId !== mondayItemId) {
        errors.push({
          itemId: mondayItemId,
          message: `Skipped import: "${businessName}" already exists as another lead.`,
        })
        continue
      } else {
        try {
          lead = await createLeadFromMondayItem({
            item,
            boardId: config.boardId,
            mapping: config.mapping,
            callerByMondayId,
            callers,
          })
          created += 1
          createdNames.push(businessName)
          leadByItemId.set(mondayItemId, lead)
          leadByName.set(businessName.toLowerCase(), lead)
          continue
        } catch (error: any) {
          if (error?.code === 'P2002') {
            lead = await prisma.salesLead.findUnique({ where: { mondayItemId } })
            if (!lead) {
              errors.push({
                itemId: mondayItemId,
                message: error instanceof Error ? error.message : 'Failed to import Monday item.',
              })
              continue
            }
          } else {
            errors.push({
              itemId: mondayItemId,
              message: error instanceof Error ? error.message : 'Failed to import Monday item.',
            })
            continue
          }
        }
      }
    }

    if (!lead) continue

    try {
      const stage = stageByLabel[columnText(item, config.mapping.currentStage).toLowerCase()]
      const callResult = callResultByLabel[columnText(item, config.mapping.lastCallResult).toLowerCase()]
      const nextActionDate = columnDate(item, config.mapping.nextActionDate)
      const stageStartDate = columnDate(item, config.mapping.stageStartDate)
      const bookingDateTime = columnDate(item, config.mapping.bookingDateTime)

      if (
        callResult &&
        callResult !== lead.lastCallResult &&
        (lead.currentStage === SalesLeadStage.CALL_1_DUE ||
          lead.currentStage === SalesLeadStage.CALL_2_DUE)
      ) {
        await recordSalesLeadCall({
          id: lead.id,
          result: callResult,
          disposition: stage && stage !== lead.currentStage ? stage : undefined,
          callbackDate: nextActionDate,
        })
      } else if (stage && stage !== lead.currentStage) {
        try {
          await setSalesLeadStage({
            id: lead.id,
            stage,
            nextActionDate,
            bookingDateTime,
          })
        } catch (error) {
          // Cantara owns sequence stages. If Monday is behind (or has a stage Cantara
          // cannot accept), keep Cantara's stage and push it back to Monday.
          const isAutomationOwned =
            error instanceof SalesLeadWorkflowError && error.code === 'AUTOMATION_OWNED_TRANSITION'
          if (!isAutomationOwned) throw error
          await prisma.salesLeadSyncEvent.create({
            data: {
              leadId: lead.id,
              direction: 'OUTBOUND_MONDAY',
              status: 'PENDING',
              payload: {
                reason: 'cantara_stage_ahead_of_monday',
                mondayStage: stage,
                cantaraStage: lead.currentStage,
              },
            },
          })
        }
      }

      const manualFields: any = {}
      const assignedCallerId = resolveAssignedCallerId(item, config.mapping, callerByMondayId, callers)
      if (assignedCallerId && assignedCallerId !== lead.assignedCallerId) {
        manualFields.assignedCallerId = assignedCallerId
      }
      if ((stageStartDate?.getTime() || null) !== (lead.stageStartDate?.getTime() || null)) {
        manualFields.stageStartDate = stageStartDate
      }
      const notes = columnText(item, config.mapping.notes)
      if (notes !== (lead.notes || '')) manualFields.notes = notes || null
      const businessPosition = columnText(item, config.mapping.businessPosition)
      const officePhone = columnText(item, config.mapping.officePhone)
      if (businessPosition !== (lead.businessPosition || '')) {
        manualFields.businessPosition = businessPosition || null
      }
      if (officePhone !== (lead.officePhone || '')) {
        manualFields.officePhone = officePhone || null
      }
      if (Object.keys(manualFields).length) {
        await updateSalesLeadFields(lead.id, manualFields, 'Lead details updated from Monday.')
      }
      await prisma.$transaction([
        prisma.salesLead.update({
          where: { id: lead.id },
          data: { mondayLastSyncedAt: new Date(), syncStatus: SalesLeadSyncStatus.SYNCED },
        }),
        prisma.salesLeadSyncEvent.create({
          data: {
            leadId: lead.id,
            direction: 'INBOUND_MONDAY',
            status: 'COMPLETE',
            payload: { itemId: mondayItemId },
            processedAt: new Date(),
          },
        }),
      ])
      updated += 1
    } catch (error) {
      errors.push({
        itemId: mondayItemId,
        message: error instanceof Error ? error.message : 'Inbound reconciliation failed.',
      })
    }
  }

  if (createdNames.length) {
    console.log('[sales-leads] Imported unmatched Monday items:', createdNames.join(', '))
  }
  if (errors.length) {
    console.warn('[sales-leads] Monday inbound errors:', errors)
  }

  return { examined: items.length, matched: leadByItemId.size, updated, created, createdNames, errors }
}
