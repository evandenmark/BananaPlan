# BananaPlan

Operations and harvest forecasting for a working banana farm. Track what is
planted where, record what was picked, and project what will be ready and when.

Production: https://bananaplan.vercel.app

## Running it

```bash
brew services list | grep postgresql   # Postgres must be running
npm install
npm run dev
```

Needs `DATABASE_URL` in `.env` pointing at a local `bananaplan` database.

| Command | |
| --- | --- |
| `npm run dev` | dev server |
| `npm run test:run` | tests once (168 tests, ~2s) |
| `npm test` | tests in watch mode |
| `npm run build` | production build |
| `npx drizzle-kit push` | apply `src/db/schema.ts` to the database |

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Drizzle ORM over `pg` ·
Postgres (local for dev, Supabase for production) · Vitest · deployed on Vercel.

Reads happen in Server Components, writes in Server Actions. No API routes.

## Documentation

Written for AI agents, useful to humans.

- **[CLAUDE.md](CLAUDE.md)** — entrypoint: where everything is, and the standing
  rules
- **[docs/constitution.md](docs/constitution.md)** — what the app is, who it
  serves, and the invariants that must hold
- **[docs/decisions/](docs/decisions/)** — why the code is the way it is (ADRs)
- **[docs/glossary.md](docs/glossary.md)** — mats, bunches, cycles, success rates
- **[docs/mcp.md](docs/mcp.md)** — which MCP tools to use, and which never to
- **[.claude/skills/](.claude/skills/)** — procedures for the recurring kinds of
  change

## Layout

```
src/db/schema.ts        source of truth for the database
src/lib/forecast.ts     the forecasting math
src/app/actions/        server actions, one file per entity
src/app/<entity>/       list / new / [id]/edit pages
src/components/nav.tsx  bottom navigation
seed-data.sql           committed data snapshot; also the backup
```
