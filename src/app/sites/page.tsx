import { db } from "@/db";
import { sites } from "@/db/schema";
import { asc } from "drizzle-orm";
import Link from "next/link";
import { deleteSite } from "@/app/actions/sites";

export default async function SitesPage() {
  const rows = await db.select().from(sites).orderBy(asc(sites.name));

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Sites</h1>
        <Link
          href="/sites/new"
          className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium active:scale-95 transition-transform"
        >
          + Add
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-500 text-center py-12">
          No sites yet. Add one to get started.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{s.name}</p>
                  {s.description && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      {s.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 ml-3 shrink-0">
                  <Link
                    href={`/sites/${s.id}/edit`}
                    className="text-sm text-green-700 font-medium px-2 py-1 active:opacity-60 transition-opacity"
                  >
                    Edit
                  </Link>
                  <form
                    action={async () => {
                      "use server";
                      await deleteSite(s.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="text-sm text-red-600 font-medium px-2 py-1 active:opacity-60 transition-opacity"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
