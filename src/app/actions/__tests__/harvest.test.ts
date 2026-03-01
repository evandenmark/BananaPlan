import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { bunchHarvests, weightHarvests } from "@/db/schema";
import {
  recordBunchHarvest,
  recordBunchHarvestBatch,
  updateBunchHarvest,
  deleteBunchHarvest,
  recordWeightHarvest,
  deleteWeightHarvest,
} from "../harvest";

vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

// ── Chain mock helpers ────────────────────────────────────────────────────────

let mockInsertValues: ReturnType<typeof vi.fn>;
let mockUpdateSet: ReturnType<typeof vi.fn>;
let mockUpdateWhere: ReturnType<typeof vi.fn>;
let mockDeleteWhere: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();

  mockInsertValues = vi.fn().mockResolvedValue([]);
  vi.mocked(db.insert).mockReturnValue({ values: mockInsertValues } as any);

  mockUpdateWhere = vi.fn().mockResolvedValue([]);
  mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
  vi.mocked(db.update).mockReturnValue({ set: mockUpdateSet } as any);

  mockDeleteWhere = vi.fn().mockResolvedValue([]);
  vi.mocked(db.delete).mockReturnValue({ where: mockDeleteWhere } as any);
});

// ── recordBunchHarvest ────────────────────────────────────────────────────────

describe("recordBunchHarvest", () => {
  it("inserts a single bunch harvest from FormData", async () => {
    const fd = new FormData();
    fd.set("fieldId", "1");
    fd.set("varietyId", "2");
    fd.set("bunches", "15");
    fd.set("harvestDate", "2026-02-24");
    fd.set("notes", "Good day");

    await recordBunchHarvest(fd);

    expect(db.insert).toHaveBeenCalledWith(bunchHarvests);
    expect(mockInsertValues).toHaveBeenCalledWith({
      fieldId: 1,
      varietyId: 2,
      bunches: 15,
      harvestDate: "2026-02-24",
      notes: "Good day",
    });
  });

  it("stores null for notes when notes is empty", async () => {
    const fd = new FormData();
    fd.set("fieldId", "1");
    fd.set("varietyId", "1");
    fd.set("bunches", "5");
    fd.set("harvestDate", "2026-02-24");

    await recordBunchHarvest(fd);

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ notes: null })
    );
  });

  it("revalidates /harvest and /forecast paths", async () => {
    const fd = new FormData();
    fd.set("fieldId", "1");
    fd.set("varietyId", "1");
    fd.set("bunches", "5");
    fd.set("harvestDate", "2026-02-24");

    await recordBunchHarvest(fd);

    expect(revalidatePath).toHaveBeenCalledWith("/harvest");
    expect(revalidatePath).toHaveBeenCalledWith("/forecast");
  });

  it("redirects to /harvest after inserting", async () => {
    const fd = new FormData();
    fd.set("fieldId", "1");
    fd.set("varietyId", "1");
    fd.set("bunches", "5");
    fd.set("harvestDate", "2026-02-24");

    await recordBunchHarvest(fd);

    expect(redirect).toHaveBeenCalledWith("/harvest");
  });
});

// ── recordBunchHarvestBatch ───────────────────────────────────────────────────

