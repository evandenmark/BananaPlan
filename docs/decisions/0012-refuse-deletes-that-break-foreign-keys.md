# 0012. Refuse deletes that would break a foreign key

- **Status:** Accepted
- **Date:** 2026-07-30
- **Affects:** every `delete*` Server Action in `src/app/actions/`,
  `src/lib/references.ts`, `/varieties`, `/sites`, `/clients/[id]`

## Context

`deleteVariety` and `deleteSite` both ran an unconditional `DELETE`. Every
foreign key in `src/db/schema.ts` is a plain `references()` — no
`ON DELETE CASCADE`, no `ON DELETE SET NULL` — so Postgres rejected them:

```
update or delete on table "varieties" violates foreign key constraint
"field_inventory_variety_id_varieties_id_fk"
```

Neither action caught it, so the operator got the generic `Something went wrong`
error boundary with nothing to act on. Both were unfixable-by-tapping in
practice: every variety in the database was referenced, and both sites had
fields, so those Delete buttons could only fail.

The reflex fix — cascade — is wrong for most of this schema. A variety is not a
standalone record; it is the growth model the forecast is computed from, and the
`bunch_harvests` and `weight_harvests` rows pointing at it are the record of
what was actually picked. The [constitution](../constitution.md) §4.2 makes
harvest records the source of truth about the past. Cascading would silently
destroy that to satisfy one tap on a phone, and the operator would have no way
of knowing it happened.

The full reference graph, and what each delete has to contend with:

| Deleting | Referenced by | Policy |
| --- | --- | --- |
| `varieties` | `field_inventory`, `orders`, `bunch_harvests`, `weight_harvests` | Refuse |
| `sites` | `fields` | Refuse |
| `clients` | `orders` | Cascade, in a transaction |
| `field_inventory`, `orders`, `bunch_harvests`, `weight_harvests` | nothing | Delete freely |

## Decision

**A Server Action that deletes a row other rows can reference must count those
references first, and must not let a constraint violation reach the operator.**

- The counts come from [`src/lib/references.ts`](../../src/lib/references.ts),
  which holds one spec list per parent table mirroring the foreign keys in the
  schema. **Adding a foreign key means adding a row there**; a missing row means
  the guard silently passes.
- The default is to **refuse**. `deleteVariety` and `deleteSite` return
  `{ deleted: false, reason }` — never throw — where `reason` names what is in
  the way in domain terms: *"5 plantings, 2 bunch harvests and 1 weight
  record"*.
- **The page never renders a Delete button that can only fail.** `/varieties`
  and `/sites` fetch the same counts alongside their list query and show the
  reason in place of the button.
- **Those counts enlarged what the two pages read, so `ROUTES_BY_TABLE` grew to
  match** ([ADR 0008](0008-centralized-revalidation.md)): `/varieties` is now
  listed under `fieldInventory`, `orders`, `bunchHarvests` and
  `weightHarvests`, and `/sites` under `fields`. This is stricter than the usual
  staleness argument — what goes stale here is not a displayed number but
  *whether a destructive control is on screen*. Recording the first planting of
  a variety must invalidate `/varieties`, or the operator is left tapping a
  Delete button that silently does nothing.
- **`clients` is the one documented exception, and it cascades.**
  `orders.client_id` is `NOT NULL`, so an order cannot outlive its client, and
  an order states future demand rather than recording a past harvest — nothing
  about the past is lost. Both deletes run in one `db.transaction` so a failure
  between them cannot strand a client whose orders are already gone, and
  `/clients/[id]` states the count before the tap: *"Deleting this client also
  deletes 3 orders."*
- Leaf rows — plantings, orders, and both kinds of harvest record — are deleted
  without ceremony. Nothing references them.

## Consequences

**Easy:** no delete path in the app can produce the generic error boundary from
a foreign key. Harvest history cannot be destroyed by deleting a parent. The
operator learns *what* is in the way before tapping, which is the actionable
part, since the fix is always "remove those first".

**Hard, and worth knowing:**

- **Refusing makes some rows permanent in practice.** A variety with a single
  harvest record can never be deleted. Neither can a site with fields — and
  since the app has no way to delete a *field* at all (there is no
  `deleteField`; `fields.is_active` is how a field is retired), a site with
  fields is undeletable with no path forward. The message is honest about the
  cause but points at an operation that does not exist. **This is a known gap,
  not a solved problem** — see below.
- **The list pages cost extra queries.** `/varieties` runs four grouped counts
  per render, `/sites` one. They go out in parallel against a pool capped at 3
  ([ADR 0005](0005-small-connection-pool.md)), so on `/varieties` one of the
  four waits for a connection. Cheap at this data size; it scales with the
  number of parent rows, not the rows displayed.
- **The counts can go stale between render and tap.** The action re-checks, so
  the outcome is correct either way: the delete is refused, the page
  revalidates, and the row reappears showing why. Nothing surfaces a message in
  that window — acceptable because this is a single-operator app
  ([constitution](../constitution.md) §2) with no concurrent writer.
- **Two entities have `is_active` and two do not.** `fields` and `orders` can be
  retired without deleting; `sites` and `varieties` cannot. That asymmetry is
  what makes "refuse" a dead end for sites specifically. Resolving it means an
  `is_active` column on `sites` and `varieties` and filtering the pickers — a
  schema change and a separate decision, deliberately not made here.

## Alternatives considered

- **`ON DELETE CASCADE` on the foreign keys** — pushes the problem into the
  schema where it is invisible at the call site, and would delete
  `bunch_harvests` and `weight_harvests` rows, contradicting constitution §4.2
  and silently changing the forecast for every field that grew the variety.
- **Cascade in application code, for every parent** — same data loss, with the
  added property that the operator is never told. Rejected for varieties and
  sites; accepted only for clients, where the child rows are demand, not
  history.
- **Soft delete (`is_active`) everywhere** — the better long-term answer for
  sites and varieties, and it would remove the dead end above. But every query
  reading those tables would have to filter, and the pickers would still need to
  show inactive rows when editing old records. That is a schema change and a
  much larger surface than these two crashes warranted.
- **Catch the FK violation and show the Postgres error** — a one-line fix, but
  the message names constraints and tables rather than plantings and harvests,
  and it arrives only after the operator has already tapped Delete.
- **Guard only in the action, leaving the button** — simpler, but leaves a
  control on screen whose only outcome is a refusal. The operator standing in a
  field learns nothing until they tap it.
