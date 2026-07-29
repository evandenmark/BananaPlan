import { db } from "@/db";
import { fieldInventory } from "@/db/schema";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

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
    const [row] = await db
      .select({ plantings: sql<number>`count(*)::int` })
      .from(fieldInventory);

    return Response.json({
      ok: true,
      plantings: row.plantings,
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
