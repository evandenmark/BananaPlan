# 0005. Cap the `pg` pool at 3 connections

- **Status:** Accepted
- **Date:** 2026-07-28
- **Affects:** `src/db/index.ts`

## Context

The app runs as serverless functions on Vercel against Supabase's transaction
pooler. Each warm function instance holds its own `pg` Pool, and Vercel scales
instances independently — so the effective connection count is
`max × warm instances`, not `max`. The Supabase free tier's pooler allows far
fewer connections than that product can reach under even light traffic.

Meanwhile the dashboard genuinely benefits from a small amount of concurrency:
Server Components on a single page issue several queries that can overlap.

## Decision

```ts
new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
});
```

Three covers the parallel queries on the busiest page without letting a handful
of warm instances exhaust the pooler. The 10s idle timeout releases connections
from instances that have gone quiet but not yet been reclaimed.

`DATABASE_URL` points at the **transaction** pooler (port 6543). This is why the
app cannot use session-level features such as prepared statements across
requests, `LISTEN/NOTIFY`, or advisory locks.

## Consequences

- Connection exhaustion under normal use is unlikely, and a burst degrades as
  queueing rather than as errors.
- **Cost:** a page issuing more than three concurrent queries serializes the
  excess. If a page ever needs more parallelism, reduce the number of queries
  before raising `max`.
- **Cost:** anything requiring a session-scoped Postgres feature will not work
  over `DATABASE_URL` and must use `DIRECT_URL` (session pooler, port 5432),
  which is a local/tooling path only — Vercel is not given `DIRECT_URL`.

## Alternatives considered

- **Default pool size (10)** — with even three warm instances that is 30
  connections, past the free-tier pooler limit; failures appear as intermittent
  500s on some routes and not others, which is miserable to diagnose.
- **A new client per request, no pool** — pays TLS and auth setup on every
  query.
- **Supabase's JS client instead of `pg`** — would replace Drizzle's typed
  queries with PostgREST semantics and put a second schema representation in the
  repo, against [0002](0002-drizzle-push-no-migrations.md).
