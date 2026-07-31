export interface InventoryRow {
  id: number;
  fieldId: number;
  fieldName: string;
  siteName: string;
  varietyId: number;
  varietyName: string;
  numberOfMats: number;
  plantingDate: string; // YYYY-MM-DD
  monthsToFirstBunch: string;
  monthsToSubsequentBunch: string;
  totalBunchesPerMat: number;
  poundsPerBunch: string;
  successRate: string;
}

export interface HarvestRecord {
  fieldId: number;
  varietyId: number;
  bunches: number;
  harvestDate: string;
}

export interface ForecastEvent {
  inventoryId: number;
  fieldId: number;
  fieldName: string;
  siteName: string;
  varietyId: number;
  varietyName: string;
  expectedDate: Date;
  expectedBunches: number;
  expectedPounds: number;
  bunchIndex: number;
}

/**
 * Move a date to the last day of its own month.
 *
 * A bunch expected on the 1st was previously discarded from the 2nd onward,
 * because `computeForecast` keeps only events dated today or later. That threw
 * away fruit nobody had picked, and worse, it made recording a harvest against
 * that bunch a no-op: the deduction landed on an event that was about to be
 * filtered out.
 *
 * The whole app reasons in months — the forecast page, the chart and the
 * dashboard all group by month, and no day-level expected date is ever shown.
 * So an event lives for the month it belongs to, and expires when that month
 * does. See ADR 0014.
 */
function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const wholeMonths = Math.floor(months);
  const fractionalDays = Math.round((months - wholeMonths) * 30.44);
  result.setMonth(result.getMonth() + wholeMonths);
  result.setDate(result.getDate() + fractionalDays);
  return result;
}

/** Where the farm is. Dates in this app are its calendar dates, not the server's. */
const FARM_TIME_ZONE = "Pacific/Honolulu";

/**
 * The farm's calendar date as `YYYY-MM-DD`.
 *
 * Vercel runs functions in UTC while the farm is UTC-10, so for the last ten
 * hours of every Hawaii day the server has already turned the page. At a month
 * boundary that discarded the whole month's forecast at 14:00 HST on the last
 * day — and since harvest deduction happens before the date filter, a harvest
 * recorded in that window was silently a no-op, which is the exact failure
 * ADR 0014 exists to remove.
 */
export function farmDateString(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FARM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * The farm's today, as a Date at local midnight — the same frame event dates
 * live in, since those come from `new Date(plantingDate + "T00:00:00")`. Both
 * sides are calendar dates, so the comparison is calendar-to-calendar and does
 * not depend on the server's timezone.
 */
export function farmToday(now: Date = new Date()): Date {
  const [year, month, day] = farmDateString(now).split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function computeForecast(
  inventoryRows: InventoryRow[],
  harvestRecords: HarvestRecord[]
): ForecastEvent[] {
  const today = farmToday();

  // Build harvest totals keyed by "fieldId:varietyId"
  const harvestTotals: Record<string, number> = {};
  for (const h of harvestRecords) {
    const key = `${h.fieldId}:${h.varietyId}`;
    harvestTotals[key] = (harvestTotals[key] ?? 0) + h.bunches;
  }

  // Sort rows by first expected harvest date so deductions hit the earliest planting first
  const sortedRows = [...inventoryRows].sort((a, b) => {
    const aDate = addMonths(
      new Date(a.plantingDate + "T00:00:00"),
      parseFloat(a.monthsToFirstBunch)
    );
    const bDate = addMonths(
      new Date(b.plantingDate + "T00:00:00"),
      parseFloat(b.monthsToFirstBunch)
    );
    return aDate.getTime() - bDate.getTime();
  });

  // Mutable remaining tracker shared across rows with the same fieldId:varietyId
  const harvestRemaining: Record<string, number> = { ...harvestTotals };

  const results: ForecastEvent[] = [];

  for (const row of sortedRows) {
    const successRate = parseFloat(row.successRate);
    const survivingMats = Math.floor(row.numberOfMats * successRate);
    if (survivingMats === 0) continue;

    const monthsFirst = parseFloat(row.monthsToFirstBunch);
    const monthsSubsequent = parseFloat(row.monthsToSubsequentBunch);
    const totalBunches = row.totalBunchesPerMat;
    const poundsPerBunch = parseFloat(row.poundsPerBunch);

    const plantingDate = new Date(row.plantingDate + "T00:00:00");

    // Generate all expected events on the original baseline
    const events: { date: Date; bunches: number; bunchIndex: number }[] = [];
    const firstDate = addMonths(plantingDate, monthsFirst);

    for (let i = 0; i < totalBunches; i++) {
      const date =
        i === 0 ? firstDate : addMonths(firstDate, monthsSubsequent * i);
      // Ceiling to the month's end so the event survives its own month. The
      // month is unchanged, so grouping is unaffected.
      events.push({ date: endOfMonth(date), bunches: survivingMats, bunchIndex: i });
    }

    // Subtract harvested bunches from earliest events first,
    // sharing the remaining count across all rows with the same fieldId:varietyId
    const key = `${row.fieldId}:${row.varietyId}`;
    let remaining = harvestRemaining[key] ?? 0;

    for (const event of events) {
      if (remaining <= 0) break;
      if (event.bunches <= remaining) {
        remaining -= event.bunches;
        event.bunches = 0;
      } else {
        event.bunches -= remaining;
        remaining = 0;
      }
    }

    // Don't carry surplus to future plantings — excess harvest is simply absorbed
    harvestRemaining[key] = 0;

    // Only include future events with bunches remaining
    for (const event of events) {
      if (event.date >= today && event.bunches > 0) {
        results.push({
          inventoryId: row.id,
          fieldId: row.fieldId,
          fieldName: row.fieldName,
          siteName: row.siteName,
          varietyId: row.varietyId,
          varietyName: row.varietyName,
          expectedDate: event.date,
          expectedBunches: event.bunches,
          expectedPounds: event.bunches * poundsPerBunch,
          bunchIndex: event.bunchIndex,
        });
      }
    }
  }

  results.sort((a, b) => a.expectedDate.getTime() - b.expectedDate.getTime());
  return results;
}

export function groupForecastByMonth(events: ForecastEvent[]): {
  monthKey: string;
  label: string;
  events: ForecastEvent[];
  totalBunches: number;
  totalPounds: number;
}[] {
  const groups: Record<
    string,
    {
      monthKey: string;
      label: string;
      events: ForecastEvent[];
      totalBunches: number;
      totalPounds: number;
    }
  > = {};

  for (const event of events) {
    const year = event.expectedDate.getFullYear();
    const month = event.expectedDate.getMonth();
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;

    if (!groups[key]) {
      groups[key] = {
        monthKey: key,
        label: event.expectedDate.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        }),
        events: [],
        totalBunches: 0,
        totalPounds: 0,
      };
    }

    groups[key].events.push(event);
    groups[key].totalBunches += event.expectedBunches;
    groups[key].totalPounds += event.expectedPounds;
  }

  return Object.values(groups).sort((a, b) =>
    a.monthKey.localeCompare(b.monthKey)
  );
}
