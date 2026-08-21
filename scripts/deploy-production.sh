#!/usr/bin/env bash
# Cantara production deploy — preserves live .env (never overwrite from template).
# Run on the Cantara server: bash /home/ubuntu/apps/cantara/deploy.sh
set -euo pipefail

APP_ROOT="${APP_ROOT:-/home/ubuntu/apps/cantara}"
REPO="${APP_ROOT}/repo"
ENV_FILE="${REPO}/.env"
ENV_BACKUP_DIR="${APP_ROOT}/backups"
ENV_SNAPSHOT="${CANTARA_ENV_SNAPSHOT:-/home/ubuntu/migration/cantara.env.production}"
DB_CREDS="${APP_ROOT}/.db-credentials"
LOG="${APP_ROOT}/deploy-$(date +%Y%m%d-%H%M%S).log"
IMAGE="${CANTARA_IMAGE:-cantara:latest}"
CONTAINER="${CANTARA_CONTAINER:-cantara}"
NETWORK="${CANTARA_NETWORK:-cantara-net}"
PORT="${CANTARA_PORT:-3020}"
BRANCH="${CANTARA_BRANCH:-cantara-v3}"

REQUIRED_KEYS=(
  DATABASE_URL
  NEXTAUTH_URL
  NEXTAUTH_SECRET
  COMPOSIO_API_KEY
  AI_PROVIDER
  AWS_REGION
)

exec > >(tee "$LOG") 2>&1
echo "=== Cantara deploy $(date) ==="

mkdir -p "$ENV_BACKUP_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: Missing $ENV_FILE — create it manually; deploy will not seed from template."
  exit 1
fi

cp "$ENV_FILE" "${ENV_BACKUP_DIR}/.env.pre-deploy.$(date +%Y%m%d-%H%M%S)"
echo "Backed up .env to ${ENV_BACKUP_DIR}/"

cd "$REPO"

echo "=== git pull origin ${BRANCH} ==="
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"
git log -1 --oneline

# Keep DATABASE_URL aligned with local postgres password only (never replace whole .env).
if [[ -f "$DB_CREDS" ]]; then
  # shellcheck disable=SC1090
  source "$DB_CREDS"
  if grep -q '^DATABASE_URL=' "$ENV_FILE"; then
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://cantara:${POSTGRES_PASSWORD}@cantara-postgres:5432/cantara_next|" "$ENV_FILE"
  fi
fi

chmod 600 "$ENV_FILE"

echo "=== Verify required env keys ==="
missing=0
for key in "${REQUIRED_KEYS[@]}"; do
  if ! grep -q "^${key}=" "$ENV_FILE"; then
    echo "MISSING: $key"
    missing=1
  fi
done
if [[ "$missing" -ne 0 ]]; then
  echo "ERROR: .env is missing required keys. Restore from ${ENV_BACKUP_DIR}/ and retry."
  exit 1
fi

echo "=== Docker build ==="
docker build -t "$IMAGE" .

echo "=== Recreate ${CONTAINER} (postgres untouched) ==="
docker rm -f "$CONTAINER" 2>/dev/null || true
docker run -d \
  --name "$CONTAINER" \
  --restart unless-stopped \
  --network "$NETWORK" \
  --env-file "$ENV_FILE" \
  -p "127.0.0.1:${PORT}:3000" \
  "$IMAGE"

echo "=== Apply idempotent SQL migrations (postgres data preserved) ==="
# deploy.sh historically never ran Prisma migrate; apply safe SQL only.
# Keep every file idempotent (IF NOT EXISTS / exception handlers) so re-runs are safe.
apply_sql() {
  local label="$1"
  local file="$2"
  if [[ -f "$file" ]]; then
    echo "--- $label ---"
    docker exec -i cantara-postgres psql -U cantara -d cantara_next -v ON_ERROR_STOP=1 < "$file"
  else
    echo "WARN: missing $file"
  fi
}

apply_sql "RealEstateAppraisalReport" "${REPO}/prisma/migrations/20260714_add_real_estate_appraisal/migration.sql"
apply_sql "Occupancy Review deactivate form questions" "${REPO}/prisma/migrations/20260728120000_move_occupancy_review_to_document_upload/migration.sql"
apply_sql "ChatMessage attachments" "${REPO}/prisma/migrations/20260728130000_add_chat_attachments/migration.sql"
apply_sql "SalesLead tables" "${REPO}/prisma/migrations/20260722_add_sales_leads/migration.sql"
apply_sql "SalesLead stageStartDate" "${REPO}/prisma/migrations/20260806_add_stage_start_date/migration.sql"
apply_sql "OutreachAsset table" "${REPO}/prisma/migrations/20260806_add_outreach_assets/migration.sql"
apply_sql "Client portal invite notification type" "${REPO}/prisma/migrations/20260818_add_client_portal_invite_notification/migration.sql"
apply_sql "Advisor mail connections" "${REPO}/prisma/migrations/20260819_add_advisor_mail_connections/migration.sql"
apply_sql "Client timeline stages" "${REPO}/prisma/migrations/20260819_add_client_timeline_stages/migration.sql"
apply_sql "Outreach asset fill-in fields" "${REPO}/prisma/migrations/20260819_add_outreach_asset_fill_in_fields/migration.sql"
apply_sql "Occupancy capacity required info restore" "${REPO}/prisma/migrations/20260818200000_restore_occupancy_capacity_required_info/migration.sql"
apply_sql "SalesLead businessPosition and officePhone" "${REPO}/prisma/migrations/20260821_add_sales_lead_position_office_phone/migration.sql"

sleep 12
curl -sf -o /dev/null -w "local:%{http_code}\n" "http://127.0.0.1:${PORT}/" || echo "local:fail"
curl -sf -o /dev/null -w "login:%{http_code}\n" "http://127.0.0.1:${PORT}/login/admin" || echo "login:fail"

# Refresh migration snapshot FROM live .env (never the reverse).
mkdir -p "$(dirname "$ENV_SNAPSHOT")"
cp "$ENV_FILE" "$ENV_SNAPSHOT"
chmod 600 "$ENV_SNAPSHOT"

git rev-parse --short HEAD > "${APP_ROOT}/DEPLOYED_COMMIT"
echo "=== Deploy complete ==="
