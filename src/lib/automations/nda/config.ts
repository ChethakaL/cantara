import { getProjectEnv } from '@/lib/project-env'
import { envFlag, envOrNull } from '@/lib/automations/env'

export type NdaSendConfig = {
  boardId: string
  dryRun: boolean
  updateMonday: boolean
  webhookSecret: string | null
  /** Mutual NDA DocuSign template (Make: 087dcc35-563d-43e1-94fc-942ad58d45a0). */
  templateId: string
  /** Optional Monday column IDs; if empty, resolve by title at runtime. */
  columns: {
    ndaStatus: string | null
    clientEmail: string | null
    clientFullName: string | null
    clientRole: string | null
    clientType: string | null
    contractStatus: string | null
    envelopeId: string | null
    updates: string | null
  }
  statusLabels: {
    trigger: string
    sending: string
    awaiting: string
    error: string
  }
  craig: {
    email: string
    name: string
    roleName: string
  }
}

export function getNdaSendConfig(): NdaSendConfig {
  return {
    boardId: (
      getProjectEnv('NDA_MONDAY_BOARD_ID') ||
      getProjectEnv('CONTRACTS_MONDAY_BOARD_ID') ||
      '18398612826'
    ).trim(),
    // Safe default: never send real envelopes until explicitly disabled.
    dryRun: envFlag('AUTOMATIONS_NDA_SEND_DRY_RUN', true),
    updateMonday: envFlag('AUTOMATIONS_NDA_SEND_UPDATE_MONDAY', false),
    webhookSecret:
      envOrNull('NDA_MONDAY_WEBHOOK_SECRET') ||
      envOrNull('CONTRACTS_MONDAY_WEBHOOK_SECRET') ||
      envOrNull('SALES_LEAD_MONDAY_WEBHOOK_SECRET'),
    templateId: (envOrNull('DOCUSIGN_TEMPLATE_NDA') || '087dcc35-563d-43e1-94fc-942ad58d45a0').trim(),
    columns: {
      ndaStatus: envOrNull('NDA_COL_NDA_STATUS') || envOrNull('CONTRACTS_COL_NDA_STATUS'),
      clientEmail: envOrNull('NDA_COL_CLIENT_EMAIL') || envOrNull('CONTRACTS_COL_CLIENT_EMAIL'),
      clientFullName:
        envOrNull('NDA_COL_CLIENT_FULL_NAME') || envOrNull('CONTRACTS_COL_CLIENT_FULL_NAME'),
      clientRole: envOrNull('NDA_COL_CLIENT_ROLE') || envOrNull('CONTRACTS_COL_CLIENT_ROLE'),
      clientType: envOrNull('NDA_COL_CLIENT_TYPE') || envOrNull('CONTRACTS_COL_CLIENT_TYPE'),
      contractStatus:
        envOrNull('NDA_COL_CONTRACT_STATUS') || envOrNull('CONTRACTS_COL_CONTRACT_STATUS'),
      envelopeId: envOrNull('NDA_COL_ENVELOPE_ID') || envOrNull('CONTRACTS_COL_NDA_ENVELOPE_ID'),
      updates: envOrNull('NDA_COL_UPDATES'),
    },
    statusLabels: {
      trigger: getProjectEnv('NDA_STATUS_TRIGGER') || 'Send NDA',
      sending: getProjectEnv('NDA_STATUS_SENDING') || 'Sending NDA',
      awaiting: getProjectEnv('NDA_STATUS_AWAITING') || 'Awaiting Signatures',
      error: getProjectEnv('NDA_STATUS_ERROR') || 'Error',
    },
    craig: {
      email: getProjectEnv('NDA_CEO_EMAIL') || getProjectEnv('CONTRACTS_CEO_EMAIL') || 'craig@cantarapet.com',
      name: getProjectEnv('NDA_CEO_NAME') || getProjectEnv('CONTRACTS_CEO_NAME') || 'Craig Pollack',
      roleName: getProjectEnv('NDA_CEO_ROLE') || getProjectEnv('CONTRACTS_CEO_ROLE') || 'CEO',
    },
  }
}
