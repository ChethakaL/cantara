#!/bin/sh
set -e



# Start the Next.js application and run the Sales Leads scheduler in this container.
echo "Starting Next.js server..."
node server.js &
app_pid=$!

run_sales_leads_cron() {
  if [ -n "${CRON_SECRET:-}" ]; then
    wget -qO- --header="Authorization: Bearer ${CRON_SECRET}" "http://127.0.0.1:${PORT:-3000}/api/sales-leads/cron" >/dev/null || true
  else
    wget -qO- "http://127.0.0.1:${PORT:-3000}/api/sales-leads/cron" >/dev/null || true
  fi
}

(
  sleep "${SALES_LEADS_CRON_INITIAL_DELAY_SECONDS:-30}"
  while kill -0 "$app_pid" 2>/dev/null; do
    run_sales_leads_cron
    sleep "${SALES_LEADS_CRON_INTERVAL_SECONDS:-300}"
  done
) &
scheduler_pid=$!

cleanup() {
  kill "$scheduler_pid" 2>/dev/null || true
  kill "$app_pid" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

wait "$app_pid"
