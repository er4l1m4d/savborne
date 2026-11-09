# Database - how to change the schema

`FINAL-SCHEMA.sql` is the **only** SQL file. Paste it into Dashboard -> SQL
Editor and run it. It is fully idempotent, so it is safe to run on a fresh
database, a partially applied one, or one that already has the schema.

It contains the tables, catalog seeds, indexes, RLS policies, grants and every
RPC the app calls: `match_me`, `leaderboard_stats`,
`create_player_with_vault`, `delete_player`, `consume_rate_limit` and
`commit_check_in`.

The timestamped files in `supabase/migrations/` were removed on 2026-11-09.
This project is solo-tested and has no `supabase db push` path (the pooler
connection drops on this machine), so the single file is the source of truth.
Git history still has the old migrations. If a migrations-based workflow is
needed later, start a new history from this file.

## Adding a change

1. Edit `FINAL-SCHEMA.sql` in the section where the object lives:
   extensions -> enums -> tables -> seeds -> indexes -> RLS -> functions ->
   grants.
2. Make every statement re-runnable:
   - `create table if not exists ...`
   - `alter table ... add column if not exists ...`
   - `create index if not exists ...`
   - `create or replace function ...`
   - `drop policy if exists ...; create policy ...`
   - seed data with `insert ... on conflict (...) do update set ...`, or
     `do nothing` where a later change must not overwrite the row
   - enum values with the
     `do $$ begin ... exception when duplicate_object then null; end $$;`
     pattern
3. Grant privileges on every new table. Grant to `service_role` only; the app
   never reads through `anon` or `authenticated`, and least-privilege is
   deliberate.
4. Enable RLS on every new table. Personal tables get no policy for `anon` or
   `authenticated` (deny by default). Only the catalog tables (`missions`,
   `items`, `badges`) are readable, with `using (true)`.
5. Do not run the SQL from this repo's tooling. The human applies it. After
   applying, smoke-check with a `select` and, for anything touching money, run
   `npm run vault:e2e` against testnet.

## Re-running and a fresh database

The file is non-destructive: it preserves existing rows and upgrades the schema
in place. The one exception is the check-in integrity section, which collapses
duplicate `(player_address, utc_date)` readings to the earliest row before
adding the unique index. That is intentional and safe to re-run.

If you want a completely fresh database, drop and recreate the project or run
the reset statements yourself; the file does not drop data.

## Verifying after a paste

```sql
-- Tables and the columns the app expects
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('vaults', 'transfers', 'check_ins', 'api_rate_limits')
order by table_name, ordinal_position;

-- Policies exist
select tablename, policyname from pg_policies where schemaname = 'public';

-- Release-gate objects
select exists(select 1 from pg_proc where proname = 'commit_check_in') as commit_check_in,
       exists(select 1 from pg_proc where proname = 'consume_rate_limit') as consume_rate_limit,
       exists(select 1 from pg_indexes
               where schemaname = 'public'
                 and indexname = 'check_ins_player_day_uidx') as check_in_day_index;
```

A 500 with `permission denied for table ...` means step 3 was missed. A 400
from PostgREST mentioning an unknown column means the paste and the code are on
different schema versions.
