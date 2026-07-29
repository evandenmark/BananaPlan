import { db } from "@/db";
import { fieldInventory, sites, varieties } from "@/db/schema";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** Queried one at a time, so each is a separate round trip to Postgres. */
const PROBES = [
  { name: "sites", table: sites },
  { name: "varieties", table: varieties },
  { name: "plantings", table: fieldInventory },
] as const;

/**
 * Keeps the Supabase project out of free-tier hibernation.
 *
 * Supabase pauses Free plan projects with low activity over a 7-day window, and
 * their guidance is "a few user requests to the database each day" — so this
 * runs daily, not weekly. Losing this project once already cost a full outage;
 * see docs/decisions/0010-database-keepalive.md.
 *
 * A plain read is enough. There is deliberately no heartbeat table: writing a
 * row every day would grow forever, need pruning, and put a fake table in a
 * schema that otherwise describes only real farm concepts.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // Several small queries rather than one, because Supabase's guidance is "a
    // few user requests to the database each day". Sequential on purpose: each
    // is its own round trip, and the whole thing is still milliseconds.
    //
    // Deliberately no sleeping between them. Vercel bills wall-clock execution
    // and would kill the function at maxDuration — turning a healthy ping into
    // a failed cron run. Spacing that matters comes from running this at
    // several hours of the day (see vercel.json), not from pauses inside one
    // invocation.
    const counts: Record<string, number> = {};
    for (const probe of PROBES) {
      const [row] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(probe.table);
      counts[probe.name] = row.n;
    }

    return Response.json({
      ok: true,
      counts,
      at: new Date().toISOString(),
    });
  } catch (error) {
    // Return 500 so a failed ping shows up in Vercel's cron history as failed
    // rather than silently reporting success while the database is unreachable.
    console.error("keepalive ping failed", error);
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown" },
      { status: 500 }
    );
  }
}
