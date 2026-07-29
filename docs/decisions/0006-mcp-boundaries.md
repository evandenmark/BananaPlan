# 0006. MCP servers are read-mostly; Drizzle owns the schema

- **Status:** Accepted
- **Date:** 2026-07-28
- **Affects:** `.mcp.json`, `.claude/settings.json`, [`docs/mcp.md`](../mcp.md)

## Context

Two MCP servers are configured in `.mcp.json`: Supabase and Vercel. Between them
an agent could apply migrations, create and delete database branches, deploy edge
functions, and — through Vercel — buy domains, credits, and plan upgrades against
a payment method already on file.

Three of those capabilities are actively dangerous here:

1. **Spending.** The Vercel `buy_*` tools charge real money with no undo.
   Supabase's spending lives in its *Account management* group (`create_project`,
   `restore_project`, `get_cost`, `confirm_cost`) and in *Branching*, which
   [requires a paid plan](https://supabase.com/docs/guides/ai-tools/mcp) and bills
   per branch.
2. **Schema divergence.** `apply_migration` (and DDL through `execute_sql`) can
   change production structure directly. A column added that way exists in
   Supabase but not in `src/db/schema.ts`, so the next `drizzle-kit push` diffs
   it, decides it does not belong, and drops it. Silent data loss. Two tools
   cannot both own the schema — see [0002](0002-drizzle-push-no-migrations.md).
3. **Unused surface.** The project has no edge functions and does not use
   database branching, so those groups are pure attack surface.

The servers are still worth having: reading logs, advisors, and runtime errors
from production is the fastest path through most incidents.

## Decision

MCP servers are for **observation and deployment verification**, not for
changing production state. **No MCP tool may ever spend money.**

Two layers, because a blocklist alone only stops tools you thought to name.

**Layer 1 — don't expose it.** The Supabase server's URL narrows the tool groups
it serves at all:

```
?project_ref=hjkmldyptkmlalgdwjzs&features=docs,database,debugging,development
```

`account`, `functions`, and `branching` are gone, so every Supabase spending tool
and both branch-creation paths are structurally absent rather than merely
refused. (`project_ref` already disables the account group on its own — listing
`account` in `features` was inert but misleading.) Adding a group back is a
deliberate edit to a committed file.

**Layer 2 — deny what remains**, in `.claude/settings.json`, so the boundary
survives someone widening the URL:

- Vercel purchasing: `buy_domain`, `buy_pro`, `buy_credits`, `buy_addon`,
  `get_purchase_quote`, `check_domain_availability_and_price`,
  `get_domain_order`. Vercel's MCP has no server-side feature filter, so the
  deny list is the only control there.
- Supabase spending: `create_project`, `restore_project`, `pause_project`,
  `get_cost`, `confirm_cost`.
- Supabase branching: `create_branch`, `delete_branch`, `merge_branch`,
  `rebase_branch`, `reset_branch`.
- `apply_migration` and `deploy_edge_function`.

Within what remains:

- **Schema** changes only ever via `src/db/schema.ts` + `drizzle-kit push`.
- **Data** reads through `execute_sql` are fine. Writes through it are for
  incident recovery only, and the agent states the exact statement first.

The per-tool routing table lives in [`docs/mcp.md`](../mcp.md); this ADR records
only *why* the boundary is where it is.

## Consequences

- No agent can spend money through MCP, by construction rather than by
  instruction.
- The schema has exactly one source of truth, and no tool can quietly create a
  second.
- Production diagnosis stays fast — `get_advisors`, `get_logs`,
  `get_runtime_errors`, and `get_deployment_build_logs` are all still available.
- **Cost: schema changes require a laptop.** `drizzle-kit push` needs a shell and
  `DIRECT_URL`, so tables cannot be changed from a phone or a cloud session. This
  was weighed against allowing `apply_migration` on 2026-07-28 and accepted
  deliberately; the alternatives are recorded below if the tradeoff ever changes.
- **Cost:** legitimate one-off production data fixes are slower, going through
  `psql` or an announced `execute_sql`. That friction is the point.
- **Cost:** narrowing `features` also removed `generate_typescript_types`'s
  siblings in unused groups and the edge-function tools. If the project ever
  adopts edge functions, the URL needs `functions` added back.

## Alternatives considered

- **Trust prose guidance alone** — instructions in a doc do not survive a long
  session or a fresh context. Money-spending tools warrant hard enforcement.
- **Deny list only, leave the URL wide** — only blocks tool names someone thought
  to enumerate, and silently fails to cover tools added by a future server
  version. Narrowing `features` fails closed instead.
- **`read_only=true` on the Supabase URL** — would make write-shaped tools
  structurally impossible, which is stronger still. Rejected for now because it
  also blocks the incident-recovery `execute_sql` path, and the schema is already
  protected by `apply_migration` being denied. Worth revisiting if MCP data
  writes never turn out to be needed.
- **Hybrid: `drizzle-kit generate` + `apply_migration`** — Drizzle emits
  reviewable SQL files from `schema.ts` and MCP applies exactly those, keeping
  one source of truth while allowing schema changes without a laptop. A real
  option, considered and declined on 2026-07-28 in favor of keeping the simpler
  `push` workflow. This is the one to revisit first if the laptop requirement
  starts to bite.
- **Let Supabase own migrations, retire `drizzle-kit push`** — maximum agent
  autonomy over tables, at the cost of `schema.ts` no longer being authoritative.
  Rejected: the typed schema is what the whole app is written against.