describe("recordBunchHarvestBatch", () => {
  it("inserts one row per entry", async () => {
    const entries = [
      { varietyId: 1, bunches: 10 },
      { varietyId: 2, bunches: 5 },
    ];

    await recordBunchHarvestBatch(3, entries, "2026-02-24");

    expect(db.insert).toHaveBeenCalledWith(bunchHarvests);
    expect(mockInsertValues).toHaveBeenCalledWith([
      { fieldId: 3, varietyId: 1, bunches: 10, harvestDate: "2026-02-24", notes: null },
      { fieldId: 3, varietyId: 2, bunches: 5, harvestDate: "2026-02-24", notes: null },
    ]);
  });

  it("returns immediately without DB call when entries is empty", async () => {
    await recordBunchHarvestBatch(1, [], "2026-02-24");
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("revalidates /harvest and /forecast after batch insert", async () => {
    await recordBunchHarvestBatch(1, [{ varietyId: 1, bunches: 5 }], "2026-02-24");
    expect(revalidatePath).toHaveBeenCalledWith("/harvest");
    expect(revalidatePath).toHaveBeenCalledWith("/forecast");
  });

  it("does NOT redirect (called from client useTransition)", async () => {
    await recordBunchHarvestBatch(1, [{ varietyId: 1, bunches: 5 }], "2026-02-24");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("handles a single entry correctly", async () => {
    await recordBunchHarvestBatch(7, [{ varietyId: 3, bunches: 20 }], "2026-01-15");
    expect(mockInsertValues).toHaveBeenCalledWith([
      { fieldId: 7, varietyId: 3, bunches: 20, harvestDate: "2026-01-15", notes: null },
    ]);
  });
});

// ── updateBunchHarvest ────────────────────────────────────────────────────────

describe("updateBunchHarvest", () => {
  it("updates bunches, date, and varietyId on the correct record", async () => {
    await updateBunchHarvest(42, {
      bunches: 8,
      harvestDate: "2026-02-20",
      varietyId: 3,
    });

    expect(db.update).toHaveBeenCalledWith(bunchHarvests);
    expect(mockUpdateSet).toHaveBeenCalledWith({
      bunches: 8,
      harvestDate: "2026-02-20",
      varietyId: 3,
    });
    expect(mockUpdateWhere).toHaveBeenCalled();
  });

  it("revalidates /harvest and /forecast after update", async () => {
    await updateBunchHarvest(1, { bunches: 5, harvestDate: "2026-02-01", varietyId: 1 });
    expect(revalidatePath).toHaveBeenCalledWith("/harvest");
    expect(revalidatePath).toHaveBeenCalledWith("/forecast");
  });

  it("does NOT redirect (called from client)", async () => {
    await updateBunchHarvest(1, { bunches: 5, harvestDate: "2026-02-01", varietyId: 1 });
    expect(redirect).not.toHaveBeenCalled();
  });
});

// ── deleteBunchHarvest ────────────────────────────────────────────────────────

describe("deleteBunchHarvest", () => {
  it("deletes the correct bunch harvest record", async () => {
    await deleteBunchHarvest(99);
    expect(db.delete).toHaveBeenCalledWith(bunchHarvests);
    expect(mockDeleteWhere).toHaveBeenCalled();
  });

  it("revalidates /harvest and /forecast after delete", async () => {
    await deleteBunchHarvest(99);
    expect(revalidatePath).toHaveBeenCalledWith("/harvest");
    expect(revalidatePath).toHaveBeenCalledWith("/forecast");
  });

  it("does NOT redirect", async () => {
    await deleteBunchHarvest(1);
    expect(redirect).not.toHaveBeenCalled();
  });
});

// ── recordWeightHarvest ───────────────────────────────────────────────────────

describe("recordWeightHarvest", () => {
  it("inserts a weight harvest from FormData", async () => {
    const fd = new FormData();
    fd.set("varietyId", "2");
    fd.set("pounds", "312.5");
    fd.set("harvestDate", "2026-02-24");
    fd.set("notes", "Good weight");

    await recordWeightHarvest(fd);

    expect(db.insert).toHaveBeenCalledWith(weightHarvests);
    expect(mockInsertValues).toHaveBeenCalledWith({
      varietyId: 2,
      pounds: "312.5",
      harvestDate: "2026-02-24",
      notes: "Good weight",
    });
  });

  it("stores null for empty notes", async () => {
    const fd = new FormData();
    fd.set("varietyId", "1");
    fd.set("pounds", "100");
    fd.set("harvestDate", "2026-02-24");

    await recordWeightHarvest(fd);

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ notes: null })
    );
  });

  it("revalidates /weight-log", async () => {
    const fd = new FormData();
    fd.set("varietyId", "1");
    fd.set("pounds", "100");
    fd.set("harvestDate", "2026-02-24");

    await recordWeightHarvest(fd);

    expect(revalidatePath).toHaveBeenCalledWith("/weight-log");
  });

  it("redirects to /weight-log", async () => {
    const fd = new FormData();
    fd.set("varietyId", "1");
    fd.set("pounds", "100");
    fd.set("harvestDate", "2026-02-24");

    await recordWeightHarvest(fd);

    expect(redirect).toHaveBeenCalledWith("/weight-log");
  });
});

// ── deleteWeightHarvest ───────────────────────────────────────────────────────

describe("deleteWeightHarvest", () => {
  it("deletes the correct weight harvest record", async () => {
    await deleteWeightHarvest(55);
    expect(db.delete).toHaveBeenCalledWith(weightHarvests);
    expect(mockDeleteWhere).toHaveBeenCalled();
  });

  it("revalidates /weight-log", async () => {
    await deleteWeightHarvest(55);
    expect(revalidatePath).toHaveBeenCalledWith("/weight-log");
  });

  it("does NOT redirect", async () => {
    await deleteWeightHarvest(55);
    expect(redirect).not.toHaveBeenCalled();
  });
});
