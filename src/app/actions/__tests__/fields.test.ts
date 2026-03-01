import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fields, fieldInventory } from "@/db/schema";
import {
  createField,
  updateField,
  addInventory,
  updateInventory,
  deleteInventory,
} from "../fields";

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
let mockInsertReturning: ReturnType<typeof vi.fn>;
let mockUpdateSet: ReturnType<typeof vi.fn>;
let mockUpdateWhere: ReturnType<typeof vi.fn>;
let mockDeleteWhere: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();

  mockInsertReturning = vi.fn().mockResolvedValue([{ id: 42 }]);
  mockInsertValues = vi.fn().mockReturnValue({ returning: mockInsertReturning });
  vi.mocked(db.insert).mockReturnValue({ values: mockInsertValues } as any);

  mockUpdateWhere = vi.fn().mockResolvedValue([]);
  mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
  vi.mocked(db.update).mockReturnValue({ set: mockUpdateSet } as any);

  mockDeleteWhere = vi.fn().mockResolvedValue([]);
  vi.mocked(db.delete).mockReturnValue({ where: mockDeleteWhere } as any);
});

// ── createField ───────────────────────────────────────────────────────────────

describe("createField", () => {
  it("inserts a new field with all provided values", async () => {
    const fd = new FormData();
    fd.set("siteId", "1");
    fd.set("name", "K5");
    fd.set("sizeAcres", "2.5");
    fd.set("notes", "Corner plot");

    await createField(fd);

    expect(db.insert).toHaveBeenCalledWith(fields);
    expect(mockInsertValues).toHaveBeenCalledWith({
      siteId: 1,
      name: "K5",
      sizeAcres: "2.5",
      notes: "Corner plot",
    });
  });

  it("stores null for optional sizeAcres and notes when omitted", async () => {
    const fd = new FormData();
    fd.set("siteId", "2");
    fd.set("name", "B1");

    await createField(fd);

    expect(mockInsertValues).toHaveBeenCalledWith({
      siteId: 2,
      name: "B1",
      sizeAcres: null,
      notes: null,
    });
  });

  it("calls .returning() to get the new field id", async () => {
    const fd = new FormData();
    fd.set("siteId", "1");
    fd.set("name", "K5");

    await createField(fd);

    expect(mockInsertReturning).toHaveBeenCalled();
  });

  it("redirects to the new field's detail page using returned id", async () => {
    mockInsertReturning.mockResolvedValue([{ id: 77 }]);

    const fd = new FormData();
    fd.set("siteId", "1");
    fd.set("name", "K5");

    await createField(fd);

    expect(redirect).toHaveBeenCalledWith("/fields/77");
  });
});

// ── updateField ───────────────────────────────────────────────────────────────

describe("updateField", () => {
  it("updates all editable fields including isActive flag", async () => {
    const fd = new FormData();
    fd.set("name", "K5 Updated");
    fd.set("sizeAcres", "3.0");
    fd.set("notes", "Updated note");
    fd.set("isActive", "true");

    await updateField(5, fd);

    expect(db.update).toHaveBeenCalledWith(fields);
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "K5 Updated",
        sizeAcres: "3.0",
        notes: "Updated note",
        isActive: true,
      })
    );
    expect(mockUpdateWhere).toHaveBeenCalled();
  });

  it("sets isActive to false when formData value is not 'true'", async () => {
    const fd = new FormData();
    fd.set("name", "K5");
    fd.set("isActive", "false");

    await updateField(5, fd);

    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: false })
    );
  });

  it("stores null for empty sizeAcres and notes", async () => {
    const fd = new FormData();
    fd.set("name", "K5");
    fd.set("isActive", "true");

    await updateField(5, fd);

    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ sizeAcres: null, notes: null })
    );
  });

  it("includes an updatedAt timestamp in the set call", async () => {
    const fd = new FormData();
    fd.set("name", "K5");
    fd.set("isActive", "true");

    await updateField(5, fd);

    const setArg = vi.mocked(mockUpdateSet).mock.calls[0][0];
    expect(setArg.updatedAt).toBeInstanceOf(Date);
  });

  it("redirects to the field's detail page", async () => {
    const fd = new FormData();
    fd.set("name", "K5");
    fd.set("isActive", "true");

    await updateField(5, fd);

    expect(redirect).toHaveBeenCalledWith("/fields/5");
  });
});

