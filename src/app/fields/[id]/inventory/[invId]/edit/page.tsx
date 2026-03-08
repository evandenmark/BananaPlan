import { db } from "@/db";
import { fieldInventory, varieties } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { updateInventory } from "@/app/actions/fields";

export default async function EditInventoryPage({
  params,
}: {
  params: Promise<{ id: string; invId: string }>;
}) {
  const { id, invId } = await params;
  const fieldId = parseInt(id);
  const invIdNum = parseInt(invId);

  const inv = await db
    .select()
    .from(fieldInventory)
    .where(eq(fieldInventory.id, invIdNum))
    .then((r) => r[0]);

  if (!inv) notFound();

  const allVarieties = await db
    .select()
    .from(varieties)
    .orderBy(asc(varieties.name));

  const action = async (formData: FormData) => {
    "use server";
    await updateInventory(invIdNum, fieldId, formData);
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/fields/${fieldId}`} className="text-green-700 font-medium">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Edit Inventory</h1>
      </div>

      <form action={action} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Variety <span className="text-red-500">*</span>
          </label>
          <select
            name="varietyId"
            required
            defaultValue={inv.varietyId}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base bg-white"
          >
            {allVarieties.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Number of mats <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="numberOfMats"
            required
            min="1"
            defaultValue={inv.numberOfMats}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Planting date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="plantingDate"
            required
            defaultValue={inv.plantingDate}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <input
            type="text"
            name="notes"
            defaultValue={inv.notes ?? ""}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base bg-white"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-green-700 text-white py-3 rounded-xl font-semibold text-base active:scale-95 transition-transform"
        >
          Save Changes
        </button>
      </form>
    </div>
  );
}
