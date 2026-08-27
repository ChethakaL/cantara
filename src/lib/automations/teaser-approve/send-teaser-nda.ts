import { executeMondayGraphqlDirect } from '@/lib/composio/monday-api'
import { executeDocuSignTool, getDocuSignConnection } from '@/lib/composio/docusign'
import { getTeaserApproveConfig } from '@/lib/automations/teaser-approve/config'
import {
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

export type TeaserApproveResult = {
  ok: boolean
  dryRun: boolean
  skipped?: boolean
  reason?: string
  itemId: string
  boardId: string | null
  deal?: {
    name: string
    primaryContactName: string | null
    primaryContactEmail: string | null
    teaserFolderLink: string | null
    prospectiveEnvelopeId: string | null
    teaserStatus: string | null
  }
  validation?: {
    hasName: boolean
    hasEmail: boolean
    hasTeaserLink: boolean
  }
  templateId?: string
  envelopeId?: string | null
  signingButtonUrl?: string | null
  planned?: Record<string, unknown>
  mondayUpdates?: string[]
  error?: string
}

function colById(
  columns: Array<{ id?: string; text?: string; value?: string }>,
  columnId: string
) {
  const col = columns.find(c => String(c.id) === columnId)
  if (!col) return null
  const text = String(col.text || '').trim()
  if (text) return text
  if (!col.value) return null
  try {
    const parsed = JSON.parse(String(col.value))
    if (parsed?.url) return String(parsed.url)
    if (parsed?.label) return String(parsed.label)
    if (parsed?.email) return String(parsed.email)
    if (parsed?.text) return String(parsed.text)
    // Monday link columns sometimes nest url
    if (parsed?.url?.url) return String(parsed.url.url)
  } catch {
    /* ignore */
  }
  return null
}

function buildSigningButtonUrl(args: {
  baseUrl: string
  envelopeId: string
  boardId: string
  itemId: string
}) {
  const u = new URL(args.baseUrl)
  u.searchParams.set('envelope', args.envelopeId)
  u.searchParams.set('itemId', args.itemId)
  u.searchParams.set('boardId', args.boardId)
  u.searchParams.set('role', 'Client')
  return u.toString()
}

async function fetchWorkdocPreview(itemId: string, workdocColumnId: string) {
  try {
    const result = await executeMondayGraphqlDirect({
      query: `
        query ($ids: [ID!]!, $colIds: [String!]) {
          items (ids: $ids) {
            column_values (ids: $colIds) { id text value }
          }
        }
      `,
      variables: { ids: [itemId], colIds: [workdocColumnId] },
    })
    const col = (result as any)?.data?.items?.[0]?.column_values?.[0]
    return {
      text: col?.text ? String(col.text) : null,
      value: col?.value ? String(col.value) : null,
    }
  } catch (e: any) {
    return { text: null, value: null, error: e?.message || 'Workdoc fetch failed' }
  }
}

/**
 * Port of Make: Teaser Draft Approved → email Teaser PDF + embedded DocuSign NDA.
 * Board/item come from the Monday webhook (dynamic). Dry-run by default — no live
 * DocuSign/Gmail/Drive until env flags are flipped.
 */
export async function runTeaserApproveAutomation(args: {
  itemId: string
  boardId?: string | null
  forceLive?: boolean
  origin?: string | null
}): Promise<TeaserApproveResult> {
  const config = getTeaserApproveConfig()
  const dryRun = args.forceLive ? false : config.dryRun
  const itemId = String(args.itemId || '').trim()
  const boardId = String(args.boardId || config.boardIdFallback || '').trim() || null

  if (!itemId) {
    return {
      ok: false,
      dryRun,
      itemId: '',
      boardId,
      error: 'Missing Monday item id (event.pulseId)',
    }
  }
  if (!boardId) {
    return {
      ok: false,
      dryRun,
      itemId,
      boardId: null,
      error:
        'Missing Monday boardId. Webhook must send event.boardId (Make used dynamic boardId; do not hardcode deleted boards).',
    }
  }

  const loaded = await loadMondayDealItem(boardId, itemId)
  if (!loaded) {
    return {
      ok: false,
      dryRun,
      itemId,
      boardId,
      error: 'Monday item not found (check Monday Composio connection + board/item ids)',
    }
  }

  const { item, boardColumns, columnValues } = loaded
  const deal = {
    name: item.name,
    primaryContactName: colById(columnValues, config.columns.primaryContactName),
    primaryContactEmail: colById(columnValues, config.columns.primaryContactEmail),
    teaserFolderLink: colById(columnValues, config.columns.teaserFolderLink),
    prospectiveEnvelopeId: colById(columnValues, config.columns.prospectiveEnvelopeId),
    teaserStatus: colById(columnValues, config.columns.teaserStatus),
  }

  const validation = {
    hasName: Boolean(deal.primaryContactName),
    hasEmail: Boolean(deal.primaryContactEmail),
    hasTeaserLink: Boolean(deal.teaserFolderLink),
  }

  const statusColId =
    resolveColumnId(boardColumns, config.columns.teaserStatus, ['teaser draft', 'teaser status']) ||
    config.columns.teaserStatus
  const envelopeColId =
    resolveColumnId(boardColumns, config.columns.prospectiveEnvelopeId, [
      'prospective nda envelope id',
      'prospective nda envelope',
    ]) || config.columns.prospectiveEnvelopeId
  const updatesColId = resolveColumnId(boardColumns, config.columns.updates, [
    'updates',
    'update',
  ])

  const mondayUpdates: string[] = []
  const maybeUpdateMonday = createMondayUpdateGate({
    boardId,
    itemId,
    dryRun,
    updateMonday: config.updateMonday,
    updateMondayEnvKey: 'AUTOMATIONS_TEASER_APPROVE_UPDATE_MONDAY',
    log: mondayUpdates,
  })

  const markError = async (message: string) => {
    if (updatesColId) {
      await maybeUpdateMonday({ [updatesColId]: message }, `Update → ${message}`)
    } else {
      mondayUpdates.push(`warn: Updates column not resolved; error was: ${message}`)
    }
    if (statusColId) {
      await maybeUpdateMonday(
        { [statusColId]: { label: config.statusLabels.error } },
        `Teaser status → ${config.statusLabels.error}`
      )
    }
  }

  const base: TeaserApproveResult = {
    ok: true,
    dryRun,
    itemId,
    boardId,
    deal,
    validation,
    templateId: config.templateId,
    mondayUpdates,
  }

  // Duplicate protection (Make: envelope already exists)
  if (deal.prospectiveEnvelopeId) {
    const message =
      'The Teaser & Prospective NDA has already been sent to the buyer.'
    await markError(message)
    base.mondayUpdates = mondayUpdates
    return { ...base, ok: false, skipped: true, reason: message, envelopeId: deal.prospectiveEnvelopeId }
  }

  if (!validation.hasName || !validation.hasEmail || !validation.hasTeaserLink) {
    const missing: string[] = []
    if (!validation.hasName) missing.push('Primary Contact Name')
    if (!validation.hasEmail) missing.push('Primary Contact Email')
    if (!validation.hasTeaserLink) missing.push('Teaser Link')
    const message = `Missing required fields: ${missing.join(', ')}`
    await markError(message)
    base.mondayUpdates = mondayUpdates
    return { ...base, ok: false, skipped: true, reason: message }
  }

  if (statusColId) {
    await maybeUpdateMonday(
      { [statusColId]: { label: config.statusLabels.sending } },
      `Teaser status → ${config.statusLabels.sending}`
    )
  }

  const workdoc = await fetchWorkdocPreview(itemId, config.columns.emailWorkdoc)

  const signingBase =
    config.signingHookBaseUrl ||
    (args.origin ? `${args.origin}/api/webhooks/docusign/embedded-signing` : null)

  const planned = {
    workdocColumn: config.columns.emailWorkdoc,
    workdocPresent: Boolean(workdoc.text || workdoc.value),
    workdocPreview: workdoc.text ? String(workdoc.text).slice(0, 200) : null,
    geminiOrClaude: 'Parse Workdoc Subject:/Body: → { subject, bodyHtml } (Make used Gemini 2.5 Flash; Cantara can use Claude)',
    drive: {
      folderLinkColumn: config.columns.teaserFolderLink,
      folderUrl: deal.teaserFolderLink,
      action: 'Extract Drive folder ID → find one file → download Teaser PDF',
    },
    docusign: {
      templateId: config.templateId,
      emailSubject: 'Please, sign this document',
      status: 'sent',
      templateRoles: [
        {
          roleName: 'Client',
          email: deal.primaryContactEmail,
          name: deal.primaryContactName,
          clientUserId: itemId,
        },
        {
          roleName: 'CEO',
          email: config.craig.email,
          name: config.craig.name,
          clientUserId: `${itemId}_CEO`,
        },
      ],
    },
    pendingStore: 'registerBuyerNdaPending({ envelopeId, boardId, itemId }) → transactions_boards_ids replacement',
    gmail: {
      to: deal.primaryContactEmail,
      attachment: 'Teaser PDF from Drive',
      body: 'Workdoc HTML + Review & Signing NDA button + Best regards, Craig',
      sendEmailFlag: config.sendEmail,
    },
    finalMonday: {
      status: config.statusLabels.sent,
      envelopeColumn: envelopeColId,
    },
  }
  base.planned = planned

  if (dryRun) {
    base.envelopeId = null
    base.signingButtonUrl = signingBase
      ? `${signingBase}?envelope=DRY_RUN&itemId=${itemId}&boardId=${boardId}&role=Client`
      : null
    base.mondayUpdates = mondayUpdates
    base.reason =
      'Dry-run: would create DocuSign envelope, register pending store, email Teaser PDF + signing button. Set AUTOMATIONS_TEASER_APPROVE_DRY_RUN=false to run live steps.'
    return base
  }

  // -------- LIVE (DocuSign + pending store + Monday). Gmail/Drive gated separately. --------
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
    return { ...base, ok: false, mondayUpdates, error: 'Could not resolve DocuSign account_id' }
  }

  try {
    const created = await executeDocuSignTool<any>('DOCUSIGN_CREATE_ENVELOPE_FROM_TEMPLATE', {
      account_id: accountId,
      template_id: config.templateId,
      email_subject: 'Please, sign this document',
      status: 'sent',
      template_roles: [
        {
          roleName: 'Client',
          email: deal.primaryContactEmail,
          name: deal.primaryContactName,
          clientUserId: itemId,
          routingOrder: '1',
        },
        {
          roleName: config.craig.roleName,
          email: config.craig.email,
          name: config.craig.name,
          clientUserId: `${itemId}_CEO`,
          routingOrder: '2',
        },
      ],
    })

    if (created?.successful === false || created?.error) {
      const errText = formatDocuSignToolError(created)
      await markError(`DocuSign send failed: ${errText}`)
      return { ...base, ok: false, mondayUpdates, error: errText }
    }

    const envelopeId = extractEnvelopeIdFromToolResult(created)
    base.envelopeId = envelopeId

    if (!envelopeId) {
      await markError('DocuSign returned no envelopeId')
      return { ...base, ok: false, mondayUpdates, error: 'DocuSign returned no envelopeId' }
    }

    await registerBuyerNdaPending({
      envelopeId,
      boardId,
      itemId,
      fileColumnId: null,
      statusColumnId: statusColId,
      meta: {
        source: 'teaser_approve',
        dealName: deal.name,
        primaryContactEmail: deal.primaryContactEmail,
      },
    })
    mondayUpdates.push(`Pending store: envelope ${envelopeId} → board ${boardId} / item ${itemId}`)

    if (signingBase) {
      base.signingButtonUrl = buildSigningButtonUrl({
        baseUrl: signingBase,
        envelopeId,
        boardId,
        itemId,
      })
    }

    if (envelopeColId) {
      await maybeUpdateMonday({ [envelopeColId]: envelopeId }, `Prospective NDA Envelope ID → ${envelopeId}`)
    }

    // Gmail + Drive download not fully wired (attachments). Leave status Sending unless email off.
    if (!config.sendEmail) {
      mondayUpdates.push(
        'skip Gmail (AUTOMATIONS_TEASER_APPROVE_SEND_EMAIL=false) — envelope created + pending store written; set Email Sent manually or enable sendEmail after Drive/Gmail attach is ready'
      )
      base.mondayUpdates = mondayUpdates
      base.reason =
        'Live DocuSign + pending store done. Gmail/Teaser PDF attach still gated (AUTOMATIONS_TEASER_APPROVE_SEND_EMAIL).'
      return base
    }

    // When sendEmail is true, status → Email Sent (full Gmail+Drive attach to be completed next).
    if (statusColId) {
      await maybeUpdateMonday(
        { [statusColId]: { label: config.statusLabels.sent } },
        `Teaser status → ${config.statusLabels.sent}`
      )
    }
    base.mondayUpdates = mondayUpdates
    base.reason =
      'DocuSign + pending store + Email Sent status. Full Gmail HTML + Drive PDF attachment still needs wiring for parity with Make.'
    return base
  } catch (e: any) {
    await markError(e?.message || 'Teaser approve automation failed').catch(() => null)
    return {
      ...base,
      ok: false,
      mondayUpdates,
      error: e?.message || 'Teaser approve automation failed',
    }
  }
}
