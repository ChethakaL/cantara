import { executeDocuSignTool, getDocuSignConnection } from '@/lib/composio/docusign'
import { getNdaSendConfig } from '@/lib/automations/nda/config'
import {
  columnTextByTitle,
  createMondayUpdateGate,
  loadMondayDealItem,
  resolveColumnId,
} from '@/lib/automations/monday-deal'
import {
  extractEnvelopeIdFromToolResult,
  formatDocuSignToolError,
  resolveDocuSignAccountId,
} from '@/lib/automations/docusign/account'
import { registerBuyerNdaPending } from '@/lib/automations/nda/pending-store'

export type NdaSendResult = {
  ok: boolean
  dryRun: boolean
  skipped?: boolean
  reason?: string
  itemId: string
  boardId: string
  deal?: {
    name: string
    clientEmail: string | null
    clientFullName: string | null
    clientRole: string | null
    clientType: string | null
    contractStatus: string | null
    ndaStatus: string | null
  }
  templateId?: string | null
  envelopeId?: string | null
  validation?: {
    hasEmail: boolean
    hasFullName: boolean
    hasClientType: boolean
    hasContractSigned: boolean
  }
  mondayUpdates?: string[]
  docusignPayload?: Record<string, unknown>
  error?: string
}

function isContractSigned(contractStatus: string | null) {
  const s = (contractStatus || '').toLowerCase()
  return s.includes('signed') && !s.includes('unsigned')
}

function isNdaTerminal(ndaStatus: string | null) {
  const s = (ndaStatus || '').toLowerCase()
  return (
    s.includes('awaiting') ||
    s.includes('signed') ||
    s.includes('complete') ||
    s.includes('cancelled') ||
    s.includes('canceled')
  )
}

/**
 * Port of Make: When NDA Status → Send NDA → send mutual DocuSign NDA.
 * Defaults to dry-run (no live DocuSign / Monday writes) until env flags are flipped.
 *
 * Make also GETs template recipient tabs before send
 * (`.../templates/{id}/recipients/{recipientId}/tabs`); tab prefill can be added later.
 */
