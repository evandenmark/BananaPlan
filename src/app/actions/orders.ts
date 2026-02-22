"use server";

import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createOrder(clientId: number, formData: FormData) {
  await db.insert(orders).values({
    clientId,
    varietyId: parseInt(formData.get("varietyId") as string),
    poundsPerDelivery: formData.get("poundsPerDelivery") as string,
    frequency: formData.get("frequency") as "monthly" | "one_time",
    startDate: formData.get("startDate") as string,
    endDate: (formData.get("endDate") as string) || null,
    notes: (formData.get("notes") as string) || null,
  });
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

export async function updateOrder(
  id: number,
  clientId: number,
  formData: FormData
) {
  await db
    .update(orders)
    .set({
      varietyId: parseInt(formData.get("varietyId") as string),
      poundsPerDelivery: formData.get("poundsPerDelivery") as string,
      frequency: formData.get("frequency") as "monthly" | "one_time",
      startDate: formData.get("startDate") as string,
      endDate: (formData.get("endDate") as string) || null,
      notes: (formData.get("notes") as string) || null,
      isActive: formData.get("isActive") === "true",
      updatedAt: new Date(),
    })
    .where(eq(orders.id, id));
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

export async function deleteOrder(id: number, clientId: number) {
  await db.delete(orders).where(eq(orders.id, id));
  revalidatePath(`/clients/${clientId}`);
}
