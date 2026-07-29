# 0011. Back production up daily to a private repo

- **Status:** Accepted — operational since 2026-07-28
- **Supersedes:** [0007](0007-seed-data-as-backup.md)
- **Date:** 2026-07-28
- **Affects:** disaster recovery, `seed-data.sql`, https://github.com/evandenmark/bananaplan-backups

## Context

[0007](0007-seed-data-as-backup.md) made the local Homebrew Postgres database
the de facto backup, refreshed by hand into `seed-data.sql`. That was an honest
description of the situation after the July 2026 outage, and it has two holes
that only get worse as the app is actually used:

1. **It is manual.** Data entered through the deployed app is not in the snapshot
   until someone remembers to refresh it from local. In practice that means
   production data is unprotected for however long passes between refreshes.
2. **`seed-data.sql` lives in a public repo.** Today it happens to contain no
   `clients` or `orders` rows, so nothing personal is exposed. But the documented
   procedure is "refresh it from local after meaningful data changes" — so the
   first refresh after adding a client publishes that client's name.

Supabase's free tier provides no backups at all: "Database backups are not
available for download for Free Plan projects."

## Decision

A daily GitHub Actions job in a **private** repo,
[`evandenmark/bananaplan-backups`](https://github.com/evandenmark/bananaplan-backups),
`pg_dump`s production and commits the result.

- **Private, and it must stay private.** The dumps contain real client names.
  This is the reason the backup does not live alongside the app.
- **The workflow runs in the backup repo, not the app repo.** The app repo is
  public; putting the production connection string in its Actions secrets would
  place live database credentials one workflow-file edit away from anyone who
  opens a pull request. The credential belongs where the data does.
- Runs at 11:00 UTC (01:00 Hawaii) on GitHub's runners. **No laptop involved.**
  Offset from the keepalive cron so the two touch the database at different hours.
- Dumps both data (`--data-only --column-inserts`, matching 0007's format so the
  restore procedure is unchanged) and schema, so a restore depends on neither the
  app repo nor `drizzle-kit`.
- **Verifies before committing:** the dump must be non-empty, contain a
  `CREATE TABLE` for all eight tables, and contain at least one planting. A
  backup job that "succeeds" while writing an empty file is how people discover
  they have no backups on the day they need one.
- Files are overwritten each run; **git history is the retention**, so every
  previous day the job ran is recoverable by checking out the commit.

`seed-data.sql` stays in the app repo as a small seed fixture for bringing up a
local database. It is **no longer the backup**, and the instruction in 0007 to
refresh it from production data is withdrawn — following it would publish client
names.

## Consequences

- Production data is protected within 24 hours of being entered, automatically,
  with no laptop and no discipline required.
- Restores work from a single private repo with two `psql` commands.
- The backup job's daily connection is a second, independent source of database
  activity, backstopping the keepalive cron ([0010](0010-database-keepalive.md)).
- **Cost:** up to 24 hours of data loss (the RPO). Fine for a farm app where a
  day's entry is a handful of harvest records that could be re-entered from
  memory or paper.
- **Cost:** GitHub disables scheduled workflows after 60 days of repository
  inactivity. The daily commit normally keeps it active, but a long stretch with
  no data changes means no commits and therefore no activity. GitHub emails
  before disabling.
- **Cost:** one more credential to hold — `DIRECT_URL` as a repository secret,
  which must be rotated there too if the database password changes.
- **Cost:** the restore path is now documented in two places (this repo's
  `db-ops` skill and the backup repo's README). They must not drift.

### Two things learned bringing it up, worth not rediscovering

- **`pg_dump` must be version 17+, and installing the package is not enough.**
  Supabase runs Postgres 17.6; the GitHub runner ships 16, and `pg_dump` refuses
  to dump a newer server. `apt-get install postgresql-client-17` alone does not
  fix it, because `/usr/bin/pg_dump` is Debian's `pg_wrapper`, which keeps
  selecting 16. `/usr/lib/postgresql/17/bin` has to go on `PATH` explicitly.
- **`-n public` is mandatory.** Without it, `pg_dump` also captures Supabase's
  managed schemas — `auth`, `storage`, `realtime`, `vault`, `pgbouncer`,
  `graphql` — and their internal migration bookkeeping. Restoring that into a
  fresh project fights the platform's own provisioning, so the dump is not
  actually restorable. The workflow now fails if a managed schema ever reappears.
  Verify a dump by the schemas it contains, never by its size — the data dump
  grows with real farm records, so size is not a health signal.

## Alternatives considered

- **Keep the manual local-refresh process (0007)** — depends on someone
  remembering, and its own documented procedure publishes client names to a
  public repo. Superseded.
- **Commit dumps to the app repo** — simplest, and publishes farm and client data
  to the internet. Rejected outright.
- **A second Supabase project as a warm standby** — free, but pauses on the same
  7-day rule, so it would need its own keepalive, doubling the fragile machinery
  this is meant to reduce. Also two projects and two credentials to manage.
- **GitHub Actions artifacts or releases instead of commits** — artifacts expire
  (90 days max) and, on a public repo, are downloadable by anyone. Commits in a
  private repo have neither problem.
- **Object storage (S3, R2, Backblaze)** — the conventional answer, and better at
  scale. Rejected for now: it costs money or at least an account, where this is
  free, and a text dump of one farm's records is small enough that git handles it
  comfortably. Revisit if the dump ever grows enough that committing it daily
  bloats the repo — years of farm records, not months.
- **Supabase Pro with PITR** — the real answer if this data ever becomes hard to
  reconstruct. A cost decision for the owner.
