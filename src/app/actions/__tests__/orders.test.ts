import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { orders } from "@/db/schema";
import {
  createOrder,
  updateOrder,
  deleteOrder,
} from "../orders";

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

const baseOrderFormData = () => {
  const fd = new FormData();
  fd.set("varietyId", "2");
  fd.set("poundsPerDelivery", "200");
  fd.set("frequency", "monthly");
  fd.set("startDate", "2026-03-01");
  fd.set("endDate", "2026-12-31");
  fd.set("notes", "Weekly order");
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

// ── createOrder ───────────────────────────────────────────────────────────────

describe("createOrder", () => {
  it("inserts an order linked to the client with all fields", async () => {
    await createOrder(4, baseOrderFormData());

    expect(db.insert).toHaveBeenCalledWith(orders);
    expect(mockInsertValues).toHaveBeenCalledWith({
      clientId: 4,
      varietyId: 2,
      poundsPerDelivery: "200",
      frequency: "monthly",
      startDate: "2026-03-01",
      endDate: "2026-12-31",
      notes: "Weekly order",
    });
  });

  it("stores null for optional endDate when not provided", async () => {
    const fd = baseOrderFormData();
    fd.delete("endDate");

    await createOrder(4, fd);

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ endDate: null })
    );
  });

  it("stores null for optional notes when not provided", async () => {
    const fd = baseOrderFormData();
    fd.delete("notes");

    await createOrder(4, fd);

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ notes: null })
    );
  });

  it("handles one_time frequency correctly", async () => {
    const fd = baseOrderFormData();
    fd.set("frequency", "one_time");

    await createOrder(4, fd);

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ frequency: "one_time" })
    );
  });

  it("revalidates and redirects to client page", async () => {
    await createOrder(4, baseOrderFormData());
    expect(revalidatePath).toHaveBeenCalledWith("/clients/4");
    expect(redirect).toHaveBeenCalledWith("/clients/4");
  });
});

// ── updateOrder ───────────────────────────────────────────────────────────────

describe("updateOrder", () => {
  it("updates all order fields for the correct order id", async () => {
    const fd = baseOrderFormData();
    fd.set("poundsPerDelivery", "300");
    fd.set("isActive", "true");

    await updateOrder(12, 4, fd);

    expect(db.update).toHaveBeenCalledWith(orders);
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        varietyId: 2,
        poundsPerDelivery: "300",
        frequency: "monthly",
        startDate: "2026-03-01",
        isActive: true,
      })
    );
    expect(mockUpdateWhere).toHaveBeenCalled();
  });

  it("sets isActive to false when formData value is not 'true'", async () => {
    const fd = baseOrderFormData();
    fd.set("isActive", "false");

    await updateOrder(12, 4, fd);

    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: false })
    );
  });

  it("includes an updatedAt timestamp", async () => {
    const fd = baseOrderFormData();
    fd.set("isActive", "true");

    await updateOrder(12, 4, fd);

    const setArg = vi.mocked(mockUpdateSet).mock.calls[0][0];
    expect(setArg.updatedAt).toBeInstanceOf(Date);
  });

  it("revalidates and redirects to client page", async () => {
    const fd = baseOrderFormData();
    fd.set("isActive", "true");

    await updateOrder(12, 4, fd);

    expect(revalidatePath).toHaveBeenCalledWith("/clients/4");
    expect(redirect).toHaveBeenCalledWith("/clients/4");
  });
});

// ── deleteOrder ───────────────────────────────────────────────────────────────

describe("deleteOrder", () => {
  it("deletes the order by id", async () => {
    await deleteOrder(15, 4);
    expect(db.delete).toHaveBeenCalledWith(orders);
    expect(mockDeleteWhere).toHaveBeenCalled();
  });

  it("revalidates the client's detail page", async () => {
    await deleteOrder(15, 4);
    expect(revalidatePath).toHaveBeenCalledWith("/clients/4");
  });

  it("does NOT redirect (delete is inline without nav change)", async () => {
    await deleteOrder(15, 4);
    expect(redirect).not.toHaveBeenCalled();
  });
});
