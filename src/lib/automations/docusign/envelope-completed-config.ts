import { getProjectEnv } from '@/lib/project-env'
import { envFlag, envOrNull } from '@/lib/automations/env'

export type EnvelopeDocKind = 'contract' | 'nda' | 'proposal'

export type EnvelopeCompletedConfig = {
  dealsBoardId: string
  dryRun: boolean
  updateMonday: boolean
  documentId: string
  webhookSecret: string | null
  /** Monday column title hints (IDs optional via env). */
  columns: {
    contractEnvelopeId: string | null
    ndaEnvelopeId: string | null
    proposalEnvelopeId: string | null
    contractFile: string | null
    ndaFile: string | null
    proposalFile: string | null
    contractStatus: string | null
    ndaStatus: string | null
    proposalStatus: string | null
  }
  statusLabels: {
    contractSigned: string
    ndaSigned: string
    proposalSigned: string
  }
}

export function getEnvelopeCompletedConfig(): EnvelopeCompletedConfig {
  return {
    dealsBoardId: (getProjectEnv('CONTRACTS_MONDAY_BOARD_ID') || '18398612826').trim(),
    dryRun: envFlag('AUTOMATIONS_ENVELOPE_COMPLETED_DRY_RUN', true),
    updateMonday: envFlag('AUTOMATIONS_ENVELOPE_COMPLETED_UPDATE_MONDAY', false),
    documentId: (getProjectEnv('DOCUSIGN_COMPLETED_DOCUMENT_ID') || '1').trim(),
    webhookSecret: envOrNull('DOCUSIGN_WEBHOOK_SECRET'),
    columns: {
      contractEnvelopeId: envOrNull('CONTRACTS_COL_CONTRACT_ENVELOPE_ID'),
      ndaEnvelopeId: envOrNull('CONTRACTS_COL_NDA_ENVELOPE_ID'),
      proposalEnvelopeId: envOrNull('CONTRACTS_COL_PROPOSAL_ENVELOPE_ID'),
      contractFile: envOrNull('CONTRACTS_COL_CONTRACT_FILE'),
      ndaFile: envOrNull('CONTRACTS_COL_NDA_FILE'),
      proposalFile: envOrNull('CONTRACTS_COL_PROPOSAL_FILE'),
      contractStatus: envOrNull('CONTRACTS_COL_CONTRACT_STATUS'),
      ndaStatus: envOrNull('CONTRACTS_COL_NDA_STATUS'),
      proposalStatus: envOrNull('CONTRACTS_COL_PROPOSAL_STATUS'),
    },
    statusLabels: {
      contractSigned: getProjectEnv('CONTRACTS_STATUS_SIGNED') || 'Contract Signed',
      ndaSigned: getProjectEnv('CONTRACTS_STATUS_NDA_SIGNED') || 'NDA Signed',
      proposalSigned: getProjectEnv('CONTRACTS_STATUS_PROPOSAL_SIGNED') || 'Proposal Signed',
    },
  }
}

export function kindColumnHints(kind: EnvelopeDocKind) {
  if (kind === 'contract') {
    return {
      envelopeTitles: ['contract envelope id', 'contract envelope'],
      fileTitles: ['contract file', 'contract'],
      statusTitles: ['contract status'],
      signedLabelKey: 'contractSigned' as const,
    }
  }
  if (kind === 'nda') {
    return {
      envelopeTitles: ['nda envelope id', 'nda envelope'],
      fileTitles: ['nda file', 'nda'],
      statusTitles: ['nda status'],
      signedLabelKey: 'ndaSigned' as const,
    }
  }
  return {
    envelopeTitles: ['proposal envelope id', 'proposal envelope'],
    fileTitles: ['proposal file', 'proposal'],
    statusTitles: ['proposal status'],
    signedLabelKey: 'proposalSigned' as const,
  }
}
