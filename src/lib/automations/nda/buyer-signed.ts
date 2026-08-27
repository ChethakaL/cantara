import { prisma } from '@/lib/prisma'
import { updateMondayBoardItem } from '@/lib/composio/monday-items'
import { getDocuSignConnection } from '@/lib/composio/docusign'
import { getBuyerNdaSignedConfig } from '@/lib/automations/nda/buyer-signed-config'
import {
  findMondayItemByColumnValue,
  listMondayBoardColumns,
  resolveColumnId,
} from '@/lib/automations/monday-deal'
import { resolveDocuSignAccountId } from '@/lib/automations/docusign/account'
import { downloadEnvelopeDocument } from '@/lib/automations/docusign/documents'
import { uploadFileToMondayColumn } from '@/lib/automations/monday-file-upload'
import {
  getBuyerNdaPending,
  markBuyerNdaPendingConsumed,
} from '@/lib/automations/nda/pending-store'

const DOCUMENT_KIND = 'buyer_nda_prospective'

export type BuyerNdaSignedResult = {
  ok: boolean
  dryRun: boolean
  skipped?: boolean
  reason?: string
  envelopeId: string | null
  recipientId: string | null
  event: string | null
  boardId: string | null
  mondayItemId?: string | null
  resolveSource?: 'webhook' | 'pending_store' | 'env_board_search' | null
  fileColumnId?: string | null
  planned?: {
    downloadDocumentId: string
    ndaSignedLabel: string
    ndaCraigLabel: string
  }
  fileUploaded?: boolean
  mondayUpdates?: string[]
  error?: string
}

/** Parse DocuSign Connect / Make `recipient-completed` webhook bodies (+ optional Monday hints). */
export function parseRecipientCompletedPayload(raw: unknown): {
  event: string | null
  envelopeId: string | null
  recipientId: string | null
  accountId: string | null
  recipientStatus: string | null
  mondayBoardId: string | null
  mondayItemId: string | null
  fileColumnId: string | null
} {
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const data = (body.data && typeof body.data === 'object' ? body.data : body) as Record<string, unknown>
  const monday =
    (body.monday && typeof body.monday === 'object' ? body.monday : null) ||
    (data.monday && typeof data.monday === 'object' ? data.monday : null)

  const event = String(body.event || data.event || '').trim() || null
  const envelopeId = String(
    data.envelopeId || body.envelopeId || data.EnvelopeId || body.EnvelopeId || ''
  ).trim()
  const recipientId = String(
    data.recipientId || body.recipientId || data.RecipientId || ''
  ).trim()
  const accountId = String(data.accountId || body.accountId || '').trim() || null
  const recipientStatus = String(
    data.recipientStatus || data.status || body.recipientStatus || ''
  )
    .trim()
    .toLowerCase() || null

  const mondayBoardId = String(
    (monday as any)?.boardId ||
      body.mondayBoardId ||
      body.boardId ||
      data.mondayBoardId ||
      data.boardId ||
      ''
  ).trim()
  const mondayItemId = String(
    (monday as any)?.itemId ||
      body.mondayItemId ||
      body.itemId ||
      body.pulseId ||
      data.mondayItemId ||
      data.itemId ||
      data.pulseId ||
      ''
  ).trim()
  const fileColumnId = String(
    (monday as any)?.fileColumnId || body.fileColumnId || data.fileColumnId || ''
  ).trim()

  return {
    event,
    envelopeId: envelopeId || null,
    recipientId: recipientId || null,
    accountId,
    recipientStatus,
    mondayBoardId: mondayBoardId || null,
    mondayItemId: mondayItemId || null,
    fileColumnId: fileColumnId || null,
  }
}

function isRecipientCompletedEvent(event: string | null, recipientStatus: string | null) {
  const e = (event || '').toLowerCase()
  if (e.includes('recipient-completed') || e.includes('recipient_completed')) return true
  // Make filter label was “if is a delivered status” — accept completed/signed recipient too.
  if (recipientStatus === 'completed' || recipientStatus === 'signed') return true
  return false
}

/**
 * Port of Make: recipient-completed → resolve Buyers Monday item → download PDF →
 * upload → NDA Signed=YES + NDA Craig=Send.
 *
 * Board is never hardcoded (old Make board is deleted). Resolve from webhook,
 * pending store (registered at send time), or optional env board search.
 */
