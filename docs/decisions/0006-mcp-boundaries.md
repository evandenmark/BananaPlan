# 0006. MCP servers are read-mostly; Drizzle owns the schema

- **Status:** Accepted
- **Date:** 2026-07-28
- **Affects:** `.mcp.json`, `.claude/settings.json`, [`docs/mcp.md`](../mcp.md)

## Context

Two MCP servers are configured in `.mcp.json`: Supabase (with `database`,
`development`, `debugging`, `functions`, `branching`, `account`, `docs`
features) and Vercel. Between them an agent can apply migrations, delete
branches, deploy, and — through the Vercel server — buy domains, credits, and
plan upgrades with the owner's payment method on file.

Two of those capabilities are actively dangerous here:

1. `supabase.apply_migration` and `supabase.execute_sql` can change production
   structure directly, which would make the live database diverge from
   `src/db/schema.ts` and be silently reverted by the next `drizzle-kit push`.
   That breaks [0002](0002-drizzle-push-no-migrations.md).
2. The Vercel `buy_*` tools spend real money and have no undo.

The servers are still worth having: reading logs, advisors, and runtime errors
from production is the fastest path through most incidents.

## Decision

MCP servers are for **observation and deployment verification**, not for
changing production state.

- **Schema** changes only ever via `src/db/schema.ts` + `drizzle-kit push`.
  Never `apply_migration`.
- **Data** reads through `execute_sql` are fine. Writes through it are for
  incident recovery only, and the agent says what it is about to run before
  running it.
- **Purchasing tools are denied outright** in `.claude/settings.json` —
  `buy_domain`, `buy_pro`, `buy_credits`, `buy_addon`. An agent must never spend
  money, and this is enforced by the harness rather than by good intentions.
- **Destructive Supabase branch tools** (`delete_branch`, `reset_branch`,
  `merge_branch`, `rebase_branch`) are denied. The project does not use database
  branching.

The per-tool routing table lives in [`docs/mcp.md`](../mcp.md); this ADR records
only *why* the boundary is where it is.

## Consequences

- The schema has exactly one source of truth, and no tool can quietly create a
  second.
- Production diagnosis stays fast — `get_advisors`, `get_logs`,
  `get_runtime_errors`, and `get_deployment_build_logs` are all still available.
- **Cost:** legitimate one-off production data fixes are slower, going through
  `psql` or an announced `execute_sql`. That friction is the point.
- **Cost:** denied tools fail visibly rather than being unavailable, so an agent
  may attempt one and be refused. `docs/mcp.md` exists to prevent the attempt.

## Alternatives considered

- **Trust prose guidance alone** — instructions in a doc do not survive a long
  session or a fresh context. Money-spending tools warrant hard enforcement.
- **Remove the servers from `.mcp.json`** — throws away the diagnostic value,
  which is the main reason they are configured.
- **Narrow the Supabase `features` query parameter instead** — a reasonable
  belt-and-braces addition later, but it is a URL edit that is easy to widen
  again without anyone noticing; the deny list is explicit and reviewable.