// ── addInventory ──────────────────────────────────────────────────────────────

describe("addInventory", () => {
  it("inserts a new inventory row linked to the field", async () => {
    const fd = new FormData();
    fd.set("varietyId", "3");
    fd.set("numberOfMats", "50");
    fd.set("plantingDate", "2026-01-15");
    fd.set("notes", "Row 1");

    await addInventory(7, fd);

    expect(db.insert).toHaveBeenCalledWith(fieldInventory);
    expect(mockInsertValues).toHaveBeenCalledWith({
      fieldId: 7,
      varietyId: 3,
      numberOfMats: 50,
      plantingDate: "2026-01-15",
      notes: "Row 1",
    });
  });

  it("stores null for empty notes", async () => {
    const fd = new FormData();
    fd.set("varietyId", "1");
    fd.set("numberOfMats", "20");
    fd.set("plantingDate", "2026-01-15");

    await addInventory(1, fd);

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ notes: null })
    );
  });

  it("revalidates the field detail page", async () => {
    const fd = new FormData();
    fd.set("varietyId", "1");
    fd.set("numberOfMats", "10");
    fd.set("plantingDate", "2026-01-15");

    await addInventory(8, fd);

    expect(revalidatePath).toHaveBeenCalledWith("/fields/8");
  });

  it("redirects to the field detail page", async () => {
    const fd = new FormData();
    fd.set("varietyId", "1");
    fd.set("numberOfMats", "10");
    fd.set("plantingDate", "2026-01-15");

    await addInventory(8, fd);

    expect(redirect).toHaveBeenCalledWith("/fields/8");
  });
});

// ── updateInventory ───────────────────────────────────────────────────────────

describe("updateInventory", () => {
  it("updates all inventory fields for the correct record", async () => {
    const fd = new FormData();
    fd.set("varietyId", "4");
    fd.set("numberOfMats", "30");
    fd.set("plantingDate", "2026-02-01");
    fd.set("notes", "Updated");

    await updateInventory(12, 9, fd);

    expect(db.update).toHaveBeenCalledWith(fieldInventory);
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        varietyId: 4,
        numberOfMats: 30,
        plantingDate: "2026-02-01",
        notes: "Updated",
      })
    );
  });

  it("includes updatedAt timestamp", async () => {
    const fd = new FormData();
    fd.set("varietyId", "1");
    fd.set("numberOfMats", "10");
    fd.set("plantingDate", "2026-01-01");

    await updateInventory(1, 1, fd);

    const setArg = vi.mocked(mockUpdateSet).mock.calls[0][0];
    expect(setArg.updatedAt).toBeInstanceOf(Date);
  });

  it("redirects to the field's detail page", async () => {
    const fd = new FormData();
    fd.set("varietyId", "1");
    fd.set("numberOfMats", "10");
    fd.set("plantingDate", "2026-01-01");

    await updateInventory(12, 9, fd);

    expect(redirect).toHaveBeenCalledWith("/fields/9");
  });
});

// ── deleteInventory ───────────────────────────────────────────────────────────

describe("deleteInventory", () => {
  it("deletes the inventory record by id", async () => {
    await deleteInventory(25, 4);
    expect(db.delete).toHaveBeenCalledWith(fieldInventory);
    expect(mockDeleteWhere).toHaveBeenCalled();
  });

  it("revalidates the field detail page", async () => {
    await deleteInventory(25, 4);
    expect(revalidatePath).toHaveBeenCalledWith("/fields/4");
  });

  it("does NOT redirect (remove button triggers without nav change)", async () => {
    await deleteInventory(25, 4);
    expect(redirect).not.toHaveBeenCalled();
  });
});
