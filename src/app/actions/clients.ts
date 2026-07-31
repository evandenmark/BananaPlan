"use server";

import { db } from "@/db";
import { clients, orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidateFor } from "@/lib/revalidate";

export async function createClient(formData: FormData) {
  const result = await db
    .insert(clients)
    .values({ name: formData.get("name") as string })
    .returning({ id: clients.id });
  revalidateFor(["clients"]);
  redirect(`/clients/${result[0].id}`);
}

export async function updateClient(id: number, formData: FormData) {
  await db
    .update(clients)
    .set({ name: formData.get("name") as string })
    .where(eq(clients.id, id));
  revalidateFor(["clients"], { "/clients/[id]": id });
  redirect(`/clients/${id}`);
}

/**
 * Delete a client and the orders that belong to it.
 *
 * This is the one delete in the app that cascades, and it is deliberate:
 * `orders.client_id` is `NOT NULL`, so an order cannot outlive its client, and
 * an order is a statement of future demand rather than a record of what was
 * harvested. Nothing about the past is lost. The two statements run in one
 * transaction so a failure between them cannot strand a client with its orders
 * already gone. See ADR 0012.
 *
 * `/clients/[id]` shows the operator how many orders go with the client before
 * they tap Delete.
 */
export async function deleteClient(id: number) {
  await db.transaction(async (tx) => {
    await tx.delete(orders).where(eq(orders.clientId, id));
    await tx.delete(clients).where(eq(clients.id, id));
  });
  revalidateFor(["clients", "orders"]);
  redirect("/clients");
}