export async function runBuyerNdaSignedAutomation(args: {
  payload: unknown
  forceLive?: boolean
  envelopeId?: string
}): Promise<BuyerNdaSignedResult> {
  const config = getBuyerNdaSignedConfig()
  const dryRun = args.forceLive ? false : config.dryRun
  const parsed = parseRecipientCompletedPayload(args.payload)
  const envelopeId = (args.envelopeId || parsed.envelopeId || '').trim() || null

  const base: BuyerNdaSignedResult = {
    ok: true,
    dryRun,
    envelopeId,
    recipientId: parsed.recipientId,
    event: parsed.event,
    boardId: null,
    resolveSource: null,
    fileColumnId: null,
    planned: {
      downloadDocumentId: config.documentId,
      ndaSignedLabel: config.statusLabels.ndaSigned,
      ndaCraigLabel: config.statusLabels.ndaCraig,
    },
    mondayUpdates: [],
  }

  if (!envelopeId) {
    return { ...base, ok: false, error: 'Missing envelopeId in DocuSign recipient-completed payload' }
  }

  if (!args.envelopeId && !isRecipientCompletedEvent(parsed.event, parsed.recipientStatus)) {
    return {
      ...base,
      skipped: true,
      reason: `Not a recipient-completed event (event=${parsed.event || 'unknown'})`,
    }
  }

  if (
    config.expectedRecipientId &&
    parsed.recipientId &&
    String(parsed.recipientId) !== String(config.expectedRecipientId) &&
    !args.envelopeId
  ) {
    return {
      ...base,
      skipped: true,
      reason: `Recipient ${parsed.recipientId} is not the expected client recipient (${config.expectedRecipientId})`,
    }
  }

  const existing = await prisma.automationProcessedEnvelope
    .findFirst({ where: { envelopeId, documentKind: DOCUMENT_KIND, status: 'processed' } })
    .catch(() => null)
  if (existing) {
    return {
      ...base,
      skipped: true,
      boardId: existing.mondayBoardId,
      mondayItemId: existing.mondayItemId,
      reason: `Already processed at ${existing.createdAt.toISOString()}`,
    }
  }

  // --- Resolve Monday board + item (Make Data Store transactions_boards_ids) ---
  // DocuSign only sends envelopeId; board/item come from our pending map (or webhook hints).
  let boardId: string | null = null
  let mondayItemId: string | null = null
  let fileColumnId: string | null = parsed.fileColumnId || config.columns.file
  let resolveSource: BuyerNdaSignedResult['resolveSource'] = null

  // 1) Explicit Monday refs on webhook (custom payload / test harness)
  if (parsed.mondayBoardId && parsed.mondayItemId) {
    boardId = parsed.mondayBoardId
    mondayItemId = parsed.mondayItemId
    resolveSource = 'webhook'
  }

  // 2) Pending store = Make Data Store transactions_boards_ids
  if (!mondayItemId) {
    const pending = await getBuyerNdaPending(envelopeId).catch(() => null)
    if (pending) {
      boardId = pending.boardId
      mondayItemId = pending.itemId
      fileColumnId = pending.fileColumnId || fileColumnId
      resolveSource = 'pending_store'
    }
  }

  // 3) Optional env board + search by envelope column
  if (!mondayItemId && config.boardId) {
    boardId = config.boardId
    const boardColumns = await listMondayBoardColumns(config.boardId)
    const envelopeColId = resolveColumnId(boardColumns, config.columns.envelopeId, [
      'prospective nda envelope id',
      'prospective nda envelope',
      'nda envelope id',
      'nda envelope',
      'envelope id',
    ])
    if (envelopeColId) {
      mondayItemId = await findMondayItemByColumnValue({
        boardId: config.boardId,
        columnId: envelopeColId,
        value: envelopeId,
      })
      if (mondayItemId) resolveSource = 'env_board_search'
    }
  }

  base.boardId = boardId
  base.mondayItemId = mondayItemId
  base.resolveSource = resolveSource
  base.fileColumnId = fileColumnId

  if (!boardId || !mondayItemId) {
    return {
      ...base,
      ok: dryRun,
      skipped: !dryRun,
      reason: dryRun
        ? `Dry-run: no data-store / pending row for envelope ${envelopeId}. Make used transactions_boards_ids; Cantara needs registerBuyerNdaPending({ envelopeId, boardId, itemId }) at send time (or webhook monday.boardId+itemId).`
        : `No pending mapping for envelope ${envelopeId}. Register AutomationBuyerNdaPending at send time, or pass monday.boardId+itemId on the webhook.`,
    }
  }

  // Resolve status/file columns on the resolved board
  const boardColumns = await listMondayBoardColumns(boardId)
  const ndaSignedColId = resolveColumnId(boardColumns, config.columns.ndaSigned, ['nda signed'])
  const ndaCraigColId = resolveColumnId(boardColumns, config.columns.ndaCraig, [
    'nda craig',
    'craig',
  ])
  if (!fileColumnId) {
    fileColumnId = resolveColumnId(boardColumns, null, [
      'nda file',
      'prospective nda',
      'nda document',
      'file',
    ])
    base.fileColumnId = fileColumnId
  }

  if (dryRun) {
    return {
      ...base,
      reason: `Dry-run: would download DocuSign document ${config.documentId}, upload to Monday file column ${fileColumnId || '(unresolved)'}, set NDA Signed=${config.statusLabels.ndaSigned} and NDA Craig=${config.statusLabels.ndaCraig} (source=${resolveSource}). No writes performed.`,
    }
  }

  if (!config.updateMonday) {
    return {
      ...base,
      ok: false,
      error: 'Live mode requires AUTOMATIONS_BUYER_NDA_SIGNED_UPDATE_MONDAY=true',
    }
  }

  if (!fileColumnId) {
    return {
      ...base,
      ok: false,
      error:
        'Monday file column not resolved. Set BUYERS_NDA_COL_FILE, pass fileColumnId on webhook, or register it in AutomationBuyerNdaPending.',
    }
  }

  const connection = await getDocuSignConnection()
  if (!connection) {
    return { ...base, ok: false, error: 'DocuSign is not connected in Cantara (Connections tab)' }
  }

  const accountId = await resolveDocuSignAccountId(
    parsed.accountId || config.docusignAccountIdHint
  )
  if (!accountId) {
    return { ...base, ok: false, error: 'Could not resolve DocuSign account_id' }
  }

  const mondayUpdates: string[] = []

  try {
    const pdf = await downloadEnvelopeDocument({
      accountId,
      envelopeId,
      documentId: config.documentId,
      fileNamePrefix: 'prospective-nda',
    })

    const upload = await uploadFileToMondayColumn({
      itemId: mondayItemId,
      columnId: fileColumnId,
      fileName: pdf.fileName,
      bytes: pdf.bytes,
      mimeType: 'application/pdf',
    })
    if (!upload.ok) {
      return {
        ...base,
        ok: false,
        mondayUpdates,
        error: `Monday file upload failed: ${upload.error}`,
      }
    }
    mondayUpdates.push(`Uploaded ${pdf.fileName} → column ${fileColumnId}`)
    base.fileUploaded = true

    const columnValues: Record<string, unknown> = {}
    if (ndaSignedColId) {
      columnValues[ndaSignedColId] = { label: config.statusLabels.ndaSigned }
      mondayUpdates.push(`NDA Signed → ${config.statusLabels.ndaSigned}`)
    } else {
      mondayUpdates.push('warn: NDA Signed column not resolved')
    }
    if (ndaCraigColId) {
      columnValues[ndaCraigColId] = { label: config.statusLabels.ndaCraig }
      mondayUpdates.push(`NDA Craig → ${config.statusLabels.ndaCraig}`)
    } else {
      mondayUpdates.push('warn: NDA Craig column not resolved')
    }

    if (Object.keys(columnValues).length) {
      await updateMondayBoardItem({
        boardId,
        itemId: mondayItemId,
        columnValues,
      })
    }

    await prisma.automationProcessedEnvelope.upsert({
      where: {
        envelopeId_documentKind: { envelopeId, documentKind: DOCUMENT_KIND },
      },
      create: {
        envelopeId,
        documentKind: DOCUMENT_KIND,
        mondayBoardId: boardId,
        mondayItemId,
        status: 'processed',
      },
      update: {
        mondayBoardId: boardId,
        mondayItemId,
        status: 'processed',
        error: null,
      },
    })

    await markBuyerNdaPendingConsumed(envelopeId).catch(() => null)

    base.mondayUpdates = mondayUpdates
    base.reason = 'Processed prospective buyer NDA: uploaded PDF and updated NDA Signed / NDA Craig'
    return base
  } catch (e: any) {
    return {
      ...base,
      ok: false,
      mondayUpdates,
      error: e?.message || 'Buyer NDA signed automation failed',
    }
  }
}
