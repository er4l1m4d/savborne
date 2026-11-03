# Database — how to change the schema

Two files describe the same database:

| File | Role |
|---|---|
| `FINAL-SCHEMA.sql` | **The file you run.** One idempotent script covering the whole schema. Paste it into Dashboard → SQL Editor; it is safe to re-run on fresh, partial or complete state. |
| `migrations/*.sql` | Timestamped history. Used by `supabase db push` in environments where the pooler is reachable. Never edited after it has been applied anywhere. |

`FINAL-SCHEMA.sql` is the source of truth for this project. The reason is
environmental: on this machine the pooler connection is dropped mid-handshake,
so `supabase db push` and `supabase db query` cannot be relied on (see
`ERRORS.md`, entries for 2026-10-15). Pasting the single file is the only path
that works every time.

## Adding a change

1. **Write the migration first.** Create
   `supabase/migrations/<UTC timestamp>_<slug>.sql`, e.g.
   `20261201000000_transfer_notes.sql`. Use `YYYYMMDDHHMMSS` in UTC so lexical
   order is apply order.

2. **Make every statement re-runnable.** These files are pasted into a live
   database more than once:
   - `create table if not exists ...`
   - `alter table ... add column if not exists ...`
   - `create index if not exists ...`
   - `create or replace function ...`
   - `drop policy if exists ...; create policy ...`
   - seed data with `insert ... on conflict (...) do update set ...` when the
     row is app-owned, or `do nothing` when a later change must not be
     overwritten (the `first_deposit` mission uses this form)
   - enum values via the `do $$ begin ... exception when duplicate_object then null; end $$;`
     pattern already used at the top of both files

3. **Mirror it into `FINAL-SCHEMA.sql`** in the section where the object lives
   (extensions → enums → tables → indexes → functions → policies → grants).
   Both files must end in the same shape. If they disagree, the next person to
   paste `FINAL-SCHEMA.sql` silently gets the older schema.

4. **Grant privileges explicitly** on any new table. This project's PostgREST
   roles do not inherit the platform defaults (see `20261016000001_grants.sql`).
   Grant to `service_role` only — the app never reads through `anon` or
   `authenticated`, and least-privilege is deliberate.

5. **Enable RLS** on every new table (`alter table ... enable row level
   security`), even though the server uses the service role. RLS is the second
   line of defence if a key leaks. The pattern in this schema is
   deny-by-default: player-owned tables get **no** policy for `anon` or
   `authenticated`, so those roles can read nothing. Only the three catalog
   tables (`missions`, `items`, `badges`) are readable, with
   `using (true)`. All personal data flows through the API routes.
   Any old header-based policies must be dropped; see the RLS block near the
   end of `FINAL-SCHEMA.sql` for the exact list.

6. **Do not run the SQL from this repo's tooling.** The human applies it. After
   applying, smoke-check with a `select` and, for anything touching money, run
   `npm run vault:e2e` against testnet.

## What belongs in a migration

- Schema, indexes, constraints, functions, policies, grants, enum values.
- Catalog seeds that the app's logic assumes exist (missions, items, badges).
- **Not** secrets, API keys, or row data from your local machine.

## Verifying after a paste

```sql
-- Tables and the columns the app expects
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('vaults', 'transfers')
order by table_name, ordinal_position;

-- Policies exist
select tablename, policyname from pg_policies where schemaname = 'public';
```

A 500 with `permission denied for table ...` means step 4 was missed. A 400
from PostgREST mentioning an unknown column means the paste and the code are on
different schema versions.
