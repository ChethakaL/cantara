import { executeDocuSignTool, getDocuSignConnection } from '@/lib/composio/docusign'
import { getContractSendConfig } from '@/lib/automations/contracts/config'
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

export type ContractSendResult = {
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
    dealCode: string | null
    contractStatus: string | null
  }
  branch?: 'Consulting' | 'M&A' | 'unknown'
  templateId?: string | null
  envelopeId?: string | null
  mondayUpdates?: string[]
  docusignPayload?: Record<string, unknown>
  error?: string
}

function isConsulting(clientType: string | null) {
  return (clientType || '').toLowerCase().includes('consult')
}

function isMA(clientType: string | null) {
  const t = (clientType || '').toLowerCase()
  return t.includes('m&a') || t.includes('m and a') || t.includes('sale advisory') || t.includes('advisory')
}

/**
 * Port of Make: When Contract Status → Create Contract → send DocuSign.
 * Defaults to dry-run (no live DocuSign / Monday writes) until env flags are flipped.
 */
export async function runContractSendAutomation(args: {
  itemId: string
  forceLive?: boolean
}): Promise<ContractSendResult> {
  const config = getContractSendConfig()
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
    dealCode: columnTextByTitle(columnValues, ['dealcode', 'deal code']),
    contractStatus: columnTextByTitle(columnValues, ['contract status']),
  }

  const base: ContractSendResult = {
    ok: true,
    dryRun,
    itemId,
    boardId: config.boardId,
    deal,
    mondayUpdates: [],
  }

  const status = (deal.contractStatus || '').toLowerCase()
  if (status.includes('signed') || status.includes('cancelled') || status.includes('canceled')) {
    return { ...base, skipped: true, reason: `Contract already terminal (${deal.contractStatus})` }
  }

  if (!deal.clientEmail || !deal.clientFullName || !deal.clientType) {
    return {
      ...base,
      ok: false,
      skipped: true,
      reason: 'Missing required fields (Client Email, Client FullName, and/or Client Type)',
    }
  }

  const consulting = isConsulting(deal.clientType)
  const ma = isMA(deal.clientType)
  const branch: ContractSendResult['branch'] = consulting ? 'Consulting' : ma ? 'M&A' : 'unknown'
  const templateId = consulting ? config.templates.consulting : ma ? config.templates.ma : null

  base.branch = branch
  base.templateId = templateId

  if (!templateId) {
    return {
      ...base,
      ok: false,
      reason:
        branch === 'Consulting'
          ? 'Consulting template ID not configured (set DOCUSIGN_TEMPLATE_CONSULTING)'
          : `No DocuSign template for client type "${deal.clientType}"`,
    }
  }

  const recipients = [
    {
      email: config.craig.email,
      name: config.craig.name,
      roleName: config.craig.roleName,
      routingOrder: '1',
      tabs: {
        textTabs: [
          { tabLabel: 'Text f41c868e-1bf2-40a7-a0e5-2f6692a9bd14', value: deal.clientType },
          { tabLabel: 'Text e9b86860-f034-41dd-b11b-b16ed645aa85', value: deal.dealCode || '' },
        ],
      },
    },
    {
      email: deal.clientEmail,
      name: deal.clientFullName,
      roleName: deal.clientRole || 'Client',
      routingOrder: '2',
    },
  ]

  const emailSubject = `${deal.name} - Consulting Client Services Agreement`
  const docusignPayload = {
    status: 'sent',
    account_id: undefined as string | undefined,
    template_id: templateId,
    email_subject: emailSubject,
    template_roles: recipients.map(r => ({
      email: r.email,
      name: r.name,
      roleName: r.roleName,
      routingOrder: r.routingOrder,
      tabs: (r as any).tabs,
    })),
  }
  base.docusignPayload = docusignPayload

  const statusColId = resolveColumnId(boardColumns, config.columns.contractStatus, ['contract status'])
  const envelopeColId = resolveColumnId(boardColumns, config.columns.envelopeId, [
    'envelope',
    'docusign',
    'envelope id',
  ])

  const mondayUpdates: string[] = []
  const maybeUpdateMonday = createMondayUpdateGate({
    boardId: config.boardId,
    itemId,
    dryRun,
    updateMonday: config.updateMonday,
    updateMondayEnvKey: 'AUTOMATIONS_CONTRACT_SEND_UPDATE_MONDAY',
    log: mondayUpdates,
  })

  if (statusColId) {
    await maybeUpdateMonday(
      { [statusColId]: { label: config.statusLabels.creating } },
      `Contract Status → ${config.statusLabels.creating}`
    )
  } else {
    mondayUpdates.push('warn: Contract Status column id not resolved')
  }

  if (dryRun) {
    base.mondayUpdates = mondayUpdates
    base.envelopeId = null
    base.reason = 'Dry-run: DocuSign envelope not sent. Set AUTOMATIONS_CONTRACT_SEND_DRY_RUN=false to send.'
    return base
  }

  const connection = await getDocuSignConnection()
  if (!connection) {
    return { ...base, ok: false, mondayUpdates, error: 'DocuSign is not connected in Cantara (Connections tab)' }
  }

  const accountId = await resolveDocuSignAccountId()
  if (!accountId) {
    return { ...base, ok: false, mondayUpdates, error: 'Could not resolve DocuSign account_id from connected user' }
  }

  docusignPayload.account_id = accountId

  try {
    const created = await executeDocuSignTool<any>('DOCUSIGN_CREATE_ENVELOPE_FROM_TEMPLATE', {
      account_id: accountId,
      template_id: templateId,
      email_subject: emailSubject,
      status: 'sent',
      template_roles: docusignPayload.template_roles,
    })

    if (created?.successful === false || created?.error) {
      return {
        ...base,
        ok: false,
        mondayUpdates,
        error: formatDocuSignToolError(created),
      }
    }

    base.envelopeId = extractEnvelopeIdFromToolResult(created)

    if (statusColId) {
      await maybeUpdateMonday(
        { [statusColId]: { label: config.statusLabels.sent } },
        `Contract Status → ${config.statusLabels.sent}`
      )
    }
    if (envelopeColId && base.envelopeId) {
      await maybeUpdateMonday({ [envelopeColId]: base.envelopeId }, `Envelope ID → ${base.envelopeId}`)
    }
  } catch (e: any) {
    if (statusColId && config.updateMonday) {
      await maybeUpdateMonday(
        { [statusColId]: { label: config.statusLabels.error } },
        `Contract Status → ${config.statusLabels.error}`
      ).catch(() => null)
    }
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
