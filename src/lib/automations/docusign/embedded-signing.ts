import { executeDocuSignTool, getDocuSignConnection } from '@/lib/composio/docusign'
import { executeMondayTool } from '@/lib/composio/monday-api'
import { updateMondayBoardItem } from '@/lib/composio/monday-items'
import { resolveDocuSignAccountId, formatDocuSignToolError } from '@/lib/automations/docusign/account'
import { getEmbeddedSigningConfig } from '@/lib/automations/docusign/embedded-signing-config'

export type EmbeddedSigningRole = 'Client' | 'CEO' | string

export type EmbeddedSigner = {
  email: string | null
  name: string | null
  roleName: string | null
  clientUserId: string | null
  recipientId: string | null
  routingOrder: string | null
  status: string | null
}

export type EmbeddedSigningResult = {
  ok: boolean
  dryRun: boolean
  envelopeId: string
  boardId: string | null
  itemId: string | null
  role: string
  selectedSigner?: EmbeddedSigner | null
  recipients?: EmbeddedSigner[]
  signingUrl?: string | null
  planned?: Record<string, unknown>
  mondayErrorLogged?: boolean
  error?: string
}

function collectSigners(payload: any): EmbeddedSigner[] {
  const root = payload?.data || payload || {}
  const recipientsRoot = root.recipients || root
  const buckets = [
    recipientsRoot.signers,
    recipientsRoot.agents,
    recipientsRoot.editors,
    Array.isArray(recipientsRoot) ? recipientsRoot : null,
  ]
  const out: EmbeddedSigner[] = []
  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue
    for (const r of bucket) {
      out.push({
        email: r?.email ? String(r.email) : null,
        name: r?.name ? String(r.name) : null,
        roleName: r?.roleName ? String(r.roleName) : r?.role_name ? String(r.role_name) : null,
        clientUserId:
          r?.clientUserId != null
            ? String(r.clientUserId)
            : r?.client_user_id != null
              ? String(r.client_user_id)
              : null,
        recipientId:
          r?.recipientId != null
            ? String(r.recipientId)
            : r?.recipient_id != null
              ? String(r.recipient_id)
              : null,
        routingOrder:
          r?.routingOrder != null
            ? String(r.routingOrder)
            : r?.routing_order != null
              ? String(r.routing_order)
              : null,
        status: r?.status ? String(r.status) : null,
      })
    }
  }
  return out
}

/** Make: Client → position 1, CEO → position 2 (also match roleName). */
export function selectSignerByRole(signers: EmbeddedSigner[], role: string): EmbeddedSigner | null {
  const wanted = String(role || 'Client').trim().toLowerCase()
  const byRole = signers.find(s => String(s.roleName || '').trim().toLowerCase() === wanted)
  if (byRole) return byRole
  const order = wanted === 'ceo' ? '2' : wanted === 'client' ? '1' : null
  if (order) {
    const byOrder = signers.find(s => String(s.routingOrder || '') === order)
    if (byOrder) return byOrder
  }
  // Sorted fallback: Client first, CEO second
  const sorted = [...signers].sort(
    (a, b) => Number(a.routingOrder || 0) - Number(b.routingOrder || 0)
  )
  if (wanted === 'ceo') return sorted[1] || sorted[0] || null
  return sorted[0] || null
}

function extractViewUrl(toolResult: any): string | null {
  const data = toolResult?.data ?? toolResult
  const url =
    data?.url ||
    data?.recipientViewUrl ||
    data?.recipient_view_url ||
    data?.viewUrl ||
    data?.signingUrl ||
    null
  return url ? String(url) : null
}

async function markMondayError(args: {
  boardId: string
  itemId: string
  message: string
}) {
  const config = getEmbeddedSigningConfig()
  if (!config.updateMondayOnError) return false

  // Make: Create an Update (item comment) with the error text
  const body = `Embedded signing error: ${args.message}`
  await executeMondayTool('MONDAY_CREATE_UPDATE', {
    item_id: args.itemId,
    body,
  }).catch(err => console.warn('[embedded-signing] Monday create update failed:', err))

  // Make: set Teaser status column → "Error - See Update" (boardId/itemId from webhook, not hardcoded)
  const columnValues: Record<string, unknown> = {
    [config.teaserStatusColumnId]: { label: config.statusErrorLabel },
  }
  if (config.updatesColumnId) {
    columnValues[config.updatesColumnId] = body
  }
  await updateMondayBoardItem({
    boardId: args.boardId,
    itemId: args.itemId,
    columnValues,
  })
  return true
}

/**
 * Port of Make: Gmail “Review & Signing NDA” click → embedded DocuSign recipient view.
 * No board/template hardcoded — boardId/itemId/envelope/role come from the query string.
 */
