# Runbook - deploy Savborne

**Audience:** the project owner. The agent never deploys to production.

## Preconditions

- [ ] `npm run verify` is green on the release commit (tests, tsc, lint, build).
- [ ] `supabase/FINAL-SCHEMA.sql` has been pasted into production and
      `GET /api/health` reports `schemaVersion = 2026-11-11.4`.
- [ ] The env vars below exist in Vercel for the Production environment.
- [ ] `git status` is clean and no secret is staged.

## Environment variables (names only)

| Name | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Browser key; RLS applies. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server only; bypasses RLS. |
| `SESSION_SECRET` | yes | 32+ bytes. Rotating it invalidates every session. |
| `CRON_SECRET` | yes | Vercel sends it as `Authorization: Bearer ...`. |
| `NIMIQ_RPC_URLS` | optional | Comma-separated fallback endpoints. |
| `NEXT_PUBLIC_NIMIQ_NETWORK` | optional | `mainnet` / `testnet` hint. |
| `SENTRY_DSN` | optional | Only if the owner approved a reporter; the code uses structured logs otherwise. |

Generate secrets with `openssl rand -base64 48` (session) and
`openssl rand -hex 32` (cron). Never put values in the repo, a PR, a screenshot
or a chat.

## Deploy

1. Merge `public-readiness` into `main` (or open a PR and merge it) **after** the
   release checklist is green. This is the human's step.
2. Vercel builds `main`. Confirm the build log has no `next/font` fetch and the
   deploy reaches "Ready".
3. Run the production probes:

```bash
curl -sS https://savborne.vercel.app/api/health -w "\n%{http_code}\n"
# 200, ok:true, schemaVersion 2026-11-11.4, all six checks true

NOW=$(date +%s%3N); PK=$(openssl rand -hex 32); SIG=$(openssl rand -hex 64)
curl -sS -X POST https://savborne.vercel.app/api/check-ins \
  -H "X-Player-Address: NQ07 FAKE FAKE FAKE FAKE FAKE FAKE FAKE FAKE" \
  -H "X-Savborne-Check-In-Public-Key: $PK" \
  -H "X-Savborne-Check-In-Signature: $SIG" \
  -H "X-Savborne-Check-In-Signed-At: $NOW" -w "\n%{http_code}\n"
# 401 bad_signature / wrong_signer, never 500
```

4. Open the app in Nimiq Pay and complete one real check-in.
5. Trigger the cron manually once (optional) with the secret, then remove the
   secret from the shell:

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  https://savborne.vercel.app/api/cron/read-vaults
# 200 { ok:true, processed>=1, failed:0 }
```

6. Watch `/api/health` for 24 hours. The external monitor below should report
   green; if it alerts, treat it as a production incident.

## Monitoring (external, no GitHub Actions)

There is no hosted CI and no GitHub workflow. Two things replace it:

- **Release gate:** `npm run verify` locally before every push. The suite uses
  a fake network, so it needs no `.env.local` and no secrets.
- **Production uptime:** a free external monitor, because nothing in the repo
  can alert you when the deployment is down.

Set it up once:

1. Create a free account with UptimeRobot (or Better Stack).
2. Add an HTTP(s) monitor for `https://savborne.vercel.app/api/health`.
3. Interval 5 minutes, timeout 30 seconds.
4. Enable keyword monitoring and require both `"ok":true` and
   `"schemaVersion":"2026-11-11.4"` in the body. Bump that string when
   `EXPECTED_SCHEMA_VERSION` changes.
5. Alert to an address you actually read. A monitor with no alert is decoration.

The endpoint returns 503 and lists the failing check when the database is
unreachable, the schema version drifts, or a required RPC is missing.

## Rollback

- **Bad application deploy:** Vercel -> Project -> Deployments -> previous
  deployment -> "Promote to Production". The schema is additive; an older app
  still reads the new tables.
- **Bad schema paste:** no destructive rollback is needed. Re-paste the whole
  file; it is idempotent. If a statement failed midway, fix the reported object
  and re-run the whole file.
- **Leaked `SESSION_SECRET`:** rotate it in Vercel. Every session becomes
  invalid; players re-sign on their next request. No data is lost.
- **Leaked `CRON_SECRET`:** rotate it in Vercel. The old value stops working.

## What not to do

- Do not run the SQL from a script or any automation; the human pastes it.
- Do not deploy while `/api/health` reports a version mismatch.
- Do not "fix" a 500 by disabling the session guard; that reopens the identity
  hole.
