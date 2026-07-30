#!/usr/bin/env bash
#
# Disaster recovery drill for BananaPlan.
#
# Restores the real production backups into throwaway local databases and proves
# they actually work — not that they look right. Both times this repo checked
# backups by inspection alone, the dumps passed every static check and were still
# unrestorable. Only running a restore found it.
#
#   ./scripts/disaster-drill.sh
#
# Exits 0 only if every scenario passes. Safe to run any time; see the SAFETY
# section below for why it cannot touch production or your working database.
#
# Documented in .claude/skills/disaster-drill/SKILL.md

set -uo pipefail

# ── SAFETY ───────────────────────────────────────────────────────────────────
# This script only ever creates and drops databases named drill_*, on the local
# socket, and it never reads DATABASE_URL or DIRECT_URL. It cannot reach
# Supabase, and it cannot touch the working `bananaplan` database. The prefix is
# asserted before every destructive call rather than merely intended.
DRILL_PREFIX="drill_"
unset DATABASE_URL DIRECT_URL PGDATABASE

BACKUP_REPO="evandenmark/bananaplan-backups"
WORKDIR=$(mktemp -d "${TMPDIR:-/tmp}/bananaplan-drill.XXXXXX")
PASS=0
FAIL=0

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
bold()  { printf '\033[1m%s\033[0m\n' "$*"; }

ok()   { green "  PASS  $*"; PASS=$((PASS + 1)); }
bad()  { red   "  FAIL  $*"; FAIL=$((FAIL + 1)); }

# Refuses any database name outside the drill namespace.
drill_db() {
  local name="$1"
  case "$name" in
    "$DRILL_PREFIX"*) ;;
    *) red "REFUSING to operate on '$name' — drill databases must start with '$DRILL_PREFIX'"; exit 2 ;;
  esac
  dropdb --if-exists "$name" >/dev/null 2>&1
  createdb "$name"
}

cleanup() {
  for db in $(psql -ltA 2>/dev/null | cut -d'|' -f1 | grep "^${DRILL_PREFIX}" || true); do
    dropdb --if-exists "$db" >/dev/null 2>&1
  done
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

counts() {
  psql "$1" -tAc "select
       (select count(*) from sites)||','||(select count(*) from fields)
    ||','||(select count(*) from varieties)||','||(select count(*) from field_inventory)
    ||','||(select count(*) from bunch_harvests)||','||(select count(*) from weight_harvests)
    ||','||(select count(*) from clients)||','||(select count(*) from orders)" 2>/dev/null | tr -d ' '
}

# ── Preflight ────────────────────────────────────────────────────────────────
bold "BananaPlan disaster recovery drill"
echo

for cmd in psql createdb dropdb git gh; do
  command -v "$cmd" >/dev/null || { red "missing required command: $cmd"; exit 2; }
done
psql -ltA >/dev/null 2>&1 || {
  red "cannot reach local Postgres — try: brew services start postgresql@16"
  exit 2
}

echo "Fetching the real backups from $BACKUP_REPO ..."
gh repo clone "$BACKUP_REPO" "$WORKDIR/backups" -- -q 2>/dev/null || {
  red "could not clone $BACKUP_REPO — check \`gh auth status\`"
  exit 2
}
DUMPS="$WORKDIR/backups/dumps"
SCHEMA="$DUMPS/production-schema.sql"
DATA="$DUMPS/production-data.sql"

[ -s "$SCHEMA" ] && [ -s "$DATA" ] || {
  red "backup dumps are missing or empty — the backup job has never succeeded"
  exit 1
}
echo "Backup under test: $(cd "$WORKDIR/backups" && git log -1 --format='%h %ad %s' --date=format:'%Y-%m-%d %H:%M' -- dumps/)"
echo

# ── Scenario 1: project deleted / empty database ─────────────────────────────
bold "1. Fresh restore (project deleted, empty database)"
drill_db "${DRILL_PREFIX}fresh"
psql "${DRILL_PREFIX}fresh" -v ON_ERROR_STOP=1 -q -f "$SCHEMA" >/dev/null 2>&1 \
  && ok "schema restored" || bad "schema restore failed"
psql "${DRILL_PREFIX}fresh" -v ON_ERROR_STOP=1 -q -f "$DATA" >/dev/null 2>&1 \
  && ok "data restored" || bad "data restore failed"

TABLES=$(psql "${DRILL_PREFIX}fresh" -tAc \
  "select count(*) from information_schema.tables where table_schema='public'" 2>/dev/null | tr -d ' ')
[ "$TABLES" = "8" ] && ok "all 8 tables present" || bad "expected 8 tables, got '$TABLES'"

BASELINE=$(counts "${DRILL_PREFIX}fresh")
echo "        baseline counts (sites,fields,varieties,plantings,bunch,weight,clients,orders): $BASELINE"
case "$BASELINE" in
  ""|*,,*) bad "could not read row counts" ;;
  0,0,0,0,0,0,0,0) bad "restored database is EMPTY — the dump has no data" ;;
  *) ok "data present in restored database" ;;
