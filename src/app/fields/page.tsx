import { db } from "@/db";
import { fields, sites, fieldInventory, varieties } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import Link from "next/link";

export default async function FieldsPage() {
  const allSites = await db.select().from(sites).orderBy(asc(sites.name));

  const allFields = await db
    .select({
      id: fields.id,
      name: fields.name,
      siteId: fields.siteId,
      sizeAcres: fields.sizeAcres,
      isActive: fields.isActive,
    })
    .from(fields)
    .orderBy(asc(fields.name));

  const allInventory = await db
    .select({
      fieldId: fieldInventory.fieldId,
      varietyName: varieties.name,
      numberOfMats: fieldInventory.numberOfMats,
    })
    .from(fieldInventory)
    .innerJoin(varieties, eq(fieldInventory.varietyId, varieties.id));

  const inventoryByField: Record<
    number,
    { varietyName: string; numberOfMats: number }[]
  > = {};
  for (const inv of allInventory) {
    if (!inventoryByField[inv.fieldId]) inventoryByField[inv.fieldId] = [];
    inventoryByField[inv.fieldId].push({
      varietyName: inv.varietyName,
      numberOfMats: inv.numberOfMats,
    });
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Fields</h1>
        <Link
          href="/fields/new"
          className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Add Field
        </Link>
      </div>

      {allSites.map((site) => {
        const siteFields = allFields.filter((f) => f.siteId === site.id);
        if (siteFields.length === 0) return null;
        return (
          <div key={site.id} className="mb-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              {site.name}
            </h2>
            <div className="space-y-2">
              {siteFields.map((field) => {
                const inv = inventoryByField[field.id] ?? [];
                const totalMats = inv.reduce(
                  (sum, i) => sum + i.numberOfMats,
                  0
                );
                return (
                  <Link
                    key={field.id}
                    href={`/fields/${field.id}`}
                    className={`block bg-white rounded-xl border border-gray-200 p-4 ${
                      !field.isActive ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-gray-900">
                          {field.name}
                        </span>
                        {field.sizeAcres && (
                          <span className="text-sm text-gray-500 ml-2">
                            {field.sizeAcres} ac
                          </span>
                        )}
                        {!field.isActive && (
                          <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                            inactive
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">
                        {totalMats} mats
                      </span>
                    </div>
                    {inv.length > 0 && (
                      <p className="text-sm text-gray-500 mt-1">
                        {inv.map((i) => i.varietyName).join(", ")}
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}

      {allFields.length === 0 && (
        <p className="text-gray-500 text-center py-12">
          No fields yet. Add one to get started.
        </p>
      )}
    </div>
  );
}
