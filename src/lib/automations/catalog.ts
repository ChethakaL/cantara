import type { ActionType, AutomationItem, TriggerType } from '@/lib/automations/types'

export type AutomationStep = {
  id: string
  title: string
  detail: string
}

export type CatalogAutomation = AutomationItem & {
  steps: AutomationStep[]
  handlerKey:
    | 'contract_send'
    | 'nda_send'
    | 'nda_primary_contact'
    | 'buyer_nda_signed'
    | 'teaser_approve'
    | 'embedded_signing'
    | 'envelope_completed'
    | 'custom'
  notes?: string[]
}

const now = '2026-08-27T08:00:00.000Z'

/** Built-in automations migrated (or stubbed) from Make.com. */
export const AUTOMATION_CATALOG: CatalogAutomation[] = [
  {
    id: 'contract-send-from-monday',
    name: '[TAP] When Contract Status → Create Contract → Send DocuSign',
    description:
      'Monday Deals board: Create Contract → Creating Contract → DocuSign from template (Consulting / M&A) → Contract Sent. Dry-run until production DocuSign + Consulting template ID are set.',
    status: 'active',
    triggerType: 'monday_event' as TriggerType,
    webhookSlug: 'monday/contracts',
    webhookUrl: undefined,
    actionType: 'custom_handler' as ActionType,
    actionTarget: 'contract_send',
    createdAt: now,
    lastTriggeredAt: null,
    totalRuns: 0,
    successCount: 0,
    errorCount: 0,
    handlerKey: 'contract_send',
    steps: [
      { id: '1', title: 'Webhook', detail: 'Monday “Create Contract” → POST /api/webhooks/monday/contracts (event.pulseId)' },
      { id: '2', title: 'Load deal', detail: 'Get Monday item on board 18398612826 (email, full name, role, client type, deal code)' },
      { id: '3', title: 'Guardrails', detail: 'Skip if already complete / missing required fields' },
      { id: '4', title: 'Status', detail: 'Set Contract Status → Creating Contract' },
      { id: '5', title: 'Branch', detail: 'Client Type Consulting vs M&A → pick DocuSign template' },
      {
        id: '6',
        title: 'DocuSign',
        detail:
          'Create envelope from template (Craig CEO route 1 + client route 2; tabs = Client Type + Dealcode). Draft=No.',
      },
      { id: '7', title: 'Persist', detail: 'Save envelope ID on Monday deal + set Contract Sent' },
    ],
    notes: [
      'M&A template ID known: c5c3e4e8-d37a-41ea-bdb6-195805f5e325',
      'Consulting template ID still missing — set DOCUSIGN_TEMPLATE_CONSULTING when you have it',
      'Default dry-run: no live DocuSign send (AUTOMATIONS_CONTRACT_SEND_DRY_RUN=true)',
      'Portal DocuSign OAuth is currently demo; Make uses Craig production — cut over later',
    ],
  },
  {
    id: 'nda-send-from-monday',
    name: '[TAP] When NDA Status → Send NDA → Mutual DocuSign',
    description:
      'Monday Deals board: Send NDA → Sending NDA → validate deal fields → DocuSign mutual NDA template → save NDA Envelope ID → Awaiting Signatures. Dry-run until production DocuSign is cut over.',
    status: 'active',
    triggerType: 'monday_event' as TriggerType,
    webhookSlug: 'monday/nda',
    webhookUrl: undefined,
    actionType: 'custom_handler' as ActionType,
    actionTarget: 'nda_send',
    createdAt: now,
    lastTriggeredAt: null,
    totalRuns: 0,
    successCount: 0,
    errorCount: 0,
    handlerKey: 'nda_send',
    steps: [
      {
        id: '1',
        title: 'Webhook',
        detail: 'Monday “Send NDA” → POST /api/webhooks/monday/nda (event.pulseId)',
      },
      {
        id: '2',
        title: 'Load deal',
        detail: 'Get Monday item on board 18398612826 (email, full name, client type, contract status)',
      },
      {
        id: '3',
        title: 'Status',
        detail: 'Set NDA Status → Sending NDA',
      },
      {
        id: '4',
        title: 'Validate',
        detail:
          'Require Contract Signed + Client Type + Full Name + Email; else Error + Monday update message',
      },
      {
        id: '5',
        title: 'DocuSign',
        detail:
          'Create envelope from mutual NDA template 087dcc35-563d-43e1-94fc-942ad58d45a0 (Craig route 1 + client route 2). Subject: “[Deal] - NDA”.',
      },
      {
        id: '6',
        title: 'Persist',
        detail: 'Save NDA Envelope ID on Monday deal + set NDA Status → Awaiting Signatures',
      },
    ],
    notes: [
      'Board ID: 18398612826 (Deals :: public)',
      'DocuSign template ID: 087dcc35-563d-43e1-94fc-942ad58d45a0 (mutual NDA)',
      'Make also GETs template recipient tabs before send — tab prefill can be refined later',
      'Final Monday status is Awaiting Signatures (not “NDA Sent”)',
      'Default dry-run: no live DocuSign send (AUTOMATIONS_NDA_SEND_DRY_RUN=true)',
      'Monday writes gated: AUTOMATIONS_NDA_SEND_UPDATE_MONDAY=false by default',
      'On live send, writes AutomationBuyerNdaPending (envelopeId → board/item) for signed webhooks',
      'Portal DocuSign OAuth may still be demo; Make uses Craig production — cut over later',
      'Do not point Monday webhook here or disable Make until a dry-run + live checklist passes',
    ],
  },
  {
    id: 'nda-primary-contact-from-monday',
    name: '[TAP] When NDA Status → Send → Track Primary Contact',
    description:
      'Monday Deals board: Send NDA → Sending → read Prospective NDA Envelope ID → check DocuSign recipients → if primary contact completed set NDA Sent (else keep waiting). No new template — uses envelope from NDA send. Dry-run by default.',
    status: 'active',
    triggerType: 'monday_event' as TriggerType,
    webhookSlug: 'monday/nda-primary',
    webhookUrl: undefined,
    actionType: 'custom_handler' as ActionType,
    actionTarget: 'nda_primary_contact',
    createdAt: now,
    lastTriggeredAt: null,
    totalRuns: 0,
    successCount: 0,
    errorCount: 0,
    handlerKey: 'nda_primary_contact',
    steps: [
      {
        id: '1',
        title: 'Webhook',
        detail: 'Monday “Send NDA” (transaction) → POST /api/webhooks/monday/nda-primary (event.pulseId)',
      },
      {
        id: '2',
        title: 'Envelope check',
        detail: 'Require Prospective NDA Envelope ID; else Error branch',
      },
      {
        id: '3',
        title: 'Status',
        detail: 'Set NDA Status → Sending',
      },
      {
        id: '4',
        title: 'DocuSign recipients',
        detail:
          'GET envelope recipients for Prospective NDA Envelope ID (Composio: DOCUSIGN_GET_ENVELOPE)',
      },
      {
        id: '5',
        title: 'Primary contact',
        detail: 'Match primary contact by Client Email / name / Client role',
      },
      {
        id: '6',
        title: 'Update Monday',
        detail: 'If primary completed → NDA Sent; else leave Sending (waiting/tracking)',
      },
    ],
    notes: [
      'Board ID: 18398612826 (Deals :: public)',
      'No DocuSign template — depends on Scenario 1 envelope already created',
      'Envelope column: Prospective NDA Envelope ID',
      'Make path: GET /v2.1/accounts/{accountId}/envelopes/{envelopeId}/recipients',
      'Status labels: Sending → NDA Sent (Error if no envelope / DocuSign failure)',
      'Default dry-run: AUTOMATIONS_NDA_PRIMARY_DRY_RUN=true',
      'Monday writes gated: AUTOMATIONS_NDA_PRIMARY_UPDATE_MONDAY=false',
      'Runs after NDA send automation stores the envelope ID — do not cut Make over until both are verified',
    ],
  },
  {
    id: 'buyer-nda-signed-from-docusign',
    name: '[TAP] When Client Signed Prospective NDA (Buyers) → Archive + Mark YES',
    description:
      'DocuSign recipient-completed → look up envelopeId in pending map (Make Data Store transactions_boards_ids equivalent) → download PDF → upload to Monday boardId/itemId from that record → NDA Signed=YES + NDA Craig=Send. Dry-run by default.',
    status: 'active',
    triggerType: 'docusign_event' as TriggerType,
    webhookSlug: 'docusign/buyer-nda',
    webhookUrl: undefined,
    actionType: 'custom_handler' as ActionType,
    actionTarget: 'buyer_nda_signed',
    createdAt: now,
    lastTriggeredAt: null,
    totalRuns: 0,
    successCount: 0,
    errorCount: 0,
    handlerKey: 'buyer_nda_signed',
    steps: [
      {
        id: '1',
        title: 'Webhook',
        detail: 'DocuSign “When A Client Signed” (recipient-completed) → POST /api/webhooks/docusign/buyer-nda (envelopeId)',
      },
      {
        id: '2',
        title: 'Filter',
        detail: 'Continue for recipient-completed (client recipientId=1 by default)',
      },
      {
        id: '3',
        title: 'Data-store lookup',
        detail:
          'Make: Search Data Store transactions_boards_ids where Envelope ID = webhook.envelopeId → boardId + itemId. Cantara: AutomationBuyerNdaPending (or webhook monday hints)',
      },
      {
        id: '4',
        title: 'Download',
        detail: 'DocuSign download document id 1 from envelope',
      },
      {
        id: '5',
        title: 'Upload',
        detail: 'Monday upload using resolved boardId/itemId + fileColumnId from pending/env (Make used file_mm3c62fj on the old board)',
      },
      {
        id: '6',
        title: 'Status',
        detail: 'Set NDA Signed → YES and NDA Craig → Send',
      },
    ],
    notes: [
      'Make “Search Board ID” is a Data Store module (transactions_boards_ids), not a Monday board search',
      'Records are { envelopeId, boardId, itemId } — stale board 18413377201 lived in that store, not discovered live',
      'Cantara equivalent: AutomationBuyerNdaPending — written by NDA send via registerBuyerNdaPending',
      'Resolve order: webhook monday refs → pending store by envelopeId → optional BUYERS_NDA_MONDAY_BOARD_ID search',
      'DocuSign never sends Monday board/item IDs — only envelopeId',
      'File/status column IDs are board-specific; store fileColumnId on the pending row when the board is known',
      'Default dry-run: AUTOMATIONS_BUYER_NDA_SIGNED_DRY_RUN=true',
      'Monday writes gated: AUTOMATIONS_BUYER_NDA_SIGNED_UPDATE_MONDAY=false',
    ],
  },
  {
    id: 'teaser-approve-send-to-buyer',
    name: '[TAP] When Teaser Draft Approved → Email Teaser PDF + NDA Signing',
    description:
      'Monday Teaser Draft → Approved → Sending Email → validate buyer → Workdoc email + Teaser PDF from Drive → DocuSign prospective NDA (template 637fff9c…) → register pending store → email buyer with signing button → Email Sent. Board ID is dynamic from webhook. Dry-run by default.',
    status: 'active',
    triggerType: 'monday_event' as TriggerType,
    webhookSlug: 'monday/teaser-approve',
    webhookUrl: undefined,
    actionType: 'custom_handler' as ActionType,
    actionTarget: 'teaser_approve',
    createdAt: now,
    lastTriggeredAt: null,
    totalRuns: 0,
    successCount: 0,
    errorCount: 0,
    handlerKey: 'teaser_approve',
    steps: [
      {
        id: '1',
        title: 'Webhook',
        detail: 'Monday “Approved” → POST /api/webhooks/monday/teaser-approve (event.boardId + event.pulseId)',
      },
      {
        id: '2',
        title: 'Status',
        detail: 'Set color_mm2p27bz → Sending Email',
      },
      {
        id: '3',
        title: 'Validate',
        detail:
          'Require Primary Contact Name/Email + Teaser folder link; skip if Prospective NDA Envelope ID already set',
      },
      {
        id: '4',
        title: 'Email template',
        detail: 'Load Monday Workdoc doc_mm33vz3v; parse Subject:/Body: (Make used Gemini; Cantara can use Claude)',
      },
      {
        id: '5',
        title: 'Teaser PDF',
        detail: 'Google Drive folder from link_mm4fr39r → download one PDF',
      },
      {
        id: '6',
        title: 'DocuSign',
        detail:
          'Create envelope from template 637fff9c-b3a0-4134-8436-2c328cccc496 (roles Client + CEO, clientUserId = pulseId)',
      },
      {
        id: '7',
        title: 'Pending store',
        detail: 'registerBuyerNdaPending(envelopeId, boardId, itemId) — feeds buyer-nda-signed automation',
      },
      {
        id: '8',
        title: 'Email buyer',
        detail: 'Gmail HTML + Teaser PDF attach + Review & Signing NDA button (gated by SEND_EMAIL flag)',
      },
      {
        id: '9',
        title: 'Persist',
        detail: 'Status → Email Sent; text_mm38501w → envelopeId',
      },
    ],
    notes: [
      'Board ID is DYNAMIC from webhook event.boardId — do not use Make’s stale error-handler board 18398610807',
      'DocuSign template: 637fff9c-b3a0-4134-8436-2c328cccc496 (roles must be Client + CEO)',
      'Columns: status color_mm2p27bz, workdoc doc_mm33vz3v, folder link_mm4fr39r, name lookup_mm2n36zw, email lookup_mm2n5350, envelope text_mm38501w',
      'Writes AutomationBuyerNdaPending so recipient-completed can find board/item',
      'Default dry-run: AUTOMATIONS_TEASER_APPROVE_DRY_RUN=true',
      'Monday writes: AUTOMATIONS_TEASER_APPROVE_UPDATE_MONDAY=false',
      'Gmail attach still gated: AUTOMATIONS_TEASER_APPROVE_SEND_EMAIL=false (Drive download + Gmail attachment next)',
      'Make risk retained: DocuSign runs before Gmail — if email fails, duplicate guard may block retry',
      'Embedded signing button points at TEASER_APPROVE_SIGNING_HOOK_BASE_URL or /api/webhooks/docusign/embedded-signing',
    ],
  },
  {
    id: 'docusign-embedded-signing',
    name: '[TAP] Review & Signing NDA Button → Embedded DocuSign',
    description:
      'Gmail “Review & Signing NDA” link click → GET recipients → pick Client/CEO → create DocuSign recipient view → HTTP 302 to signing URL. Params: envelope, itemId, boardId, role. Dry-run returns JSON plan (no redirect).',
    status: 'active',
    triggerType: 'webhook' as TriggerType,
    webhookSlug: 'docusign/embedded-signing',
    webhookUrl: undefined,
    actionType: 'docusign_send' as ActionType,
    actionTarget: 'embedded_signing',
    createdAt: now,
    lastTriggeredAt: null,
    totalRuns: 0,
    successCount: 0,
    errorCount: 0,
    handlerKey: 'embedded_signing',
    steps: [
      {
        id: '1',
        title: 'Webhook',
        detail:
          'GET /api/webhooks/docusign/embedded-signing?envelope=&itemId=&boardId=&role=Client|CEO',
      },
      {
        id: '2',
        title: 'Get recipients',
        detail: 'DocuSign GET envelope recipients (via DOCUSIGN_GET_ENVELOPE)',
      },
      {
        id: '3',
        title: 'Select signer',
        detail: 'role=Client → order 1; role=CEO → order 2 (also match roleName)',
      },
      {
        id: '4',
        title: 'Recipient view',
        detail:
          'DOCUSIGN_CREATE_RECIPIENT_VIEW_URL (authenticationMethod=None, returnUrl=app.docusign.com)',
      },
      {
        id: '5',
        title: 'Redirect',
        detail: 'HTTP 302 Location = signing URL',
      },
      {
        id: '6',
        title: 'Error path',
        detail:
          'On DocuSign failure: Monday update using webhook boardId/itemId + color_mm2p27bz → Error - See Update',
      },
    ],
    notes: [
      'No board ID or DocuSign template hardcoded — all from query string',
      'Teaser-approve emails should link here (replaces Make hook.us2.make.com/…)',
      'Requires captive recipients (clientUserId) on the envelope — set when Teaser approve creates the envelope',
      'Default dry-run: AUTOMATIONS_EMBEDDED_SIGNING_DRY_RUN=true (JSON plan, no 302)',
      'Monday error writes gated: AUTOMATIONS_EMBEDDED_SIGNING_UPDATE_MONDAY=false',
      'Recipient view URLs expire ~5 minutes — generate on click, not ahead of time',
    ],
  },
  {
    id: 'docusign-envelope-completed',
    name: '[TAP] When Envelope is Signed/Completed → Add Document & Mark Signed',
    description:
      'DocuSign completed → find Deals item by Contract/NDA/Proposal Envelope ID → download signed PDF → upload to Monday file column → set Signed status. Dry-run by default.',
    status: 'active',
    triggerType: 'docusign_event' as TriggerType,
    webhookSlug: 'docusign',
    webhookUrl: undefined,
    actionType: 'custom_handler' as ActionType,
    actionTarget: 'envelope_completed',
    createdAt: now,
    lastTriggeredAt: null,
    totalRuns: 0,
    successCount: 0,
    errorCount: 0,
    handlerKey: 'envelope_completed',
    steps: [
      { id: '1', title: 'Webhook', detail: 'DocuSign Connect → POST /api/webhooks/docusign (envelope completed)' },
      { id: '2', title: 'Filter', detail: 'Continue only when envelope status = completed' },
      {
        id: '3',
        title: 'Match deal',
        detail:
          'Search Monday Deals (18398612826) where Contract/NDA/Proposal Envelope ID = webhook envelopeId',
      },
      { id: '4', title: 'Download', detail: 'DocuSign get document id 1 (signed PDF)' },
      {
        id: '5',
        title: 'Upload + status',
        detail:
          'Upload to Contract/NDA/Proposal File column → set Contract Signed / NDA Signed / Proposal Signed',
      },
      {
        id: '6',
        title: 'Buyer path (later)',
        detail: 'Prospective NDA via temp store (Make data store) — stub until we add a Cantara pending-NDA table',
      },
    ],
    notes: [
      'DO NOT turn off Make until live path is verified (see test plan below)',
      'No DocuSign template ID — uses completed envelopeId only',
      'Deals board 18398612826; match Contract/NDA/Proposal Envelope ID columns',
      'Download via DOCUSIGN_RETRIEVE_ENVELOPE_DOCUMENTS (document id 1)',
      'Upload via Monday add_file_to_column; status → Contract/NDA/Proposal Signed',
      'Dedupe: AutomationProcessedEnvelope table',
      'Buyer path: AutomationBuyerNdaPending (filled by NDA send registerBuyerNdaPending)',
      'Default dry-run ON — AUTOMATIONS_ENVELOPE_COMPLETED_DRY_RUN=true',
      'Test plan: (1) set Monday column ID envs if titles do not resolve (2) production DocuSign Connect → /api/webhooks/docusign (3) flip dry-run+updateMonday (4) complete one demo envelope (5) confirm Monday file+status (6) re-send same webhook → dedupe skip (7) only then disable Make',
    ],
  },
]

export function getCatalogAutomation(id: string) {
  return AUTOMATION_CATALOG.find(a => a.id === id) ?? null
}

export function listCatalogAutomations(): CatalogAutomation[] {
  return AUTOMATION_CATALOG
}
