import { db } from "@/db";
import {
  fieldInventory,
  fields,
  sites,
  varieties,
  bunchHarvests,
  weightHarvests,
  orders,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  computeForecast,
  groupForecastByMonth,
  type InventoryRow,
  type HarvestRecord,
} from "@/lib/forecast";
import { ForecastChart, type ChartMonth } from "./forecast-chart";

function getMonthlyOrderLbs(
  allOrders: {
    varietyId: number;
    poundsPerDelivery: string;
    frequency: string;
    startDate: string;
    endDate: string | null;
    isActive: boolean;
  }[],
  monthKey: string
): Record<number, number> {
  const [year, month] = monthKey.split("-").map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);

  const result: Record<number, number> = {};

  for (const order of allOrders) {
    if (!order.isActive) continue;
    const start = new Date(order.startDate + "T00:00:00");
    const end = order.endDate ? new Date(order.endDate + "T00:00:00") : null;

    if (start > monthEnd) continue;
    if (end && end < monthStart) continue;

    const lbs = parseFloat(order.poundsPerDelivery);
    if (!result[order.varietyId]) result[order.varietyId] = 0;

    if (order.frequency === "monthly") {
      result[order.varietyId] += lbs;
    } else if (order.frequency === "one_time") {
      if (start >= monthStart && start <= monthEnd) {
        result[order.varietyId] += lbs;
      }
    }
  }

  return result;
}

