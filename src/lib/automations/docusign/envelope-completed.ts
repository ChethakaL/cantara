import { PutObjectCommand } from '@aws-sdk/client-s3'
import { prisma } from '@/lib/prisma'
import { executeMondayGraphqlDirect } from '@/lib/composio/monday-api'
import { updateMondayBoardItem } from '@/lib/composio/monday-items'
import { getDocuSignConnection, executeDocuSignTool } from '@/lib/composio/docusign'
import { assertS3Configured, buildPublicFileUrl, s3BucketName, s3Client } from '@/lib/s3'
import { uploadFileToMondayColumn } from '@/lib/automations/monday-file-upload'
import { listMondayBoardColumns, resolveColumnId } from '@/lib/automations/monday-deal'
import {
  getBuyerNdaPending,
  markBuyerNdaPendingConsumed,
} from '@/lib/automations/nda/pending-store'
import {
  EnvelopeDocKind,
  getEnvelopeCompletedConfig,
  kindColumnHints,
} from '@/lib/automations/docusign/envelope-completed-config'

export { registerBuyerNdaPending } from '@/lib/automations/nda/pending-store'

export type EnvelopeCompletedResult = {
  ok: boolean
  dryRun: boolean
  skipped?: boolean
  reason?: string
  envelopeId: string | null
  envelopeStatus: string | null
  documentKind?: EnvelopeDocKind | null
  path?: 'deals' | 'buyers' | null
  mondayItemId?: string | null
  boardId?: string
  fileUrl?: string | null
  planned?: {
    downloadDocumentId: string
    uploadFileColumn: string | null
    statusColumn: string | null
    statusLabel: string | null
  }
  error?: string
}

/** Normalize DocuSign Connect / Make-style webhook bodies (JSON). */
export function parseDocuSignCompletedPayload(raw: unknown): {
  envelopeId: string | null
  status: string | null
  accountId: string | null
  raw: Record<string, unknown>
} {
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const data = (body.data && typeof body.data === 'object' ? body.data : body) as Record<string, unknown>
  const summary =
    (data.envelopeSummary && typeof data.envelopeSummary === 'object'
      ? data.envelopeSummary
      : null) as Record<string, unknown> | null

  const envelopeId = String(
    data.envelopeId ||
      body.envelopeId ||
      summary?.envelopeId ||
      data.EnvelopeId ||
      body.EnvelopeId ||
      data.envelopeID ||
      ''
  ).trim()

  const statusRaw = String(
    data.envelopeStatus ||
      summary?.status ||
      data.status ||
      body.status ||
      body.event ||
      data.event ||
      ''
  ).trim()

  const status = statusRaw.toLowerCase()
  const accountId = String(data.accountId || body.accountId || summary?.accountId || '').trim() || null

  return { envelopeId: envelopeId || null, status: status || null, accountId, raw: body }
}

function isCompletedStatus(status: string | null) {
  if (!status) return false
  const s = status.toLowerCase()
  return (
    s === 'completed' ||
    s.includes('envelope-completed') ||
    s.includes('envelope_completed') ||
    s.includes('completed')
  )
}

async function findDealByEnvelopeId(args: {
  boardId: string
  envelopeId: string
  lookups: Array<{ kind: EnvelopeDocKind; columnId: string | null }>
}): Promise<{ itemId: string; matchedColumnId: string; kind: EnvelopeDocKind } | null> {
  for (const lookup of args.lookups) {
    if (!lookup.columnId) continue
    try {
      const result = await executeMondayGraphqlDirect({
        query: `
          query ($boardId: ID!, $columnId: String!, $value: String!) {
            items_page_by_column_values (
              board_id: $boardId
              columns: [{ column_id: $columnId, column_values: [$value] }]
              limit: 5
            ) {
              items { id name }
            }
          }
        `,
        variables: {
          boardId: args.boardId,
          columnId: lookup.columnId,
          value: args.envelopeId,
        },
      })
      const items = (result as any)?.data?.items_page_by_column_values?.items || []
      if (Array.isArray(items) && items[0]?.id) {
        return {
          itemId: String(items[0].id),
          matchedColumnId: lookup.columnId,
          kind: lookup.kind,
        }
      }
    } catch (e) {
      console.warn('[envelope-completed] Monday envelope lookup failed', {
        columnId: lookup.columnId,
        e,
      })
    }
  }
  return null
}

async function resolveDocuSignAccountId(hint?: string | null) {
  if (hint) return hint
  const info = await executeDocuSignTool<any>('DOCUSIGN_LIST_OAUTH_USERINFO', {})
  const accounts = info?.data?.accounts || []
  const preferred =
    accounts.find((a: any) => a.is_default) ||
    accounts.find((a: any) => String(a.base_uri || '').includes('demo')) ||
    accounts[0]
  return preferred?.account_id ? String(preferred.account_id) : null
}

