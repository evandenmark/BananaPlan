# 0002. Ship schema with `drizzle-kit push`, not migration files

- **Status:** Accepted
- **Date:** 2026-07-28 *(recorded retroactively; decision made 2026-02)*
- **Affects:** `src/db/schema.ts`, `drizzle.config.ts`, deployment

## Context

Drizzle supports both `generate` + `migrate` (versioned SQL files committed to
the repo) and `push` (diff the schema file against the live database and apply
the difference). The project has one developer, one production database, and no
staging environment. There is also no team coordination problem for migrations
to solve — the usual reason to keep an ordered migration history.

## Decision

`src/db/schema.ts` is the single source of truth for structure. Apply changes
with:

```bash
npx drizzle-kit push          # local, against DATABASE_URL
npx drizzle-kit push --force  # production, against DIRECT_URL
```

No migration files are generated or committed. The database is never modified by
hand or through the Supabase SQL editor to change structure — see
[0006](0006-mcp-boundaries.md).

## Consequences

- Schema changes are one file edit plus one command.
- **Cost: there is no down-migration and no history.** A destructive diff — a
  dropped or renamed column — is applied as data loss, and `--force` skips the
  confirmation that would have caught it. Always read the diff `push` prints
  before accepting it against production.
- **Cost:** renames are indistinguishable from drop-plus-add. To rename a column
  without losing data you must do it by hand in SQL first, then make the schema
  file match so `push` becomes a no-op.
- Data, unlike structure, has no automatic path to production. That gap is
  covered by [0007](0007-seed-data-as-backup.md).

## Alternatives considered

- **`drizzle-kit generate` + `migrate`** — the correct choice for a team or for
  multiple environments. Here it would add a review step and a directory of SQL
  files for a database only one person changes.
- **Supabase CLI migrations** — same overhead, plus it makes Supabase the owner
  of the schema, which would split the source of truth away from `schema.ts`.
