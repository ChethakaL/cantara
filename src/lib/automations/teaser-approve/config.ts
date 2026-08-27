import { getProjectEnv } from '@/lib/project-env'
import { envFlag, envOrNull } from '@/lib/automations/env'

/**
 * Make: When Teaser Draft Status → Approve → email Teaser PDF + DocuSign NDA to buyer.
 *
 * Board ID is DYNAMIC from the Monday webhook (event.boardId) — not hardcoded.
 * Make error nodes had stale board 18398610807; we ignore that.
 */
export type TeaserApproveConfig = {
  /** Optional fallback only — prefer webhook boardId. */
  boardIdFallback: string | null
  dryRun: boolean
  updateMonday: boolean
  sendEmail: boolean
  webhookSecret: string | null
  /** Prospective buyer NDA template (Make). */
  templateId: string
  /** Public base for embedded signing button (Make used hook.us2.make.com/...). */
  signingHookBaseUrl: string | null
  columns: {
    teaserStatus: string
    emailWorkdoc: string
    teaserFolderLink: string
    primaryContactName: string
    primaryContactEmail: string
    prospectiveEnvelopeId: string
    updates: string | null
  }
  statusLabels: {
    trigger: string
    sending: string
    sent: string
    error: string
  }
  craig: {
    email: string
    name: string
    roleName: string
  }
}

export function getTeaserApproveConfig(): TeaserApproveConfig {
  return {
    boardIdFallback: envOrNull('TEASER_APPROVE_MONDAY_BOARD_ID'),
    dryRun: envFlag('AUTOMATIONS_TEASER_APPROVE_DRY_RUN', true),
    updateMonday: envFlag('AUTOMATIONS_TEASER_APPROVE_UPDATE_MONDAY', false),
    // Extra gate: even when dry-run is off, email stays off until explicitly enabled.
    sendEmail: envFlag('AUTOMATIONS_TEASER_APPROVE_SEND_EMAIL', false),
    webhookSecret:
      envOrNull('TEASER_APPROVE_MONDAY_WEBHOOK_SECRET') ||
      envOrNull('NDA_MONDAY_WEBHOOK_SECRET') ||
      envOrNull('CONTRACTS_MONDAY_WEBHOOK_SECRET') ||
      envOrNull('SALES_LEAD_MONDAY_WEBHOOK_SECRET'),
    templateId: (
      envOrNull('DOCUSIGN_TEMPLATE_TEASER_NDA') || '637fff9c-b3a0-4134-8436-2c328cccc496'
    ).trim(),
    signingHookBaseUrl: envOrNull('TEASER_APPROVE_SIGNING_HOOK_BASE_URL'),
    columns: {
      // Make column IDs from live scenario inspection
      teaserStatus: envOrNull('TEASER_COL_STATUS') || 'color_mm2p27bz',
      emailWorkdoc: envOrNull('TEASER_COL_EMAIL_WORKDOC') || 'doc_mm33vz3v',
      teaserFolderLink: envOrNull('TEASER_COL_FOLDER_LINK') || 'link_mm4fr39r',
      primaryContactName: envOrNull('TEASER_COL_CONTACT_NAME') || 'lookup_mm2n36zw',
      primaryContactEmail: envOrNull('TEASER_COL_CONTACT_EMAIL') || 'lookup_mm2n5350',
      prospectiveEnvelopeId: envOrNull('TEASER_COL_ENVELOPE_ID') || 'text_mm38501w',
      updates: envOrNull('TEASER_COL_UPDATES'),
    },
    statusLabels: {
      trigger: getProjectEnv('TEASER_STATUS_TRIGGER') || 'Approved',
      sending: getProjectEnv('TEASER_STATUS_SENDING') || 'Sending Email',
      sent: getProjectEnv('TEASER_STATUS_SENT') || 'Email Sent',
      error: getProjectEnv('TEASER_STATUS_ERROR') || 'Error - See Update',
    },
    craig: {
      email: getProjectEnv('TEASER_CEO_EMAIL') || 'craig@cantarapet.com',
      name: getProjectEnv('TEASER_CEO_NAME') || 'Craig Pollack',
      roleName: getProjectEnv('TEASER_CEO_ROLE') || 'CEO',
    },
  }
}
