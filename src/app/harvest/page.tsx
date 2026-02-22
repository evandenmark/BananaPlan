import { db } from "@/db";
import {
  fields,
  sites,
  fieldInventory,
  varieties,
  bunchHarvests,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { HarvestClient, type RecentHarvest } from "./harvest-form";

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

  const recentRows = await db
    .select({
      id: bunchHarvests.id,
      fieldId: bunchHarvests.fieldId,
      fieldName: fields.name,
      siteName: sites.name,
      varietyId: bunchHarvests.varietyId,
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

  const recent: RecentHarvest[] = recentRows.map((r) => ({
    id: r.id,
    fieldId: r.fieldId,
    fieldName: r.fieldName,
    siteName: r.siteName,
    varietyId: r.varietyId,
    varietyName: r.varietyName,
    bunches: r.bunches,
    harvestDate: r.harvestDate,
  }));

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Harvest</h1>
      <HarvestClient
        fields={allFields}
        fieldVarietyMap={fieldVarietyMap}
        recent={recent}
      />
    </div>
  );
}
