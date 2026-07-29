# MCP servers: what to use, and what not to touch

Two servers are configured in [`.mcp.json`](../.mcp.json). The rationale for
these boundaries is [ADR 0006](decisions/0006-mcp-boundaries.md); this page is
the routing table.

**The rule in one line:** MCP is for looking at production, not for changing it.

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
| `apply_migration` | Schema comes from `src/db/schema.ts` via `drizzle-kit push` ([0002](decisions/0002-drizzle-push-no-migrations.md)). A migration applied here creates a second source of truth that the next push will silently revert. |
| `execute_sql` with DDL or writes | Same reason for DDL. For a data fix during an incident: state the exact statement first, then run it. Never as a routine step. |
| `create_branch` / `merge_branch` / `rebase_branch` / `reset_branch` / `delete_branch` | The project does not use database branching. Denied in `.claude/settings.json`. |
| `deploy_edge_function` | There are no edge functions. Server Actions cover mutations ([0001](decisions/0001-server-actions-and-server-components.md)). |

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

`buy_domain`, `buy_pro`, `buy_credits`, `buy_addon` — these spend real money
against a payment method on file and have no undo. They are **denied** in
[`.claude/settings.json`](../.claude/settings.json). If a purchase is genuinely
needed, tell the owner what and why; they do it themselves.

`deploy_to_vercel` is not the deploy path either. Deployment is `git push` to
`main` — see the `ship` skill. Use the Vercel tools to *verify* what that push
produced.
