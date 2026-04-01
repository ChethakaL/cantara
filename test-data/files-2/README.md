# WS1-6 Employee Obligations — Next.js File Reference

## File Map

```
types/
  ws1-6-types.ts              ← All TypeScript interfaces & types
  ws1-6-mock-data.ts          ← Foothills Pet Resort simulation data

components/ws1-6/
  Primitives.tsx              ← Shared UI atoms: FlagPill, FlagCard, BoolChip,
                                 RiskBadge, ComplexityBadge, DocStatusBadge,
                                 SectionLabel, CoverageGapAlert, TableCard, Th, Td
  ReportHeader.tsx            ← Sticky report header: badges, metric cards, tab nav
  TabPanels.tsx               ← All 8 tab panels (Summary, Documents, Agreements,
                                 Non-Competes, Benefits, Contractors, Key People,
                                 Craig's Review)

app/ws1/[clientId]/
  employee-obligations/
    page.tsx                  ← Orchestrator page: useState for flags + HITL,
                                 renders header + active tab panel
```

## Routing

Route: `/ws1/[clientId]/employee-obligations`

`clientId` is the Cantara client record ID. The page currently loads from
`foothillsReport` mock data — swap for your API/DB fetch when ready:

```tsx
// page.tsx — replace static import with:
const report = await fetchWS16Report(params.clientId) // your API call
```

## HITL State

Flag state is managed locally in `page.tsx` via `useState<Flag[]>`.
Each flag cycles through: `pending` → `confirmed` or `na` → back to `pending` on second click.

The "Release to WS1 master report" button in Craig's Review tab is disabled
until all 9 flags have a non-pending status. Wire it to your API:

```tsx
async function releaseToMasterReport() {
  await fetch(`/api/ws1/${clientId}/employee-obligations/release`, {
    method: 'POST',
    body: JSON.stringify({ flags }),
  })
}
```

## Tailwind Setup

All styling uses Tailwind utility classes. No custom CSS.
Confirm `tailwind.config.ts` includes these content paths:

```js
content: [
  './app/**/*.{ts,tsx}',
  './components/**/*.{ts,tsx}',
  './types/**/*.{ts,tsx}',
]
```

## Dependencies

No additional packages beyond the existing Cantara portal stack:
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- `clsx` / `cn` utility (standard in Cantara portal)

## Integration Points

| Downstream | What flows from WS1-6 |
|-----------|----------------------|
| WS1 Master Risk Report | All flags with `status === 'confirmed'` |
| WS2-5 Labor Expense Agent | `benefits` array (employer costs) + `keyPeople` headcount |
| MA-7 Transition Plan Generator | `buyerSummary.transitionConsiderations` + `keyPeople` table |
| CIM (MA-3) | `buyerSummary.workforceOverview` + `buyerSummary.nonCompeteProtections` |
