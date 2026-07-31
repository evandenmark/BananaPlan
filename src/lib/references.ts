import { db } from "@/db";
import {
  bunchHarvests,
  fieldInventory,
  fields,
  orders,
  weightHarvests,
} from "@/db/schema";
import { count, eq } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";

/**
 * What still points at a row, so a delete can be refused before Postgres
 * refuses it.
 *
 * Every foreign key in this schema is plain `references()` — no
 * `ON DELETE CASCADE`, no `ON DELETE SET NULL` — so deleting a referenced row
 * raises a constraint violation, and an unguarded Server Action turns that into
 * the generic "Something went wrong" boundary. Actions that delete a row other
 * rows can point at ask here first.
 *
 * See ADR 0012 for the policy and why cascading is not the default.
 */

/** One kind of row pointing at the record, with the nouns to describe it. */
export interface Reference {
  count: number;
  /** Noun for a single row, e.g. `"planting"`. */
  one: string;
  /** Noun for several, e.g. `"plantings"`. */
  many: string;
}

/** A referencing table and the column that holds the foreign key. */
interface ReferenceSpec {
  table: PgTable;
  column: AnyPgColumn;
  one: string;
  many: string;
}

/**
 * Which tables point at which parent.
 *
 * This mirrors the foreign keys in `src/db/schema.ts`. **When you add a foreign
 * key, add it here** — a missing row means the guard passes and the operator
 * gets the raw constraint violation again.
 */
const VARIETY_REFERENCES: ReferenceSpec[] = [
  {
    table: fieldInventory,
    column: fieldInventory.varietyId,
    one: "planting",
    many: "plantings",
  },
  { table: orders, column: orders.varietyId, one: "order", many: "orders" },
  {
    table: bunchHarvests,
    column: bunchHarvests.varietyId,
    one: "bunch harvest",
    many: "bunch harvests",
  },
  {
    table: weightHarvests,
    column: weightHarvests.varietyId,
    one: "weight record",
    many: "weight records",
  },
];

const SITE_REFERENCES: ReferenceSpec[] = [
  { table: fields, column: fields.siteId, one: "field", many: "fields" },
];

// There is deliberately no FIELD_REFERENCES: a field is retired by clearing
// `fields.is_active`, and no action deletes one. `field_inventory.field_id` and
// `bunch_harvests.field_id` are the two foreign keys in the schema without a
// guard here — if a `deleteField` is ever added, it needs one.

const CLIENT_REFERENCES: ReferenceSpec[] = [
  { table: orders, column: orders.clientId, one: "order", many: "orders" },
];

// ── Reading the counts ────────────────────────────────────────────────────────

async function countReferences(
  specs: ReferenceSpec[],
  id: number
): Promise<Reference[]> {
  const results = await Promise.all(
    specs.map((spec) =>
      db.select({ n: count() }).from(spec.table).where(eq(spec.column, id))
    )
  );

  return specs.map((spec, i) => ({
    count: Number(results[i][0]?.n ?? 0),
    one: spec.one,
    many: spec.many,
  }));
}

async function countReferencesById(
  specs: ReferenceSpec[]
): Promise<Map<number, Reference[]>> {
  const results = await Promise.all(
    specs.map((spec) =>
      db
        .select({ ownerId: spec.column, n: count() })
        .from(spec.table)
        .groupBy(spec.column)
    )
  );

  const byId = new Map<number, Reference[]>();
  results.forEach((rows, i) => {
    for (const row of rows) {
      const ownerId = Number(row.ownerId);
      const refs =
        byId.get(ownerId) ??
        specs.map((s) => ({ count: 0, one: s.one, many: s.many }));
      refs[i] = { count: Number(row.n), one: specs[i].one, many: specs[i].many };
      byId.set(ownerId, refs);
    }
  });

  return byId;
}

// ── Describing them ───────────────────────────────────────────────────────────

/** Total rows pointing at the record. Zero means it is safe to delete. */
export function referenceTotal(refs: Reference[]): number {
  return refs.reduce((sum, ref) => sum + ref.count, 0);
}

/**
 * A phrase naming what is in the way, e.g. `"5 plantings and 2 bunch
 * harvests"`. Empty string when nothing points at the record.
 */
export function describeReferences(refs: Reference[]): string {
  const parts = refs
    .filter((ref) => ref.count > 0)
    .map((ref) => `${ref.count} ${ref.count === 1 ? ref.one : ref.many}`);

  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

// ── Per-entity entry points ───────────────────────────────────────────────────

export const varietyReferences = (id: number) =>
  countReferences(VARIETY_REFERENCES, id);

/**
 * References for every variety that has any, keyed by id. A variety nothing
 * points at is absent from the map — read it with `map.get(id) ?? []`, which
 * `referenceTotal` scores as zero.
 */
export const varietyReferencesById = () =>
  countReferencesById(VARIETY_REFERENCES);

export const siteReferences = (id: number) =>
  countReferences(SITE_REFERENCES, id);

export const siteReferencesById = () => countReferencesById(SITE_REFERENCES);

export const clientReferences = (id: number) =>
  countReferences(CLIENT_REFERENCES, id);

export const clientReferencesById = () =>
  countReferencesById(CLIENT_REFERENCES);
