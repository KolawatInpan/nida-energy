#!/bin/sh
# migrate-both-dbs.sh — Run Prisma migrate deploy on BOTH real and demo databases
# Usage: migrate-both-dbs.sh --schema ./prisma/schema.prisma

set -e

SCHEMA_PATH="./prisma/schema.prisma"

prev=""
for arg in "$@"; do
  if [ "$prev" = "--schema" ]; then
    SCHEMA_PATH="$arg"
  fi
  prev="$arg"
done

echo "=== Deploying migrations to REAL database (energy_trading) ==="
DATABASE_URL="${DATABASE_URL}" npx prisma migrate deploy --schema="$SCHEMA_PATH"
echo "=== REAL database migration complete ==="
echo ""

echo "=== Deploying migrations to DEMO database (energy_trading_demo) ==="
DATABASE_URL="${DATABASE_URL_DEMO}" npx prisma migrate deploy --schema="$SCHEMA_PATH"
echo "=== DEMO database migration complete ==="
echo ""

echo "=== Both databases migrated ==="
