# 0004. Track bunch harvests and weight harvests in separate tables

- **Status:** Accepted
- **Date:** 2026-07-28 *(recorded retroactively; decision made 2026-02)*
- **Affects:** `bunch_harvests`, `weight_harvests`, `src/app/actions/harvest.ts`

## Context

Two different things get recorded on a farm day, by different people at different
moments:

- In the field: *how many bunches came off which field.* Known precisely, known
  immediately, attributable to a location.
- At the packing scale: *how many pounds of a variety went out.* Known precisely
  by weight, but by then the fruit from several fields is mixed and the field of
  origin is gone.

Forcing these into one table means either fabricating a field on weight records
or fabricating a weight on bunch records.

## Decision

Two tables, with different shapes and different meanings.

| | `bunch_harvests` | `weight_harvests` |
| --- | --- | --- |
| Scoped to | field **and** variety | variety only |
| Measures | `bunches` (integer) | `pounds` (numeric) |
| Consumes forecast | **yes** | **no** |

`computeForecast` reads only `bunch_harvests`. `weight_harvests` never changes a
projection.

It does, however, appear **on** `/forecast`: the chart draws three months of
recorded weight actuals behind six months of projection, and the page reads
`weight_harvests` directly to build them. "Does not consume the forecast" is not
the same as "is not shown on the forecast page" — a distinction that produced a
real revalidation gap, since fixed
([0008](0008-centralized-revalidation.md)).

## Consequences

- Each record means one unambiguous thing, and neither requires invented data.
- The forecast stays driven by the measurement that is actually attributable to a
  planting.
- **Cost:** total pounds harvested cannot be derived from one place. Bunch
  harvests imply pounds via `varieties.pounds_per_bunch`; weight harvests give
  pounds directly. These two numbers will disagree, and that disagreement is
  signal, not error — it is the calibration feedback described in the
  [constitution](../constitution.md) §6.
- **Cost:** an operator recording the same physical harvest in both places
  double-counts it in any naive sum. Do not add a view that adds the two together
  without deciding what that number means.

## Alternatives considered

- **One `harvests` table with nullable `bunches`, `pounds`, and `field_id`** —
  every consumer would have to branch on which columns are populated, and nothing
  would prevent a row that is neither.
- **Derive pounds only from bunches, drop weight tracking** — throws away the
  only ground-truth weight measurement the farm actually takes, which is the one
  number a client's order is denominated in.
