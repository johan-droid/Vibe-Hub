Migration from Neon (or other Postgres) to Supabase

Overview

This document describes steps to migrate an existing Postgres database (Neon or similar) to a Supabase project and update the project configuration.

Preconditions

- You must have admin access to the source database (Neon) and the Supabase project (owner or SQL editor access).
- Install `pg_dump`, `pg_restore`, and `psql` (Postgres client tools).
- Backup your data and test the migration in a staging environment first.

High-level steps

1. Create a Supabase project and note the connection string.
2. Enable required extensions in Supabase (vector/pgcrypto) via the SQL editor or psql as project owner.
3. Dump the source DB using `pg_dump` in custom format.
4. Restore into Supabase using `pg_restore`.
5. Update app environment (`DATABASE_URL`, `DATABASE_SSL_MODE`) to the Supabase connection string and `sslmode=require`.
6. Run application migrations and tests against Supabase.
7. Rotate credentials and update secrets in your deployment provider.

Commands (example)

# Dump source DB to file (requires network access and credentials)
pg_dump --format=custom --no-owner --no-privileges --dbname="postgresql://neon_user:NEON_PASS@neon-host:5432/neon_db" --file=neon.dump

# Enable extensions on Supabase (via SQL Editor or psql with owner)
psql "postgresql://supabase_owner:SUPABASE_PASS@project.supabase.co:5432/postgres" -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
psql "postgresql://supabase_owner:SUPABASE_PASS@project.supabase.co:5432/postgres" -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Restore into Supabase
pg_restore --no-owner --no-privileges --dbname="postgresql://supabase_user:SUPABASE_PASS@project.supabase.co:5432/postgres" --clean neon.dump

Important notes

- Extensions: Supabase may not allow creating some extensions from non-owner roles. Use the SQL Editor in the Supabase dashboard as the project owner to enable `vector`/`pgcrypto`.
- Roles & ownership: We restore without owners to avoid permission issues; re-create any required roles in Supabase as needed.
- Secrets: rotate all keys that were present in the repo or environment after migration.
- Application compatibility: ensure `DATABASE_SSL_MODE` is set to `require` or `verify-full` depending on your Supabase TLS configuration. Update `DATABASE_SSL_CA` only if required.

App changes made

- `apps/server-bridge/.env.example` updated to Supabase connection placeholder.
- Added `scripts/migrate-neon-to-supabase.sh` for a straightforward dump/restore workflow.
- Added this document explaining the migration steps.

If you want, I can:
- Run a dry-run script (needs credentials and temporary access),
- Prepare a GitHub Action for periodic backups or one-off migration,
- Or perform history cleanup if you want me to purge previously committed secrets.
