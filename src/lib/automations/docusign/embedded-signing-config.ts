import { getProjectEnv } from '@/lib/project-env'
import { envFlag, envOrNull } from '@/lib/automations/env'

export type EmbeddedSigningConfig = {
  dryRun: boolean
  updateMondayOnError: boolean
  returnUrl: string
  teaserStatusColumnId: string
  statusErrorLabel: string
  updatesColumnId: string | null
}

export function getEmbeddedSigningConfig(): EmbeddedSigningConfig {
  return {
    // Safe: return JSON plan instead of live DocuSign redirect until flipped.
    dryRun: envFlag('AUTOMATIONS_EMBEDDED_SIGNING_DRY_RUN', true),
    updateMondayOnError: envFlag('AUTOMATIONS_EMBEDDED_SIGNING_UPDATE_MONDAY', false),
    returnUrl: getProjectEnv('DOCUSIGN_EMBEDDED_RETURN_URL') || 'https://app.docusign.com',
    // Same Teaser status column Make used on error
    teaserStatusColumnId: envOrNull('TEASER_COL_STATUS') || 'color_mm2p27bz',
    statusErrorLabel: getProjectEnv('TEASER_STATUS_ERROR') || 'Error - See Update',
    updatesColumnId: envOrNull('TEASER_COL_UPDATES'),
  }
}
