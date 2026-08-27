import { getProjectEnv } from '@/lib/project-env'
import { envFlag, envOrNull } from '@/lib/automations/env'

export type NdaPrimaryContactConfig = {
  boardId: string
  dryRun: boolean
  updateMonday: boolean
  webhookSecret: string | null
  columns: {
    ndaStatus: string | null
    prospectiveEnvelopeId: string | null
    clientEmail: string | null
    clientFullName: string | null
    updates: string | null
  }
  statusLabels: {
    trigger: string
    sending: string
    sent: string
    error: string
  }
}

export function getNdaPrimaryContactConfig(): NdaPrimaryContactConfig {
  return {
    boardId: (
      getProjectEnv('NDA_PRIMARY_MONDAY_BOARD_ID') ||
      getProjectEnv('NDA_MONDAY_BOARD_ID') ||
      getProjectEnv('CONTRACTS_MONDAY_BOARD_ID') ||
      '18398612826'
    ).trim(),
    dryRun: envFlag('AUTOMATIONS_NDA_PRIMARY_DRY_RUN', true),
    updateMonday: envFlag('AUTOMATIONS_NDA_PRIMARY_UPDATE_MONDAY', false),
    webhookSecret:
      envOrNull('NDA_PRIMARY_MONDAY_WEBHOOK_SECRET') ||
      envOrNull('NDA_MONDAY_WEBHOOK_SECRET') ||
      envOrNull('CONTRACTS_MONDAY_WEBHOOK_SECRET') ||
      envOrNull('SALES_LEAD_MONDAY_WEBHOOK_SECRET'),
    columns: {
      ndaStatus: envOrNull('NDA_COL_NDA_STATUS') || envOrNull('CONTRACTS_COL_NDA_STATUS'),
      prospectiveEnvelopeId:
        envOrNull('NDA_COL_PROSPECTIVE_ENVELOPE_ID') ||
        envOrNull('CONTRACTS_COL_NDA_ENVELOPE_ID'),
      clientEmail: envOrNull('NDA_COL_CLIENT_EMAIL') || envOrNull('CONTRACTS_COL_CLIENT_EMAIL'),
      clientFullName:
        envOrNull('NDA_COL_CLIENT_FULL_NAME') || envOrNull('CONTRACTS_COL_CLIENT_FULL_NAME'),
      updates: envOrNull('NDA_COL_UPDATES'),
    },
    statusLabels: {
      trigger: getProjectEnv('NDA_PRIMARY_STATUS_TRIGGER') || 'Send NDA',
      sending: getProjectEnv('NDA_PRIMARY_STATUS_SENDING') || 'Sending',
      sent: getProjectEnv('NDA_PRIMARY_STATUS_SENT') || 'NDA Sent',
      error: getProjectEnv('NDA_PRIMARY_STATUS_ERROR') || 'Error',
    },
  }
}
