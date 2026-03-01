import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { varieties } from "@/db/schema";
import {
  createVariety,
  updateVariety,
  deleteVariety,
} from "../varieties";

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

const baseVarietyFormData = () => {
  const fd = new FormData();
  fd.set("name", "Namwah");
  fd.set("description", "Sweet and short");
  fd.set("monthsToFirstBunch", "9");
  fd.set("monthsToSubsequentBunch", "3");
  fd.set("totalBunchesPerMat", "3");
  fd.set("bananasPerBunch", "120");
  fd.set("poundsPerBunch", "25");
  fd.set("successRate", "0.9");
  fd.set("notes", "Common variety");
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
});

// ── createVariety ─────────────────────────────────────────────────────────────

describe("createVariety", () => {
  it("inserts all variety fields from FormData", async () => {
    await createVariety(baseVarietyFormData());

    expect(db.insert).toHaveBeenCalledWith(varieties);
    expect(mockInsertValues).toHaveBeenCalledWith({
      name: "Namwah",
      description: "Sweet and short",
      monthsToFirstBunch: "9",
      monthsToSubsequentBunch: "3",
      totalBunchesPerMat: 3,
      bananasPerBunch: 120,
      poundsPerBunch: "25",
      successRate: "0.9",
      notes: "Common variety",
    });
  });

  it("stores null for optional description when empty", async () => {
    const fd = baseVarietyFormData();
    fd.delete("description");

    await createVariety(fd);

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ description: null })
    );
  });

  it("stores null for optional bananasPerBunch when empty", async () => {
    const fd = baseVarietyFormData();
    fd.delete("bananasPerBunch");

    await createVariety(fd);

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ bananasPerBunch: null })
    );
  });

  it("stores null for optional notes when empty", async () => {
    const fd = baseVarietyFormData();
    fd.delete("notes");

    await createVariety(fd);

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ notes: null })
    );
  });

  it("parses totalBunchesPerMat and bananasPerBunch as integers", async () => {
    await createVariety(baseVarietyFormData());

    const callArg = vi.mocked(mockInsertValues).mock.calls[0][0];
    expect(typeof callArg.totalBunchesPerMat).toBe("number");
    expect(typeof callArg.bananasPerBunch).toBe("number");
  });

  it("redirects to /varieties after creation", async () => {
    await createVariety(baseVarietyFormData());
    expect(redirect).toHaveBeenCalledWith("/varieties");
  });
});

// ── updateVariety ─────────────────────────────────────────────────────────────

describe("updateVariety", () => {
  it("updates all variety fields for the correct id", async () => {
    const fd = baseVarietyFormData();
    fd.set("name", "Namwah Updated");

    await updateVariety(5, fd);

    expect(db.update).toHaveBeenCalledWith(varieties);
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Namwah Updated",
        monthsToFirstBunch: "9",
        successRate: "0.9",
      })
    );
    expect(mockUpdateWhere).toHaveBeenCalled();
  });

  it("includes an updatedAt timestamp", async () => {
    await updateVariety(5, baseVarietyFormData());
    const setArg = vi.mocked(mockUpdateSet).mock.calls[0][0];
    expect(setArg.updatedAt).toBeInstanceOf(Date);
  });

  it("redirects to /varieties after update", async () => {
    await updateVariety(5, baseVarietyFormData());
    expect(redirect).toHaveBeenCalledWith("/varieties");
  });

  it("handles null bananasPerBunch when field is absent", async () => {
    const fd = baseVarietyFormData();
    fd.delete("bananasPerBunch");

    await updateVariety(5, fd);

    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ bananasPerBunch: null })
    );
  });
});

// ── deleteVariety ─────────────────────────────────────────────────────────────

describe("deleteVariety", () => {
  it("deletes the variety by id", async () => {
    await deleteVariety(10);
    expect(db.delete).toHaveBeenCalledWith(varieties);
    expect(mockDeleteWhere).toHaveBeenCalled();
  });

  it("revalidates /varieties", async () => {
    await deleteVariety(10);
    expect(revalidatePath).toHaveBeenCalledWith("/varieties");
  });

  it("does NOT redirect", async () => {
    await deleteVariety(10);
    expect(redirect).not.toHaveBeenCalled();
  });
});