function extractPdfBytes(toolResult: any): Buffer | null {
  const data = toolResult?.data ?? toolResult
  const candidates = [
    data?.documentBase64,
    data?.pdfBase64,
    data?.file_base64,
    data?.content,
    data?.data,
    data?.documents?.[0]?.PDFBytes,
    data?.documents?.[0]?.pdfBytes,
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 32) {
      try {
        return Buffer.from(c.replace(/^data:application\/pdf;base64,/, ''), 'base64')
      } catch {
        /* continue */
      }
    }
  }
  if (typeof data === 'string' && data.length > 100) {
    try {
      return Buffer.from(data, 'base64')
    } catch {
      return null
    }
  }
  return null
}

async function downloadSignedPdf(args: {
  accountId: string
  envelopeId: string
  documentId: string
}): Promise<{ bytes: Buffer; fileName: string }> {
  const result = await executeDocuSignTool<any>('DOCUSIGN_RETRIEVE_ENVELOPE_DOCUMENTS', {
    accountId: args.accountId,
    envelopeId: args.envelopeId,
    documentId: args.documentId,
  })
  if (result?.successful === false) {
    throw new Error(
      typeof result.error === 'string' ? result.error : JSON.stringify(result.error || result.data)
    )
  }
  const bytes = extractPdfBytes(result)
  if (!bytes?.length) {
    throw new Error(
      'DocuSign document download returned no PDF bytes (check DOCUSIGN_RETRIEVE_ENVELOPE_DOCUMENTS response shape in logs)'
    )
  }
  return {
    bytes,
    fileName: `signed-${args.envelopeId.slice(0, 8)}-doc${args.documentId}.pdf`,
  }
}

async function archivePdfToS3(args: { envelopeId: string; kind: string; bytes: Buffer; fileName: string }) {
  try {
    assertS3Configured()
    const key = `automations/docusign/${args.envelopeId}/${args.kind}-${Date.now()}-${args.fileName}`
    await s3Client.send(
      new PutObjectCommand({
        Bucket: s3BucketName,
        Key: key,
        Body: args.bytes,
        ContentType: 'application/pdf',
      })
    )
    return buildPublicFileUrl(key)
  } catch (e) {
    console.warn('[envelope-completed] S3 archive skipped', e)
    return null
  }
}

/**
 * Make: When Envelope is Signed/Completed → upload PDF + mark Signed on Monday.
 * Dry-run by default. Live path implements Deals matching + download + Monday file/status.
 */
