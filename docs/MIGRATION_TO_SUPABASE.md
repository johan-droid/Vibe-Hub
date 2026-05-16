# Migration to Supabase

This guide covers moving the Vibe-Hub database from Neon or another Postgres host into Supabase and then wiring the repository to the new connection strings.

## Preconditions

- You need administrative access to both the source database and the Supabase project.
- Install `pg_dump`, `pg_restore`, and `psql` locally.
- Take a backup before you start.
- Validate the migration in a staging environment before touching production secrets.

## Current repository inputs

- `apps/server-bridge/.env.example` contains the server-side database and auth template.
- `apps/user-interface/.env.example` contains the frontend API base settings.
- `apps/server-bridge/db-migrate.js` is the migration entrypoint to review if schema changes need to be replayed after the dump and restore.

## Recommended flow

1. Create the Supabase project and copy the Postgres connection details.
2. Enable the Supabase-required extensions from the SQL editor as the project owner.
3. Dump the source database with `pg_dump` in custom format.
4. Restore into Supabase with `pg_restore` using `--no-owner` and `--no-privileges`.
5. Update `apps/server-bridge/.env` so `DATABASE_URL` points at Supabase and `DATABASE_SSL_MODE` matches your TLS mode.
6. Update any deployment secrets that reference the old database.
7. Run the repo validation commands and a backend test pass.

## Example commands

```bash
pg_dump --format=custom --no-owner --no-privileges --dbname="postgresql://source_user:source_pass@source-host:5432/source_db" --file=vibe-hub.dump

psql "postgresql://supabase_owner:SUPABASE_PASS@project.supabase.co:5432/postgres" -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
psql "postgresql://supabase_owner:SUPABASE_PASS@project.supabase.co:5432/postgres" -c "CREATE EXTENSION IF NOT EXISTS vector;"

pg_restore --no-owner --no-privileges --dbname="postgresql://supabase_user:SUPABASE_PASS@project.supabase.co:5432/postgres" --clean vibe-hub.dump
```

## Post-migration checks

- Confirm the server bridge starts with the new `DATABASE_URL`.
- Confirm the VFS and auth flows still work end to end.
- Run `npm run validate` from the root and `npm --workspace=apps/server-bridge run test`.
- Verify the frontend still points at the correct API origin through `apps/user-interface/.env.local`.

## Important notes

- Supabase extension creation often requires owner-level access in the dashboard.
- Restoring without owners avoids permission mismatches.
- Rotate secrets after the migration is complete.
- Keep `DATABASE_SSL_MODE=require` or `verify-full` depending on your setup.
