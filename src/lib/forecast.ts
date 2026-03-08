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

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const wholeMonths = Math.floor(months);
  const fractionalDays = Math.round((months - wholeMonths) * 30.44);
  result.setMonth(result.getMonth() + wholeMonths);
  result.setDate(result.getDate() + fractionalDays);
  return result;
}

export function computeForecast(
  inventoryRows: InventoryRow[],
  harvestRecords: HarvestRecord[]
): ForecastEvent[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
      events.push({ date, bunches: survivingMats, bunchIndex: i });
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
