import { describe, it, expect, beforeEach, vi } from "vitest";
import { Column, Param } from "drizzle-orm";
import { db } from "@/db";
import {
  bunchHarvests,
  fieldInventory,
  fields,
  orders,
  weightHarvests,
} from "@/db/schema";
import {
  clientReferences,
  describeReferences,
  referenceTotal,
  siteReferences,
  siteReferencesById,
  varietyReferences,
  varietyReferencesById,
  type Reference,
} from "../references";

vi.mock("@/db", () => ({ db: { select: vi.fn() } }));

/**
 * Rows in the database, keyed by the **foreign-key column** they hang off —
 * `rowsByColumn.get(orders.varietyId)` is every order, grouped by variety.
 *
 * Keying on the column rather than the table is the point. A spec that names
 * the wrong column (`orders.clientId` in the variety list, say) then reads an
 * empty table, the reference count comes back zero, and the assertions below
 * fail — which is the mistake `references.ts` invites when a new foreign key is
 * added, and the one thing a table-keyed fake cannot see.
 */
let rowsByColumn: Map<unknown, { ownerId: number; n: number }[]>;

const ref = (count: number, one: string, many: string): Reference => ({
  count,
  one,
  many,
});

/** The column drizzle actually filtered or grouped on. */
const columnOf = (arg: unknown): any => {
  if (arg instanceof Column) return arg;
  const chunks: unknown[] = (arg as any)?.queryChunks ?? [];
  return chunks.find((c) => c instanceof Column);
};

/** The id bound into `eq(column, id)`. */
const paramOf = (arg: unknown): unknown => {
  const chunks: unknown[] = (arg as any)?.queryChunks ?? [];
  return (chunks.find((c) => c instanceof Param) as any)?.value;
};

beforeEach(() => {
  vi.resetAllMocks();
  rowsByColumn = new Map([
    [fieldInventory.varietyId, []],
    [orders.varietyId, []],
    [bunchHarvests.varietyId, []],
    [weightHarvests.varietyId, []],
    [fields.siteId, []],
    [orders.clientId, []],
  ]);

  // The module builds `db.select(...).from(table)` and then either `.where`
  // (one owner) or `.groupBy` (every owner), so the fake answers to both — and
  // resolves each against the column the query names, not the table.
  vi.mocked(db.select).mockReturnValue({
    from: (table: unknown) => {
      const rowsFor = (arg: unknown) => {
        const column = columnOf(arg);
        if (!column) throw new Error("query referenced no column");
        // A spec pairing a column with someone else's table builds invalid SQL;
        // Postgres would reject it, so the fake does too.
        if (column.table !== table) {
          throw new Error(
            `column ${column.name} does not belong to the table being queried`
          );
        }
        return rowsByColumn.get(column) ?? [];
      };

      return {
        groupBy: (column: unknown) => Promise.resolve(rowsFor(column)),
        where: (expr: unknown) => {
          const ownerId = paramOf(expr);
          const n = rowsFor(expr)
            .filter((r) => r.ownerId === ownerId)
            .reduce((sum, r) => sum + r.n, 0);
          return Promise.resolve([{ n }]);
        },
      };
    },
  } as any);
});

describe("referenceTotal", () => {
  it("is zero for a record nothing points at", () => {
    expect(referenceTotal([])).toBe(0);
    expect(referenceTotal([ref(0, "order", "orders")])).toBe(0);
  });

  it("sums every kind of reference", () => {
    expect(
      referenceTotal([
        ref(5, "planting", "plantings"),
        ref(2, "bunch harvest", "bunch harvests"),
        ref(1, "weight record", "weight records"),
      ])
    ).toBe(8);
  });
});

describe("describeReferences", () => {
  it("is empty when nothing points at the record", () => {
    expect(describeReferences([])).toBe("");
    expect(describeReferences([ref(0, "field", "fields")])).toBe("");
  });

  it("uses the singular for a count of one", () => {
    expect(describeReferences([ref(1, "planting", "plantings")])).toBe(
      "1 planting"
    );
  });

  it("uses the plural for larger counts", () => {
    expect(describeReferences([ref(4, "planting", "plantings")])).toBe(
      "4 plantings"
    );
  });

  it("joins two kinds with 'and'", () => {
    expect(
      describeReferences([
        ref(2, "planting", "plantings"),
        ref(1, "weight record", "weight records"),
      ])
    ).toBe("2 plantings and 1 weight record");
  });

  it("joins three or more with commas and a final 'and'", () => {
    expect(
      describeReferences([
        ref(5, "planting", "plantings"),
        ref(3, "order", "orders"),
        ref(2, "bunch harvest", "bunch harvests"),
        ref(1, "weight record", "weight records"),
      ])
    ).toBe("5 plantings, 3 orders, 2 bunch harvests and 1 weight record");
  });

  it("omits the kinds that are zero", () => {
    expect(
      describeReferences([
        ref(0, "planting", "plantings"),
        ref(2, "order", "orders"),
        ref(0, "bunch harvest", "bunch harvests"),
        ref(1, "weight record", "weight records"),
      ])
    ).toBe("2 orders and 1 weight record");
  });
});

