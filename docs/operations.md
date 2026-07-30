# Operations

Everything that runs on a schedule, where it runs, and what to do when it stops.

**Nothing here depends on a laptop being awake.** That is deliberate: the July
2026 outage happened during a five-month gap in work, which is exactly when a
locally scheduled job would also have been off.

## In one page

Three jobs, three different jobs to do. They are on two different providers on
purpose, so no single outage takes out both the thing and its monitor.

| | Keeps it **alive** | Tells you it **broke** | Gets it **back** |
| --- | --- | --- | --- |
| Job | Keepalive cron | Health check | Backup |
| Runs on | Vercel | GitHub Actions | GitHub Actions |
| How often | daily, 14:00 UTC | every 3 hours | daily, 11:00 UTC |
| Guards against | Supabase's 7-day inactivity pause | site or database down, silently | data loss |
| You find out via | nothing — silent by design | failure email from GitHub | — |

Read that middle column carefully: **the keepalive has no alarm of its own.** If
it stops firing, nothing says so — the first signal is Supabase's pause-warning
email, roughly a week before the project pauses. Do not filter that email. The
health check covers the *consequence* (a paused database makes `/fields` fail),
not the *cause*, and nothing reachable over HTTP can tell you whether a Vercel
cron is still registered — only the dashboard's Cron Jobs tab shows that.

The single most useful habit: if `/more` renders but other pages 500, it is the
database, not the code.

## ⚠️ Activation checklist — both jobs need one manual step

Neither job is fully live until these are done. They involve credentials, so the
owner must do them; an agent cannot.

- [x] **Backup — done 2026-07-28.** `DIRECT_URL` is set as a repository secret
      and the workflow has run successfully; `dumps/` holds a real dump of all
      eight tables.
- [x] **Keepalive — done 2026-07-28.** `CRON_SECRET` is set in Vercel and the
      deployment is live; `/api/cron/keepalive` returns 401 without a token,
      which is how you confirm it. (To reset it: `openssl rand -hex 32`, set it
      in Vercel's environment variables at Production scope, then **redeploy** —
      environment changes do not apply to existing deployments.)

`CRON_SECRET` is a value you invent, not one you look up. Vercel sends it
automatically as `Authorization: Bearer <value>` on cron invocations, and the
endpoint checks it.

## The scheduled jobs

