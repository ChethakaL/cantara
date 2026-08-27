import { getProjectEnv } from '@/lib/project-env'
import { envFlag, envOrNull } from '@/lib/automations/env'

/**
 * Make: When Recipient Client signed a Prospective NDA Buyers → Change NDA Signed to YES.
 *
 * Make’s “Search Board ID” is NOT a Monday search — it is Data Store
 * `transactions_boards_ids` filtered by Envelope ID = webhook.envelopeId.
 * Cantara replacement: AutomationBuyerNdaPending (register at send time).
 *
 * Resolve board/item at runtime from:
 * 1) webhook payload (mondayBoardId / mondayItemId), or
 * 2) AutomationBuyerNdaPending row keyed by envelopeId, or
 * 3) BUYERS_NDA_MONDAY_BOARD_ID env + Monday envelope-column search (optional fallback).
 */
export type BuyerNdaSignedConfig = {
  /** Optional fallback board only — never a deleted Make default. */
  boardId: string | null
  dryRun: boolean
  updateMonday: boolean
  webhookSecret: string | null
  documentId: string
  /** Client recipient on the mutual/prospective NDA (Make used recipientId 1). */
  expectedRecipientId: string | null
  docusignAccountIdHint: string | null
  columns: {
    envelopeId: string | null
    file: string | null
    ndaSigned: string | null
    ndaCraig: string | null
    ndaStatus: string | null
    updates: string | null
  }
  statusLabels: {
    ndaSigned: string
    ndaCraig: string
    error: string
  }
}

export function getBuyerNdaSignedConfig(): BuyerNdaSignedConfig {
  return {
    boardId: envOrNull('BUYERS_NDA_MONDAY_BOARD_ID'),
    dryRun: envFlag('AUTOMATIONS_BUYER_NDA_SIGNED_DRY_RUN', true),
    updateMonday: envFlag('AUTOMATIONS_BUYER_NDA_SIGNED_UPDATE_MONDAY', false),
    webhookSecret:
      envOrNull('BUYERS_NDA_WEBHOOK_SECRET') || envOrNull('DOCUSIGN_WEBHOOK_SECRET'),
    documentId: (getProjectEnv('BUYERS_NDA_DOCUMENT_ID') || '1').trim(),
    expectedRecipientId: envOrNull('BUYERS_NDA_RECIPIENT_ID') || '1',
    docusignAccountIdHint: envOrNull('BUYERS_NDA_DOCUSIGN_ACCOUNT_ID'),
    columns: {
      envelopeId:
        envOrNull('BUYERS_NDA_COL_ENVELOPE_ID') ||
        envOrNull('CONTRACTS_COL_NDA_ENVELOPE_ID'),
      // Old Make column file_mm3c62fj was board-specific — do not hardcode.
      file: envOrNull('BUYERS_NDA_COL_FILE'),
      ndaSigned: envOrNull('BUYERS_NDA_COL_SIGNED'),
      ndaCraig: envOrNull('BUYERS_NDA_COL_CRAIG'),
      ndaStatus: envOrNull('BUYERS_NDA_COL_STATUS') || envOrNull('CONTRACTS_COL_NDA_STATUS'),
      updates: envOrNull('BUYERS_NDA_COL_UPDATES'),
    },
    statusLabels: {
      ndaSigned: getProjectEnv('BUYERS_NDA_STATUS_SIGNED') || 'YES',
      ndaCraig: getProjectEnv('BUYERS_NDA_STATUS_CRAIG') || 'Send',
      error: getProjectEnv('BUYERS_NDA_STATUS_ERROR') || 'Error',
    },
  }
}
