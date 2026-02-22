import { db } from "@/db";
import { varieties } from "@/db/schema";
import { asc } from "drizzle-orm";
import Link from "next/link";
import { deleteVariety } from "@/app/actions/varieties";

export default async function VarietiesPage() {
  const rows = await db
    .select()
    .from(varieties)
    .orderBy(asc(varieties.name));

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Varieties</h1>
        <Link
          href="/varieties/new"
          className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Add
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-500 text-center py-12">
          No varieties yet. Add one to get started.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((v) => (
            <div
              key={v.id}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{v.name}</p>
                  {v.description && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      {v.description}
                    </p>
                  )}
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600">
                    <span>
                      First bunch:{" "}
                      <strong>{v.monthsToFirstBunch} mo</strong>
                    </span>
                    <span>
                      Subsequent:{" "}
                      <strong>{v.monthsToSubsequentBunch} mo</strong>
                    </span>
                    <span>
                      Bunches/mat: <strong>{v.totalBunchesPerMat}</strong>
                    </span>
                    <span>
                      Lbs/bunch: <strong>{v.poundsPerBunch}</strong>
                    </span>
                    <span>
                      Success rate:{" "}
                      <strong>
                        {Math.round(parseFloat(v.successRate) * 100)}%
                      </strong>
                    </span>
                    {v.bananasPerBunch && (
                      <span>
                        Bananas/bunch: <strong>{v.bananasPerBunch}</strong>
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 ml-3 shrink-0">
                  <Link
                    href={`/varieties/${v.id}/edit`}
                    className="text-sm text-green-700 font-medium px-2 py-1"
                  >
                    Edit
                  </Link>
                  <form
                    action={async () => {
                      "use server";
                      await deleteVariety(v.id);
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
