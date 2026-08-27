export type TriggerType =
  | 'webhook'
  | 'scheduled'
  | 'docusign_event'
  | 'monday_event'
  | 'client_event'

export type ActionType =
  | 'run_agent'
  | 'send_email'
  | 'sync_monday'
  | 'call_webhook'
  | 'custom_handler'
  | 'docusign_send'

export interface AutomationItem {
  id: string
  name: string
  description?: string
  status: 'active' | 'inactive'
  triggerType: TriggerType
  webhookSlug?: string
  webhookUrl?: string
  webhookSecret?: string
  scheduleExpression?: string
  actionType: ActionType
  actionTarget?: string
  createdAt: string
  lastTriggeredAt?: string | null
  totalRuns: number
  successCount: number
  errorCount: number
  /** Present on catalog / API-backed automations */
  steps?: Array<{ id: string; title: string; detail: string }>
  notes?: string[]
  handlerKey?: string
}

export interface AutomationExecutionLog {
  id: string
  automationId: string
  timestamp: string
  status: 'success' | 'failed' | 'running'
  durationMs?: number
  requestPayload?: any
  responsePayload?: any
  errorMessage?: string
}
