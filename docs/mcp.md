# MCP servers: what to use, and what not to touch

Two servers are configured in [`.mcp.json`](../.mcp.json). The rationale for
these boundaries is [ADR 0006](decisions/0006-mcp-boundaries.md); this page is
the routing table.

**The rule in one line:** MCP is for looking at production, not for changing it —
and never for spending money.

## No MCP tool may spend money

Enforced two ways, not just documented:

1. The Supabase URL serves only `docs,database,debugging,development`. Its
   `account` group (`create_project`, `restore_project`, `get_cost`,
   `confirm_cost`) and `branching` group (billed per branch, paid plans only) are
   **not exposed at all**. Adding them back means editing a committed file.
2. `.claude/settings.json` denies every purchasing tool by name on both servers,
   so the boundary holds even if the URL is widened. Vercel has no server-side
   filter, so for Vercel this list is the only control.

If something genuinely needs buying, say what and why. The owner does it.

---

## Supabase — `mcp__supabase__*`

Production database, project ref `hjkmldyptkmlalgdwjzs`, region `us-west-2`.

### Use it for

| Task | Tool |
| --- | --- |
| See what tables/columns production actually has | `list_tables` |
| Confirm a `drizzle-kit push` landed | `list_tables`, `list_migrations` |
| Read production data, count rows, spot-check a query | `execute_sql` (SELECT) |
| Database errors, connection failures, slow queries | `get_logs` |
| Security and performance warnings | `get_advisors` |
| Confirm the project URL / publishable key | `get_project_url`, `get_publishable_keys` |
| Look something up in Supabase's own docs | `search_docs` |

Start with `list_tables` before reasoning about structure, and with `get_logs` +
`get_advisors` before reasoning about a failure. Both are cheap.

### Do not use it for

| Tool | Why not |
| --- | --- |
| `apply_migration` | **Denied.** Schema comes from `src/db/schema.ts` via `drizzle-kit push` ([0002](decisions/0002-drizzle-push-no-migrations.md)). A column added here exists in Supabase but not in `schema.ts`, so the next push diffs it, decides it does not belong, and drops it. Silent data loss. |
| `execute_sql` with DDL | Same reason. |
| `execute_sql` writes | For incident recovery only. State the exact statement before running it. Never a routine step. |
| Account, branching, and edge-function tools | **Not exposed** — those groups are switched off in the server URL. Branching also costs money. |

Schema management is not off-limits to agents; it just goes through
`schema.ts` + `drizzle-kit push` (the `schema-change` skill), which needs a
terminal. That laptop requirement is a known, accepted cost — ADR 0006 records
the alternatives if it ever stops being worth it.

### Which connection string

Both live in `.env`, which is gitignored — production config is **not**
recoverable from the repo.

- `DATABASE_URL` — transaction pooler, port 6543, host
  `aws-1-us-west-2.pooler.supabase.com`. What the app uses. What Vercel has.
- `DIRECT_URL` — session pooler, port 5432. Used **only** by `drizzle-kit` from a
  laptop. Vercel does not have it and does not need it.

Three failure modes that have already cost time:

1. New Supabase projects are on the **`aws-1-`** pooler fleet, not `aws-0-`.
   Using `aws-0-` returns `tenant/user postgres.<ref> not found`, which reads
   like a deleted project but only means wrong fleet.
2. Do **not** use the "Direct connection" string (`db.<ref>.supabase.co`) for
   `DIRECT_URL` — it is IPv6-only without a paid add-on and simply hangs.
3. The password must be percent-encoded in the URL (`@` → `%40`).

---

## Vercel — `mcp__vercel__*`

Hosting for `https://bananaplan.vercel.app`. Auto-deploys on push to `main`.

### Use it for

| Task | Tool |
| --- | --- |
| Did the last push deploy, and did it build | `list_deployments`, `get_deployment` |
| Why did the build fail | `get_deployment_build_logs` |
| Users seeing 500s in production | `get_runtime_errors`, then `get_runtime_logs` |
| Project settings and env var names | `get_project` |
| Look something up in Vercel's docs | `search_vercel_documentation` |

When production pages 500 but `/more` still renders, suspect the **database**,
not the code — `/more` is the only route with no database dependency. Go to the
Supabase tools, not the Vercel ones.

### Never

`buy_domain`, `buy_pro`, `buy_credits`, `buy_addon`, `get_purchase_quote`,
`check_domain_availability_and_price`, `get_domain_order` — the whole purchasing
surface spends real money against a payment method on file, with no undo. All
**denied** in [`.claude/settings.json`](../.claude/settings.json). Vercel's MCP
has no server-side feature filter, so this list is the only thing standing
between an agent and a domain purchase; keep it complete when Vercel adds tools.

`deploy_to_vercel` is not the deploy path either. Deployment is `git push` to
`main` — see the `ship` skill. Use the Vercel tools to *verify* what that push
produced.
