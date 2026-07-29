# 0007. `seed-data.sql` plus local Postgres is the backup strategy

- **Status:** Superseded by [0011](0011-automated-production-backups.md)
- **Date:** 2026-07-28
- **Affects:** `seed-data.sql`, local development database, disaster recovery

> **Superseded the same day.** Backups are now automatic, daily, and in a private
> repo. In particular, the instruction below to refresh `seed-data.sql` from
> production data is **withdrawn** — the app repo is public, so following it
> would publish client names. `seed-data.sql` remains a local seed fixture.
> Everything else here still describes the restore mechanics accurately.

## Context

On 2026-07-28 the production Supabase project was found deleted. The free tier
pauses a project after roughly a week idle and deletes it after roughly 90 days
paused; a five-month gap in work ran through both. Every database-backed page
returned 500 while static routes kept rendering, which made it look like an
application bug.

There were no database backups — the free tier does not provide them. The data
survived only because the local Homebrew Postgres instance still had it.

## Decision

The recovery path is **local → dump → Supabase**, and it is deliberate, not
incidental:

1. The local `bananaplan` database is treated as the authoritative backup copy.
   Do not drop or recreate it casually.
2. `seed-data.sql` is a committed `pg_dump --data-only --column-inserts` snapshot
   of that database, including `setval` calls so sequences land correctly and
   later inserts do not collide with restored rows.
3. Refresh `seed-data.sql` from local after meaningful data changes. It drifts
   otherwise — it already carried 8 plantings against an older fixture's 6.
4. Restore is `drizzle-kit push --force` (structure, from
   [0002](0002-drizzle-push-no-migrations.md)) followed by
   `psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f seed-data.sql` (data). About a
   minute end to end. The `db-ops` skill walks it.

Verify a restore through `DATABASE_URL` (transaction pooler), not `DIRECT_URL` —
that is the path production actually uses, and the two fail independently.

## Consequences

- Losing the production project is a one-minute recovery instead of a data loss.
- The snapshot is in git, so recovery needs no third-party service.
- **Cost:** production data written directly through the app is *not* in the
  snapshot until someone refreshes it from local. Data entered on the deployed
  app and never mirrored locally is genuinely at risk. This is the weakest point
  in the current setup and is named as such in the
  [constitution](../constitution.md) §6.
- **Cost:** `seed-data.sql` is committed plaintext farm data. Acceptable today
  because it holds no personal or financial information beyond client names —
  reconsider if that changes.

## Alternatives considered

- **Supabase paid tier with automated backups** — the correct answer if this data
  becomes hard to reconstruct. A cost decision for the owner, not a technical
  one.
- **Scheduled `pg_dump` to object storage** — better than a committed snapshot,
  but needs somewhere to run and something to monitor; the manual refresh is
  honest about being manual.
- **Treat production as authoritative and sync down** — inverts the actual
  situation: the local copy is the one that survived, and the deployed app is on
  the tier that deletes projects.
