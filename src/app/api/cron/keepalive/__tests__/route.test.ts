import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db } from "@/db";
import { fieldInventory } from "@/db/schema";
import { GET } from "../route";

vi.mock("@/db", () => ({ db: { select: vi.fn() } }));

let mockFrom: ReturnType<typeof vi.fn>;
const originalSecret = process.env.CRON_SECRET;

beforeEach(() => {
  vi.resetAllMocks();
  delete process.env.CRON_SECRET;
  mockFrom = vi.fn().mockResolvedValue([{ plantings: 8 }]);
  vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
});

const req = (headers: Record<string, string> = {}) =>
  new Request("https://bananaplan.vercel.app/api/cron/keepalive", { headers });

describe("keepalive cron route", () => {
  it("queries a real table so the ping counts as database activity", async () => {
    await GET(req());
    expect(db.select).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalledWith(fieldInventory);
  });

  it("reports ok with the row count", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, plantings: 8 });
  });

  it("rejects an unauthorized caller when CRON_SECRET is set", async () => {
    process.env.CRON_SECRET = "topsecret";
    const res = await GET(req({ authorization: "Bearer wrong" }));
    expect(res.status).toBe(401);
    expect(db.select).not.toHaveBeenCalled();
  });

  it("accepts the matching bearer token", async () => {
    process.env.CRON_SECRET = "topsecret";
    const res = await GET(req({ authorization: "Bearer topsecret" }));
    expect(res.status).toBe(200);
  });

  it("allows the request when no secret is configured", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
  });

  it("returns 500 when the database is unreachable, so the cron shows as failed", async () => {
    mockFrom.mockRejectedValue(new Error("ECONNREFUSED"));
    const res = await GET(req());
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ ok: false });
  });
});
