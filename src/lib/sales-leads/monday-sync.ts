import { SalesLeadStage, SalesLeadSyncStatus } from '@prisma/client'
import {
  createMondayBoardItem,
  getMondayBoardItems,
  updateMondayBoardItem,
} from '@/lib/composio'
import { prisma } from '@/lib/prisma'
import { getProjectEnv } from '@/lib/project-env'
import { getStoredSalesLeadMondaySettings } from '@/lib/secure-settings'
import { CALL_RESULT_LABELS, STAGE_LABELS } from '@/lib/sales-leads/workflow'
import {
  recordSalesLeadCall,
  setSalesLeadStage,
  updateSalesLeadFields,
} from '@/lib/sales-leads/service'

export type MondayMapping = Partial<Record<
  | 'assignedCaller' | 'currentStage' | 'lastCallResult' | 'nextActionDate' | 'lastContactDate'
  | 'state' | 'city' | 'websiteUrl' | 'googleRating' | 'reviewCount' | 'sqftIndoor'
  | 'sqftOutdoor' | 'sqftCombined' | 'locationType' | 'preCallBriefUrl' | 'ownerFirstName'
  | 'ownerLastName' | 'ownerPhone' | 'sourceLinkPhone' | 'ownerEmail' | 'sourceLinkEmail'
  | 'bookingDateTime' | 'notes',
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
  put('lastContactDate', dateValue(lead.lastContactDate))
  put('state', lead.state || null)
  put('city', lead.city || null)
  put('websiteUrl', linkValue(lead.websiteUrl))
  put('googleRating', lead.googleRating)
  put('reviewCount', lead.reviewCount)
  put('sqftIndoor', lead.sqftIndoor)
  put('sqftOutdoor', lead.sqftOutdoor)
  put('sqftCombined', lead.sqftCombined)
  put('locationType', lead.locationType || null)
  put('preCallBriefUrl', linkValue(lead.preCallBriefUrl))
  put('ownerFirstName', lead.ownerFirstName || null)
  put('ownerLastName', lead.ownerLastName || null)
  put('ownerPhone', lead.ownerPhone || null)
  put('sourceLinkPhone', linkValue(lead.sourceLinkPhone))
  put('ownerEmail', lead.ownerEmail || null)
  put('sourceLinkEmail', linkValue(lead.sourceLinkEmail))
  put('bookingDateTime', dateValue(lead.bookingDateTime, true))
  put('notes', lead.notes || null)
  return values
}

export async function syncSalesLeadToMonday(leadId: string) {
  const lead = await prisma.salesLead.findUnique({ where: { id: leadId } })
  if (!lead) throw new Error('Sales lead not found.')
  const config = await salesLeadMondayConfiguration()
  const boardId = lead.mondayBoardId || config.boardId
  if (!boardId || Object.keys(config.mapping).length === 0) {
    throw new Error('Sales Lead Monday board and column mapping are not configured.')
  }
  const columnValues = mondayColumnValues(lead, config.mapping, config.callerMapping)
  const itemId = lead.mondayItemId
    ? (await updateMondayBoardItem({ boardId, itemId: lead.mondayItemId, columnValues }), lead.mondayItemId)
    : await createMondayBoardItem({ boardId, itemName: lead.businessName, columnValues })
  return prisma.salesLead.update({
    where: { id: lead.id },
    data: {
      mondayBoardId: boardId,
      mondayItemId: itemId,
      mondayLastSyncedAt: new Date(),
      syncStatus: SalesLeadSyncStatus.SYNCED,
    },
  })
}

export async function processSalesLeadSyncOutbox(limit = 50) {
  const events = await prisma.salesLeadSyncEvent.findMany({
    where: { status: { in: ['PENDING', 'ERROR'] }, direction: 'OUTBOUND_MONDAY', attempts: { lt: 5 } },
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
  return { examined: events.length, succeeded, failed }
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

export async function reconcileSalesLeadsFromMonday(itemId?: string) {
  const config = await salesLeadMondayConfiguration()
  if (!config.boardId || Object.keys(config.mapping).length === 0) {
    throw new Error('Sales Lead Monday board and column mapping are not configured.')
  }
  const items = (await getMondayBoardItems(config.boardId)).filter(item => !itemId || item.id === itemId)
  const leads = await prisma.salesLead.findMany({
    where: { mondayBoardId: config.boardId, mondayItemId: { in: items.map(item => item.id) } },
  })
  const leadByItemId = new Map(leads.map(lead => [lead.mondayItemId, lead]))
  const callerByMondayId = new Map(
    Object.entries(config.callerMapping).map(([userId, mondayId]) => [String(mondayId), userId]),
  )
  let updated = 0
  const errors: Array<{ itemId: string; message: string }> = []

  for (const item of items) {
    const lead = leadByItemId.get(item.id)
    if (!lead) continue
    try {
      const stage = stageByLabel[columnText(item, config.mapping.currentStage).toLowerCase()]
      const callResult = callResultByLabel[columnText(item, config.mapping.lastCallResult).toLowerCase()]
      const nextActionDate = columnDate(item, config.mapping.nextActionDate)
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
        await setSalesLeadStage({
          id: lead.id,
          stage,
          nextActionDate,
          bookingDateTime,
        })
      }

      const manualFields: any = {}
      const mondayPersonId = columnPersonId(item, config.mapping.assignedCaller)
      const assignedCallerId = mondayPersonId ? callerByMondayId.get(mondayPersonId) : undefined
      if (assignedCallerId && assignedCallerId !== lead.assignedCallerId) {
        manualFields.assignedCallerId = assignedCallerId
      }
      const notes = columnText(item, config.mapping.notes)
      if (notes !== (lead.notes || '')) manualFields.notes = notes || null
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
            payload: { itemId: item.id },
            processedAt: new Date(),
          },
        }),
      ])
      updated += 1
    } catch (error) {
      errors.push({
        itemId: item.id,
        message: error instanceof Error ? error.message : 'Inbound reconciliation failed.',
      })
    }
  }
  return { examined: items.length, matched: leads.length, updated, errors }
}