esac

# Sequences must resume past existing ids, or the first insert collides.
# head -1: psql prints the INSERT command tag after the returned row.
NEWID=$(psql "${DRILL_PREFIX}fresh" -tAc \
  "insert into sites (name) values ('drill') returning id" 2>/dev/null | head -1 | tr -d ' ')
MAXID=$(psql "${DRILL_PREFIX}fresh" -tAc \
  "select coalesce(max(id),0) from sites where name <> 'drill'" 2>/dev/null | tr -d ' ')
if [ -n "$NEWID" ] && [ -n "$MAXID" ] && [ "$NEWID" -gt "$MAXID" ]; then
  ok "sequences resume past existing ids ($NEWID > $MAXID)"
else
  bad "sequence collision risk — new id '$NEWID' vs max '$MAXID' (setval calls missing?)"
fi
psql "${DRILL_PREFIX}fresh" -q -c "delete from sites where name='drill'" >/dev/null 2>&1

ORPHANS=$(psql "${DRILL_PREFIX}fresh" -tAc "select
  (select count(*) from field_inventory fi left join fields f on f.id=fi.field_id where f.id is null) +
  (select count(*) from bunch_harvests b left join fields f on f.id=b.field_id where f.id is null) +
  (select count(*) from fields f left join sites s on s.id=f.site_id where s.id is null)" 2>/dev/null | tr -d ' ')
[ "$ORPHANS" = "0" ] && ok "no orphaned foreign keys" || bad "$ORPHANS orphaned foreign-key rows"

FORECASTABLE=$(psql "${DRILL_PREFIX}fresh" -tAc "select count(*) from field_inventory fi
  join fields f on f.id=fi.field_id join sites s on s.id=f.site_id
  join varieties v on v.id=fi.variety_id" 2>/dev/null | tr -d ' ')
[ -n "$FORECASTABLE" ] && [ "$FORECASTABLE" -gt 0 ] \
  && ok "forecast joins resolve ($FORECASTABLE plantings)" \
  || bad "no plantings join through to a site and variety — forecast would be empty"
echo

# ── Scenario 2: data lost, database survives ─────────────────────────────────
# The likely disaster, and the one that traps people: the fresh-restore commands
# recover NOTHING here, because the tables and rows already exist.
bold "2. Data loss with the database intact (truncate + reload)"
psql "${DRILL_PREFIX}fresh" -q -c \
  "delete from bunch_harvests; delete from field_inventory where id > 3;" >/dev/null 2>&1
echo "        simulated loss, now: $(counts "${DRILL_PREFIX}fresh")"

# Confirm the naive path really does fail, so this stays a tested claim.
if psql "${DRILL_PREFIX}fresh" -v ON_ERROR_STOP=1 -q -f "$DATA" >/dev/null 2>&1; then
  bad "naive data reload unexpectedly SUCCEEDED — docs say it should fail; re-check the runbook"
else
  ok "naive reload correctly refuses (duplicate keys), as documented"
fi

psql "${DRILL_PREFIX}fresh" -v ON_ERROR_STOP=1 -q -c "
TRUNCATE bunch_harvests, weight_harvests, field_inventory,
         orders, clients, fields, varieties, sites RESTART IDENTITY CASCADE;" >/dev/null 2>&1 \
  && ok "tables truncated" || bad "truncate failed"
psql "${DRILL_PREFIX}fresh" -v ON_ERROR_STOP=1 -q -f "$DATA" >/dev/null 2>&1 \
  && ok "data reloaded" || bad "data reload failed"

AFTER=$(counts "${DRILL_PREFIX}fresh")
[ "$AFTER" = "$BASELINE" ] \
  && ok "recovered state matches baseline ($AFTER)" \
  || bad "recovered '$AFTER' does not match baseline '$BASELINE'"
echo

# ── Scenario 3: schema damaged ───────────────────────────────────────────────
bold "3. Schema damage (wipe the public schema, full restore)"
psql "${DRILL_PREFIX}fresh" -v ON_ERROR_STOP=1 -q -c \
  "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" >/dev/null 2>&1 \
  && ok "schema wiped" || bad "schema wipe failed"
psql "${DRILL_PREFIX}fresh" -v ON_ERROR_STOP=1 -q -f "$SCHEMA" >/dev/null 2>&1 \
  && ok "schema restored" || bad "schema restore failed"
psql "${DRILL_PREFIX}fresh" -v ON_ERROR_STOP=1 -q -f "$DATA" >/dev/null 2>&1 \
  && ok "data restored" || bad "data restore failed"
AFTER=$(counts "${DRILL_PREFIX}fresh")
[ "$AFTER" = "$BASELINE" ] \
  && ok "recovered state matches baseline ($AFTER)" \
  || bad "recovered '$AFTER' does not match baseline '$BASELINE'"
echo

# ── Scenario 4: point-in-time from git history ───────────────────────────────
bold "4. Point-in-time restore (an earlier backup from git history)"
cd "$WORKDIR/backups"
OLD_SHA=$(git log --format=%h -- dumps/production-data.sql | sed -n '2p')
if [ -z "$OLD_SHA" ]; then
  echo "  SKIP  only one backup commit exists yet — nothing earlier to restore"
else
  echo "        restoring $(git log -1 --format='%h %ad' --date=format:'%Y-%m-%d %H:%M' "$OLD_SHA")"
  git checkout -q "$OLD_SHA" -- dumps/
  drill_db "${DRILL_PREFIX}pitr"
  # Dumps written before 2026-07-29 carry a preamble that aborts psql; the
  # documented workaround strips it. Try clean first, fall back, and report which
  # path was needed so a stale runbook is visible.
  if psql "${DRILL_PREFIX}pitr" -v ON_ERROR_STOP=1 -q -f "$SCHEMA" >/dev/null 2>&1 \
     && psql "${DRILL_PREFIX}pitr" -v ON_ERROR_STOP=1 -q -f "$DATA" >/dev/null 2>&1; then
    ok "earlier backup restored directly"
  else
    FILTER='^SET transaction_timeout|^CREATE SCHEMA public;$'
    dropdb --if-exists "${DRILL_PREFIX}pitr" >/dev/null 2>&1; createdb "${DRILL_PREFIX}pitr"
    if grep -vE "$FILTER" "$SCHEMA" | psql "${DRILL_PREFIX}pitr" -v ON_ERROR_STOP=1 -q >/dev/null 2>&1 \
       && grep -vE "$FILTER" "$DATA" | psql "${DRILL_PREFIX}pitr" -v ON_ERROR_STOP=1 -q >/dev/null 2>&1; then
      ok "earlier backup restored via the documented preamble workaround (pre-2026-07-29 dump)"
    else
      bad "earlier backup could not be restored by either path"
    fi
  fi
  PITR=$(counts "${DRILL_PREFIX}pitr")
  case "$PITR" in
    ""|0,0,0,0,0,0,0,0) bad "point-in-time restore produced no data" ;;
    *) ok "point-in-time data present ($PITR)" ;;
  esac
  git checkout -q main -- dumps/
fi
echo

# ── Result ───────────────────────────────────────────────────────────────────
bold "──────────────────────────────────────────"
if [ "$FAIL" -eq 0 ]; then
  green "DRILL PASSED — $PASS checks, 0 failures"
  bold "──────────────────────────────────────────"
  echo "Record the date in docs/operations.md so the next person knows how stale this is."
  exit 0
else
  red "DRILL FAILED — $FAIL of $((PASS + FAIL)) checks failed"
  bold "──────────────────────────────────────────"
  echo "Your backups are not known to be restorable. See"
  echo ".claude/skills/disaster-drill/SKILL.md for what each failure means."
  exit 1
fi
