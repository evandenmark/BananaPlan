# 0003. The forecast keeps its original baseline after a harvest

- **Status:** Accepted
- **Date:** 2026-07-28 *(recorded retroactively; decision made 2026-02)*
- **Affects:** `src/lib/forecast.ts`, `/forecast`

## Context

Each planting produces an expected series of harvest events: the first at
`planting_date + months_to_first_bunch`, then one every
`months_to_subsequent_bunch` after that, `total_bunches_per_mat` times, at
`floor(mats × success_rate)` bunches each.

When a real harvest is recorded, it rarely lands exactly on a predicted date.
Something has to reconcile the two, and there is a real fork:

- **Option A** — treat the recorded harvest as consuming expected bunches, but
  leave every remaining date where it was.
- **Option B** — treat the actual harvest date as the new anchor and re-time all
  subsequent bunches relative to it.

Option B is intuitively appealing: if a bunch came in three weeks late, the next
one presumably follows three weeks later. But harvest dates in practice reflect
*when someone had time to pick*, not when the fruit matured, and a single early
or late pick would then shift the entire remaining schedule for that planting.

## Decision

**Option A.** Recorded harvests reduce quantity, never re-time the schedule.

Specifically, in `computeForecast`:

- All events for a planting are generated on the original baseline from the
  planting date.
- Harvested bunches are pooled per `fieldId:varietyId` and subtracted from the
  **earliest** events first, zeroing them out as they are consumed.
- Plantings are processed in order of first expected harvest, so the pool drains
  against the oldest planting first.
- **Surplus is absorbed, not carried.** After a planting is processed,
  `harvestRemaining[key]` is set to `0`. Harvesting more than a planting expected
  does not create a debt against later plantings of the same field and variety.
- Only events dated today or later with bunches remaining are returned.

## Consequences

- The forecast is stable. Recording a harvest changes quantities on the chart,
  never the shape of the timeline.
- Reconciliation is per `fieldId:varietyId`, so two plantings of the same variety
  in the same field share one harvest pool and cannot be told apart. This is
  deliberate — the harvest record does not identify which planting was picked.
- **Cost:** a planting that genuinely runs late keeps showing overdue-looking
  events at their original dates until they are harvested away.
- **Cost:** consistently over-harvesting silently discards the surplus rather
  than surfacing that a variety's `pounds_per_bunch` or `success_rate` is
  mis-calibrated. Closing that loop is listed under direction in the
  [constitution](../constitution.md).

Any change to this logic must keep `src/lib/__tests__/forecast.test.ts` (31
tests) passing; several encode exactly the behaviors above.

## Alternatives considered

- **Option B, re-anchor on actual harvest date** — rejected above: harvest dates
  measure labor availability, so one irregular pick would distort the whole
  remaining series.
- **Carry surplus forward across plantings** — would make a single mis-entered
  bunch count erase future forecast for the field. The absorbed-surplus rule
  fails in a more visible and less destructive direction.