export default async function ForecastPage() {
  const inventoryRows = await db
    .select({
      id: fieldInventory.id,
      fieldId: fieldInventory.fieldId,
      fieldName: fields.name,
      siteName: sites.name,
      varietyId: fieldInventory.varietyId,
      varietyName: varieties.name,
      numberOfMats: fieldInventory.numberOfMats,
      plantingDate: fieldInventory.plantingDate,
      monthsToFirstBunch: varieties.monthsToFirstBunch,
      monthsToSubsequentBunch: varieties.monthsToSubsequentBunch,
      totalBunchesPerMat: varieties.totalBunchesPerMat,
      poundsPerBunch: varieties.poundsPerBunch,
      successRate: varieties.successRate,
    })
    .from(fieldInventory)
    .innerJoin(fields, eq(fieldInventory.fieldId, fields.id))
    .innerJoin(sites, eq(fields.siteId, sites.id))
    .innerJoin(varieties, eq(fieldInventory.varietyId, varieties.id))
    .where(eq(fields.isActive, true));

  const harvestRows = await db
    .select({
      fieldId: bunchHarvests.fieldId,
      varietyId: bunchHarvests.varietyId,
      bunches: bunchHarvests.bunches,
      harvestDate: bunchHarvests.harvestDate,
    })
    .from(bunchHarvests);

  const allOrders = await db
    .select({
      varietyId: orders.varietyId,
      poundsPerDelivery: orders.poundsPerDelivery,
      frequency: orders.frequency,
      startDate: orders.startDate,
      endDate: orders.endDate,
      isActive: orders.isActive,
    })
    .from(orders);

  const forecast = computeForecast(
    inventoryRows as InventoryRow[],
    harvestRows as HarvestRecord[]
  );
  const grouped = groupForecastByMonth(forecast);

  if (grouped.length === 0) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Forecast</h1>
        <p className="text-gray-500 text-center py-12">
          No forecast data yet. Add fields with inventory to see projections.
        </p>
      </div>
    );
  }

  // --- Build 9-month chart data: 3 past (actuals) + 6 forward (forecast) ---
  const today = new Date();

  // Fetch actual weight harvests for variety breakdown
  const actualRows = await db
    .select({
      varietyName: varieties.name,
      pounds: weightHarvests.pounds,
      harvestDate: weightHarvests.harvestDate,
    })
    .from(weightHarvests)
    .innerJoin(varieties, eq(weightHarvests.varietyId, varieties.id));

  // Group actuals by month-key → variety → total pounds
  const actualsByMonth: Record<string, Record<string, number>> = {};
  for (const h of actualRows) {
    const [yr, mo] = h.harvestDate.split("-");
    const key = `${yr}-${mo}`;
    if (!actualsByMonth[key]) actualsByMonth[key] = {};
    actualsByMonth[key][h.varietyName] =
      (actualsByMonth[key][h.varietyName] || 0) + parseFloat(h.pounds);
  }

  // Collect all variety names from both actuals (past 3 months) and forecast (next 6)
  const chartVarietySet = new Set<string>();
  for (let i = -3; i < 0; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    for (const v of Object.keys(actualsByMonth[key] ?? {})) chartVarietySet.add(v);
  }
  const sixMonthsOut = new Date(today.getFullYear(), today.getMonth() + 6, 0);
  for (const event of forecast) {
    if (event.expectedDate >= today && event.expectedDate <= sixMonthsOut) {
      chartVarietySet.add(event.varietyName);
    }
  }
  const chartVarieties = [...chartVarietySet].sort();

  // Build one row per month: i = -3 (3 months ago) … +5 (5 months ahead)
  const chartData: ChartMonth[] = [];
  for (let i = -3; i < 6; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    const isActual = i < 0;

    const row: ChartMonth = { monthLabel: label, isActual };
    for (const v of chartVarieties) row[v] = 0;

    if (isActual) {
      const monthActuals = actualsByMonth[monthKey] ?? {};
      for (const [vName, lbs] of Object.entries(monthActuals)) {
        if (chartVarieties.includes(vName)) row[vName] = Math.round(lbs);
      }
    } else {
      const groupMatch = grouped.find((g) => g.monthKey === monthKey);
      if (groupMatch) {
        for (const event of groupMatch.events) {
          if (chartVarieties.includes(event.varietyName)) {
            row[event.varietyName] =
              (Number(row[event.varietyName]) || 0) + Math.round(event.expectedPounds);
          }
        }
      }
    }

    chartData.push(row);
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Forecast</h1>

      <ForecastChart data={chartData} varieties={chartVarieties} />

      <div className="space-y-4">
        {grouped.map((group) => {
          const orderedLbs = getMonthlyOrderLbs(allOrders, group.monthKey);
          const totalOrderedLbs = Object.values(orderedLbs).reduce(
            (a, b) => a + b,
            0
          );
          const surplus = group.totalPounds - totalOrderedLbs;

          const byVariety: Record<
            number,
            {
              varietyName: string;
              bunches: number;
              pounds: number;
              orderedLbs: number;
              fields: string[];
            }
          > = {};
          for (const event of group.events) {
            if (!byVariety[event.varietyId]) {
              byVariety[event.varietyId] = {
                varietyName: event.varietyName,
                bunches: 0,
                pounds: 0,
                orderedLbs: orderedLbs[event.varietyId] ?? 0,
                fields: [],
              };
            }
            byVariety[event.varietyId].bunches += event.expectedBunches;
            byVariety[event.varietyId].pounds += event.expectedPounds;
            const fieldLabel = `${event.siteName} ${event.fieldName}`;
            if (!byVariety[event.varietyId].fields.includes(fieldLabel)) {
              byVariety[event.varietyId].fields.push(fieldLabel);
            }
          }

          return (
            <div
              key={group.monthKey}
              className="bg-white rounded-2xl border border-gray-200 overflow-hidden"
            >
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">{group.label}</h2>
                <div className="text-right text-sm">
                  <span className="text-gray-600">
                    {Math.round(group.totalPounds)} lbs est.
                  </span>
                  {totalOrderedLbs > 0 && (
                    <span
                      className={`ml-3 font-medium ${
                        surplus >= 0 ? "text-green-700" : "text-red-600"
                      }`}
                    >
                      {surplus >= 0 ? "+" : ""}
                      {Math.round(surplus)} surplus
                    </span>
                  )}
                </div>
              </div>

              <div className="divide-y divide-gray-100">
                {Object.values(byVariety).map((v) => {
                  const varietySurplus = v.pounds - v.orderedLbs;
                  return (
                    <div key={v.varietyName} className="px-4 py-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">
                            {v.varietyName}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {v.fields.join(", ")}
                          </p>
                        </div>
                        <div className="text-right text-sm">
                          <p className="text-gray-700">
                            {v.bunches} bunches ·{" "}
                            <span className="font-medium">
                              {Math.round(v.pounds)} lbs
                            </span>
                          </p>
                          {v.orderedLbs > 0 && (
                            <p className="text-xs text-gray-500">
                              {Math.round(v.orderedLbs)} lbs ordered ·{" "}
                              <span
                                className={
                                  varietySurplus >= 0
                                    ? "text-green-700"
                                    : "text-red-600"
                                }
                              >
                                {varietySurplus >= 0 ? "+" : ""}
                                {Math.round(varietySurplus)} unallocated
                              </span>
                            </p>
                          )}
                          {v.orderedLbs === 0 && (
                            <p className="text-xs text-gray-400">No orders</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex justify-between text-xs text-gray-500">
                <span>{group.events.length} harvest events</span>
                <span>
                  {totalOrderedLbs > 0
                    ? `${Math.round(totalOrderedLbs)} lbs committed`
                    : "No orders this month"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
