# Decisions (ADRs)

Every non-obvious technical choice in BananaPlan gets a numbered record here.
The point is to stop agents (and humans) from re-litigating settled questions, or
worse, silently reversing them.

## Index

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-server-actions-and-server-components.md) | Server Actions + Server Components; no API routes | Accepted |
| [0002](0002-drizzle-push-no-migrations.md) | `drizzle-kit push` instead of migration files | Accepted |
| [0003](0003-forecast-original-baseline.md) | Forecast keeps the original baseline after a harvest | Accepted |
| [0004](0004-two-harvest-types.md) | Two separate harvest tables: bunches and weights | Accepted |
| [0005](0005-small-connection-pool.md) | `pg` pool capped at 3 connections | Accepted |
| [0006](0006-mcp-boundaries.md) | MCP servers are read-mostly; Drizzle owns schema | Accepted |
| [0007](0007-seed-data-as-backup.md) | `seed-data.sql` + local Postgres is the backup strategy | Superseded by [0011](0011-automated-production-backups.md) |
| [0008](0008-centralized-revalidation.md) | Revalidate through a shared table→route map | Accepted |
| [0009](0009-adversarial-review-before-commit.md) | Adversarial review before every non-trivial commit | Accepted |
| [0010](0010-database-keepalive.md) | Daily Vercel cron keeps the free-tier database awake | Accepted |
| [0011](0011-automated-production-backups.md) | Daily automated backups to a private repo | Accepted |
| [0012](0012-refuse-deletes-that-break-foreign-keys.md) | Refuse deletes that would break a foreign key | Accepted |

Keep this table in sync — it is the part agents actually read.

## When to write one

Write an ADR when **all** of these are true:

- You chose between real alternatives (not "the only way that works").
- The choice is not obvious from reading the code it produced.
- Reversing it later would cost more than an afternoon.

Examples that deserve one: picking a charting library, changing how the forecast
consumes harvests, introducing caching, adding auth, changing where money is
rounded. Examples that do not: renaming a variable, adding a field to a form,
fixing a bug with one correct answer.

Prefer one ADR too many over one too few — but do not write them for
non-decisions. A log full of noise gets skipped.

## How to write one

Run the `log-decision` skill, or by hand:

1. Copy [`_template.md`](_template.md) to `NNNN-kebab-case-title.md`, taking the
   next free number. Numbers are never reused, even if a file is deleted.
2. Fill it in. Be concrete about the alternatives — an ADR whose "Alternatives"
   section is empty is usually a decision that wasn't really made.
3. Add a row to the index above.
4. Commit it **with** the change it describes, so `git log` ties them together.

## Superseding

Never edit the substance of an accepted ADR, and never delete one. To change
course, write a new ADR that supersedes it, then:

- Set the old one's status to `Superseded by [NNNN](NNNN-....md)`.
- Set the new one's status to `Accepted`, with a `Supersedes` line.
- Update the index table.

The wrong turn is as useful to a future reader as the right one.
