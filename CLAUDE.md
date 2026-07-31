# BananaPlan — agent entrypoint

Banana farm operations and harvest forecasting. Read
[docs/constitution.md](docs/constitution.md) before making product decisions.

This file is a router, not a manual. Keep it short — details belong in the
documents it points to.

## Where things are documented

| You need to know | Read |
| --- | --- |
| What the app is for, who uses it, what must stay true | [docs/constitution.md](docs/constitution.md) |
| Why the code is the way it is | [docs/decisions/](docs/decisions/) |
| The domain vocabulary (mat, bunch, cycle, success rate) | [docs/glossary.md](docs/glossary.md) |
| Which MCP server to use, and what not to touch | [docs/mcp.md](docs/mcp.md) |
| **Something is broken right now** | [docs/runbook.md](docs/runbook.md) |
| What runs on a schedule, and what it costs | [docs/operations.md](docs/operations.md) |
| How to perform a specific kind of change | `.claude/skills/` — see below |

## Skills

Invoke these rather than improvising; each encodes a sequence that is easy to get
half-right.

| Skill | Use when |
| --- | --- |
| `schema-change` | Adding/changing a table or column in `src/db/schema.ts` |
| `crud-entity` | Adding a new managed entity (list + new + edit pages, actions, tests) |
| `forecast-change` | Touching `src/lib/forecast.ts` or anything that changes projected harvests |
| `db-ops` | Inspecting, seeding, or restoring the local or production database |
| `disaster-drill` | Proving the backups can actually be restored (`./scripts/disaster-drill.sh`) |
| `ship` | Committing and deploying to production, and verifying the deploy |
| `log-decision` | A non-obvious choice was made and should be recorded as an ADR |

## The short version of the stack

Next.js 16 App Router · TypeScript · Tailwind v4 · Drizzle ORM over `pg` ·
Postgres (local Homebrew for dev, Supabase for production) · Vitest.

- **All data fetching happens in Server Components.** No API routes, no client fetching.
- **All mutations are Server Actions** in `src/app/actions/`, one file per entity.
- **Client Components are the exception**, used only for real interactivity
  (`src/app/harvest/harvest-form.tsx`, `src/app/forecast/forecast-chart.tsx`).
- **Schema changes ship via `drizzle-kit push`.** There are no migration files.

See [ADR 0001](docs/decisions/0001-server-actions-and-server-components.md) and
[ADR 0002](docs/decisions/0002-drizzle-push-no-migrations.md) for why.

## Standing rules for agents

1. **Get an adversarial review before you commit.** For any change that touches
   `src/`, changes behavior, or changes infrastructure, spawn the
   [`adversarial-reviewer`](.claude/agents/adversarial-reviewer.md) subagent
   against your diff, then say in your output what you fixed and what you
   rejected and why. Docs-only and typo changes are exempt. See
   [ADR 0009](docs/decisions/0009-adversarial-review-before-commit.md).
2. **Run `npm run test:run` before you claim a change works.** The suite is
   fast (~2s); every test must pass, and the count only goes up.
3. **Never write dates as `new Date("YYYY-MM-DD")` in tests.** That parses as UTC
   and lands on the previous day in Hawaii (UTC-10). Use
   `new Date(year, monthIndex, day)`.
4. **Never edit the production database to change schema.** Schema flows one way:
   `src/db/schema.ts` → `drizzle-kit push`. See [docs/mcp.md](docs/mcp.md).
5. **Never `cp -r` `node_modules`.** It converts `.bin/` symlinks into real files
   and breaks the `next` binary. Run `npm install` instead.
6. **Never refresh `seed-data.sql` from production.** This repo is **public**;
   production data includes client names. Backups go to the private
   [`bananaplan-backups`](https://github.com/evandenmark/bananaplan-backups)
   repo automatically ([ADR 0011](docs/decisions/0011-automated-production-backups.md)).
7. **Log the decision, not just the code.** If you chose between real
   alternatives, run the `log-decision` skill before finishing.
