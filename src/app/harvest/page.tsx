import { db } from "@/db";
import {
  fields,
  sites,
  fieldInventory,
  varieties,
  bunchHarvests,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { HarvestForm } from "./harvest-form";
import { deleteBunchHarvest } from "@/app/actions/harvest";

export default async function HarvestPage() {
  const allFields = await db
    .select({
      id: fields.id,
      name: fields.name,
      siteName: sites.name,
    })
    .from(fields)
    .innerJoin(sites, eq(fields.siteId, sites.id))
    .where(eq(fields.isActive, true))
    .orderBy(fields.name);

  const allInventory = await db
    .select({
      fieldId: fieldInventory.fieldId,
      varietyId: fieldInventory.varietyId,
      varietyName: varieties.name,
    })
    .from(fieldInventory)
    .innerJoin(varieties, eq(fieldInventory.varietyId, varieties.id));

  const recent = await db
    .select({
      id: bunchHarvests.id,
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
    .limit(15);

  const fieldVarietyMap: Record<number, { id: number; name: string }[]> = {};
  for (const inv of allInventory) {
    if (!fieldVarietyMap[inv.fieldId]) fieldVarietyMap[inv.fieldId] = [];
    if (!fieldVarietyMap[inv.fieldId].find((v) => v.id === inv.varietyId)) {
      fieldVarietyMap[inv.fieldId].push({
        id: inv.varietyId,
        name: inv.varietyName,
      });
    }
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">
        Record Harvest
      </h1>

      <HarvestForm fields={allFields} fieldVarietyMap={fieldVarietyMap} />

      {recent.length > 0 && (
        <div className="mt-8">
          <h2 className="text-base font-semibold text-gray-900 mb-3">
            Recent Harvests
          </h2>
          <div className="space-y-2">
            {recent.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {h.siteName} {h.fieldName} · {h.varietyName}
                  </p>
                  <p className="text-sm text-gray-500">
                    {h.bunches} bunches ·{" "}
                    {new Date(h.harvestDate + "T00:00:00").toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric", year: "numeric" }
                    )}
                  </p>
                </div>
                <form
                  action={async () => {
                    "use server";
                    await deleteBunchHarvest(h.id);
                  }}
                >
                  <button
                    type="submit"
                    className="text-sm text-red-600 font-medium px-2 py-1"
                  >
                    Delete
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
