#!/bin/sh
set -e

# Run migrations if DATABASE_URL is set
if [ -n "$DATABASE_URL" ]; then
  echo "Running database migrations..."
  if ! npx prisma migrate deploy; then
    # P3009: a previous migration failed; resolve as rolled-back and retry
    echo "Migration failed, attempting to resolve and retry..."
    npx prisma migrate resolve --rolled-back 20260226152000_add_client_document_ai_review 2>/dev/null || true
    npx prisma migrate deploy
  fi
fi

exec node server.js
