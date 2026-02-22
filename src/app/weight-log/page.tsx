import { db } from "@/db";
import { varieties, weightHarvests } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import Link from "next/link";
import { recordWeightHarvest, deleteWeightHarvest } from "@/app/actions/harvest";

export default async function WeightLogPage() {
  const allVarieties = await db
    .select()
    .from(varieties)
    .orderBy(asc(varieties.name));

  const recent = await db
    .select({
      id: weightHarvests.id,
      varietyName: varieties.name,
      pounds: weightHarvests.pounds,
      harvestDate: weightHarvests.harvestDate,
      notes: weightHarvests.notes,
    })
    .from(weightHarvests)
    .innerJoin(varieties, eq(weightHarvests.varietyId, varieties.id))
    .orderBy(desc(weightHarvests.harvestDate))
    .limit(30);

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Weight Log</h1>

      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Record Weight
        </h2>
        <form action={recordWeightHarvest} className="space-y-4">
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pounds <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="pounds"
                required
                step="0.1"
                min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="harvestDate"
                required
                defaultValue={today}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base bg-white"
              />
            </div>
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
            Save
          </button>
        </form>
      </div>

      {recent.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">
            Recent Records
          </h2>
          <div className="space-y-2">
            {recent.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {w.varietyName}
                  </p>
                  <p className="text-sm text-gray-500">
                    {w.pounds} lbs ·{" "}
                    {new Date(w.harvestDate + "T00:00:00").toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric", year: "numeric" }
                    )}
                    {w.notes ? ` · ${w.notes}` : ""}
                  </p>
                </div>
                <form
                  action={async () => {
                    "use server";
                    await deleteWeightHarvest(w.id);
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
