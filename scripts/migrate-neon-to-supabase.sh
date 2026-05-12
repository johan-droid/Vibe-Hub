#!/usr/bin/env bash
# Migration helper: dump a Neon (or other Postgres) database and restore into Supabase.
# Usage:
#   chmod +x scripts/migrate-neon-to-supabase.sh
#   ./scripts/migrate-neon-to-supabase.sh \
#     --from "postgresql://user:pass@neon-host:5432/dbname" \
#     --to "postgresql://user:pass@project.supabase.co:5432/dbname" \
#     --dump dumpfile.dump

set -euo pipefail

usage() {
  echo "Usage: $0 --from <source-conn> --to <target-conn> --dump <dumpfile>"
  exit 1
}

SOURCE_CONN=""
TARGET_CONN=""
DUMP_FILE="dump.dump"

while [[ $# -gt 0 ]]; do
  case $1 in
    --from) SOURCE_CONN="$2"; shift 2;;
    --to) TARGET_CONN="$2"; shift 2;;
    --dump) DUMP_FILE="$2"; shift 2;;
    *) usage;;
  esac
done

if [[ -z "$SOURCE_CONN" || -z "$TARGET_CONN" ]]; then
  usage
fi

echo "Dumping source database to $DUMP_FILE..."
# Use pg_dump custom format to preserve roles/ownership flags separately
PGSSLMODE=require pg_dump --format=custom --no-owner --no-privileges --dbname="$SOURCE_CONN" --file="$DUMP_FILE"

echo "Creating extensions on target (vector, pgcrypto, etc.)..."
# Create common extensions on the target. Adjust as needed for your schema.
PSQLTARGET="psql $TARGET_CONN"
$PSQLTARGET -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
$PSQLTARGET -c "CREATE EXTENSION IF NOT EXISTS vector;" || echo "Warning: vector extension may need to be enabled via Supabase UI or SQL Editor as a project owner."

echo "Restoring dump to target database..."
# Restore with no-owner/no-privilege to avoid ownership issues
pg_restore --no-owner --no-privileges --dbname="$TARGET_CONN" --clean "$DUMP_FILE"

echo "Migration complete. Verify integrity and re-run any tenant-specific migrations if needed."

echo "Notes:"
echo " - Supabase projects often require enabling extensions via the project SQL editor if the role is restricted."
echo " - After migration, rotate any exposed credentials and update your app DATABASE_URL to point to Supabase."
