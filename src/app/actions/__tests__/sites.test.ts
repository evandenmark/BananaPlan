import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fields, sites } from "@/db/schema";
import { createSite, updateSite, deleteSite } from "../sites";

vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    select: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

// ── Chain mock helpers ────────────────────────────────────────────────────────

let mockInsertValues: ReturnType<typeof vi.fn>;
let mockUpdateSet: ReturnType<typeof vi.fn>;
let mockUpdateWhere: ReturnType<typeof vi.fn>;
let mockDeleteWhere: ReturnType<typeof vi.fn>;

/**
 * How many fields the site under test holds. `deleteSite` counts these before
 * deleting, so a test makes a site undeletable by raising this.
 */
let fieldCount: number;

const baseSiteFormData = () => {
  const fd = new FormData();
  fd.set("name", "Kemo'o");
  fd.set("description", "Upper terraces");
  return fd;
};

beforeEach(() => {
  vi.resetAllMocks();

  mockInsertValues = vi.fn().mockResolvedValue([]);
  vi.mocked(db.insert).mockReturnValue({ values: mockInsertValues } as any);

  mockUpdateWhere = vi.fn().mockResolvedValue([]);
  mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
  vi.mocked(db.update).mockReturnValue({ set: mockUpdateSet } as any);

  mockDeleteWhere = vi.fn().mockResolvedValue([]);
  vi.mocked(db.delete).mockReturnValue({ where: mockDeleteWhere } as any);

  fieldCount = 0;
  vi.mocked(db.select).mockReturnValue({
    from: (table: unknown) => ({
      where: () =>
        Promise.resolve([{ n: table === fields ? fieldCount : 0 }]),
    }),
  } as any);
});

// ── createSite ────────────────────────────────────────────────────────────────

describe("createSite", () => {
  it("inserts the site fields from FormData", async () => {
    await createSite(baseSiteFormData());

    expect(db.insert).toHaveBeenCalledWith(sites);
    expect(mockInsertValues).toHaveBeenCalledWith({
      name: "Kemo'o",
      description: "Upper terraces",
    });
  });

  it("stores null for an empty description", async () => {
    const fd = baseSiteFormData();
    fd.delete("description");

    await createSite(fd);

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ description: null })
    );
  });

  it("redirects to /sites after creation", async () => {
    await createSite(baseSiteFormData());
    expect(redirect).toHaveBeenCalledWith("/sites");
  });
});

// ── updateSite ────────────────────────────────────────────────────────────────

describe("updateSite", () => {
  it("updates the site for the correct id", async () => {
    await updateSite(2, baseSiteFormData());

    expect(db.update).toHaveBeenCalledWith(sites);
    expect(mockUpdateSet).toHaveBeenCalledWith({
      name: "Kemo'o",
      description: "Upper terraces",
    });
    expect(mockUpdateWhere).toHaveBeenCalled();
  });

  it("redirects to /sites after update", async () => {
    await updateSite(2, baseSiteFormData());
    expect(redirect).toHaveBeenCalledWith("/sites");
  });
});

// ── deleteSite ────────────────────────────────────────────────────────────────

describe("deleteSite", () => {
  it("deletes the site when it holds no fields", async () => {
    const result = await deleteSite(2);

    expect(db.delete).toHaveBeenCalledWith(sites);
    expect(mockDeleteWhere).toHaveBeenCalled();
    expect(result).toEqual({ deleted: true });
  });

  it("revalidates /sites", async () => {
    await deleteSite(2);
    expect(revalidatePath).toHaveBeenCalledWith("/sites");
  });

  it("does NOT redirect", async () => {
    await deleteSite(2);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("refuses to delete a site that still holds fields", async () => {
    fieldCount = 2;

    const result = await deleteSite(2);

    expect(db.delete).not.toHaveBeenCalled();
    expect(result).toEqual({ deleted: false, reason: "2 fields" });
  });

  it("uses the singular for a site holding one field", async () => {
    fieldCount = 1;

    expect(await deleteSite(2)).toEqual({
      deleted: false,
      reason: "1 field",
    });
  });

  it("still revalidates /sites when the delete is refused", async () => {
    fieldCount = 2;

    await deleteSite(2);

    expect(revalidatePath).toHaveBeenCalledWith("/sites");
  });
});
