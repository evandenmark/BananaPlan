import { seriesKey, type ChartMonth } from "./chart-series";

/** The shape `groupForecastByMonth` produces, narrowed to what the chart needs. */
export interface MonthGroup {
  monthKey: string;
  events: { varietyName: string; expectedPounds: number }[];
}

export interface BuildChartMonthsParams {
  /** Anchor for the window. The month containing this date is "current". */
  today: Date;
  /** Variety names to emit series for; anything else is ignored. */
  varieties: string[];
  /** `"2026-07"` → variety name → recorded pounds. */
  actualsByMonth: Record<string, Record<string, number>>;
  /** Forecast events already grouped by month. */
  grouped: MonthGroup[];
  /** Months of history to show. Default 3. */
  monthsBefore?: number;
  /** Months of projection to show, counting the current month. Default 6. */
  monthsAfter?: number;
}

/**
 * Build the chart's month rows.
 *
 * Three states, and the middle one is the point:
 *
 * - **Past** — recorded weight only. The projection for a past month is not
 *   shown; `computeForecast` returns nothing before today.
 * - **Current** — recorded so far **and** still expected, as two series. Before
 *   ADR 0013 this month read as pure forecast, so a weight harvest logged today
 *   appeared nowhere on the chart until the month rolled over.
 * - **Future** — projection only.
 *
 * Every row carries both series keys for every variety, zero-filled, so the
 * chart can declare a fixed set of bars without probing the data.
 */
export function buildChartMonths({
  today,
  varieties,
  actualsByMonth,
  grouped,
  monthsBefore = 3,
  monthsAfter = 6,
}: BuildChartMonthsParams): ChartMonth[] {
  const rows: ChartMonth[] = [];
  const known = new Set(varieties);

  for (let i = -monthsBefore; i < monthsAfter; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const isPast = i < 0;
    const isCurrent = i === 0;

    const row: ChartMonth = {
      monthLabel: d.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      }),
      isActual: isPast,
      isCurrent,
    };
    for (const v of varieties) {
      row[seriesKey(v, "actual")] = 0;
      row[seriesKey(v, "forecast")] = 0;
    }

    if (isPast || isCurrent) {
      for (const [name, lbs] of Object.entries(actualsByMonth[monthKey] ?? {})) {
        if (known.has(name)) row[seriesKey(name, "actual")] = Math.round(lbs);
      }
    }

    if (!isPast) {
      const match = grouped.find((g) => g.monthKey === monthKey);
      for (const event of match?.events ?? []) {
        if (!known.has(event.varietyName)) continue;
        const key = seriesKey(event.varietyName, "forecast");
        row[key] = (Number(row[key]) || 0) + Math.round(event.expectedPounds);
      }
    }

    rows.push(row);
  }

  return rows;
}
