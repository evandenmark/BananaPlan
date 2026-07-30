---
name: disaster-drill
description: Run and interpret the BananaPlan disaster recovery drill — prove the production backups can actually be restored. Use when asked to test backups, simulate a disaster, verify recovery works, or after changing anything about the backup workflow, the dump format, or the database schema.
---

# Disaster recovery drill

```bash
./scripts/disaster-drill.sh
```

Exits 0 only if every check passes. Takes about a minute.

## Why this exists

**A dump is not a backup until a restore has been run.** This is not a slogan;
it is the recorded experience of this repo. Twice, backups passed every static
check — right tables, right row counts, `setval` present, plausible file size —
and were still unrestorable:

- A Postgres 17 `SET transaction_timeout` line aborted `psql` against the
  Postgres 16 that local development runs.
- A `CREATE SCHEMA public` line aborted the restore on **any** fresh database,
  including a new Supabase project — so the real recovery path was broken, not
  just local testing.

Neither was visible by inspection. Both were found in seconds by attempting an
actual restore. See
[ADR 0011](../../../docs/decisions/0011-automated-production-backups.md).

## What it does

Clones the real backups from the private
[`bananaplan-backups`](https://github.com/evandenmark/bananaplan-backups) repo
and exercises four scenarios against throwaway local databases:

| # | Scenario | Why it matters |
| --- | --- | --- |
| 1 | Fresh restore into an empty database | Project deleted — the July 2026 outage |
| 2 | Data lost, database survives | **The likely disaster**, and the one whose commands differ |
| 3 | Schema damaged | Wipe `public` and restore everything |
| 4 | Point-in-time from git history | Recovering a day that is not the latest |

Scenario 2 also asserts that the *naive* restore correctly **fails**. That is
deliberate: the runbook claims the fresh-restore commands recover nothing against
a surviving database, and a claim in a runbook that nobody tests is how people end
up following a procedure mid-incident that quietly does nothing.

Beyond row counts it checks sequences resume past existing ids, foreign keys have
no orphans, and the joins the forecast depends on still resolve.

## Safety

The script cannot touch production or your working database:

- It `unset`s `DATABASE_URL` and `DIRECT_URL` before doing anything, so it has no
  path to Supabase.
- Every database it creates or drops must be named `drill_*`; `drill_db()`
  refuses any other name rather than trusting the caller.
- A cleanup trap drops all `drill_*` databases on exit, including on failure.

It is read-only with respect to the backup repo — point-in-time uses
`git checkout <sha> -- dumps/` and restores the working tree afterwards.

## When to run it

- **After changing the backup workflow, the dump flags, or the dump format.** This
  is the highest-value moment; both historical breakages were introduced exactly
  here.
- **After a schema change** that adds or removes a table — the drill's table count
  and truncate list are specific.
- **Periodically**, so the "last verified" date in
  [docs/operations.md](../../../docs/operations.md) does not go stale. Quarterly
  is plenty for a farm app.
- **Before relying on a restore for real.** If production is already down, run
  the drill first against a scratch database rather than discovering a broken
  dump while the site is off.

## Interpreting failures

| Failure | Meaning |
| --- | --- |
| `backup dumps are missing or empty` | The backup job has never succeeded. Check `DIRECT_URL` is set in the backup repo's secrets and look at its Actions tab. |
| `schema restore failed` / `data restore failed` (scenario 1) | The dumps are not restorable at all. Run the command by hand without `>/dev/null` to see the psql error. Most likely a preamble line — see ADR 0011. |
| `restored database is EMPTY` | The dump has schema but no rows. The backup ran against an empty or wrong database. |
| `sequence collision risk` | `setval` calls are missing from the data dump. Restores would start ids at 1 and the first insert would collide with restored rows. Check the `--column-inserts` dump flags. |
| `orphaned foreign-key rows` | The dump is internally inconsistent — likely captured mid-write. Investigate before trusting any backup from that period. |
| `no plantings join through to a site and variety` | Data restored but the forecast would render empty. A partial restore. |
| `naive data reload unexpectedly SUCCEEDED` | Good news that needs a docs change: the runbook says it should fail. Something about the dump changed; re-check the restore instructions in `docs/operations.md` before trusting them. |
| `recovered state does not match baseline` | Recovery is lossy. Compare the two count tuples in the output to see which table is short. |
| `earlier backup could not be restored by either path` | Point-in-time recovery is broken. Older dumps may predate a fix; check whether the preamble workaround still matches what those dumps contain. |

**A failing drill means you do not currently have working backups.** Treat it as
production-severity, not as a flaky test.

## Drilling against real production

The script never touches production, by design. A production drill has been run
once, by hand, on 2026-07-30 — schema dropped and restored, about four minutes of
downtime — and it validated the parts the local drill cannot: that the site fails
in the predicted shape, and that the health check detects and correctly names the
cause.

If asked to do it again:

1. **Take a fresh backup first and verify it has rows**, even though a recent one
   exists. Trigger the workflow, wait for green, and count the `INSERT` lines.
2. Record the pre-disaster baseline counts. You cannot prove recovery without
   knowing what you started with.
3. Confirm the site is healthy first, so a pre-existing failure is not mistaken
   for one you caused.
4. Then break it, observe, restore, and compare against the baseline.
5. Verify sequences via `pg_sequences` rather than by inserting a test row —
   production should not gain junk rows from a drill.

**Get explicit confirmation from the owner before the destructive step**, every
time. Destructive commands against production are also blocked by the permission
classifier by default, which is correct; a chat message does not lift that, so
the owner either grants the permission or runs that one command themselves.

Do not do this on a whim. It is worth roughly annually, or after changing the
restore procedure — the local drill covers the routine case.

## Extending it

When you add a table, update two places in the script: the `counts()` function
and the `TRUNCATE` list in scenario 2. The table-count assertion (`= "8"`) also
needs bumping. If you add a scenario, follow the existing shape — do the thing,
then assert on observable state, and use `ok`/`bad` so the summary count stays
accurate.

Keep every assertion about *outcomes* rather than exit codes where possible. Both
historical failures produced a zero exit somewhere in the pipeline while
recovering nothing.
