# BananaPlan Constitution

The stable description of what this app is, who it serves, and what must remain
true. Everything else — file layout, libraries, UI — is negotiable and can be
changed by an agent with good reason. **The contents of this document cannot.**

Changing this file is a deliberate act by the repo owner. An agent may *propose*
a change here, but should not make one as a side effect of implementing a
feature. Ordinary technical choices go in [decisions/](decisions/) instead.

> Sections marked **(inferred)** were reconstructed from the code and should be
> corrected by the owner if wrong.

---

## 1. What this is

BananaPlan is an operations and forecasting tool for a working banana farm. It
answers three questions:

1. **What is planted, and where?** Fields belong to sites; each field holds one
   or more plantings (an *inventory row*: a variety, a number of mats, a planting
   date).
2. **What was actually harvested?** Bunch counts per field, and separately,
   weights per variety.
3. **What will be ready, and when?** A month-by-month projection of bunches and
   pounds, derived from planting dates and per-variety growth cycles, reduced by
   what has already been picked.

The forecast is the product. Everything else exists to keep the forecast honest.

## 2. Who uses it

A farm operator, on a phone, standing in a field, usually with one hand free.

This is the single most load-bearing fact about the UI, and it is why:

- The primary navigation is a fixed bottom bar (`src/components/nav.tsx`).
- Layouts are constrained to `max-w-lg` and centered — phone-width first.
- Recording a harvest is reachable in one tap and takes a handful of taps to
  complete, with dependent dropdowns rather than free text.

There are no user accounts, no roles, and no authentication. **(inferred)** This
is a single-operator tool, not a multi-tenant product. Do not add auth,
organizations, or per-user data scoping without an explicit decision from the
owner — it would change the shape of every query in the app.

## 3. The domain model

Eight tables, defined in [`src/db/schema.ts`](../src/db/schema.ts). See
[glossary.md](glossary.md) for the agronomy terms.

```
sites ──< fields ──< field_inventory >── varieties
                 │                          │
                 └──< bunch_harvests >───────┤
                                             ├──< weight_harvests
clients ──< orders >─────────────────────────┘
```

- **sites** — physical farm locations. Currently Kemo'o (1) and Big Tree (2).
- **fields** — a named area within a site.
- **varieties** — a banana cultivar *and its growth model*: months to first
  bunch, months between subsequent bunches, total bunches per mat, pounds per
  bunch, success rate. These numbers drive the entire forecast.
- **field_inventory** — a planting: N mats of one variety in one field on one
  date. A field can hold several.
- **bunch_harvests** — bunches picked from a field. **Consumes forecast.**
- **weight_harvests** — pounds recorded against a variety. **Does not consume
  forecast**; it is an independent log. See
  [ADR 0004](decisions/0004-two-harvest-types.md).
- **clients** / **orders** — recurring or one-time demand in pounds per delivery.

## 4. Invariants

These must hold. A change that breaks one is a bug, not a feature.

1. **The forecast is derived, never stored.** It is computed from inventory and
   harvest records on every request by `computeForecast`. There is no forecast
   table and there must not be one — a stored forecast would silently go stale
   the moment a planting or a harvest is edited.
2. **Harvest records are the source of truth about the past; forecasts only
   describe the future.** `computeForecast` returns only events dated today or
   later.
3. **Recorded harvest reduces the forecast from the earliest expected event
   first, and surplus is absorbed rather than carried forward.** Picking more
   than expected does not create a debt against future plantings. See
   [ADR 0003](decisions/0003-forecast-original-baseline.md).
4. **Schema flows one way:** `src/db/schema.ts` → `drizzle-kit push` → database.
   The database is never the source of truth for structure.
5. **Money and yield are never rounded for storage.** Weights and pounds are
   `numeric` in Postgres and arrive in TypeScript as strings; parse at the edge,
   do not change the column types to `float`.
6. **Dates in this app are calendar dates, not instants.** Planting and harvest
   dates are `date` columns and `YYYY-MM-DD` strings. The farm is in Hawaii
   (UTC-10); anything that parses a bare date string as UTC will be off by a day.
7. **Every mutation revalidates every route that displays what it changed.** Via
   `revalidateFor` in `src/lib/revalidate.ts`, never by hand
   ([ADR 0008](decisions/0008-centralized-revalidation.md)). The app is currently
   `force-dynamic`, which masks mistakes here — do not let that become the thing
   holding correctness up.

## 5. Non-goals **(inferred)**

Named so agents stop proposing them:

- Not a marketplace, storefront, or invoicing system. Orders capture demand so it
  can be compared against supply; they are not a billing pipeline.
- Not a general farm-management platform. Bananas specifically, with a growth
  model that assumes mats producing a fixed number of bunches on a cycle.
- Not multi-tenant, and not authenticated. See §2.
- Not offline-first today. The app assumes connectivity; if field connectivity
  turns out to be a real problem, that is a decision to make explicitly.

## 6. Direction **(inferred — owner should confirm or replace)**

Supply-versus-demand already exists in a first form: `/forecast` joins `orders`
into each month and shows, per variety, projected pounds against `lbs ordered`
with the unallocated surplus or shortfall. The chart also draws three months of
recorded weight actuals behind six months of projection. Treat this axis as
*started*, not missing.

The open work, in rough order of value:

- **Close the accuracy loop.** The actuals and the projection are drawn on the
  same chart but never compared numerically. Comparing `weight_harvests` against
  forecast pounds would let each variety's `pounds_per_bunch` and `success_rate`
  be tuned from real data instead of estimated once.
- **Surface shortfalls before they happen.** The per-month shortfall is visible
  only by opening `/forecast` and reading it. Nothing surfaces "you are short in
  November" on the home screen.
- **Reliability of the production database** — see
  [ADR 0007](decisions/0007-seed-data-as-backup.md); the free-tier Supabase
  project has already been lost once, and data entered on the deployed app is not
  in the committed snapshot until someone refreshes it from local.

## 7. How to change this document

Open a change to this file on its own, not bundled with a feature. State what is
changing and why. If a technical choice merely *follows* from the constitution,
it belongs in an ADR instead.
