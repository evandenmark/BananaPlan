---
name: ship
description: Commit and deploy BananaPlan to production, then verify the deploy landed. Use when asked to ship, deploy, push to prod, or release changes — and for checking whether the last deploy succeeded or why a build failed.
---

# Ship to production

Production is `https://bananaplan.vercel.app`. **Vercel auto-deploys on push to
`main`.** There is no separate deploy command, and `mcp__vercel__deploy_to_vercel`
is not the path — a `git push` is.

## Pre-flight

### 1. Adversarial review

Unless the change is docs-only, spawn the
[`adversarial-reviewer`](../../agents/adversarial-reviewer.md) subagent against
your diff **before** committing
([ADR 0009](../../../docs/decisions/0009-adversarial-review-before-commit.md)).

Then respond to every finding in your user-visible output: what you fixed, and
what you rejected and why. A finding silently dropped is indistinguishable from
one that was never read. If the review comes back clean, say that too.

Do not treat the reviewer as authoritative — it will occasionally flag
deliberate decisions. Check the ADRs before "fixing" something it objects to.

### 2. Checks

Run all three. Do not skip the build because the tests passed; Next catches
things Vitest does not.

```bash
npm run test:run
```

```bash
npx tsc --noEmit
```

```bash
npm run build
```

All 174 tests must pass and the build must succeed. If anything fails, stop and
fix it — a broken build on `main` means production keeps serving the old
deployment while the repo silently diverges from it.

### 3. Scheduled jobs

If the change touched [`vercel.json`](../../../vercel.json) or
`src/app/api/cron/`, confirm the cron still runs after deploying — see
[docs/operations.md](../../../docs/operations.md). A silently stopped keepalive
does not surface until Supabase's pause warning arrives.

## Schema first

If the change depends on a schema change, **the database must be pushed before
the code deploys**. Code deployed against a schema missing its columns 500s on
every affected page. Run the `schema-change` skill through to its production step
first, then come back.

## Commit and push

Only commit when the user has asked to. Check what is actually staged:

```bash
git status && git diff --stat
```

Never commit `.env` (gitignored — it holds production credentials). Include any
ADR the change produced in the same commit, so `git log` ties decision to code.

```bash
git push origin main
```

**Committing is not deploying.** If the user asked only to commit, say plainly
that the change is not in production and that a push is what deploys it — do not
leave them to infer it. Nothing is live until `origin/main` has it:

```bash
git log --oneline origin/main..main   # must be empty after pushing
```

This has bitten once: `CRON_SECRET` was configured and the project redeployed
while `vercel.json` and the cron route sat in unpushed commits, so the endpoint
404'd and no cron was ever registered.

## Verify — this is the part that gets skipped

A push is not a deploy. Confirm it:

1. `mcp__vercel__list_deployments` — a new deployment should appear within a
   minute or so.
2. `mcp__vercel__get_deployment` — wait for state `READY`.
3. If it failed: `mcp__vercel__get_deployment_build_logs`. A build that succeeds
   locally but fails on Vercel is usually a missing env var or a case-sensitive
   import path (macOS is case-insensitive, Vercel's Linux builders are not).
4. Once `READY`, load a database-backed page — `/fields` or `/forecast`, not
   `/more` — and confirm it renders. `/more` is the only route that renders
   without a working database, so it proves nothing.
5. `mcp__vercel__get_runtime_errors` if anything looks off.

Report what actually happened, including the deployment state and any errors. Do
not report a deploy as done at the moment of `git push`.

## Environment variables

Vercel needs only `DATABASE_URL` (transaction pooler, port 6543), set by hand in
the dashboard. `DIRECT_URL` is local tooling only. If a connection string
changed, update it in the dashboard **and redeploy** — env changes do not apply
to existing deployments.

## Never

Do not use `mcp__vercel__buy_domain`, `buy_pro`, `buy_credits`, or `buy_addon`.
These spend real money with no undo and are denied in
[`.claude/settings.json`](../../settings.json). If a purchase is genuinely
needed, tell the owner what and why
([ADR 0006](../../../docs/decisions/0006-mcp-boundaries.md)).

## If production breaks after a deploy

Check whether it is the code or the database first: if every page 500s but
`/more` renders, it is the database — go to the `db-ops` skill. Otherwise
`mcp__vercel__get_runtime_errors`, and roll back by reverting the commit and
pushing, since deploys follow `main`.
