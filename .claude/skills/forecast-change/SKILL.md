---
name: forecast-change
description: Modify BananaPlan's harvest forecasting logic in src/lib/forecast.ts, or anything that changes projected bunches, pounds, or dates — including the forecast page and chart. Use for changes to how harvests consume forecast, how growth cycles are timed, or how the forecast is grouped and displayed.
---

# Change the forecast

The forecast is the product ([constitution](../../../docs/constitution.md) §1).
Everything else exists to keep it honest. Treat changes here with more care than
anywhere else in the app.

**Read [ADR 0003](../../../docs/decisions/0003-forecast-original-baseline.md)
before editing `src/lib/forecast.ts`.** It records the central decision —
harvests reduce quantity and never re-time the schedule — and reversing it by
accident is easy.

## What the code does

`computeForecast(inventoryRows, harvestRecords)` in
[`src/lib/forecast.ts`](../../../src/lib/forecast.ts):

1. Pools recorded bunches per `fieldId:varietyId`.
2. Sorts plantings by first expected harvest date, so the pool drains against the
   oldest planting first.
3. For each planting: `survivingMats = floor(numberOfMats × successRate)`;
   skips the planting entirely if that is zero.
4. Generates `totalBunchesPerMat` events — the first at
   `plantingDate + monthsToFirstBunch`, then each subsequent at
   `firstDate + monthsToSubsequent × i` — **all from the original baseline**,
   each carrying `survivingMats` bunches.
5. Subtracts the harvest pool from the earliest events first, zeroing them as
   consumed, then **sets the pool to 0** — surplus is absorbed, never carried to
   a later planting.
6. Returns only events dated today or later with bunches remaining, sorted by
   date.

`groupForecastByMonth` buckets those into months for `/forecast` and the chart.

## Invariants you must not break

From [constitution](../../../docs/constitution.md) §4 and ADR 0003:

- **The forecast is derived, never stored.** Do not add a forecast table, a
  cache, or a materialized column. A stored forecast goes stale the instant a
  planting or harvest is edited.
- **No past events.** `computeForecast` returns only `date >= today`.
- **Harvests reduce quantity, not timing.** Do not re-anchor subsequent bunches
  on an actual harvest date — harvest dates record when someone had time to
  pick, so one late pick would distort the whole series.
- **Surplus is absorbed, not carried forward.** Over-harvesting must not create a
  debt against later plantings.
- Only `bunch_harvests` consumes forecast. `weight_harvests` never does
  ([ADR 0004](../../../docs/decisions/0004-two-harvest-types.md)).

If a change requires breaking one of these, it is a decision — stop, and run
`log-decision` before writing the code.

## Date handling

This is where forecast bugs actually come from.

- `addMonths` adds whole months via `setMonth`, then the fractional part as
  `round(frac × 30.44)` days. Fractional months are meaningful — variety cycle
  columns are `numeric(5,2)`.
- `setMonth` overflows: adding 1 month to Jan 31 gives March 3. That is existing
  behavior; do not "fix" it without checking the tests.
- Planting dates arrive as `YYYY-MM-DD` strings and are parsed as
  `new Date(row.plantingDate + "T00:00:00")` — **local** midnight, deliberately.
  Dropping the `T00:00:00` makes it UTC and shifts the date a day earlier in
  Hawaii (UTC-10).
- In tests, always `new Date(2026, 2, 1)`. Never `new Date("2026-03-01")`.

## Numeric columns are strings

`monthsToFirstBunch`, `poundsPerBunch`, `successRate` and friends come out of
Drizzle as strings because they are Postgres `numeric`. `parseFloat` at use, and
do not change the column types — precision on yield and weight matters
([constitution](../../../docs/constitution.md) §4.5).

## Procedure

1. Read ADR 0003 and this file's invariants.
2. Read `src/lib/__tests__/forecast.test.ts` (31 tests) — it encodes the current
   behavior in detail, and is the specification in practice.
3. **Write the failing test first.** Forecast changes are arithmetic; a test that
   fails for the right reason before the change is the only real proof it did
   what you meant.
4. Make the change.
5. `npm run test:run` — all 168 must pass. If a forecast test now fails, decide
   deliberately whether it encoded the old behavior (update it, and say so) or
   caught a genuine regression (fix the code). Never edit a test purely to make
   it pass.
6. Check the consumers: `src/app/forecast/page.tsx`,
   `src/app/forecast/forecast-chart.tsx` (20 tests; recharts is fully mocked —
   SVG does not render in jsdom).
7. Sanity-check against real data before shipping:

   ```bash
   npm run dev   # then open /forecast
   ```

   Confirm the months and totals still look plausible against known plantings.
   Unit tests will not catch a change that is arithmetically consistent and
   agronomically wrong.

8. If the behavior changed rather than the implementation, run `log-decision`.
