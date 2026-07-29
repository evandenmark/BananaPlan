# 0010. Keep the free-tier database awake with a daily Vercel cron

- **Status:** Accepted
- **Date:** 2026-07-28
- **Affects:** `vercel.json`, `src/app/api/cron/keepalive/route.ts`

## Context

Supabase pauses Free plan projects that show low activity over a **7-day**
window, and deletes them 90 days after pausing. This is not hypothetical here:
the original project was lost exactly this way during a five-month gap in work,
taking down every database-backed page ([0007](0007-seed-data-as-backup.md)).

The threshold is not "one query per week." Supabase's own guidance is:

> Typically a few user requests to the database each day over the previous week
> is enough to keep the project from being paused.

So the cadence has to be **daily**. A ping every 72 hours would be betting the
database on a rule written in terms of daily activity — and the failure is
silent until the warning email arrives.

The job cannot depend on a laptop being awake. That is the whole point: the
outage happened during a gap in work, which is precisely when a laptop-scheduled
job would also be off.

## Decision

A Vercel cron hits `/api/cron/keepalive` once a day at 14:00 UTC (04:00 Hawaii).

This is a **route handler**, which [0001](0001-server-actions-and-server-components.md)
otherwise rules out. That ADR governs how the app moves its own data; an endpoint
called by an external scheduler has no Server Action equivalent, because there is
no user and no form. 0001 carries a matching scope note so the next reader does
not have to re-derive this.

- Vercel runs it in the cloud, on the deployment that is already there. Nothing
  local is involved, and it keeps working during months of not touching the
  project — the exact scenario that caused the outage.
- It runs **twice a day**, at 02:00 and 14:00 UTC. Supabase's guidance is "a few
  user requests," so spread across hours is worth having, and extra invocations
  of a millisecond-scale read cost nothing.
- The handler runs **three reads** — `count(*)` over `sites`, `varieties`, and
  `field_inventory` — sequentially, so each is its own round trip. Queries are
  activity; nothing needs to be written.
- **The handler never sleeps between reads.** Vercel bills wall-clock execution
  time, so a sleeping function burns quota doing nothing, and sleeping past
  `maxDuration` kills the invocation — converting a healthy ping into a *failed*
  cron run, which is worse than a single clean read. Sleeping also buys nothing
  against the actual metric: reads a minute apart are indistinguishable from one
  read to a heuristic measured per day over a 7-day window. Spacing that matters
  comes from more invocations at different hours, not pauses inside one.
- **There is deliberately no heartbeat table.** A row per day grows without
  bound, needs pruning, and puts a fake entity in a schema that otherwise
  describes only real farm concepts. The observability a heartbeat table would
  give is already provided by Vercel's cron history plus the endpoint's JSON
  response.
- The handler returns **500 on failure**, so a broken ping shows up as a failed
  cron run rather than silently reporting success while the database is
  unreachable.
- `CRON_SECRET`, when set as a Vercel environment variable, is required as a
  bearer token. Vercel sends it automatically. Without it the endpoint is public
  — harmless, since it only reads a count, but trivially abusable as free load.

The daily GitHub Actions backup ([0011](0011-automated-production-backups.md))
independently touches the database from a different service at a different hour,
so the two jobs are mutual backstops.

## Consequences

- The project stays on the free tier without the pause risk, as long as the cron
  keeps running.
- **Cost:** silent dependence on one scheduled job. If the cron is disabled,
  renamed, or the deployment is removed, nothing announces it until Supabase's
  warning email arrives. The backup job is the second line of defense.
- **Cost:** Hobby-plan cron timing is approximate — Vercel triggers within the
  scheduled hour, not on the minute. Irrelevant at daily cadence.
- Note that this is a workaround for not paying for the Pro plan. Upgrading
  removes pausing entirely and would make this endpoint unnecessary.

## Alternatives considered

- **Ping every 72 hours, as originally proposed** — rejected on the evidence
  above: Supabase describes the threshold in terms of daily requests, so a
  3-day gap leaves four days of the 7-day window with no activity at all.
- **A `dummy_ping` table written to on each run** — rejected. It grows forever,
  needs pruning, pollutes the schema, and buys observability that Vercel's cron
  history already provides.
- **One invocation that reads, sleeps a minute, reads again** — rejected for the
  reasons in the decision above: it costs billable time, risks a `maxDuration`
  timeout that would be logged as a failure, and a minute of spacing is noise
  against a metric measured per day. Two invocations twelve hours apart, each
  doing a few reads, is strictly better and cheaper.
- **GitHub Actions for the keepalive too** — workable, but GitHub disables
  scheduled workflows after 60 days of repository inactivity, and long quiet
  periods are exactly when this job matters most. Vercel crons have no such rule.
- **A local `launchd` job** — free and simple, and off whenever the laptop is
  closed. That is the failure mode that caused the original outage.
- **Upgrade to Supabase Pro** — the real fix; paid projects are never paused.
  A cost decision for the owner, not a technical one.