export async function runEnvelopeCompletedAutomation(args: {
  payload: unknown
  forceLive?: boolean
  envelopeId?: string
  documentKind?: EnvelopeDocKind
}): Promise<EnvelopeCompletedResult> {
  const config = getEnvelopeCompletedConfig()
  const dryRun = args.forceLive ? false : config.dryRun
  const parsed = parseDocuSignCompletedPayload(args.payload)
  const envelopeId = (args.envelopeId || parsed.envelopeId || '').trim() || null
  const status = parsed.status

  const base: EnvelopeCompletedResult = {
    ok: true,
    dryRun,
    envelopeId,
    envelopeStatus: status,
    boardId: config.dealsBoardId,
    path: null,
  }

  if (!envelopeId) {
    return { ...base, ok: false, error: 'Missing envelopeId in DocuSign webhook payload' }
  }

  if (!isCompletedStatus(status) && !args.envelopeId) {
    return {
      ...base,
      skipped: true,
      reason: `Not a completed envelope (status=${status || 'unknown'})`,
    }
  }

  // --- Duplicate protection ---
  const existing = await prisma.automationProcessedEnvelope
    .findFirst({
      where: { envelopeId, status: 'processed' },
    })
    .catch(() => null)
  if (existing) {
    return {
      ...base,
      skipped: true,
      documentKind: (existing.documentKind as EnvelopeDocKind) || null,
      mondayItemId: existing.mondayItemId,
      fileUrl: existing.fileUrl,
      reason: `Already processed (${existing.documentKind}) at ${existing.createdAt.toISOString()}`,
    }
  }

  const columns = await listMondayBoardColumns(config.dealsBoardId)
  const contractEnvCol = resolveColumnId(columns, config.columns.contractEnvelopeId, [
    'contract envelope id',
    'contract envelope',
  ])
  const ndaEnvCol = resolveColumnId(columns, config.columns.ndaEnvelopeId, [
    'nda envelope id',
    'nda envelope',
  ])
  const proposalEnvCol = resolveColumnId(columns, config.columns.proposalEnvelopeId, [
    'proposal envelope id',
    'proposal envelope',
  ])

  // Prefer explicit kind from test; else match Monday envelope ID columns (NDA first — Make's clearest branch).
  let match = args.documentKind
    ? null
    : await findDealByEnvelopeId({
        boardId: config.dealsBoardId,
        envelopeId,
        lookups: [
          { kind: 'nda', columnId: ndaEnvCol },
          { kind: 'contract', columnId: contractEnvCol },
          { kind: 'proposal', columnId: proposalEnvCol },
        ],
      })

  // Buyer pending store (Make data-store replacement)
  const buyerPending = !match
    ? await getBuyerNdaPending(envelopeId).catch(() => null)
    : null

  let documentKind: EnvelopeDocKind | null =
    args.documentKind || match?.kind || (buyerPending ? 'nda' : null)
  let path: 'deals' | 'buyers' | null = match ? 'deals' : buyerPending ? 'buyers' : null
  let mondayItemId = match?.itemId || buyerPending?.itemId || null
  let boardId = match ? config.dealsBoardId : buyerPending?.boardId || config.dealsBoardId

  if (!documentKind) documentKind = 'nda'

  const hints = kindColumnHints(documentKind)
  const fileCol =
    buyerPending?.fileColumnId ||
    resolveColumnId(
      columns,
      documentKind === 'contract'
        ? config.columns.contractFile
        : documentKind === 'nda'
          ? config.columns.ndaFile
          : config.columns.proposalFile,
      hints.fileTitles
    )
  const statusCol =
    buyerPending?.statusColumnId ||
    resolveColumnId(
      columns,
      documentKind === 'contract'
        ? config.columns.contractStatus
        : documentKind === 'nda'
          ? config.columns.ndaStatus
          : config.columns.proposalStatus,
      hints.statusTitles
    )
  const statusLabel = config.statusLabels[hints.signedLabelKey]

  base.documentKind = documentKind
  base.path = path
  base.mondayItemId = mondayItemId
  base.boardId = boardId
  base.planned = {
    downloadDocumentId: config.documentId,
    uploadFileColumn: fileCol,
    statusColumn: statusCol,
    statusLabel,
  }

  if (!mondayItemId) {
    return {
      ...base,
      ok: dryRun,
      skipped: !dryRun,
      reason: dryRun
        ? 'Dry-run plan ready, but no Monday Deals/Buyer match for this envelopeId yet (set column IDs or create buyer pending row).'
        : 'No Monday item matched this envelope ID (Deals envelope columns or buyer pending store).',
    }
  }

  if (dryRun) {
    return {
      ...base,
      reason:
        'Dry-run: would download DocuSign PDF, upload to Monday file column, set Signed status, mark envelope processed. No writes performed.',
    }
  }

  // -------- LIVE PATH --------
  if (!config.updateMonday) {
    return {
      ...base,
      ok: false,
      error: 'Live mode requires AUTOMATIONS_ENVELOPE_COMPLETED_UPDATE_MONDAY=true',
    }
  }

  const connection = await getDocuSignConnection()
  if (!connection) {
    return { ...base, ok: false, error: 'DocuSign is not connected' }
  }

  let accountId: string | null = null
  try {
    accountId = await resolveDocuSignAccountId(parsed.accountId)
  } catch (e: any) {
    return { ...base, ok: false, error: e?.message || 'Failed to resolve DocuSign account_id' }
  }
  if (!accountId) {
    return { ...base, ok: false, error: 'Could not resolve DocuSign account_id' }
  }

  let pdf: { bytes: Buffer; fileName: string }
  try {
    pdf = await downloadSignedPdf({
      accountId,
      envelopeId,
      documentId: config.documentId,
    })
  } catch (e: any) {
    return { ...base, ok: false, error: e?.message || 'DocuSign download failed' }
  }

  const fileUrl = await archivePdfToS3({
    envelopeId,
    kind: documentKind,
    bytes: pdf.bytes,
    fileName: pdf.fileName,
  })

  if (!fileCol) {
    return {
      ...base,
      ok: false,
      fileUrl,
      error: `Monday file column not resolved for ${documentKind}. Set CONTRACTS_COL_*_FILE env or fix column titles.`,
    }
  }

  const upload = await uploadFileToMondayColumn({
    itemId: mondayItemId,
    columnId: fileCol,
    fileName: pdf.fileName,
    bytes: pdf.bytes,
    mimeType: 'application/pdf',
  })
  if (!upload.ok) {
    return {
      ...base,
      ok: false,
      fileUrl,
      error: `Monday file upload failed: ${upload.error}`,
    }
  }

  if (statusCol) {
    try {
      await updateMondayBoardItem({
        boardId,
        itemId: mondayItemId,
        columnValues: { [statusCol]: { label: statusLabel } },
      })
    } catch (e: any) {
      return {
        ...base,
        ok: false,
        fileUrl,
        error: `File uploaded but status update failed: ${e?.message || e}`,
      }
    }
  }

  await prisma.automationProcessedEnvelope.upsert({
    where: {
      envelopeId_documentKind: { envelopeId, documentKind },
    },
    create: {
      envelopeId,
      documentKind,
      mondayBoardId: boardId,
      mondayItemId,
      status: 'processed',
      fileUrl,
    },
    update: {
      mondayBoardId: boardId,
      mondayItemId,
      status: 'processed',
      fileUrl,
      error: null,
    },
  })

  if (buyerPending) {
    await markBuyerNdaPendingConsumed(envelopeId).catch(() => null)
  }

  base.fileUrl = fileUrl
  base.reason = `Processed: uploaded ${pdf.fileName} and set ${statusLabel}`
  return base
}
