# Glossary

Domain vocabulary. These words appear in the schema, the UI, and the forecast
math, and several do not mean what a non-farmer would guess.

**Mat** — one banana plant *stand*: the corm and the succession of stems growing
from it. The unit of planting. `field_inventory.number_of_mats` counts mats, not
individual stems, because a mat is what occupies ground and what produces over
its life.

**Bunch** — the whole cluster of fruit cut from one stem, made up of several
hands. The harvest unit: `bunch_harvests.bunches` counts bunches, and forecast
events are denominated in them.

**Hand** — one tier of bananas within a bunch. Not modeled; recorded here only
indirectly through `varieties.bananas_per_bunch`.

**Months to first bunch** (`months_to_first_bunch`) — from planting date to the
first harvestable bunch from a mat. Numeric with two decimals, so fractional
months are meaningful; `addMonths` in `src/lib/forecast.ts` converts the
fractional part at 30.44 days per month.

**Months to subsequent bunch** (`months_to_subsequent_bunch`) — the cycle time
between bunches after the first, as the mat's followers mature in succession.
Shorter than the time to first bunch.

**Total bunches per mat** (`total_bunches_per_mat`) — how many bunches a mat is
expected to yield over its productive life before replanting. Bounds the
forecast: a planting produces this many events and then stops.

**Success rate** (`success_rate`) — the fraction of planted mats expected to
survive and produce. Applied once, at the start:
`survivingMats = floor(number_of_mats × success_rate)`. A planting whose
surviving mats round to zero produces no forecast at all.

**Pounds per bunch** (`pounds_per_bunch`) — average harvested weight of one
bunch of the variety. The bridge from bunch counts to the pounds that orders are
denominated in.

**Planting** — informal name for one row of `field_inventory`: a quantity of
mats of one variety put in one field on one date. A field may hold several
plantings, including of the same variety on different dates.

**Site** — a physical farm location. Currently Kemo'o (id 1) and Big Tree (id 2).

**Field** — a named working area within a site. Owns plantings and is what bunch
harvests are attributed to.

**Bunch index** (`bunchIndex` in `ForecastEvent`) — which cycle an event belongs
to for its planting; `0` is the first bunch, `1` the second, and so on.

**Forecast event** — one projected harvest: a planting, a date, an expected bunch
count, and the pounds those bunches imply. Computed on the fly, never stored.
