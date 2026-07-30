# Runbook

**Something is wrong. Start here.** This page is organised by symptom, not by
system. For what runs on a schedule and why, see
[operations.md](operations.md); for why the architecture is the way it is, see
[decisions/](decisions/).

Every procedure below has been executed at least once, not just written down.
Where a claim has *not* been tested, it says so.

---

## 0. First move, always

```bash
curl -s -o /dev/null -w "/more     %{http_code}\n" https://bananaplan.vercel.app/more
curl -s -o /dev/null -w "/fields   %{http_code}\n" https://bananaplan.vercel.app/fields
```

`/more` is the **only** route with no database dependency. Comparing those two
codes tells you which layer broke, and it is the fastest signal available:

| `/more` | `/fields` | Diagnosis | Go to |
| --- | --- | --- | --- |
| 200 | 500 | **Database** | [§1](#1-the-database-is-down) |
| 500 | 500 | **Vercel or the app** | [§2](#2-the-whole-site-is-down) |
| 200 | 200 | Site is fine — the problem is elsewhere | [§3](#3-the-site-is-fine-but-something-else-is-wrong) |
| 200 | 404 | A route is missing — bad deploy | [§2](#2-the-whole-site-is-down) |

Verified 2026-07-30 against a real outage: with the production schema dropped,
`/more` served 200 while every database-backed route served 500.

---

## 1. The database is down

Most likely causes, in order of probability:

1. **Supabase paused the project** — free tier, after ~7 days of low activity.
   This has happened before and cost a full outage.
2. **Supabase deleted the project** — 90 days after pausing.
3. **Credentials changed** or the connection string is wrong.

### Diagnose

```bash
cd ~/Documents/Projects/BananaPlan
set -a; source .env; set +a
psql "$DIRECT_URL" -tAc "select current_database(), count(*) from sites"
```

- **Connects, has tables, has rows** → not the database after all; go to §2.
- **Connects, no tables** → schema is gone. Restore, §1a.
- **`tenant or user not found`** → check the pooler fleet prefix is `aws-1-`,
  not `aws-0-`. This reads like a deleted project but is the wrong fleet.
- **Hangs** → you are probably using the "Direct connection" string
  (`db.<ref>.supabase.co`), which is IPv6-only. Use the session pooler.
- **Project missing from the dashboard** → it was deleted. Create a new project,
  update `.env` and Vercel's `DATABASE_URL`, then restore, §1a.

Supabase emails a pause warning roughly a week ahead. **That email is the only
early warning for this failure mode** — do not filter it.

### 1a. Restore the database

Full procedure with verification steps:
[operations.md § Restoring](operations.md#restoring--the-actual-procedure).

The one thing to get right — **the commands differ by situation**, and the wrong
choice silently recovers nothing:

- **Database empty or newly created** → restore schema, then data.
- **Database exists with wrong data** → you must `TRUNCATE` first. Running the
  fresh-restore commands here fails on duplicate keys and recovers nothing.

Afterwards, always verify row counts, foreign-key orphans, and load `/fields` in
a browser. Exit code 0 is not proof.

---

## 2. The whole site is down

The database is fine (or irrelevant) and Vercel or the app is failing.

```bash
cd ~/Documents/Projects/BananaPlan
git log --oneline origin/main..main    # unpushed work? see §3c
```

Then check the deployment:

- `mcp__vercel__list_deployments` — is there a recent one, and is it `READY`?
- `mcp__vercel__get_deployment_build_logs` — if the build failed. A build that
  passes locally but fails on Vercel is usually a missing environment variable or
  a case-sensitive import path (macOS is case-insensitive; Vercel's builders are
  not).
- `mcp__vercel__get_runtime_errors` — if the build succeeded but pages throw.

**To roll back:** deploys follow `main`, so revert the commit and push.

```bash
git revert <sha> && git push origin main
```

---

## 3. The site is fine, but something else is wrong

### 3a. No backups appearing

Do not reason from the absence of commits — the job only commits when data
changed, so silence is ambiguous. Check the run history instead:

```bash
gh run list --repo evandenmark/bananaplan-backups --limit 10
```

| What you see | Meaning |
| --- | --- |
| Green runs, no new commits | Normal. Data has not changed. |
| Red runs | Broken. Usually a missing or rotated `DIRECT_URL` secret. |
| No runs at all | Never activated, or GitHub disabled the schedule after 60 days of repository inactivity. Re-enable in the Actions tab. |

```bash
gh run view <run-id> --repo evandenmark/bananaplan-backups --log-failed
```

### 3b. The database paused despite the keepalive

The keepalive stopped and nothing said so — **it has no alarm of its own.**

Check the Vercel dashboard's **Cron Jobs** tab. Nothing reachable over HTTP can
tell you whether a cron is registered; the health check's 401 assertion proves
only that the route is deployed and `CRON_SECRET` is set.

Things that silently stop it: a removed `vercel.json`, an emptied `crons` array,
a renamed route, a deleted deployment. Note the plan registers **one** cron —
extra entries are dropped without an error.

### 3c. A change seems deployed but isn't

**Committing is not deploying.** Vercel deploys on push to `main`.

```bash
git log --oneline origin/main..main   # must be empty
```

This has bitten once: `CRON_SECRET` was set and the project redeployed while
`vercel.json` and the cron route sat in unpushed commits, so the endpoint 404'd
and no cron was ever registered.

### 3d. Suspecting the backups are not restorable

Do not find out during an incident. Run the drill against throwaway local
databases — it never touches production:

```bash
./scripts/disaster-drill.sh
```

See the [`disaster-drill`](../.claude/skills/disaster-drill/SKILL.md) skill for
what each failure means. **A failing drill is production-severity**, not a flaky
test.

---

## 4. How you find out something broke

**The one command that always works**, regardless of any notification setting:

```bash
gh issue list --repo evandenmark/BananaPlan --label outage --state open
```

Empty means healthy. Anything listed is a live problem — the issue closes itself
when a later run passes, so an open one is never stale. Closed ones are a
readable outage history.

| Failure | How you learn | Status |
| --- | --- | --- |
| Site or database down | Health check opens an `outage` issue, within 3 hours | **Verified** — detection, classification, issue creation and auto-close all exercised 2026-07-30 |
| Backup job failing | Not covered — check the Actions tab | Manual |
| Keepalive stopped | Nothing, until Supabase's pause warning ~1 week ahead | Weak, see §3b |
| Database paused | Health check, as "database down" | **Verified** against a real outage |

### Push notification is NOT verified — check this once

Everything above is verified except whether a notification actually reaches you.

On 2026-07-30, a genuinely failed run produced **no notification record at all**,
which is why alerting moved off the workflow-failure email. The issue mechanism
is strictly better because it leaves a record you can pull with the command
above — but the issue is opened by `github-actions[bot]`, and GitHub only pushes
that to you if you watch the repository.

**Confirm it once:** open
[github.com/evandenmark/BananaPlan](https://github.com/evandenmark/BananaPlan),
set **Watch → All Activity**, then fire a test:

```bash
gh workflow run healthcheck.yml --repo evandenmark/BananaPlan -f simulate_failure=true
```

That opens a real outage issue without touching production. If a notification
arrives, alerting is proven end to end; if not, you are relying on the pull check
above and should consider an external uptime service. Run the workflow again
normally afterwards to close the issue.

Do not skip this because the plumbing "looks right". It looked right twice
already and was silent both times.

### Gaps, stated plainly

- **Nothing watches the watcher.** GitHub disables scheduled workflows after 60
  days of repository inactivity, and a disabled monitor is silent, not red.
- **The keepalive has no alarm.** §3b.
- **Detection is up to 3 hours behind**, and the backup job is checked only by
  looking.

If any of these start to matter, an external uptime service (UptimeRobot's free
tier) hitting the same URLs would give push or SMS and would not depend on GitHub
being healthy.

---

## 5. What needs you, not an agent

- Anything requiring a **credential**: `DIRECT_URL`, `CRON_SECRET`, Supabase or
  Vercel dashboard logins.
- **Destructive commands against production.** The permission classifier blocks
  these by default, correctly, and a chat message does not lift it.
- **Spending money.** Every purchasing tool is denied
  ([ADR 0006](decisions/0006-mcp-boundaries.md)). If the fix is Supabase Pro, an
  agent will tell you — it cannot buy it.
