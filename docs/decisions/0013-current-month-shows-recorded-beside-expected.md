# 0013. Draw the current month as recorded beside expected

- **Status:** Accepted
- **Date:** 2026-07-30
- **Affects:** `src/app/forecast/page.tsx`, `src/app/forecast/forecast-chart.tsx`,
  `src/lib/chart-months.ts`, `src/lib/chart-series.ts`

## Context

The 9-month chart drew three months of recorded weight behind six months of
projection, and decided which was which with `isActual = i < 0` — where `i = 0`
is the month we are in. The current month therefore rendered as pure forecast
and never read `actualsByMonth`.

The consequence, found from real data: a 500 lb weight harvest logged on July 1
was invisible on the chart for the whole of July. It appeared only once the
month rolled over. Backdating the same record to June made it show immediately —
nothing about the record mattered, only which side of the comparison its month
fell on.

That is the worst month to lose. The current month is precisely when the
operator is standing in a field recording harvests, and it was the one month
where what they recorded did not appear.

Compounding it, `computeForecast` returns only events dated today or later
([constitution](../constitution.md) §4.2), so the current month's projection is
already partial — the remainder of the month, not the whole of it. The July bar
showed neither what had happened nor what had been expected.

## Decision

The current month draws **both** series, side by side:

- **Recorded** — weight harvests logged in this month so far.
- **Expected** — forecast events from today to the end of the month.

They are two adjacent stacks, never one. `weight_harvests` does not consume the
forecast ([ADR 0004](0004-two-harvest-types.md)), so the same physical fruit can
appear in both; adding them would double count, and ADR 0004 says in as many
words not to build a view that sums the two. Recorded is drawn at 45% opacity of
the variety's colour so a pair reads as one variety in two states.

Months either side are unchanged: wholly past months show recorded only, wholly
future months show projection only.

Two supporting pieces:

- **`src/lib/chart-series.ts`** holds the page↔chart contract —
  `seriesKey("Apple", "actual")` → `"Apple::actual"`. It is a plain module, not
  part of the `"use client"` chart, because a Server Component cannot call a
  runtime export from a client module.
- **`src/lib/chart-months.ts`** holds `buildChartMonths`, extracted from the
  page so the past/current/future branch is testable. The page is an async
  Server Component and was untested; this is the logic that carried the bug.

## Consequences

**Easy:** a harvest recorded today is visible today. The current month stops
being a hole in the chart.

**Hard, and paid on every month:**

- **Every month reserves two bar slots, not just the current one.** Recharts
  allocates slots per category uniformly, so the eight single-series months
  render narrower and sit off-centre in their slot. `barCategoryGap` was cut
  from 25% to 12% with `barGap={2}` to claw some width back, but the bars are
  still about **40% narrower** than before — two slots share 88% of the
  category where one previously had 75%. Around 15px at `max-w-lg`, which is
  legible on a phone but visibly thinner. This was chosen with eyes open over
  the alternative of populating both series on every month.
- **The dashed "forecast starts here" divider now sits at the left edge of a
  month that is partly recorded.** Slightly imprecise, but the current month is
  visibly a pair, which carries the meaning.
- **`chartVarieties` now scans `i <= 0`.** A variety whose only record is from
  this month needs a colour and a filter pill; scanning to `i < 0` would drop it
  from both, and its bar would silently not render.
- **This does not fix past-due unharvested events.** A first bunch dated earlier
  this month is dropped inside `computeForecast` before the chart sees it, so it
  appears in neither series. That is a separate and larger problem — the
  forecast cannot distinguish "you picked it" from "the date passed" — and is
  deliberately left alone here.

## Alternatives considered

- **Stack recorded and expected in one bar** — the sum ADR 0004 explicitly warns
  against, since the two can describe the same fruit.
- **Dual series on all nine months** — removes the off-centre problem entirely
  and delivers the actual-vs-projection comparison the
  [constitution](../constitution.md) §6 calls the top open work. It needs an
  unfiltered `computeForecast` variant to get past-month projections (still
  derived, so invariant 1 holds). Rejected for now as more than the fix
  required; it remains the natural next step.
- **Leave it and document it** — the behaviour was defensible against the
  written design, but the operator loses today's work from today's chart.
