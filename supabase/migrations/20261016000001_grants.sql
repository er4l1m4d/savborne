-- ═════════════════════════════════════════════════════════════════════════════
-- Savborne — grant table privileges to the API roles
--
-- On this project the tables were created as `postgres` via the SQL editor,
-- and the PostgREST roles did not receive default grants — so the app's
-- service-role client failed with "permission denied for table players".
-- The app's ONLY database path is the service-role client (bypasses RLS),
-- so that role needs full privileges on public tables and sequences;
-- anon/authenticated get nothing (their REST access stays denied — all reads
-- go through the API routes, which is the intended posture).
--
-- Idempotent: safe to re-run any time.
-- ═════════════════════════════════════════════════════════════════════════════

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

-- Belt-and-braces: function execute grant survives any privilege reset.
grant execute on function match_me(text) to service_role;
