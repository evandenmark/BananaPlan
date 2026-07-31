"use server";

import { db } from "@/db";
import { varieties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidateFor } from "@/lib/revalidate";
import {
  describeReferences,
  referenceTotal,
  varietyReferences,
} from "@/lib/references";

export async function createVariety(formData: FormData) {
  await db.insert(varieties).values({
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || null,
    monthsToFirstBunch: formData.get("monthsToFirstBunch") as string,
    monthsToSubsequentBunch: formData.get("monthsToSubsequentBunch") as string,
    totalBunchesPerMat: parseInt(formData.get("totalBunchesPerMat") as string),
    bananasPerBunch: formData.get("bananasPerBunch")
      ? parseInt(formData.get("bananasPerBunch") as string)
      : null,
    poundsPerBunch: formData.get("poundsPerBunch") as string,
    successRate: formData.get("successRate") as string,
    notes: (formData.get("notes") as string) || null,
  });
  revalidateFor(["varieties"]);
  redirect("/varieties");
}

export async function updateVariety(id: number, formData: FormData) {
  await db
    .update(varieties)
    .set({
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || null,
      monthsToFirstBunch: formData.get("monthsToFirstBunch") as string,
      monthsToSubsequentBunch:
        formData.get("monthsToSubsequentBunch") as string,
      totalBunchesPerMat: parseInt(
        formData.get("totalBunchesPerMat") as string
      ),
      bananasPerBunch: formData.get("bananasPerBunch")
        ? parseInt(formData.get("bananasPerBunch") as string)
        : null,
      poundsPerBunch: formData.get("poundsPerBunch") as string,
      successRate: formData.get("successRate") as string,
      notes: (formData.get("notes") as string) || null,
      updatedAt: new Date(),
    })
    .where(eq(varieties.id, id));
  revalidateFor(["varieties"]);
  redirect("/varieties");
}

export type DeleteResult =
  | { deleted: true }
  | { deleted: false; reason: string };

/**
 * Delete a variety, unless something still references it.
 *
 * Plantings, orders and harvest records all carry a `variety_id` foreign key.
 * Deleting a referenced variety raises a constraint violation in Postgres, and
 * cascading instead would destroy harvest history — which the constitution
 * makes the source of truth about the past. So an in-use variety is refused,
 * and the caller is told what is in the way. See ADR 0012.
 */
export async function deleteVariety(id: number): Promise<DeleteResult> {
  const refs = await varietyReferences(id);
  if (referenceTotal(refs) > 0) {
    // The list page revalidates and re-renders showing the same counts, so the
    // operator sees why the row is still there.
    revalidateFor(["varieties"]);
    return { deleted: false, reason: describeReferences(refs) };
  }

  await db.delete(varieties).where(eq(varieties.id, id));
  revalidateFor(["varieties"]);
  return { deleted: true };
}
