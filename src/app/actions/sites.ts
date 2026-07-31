"use server";

import { db } from "@/db";
import { sites } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidateFor } from "@/lib/revalidate";
import {
  describeReferences,
  referenceTotal,
  siteReferences,
} from "@/lib/references";
import type { DeleteResult } from "./varieties";

export async function createSite(formData: FormData) {
  await db.insert(sites).values({
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || null,
  });
  revalidateFor(["sites"]);
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
  revalidateFor(["sites"]);
  redirect("/sites");
}

/**
 * Delete a site, unless it still has fields.
 *
 * `fields.site_id` references `sites.id`, so deleting a site that has fields
 * raises a constraint violation. Cascading is not an option: a field's
 * plantings and bunch harvests hang off it, and those are harvest history.
 * Same policy as `deleteVariety` — see ADR 0012.
 */
export async function deleteSite(id: number): Promise<DeleteResult> {
  const refs = await siteReferences(id);
  if (referenceTotal(refs) > 0) {
    revalidateFor(["sites"]);
    return { deleted: false, reason: describeReferences(refs) };
  }

  await db.delete(sites).where(eq(sites.id, id));
  revalidateFor(["sites"]);
  return { deleted: true };
}
