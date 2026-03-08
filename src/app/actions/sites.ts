"use server";

import { db } from "@/db";
import { sites } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createSite(formData: FormData) {
  await db.insert(sites).values({
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || null,
  });
  redirect("/sites");
}

export async function updateSite(id: number, formData: FormData) {
  await db
    .update(sites)
    .set({
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || null,
    })
    .where(eq(sites.id, id));
  redirect("/sites");
}

export async function deleteSite(id: number) {
  await db.delete(sites).where(eq(sites.id, id));
  revalidatePath("/sites");
}