describe("varietyReferences", () => {
  it("reports zero for a variety nothing points at", async () => {
    expect(referenceTotal(await varietyReferences(1))).toBe(0);
  });

  it("counts each referencing table separately", async () => {
    rowsByColumn.set(fieldInventory.varietyId, [{ ownerId: 1, n: 5 }]);
    rowsByColumn.set(bunchHarvests.varietyId, [{ ownerId: 1, n: 2 }]);

    expect(describeReferences(await varietyReferences(1))).toBe(
      "5 plantings and 2 bunch harvests"
    );
  });

  it("covers all four tables that reference a variety", async () => {
    rowsByColumn.set(fieldInventory.varietyId, [{ ownerId: 1, n: 1 }]);
    rowsByColumn.set(orders.varietyId, [{ ownerId: 1, n: 1 }]);
    rowsByColumn.set(bunchHarvests.varietyId, [{ ownerId: 1, n: 1 }]);
    rowsByColumn.set(weightHarvests.varietyId, [{ ownerId: 1, n: 1 }]);

    const refs = await varietyReferences(1);

    expect(refs).toHaveLength(4);
    expect(referenceTotal(refs)).toBe(4);
    expect(describeReferences(refs)).toBe(
      "1 planting, 1 order, 1 bunch harvest and 1 weight record"
    );
  });

  it("coerces counts that arrive as strings", async () => {
    rowsByColumn.set(orders.varietyId, [
      { ownerId: 1, n: "3" as unknown as number },
    ]);

    expect(referenceTotal(await varietyReferences(1))).toBe(3);
  });

  it("counts only the variety asked for", async () => {
    rowsByColumn.set(fieldInventory.varietyId, [{ ownerId: 1, n: 5 }]);

    expect(referenceTotal(await varietyReferences(1))).toBe(5);
    expect(referenceTotal(await varietyReferences(2))).toBe(0);
  });

  it("counts orders by variety, not by client", async () => {
    // orders carries both foreign keys; the variety list must read variety_id.
    rowsByColumn.set(orders.clientId, [{ ownerId: 1, n: 4 }]);

    expect(referenceTotal(await varietyReferences(1))).toBe(0);
  });
});

describe("varietyReferencesById", () => {
  it("is empty when no variety is referenced", async () => {
    expect((await varietyReferencesById()).size).toBe(0);
  });

  it("merges counts from every table into one entry per variety", async () => {
    rowsByColumn.set(fieldInventory.varietyId, [
      { ownerId: 1, n: 5 },
      { ownerId: 2, n: 2 },
    ]);
    rowsByColumn.set(bunchHarvests.varietyId, [{ ownerId: 1, n: 2 }]);
    rowsByColumn.set(weightHarvests.varietyId, [{ ownerId: 1, n: 1 }]);

    const byId = await varietyReferencesById();

    expect(describeReferences(byId.get(1)!)).toBe(
      "5 plantings, 2 bunch harvests and 1 weight record"
    );
    expect(describeReferences(byId.get(2)!)).toBe("2 plantings");
  });

  it("omits varieties nothing references", async () => {
    rowsByColumn.set(fieldInventory.varietyId, [{ ownerId: 1, n: 1 }]);

    const byId = await varietyReferencesById();

    expect(byId.has(1)).toBe(true);
    expect(byId.get(99)).toBeUndefined();
    // The pages read a missing entry as an empty list, which scores as zero.
    expect(referenceTotal(byId.get(99) ?? [])).toBe(0);
  });
});

describe("siteReferences", () => {
  it("reports zero for a site with no fields", async () => {
    expect(referenceTotal(await siteReferences(1))).toBe(0);
  });

  it("counts the site's fields", async () => {
    rowsByColumn.set(fields.siteId, [{ ownerId: 1, n: 2 }]);

    expect(describeReferences(await siteReferences(1))).toBe("2 fields");
  });

  it("uses the singular for a single field", async () => {
    rowsByColumn.set(fields.siteId, [{ ownerId: 1, n: 1 }]);

    expect(describeReferences(await siteReferences(1))).toBe("1 field");
  });
});

describe("siteReferencesById", () => {
  it("returns one entry per site that has fields", async () => {
    rowsByColumn.set(fields.siteId, [
      { ownerId: 1, n: 2 },
      { ownerId: 2, n: 2 },
    ]);

    const byId = await siteReferencesById();

    expect(byId.size).toBe(2);
    expect(describeReferences(byId.get(1)!)).toBe("2 fields");
  });
});

describe("clientReferences", () => {
  it("counts the client's orders", async () => {
    rowsByColumn.set(orders.clientId, [{ ownerId: 1, n: 3 }]);

    expect(describeReferences(await clientReferences(1))).toBe("3 orders");
  });
});
