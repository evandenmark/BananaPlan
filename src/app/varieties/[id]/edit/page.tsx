import { db } from "@/db";
import { varieties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { VarietyFields } from "@/app/varieties/new/page";
import { updateVariety } from "@/app/actions/varieties";

export default async function EditVarietyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const variety = await db
    .select()
    .from(varieties)
    .where(eq(varieties.id, parseInt(id)))
    .then((r) => r[0]);

  if (!variety) notFound();

  const action = async (formData: FormData) => {
    "use server";
    await updateVariety(variety.id, formData);
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/varieties" className="text-green-700 font-medium">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Edit Variety</h1>
      </div>

      <form action={action} className="space-y-4">
        <VarietyFields
          defaults={{
            name: variety.name,
            description: variety.description ?? "",
            monthsToFirstBunch: variety.monthsToFirstBunch,
            monthsToSubsequentBunch: variety.monthsToSubsequentBunch,
            totalBunchesPerMat: variety.totalBunchesPerMat,
            bananasPerBunch: variety.bananasPerBunch,
            poundsPerBunch: variety.poundsPerBunch,
            successRate: variety.successRate,
            notes: variety.notes ?? "",
          }}
        />
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
