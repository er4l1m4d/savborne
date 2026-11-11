# Runbook - incident response

**First rule:** no custody. Do not ask anyone for their 24 words, passphrase,
private key, API key or session token. Savborne cannot move or recover NIM.

## First five minutes

1. `curl -sS https://savborne.vercel.app/api/health` and read `checks` and
   `schemaVersion`.
2. Compare `schemaVersion` with `expectedSchemaVersion`. A mismatch means the
   database paste and the deployed build disagree.
3. Vercel -> Deployments -> Functions logs. Look for the structured
   `{"event":"api_error", ...}` lines; quote the `requestId`, never the raw
   message.
4. Supabase -> Logs -> API/Postgres. Look for `permission denied`, missing
   functions, or connection limits.
5. Check the Nimiq RPC endpoint(s) with a direct
   `getAccountByAddress` call if balances look wrong.

## Symptom table

| Symptom | Likely cause | Action |
|---|---|---|
| `/api/health` 503, `checkInRpc:false` | schema paste missing/failed | Re-paste `FINAL-SCHEMA.sql`, verify the version. |
| `/api/health` 503, version mismatch | app ahead of DB | Paste the current schema, then redeploy. |
| Check-in 500 with "schema cache" | old schema / wrong project | Same as above; confirm `NEXT_PUBLIC_SUPABASE_URL`. |
| Check-in 401 for every player | `SESSION_SECRET` missing/short, or clock skew | Check Vercel env; rotate only if leaked. |
| Check-in 429 | rate limit | Expected after 10/min; check `Retry-After`. |
| `rpc_unreachable` 503 | Nimiq node outage | Add/rotate `NIMIQ_RPC_URLS`; the balance is unknown, not zero. |
| Leaderboard empty | `leaderboard_stats()` missing or RLS grant | Re-paste the schema; confirm service-role grant. |
| Cron 401 | `CRON_SECRET` missing in Vercel | Set it and redeploy; Vercel injects the header. |
| Cron 200 with `failed > 0` | individual vault/RPC failures | Check the log count, rerun; the cursor resumes. |
| Card 404 for a live player | vault deleted or token rotated | Check `vaults` for the player; do not guess tokens. |

## Rollback

- Application: promote the previous Vercel deployment.
- Schema: re-paste the whole file; it is idempotent and preserves rows.
- Secrets: rotate `SESSION_SECRET` (logs everyone out) or `CRON_SECRET`
  (stops the old cron credential). Update Vercel, then redeploy.

## Communication

- State what is affected in plain language: check-in, ranked, a read screen, or
  the whole app.
- Never include addresses, tokens, SQL messages or player data in a public
  status message.
- For a suspected data exposure, preserve logs, rotate secrets, and contact the
  owner at `damilareogooluwade@outlook.com` before posting details.

## After the incident

- Add a dated entry to `ERRORS.md` with symptom, root cause, fix and prevention.
- Add or update a test that would have caught it.
- Update this runbook and the release checklist if the failure mode was new.
