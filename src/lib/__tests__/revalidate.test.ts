import { describe, it, expect, beforeEach, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { revalidateFor } from "../revalidate";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
});

const pathsCalled = () =>
  vi.mocked(revalidatePath).mock.calls.map((c) => c[0]);

describe("revalidateFor", () => {
  it("revalidates every route that displays the table", () => {
    revalidateFor(["bunchHarvests"]);
    expect(pathsCalled().sort()).toEqual([
      "/",
      "/forecast",
      "/harvest",
      "/varieties",
    ]);
  });

  // The Delete button on these pages is rendered from reference counts
  // (ADR 0012), so writing a child table has to invalidate the parent's list.
  it("revalidates /varieties for every table that references a variety", () => {
    for (const table of [
      "fieldInventory",
      "orders",
      "bunchHarvests",
      "weightHarvests",
    ] as const) {
      vi.mocked(revalidatePath).mockClear();
      revalidateFor([table]);
      expect(pathsCalled()).toContain("/varieties");
    }
  });

  it("revalidates /sites when fields change, which decide if a site is deletable", () => {
    revalidateFor(["fields"]);
    expect(pathsCalled()).toContain("/sites");
  });

  it("revalidates /forecast for weight harvests, which the chart shows as actuals", () => {
    revalidateFor(["weightHarvests"]);
    expect(pathsCalled()).toContain("/forecast");
    expect(pathsCalled()).toContain("/weight-log");
  });

  it("covers the full fan-out for varieties, which nine routes read", () => {
    revalidateFor(["varieties"]);
    const paths = pathsCalled();
    for (const p of [
      "/",
      "/fields",
      "/harvest",
      "/forecast",
      "/varieties",
      "/weight-log",
      "/more",
    ]) {
      expect(paths).toContain(p);
    }
  });

  it("substitutes a concrete id into a dynamic route when given one", () => {
    revalidateFor(["orders"], { "/clients/[id]": 4 });
    expect(revalidatePath).toHaveBeenCalledWith("/clients/4");
    expect(pathsCalled()).not.toContain("/clients/[id]");
  });

  it("invalidates every instance of a dynamic route when no id is given", () => {
    revalidateFor(["clients"]);
    expect(revalidatePath).toHaveBeenCalledWith("/clients/[id]", "page");
  });

  it("passes no second argument for static routes", () => {
    revalidateFor(["sites"]);
    const staticCall = vi
      .mocked(revalidatePath)
      .mock.calls.find((c) => c[0] === "/sites");
    expect(staticCall).toEqual(["/sites"]);
  });

  it("unions routes across tables without duplicating them", () => {
    revalidateFor(["clients", "orders"]);
    const paths = pathsCalled();
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toContain("/forecast"); // from orders
    expect(paths).toContain("/more"); // from both
  });

  it("does nothing when given no tables", () => {
    revalidateFor([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
