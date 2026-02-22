import { db } from "@/db";
import { varieties, fields } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { addInventory } from "@/app/actions/fields";

export default async function NewInventoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const fieldId = parseInt(id);

  const field = await db
    .select()
    .from(fields)
    .where(eq(fields.id, fieldId))
    .then((r) => r[0]);

  if (!field) notFound();

  const allVarieties = await db
    .select()
    .from(varieties)
    .orderBy(asc(varieties.name));

  const action = async (formData: FormData) => {
    "use server";
    await addInventory(fieldId, formData);
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/fields/${fieldId}`} className="text-green-700 font-medium">
          ← {field.name}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Plant Variety</h1>
      </div>

      <form action={action} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Variety <span className="text-red-500">*</span>
          </label>
          <select
            name="varietyId"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base bg-white"
          >
            <option value="">Select variety...</option>
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
            defaultValue={today}
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
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base bg-white"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-green-700 text-white py-3 rounded-xl font-semibold text-base"
        >
          Add to Field
        </button>
      </form>
    </div>
  );
}