export async function runEmbeddedSigning(args: {
  envelopeId: string
  role: string
  boardId?: string | null
  itemId?: string | null
  forceLive?: boolean
}): Promise<EmbeddedSigningResult> {
  const config = getEmbeddedSigningConfig()
  const dryRun = args.forceLive ? false : config.dryRun
  const envelopeId = String(args.envelopeId || '').trim()
  const role = String(args.role || 'Client').trim() || 'Client'
  const boardId = String(args.boardId || '').trim() || null
  const itemId = String(args.itemId || '').trim() || null

  const base: EmbeddedSigningResult = {
    ok: true,
    dryRun,
    envelopeId,
    boardId,
    itemId,
    role,
  }

  if (!envelopeId) {
    return { ...base, ok: false, error: 'Missing envelope query param' }
  }

  const planned = {
    getRecipients: `GET /v2.1/accounts/{accountId}/envelopes/${envelopeId}/recipients`,
    selectRole: role === 'CEO' ? 'routingOrder 2 / roleName CEO' : 'routingOrder 1 / roleName Client',
    createView: {
      tool: 'DOCUSIGN_CREATE_RECIPIENT_VIEW_URL',
      authenticationMethod: 'None',
      returnUrl: config.returnUrl,
    },
    redirect: 'HTTP 302 Location = signing URL',
  }
  base.planned = planned

  if (dryRun) {
    base.signingUrl = null
    return base
  }

  const connection = await getDocuSignConnection()
  if (!connection) {
    const msg = 'DocuSign is not connected in Cantara'
    if (boardId && itemId) {
      base.mondayErrorLogged = await markMondayError({ boardId, itemId, message: msg }).catch(
        () => false
      )
    }
    return { ...base, ok: false, error: msg }
  }

  const accountId = await resolveDocuSignAccountId()
  if (!accountId) {
    const msg = 'Could not resolve DocuSign account_id'
    if (boardId && itemId) {
      base.mondayErrorLogged = await markMondayError({ boardId, itemId, message: msg }).catch(
        () => false
      )
    }
    return { ...base, ok: false, error: msg }
  }

  try {
    // Make used GET recipients; Composio DOCUSIGN_GET_ENVELOPE includes recipient statuses.
    const envelope = await executeDocuSignTool<any>('DOCUSIGN_GET_ENVELOPE', {
      account_id: accountId,
      envelope_id: envelopeId,
    })
    if (envelope?.successful === false || envelope?.error) {
      const errText = formatDocuSignToolError(envelope)
      if (boardId && itemId) {
        base.mondayErrorLogged = await markMondayError({
          boardId,
          itemId,
          message: `Get envelope recipients failed: ${errText}`,
        }).catch(() => false)
      }
      return { ...base, ok: false, error: errText }
    }

    const recipients = collectSigners(envelope)
    base.recipients = recipients
    const selected = selectSignerByRole(recipients, role)
    base.selectedSigner = selected

    if (!selected?.email || !selected?.name) {
      const msg = `Could not find signer for role=${role} on envelope ${envelopeId}`
      if (boardId && itemId) {
        base.mondayErrorLogged = await markMondayError({ boardId, itemId, message: msg }).catch(
          () => false
        )
      }
      return { ...base, ok: false, error: msg }
    }

    const view = await executeDocuSignTool<any>('DOCUSIGN_CREATE_RECIPIENT_VIEW_URL', {
      accountId,
      envelopeId,
      email: selected.email,
      userName: selected.name,
      clientUserId: selected.clientUserId || undefined,
      recipientId: selected.recipientId || undefined,
      authenticationMethod: 'None',
      returnUrl: config.returnUrl,
    })

    if (view?.successful === false || view?.error) {
      const errText = formatDocuSignToolError(view)
      if (boardId && itemId) {
        base.mondayErrorLogged = await markMondayError({
          boardId,
          itemId,
          message: `Create recipient view failed: ${errText}`,
        }).catch(() => false)
      }
      return { ...base, ok: false, error: errText }
    }

    const signingUrl = extractViewUrl(view)
    if (!signingUrl) {
      const msg = 'DocuSign recipient view returned no URL'
      if (boardId && itemId) {
        base.mondayErrorLogged = await markMondayError({ boardId, itemId, message: msg }).catch(
          () => false
        )
      }
      return { ...base, ok: false, error: msg }
    }

    base.signingUrl = signingUrl
    return base
  } catch (e: any) {
    const msg = e?.message || 'Embedded signing failed'
    if (boardId && itemId) {
      base.mondayErrorLogged = await markMondayError({ boardId, itemId, message: msg }).catch(
        () => false
      )
    }
    return { ...base, ok: false, error: msg }
  }
}
