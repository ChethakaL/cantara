import { executeDocuSignTool, getDocuSignConnection } from '@/lib/composio/docusign'
import { getNdaPrimaryContactConfig } from '@/lib/automations/nda/primary-contact-config'
import {
  columnTextByTitle,
  createMondayUpdateGate,
  loadMondayDealItem,
  resolveColumnId,
} from '@/lib/automations/monday-deal'
import { formatDocuSignToolError, resolveDocuSignAccountId } from '@/lib/automations/docusign/account'

export type NdaRecipientSummary = {
  email: string | null
  name: string | null
  roleName: string | null
  status: string | null
  routingOrder: string | null
}

export type NdaPrimaryContactResult = {
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
    ndaStatus: string | null
    prospectiveEnvelopeId: string | null
  }
  envelopeId?: string | null
  primaryContact?: NdaRecipientSummary | null
  primaryCompleted?: boolean | null
  recipients?: NdaRecipientSummary[]
  mondayUpdates?: string[]
  docusignPlan?: Record<string, unknown>
  error?: string
}

function normalizeEmail(email: string | null | undefined) {
  return String(email || '')
    .trim()
    .toLowerCase()
}

function isCompletedRecipientStatus(status: string | null | undefined) {
  const s = String(status || '').toLowerCase()
  return s === 'completed' || s === 'signed'
}

function isAlreadySent(ndaStatus: string | null) {
  const s = (ndaStatus || '').toLowerCase()
  return s.includes('nda sent') || s === 'sent' || s.includes('signed')
}

function collectRecipients(payload: any): NdaRecipientSummary[] {
  const root = payload?.data || payload || {}
  const recipientsRoot = root.recipients || root
  const buckets = [
    recipientsRoot.signers,
    recipientsRoot.agents,
    recipientsRoot.editors,
    recipientsRoot.intermediaries,
    recipientsRoot.carbonCopies,
    recipientsRoot.certifiedDeliveries,
    Array.isArray(recipientsRoot) ? recipientsRoot : null,
  ]

  const out: NdaRecipientSummary[] = []
  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue
    for (const r of bucket) {
      out.push({
        email: r?.email ? String(r.email) : null,
        name: r?.name ? String(r.name) : null,
        roleName: r?.roleName ? String(r.roleName) : r?.role_name ? String(r.role_name) : null,
        status: r?.status ? String(r.status) : null,
        routingOrder:
          r?.routingOrder != null
            ? String(r.routingOrder)
            : r?.routing_order != null
              ? String(r.routing_order)
              : null,
      })
    }
  }
  return out
}

function pickPrimaryContact(
  recipients: NdaRecipientSummary[],
  clientEmail: string | null,
  clientFullName: string | null
): NdaRecipientSummary | null {
  if (!recipients.length) return null

  const email = normalizeEmail(clientEmail)
  if (email) {
    const byEmail = recipients.find(r => normalizeEmail(r.email) === email)
    if (byEmail) return byEmail
  }

  const name = String(clientFullName || '')
    .trim()
    .toLowerCase()
  if (name) {
    const byName = recipients.find(r => String(r.name || '').trim().toLowerCase() === name)
    if (byName) return byName
  }

  const byRole = recipients.find(r => {
    const role = String(r.roleName || '').toLowerCase()
    return role.includes('client') || role.includes('signer') || role.includes('primary')
  })
  if (byRole) return byRole

  // Mutual NDA: Craig is usually routingOrder 1; primary contact is often 2.
  const byOrder = [...recipients].sort((a, b) => Number(a.routingOrder || 0) - Number(b.routingOrder || 0))
  return byOrder[1] || byOrder[0] || null
}

/**
 * Port of Make: When NDA Status → Send → track primary contact on existing envelope.
 * Does NOT create a new DocuSign envelope — reads Prospective NDA Envelope ID and
 * checks recipient status (Make: GET .../envelopes/{id}/recipients).
 */
