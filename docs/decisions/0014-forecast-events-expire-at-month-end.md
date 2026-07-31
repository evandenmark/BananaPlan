# 0014. Forecast events live for their whole month, then expire

- **Status:** Accepted
- **Date:** 2026-07-30
- **Affects:** `computeForecast` in `src/lib/forecast.ts`, the "Next 60 days"
  window on `src/app/page.tsx`

## Context

`computeForecast` returns only events dated `>= today`, and event dates were
exact to the day. A planting of Gros Michel on 2025-04-01 with 15 months to
first bunch produced an event on 2026-07-01, which disappeared from the forecast
on 2026-07-02 — while the operator was still in the month the fruit was expected
in, and while the bunches were still on the mat.

Two consequences, both found from production data on 2026-07-30:

1. **5,000 lbs of Gros Michel and 760 lbs of Apple were missing from July**, a
   month that had not ended.
2. **Recording a harvest against such an event did nothing at all.** Harvest
   deduction runs *before* the date filter, so 8 recorded bunches were
   subtracted from the 2026-07-01 event, which was then discarded — and
   `harvestRemaining` is zeroed afterwards, so the deduction never reached any
   surviving event. Running the real `computeForecast` with and without those 8
   bunches produced byte-identical output. The operator did the work, tapped it
   in, and the forecast did not move.

The second is the serious one. Losing a projection is a bad estimate; losing an
input is a broken instrument.

## Decision

**An event is stamped on the last day of the month it belongs to, and expires
when that month does.**

`endOfMonth` is applied at event generation, so a bunch expected any time in July
carries 2026-07-31. It survives the `>= today` filter for the whole of July,
absorbs any harvest recorded during July, and is written off on August 1 along
with whatever was never picked.

The app already reasons in months everywhere it faces the operator — the
forecast page, the chart and the dashboard all group by month, and **no
day-level expected date is rendered anywhere**. This aligns the data with how it
is read.

**"Today" is the farm's date, not the server's.** Vercel runs functions in UTC
and the farm is UTC-10, so for the last ten hours of every Hawaii day the server
has already turned the page. At a month boundary that discarded the whole
month's forecast at 14:00 HST on the last day — reintroducing the exact no-op
this ADR exists to remove, once a month. `computeForecast` now derives `today`
from `farmToday()`, which reads the calendar date in `Pacific/Honolulu` via
`Intl` and returns it at local midnight — the same frame event dates live in,
since those come from `new Date(plantingDate + "T00:00:00")`. Both sides are
calendar dates, so the comparison no longer depends on where the code runs.
`/` and `/forecast` use the same helper, so "this month" means the same thing on
every screen.

This is deliberately *not* solved by setting `TZ` in the Vercel dashboard.
Correctness that lives in an env var is invisible in the repo and silently lost
on a new project — the free tier has already eaten this project once
([ADR 0007](0007-seed-data-as-backup.md)).

Two things deliberately left alone:

- **The deduction sort still uses exact dates.** `computeForecast` orders
  plantings by their raw first-harvest date so the harvest pool drains against
  the genuinely-earliest planting. Sorting on ceilinged dates would tie every
  planting fruiting in the same month and make the order depend on row order.
- **Grouping is untouched.** Month-end is the same month, so
  `groupForecastByMonth` output is unchanged.

## Consequences

**Easy:** the current month is complete and actionable. A harvest recorded any
time during the month reduces that month's expectation, which is the behaviour
an operator would assume they were getting.

**The cliff moves rather than disappearing.** On the 1st, an unpicked remainder
is still discarded silently. That is now a **deliberate write-off, not an
accident of the calendar** — see the alternatives below for why that is the
wanted behaviour — but nothing yet records that it happened. Surfacing the
variance is deferred.

**"Next 60 days" on the dashboard became month-overlapping.** Comparing a
month-end stamp against a mid-month cutoff would drop a whole month for the sake
of a few days — an event truly due Sep 10, stamped Sep 30, falls outside
`now + 60 days`. The filter now counts an event when its *month* overlaps the
window, so the headline may reach a few weeks past a literal 60 days. The label
is unchanged; the number no longer under-reports.

**Expected dates are no longer meaningful to the day.** Nothing displays them
today, but any future feature wanting a day-accurate harvest date must recompute
it rather than read `expectedDate`.

**Anything comparing an `expectedDate` must compare calendar dates.** Every
current-month event now sits at midnight on one specific day, so a comparison
against a `new Date()` carrying a time of day drops the entire month for that
whole day — it is not an off-by-one, it is the month vanishing. Use
`farmToday()`. This bit `/` (the "Next 60 days" headline read 0 for 24 hours at
each month end) and `/forecast` (a variety could drop out of the chart's series
while still listed in the month card below) before it was caught in review.

## Alternatives considered

- **Carry past-due unharvested events forward as "overdue"** — rejected by the
  owner, and the reasoning is the part worth keeping. Fruit still on the
  forecast after its month has passed most likely *does not exist*: a storm, or
  a success rate that was optimistic for that site. Carrying it forward would
  accumulate phantom stock that has no physical referent, and each month would
  add another layer. For a tool whose stated job is keeping the forecast honest
  ([constitution](../constitution.md) §1), that is the worse failure. Dropping
  is the correct treatment for fruit that never materialised — the defect was
  only that it dropped *mid-month*, and that it ate recorded harvests on the way
  out.
- **Keep exact dates and extend the filter to `>= start of this month`** —
  equivalent effect for the current month, but leaves every event's date a day
  in the past, so the sort, the dashboard window and any future consumer all
  need the same special case. Ceiling puts the rule in one place.
- **Record the write-off as variance** (expected vs recorded per month, feeding
  `success_rate` tuning) — the natural v2, and the thing the
  [constitution](../constitution.md) §6 calls the top open work. Deliberately
  not built now. Note the chart already shows recorded beside expected for the
  current month ([ADR 0013](0013-current-month-shows-recorded-beside-expected.md)),
  so the comparison is available by eye even before it is a stored number.
