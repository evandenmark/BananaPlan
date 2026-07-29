# 0008. Revalidate through a shared table→route map

- **Status:** Accepted
- **Date:** 2026-07-28
- **Affects:** `src/lib/revalidate.ts`, every file in `src/app/actions/`

## Context

Server Actions must invalidate the routes that display what they changed
([0001](0001-server-actions-and-server-components.md)). Doing this by hand had
drifted badly:

- `createVariety`, `updateVariety`, `createSite`, `updateSite`, `updateField`,
  `updateInventory`, and `createField` called nothing at all.
- `deleteVariety` revalidated `/varieties` only — but nine routes display variety
  data, because varieties carry the growth model that the forecast, the harvest
  form, and the field pages all read.
- Recording a weight harvest revalidated `/weight-log` only, on the assumption
  that weight harvests do not affect the forecast. They do not *feed*
  `computeForecast`, but `/forecast` reads `weight_harvests` directly to draw the
  three months of actuals on its chart.

The fan-out is genuinely non-obvious. Nobody derives "editing a variety affects
nine routes" correctly from memory, and it changes every time a page is added.

Two things reduce the severity. The root layout sets
`export const dynamic = "force-dynamic"`, so every page is rendered per request
and there is no Full Route Cache to go stale; and all reads go straight to
Postgres. So the missing calls were **not** producing visible bugs. The exposure
is the client-side Router Cache, and — more importantly — the fact that the
entire app is one `force-dynamic` line away from every one of these gaps
becoming real at once.

## Decision

The mapping from table to routes lives in exactly one place,
`src/lib/revalidate.ts`. Actions declare what they wrote, not where it is shown:

```ts
revalidateFor(["bunchHarvests"]);
revalidateFor(["orders"], { "/clients/[id]": clientId });
```

- Pass the concrete id for a dynamic route when the action knows it; the helper
  invalidates that one page.
- Omit it and the helper invalidates every instance via
  `revalidatePath(route, "page")`.
- Routes are unioned and de-duplicated across the tables passed.

**When you add a page, add it to `ROUTES_BY_TABLE` for every table it reads.**
That is now the only place this knowledge lives.

## Consequences

- A whole class of bug — "I forgot `/forecast`" — becomes impossible from the
  action side.
- The real fan-out is visible in one screen of code, which is also the honest
  documentation of which pages depend on what.
- Correctness no longer rests silently on `force-dynamic`. If that line is ever
  removed, revalidation is already right.
- **Cost:** the map is a second thing to update when adding a page, and nothing
  enforces it. A page missing from the map is stale-able and invisible. This is
  strictly better than the previous state, where the same knowledge was spread
  across six files, but it is not enforcement.
- **Cost:** over-invalidation. Deleting a client invalidates `/forecast`, which
  it need not always. Under `force-dynamic` this costs nothing measurable.
- The existing action tests still assert concrete paths such as `/clients/4` and
  pass unchanged, because the helper substitutes ids when given them.
  `src/lib/__tests__/revalidate.test.ts` covers the mapping itself.

## Alternatives considered

- **Keep hand-written `revalidatePath` calls, just add the missing ones** — fixes
  today's instance and not the cause. The map drifted once and would again; the
  nine-route variety fan-out is exactly what a person gets wrong by hand.
- **`revalidatePath("/", "layout")` in every action** — always correct, nothing
  to maintain, and genuinely tempting for a single-operator app. Rejected because
  it discards the information about what depends on what, which is worth having
  written down in a codebase optimized for agents to modify.
- **Rely on `force-dynamic` and drop revalidation entirely** — makes a
  performance setting load-bearing for correctness, with no comment saying so.
  The failure mode when someone later removes it is diffuse and hard to diagnose.
- **`revalidateTag` with tagged queries** — the better fit for a cached app, but
  it needs `unstable_cache` wrappers around reads that are currently plain
  Drizzle calls. Worth revisiting if `force-dynamic` is ever lifted.
