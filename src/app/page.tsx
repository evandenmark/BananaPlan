import { db } from "@/db";
import {
  fieldInventory,
  fields,
  sites,
  varieties,
  bunchHarvests,
  clients,
  orders,
} from "@/db/schema";
import { eq, desc, count } from "drizzle-orm";
import Link from "next/link";
import {
  computeForecast,
  type InventoryRow,
  type HarvestRecord,
} from "@/lib/forecast";

export default async function DashboardPage() {
  const [
    inventoryRows,
    harvestRows,
    recentHarvests,
    clientCount,
    activeOrderCount,
  ] = await Promise.all([
    db
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
      .where(eq(fields.isActive, true)),

    db
      .select({
        fieldId: bunchHarvests.fieldId,
        varietyId: bunchHarvests.varietyId,
        bunches: bunchHarvests.bunches,
        harvestDate: bunchHarvests.harvestDate,
      })
      .from(bunchHarvests),

    db
      .select({
        fieldName: fields.name,
        siteName: sites.name,
        varietyName: varieties.name,
        bunches: bunchHarvests.bunches,
        harvestDate: bunchHarvests.harvestDate,
      })
      .from(bunchHarvests)
      .innerJoin(fields, eq(bunchHarvests.fieldId, fields.id))
      .innerJoin(sites, eq(fields.siteId, sites.id))
      .innerJoin(varieties, eq(bunchHarvests.varietyId, varieties.id))
      .orderBy(desc(bunchHarvests.createdAt))
      .limit(5),

    db.select({ count: count() }).from(clients).then((r) => r[0].count),

    db
      .select({ count: count() })
      .from(orders)
      .where(eq(orders.isActive, true))
      .then((r) => r[0].count),
  ]);

  const forecast = computeForecast(
    inventoryRows as InventoryRow[],
    harvestRows as HarvestRecord[]
  );

  const now = new Date();
  const in60Days = new Date(now);
  in60Days.setDate(now.getDate() + 60);

  const upcoming = forecast.filter(
    (e) => e.expectedDate >= now && e.expectedDate <= in60Days
  );

  const upcomingBunches = upcoming.reduce((s, e) => s + e.expectedBunches, 0);
  const upcomingPounds = upcoming.reduce((s, e) => s + e.expectedPounds, 0);

  const upcomingByVariety: Record<
    string,
    { bunches: number; pounds: number }
  > = {};
  for (const e of upcoming) {
    if (!upcomingByVariety[e.varietyName]) {
      upcomingByVariety[e.varietyName] = { bunches: 0, pounds: 0 };
    }
    upcomingByVariety[e.varietyName].bunches += e.expectedBunches;
    upcomingByVariety[e.varietyName].pounds += e.expectedPounds;
  }

  return (
    <div className="p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">BananaPlan</h1>
        <p className="text-gray-500 text-sm mt-0.5">Farm overview</p>
      </div>

      <Link
        href="/harvest"
        className="block w-full bg-green-700 text-white text-center py-4 rounded-2xl font-bold text-lg mb-6"
      >
        Record Harvest
      </Link>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard
          label="Active orders"
          value={String(activeOrderCount)}
          sub="across all clients"
        />
        <StatCard label="Clients" value={String(clientCount)} sub="total" />
        <StatCard
          label="Next 60 days"
          value={`${upcomingBunches}`}
          sub={`bunches · ~${Math.round(upcomingPounds)} lbs`}
        />
        <StatCard
          label="Active plantings"
          value={String(inventoryRows.length)}
          sub="field inventory rows"
        />
      </div>

      {upcoming.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">
              Next 60 Days
            </h2>
            <Link
              href="/forecast"
              className="text-sm text-green-700 font-medium"
            >
              Full forecast
            </Link>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            {Object.entries(upcomingByVariety)
              .sort((a, b) => b[1].pounds - a[1].pounds)
              .map(([name, data]) => (
                <div
                  key={name}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <span className="font-medium text-gray-900 text-sm">
                    {name}
                  </span>
                  <span className="text-sm text-gray-600">
                    {data.bunches} bunches · {Math.round(data.pounds)} lbs
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {recentHarvests.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">
              Recent Harvests
            </h2>
            <Link
              href="/harvest"
              className="text-sm text-green-700 font-medium"
            >
              View all
            </Link>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            {recentHarvests.map((h, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {h.siteName} {h.fieldName} · {h.varietyName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(
                      h.harvestDate + "T00:00:00"
                    ).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <span className="text-sm text-gray-700">
                  {h.bunches} bunches
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {inventoryRows.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-base">No data yet.</p>
          <p className="text-sm mt-1">
            Start by adding{" "}
            <Link href="/varieties" className="text-green-700 underline">
              varieties
            </Link>{" "}
            and{" "}
            <Link href="/fields" className="text-green-700 underline">
              fields
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}
