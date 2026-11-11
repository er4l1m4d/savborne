# Runbook - apply the production schema (2026-11-10)

**Audience:** the project owner (human). There is no database credential in the
agent sandbox and the SQL is never run from tooling.

**Target schema version:** `2026-11-11.4`

> **Revision 2026-11-11.4 (second paste).** After the first paste fixed
> check-ins, the standing-freshness release added `check_ins.source`,
> `check_ins.claimed_at`, `check_ins.bracket`, the `record_reading` RPC and the
> `cron_state` cursor. Apply the same file again, whole, once. It is still
> idempotent and preserves rows. The version marker must read `2026-11-11.4`.

## Why

`POST /api/check-ins` returns HTTP 500 in production:

```json
{"error":"Could not find the function public.consume_rate_limit(p_key, p_limit, p_window_seconds) in the schema cache"}
```

The deployed application expects objects that are not in the production
Supabase project yet:

- `consume_rate_limit(text, int, int)` - the fixed-window rate limit that runs
  before any check-in work.
- `commit_check_in(...)` - the one transaction that writes the reading, player
  row, XP, missions, items and badges.
- the `check_ins_player_day_uidx` unique index that makes a reading
  one-per-player-per-UTC-day.

This is a missing-schema-object problem, not a connectivity problem:
`/api/vaults` and `/api/leaderboards` answer 200 against the same database, and
a fake-proof check-in fails at the first RPC instead of at signature
verification.

The same paste also installs the schema-version contract (`schema_meta`,
`schema_version()`, `schema_health()`) so `GET /api/health` can detect a stale
database before a player does.

## Steps

1. Open the Supabase Dashboard for the production project.
2. Go to **SQL Editor** -> **New query**.
3. Open `supabase/FINAL-SCHEMA.sql` from this repo at the release commit.
4. Paste the **entire file** and press **Run**.
5. Expect "Success. No rows returned". A warning about existing objects is
   normal on a re-run; an error is not - stop and capture it.

The file is idempotent and non-destructive. It is safe to run on a fresh
database, a partially applied one, or one that already has the schema. Run the
whole file, not individual statements.

Do **not** run the SQL from CI, a script or the app. The human applies it.

## Verification SQL

Paste this separately after the main file. Every value must match.

```sql
-- 1. Schema version marker
select version, applied_at from schema_meta where id = 'singleton';
-- expect: 2026-11-11.4 | <timestamp>

-- 2. The release-gate objects exist
select exists(select 1 from pg_proc where proname = 'commit_check_in') as commit_check_in,
       exists(select 1 from pg_proc where proname = 'consume_rate_limit') as consume_rate_limit,
       exists(select 1 from pg_proc where proname = 'record_reading') as record_reading,
       exists(select 1 from pg_proc where proname = 'settle_battle') as settle_battle,
       exists(select 1 from pg_proc where proname = 'session_is_active') as session_is_active,
       exists(select 1 from pg_indexes
               where schemaname = 'public'
                 and indexname = 'check_ins_player_day_uidx') as check_in_day_index;
-- expect: five true values, then the index true

-- 3. Health RPC reports the same version and both functions
select schema_health();
-- expect: all values true and version 2026-11-11.4

-- Session rows and the stats opt-out exist
select count(*) from player_sessions;                     -- any number, table exists
select count(*) from information_schema.columns
 where table_schema = 'public' and table_name = 'players'
   and column_name = 'show_stats';                        -- expect 1

-- 4. One reading per UTC day is enforced
select count(*) from (
  select player_address, utc_date from check_ins
  group by player_address, utc_date having count(*) > 1
) dup;
-- expect: 0

-- 5. RLS is still on everywhere and the catalog policies are the only ones
select count(*) filter (where relrowsecurity) as rls_on,
       count(*) as public_tables
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r';
-- expect: rls_on = public_tables

select tablename, policyname from pg_policies where schemaname = 'public' order by tablename;
-- expect: catalog_read_missions, catalog_read_items, catalog_read_badges only
```

## Post-paste probes

### a. Fake proof must be rejected before any database work

```bash
NOW=$(date +%s%3N); PK=$(openssl rand -hex 32); SIG=$(openssl rand -hex 64)
curl -sS -X POST https://savborne.vercel.app/api/check-ins \
  -H "X-Player-Address: NQ07 FAKE FAKE FAKE FAKE FAKE FAKE FAKE FAKE" \
  -H "X-Savborne-Check-In-Public-Key: $PK" \
  -H "X-Savborne-Check-In-Signature: $SIG" \
  -H "X-Savborne-Check-In-Signed-At: $NOW" -w "\n%{http_code}\n"
```

Pass: HTTP 401 with `bad_signature` or `wrong_signer`.
Fail: HTTP 500 containing `schema cache` (the paste did not apply) or
`permission denied` (a grant is missing).

### b. Schema health

```bash
curl -sS https://savborne.vercel.app/api/health -w "\n%{http_code}\n"
```

Pass: HTTP 200 with `"ok":true`, `schemaVersion` and `expectedSchemaVersion`
both `2026-11-11.4`, and every key in `checks` is `true`.
Fail: HTTP 503 - read `checks` to see which object is missing.

### c. A real wallet check-in

Open the app in Nimiq Pay, tap **Check in**, and confirm:

- HTTP 200 from `POST /api/check-ins` (Vercel logs show one request).
- The response has `ok: true` and `alreadyCheckedIn: false`.
- `select count(*) from check_ins where player_address = '<your address>';`
  increases by exactly **one**.
- A second tap returns `alreadyCheckedIn: true` and adds no row.

## Rollback

None needed. The file creates or replaces objects; it never drops tables or
deletes player data. Re-running it is the recovery path for a partial paste.

**Data-loss note (intentional):** the check-in integrity section collapses
duplicate `(player_address, utc_date)` rows, keeping the earliest reading for
each player/day before it adds the unique index. That is the only destructive
step, it only removes duplicate same-day readings, and it is safe to re-run.

## If something fails

| Symptom | Meaning | Action |
|---|---|---|
| `permission denied for table ...` | service_role grant missing | Re-run the whole file; check the grants near the end |
| `function ... does not exist` in PostgREST | paste and deploy differ | Confirm `schema_version()` returns `2026-11-11.4`, then redeploy |
| `/api/health` 503 with `checkInRpc:false` | `commit_check_in` missing or wrong signature | Re-paste the file; check the function's argument list |
| `/api/health` 503 with `version:null` | `schema_meta` missing | Re-paste the file; the insert is near the tables |

Record the result of each probe in the incident log or the release checklist.
