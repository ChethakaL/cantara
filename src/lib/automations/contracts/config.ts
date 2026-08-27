import { getProjectEnv } from '@/lib/project-env'
import { envFlag, envOrNull } from '@/lib/automations/env'

export type ContractSendConfig = {
  boardId: string
  dryRun: boolean
  updateMonday: boolean
  webhookSecret: string | null
  templates: {
    ma: string | null
    consulting: string | null
  }
  /** Optional Monday column IDs; if empty, resolve by title at runtime. */
  columns: {
    contractStatus: string | null
    clientEmail: string | null
    clientFullName: string | null
    clientRole: string | null
    clientType: string | null
    dealCode: string | null
    envelopeId: string | null
  }
  statusLabels: {
    trigger: string
    creating: string
    sent: string
    sentRevised: string
    error: string
  }
  craig: {
    email: string
    name: string
    roleName: string
  }
}

export function getContractSendConfig(): ContractSendConfig {
  return {
    boardId: (getProjectEnv('CONTRACTS_MONDAY_BOARD_ID') || '18398612826').trim(),
    // Safe default: never send real envelopes until explicitly disabled.
    dryRun: envFlag('AUTOMATIONS_CONTRACT_SEND_DRY_RUN', true),
    updateMonday: envFlag('AUTOMATIONS_CONTRACT_SEND_UPDATE_MONDAY', false),
    webhookSecret: envOrNull('CONTRACTS_MONDAY_WEBHOOK_SECRET') || envOrNull('SALES_LEAD_MONDAY_WEBHOOK_SECRET'),
    templates: {
      ma: envOrNull('DOCUSIGN_TEMPLATE_MA') || 'c5c3e4e8-d37a-41ea-bdb6-195805f5e325',
      consulting: envOrNull('DOCUSIGN_TEMPLATE_CONSULTING'),
    },
    columns: {
      contractStatus: envOrNull('CONTRACTS_COL_CONTRACT_STATUS'),
      clientEmail: envOrNull('CONTRACTS_COL_CLIENT_EMAIL'),
      clientFullName: envOrNull('CONTRACTS_COL_CLIENT_FULL_NAME'),
      clientRole: envOrNull('CONTRACTS_COL_CLIENT_ROLE'),
      clientType: envOrNull('CONTRACTS_COL_CLIENT_TYPE'),
      dealCode: envOrNull('CONTRACTS_COL_DEALCODE'),
      envelopeId: envOrNull('CONTRACTS_COL_ENVELOPE_ID'),
    },
    statusLabels: {
      trigger: getProjectEnv('CONTRACTS_STATUS_TRIGGER') || 'Create Contract',
      creating: getProjectEnv('CONTRACTS_STATUS_CREATING') || 'Creating Contract',
      sent: getProjectEnv('CONTRACTS_STATUS_SENT') || 'Contract Sent',
      sentRevised: getProjectEnv('CONTRACTS_STATUS_SENT_REVISED') || 'Contract Sent - Revised',
      error: getProjectEnv('CONTRACTS_STATUS_ERROR') || 'Error - See Update',
    },
    craig: {
      email: getProjectEnv('CONTRACTS_CEO_EMAIL') || 'craig@cantarapet.com',
      name: getProjectEnv('CONTRACTS_CEO_NAME') || 'Craig Pollack',
      roleName: getProjectEnv('CONTRACTS_CEO_ROLE') || 'CEO',
    },
  }
}
