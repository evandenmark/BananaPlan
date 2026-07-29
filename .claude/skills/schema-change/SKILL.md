---
name: schema-change
description: Add or change a table, column, enum, or relation in the BananaPlan database. Use whenever src/db/schema.ts needs editing — new field on an entity, new table, changed type or constraint — and for applying that change to the local and production databases with drizzle-kit push.
---

# Change the database schema

`src/db/schema.ts` is the **only** source of truth for structure. There are no
migration files; changes are applied with `drizzle-kit push`
([ADR 0002](../../../docs/decisions/0002-drizzle-push-no-migrations.md)).

## Before you start

- **Never** change production structure through the Supabase MCP tools or SQL
  editor. That creates a second source of truth that the next push silently
  reverts. See [docs/mcp.md](../../../docs/mcp.md).
- Check [docs/constitution.md](../../../docs/constitution.md) §4. Some shapes are
  ruled out — notably, **do not add a forecast table**; the forecast is derived,
  never stored.

## Steps

1. **Edit `src/db/schema.ts`.** Follow the existing conventions exactly:

   - `id: serial("id").primaryKey()`
   - snake_case column names in the string, camelCase in TypeScript
   - `createdAt: timestamp("created_at").defaultNow().notNull()` on every table;
     add `updatedAt` too if the entity is editable
   - **Weights, money, and rates are `numeric`, never `float`** — precision
     matters and these arrive in TypeScript as **strings**. Parse at the point of
     use with `parseFloat`; do not "fix" the types.
   - Calendar dates are `date`, not `timestamp`. Planting and harvest dates are
     days, not instants ([constitution](../../../docs/constitution.md) §4.6).
   - Foreign keys: `integer("x_id").references(() => other.id).notNull()`

2. **Add the relation** in the `// Relations` block at the bottom — both
   directions. Easy to forget; `db.query` with `with:` fails without it.

3. **Push to local:**

   ```bash
   npx drizzle-kit push
   ```

   **Read the diff it prints before confirming.** `push` expresses a rename as
   drop-plus-add, which is data loss. If the diff drops a column you meant to
   rename, cancel: rename it by hand in SQL first, then make `schema.ts` match so
   push becomes a no-op.

4. **Typecheck:**

   ```bash
   npx tsc --noEmit
   ```

   A widened or narrowed column surfaces here as errors in the actions and pages
   that touch it. Fix all of them — a `numeric` column added to a form means a
   `string`, not a `number`.

5. **Update the write path.** New columns need handling in
   `src/app/actions/<entity>.ts` (create *and* update) and in the corresponding
   `new` / `edit` pages. A column added to the schema but not the form is
   invisible and silently null.

6. **Update the tests.** Action tests assert the exact object passed to
   `.values()` / `.set()` — they will fail on a new field, which is the point.
   Add the field to the fixtures in
   `src/app/actions/__tests__/<entity>.test.ts`.

   ```bash
   npm run test:run
   ```

7. **Refresh `seed-data.sql`** only if the change makes the fixture no longer
   load — a new `NOT NULL` column without a default, say. It is a small
   local-seeding fixture, **not the backup**; production backups are automatic
   ([ADR 0011](../../../docs/decisions/0011-automated-production-backups.md)).

   ```bash
   pg_dump bananaplan --data-only --column-inserts > seed-data.sql
   ```

   This repo is **public**. Check the result before committing: it must contain
   no `clients` or `orders` rows, since those carry real names.

8. **Push to production**, only after local is green:

   ```bash
   npx drizzle-kit push --force
   ```

   This runs against `DIRECT_URL` (session pooler, port 5432) — see
   `drizzle.config.ts`. `--force` skips confirmation, so you must have read the
   local diff in step 3 and be sure it is not destructive.

   Then verify through `DATABASE_URL`, the path production actually uses, with
   `mcp__supabase__list_tables`.

9. **Deploy the code** that depends on the new schema — see the `ship` skill.
   Order matters: schema first, then code. Code deployed against a schema that
   lacks its columns 500s on every affected page.

## When to write an ADR

A new column on an existing entity: no. A new table, a changed relationship, a
changed type on a column carrying money or yield, or anything touching the
invariants in constitution §4: yes — run the `log-decision` skill.
