import { db } from "@/db";
import { fields, sites, fieldInventory, varieties } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { deleteInventory } from "@/app/actions/fields";

export default async function FieldDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const fieldId = parseInt(id);

  const field = await db
    .select({
      id: fields.id,
      name: fields.name,
      siteId: fields.siteId,
      siteName: sites.name,
      sizeAcres: fields.sizeAcres,
      notes: fields.notes,
      isActive: fields.isActive,
    })
    .from(fields)
    .innerJoin(sites, eq(fields.siteId, sites.id))
    .where(eq(fields.id, fieldId))
    .then((r) => r[0]);

  if (!field) notFound();

  const inventory = await db
    .select({
      id: fieldInventory.id,
      varietyId: fieldInventory.varietyId,
      varietyName: varieties.name,
      numberOfMats: fieldInventory.numberOfMats,
      plantingDate: fieldInventory.plantingDate,
      monthsToFirstBunch: varieties.monthsToFirstBunch,
      poundsPerBunch: varieties.poundsPerBunch,
      successRate: varieties.successRate,
      notes: fieldInventory.notes,
    })
    .from(fieldInventory)
    .innerJoin(varieties, eq(fieldInventory.varietyId, varieties.id))
    .where(eq(fieldInventory.fieldId, fieldId))
    .orderBy(asc(fieldInventory.plantingDate));

  function expectedFirstHarvest(plantingDate: string, monthsToFirstBunch: string) {
    const date = new Date(plantingDate + "T00:00:00");
    const months = parseFloat(monthsToFirstBunch);
    date.setMonth(date.getMonth() + Math.floor(months));
    const frac = months - Math.floor(months);
    if (frac > 0) date.setDate(date.getDate() + Math.round(frac * 30.44));
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-1">
        <Link href="/fields" className="text-green-700 font-medium">
          ← Fields
        </Link>
      </div>

      <div className="flex items-start justify-between mt-2 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{field.name}</h1>
          <p className="text-gray-500 text-sm">
            {field.siteName}
            {field.sizeAcres ? ` · ${field.sizeAcres} acres` : ""}
            {!field.isActive ? " · inactive" : ""}
          </p>
          {field.notes && (
            <p className="text-gray-500 text-sm mt-1">{field.notes}</p>
          )}
        </div>
        <Link
          href={`/fields/${fieldId}/edit`}
          className="text-sm text-green-700 font-medium px-2 py-1"
        >
          Edit
        </Link>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-900">Inventory</h2>
        <Link
          href={`/fields/${fieldId}/inventory/new`}
          className="bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
        >
          + Plant
        </Link>
      </div>

      {inventory.length === 0 ? (
        <p className="text-gray-500 text-sm py-4">
          No inventory yet. Plant a variety to get started.
        </p>
      ) : (
        <div className="space-y-2">
          {inventory.map((inv) => {
            const surviving = Math.floor(
              inv.numberOfMats * parseFloat(inv.successRate)
            );
            return (
              <div
                key={inv.id}
                className="bg-white rounded-xl border border-gray-200 p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      {inv.varietyName}
                    </p>
                    <div className="mt-1 text-sm text-gray-600 space-y-0.5">
                      <p>
                        {inv.numberOfMats} mats planted ·{" "}
                        <span className="text-gray-500">
                          {surviving} expected to fruit
                        </span>
                      </p>
                      <p>
                        Planted:{" "}
                        {new Date(inv.plantingDate + "T00:00:00").toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric", year: "numeric" }
                        )}
                      </p>
                      <p>
                        First harvest est.:{" "}
                        <strong>
                          {expectedFirstHarvest(
                            inv.plantingDate,
                            inv.monthsToFirstBunch
                          )}
                        </strong>
                      </p>
                    </div>
                    {inv.notes && (
                      <p className="text-sm text-gray-400 mt-1">{inv.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-2 ml-3 shrink-0">
                    <Link
                      href={`/fields/${fieldId}/inventory/${inv.id}/edit`}
                      className="text-sm text-green-700 font-medium px-2 py-1"
                    >
                      Edit
                    </Link>
                    <form
                      action={async () => {
                        "use server";
                        await deleteInventory(inv.id, fieldId);
                      }}
                    >
                      <button
                        type="submit"
                        className="text-sm text-red-600 font-medium px-2 py-1"
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
