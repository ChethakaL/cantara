# Cantara Sales Leads - API Build Map

This module implements the approved Day 0 / 7 / 14 / 21 outbound workflow in Cantara Next. PostgreSQL is authoritative; Monday.com is synchronized through an outbox and inbound reconciliation.

## Automation map

| PDF automation | Trigger | API/service implementation | Result |
|---|---|---|---|
| A1 Start Email 1 | Email 1 Due reaches its scheduled date or explicit send action | `sendSequenceEmail(id, 1)` | Sends configured template, sets Email 1 Sent, contact date today, next action +7 calendar days |
| A2 Make Call 1 Due | Email 1 Sent action date arrives | `processSalesLeadDueDates()` | Sets Call 1 Due |
| A3 Complete Call 1 | Call result recorded during Call 1 Due | `recordSalesLeadCall()` | Sets contact date; normally sets Email 2 Due at +7 days; approved exception can pause/stop |
| A4 Send Email 2 | Email 2 Due action date arrives or explicit send action | `sendSequenceEmail(id, 2)` | Sends configured template, sets Email 2 Sent, contact date today, next action +7 days |
| A5 Make Call 2 Due | Email 2 Sent action date arrives | `processSalesLeadDueDates()` | Sets Call 2 Due |
| A6 Complete Call 2 | Call result recorded during Call 2 Due | `recordSalesLeadCall()` | Sets contact date and terminal/exception disposition; defaults to Completed - No Response |
| A7 Callback | Stage/disposition becomes Needs Follow-Up | `changeStage()` / `recordCallResult()` | Requires future callback date and pauses standard sequence |
| A8 Reconnect Later | Stage/disposition becomes Reconnect Later | `changeStage()` / `recordCallResult()` | Clears standard action date and pauses sequence |
| A9 No-response nurture | Completed - No Response | Sync handoff outbox | Stops sequence; queues Nurture handoff |
| A10 Not-interested nurture | Not Interested - To Nurture | Sync handoff outbox | Stops sequence; queues Nurture handoff |
| A11 Deals/CRM | Booked with booking date/time | Sync handoff outbox | Stops sequence; queues Deals/CRM handoff |
| A12 Stop protection | Any terminal stage | `changeStage()` and `processDueDate()` | Blocks automatic advancement and implicit restart |

## API routes

- `GET/POST/PATCH /api/sales-leads`
- `POST /api/sales-leads/:id/actions`
- `GET /api/sales-leads/:id/activities`
- `POST /api/sales-leads/import`
- `GET /api/cron/sales-leads`
- `GET /api/cron/sales-leads-sync`
- `GET /api/cron/sales-leads-reconcile`
- `POST /api/webhooks/monday/sales-leads`

## Required integration configuration

These values are implementation dependencies in the source specification and must be supplied by Cantara:

- `SALES_LEAD_MONDAY_BOARD_ID`
- `SALES_LEAD_MONDAY_COLUMN_MAPPING` - JSON object mapping Sales Lead field keys to Monday column IDs
- `SALES_LEAD_MONDAY_CALLER_MAPPING` - JSON object mapping Cantara User IDs to Monday person IDs
- `SALES_LEAD_NURTURE_BOARD_ID`
- `SALES_LEAD_NURTURE_COLUMN_MAPPING`
- `SALES_LEAD_DEALS_BOARD_ID`
- `SALES_LEAD_DEALS_COLUMN_MAPPING`
- `SALES_LEAD_MONDAY_WEBHOOK_SECRET`
- `SALES_LEAD_EMAIL_1_DIRECT_SUBJECT` and `SALES_LEAD_EMAIL_1_DIRECT_BODY`
- `SALES_LEAD_EMAIL_1_GENERAL_SUBJECT` and `SALES_LEAD_EMAIL_1_GENERAL_BODY`
- `SALES_LEAD_EMAIL_2_DIRECT_SUBJECT` and `SALES_LEAD_EMAIL_2_DIRECT_BODY`
- `SALES_LEAD_EMAIL_2_GENERAL_SUBJECT` and `SALES_LEAD_EMAIL_2_GENERAL_BODY`

Email bodies support `{{businessName}}`, `{{ownerFirstName}}`, `{{ownerLastName}}`, `{{city}}`, and `{{state}}`.

## Acceptance verification

Run:

```bash
npm run test:sales-leads
```

The suite includes the seven named PDF acceptance scenarios plus admission-validation and caller-required checks.