| Job | Runs on | Schedule | Defined in |
| --- | --- | --- | --- |
| Database keepalive | Vercel Cron | daily, 14:00 UTC (04:00 HST) | [`vercel.json`](../vercel.json) → [`/api/cron/keepalive`](../src/app/api/cron/keepalive/route.ts) |
| Production backup | GitHub Actions | daily, 11:00 UTC (01:00 HST) | [`bananaplan-backups`](https://github.com/evandenmark/bananaplan-backups) (private) |
| Health check | GitHub Actions | every 3 hours | [`.github/workflows/healthcheck.yml`](../.github/workflows/healthcheck.yml) |

They are offset by three hours on purpose, and they run on different services, so
each is a partial backstop for the other — the backup job's daily connection is
itself database activity, and the keepalive does not depend on GitHub.

### Why two different services

Vercel runs the keepalive because it has no inactivity rule: the cron fires as
long as the deployment exists, including through months of nobody touching the
project. GitHub Actions runs the backup because it has `pg_dump` and free
storage, but it **disables scheduled workflows after 60 days of repository
inactivity** — which makes it the wrong home for the job whose entire purpose is
surviving long quiet periods.

## Database keepalive

Supabase pauses Free plan projects with low activity over a **7-day** window, and
deletes them 90 days after pausing. Their guidance is "a few user requests to the
database each day," so this runs **daily** — a 72-hour interval would leave four
days of a 7-day window with no activity.

The endpoint runs three `count(*)` reads — `sites`, `varieties`,
`field_inventory` — one at a time, so each is its own round trip. Queries are
activity; there is no heartbeat table and there should not be one. See
[ADR 0010](decisions/0010-database-keepalive.md).

The plan allows only one cron (see below), so this single daily run has to be
sufficient **on its own**. That is why the endpoint does three reads per
invocation rather than one.

The backup job and the health check also touch the database daily, and in
practice that is most of the activity. **Do not let that become the plan.** Both
run on GitHub Actions, which disables scheduled workflows after 60 days of
repository inactivity — and a long quiet stretch is exactly when the keepalive
matters, so the two jobs most likely to be switched off are the ones that would
be covering for it. The Vercel cron is the only keepalive that survives that
scenario, which is the whole reason
[ADR 0010](decisions/0010-database-keepalive.md) put it on Vercel. Treat the
others as a bonus, never as the mechanism.

### Do not add sleeps to spread the reads out

Tempting, and wrong. Vercel bills wall-clock execution, so a sleeping function
burns quota doing nothing — and sleeping past `maxDuration` kills the invocation,
turning a healthy ping into a **failed** cron run.

It also does not help. Supabase's heuristic is measured per day over a 7-day
window, so reads a minute apart look identical to a single read.

Spacing would come from more invocations at different hours — but this plan
registers only one cron (see below), so that lever is not available on Vercel.
The answer is more reads per invocation, which is what the endpoint does. Do not
make one invocation last longer.

### How it actually triggers

Nothing in the app starts it, and setting `CRON_SECRET` does not start it either.
Vercel reads the `crons` array in [`vercel.json`](../vercel.json) **at deploy
time**, registers the schedule, and its own scheduler then makes a plain HTTP
`GET` to that path — the same as any outside visitor, except it attaches
`Authorization: Bearer $CRON_SECRET`.

Three consequences worth internalising:

- The cron exists only once a **deployment containing `vercel.json`** is live. No
  deploy, no cron — and a redeploy of unpushed code registers nothing.
- Crons run on **production** deployments only, never previews.
- Confirm it in the Vercel dashboard under the project's **Cron Jobs** tab. If
  that tab is empty, the deployment being served has no `vercel.json`.

**One cron is all this plan gets.** Two entries were configured on 2026-07-28 —
02:00 and 14:00 UTC — and only the 14:00 one appeared in the dashboard. Vercel's
docs do not state the cap, but the dashboard is the authority: whatever it lists
is what will actually fire. Do not assume an added entry works because the deploy
succeeded; extra entries are dropped silently, not rejected.

This is why the endpoint does several reads per invocation, and why the health
check below matters more than it first appears — it queries the database every
3 hours and so carries most of the daily-activity load.

**Setup:** set `CRON_SECRET` in Vercel's environment variables to any random
string. Vercel sends it automatically as a bearer token, and the endpoint
enforces it when present. Without it the endpoint still works but is publicly
callable.

**Checking it:** Vercel dashboard → project → Cron Jobs shows run history. Or
call it directly — it returns the planting count and a timestamp:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" https://bananaplan.vercel.app/api/cron/keepalive
```

(The header is required once `CRON_SECRET` is set; without it the call returns
401, which means the protection is working, not that the cron is broken.)

A failed ping returns 500, so it shows as a failed run rather than silently
succeeding while the database is unreachable.

## Production backup

Daily `pg_dump` of production, committed to the private
[`bananaplan-backups`](https://github.com/evandenmark/bananaplan-backups) repo.
Both data and schema are dumped, the job refuses to commit a dump that is empty
or missing tables, and **git history is the retention** — every day the job ran
is a recoverable commit.

**Setup:** add `DIRECT_URL` (session pooler, port 5432) as a repository secret in
the backup repo, then trigger the workflow by hand from the Actions tab to
confirm it works rather than waiting a day to find out.

### Restoring — the actual procedure

**Last verified: 2026-07-29** — 17 checks, 0 failures.

Re-verify by running the drill, which does all of this automatically against
throwaway local databases in about a minute:

```bash
./scripts/disaster-drill.sh
```

It cannot touch production or your working database, and it exits non-zero if any
check fails. Update the date above when you run it. See the
[`disaster-drill`](../.claude/skills/disaster-drill/SKILL.md) skill for what each
failure means and when to run it.

**A failing drill means you do not currently have working backups** — that is
production-severity, not a flaky test. A restore that has never been run is a
hypothesis, not a backup.

#### First: which situation are you in?

The two cases need **different commands**, and using the wrong one silently
recovers nothing.

| Situation | Use |
| --- | --- |
| Project deleted or database empty | **A — fresh restore** below |
| Database still exists, data wrong or missing | **B — wipe first**, below |

Case B is the more likely disaster and the one that traps people. Running the
fresh-restore commands against a surviving database **does not work**: the schema
dump aborts on `type "frequency" already exists`, and the data dump aborts on
`duplicate key value violates unique constraint "sites_pkey"`. Verified — both
exit non-zero and nothing is recovered. You must clear the existing data first.

#### B — database survives, data must be replaced

Least destructive: truncate the app tables and reload data only. The schema is
already correct, so no DDL is involved.

```bash
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -c "
TRUNCATE bunch_harvests, weight_harvests, field_inventory,
         orders, clients, fields, varieties, sites RESTART IDENTITY CASCADE;"
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f bananaplan-backups/dumps/production-data.sql
```

If the **schema** is also damaged, wipe and do a full restore instead — this
works on Supabase:

```bash
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

then continue with case A below. Both paths were verified to recover full row
counts with sequences landing past existing ids.

#### A — fresh restore into an empty database

Two commands, schema then data:

```bash
gh repo clone evandenmark/bananaplan-backups
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f bananaplan-backups/dumps/production-schema.sql
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f bananaplan-backups/dumps/production-data.sql
```

#### Verify, whichever path you took

Do not assume exit 0 means the data arrived:

```bash
psql "$DIRECT_URL" -tAc "select 'sites='||(select count(*) from sites)
  ||' fields='||(select count(*) from fields)
  ||' varieties='||(select count(*) from varieties)
  ||' plantings='||(select count(*) from field_inventory)
  ||' bunch='||(select count(*) from bunch_harvests)
  ||' weight='||(select count(*) from weight_harvests)"
```

Check foreign keys survived, since a partial restore can leave orphans that only
surface as a broken forecast:

```bash
psql "$DIRECT_URL" -tAc "select
  (select count(*) from field_inventory fi left join fields f on f.id=fi.field_id where f.id is null) +
  (select count(*) from bunch_harvests b left join fields f on f.id=b.field_id where f.id is null) +
  (select count(*) from fields f left join sites s on s.id=f.site_id where s.id is null)"
```

Zero is the only acceptable answer.

Finally, **check through `DATABASE_URL`** (transaction pooler, 6543) rather than
`DIRECT_URL` — that is the path production actually uses, and the two poolers
fail independently. Loading `/fields` in a browser is the honest end-to-end test.

#### Restoring an earlier day

Git history is the retention, so any day the job ran is recoverable:

```bash
cd bananaplan-backups
git log --oneline --date=format:"%Y-%m-%d %H:%M" --format="%h %ad %s" -- dumps/
git checkout <sha> -- dumps/
```

Then restore as above, and `git checkout main -- dumps/` afterwards to put the
working tree back. Verified against a real earlier commit.

**If the schema dump is unavailable**, `npx drizzle-kit push --force` recreates
structure from `src/db/schema.ts` instead, then load the data dump on top.

**If you hit `ERROR: unrecognized configuration parameter "transaction_timeout"`
or `schema "public" already exists`**, you are restoring a dump from before
2026-07-29. Those two preamble lines abort the restore under `ON_ERROR_STOP`;
strip them and retry:

```bash
grep -vE '^SET transaction_timeout|^CREATE SCHEMA public;$' old-dump.sql \
  | psql "$DIRECT_URL" -v ON_ERROR_STOP=1
```

Newer dumps have them stripped at dump time, and the backup job now fails if they
reappear.

**Do not refresh `seed-data.sql` from production.** That instruction came from
[ADR 0007](decisions/0007-seed-data-as-backup.md) and is withdrawn: the app repo
is **public**, so a refresh after any client exists would publish their name.
`seed-data.sql` is now only a small fixture for seeding a local database.

## What this costs

The target is zero, and both jobs are built for it.

**Vercel crons are not a billable product.** There is no per-cron charge; a cron
invocation is an ordinary function invocation and draws on the same included
allowance as any page request. One per day is ~30 invocations a month, each a few
`count(*)` queries lasting milliseconds — far less than one person browsing the
app for a minute. This is why the no-sleep rule matters: billing is by wall-clock
execution, so a sleeping function is the one way to make a trivial job cost
something.

**GitHub Actions** is free for public repos. The backup repo is private, which
draws on the Free plan's monthly minutes; a daily run of a minute or two is a
small fraction of it. Check Settings → Billing if in doubt.

Two things that would actually cost money, neither currently in play:

- **Supabase Pro** (~$25/mo) removes project pausing and adds real backups. The
  keepalive cron exists to avoid needing it.
- **Vercel Pro** (~$20/mo). Hobby is intended for non-commercial use — worth
  knowing, since this app runs a working farm's operations. Not a decision to
  make on Vercel's behalf, but do not be surprised by it.

Exact allowances change, so do not trust numbers written here over the source:
`vercel usage`, or the dashboard's Usage tab.

## Health check

Runs on GitHub Actions, in this repo, every 3 hours —
[`.github/workflows/healthcheck.yml`](../.github/workflows/healthcheck.yml).

**It runs on GitHub and not on Vercel on purpose.** A monitor hosted on the thing
it monitors cannot report that thing being down; it simply stops running, and
silence is indistinguishable from health. The keepalive cron has exactly this
blind spot, which is what this check covers.

It probes three URLs and, crucially, **interprets the combination** rather than
just reporting codes:

| `/more` | `/fields` | Means |
| --- | --- | --- |
| fail | fail | Vercel or the app — `/more` needs no database |
| ok | fail | **The database.** Supabase paused, deleted, or bad credentials |
| fail | ok | App or routing; the database is clearly fine |

That is the same diagnostic this page tells a human to run by hand, encoded so the
failure email already says which layer broke.

It also checks `/api/cron/keepalive` returns **401**, which catches two silent
regressions the other jobs cannot: a **404** means the live deployment has no
`vercel.json`, so no keepalive cron is registered and the database will
eventually pause; a **200** means `CRON_SECRET` was dropped from Vercel and the
endpoint is publicly callable.

**Alerting** is GitHub's built-in "workflow failed" email to the repo owner — no
new service, no account, nothing to pay for. Every probe retries three times with
backoff first, so one transient blip does not send mail. That restraint is the
point: a check that cries wolf gets filtered, and then the real outage goes
unread.

**Cost is zero.** This repo is public, and public repos get unlimited free Actions
minutes. It also needs no secrets, since it only fetches public URLs — which is
why it lives here rather than in the private backup repo.

If you ever want SMS or push instead of email, an external uptime service
(UptimeRobot's free tier, Better Stack) hitting the same URLs would do it. That
is a new account to manage, which is the only reason it is not the default here.

## Driving the jobs from the CLI

`gh` is authenticated and does everything needed for both repos — there is no
GitHub MCP server configured, and none is needed.

```bash
gh run list   --repo evandenmark/bananaplan-backups --limit 5
gh workflow run backup.yml --repo evandenmark/bananaplan-backups   # trigger now
gh run view <run-id> --repo evandenmark/bananaplan-backups --log-failed
gh secret list --repo evandenmark/bananaplan-backups               # names only
```

After changing the workflow, **trigger a run and read the result.** Three of the
first four runs failed for reasons no amount of reading the YAML would have
caught; see below.

### Backup failures already seen, and their fixes

Both are guarded in the workflow now. They are recorded because the symptoms are
misleading, not because they are likely to recur.

**`pg_dump: aborting because of server version mismatch`.** Supabase runs
Postgres 17.6 and the GitHub runner ships `pg_dump` 16, which refuses to dump a
newer server. Installing `postgresql-client-17` is **not sufficient** —
`/usr/bin/pg_dump` is Debian's `pg_wrapper`, which keeps selecting the
preinstalled 16. `/usr/lib/postgresql/17/bin` has to go on `PATH` via
`GITHUB_PATH`, which applies to *subsequent* steps, so the version check is its
own step.

**A dump that succeeds but cannot be restored.** Without `-n public`, `pg_dump`
also captures Supabase's managed schemas — `auth`, `storage`, `realtime`,
`vault`, `pgbouncer`, `graphql` — and their internal migration bookkeeping.
Restoring that into a fresh project fights the platform's own provisioning. The
workflow now fails if any managed schema reappears.

To check a dump by hand, look at **which schemas it contains**, not how big it
is. The data dump grows with real farm records, so size tells you nothing:

```bash
grep -oE "CREATE TABLE [a-z_]+\." dumps/production-schema.sql | sort -u
grep -oE "INSERT INTO [a-z_]+\."  dumps/production-data.sql   | sort -u
```

Both should print `public.` and nothing else. A healthy dump also contains
`setval` calls, so sequences restore and later inserts do not collide:

```bash
grep -c setval dumps/production-data.sql   # one per table with a serial id
```

## Committed is not deployed

Vercel deploys on **push to `main`**, not on commit. Local commits change
nothing in production, and a redeploy of an unpushed branch redeploys the old
code — which looks exactly like a broken feature.

Before concluding that something deployed is broken, check:

```bash
git log --oneline origin/main..main   # must be empty
```

This has bitten once already: `CRON_SECRET` was set and the project redeployed
while `vercel.json` and the keepalive route were still sitting in unpushed
commits, so `/api/cron/keepalive` returned 404 and no cron was ever registered.

## What to check when production is broken

1. **Does `/more` render while everything else 500s?** Then it is the database,
   not the code — `/more` is the only route with no database dependency.
2. `mcp__supabase__get_logs` and `mcp__supabase__get_advisors`.
3. `mcp__supabase__list_tables` — if the project answers but has no tables, the
   structure is gone; restore per the `db-ops` skill.
4. If the project does not answer at all, check the pooler fleet prefix
   (`aws-1-`, not `aws-0-`) before concluding it was deleted.
5. `mcp__vercel__get_runtime_errors` for what the app actually threw.

## What to check when a scheduled job is broken

**The database paused anyway.** The keepalive stopped. Check Vercel's Cron Jobs
history: a deleted deployment, a renamed route, or a removed `vercel.json` all
silently stop it. Supabase emails a warning roughly a week before pausing — that
email is the real alarm, so do not filter it.

**No new backup commits.** Do not reason from the absence of commits — the job
commits only when data changed, so silence is ambiguous. Check the **Actions tab
run history** instead, which distinguishes the three cases: green runs with no
commit (normal, quiet period), red runs (broken — usually a missing or rotated
`DIRECT_URL`), or no runs at all (never activated, or the workflow was disabled
after 60 days of repo inactivity; GitHub emails before disabling).

Both jobs failing at once is the dangerous case, because the second failure is
invisible while the first is masking it. If you have not seen a backup commit in
a week, check both.
