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
    expect(pathsCalled().sort()).toEqual(["/", "/forecast", "/harvest"]);
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
