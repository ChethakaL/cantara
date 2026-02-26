#!/bin/sh
set -e

# Run migrations if DATABASE_URL is set (use node directly; npx/.bin not in standalone image)
if [ -n "$DATABASE_URL" ]; then
  echo "Running database migrations..."
  node ./node_modules/prisma/build/index.js migrate deploy
fi

exec node server.js
