#!/bin/sh
# push-both-dbs.sh — Push Prisma schema to BOTH real and demo databases
# Usage: push-both-dbs.sh [--accept-data-loss] [--schema ./prisma/schema.prisma]

set -e

ACCEPT_DATA_LOSS=""
SCHEMA_PATH="./prisma/schema.prisma"
EXTRA_ARGS=""

for arg in "$@"; do
  case "$arg" in
    --accept-data-loss) ACCEPT_DATA_LOSS="--accept-data-loss" ;;
    --schema) ;;  # next arg handled below
    --schema=*) SCHEMA_PATH="${arg#--schema=}" ;;
    *) EXTRA_ARGS="$EXTRA_ARGS $arg" ;;
  esac
done

# Also handle --schema with space-separated value
prev=""
for arg in "$@"; do
  if [ "$prev" = "--schema" ]; then
    SCHEMA_PATH="$arg"
  fi
  prev="$arg"
done

echo "=== Pushing schema to REAL database (energy_trading) ==="
DATABASE_URL="${DATABASE_URL}" npx prisma db push $ACCEPT_DATA_LOSS --schema="$SCHEMA_PATH" $EXTRA_ARGS
echo "=== REAL database push complete ==="
echo ""

echo "=== Pushing schema to DEMO database (energy_trading_demo) ==="
DATABASE_URL="${DATABASE_URL_DEMO}" npx prisma db push $ACCEPT_DATA_LOSS --schema="$SCHEMA_PATH" $EXTRA_ARGS
echo "=== DEMO database push complete ==="
echo ""

echo "=== Both databases ready ==="
