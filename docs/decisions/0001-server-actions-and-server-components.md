# 0001. Use Server Actions and Server Components; no API routes

- **Status:** Accepted
- **Date:** 2026-07-28 *(recorded retroactively; decision made 2026-02)*
- **Affects:** `src/app/**`, `src/app/actions/*`

## Context

BananaPlan is a single-operator app talking to one Postgres database. Next.js 16
App Router offers three ways to move data: route handlers under `app/api`,
client-side fetching, and Server Components plus Server Actions. Every extra
layer here is a hand-written serialization boundary with no other purpose —
there is no third-party consumer of an HTTP API.

## Decision

- **Reads** happen in Server Components, querying `db` directly. No `useEffect`
  fetching, no route handlers.
- **Writes** are Server Actions, in `src/app/actions/<entity>.ts`, one file per
  entity. Each file begins with `"use server"`.
- Every action that mutates calls `revalidateFor` with the tables it wrote, then
  `redirect`s if it was invoked from a form. See
  [0008](0008-centralized-revalidation.md) for why revalidation goes through a
  shared route map rather than hand-written `revalidatePath` calls.
- Client Components are used only for genuine interactivity — currently
  `harvest-form.tsx` (dependent dropdowns) and `forecast-chart.tsx` (recharts).

## Consequences

- No API surface to version, document, secure, or keep in sync with the schema.
- Pages are simple: `async function Page()` with a query in the body.
- **Cost:** correctness depends on revalidating at every mutation site. A missed
  call shows the user stale data with no error. The action tests in
  `src/app/actions/__tests__/` assert these calls specifically — keep doing that.
  [0008](0008-centralized-revalidation.md) narrows this cost to maintaining one
  route map.
- **Cost:** there is no way for an external client to read this data. If one is
  ever needed, that is a new decision, not an extension of this one.

## Alternatives considered

- **Route handlers under `app/api`** — a serialization boundary and a second copy
  of every type, bought for a consumer that does not exist.
- **Client-side fetching with SWR/React Query** — would put database credentials
  behind an API layer we just decided not to build, and costs a loading state on
  every screen for a single-user app.
