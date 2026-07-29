#!/bin/sh
set -e

# Start the Next.js application and run Sales Leads workers in this container.
echo "Starting Next.js server..."
node server.js &
app_pid=$!

# Hit an internal cron route. Failures are ignored so the loop keeps running.
run_cron() {
  path="$1"
  if [ -n "${CRON_SECRET:-}" ]; then
    wget -qO- --header="Authorization: Bearer ${CRON_SECRET}" \
      "http://127.0.0.1:${PORT:-3000}${path}" >/dev/null || true
  else
    wget -qO- "http://127.0.0.1:${PORT:-3000}${path}" >/dev/null || true
  fi
}

(
  sleep "${SALES_LEADS_CRON_INITIAL_DELAY_SECONDS:-30}"
  interval="${SALES_LEADS_CRON_INTERVAL_SECONDS:-300}"
  # Reconcile about once per hour when interval is 300s.
  reconcile_every="${SALES_LEADS_RECONCILE_EVERY_N:-12}"
  tick=0
  while kill -0 "$app_pid" 2>/dev/null; do
    # Stage / email-due advancement (also syncs those stage flips to Monday).
    run_cron /api/sales-leads/cron
    # Drain outbound Monday sync outbox + handoff outbox (Cantara edits → Monday).
    run_cron /api/cron/sales-leads-sync
    # Alternate due-date processor used by the sales-leads module.
    run_cron /api/cron/sales-leads

    tick=$((tick + 1))
    if [ "$tick" -ge "$reconcile_every" ]; then
      # Pull Monday → Cantara periodically.
      run_cron /api/cron/sales-leads-reconcile
      tick=0
    fi

    sleep "$interval"
  done
) &
scheduler_pid=$!

cleanup() {
  kill "$scheduler_pid" 2>/dev/null || true
  kill "$app_pid" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

wait "$app_pid"