export async function runNdaPrimaryContactAutomation(args: {
  itemId: string
  forceLive?: boolean
}): Promise<NdaPrimaryContactResult> {
  const config = getNdaPrimaryContactConfig()
  const dryRun = args.forceLive ? false : config.dryRun
  const itemId = String(args.itemId || '').trim()
  if (!itemId) {
    return {
      ok: false,
      dryRun,
      itemId: '',
      boardId: config.boardId,
      error: 'Missing Monday item id (event.pulseId)',
    }
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
    clientEmail: columnTextByTitle(columnValues, ['client email', 'email', 'primary contact']),
    clientFullName: columnTextByTitle(columnValues, [
      'client fullname',
      'client full name',
      'full name',
      'primary contact name',
    ]),
    ndaStatus: columnTextByTitle(columnValues, ['nda status']),
    prospectiveEnvelopeId: columnTextByTitle(columnValues, [
      'prospective nda envelope id',
      'prospective nda envelope',
      'nda envelope id',
      'nda envelope',
    ]),
  }

  const base: NdaPrimaryContactResult = {
    ok: true,
    dryRun,
    itemId,
    boardId: config.boardId,
    deal,
    envelopeId: deal.prospectiveEnvelopeId,
    mondayUpdates: [],
  }

  if (isAlreadySent(deal.ndaStatus)) {
    return {
      ...base,
      skipped: true,
      reason: `NDA already marked sent/signed (${deal.ndaStatus})`,
    }
  }

  const statusColId = resolveColumnId(boardColumns, config.columns.ndaStatus, ['nda status'])
  const updatesColId = resolveColumnId(boardColumns, config.columns.updates, [
    'updates',
    'update',
    'error',
  ])

  const mondayUpdates: string[] = []
  const maybeUpdateMonday = createMondayUpdateGate({
    boardId: config.boardId,
    itemId,
    dryRun,
    updateMonday: config.updateMonday,
    updateMondayEnvKey: 'AUTOMATIONS_NDA_PRIMARY_UPDATE_MONDAY',
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

  // Make branch: no envelope → error / no-envelope path
  if (!deal.prospectiveEnvelopeId) {
    const message = 'No Prospective NDA Envelope ID on deal — cannot track primary contact signing'
    await markError(message)
    base.mondayUpdates = mondayUpdates
    return { ...base, ok: false, skipped: true, reason: message }
  }

  if (statusColId) {
    await maybeUpdateMonday(
      { [statusColId]: { label: config.statusLabels.sending } },
      `NDA Status → ${config.statusLabels.sending}`
    )
  } else {
    mondayUpdates.push('warn: NDA Status column id not resolved')
  }

  // Make: GET /v2.1/accounts/{accountId}/envelopes/{Prospective NDA Envelope ID}/recipients
  // Composio equivalent: DOCUSIGN_GET_ENVELOPE (includes recipient statuses).
  const docusignPlan = {
    method: 'GET',
    path: `/v2.1/accounts/{accountId}/envelopes/${deal.prospectiveEnvelopeId}/recipients`,
    composioTool: 'DOCUSIGN_GET_ENVELOPE',
    envelope_id: deal.prospectiveEnvelopeId,
    header: { 'Content-Type': 'application/json' },
  }
  base.docusignPlan = docusignPlan

  if (dryRun) {
    base.mondayUpdates = mondayUpdates
    base.primaryCompleted = null
    base.reason =
      'Dry-run: DocuSign recipients not fetched. Set AUTOMATIONS_NDA_PRIMARY_DRY_RUN=false to check live.'
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

  try {
    const envelope = await executeDocuSignTool<any>('DOCUSIGN_GET_ENVELOPE', {
      account_id: accountId,
      envelope_id: deal.prospectiveEnvelopeId,
    })

    if (envelope?.successful === false || envelope?.error) {
      const errText = formatDocuSignToolError(envelope)
      await markError(`DocuSign envelope lookup failed: ${errText}`)
      return { ...base, ok: false, mondayUpdates, error: errText }
    }

    const recipients = collectRecipients(envelope)
    const primary = pickPrimaryContact(recipients, deal.clientEmail, deal.clientFullName)
    const primaryCompleted = primary ? isCompletedRecipientStatus(primary.status) : false

    base.recipients = recipients
    base.primaryContact = primary
    base.primaryCompleted = primaryCompleted

    if (!primary) {
      const message = 'Could not identify primary contact among DocuSign recipients'
      await markError(message)
      base.mondayUpdates = mondayUpdates
      return { ...base, ok: false, reason: message }
    }

    if (primaryCompleted) {
      if (statusColId) {
        await maybeUpdateMonday(
          { [statusColId]: { label: config.statusLabels.sent } },
          `NDA Status → ${config.statusLabels.sent}`
        )
      }
      base.mondayUpdates = mondayUpdates
      base.reason = `Primary contact completed signing (${primary.email || primary.name})`
      return base
    }

    // Not completed yet — leave Sending and report waiting (Make “continue waiting/tracking”).
    base.mondayUpdates = mondayUpdates
    base.skipped = true
    base.reason = `Primary contact not completed yet (status=${primary.status || 'unknown'}); left as ${config.statusLabels.sending}`
    return base
  } catch (e: any) {
    await markError(e?.message || 'DocuSign recipient check failed').catch(() => null)
    return {
      ...base,
      ok: false,
      mondayUpdates,
      error: e?.message || 'DocuSign recipient check failed',
    }
  }
}