export async function runNdaSendAutomation(args: {
  itemId: string
  forceLive?: boolean
}): Promise<NdaSendResult> {
  const config = getNdaSendConfig()
  const dryRun = args.forceLive ? false : config.dryRun
  const itemId = String(args.itemId || '').trim()
  if (!itemId) {
    return { ok: false, dryRun, itemId: '', boardId: config.boardId, error: 'Missing Monday item id (event.pulseId)' }
  }

  const loaded = await loadMondayDealItem(config.boardId, itemId)
  if (!loaded) {
    return {
      ok: false,
      dryRun,
      itemId,
      boardId: config.boardId,
      error: 'Monday item not found (check Monday Composio connection + item id)',
    }
  }

  const { item, boardColumns, columnValues } = loaded
  const deal = {
    name: item.name,
    clientEmail: columnTextByTitle(columnValues, ['client email', 'email']),
    clientFullName: columnTextByTitle(columnValues, ['client fullname', 'client full name', 'full name']),
    clientRole: columnTextByTitle(columnValues, ['client role', 'role']),
    clientType: columnTextByTitle(columnValues, ['client type', 'clienttype']),
    contractStatus: columnTextByTitle(columnValues, ['contract status']),
    ndaStatus: columnTextByTitle(columnValues, ['nda status']),
  }

  const validation = {
    hasEmail: Boolean(deal.clientEmail),
    hasFullName: Boolean(deal.clientFullName),
    hasClientType: Boolean(deal.clientType),
    hasContractSigned: isContractSigned(deal.contractStatus),
  }

  const base: NdaSendResult = {
    ok: true,
    dryRun,
    itemId,
    boardId: config.boardId,
    deal,
    templateId: config.templateId,
    validation,
    mondayUpdates: [],
  }

  if (isNdaTerminal(deal.ndaStatus)) {
    return {
      ...base,
      skipped: true,
      reason: `NDA already terminal or in progress (${deal.ndaStatus})`,
    }
  }

  const statusColId = resolveColumnId(boardColumns, config.columns.ndaStatus, ['nda status'])
  const envelopeColId = resolveColumnId(boardColumns, config.columns.envelopeId, [
    'nda envelope id',
    'nda envelope',
    'envelope id',
  ])
  const updatesColId = resolveColumnId(boardColumns, config.columns.updates, [
    'updates',
    'update',
    'error',
  ])
  const ndaFileColId = resolveColumnId(boardColumns, null, [
    'nda file',
    'prospective nda',
    'nda document',
  ])

  const mondayUpdates: string[] = []
  const maybeUpdateMonday = createMondayUpdateGate({
    boardId: config.boardId,
    itemId,
    dryRun,
    updateMonday: config.updateMonday,
    updateMondayEnvKey: 'AUTOMATIONS_NDA_SEND_UPDATE_MONDAY',
    log: mondayUpdates,
  })

  const markError = async (message: string) => {
    if (updatesColId) {
      await maybeUpdateMonday({ [updatesColId]: message }, `Error update → ${message}`)
    } else {
      mondayUpdates.push(`warn: Updates column not resolved; error was: ${message}`)
    }
    if (statusColId) {
      await maybeUpdateMonday(
        { [statusColId]: { label: config.statusLabels.error } },
        `NDA Status → ${config.statusLabels.error}`
      )
    }
  }

  if (!validation.hasEmail || !validation.hasFullName || !validation.hasClientType || !validation.hasContractSigned) {
    const missing: string[] = []
    if (!validation.hasEmail) missing.push('Client Email')
    if (!validation.hasFullName) missing.push('Client Full Name')
    if (!validation.hasClientType) missing.push('Client Type')
    if (!validation.hasContractSigned) missing.push('Contract Signed')
    const message = `Incomplete NDA prerequisites: missing ${missing.join(', ')}`
    await markError(message)
    base.mondayUpdates = mondayUpdates
    return { ...base, ok: false, skipped: true, reason: message }
  }

  const emailSubject = `${deal.name} - NDA`
  const emailBlurb = 'We sent you the document with the NDA for you to sign.'
  const templateRoles = [
    {
      email: config.craig.email,
      name: config.craig.name,
      roleName: config.craig.roleName,
      routingOrder: '1',
    },
    {
      email: deal.clientEmail!,
      name: deal.clientFullName!,
      roleName: deal.clientRole || 'Client',
      routingOrder: '2',
    },
  ]

  const docusignPayload = {
    status: 'sent',
    account_id: undefined as string | undefined,
    template_id: config.templateId,
    email_subject: emailSubject,
    email_blurb: emailBlurb,
    template_roles: templateRoles,
  }
  base.docusignPayload = docusignPayload

  if (statusColId) {
    await maybeUpdateMonday(
      { [statusColId]: { label: config.statusLabels.sending } },
      `NDA Status → ${config.statusLabels.sending}`
    )
  } else {
    mondayUpdates.push('warn: NDA Status column id not resolved')
  }

  if (dryRun) {
    base.mondayUpdates = mondayUpdates
    base.envelopeId = null
    base.reason =
      'Dry-run: DocuSign mutual NDA not sent. Set AUTOMATIONS_NDA_SEND_DRY_RUN=false to send.'
    return base
  }

  const connection = await getDocuSignConnection()
  if (!connection) {
    await markError('DocuSign is not connected in Cantara')
    return {
      ...base,
      ok: false,
      mondayUpdates,
      error: 'DocuSign is not connected in Cantara (Connections tab)',
    }
  }

  const accountId = await resolveDocuSignAccountId()
  if (!accountId) {
    await markError('Could not resolve DocuSign account_id')
    return {
      ...base,
      ok: false,
      mondayUpdates,
      error: 'Could not resolve DocuSign account_id from connected user',
    }
  }

  docusignPayload.account_id = accountId

  try {
    const created = await executeDocuSignTool<any>('DOCUSIGN_CREATE_ENVELOPE_FROM_TEMPLATE', {
      account_id: accountId,
      template_id: config.templateId,
      email_subject: emailSubject,
      email_blurb: emailBlurb,
      status: 'sent',
      template_roles: templateRoles,
    })

    if (created?.successful === false || created?.error) {
      const errText = formatDocuSignToolError(created)
      await markError(`DocuSign send failed: ${errText}`)
      return { ...base, ok: false, mondayUpdates, error: errText }
    }

    base.envelopeId = extractEnvelopeIdFromToolResult(created)

    if (envelopeColId && base.envelopeId) {
      await maybeUpdateMonday({ [envelopeColId]: base.envelopeId }, `NDA Envelope ID → ${base.envelopeId}`)
    }
    if (statusColId) {
      await maybeUpdateMonday(
        { [statusColId]: { label: config.statusLabels.awaiting } },
        `NDA Status → ${config.statusLabels.awaiting}`
      )
    }

    // Make Data Store equivalent: remember envelope → Monday board/item for signed webhooks.
    if (base.envelopeId) {
      try {
        await registerBuyerNdaPending({
          envelopeId: base.envelopeId,
          boardId: config.boardId,
          itemId,
          fileColumnId: ndaFileColId,
          statusColumnId: statusColId,
          meta: {
            source: 'nda_send',
            dealName: deal.name,
          },
        })
        mondayUpdates.push(`Pending store: envelope ${base.envelopeId} → board ${config.boardId} / item ${itemId}`)
      } catch (e: any) {
        console.warn('[nda-send] registerBuyerNdaPending failed', e)
        mondayUpdates.push(`warn: pending store write failed (${e?.message || e})`)
      }
    }
  } catch (e: any) {
    await markError(e?.message || 'DocuSign create envelope failed').catch(() => null)
    return {
      ...base,
      ok: false,
      mondayUpdates,
      error: e?.message || 'DocuSign create envelope failed',
    }
  }

  base.mondayUpdates = mondayUpdates
  return base
}
