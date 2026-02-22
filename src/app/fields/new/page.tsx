import { db } from "@/db";
import { sites } from "@/db/schema";
import { asc } from "drizzle-orm";
import Link from "next/link";
import { createField } from "@/app/actions/fields";

export default async function NewFieldPage() {
  const allSites = await db.select().from(sites).orderBy(asc(sites.name));

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/fields" className="text-green-700 font-medium">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">New Field</h1>
      </div>

      <form action={createField} className="space-y-4">
        <div>
          <label className="block text-base font-medium text-gray-700 mb-1">
            Site <span className="text-red-500">*</span>
          </label>
          <select
            name="siteId"
            required
            className="w-full border border-gray-300 rounded-xl px-4 py-4 text-lg bg-white"
          >
            <option value="">Select site...</option>
            {allSites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-base font-medium text-gray-700 mb-1">
            Field name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            required
            placeholder="e.g. K1, B3"
            className="w-full border border-gray-300 rounded-xl px-4 py-4 text-lg bg-white"
          />
        </div>

        <div>
          <label className="block text-base font-medium text-gray-700 mb-1">
            Size (acres)
          </label>
          <input
            type="number"
            name="sizeAcres"
            step="0.1"
            min="0"
            className="w-full border border-gray-300 rounded-xl px-4 py-4 text-lg bg-white"
          />
        </div>

        <div>
          <label className="block text-base font-medium text-gray-700 mb-1">
            Notes
          </label>
          <input
            type="text"
            name="notes"
            className="w-full border border-gray-300 rounded-xl px-4 py-4 text-lg bg-white"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-green-700 text-white py-5 rounded-xl font-semibold text-xl"
        >
          Create Field
        </button>
      </form>
    </div>
  );
}
