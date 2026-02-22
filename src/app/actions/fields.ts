"use server";

import { db } from "@/db";
import { fields, fieldInventory } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createField(formData: FormData) {
  const result = await db
    .insert(fields)
    .values({
      siteId: parseInt(formData.get("siteId") as string),
      name: formData.get("name") as string,
      sizeAcres: (formData.get("sizeAcres") as string) || null,
      notes: (formData.get("notes") as string) || null,
    })
    .returning({ id: fields.id });

  redirect(`/fields/${result[0].id}`);
}

export async function updateField(id: number, formData: FormData) {
  await db
    .update(fields)
    .set({
      name: formData.get("name") as string,
      sizeAcres: (formData.get("sizeAcres") as string) || null,
      notes: (formData.get("notes") as string) || null,
      isActive: formData.get("isActive") === "true",
      updatedAt: new Date(),
    })
    .where(eq(fields.id, id));
  redirect(`/fields/${id}`);
}

export async function addInventory(fieldId: number, formData: FormData) {
  await db.insert(fieldInventory).values({
    fieldId,
    varietyId: parseInt(formData.get("varietyId") as string),
    numberOfMats: parseInt(formData.get("numberOfMats") as string),
    plantingDate: formData.get("plantingDate") as string,
    notes: (formData.get("notes") as string) || null,
  });
  revalidatePath(`/fields/${fieldId}`);
  redirect(`/fields/${fieldId}`);
}

export async function updateInventory(
  id: number,
  fieldId: number,
  formData: FormData
) {
  await db
    .update(fieldInventory)
    .set({
      varietyId: parseInt(formData.get("varietyId") as string),
      numberOfMats: parseInt(formData.get("numberOfMats") as string),
      plantingDate: formData.get("plantingDate") as string,
      notes: (formData.get("notes") as string) || null,
      updatedAt: new Date(),
    })
    .where(eq(fieldInventory.id, id));
  redirect(`/fields/${fieldId}`);
}

export async function deleteInventory(id: number, fieldId: number) {
  await db.delete(fieldInventory).where(eq(fieldInventory.id, id));
  revalidatePath(`/fields/${fieldId}`);
}
