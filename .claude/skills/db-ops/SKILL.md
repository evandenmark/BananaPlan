---
name: db-ops
description: Inspect, seed, back up, or restore the BananaPlan database, local or production. Use for connecting with psql, restoring from the automated backups, seeding a local database, rebuilding a lost Supabase project, diagnosing production database errors, or answering questions about which connection string to use.
---

# Database operations

Two databases:

| | Local | Production |
| --- | --- | --- |
| Host | Homebrew Postgres | Supabase `hjkmldyptkmlalgdwjzs`, `us-west-2` |
| Database | `bananaplan`, user `evandenmark`, no password | pooled |
| Role | development; last-resort copy until the automated backup runs | live |

Structure comes from `src/db/schema.ts` only — see the `schema-change` skill and
[ADR 0002](../../../docs/decisions/0002-drizzle-push-no-migrations.md). This
skill is about data and connectivity.

## Connection strings

Both in `.env`, which is **gitignored** — production config is not recoverable
from the repo.

Reading `.env` with the Read tool is denied in
[`.claude/settings.json`](../../settings.json), to keep production credentials
out of the transcript. You do not need to read it — load it into the shell
instead, which works fine and never surfaces the values:

```bash
set -a; source .env; set +a
psql "$DIRECT_URL" -c "\dt"
```

`drizzle-kit` loads `.env` on its own and needs nothing from you.

- `DATABASE_URL` — transaction pooler, **port 6543**, host
  `aws-1-us-west-2.pooler.supabase.com`. What the app uses; the only one Vercel
  has. No session-scoped features (prepared statements across requests,
  `LISTEN/NOTIFY`, advisory locks).
- `DIRECT_URL` — session pooler, **port 5432**. Used only by `drizzle-kit` and
  `psql` from a laptop.

Three things that have already cost hours:

1. New Supabase projects are on the **`aws-1-`** fleet, not `aws-0-`. Wrong fleet
   returns `tenant/user postgres.<ref> not found`, which reads like a deleted
   project. Probe fleets and regions before concluding a project is gone.
2. Never use the "Direct connection" string (`db.<ref>.supabase.co`) — IPv6-only
   without a paid add-on, and it hangs rather than erroring.
3. The password contains `@` and must be **percent-encoded** as `%40` in the URL.

## Local

```bash
brew services list | grep postgresql     # confirm it is running
psql bananaplan                          # connect
psql bananaplan -c "\dt"                 # list tables
```

## Inspecting production

Prefer the Supabase MCP tools for reads — they need no local credentials:

- `mcp__supabase__list_tables` — what structure actually exists
- `mcp__supabase__execute_sql` — SELECTs, row counts, spot checks
- `mcp__supabase__get_logs` — database errors, connection failures
- `mcp__supabase__get_advisors` — security and performance warnings

**Never** `apply_migration`, and never DDL through `execute_sql`. See
[docs/mcp.md](../../../docs/mcp.md) and
[ADR 0006](../../../docs/decisions/0006-mcp-boundaries.md).

## Backups

Production is backed up **automatically, daily** to the private
[`bananaplan-backups`](https://github.com/evandenmark/bananaplan-backups) repo by
a GitHub Actions job ([ADR 0011](../../../docs/decisions/0011-automated-production-backups.md)).
Nothing manual is required, and no laptop is involved. See
[docs/operations.md](../../../docs/operations.md).

**Never refresh `seed-data.sql` from production.** This repo is public and
production data contains client names. That instruction came from
[ADR 0007](../../../docs/decisions/0007-seed-data-as-backup.md) and is withdrawn.
`seed-data.sql` is now only a fixture for seeding a local database:

```bash
psql bananaplan -v ON_ERROR_STOP=1 -f seed-data.sql
```

`seed-local.sql`, if present, is an older hand-written fixture — superseded,
intentionally untracked, do not use it.

## Restoring production from scratch

When the Supabase project has been lost or recreated. Takes about a minute once
`.env` has working credentials.

1. Update `DATABASE_URL` and `DIRECT_URL` in `.env` for the new project ref,
   observing all three gotchas above.
2. Clone the backup repo and **check that a dump actually exists**:

   ```bash
   gh repo clone evandenmark/bananaplan-backups
   ls -l bananaplan-backups/dumps/
   ```

   If `dumps/` holds only `.gitkeep`, the backup job has never run successfully —
   see the activation checklist in
   [docs/operations.md](../../../docs/operations.md). **Do not proceed as though
   a backup exists.** Fall back to the local database, which is then the only
   surviving copy:

   ```bash
   pg_dump bananaplan --data-only --column-inserts > /tmp/local-recovery.sql
   ```

   To restore a day other than the most recent, `git log --oneline dumps/` and
   `git checkout <sha> -- dumps/`.

3. Restore schema, then data:

   ```bash
   psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f bananaplan-backups/dumps/production-schema.sql
   psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f bananaplan-backups/dumps/production-data.sql
   ```

   If the schema dump is unavailable, `npx drizzle-kit push --force` recreates
   structure from `src/db/schema.ts` instead — eight tables, the `frequency`
   enum, and the FK constraints — then load the data dump on top.

4. **Verify through `DATABASE_URL`**, not `DIRECT_URL` — that is the path
   production uses, and the two fail independently. `mcp__supabase__list_tables`
   plus a row count is enough.
5. Update `DATABASE_URL` in the Vercel dashboard by hand if the ref changed.
   Vercel needs only `DATABASE_URL`. Then redeploy — see the `ship` skill.

## Diagnosing "production is down"

**If every page 500s but `/more` still renders, it is the database, not the
code.** `/more` is the only route with no database dependency. That symptom has
meant a deleted or paused Supabase project before.

Free-tier lifecycle: pauses after roughly a week idle, deleted after roughly 90
days paused. Expect this during long gaps in work, and expect to restore.

Order of investigation:

1. `mcp__supabase__get_logs` and `mcp__supabase__get_advisors`.
2. `mcp__supabase__list_tables` — if the project answers but has no tables, the
   structure is gone; restore above.
3. If the project does not answer at all, check the fleet prefix before
   concluding it was deleted.
4. `mcp__vercel__get_runtime_errors` for what the app actually threw.
