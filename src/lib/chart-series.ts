/**
 * The contract between the forecast page (which assembles chart rows on the
 * server) and the chart component (which is a Client Component).
 *
 * It lives here rather than in `forecast-chart.tsx` because a Server Component
 * cannot call a runtime export from a `"use client"` module — those exports
 * become client references. Types would erase fine; `seriesKey` would not.
 *
 * Each month carries two series per variety. Recorded pounds come from
 * `weight_harvests`, projected pounds from the growth model; ADR 0004 is
 * explicit that the two must never be summed, so they are separate stacks that
 * sit beside each other rather than one stack that adds up. See ADR 0013.
 */
export type Series = "actual" | "forecast";

/** `"Apple"` + `"actual"` → `"Apple::actual"`. */
export function seriesKey(variety: string, series: Series): string {
  return `${variety}::${series}`;
}

/**
 * Inverse of `seriesKey`; null for anything that is not a series key.
 *
 * Splits on the **last** `::` so a variety whose name contains one still round
 * trips.
 */
export function parseSeriesKey(
  key: string
): { variety: string; series: Series } | null {
  const at = key.lastIndexOf("::");
  if (at === -1) return null;
  const series = key.slice(at + 2);
  if (series !== "actual" && series !== "forecast") return null;
  const variety = key.slice(0, at);
  if (variety === "") return null;
  return { variety, series };
}

export interface ChartMonth {
  monthLabel: string;
  /** Wholly in the past: recorded only. Drives the shaded band. */
  isActual: boolean;
  /** The month we are in: recorded so far *and* still expected. */
  isCurrent: boolean;
  [seriesKey: string]: number | string | boolean;
}
