"use server";

import { db } from "@/db";
import { varieties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
  redirect("/varieties");
}

export async function deleteVariety(id: number) {
  await db.delete(varieties).where(eq(varieties.id, id));
  revalidatePath("/varieties");
}
