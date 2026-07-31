import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clients, orders } from "@/db/schema";
import {
  createClient,
  updateClient,
  deleteClient,
} from "../clients";

vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
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

  mockInsertReturning = vi.fn().mockResolvedValue([{ id: 5 }]);
  mockInsertValues = vi.fn().mockReturnValue({ returning: mockInsertReturning });
  vi.mocked(db.insert).mockReturnValue({ values: mockInsertValues } as any);

  mockUpdateWhere = vi.fn().mockResolvedValue([]);
  mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
  vi.mocked(db.update).mockReturnValue({ set: mockUpdateSet } as any);

  mockDeleteWhere = vi.fn().mockResolvedValue([]);
  vi.mocked(db.delete).mockReturnValue({ where: mockDeleteWhere } as any);

  // deleteClient cascades inside a transaction; hand the callback a tx whose
  // `delete` is the same spy, so the assertions below read the same way.
  vi.mocked(db.transaction).mockImplementation(async (cb: any) =>
    cb({ delete: db.delete } as any)
  );
});

// ── createClient ──────────────────────────────────────────────────────────────

describe("createClient", () => {
  it("inserts a new client with the provided name", async () => {
    const fd = new FormData();
    fd.set("name", "Kauai Co-op");

    await createClient(fd);

    expect(db.insert).toHaveBeenCalledWith(clients);
    expect(mockInsertValues).toHaveBeenCalledWith({ name: "Kauai Co-op" });
  });

  it("calls .returning() to retrieve the new client id", async () => {
    const fd = new FormData();
    fd.set("name", "Test Client");

    await createClient(fd);

    expect(mockInsertReturning).toHaveBeenCalled();
  });

  it("redirects to the new client's detail page using returned id", async () => {
    mockInsertReturning.mockResolvedValue([{ id: 42 }]);

    const fd = new FormData();
    fd.set("name", "Test Client");

    await createClient(fd);

    expect(redirect).toHaveBeenCalledWith("/clients/42");
  });
});

// ── updateClient ──────────────────────────────────────────────────────────────

describe("updateClient", () => {
  it("updates the client's name for the correct id", async () => {
    const fd = new FormData();
    fd.set("name", "Updated Co-op");

    await updateClient(7, fd);

    expect(db.update).toHaveBeenCalledWith(clients);
    expect(mockUpdateSet).toHaveBeenCalledWith({ name: "Updated Co-op" });
    expect(mockUpdateWhere).toHaveBeenCalled();
  });

  it("revalidates the client's detail page", async () => {
    const fd = new FormData();
    fd.set("name", "Updated");

    await updateClient(7, fd);

    expect(revalidatePath).toHaveBeenCalledWith("/clients/7");
  });

  it("redirects to the client's detail page", async () => {
    const fd = new FormData();
    fd.set("name", "Updated");

    await updateClient(7, fd);

    expect(redirect).toHaveBeenCalledWith("/clients/7");
  });
});

// ── deleteClient ──────────────────────────────────────────────────────────────

describe("deleteClient", () => {
  it("deletes the client's orders BEFORE deleting the client (FK constraint)", async () => {
    const deleteCalls: unknown[] = [];
    vi.mocked(db.delete).mockImplementation((table) => {
      deleteCalls.push(table);
      return { where: mockDeleteWhere } as any;
    });

    await deleteClient(3);

    // First call should be orders, second should be clients
    expect(deleteCalls[0]).toBe(orders);
    expect(deleteCalls[1]).toBe(clients);
  });

  it("calls db.delete twice (orders + clients)", async () => {
    await deleteClient(3);
    expect(db.delete).toHaveBeenCalledTimes(2);
  });

  it("runs both deletes in one transaction, so it cannot half-apply", async () => {
    await deleteClient(3);
    expect(db.transaction).toHaveBeenCalledTimes(1);
  });

  it("deletes nothing outside the transaction, and does not redirect, if it fails", async () => {
    // Rollback itself is Postgres's job and is not observable here; what this
    // pins is that no delete is issued outside the transaction and that a
    // failure is not swallowed into a redirect to /clients.
    vi.mocked(db.transaction).mockRejectedValue(new Error("deadlock"));

    await expect(deleteClient(3)).rejects.toThrow("deadlock");
    expect(db.delete).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("revalidates /clients list page", async () => {
    await deleteClient(3);
    expect(revalidatePath).toHaveBeenCalledWith("/clients");
  });

  it("redirects to /clients list", async () => {
    await deleteClient(3);
    expect(redirect).toHaveBeenCalledWith("/clients");
  });
});
