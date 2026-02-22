"use server";

import { db } from "@/db";
import { bunchHarvests, weightHarvests } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function recordBunchHarvest(formData: FormData) {
  await db.insert(bunchHarvests).values({
    fieldId: parseInt(formData.get("fieldId") as string),
    varietyId: parseInt(formData.get("varietyId") as string),
    bunches: parseInt(formData.get("bunches") as string),
    harvestDate: formData.get("harvestDate") as string,
    notes: (formData.get("notes") as string) || null,
  });
  revalidatePath("/harvest");
  revalidatePath("/forecast");
  redirect("/harvest");
}

export async function deleteBunchHarvest(id: number) {
  await db.delete(bunchHarvests).where(eq(bunchHarvests.id, id));
  revalidatePath("/harvest");
  revalidatePath("/forecast");
}

export async function recordWeightHarvest(formData: FormData) {
  await db.insert(weightHarvests).values({
    varietyId: parseInt(formData.get("varietyId") as string),
    pounds: formData.get("pounds") as string,
    harvestDate: formData.get("harvestDate") as string,
    notes: (formData.get("notes") as string) || null,
  });
  revalidatePath("/weight-log");
  redirect("/weight-log");
}

export async function deleteWeightHarvest(id: number) {
  await db.delete(weightHarvests).where(eq(weightHarvests.id, id));
  revalidatePath("/weight-log");
}
