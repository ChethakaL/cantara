# TTM Agent Fix Summary

## What was fixed

1. GL prefix constraints were added to TTM mapping.
When a P&L GL code starts with `4`, mapping candidates are restricted to `REV-*`.
When a P&L GL code starts with `5`, mapping candidates are restricted to `COGS-*`.
When a P&L GL code starts with `6-9`, mapping candidates are restricted to `OPX-*`.
This prevents `5xxx` COGS rows like `Grooming Supplies` and `Retail COGS` from being incorrectly mapped into revenue codes.

2. Calculated summary rows are now skipped.
Rows such as `Net Income`, `Gross Profit`, `EBITDA`, `Subtotal`, and similar calculated/summary lines are excluded from mapping logic so they do not appear as false-positive Section A mapping requests.

3. Cash accounts are excluded from WC mapping flags.
Balance-sheet rows containing `Cash`, `Checking`, `Petty Cash`, `Savings`, or similar cash labels are no longer raised as Section A mapping requests. They remain outside the Cantara working-capital mapping scope.

4. AR customer-name extraction was corrected.
The AR aging parser now explicitly looks for a `customer/client/account/name` header column instead of assuming the customer column is immediately before the first aging bucket. This fixes the bug where a numeric AR value was being used as the customer name in concentration flags.

5. The admin review UI remains dashboard-style.
The TTM review panel no longer shows raw JSON payload dumps. It renders section-specific reviewer cards and action controls.

## Expected behavioral result

- Section C should stop showing the mirrored revenue/COGS variance pattern caused by `5xxx` rows being mapped to `REV-*`.
- Section A should no longer flag `NET INCOME (Pre-Recast)`.
- Section A should no longer flag `Cash & Checking`.
- Section E concentration flags should use the actual customer name instead of a dollar amount.

## What was not changed

- The AR aging vs balance-sheet AR mismatch is still expected if the underlying test files remain inconsistent.
- If the AR aging workbook totals about `$17,380` while the balance sheet shows about `$9,669`, Section E should still raise that reconciliation issue. That is a test-data problem, not an agent bug.

## Files changed

- `src/lib/ttm-agent/mapping.ts`
- `src/lib/ttm-agent/parsers/excel.ts`
- `src/lib/ttm-agent/reconciler.ts`
- `src/components/ttm-agent/CraigReviewDashboard.tsx`
- `src/components/ttm-agent/TtmAnalysisTab.tsx`
- `src/components/ttm-agent/WCSummary.tsx`
- `src/lib/ttm-agent/wc-calculator.ts`
- `src/app/api/client-documents/view/route.ts`
- `src/app/api/auth/client/login/route.ts`
- `src/app/api/auth/client/register/route.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/nylas/callback/route.ts`
- `src/app/api/auth/nylas/connect/route.ts`

## Build status

- `npm run build` completed successfully on March 20, 2026.
