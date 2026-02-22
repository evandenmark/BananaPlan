"use server";

import { db } from "@/db";
import { clients, orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createClient(formData: FormData) {
  const result = await db
    .insert(clients)
    .values({ name: formData.get("name") as string })
    .returning({ id: clients.id });
  redirect(`/clients/${result[0].id}`);
}

export async function updateClient(id: number, formData: FormData) {
  await db
    .update(clients)
    .set({ name: formData.get("name") as string })
    .where(eq(clients.id, id));
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}`);
}

export async function deleteClient(id: number) {
  await db.delete(orders).where(eq(orders.clientId, id));
  await db.delete(clients).where(eq(clients.id, id));
  revalidatePath("/clients");
  redirect("/clients");
}
