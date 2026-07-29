import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Serverless: each warm instance holds its own pool, so keep it small.
// 3 covers the parallel queries on the dashboard without exhausting the
// Supabase pooler once several instances are warm.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
});

export const db = drizzle(pool, { schema });
