# Savborne — Error Log

A running log of errors encountered during development, their root causes, and solutions. Check this file before debugging any new issue — the fix may already be documented.

---

## Format

Each entry follows this structure:

```
### [YYYY-MM-DD] Short title
**Symptom:** What was observed (error message, unexpected behavior)
**Context:** Where/when it happened (file, environment, trigger)
**Root cause:** Why it happened
**Fix:** What was done to resolve it
**Prevention:** How to avoid it in the future
```

---

## Entries

### [OPEN · 2026-10-15] `supabase db push` blocked by network (pooler dial killed)
**Status:** UNRESOLVED — workaround in place.
**Symptom:** "Connection terminated unexpectedly" connecting to `aws-0-us-east-1.pooler.supabase.com:5432` while HTTPS to the same project works.
**Current workaround:** schema applied manually via Dashboard SQL Editor (see the two paste steps below in this file's history or ask the agent).
**Try next time:** (a) swap to phone hotspot and rerun `npx supabase db push`; (b) install Docker Desktop and use `supabase db reset` locally; (c) investigate local firewall rules on port 5432.

---

### [2026-10-15] `npm install` aborts with ECONNRESET during Next.js scaffold
**Symptom:** `create-next-app` prints `npm error code ECONNRESET / syscall read / errno -4077` and the project directory is created but `node_modules` is missing.
**Context:** Running `npx create-next-app` on Windows with a slow or flaky network. The scaffold files (package.json, tsconfig, src/, public/) were created before the install failed, so the directory is not empty — a second `create-next-app` refuses to run.
**Root cause:** npm's default fetch timeout is too short for the Next.js dependency tree (~350 packages) on a slow connection. A single dropped socket kills the whole install.
**Fix:** Do NOT re-run `create-next-app` — it will refuse on the non-empty dir. Instead, `cd` into the folder and run plain `npm install`. That resumes fetching and completes.
**Prevention:** Set `npm config set fetch-retry-maxretry 5` and `fetch-retry-initial-delay 5000` on this machine before starting another scaffold.

### [2026-10-15] Supabase generic `createClient<Database>` fails TS typecheck
**Symptom:** `error TS2322: Type 'SupabaseClient<Database, ...>' is not assignable to type 'SupabaseClient<Database, "public", "public", never, { PostgrestVersion: "12" }>'.`
**Context:** Passing a hand-written `Database` shape into `createClient<Database>()`. Supabase's own `SupabaseClient` type wants the Database generic to include a specific `__InternalSupabase` marker shape that a hand-typed definition does not satisfy.
**Root cause:** Supabase's codegen emits types with a special internal marker; hand-written Database shapes lack it.
**Fix:** Drop the generic entirely — use plain `SupabaseClient` from `@supabase/supabase-js`. Keep the hand-written `database.types.ts` for reference and for app-level query shape inference, but do not pass it to `createClient<>()`. Regenerate the real types file via `npx supabase gen types typescript` once the project exists.
**Prevention:** Any file that hand-writes a Supabase Database type shape should note clearly that it is reference-only until real codegen is available.

### [2026-10-15] `process.env.X` narrowing lost after `if (!x) throw`
**Symptom:** `error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'` on a line that runs after the guard.
**Context:** TypeScript's flow-narrowing does not always persist across assignments and closures for `process.env` because those are typed as `string | undefined` at declaration. Once you assign the destructured value to a module-level `const`, the narrowing may be lost when the value is used inside a function.
**Root cause:** TS narrowing applies to the *identifier*, not the underlying value. `url` was narrowed to `string` inside the guard's else branch, but a subsequent read outside that branch (or in a hoisted function body) falls back to the declared `string | undefined`.
**Fix:** Assign the narrowed value to a new `const` with an explicit type annotation: `const supabaseUrl: string = url`. This forces TS to accept the narrowing at the assignment site.
**Prevention:** For any env-var access used later in a function or exported value, always copy into an explicitly typed `const` at module load.

### [2026-10-15] Next.js 16 `cacheComponents` rejects route `runtime` exports
**Symptom:** `Error: Route segment config "runtime" is not compatible with nextConfig.cacheComponents. Please remove it.` — build fails on any route that exports `runtime = 'nodejs'`.
**Context:** Next.js 16.4 scaffold enables `cacheComponents: true` by default in `next.config.ts`. When any API route uses the Node runtime (required for `@supabase/supabase-js` connection handling), the build refuses.
**Root cause:** `cacheComponents` is an experimental Next.js 16 feature that assumes all routes run on the same runtime as the render pipeline. Mixing `runtime = 'nodejs'` into a route handler under that model is unsupported.
**Fix:** Remove `cacheComponents: true` from `next.config.ts`. Keep `partialPrefetching` and the `turbopack.root` pin. Add a comment noting why so a future reader doesn't re-enable it.
**Prevention:** Before enabling experimental Next.js features, check whether the API routes you plan to write need Node-only runtime.

### [2026-10-15] `await` inside `Array.prototype.filter` callback (ESLint no-await-in-loop / TS compile error)
**Symptom:** `error TS1375: 'await' expressions are only allowed within async functions and at the top levels of modules.`
**Context:** Writing `arr.filter((m) => !set.has(m.key) && !(await dbCheck(m.key)))` — the arrow callback is not async, so `await` fails to compile.
**Root cause:** `filter` invokes its callback synchronously; making the callback `async` would return a `Promise<boolean>` which is truthy for every item and effectively makes the filter a no-op.
**Fix:** Pre-compute the async data you need into a synchronous structure (e.g. `Set` of already-credited keys from a single query) BEFORE calling `filter`. Then filter can be pure sync.
**Prevention:** Any time you want to `await` inside `.map`/`.filter`/`.reduce`, restructure to fetch in bulk first, then do the sync transform.

### [2026-10-15] React Compiler "no setState in effect" false positive on async hooks
**Symptom:** The IDE flags `useEffect(() => { refresh() }, [refresh])` with `Calling setState synchronously within an effect can trigger cascading renders`, even when `refresh` is `async` and every `setX()` call is behind an `await`.
**Context:** Any custom hook that fetches on mount using the standard `useCallback` + `useEffect` pattern.
**Root cause:** The React Compiler's ESLint rule cannot statically prove that an `async` function body will not synchronously reach a setState call before its first suspension point. It treats every reachable call as potentially synchronous. `await Promise.resolve()` at the top of the async callback did NOT satisfy it.
**Fix:** Do not attempt to restructure the hook to appease the rule; it's informational. The Next.js build (`next build`) passes without errors, so the rule is only enforced by the IDE's inline lint, not by the CI build script. Downgrade the rule to a warning in `eslint.config.mjs` if it becomes noisy:
```js
rules: { 'react-hooks/set-state-in-effect': 'warn' }
```
**Prevention:** When using Next.js 16's default `eslint-config-next`, this rule may fire. Do not restructure correct hooks around a false positive — verify with `npm run build` first.

### [2026-10-15] Static HTML spike fails: bare module specifier not resolvable
**Symptom:** A page with `<script type="module">` importing `from '@nimiq/mini-app-sdk'` throws `Failed to resolve module specifier "@nimiq/mini-app-sdk"` in the browser, before any wallet call runs. No output, no crash page — just a silent console error.
**Context:** The `savborne-spike` static page (and the spike snippet in docs/Savborne-spec.md §15.2), served with `npx serve` or deployed to Vercel as plain files. `npm install` makes the package available to bundlers, but a bare specifier is meaningless to a browser without one.
**Root cause:** Browser ES modules only accept URL specifiers (`./main.js`, `https://…`). Bare specifiers (`@nimiq/mini-app-sdk`) require a bundler or an import map to resolve.
**Fix:** Import from a CDN that reshapes the package for browsers: `import { init, NimiqProviderError } from 'https://esm.sh/@nimiq/mini-app-sdk@0.2.4'`. Verified the CDN URL returns 200 + a valid ESM redirect. Pin the exact version to match package.json.
**Prevention:** Any HTML page with `<script type="module">` must use URL imports. The real app is safe — Next.js bundles and resolves bare specifiers at build time. This only bites dependency-free static demos.

### [2026-10-15] IDE Problems panel shows errors for DELETED files (stale diagnostics)
**Symptom:** Diagnostics reference `src/app/page.tsx` ("Cannot find module '@/lib/nimiq'", "'err' is of type 'unknown'") and `savborne-app/src/app/globals.css` ("Unknown at rule @theme") — but both paths no longer exist on disk.
**Context:** After moving `page.tsx` into the `(tabs)` route group and removing the `savborne-app/` scaffold folder, VS Code's TS server and CSS language service kept analyzing the deleted resources and republishing their old errors into the Problems panel.
**Root cause:** Language servers cache document state per open editor/tab; files deleted via shell (Move-Item / Remove-Item) don't always trigger an immediate unload.
**Fix:** Verify with `Test-Path` + a real `npm run build` (which passed), then reload the IDE window to flush stale diagnostics.
**Prevention:** Never trust the Problems panel alone after structural moves — cross-check the resource path actually exists before "fixing" it. `npm run build` is the source of truth.

### [2026-10-15] ESLint flat config: bare `{ rules }` block silently un-ignores non-app folders
**Symptom:** After adding a `rules` override to `eslint.config.mjs`, `npm run lint` started reporting 14 errors from `.uiparse/` scratch scripts (`require() style import is forbidden`) that never appeared before.
**Context:** `eslint-config-next` normally ignores everything outside its `files` patterns by default. In flat config, once ANY bare config object without `files` exists in the array, it applies to every matching file — and `globalIgnores` had to stay the single source of exclusions.
**Root cause:** The rules-override block widened ESLint's effective file set; folders that weren't explicitly ignored (`.uiparse`) got linted under app rules.
**Fix:** Add `".uiparse/**"` and `"savborne-spike/**"` to `globalIgnores`. Verified: `npx eslint .` → 0 errors, 2 warnings (the documented set-state-in-effect false positives, downgraded to warn via the rules override).
**Prevention:** When widening an ESLint flat config with non-`files`-scoped objects, audit which directories suddenly fall inside the linted set.

### [2026-10-15] `supabase db push` fails: pooler connection terminated
**Symptom:** `failed to connect to postgres: failed to connect to host=aws-0-us-east-1.pooler.supabase.com user=postgres.<ref> database=postgres: Connection terminated unexpectedly`. `supabase link` and the management-API commands (api-keys) work fine.
**Context:** Applying migrations from this machine over its current network. The CLI's direct Postgres/pooler dial is killed mid-handshake while plain HTTPS to the same host succeeds.
**Root cause:** Network path drops the pooled TLS/TCP connection to port 5432 (ISP or firewall interference), not a credentials or CLI problem.
**Fix:** Apply migrations manually through the Dashboard SQL Editor (same files, run in filename order). API keys fetched separately via `supabase projects api-keys -o json` piped into `scripts/fetch-supabase-keys.mjs` — the management API is HTTPS and unaffected.
**Prevention:** On this machine, assume `db push`/`db query`/`gen types` (all pooler-based) may fail; prefer the SQL editor for schema changes, or retry via a different network (phone hotspot). Docker + `supabase db reset` locally would also bypass it entirely.

### [2026-10-15] `own_battles` RLS policy referenced a nonexistent column
**Symptom:** Caught by static review before applying: `create policy "own_battles" on battles for select using (player_address in (player_a, player_b) or …)` — `battles` has no `player_address` column (they are `player_a`/`player_b`). Postgres would reject the whole migration at that statement.
**Context:** Migration 20261015000000_init.sql, written during Phase 1; the same expression is valid on sibling tables (check_ins etc.) where the column does exist — copy-paste carry-over.
**Fix:** Policy now only uses `current_setting('request.header.x-player-address', true) in (player_a, player_b)`, which is what the first condition was incorrectly duplicating.
**Prevention:** Column names differ per table in this schema (`player_address` on ledgers, `player_a`/`player_b` on battles). Review RLS policies against the specific table's columns; and run migrations in a sandbox DB (Docker `db reset`) before touching a real project — the static catch here came from reading, not testing, which is luck, not process.

### [2026-10-16] `'use client'` lib module imported by API routes → every export becomes a throwing client reference
**Symptom:** All API routes 500 with `TypeError: Headers.get: "function() { throw new Error("Attempted to call PLAYER_HEADER() from the server but PLAYER_HEADER is on the client…")" is an invalid header name.` — the imported *constant* arrived as a client-reference function.
**Context:** `src/lib/session.ts` carried `'use client'` (it touches localStorage). Route handlers imported `PLAYER_HEADER` from the same module.
**Root cause:** In the App Router module graph, a `'use client'` boundary transforms ALL exports of that module into client references when imported from server code — even plain constants. Calling/reading them server-side throws.
**Fix:** Removed the directive from the lib module. Browser-only functions already guard on `typeof window`; the directive belongs on component files, not shared utilities. Re-verified: routes now reach the database layer.
**Prevention:** Files under `src/lib` that are imported by BOTH server and client must never have `'use client'`. E2E caught this in seconds — exactly why we run them.

### [2026-10-16] Service-role client denied despite valid key: missing Postgres GRANTs
**Symptom:** `{"error":"permission denied for table players"}` from every route using the service-role key — despite `service_role` having BYPASSRLS and a valid key. Auth succeeded; the table-level GRANT did not exist.
**Context:** Migrations applied via Dashboard SQL Editor (runs as `postgres`). On this project the PostgREST roles (anon/authenticated/service_role) did not receive the usual Supabase default privileges on new tables.
**Root cause:** Default-privilege wiring differs by project/creation path; SQL-editor-created tables are owned by `postgres` and are not automatically granted to the API roles.
**Fix:** Added `supabase/migrations/20261016000001_grants.sql` (`grant usage on schema public` + `grant all on all tables/sequences in schema public to service_role`) and folded the same grants into init.sql for fresh clones. Deliberately NO grants to anon/authenticated — the app never reads via REST with those roles, and least-privilege stays intact.
**Prevention:** Any migration file that creates tables must also grant privileges explicitly — never assume the platform's default grants exist.

### [2026-10-16] Battles swapped damage: each side received the damage IT dealt
**Symptom:** E2E flagged it behaviorally — a naive all-Attack player beat an AI holding Silver Blade + Bronze Shield, which the balance math makes impossible (the player should be KO'd by turn 5). Build and lint were clean; only a live game loop exposed it.
**Context:** `resolveAndAdvance` in `src/lib/game/battleServer.ts` applied `outcome.damageToB` (damage A dealt to B) against A's own HP, and vice versa.
**Root cause:** Misreading `resolveTurn`'s contract at the call site: `damageToA` means "damage dealt TO A (by B)" — the HP line must subtract damageToA from A. The naming reads like "A's attack damage" at a glance.
**Fix:** Swapped the subtraction; re-ran the full suite green with `winner=ai-savborne` for naive play (AI difficulty curve now behaves per spec 11.3).
**Prevention:** Outcome fields crossing two parties need "to WHOM" naming at every consumer, or a unit test asserting asymmetric damage (e.g. Attack vs Defend → only the attacker loses HP). This is exactly what the 42-assertion E2E is for — run it after ANY battle-engine change: `node scripts/e2e-test.mjs` (self-cleans its test players).

### [2026-10-16] Guarded UPDATE race-check via `count` silently always-null
**Symptom:** After refactoring battles to start `pending`→`active` with a guarded flip (`.eq('status','pending')`), every AI battle got stuck: moves returned 409 "Battle is pending", the flip's bookkeeping (daily counters, Quick Duel) never ran, and the busy-guard then blocked later battles.
**Context:** `beginBattleIfDue` decided "did I win the race?" from `const { count } = await db.from('battles').update(...).eq(...).select('id')`.
**Root cause:** supabase-js returns `count: null` unless you pass `{ count: 'exact' }` — so the winner-check was always false. Compounding: `loadBattle` trusted that false and returned the pre-flip stale `pending` row.
**Fix:** Check `data` (updated-rows array from `.select()`) instead of `count`; and in `loadBattle`, always re-read the row whenever a flip was *attempted* (not just when this caller won it), so a race-loser never serves stale status.
**Prevention:** Never branch on `count` from supabase-js without explicitly requesting `count: 'exact'`. Prefer the returned rows for "did my guarded write apply?" checks. Race-sensitive reads must re-read after any conditional write attempt.

### [2026-10-16] Queue stale-cleanup only ran on the match path — zombie rows never swept
**Symptom:** Stress test section 3: a queue entry backdated 31 s still existed (`status: waiting`) after the other player polled for 35 s. Expected: deleted on next poll (spec 16.3 step 4).
**Context:** `match_me()` had the stale `DELETE` as its final step — but every earlier branch ("no candidate found", "not in queue", "bracket lost") `RETURN null` before reaching it. A player waiting alone in a bracket never triggered cleanup.
**Root cause:** Placement — cleanup written as post-match housekeeping instead of per-call housekeeping. Reading the branches top-to-bottom shows step 7 is unreachable in exactly the scenario it exists for.
**Fix:** Moved the `DELETE ... last_poll_at < now() - 30s` to step 0, before anything else, in both FINAL-SCHEMA.sql and the record migration. Candidate search already ignores stale rows, so behavior only gains the sweep.
**Prevention:** For any "X should happen on next poll" requirement, assert it in a test where no match occurs — the stress suite caught this precisely because section 3 is match-negative by design.

### [2026-10-16] PostgREST null filter `col=not.null` → 400, script swallowed it
**Symptom:** reset script returned HTTP 400 on battles/queue deletes, 409 on players (FK still referenced) — while logging "deleted" as if fine. Ghost test data persisted.
**Root cause:** Correct PostgREST syntax is `col=is.null` / `col=not.is.null`. `not.null` is invalid. Also: the script printed status codes but never checked them.
**Fix:** `id=not.is.null`; any non-2xx delete now hard-exits with the response body. DB verified pristine (players: 1 = AI row only, battles: 0, queue: 0).
**Prevention:** REST-filter scripts must assert response status — a 400 mid-chain looks identical to success in optimistic logs.

### [2026-10-31] `canvas.measureText` reported Jakarta's tabular figures as broken
**Symptom:** Measuring digit advances at 24px in a canvas gave Plus Jakarta Sans `tnum` a spread of 8.21px — identical to plain — i.e. "tabular figures do nothing". A pixel font read 3.00px spread, also not flat.
**Context:** First version of `assets-raw/type-specimen.html`, measuring with `ctx.font = '500 24px "Plus Jakarta Sans"'` after `document.fonts.ready`.
**Root cause:** `CanvasRenderingContext2D` has no `fontVariantNumeric`; the `font` shorthand only accepts CSS font properties (style, variant-caps, weight, size, family). Setting `ctx.fontVariantCaps` does not enable `tnum` either. The measurement was of the *default* figure set, no matter what was requested, so every tabular claim made that way is unfounded.
**Fix:** Measure in the DOM: an off-screen span per digit, `getBoundingClientRect().width`, with `fontVariantNumeric: 'tabular-nums'` and `fontFeatureSettings: '"tnum" 1'` set as CSS. Result: Jakarta `.num` 14.41px flat (spread 0.00), plain 9.18–17.39px.
**Prevention:** Never verify an OpenType feature through canvas. Features are CSS-only — measure computed layout, or decompress the woff2 and read the feature tags (`scripts/font-features.mjs`). A canvas measurement that "disproves" a feature is more likely to be measuring nothing.

### [2026-10-31] "Silkscreen digits are uniform because it is a pixel font" was false
**Symptom:** The art bible stated Silkscreen's digits were uniform by construction and explicitly noted it was unmeasured. Measured: `1` advances **15.00px**, every other digit **18.00px** — a 3.00px spread. A countdown set in Silkscreen re-flows by 3px whenever a `1` enters or leaves.
**Context:** `docs/art-bible.md` §7 point 2, written 2026-10-30 while deciding numerals.
**Root cause:** A plausible-sounding property of "pixel font" was treated as a fact. Pixel fonts share a *design grid*, not a uniform advance width: the glyph for `1` is simply narrower, exactly as in a proportional face, only in coarser steps.
**Fix:** §7 corrected; the rule (changing numbers are Jakarta `.num`) survives, and is now stated for the right reason — it is the *only* thing that holds a digit column still.
**Prevention:** Any sentence of the form "X is uniform/flat/exact because …" in a design doc is a measurement request. Measure it, then keep the sentence only if the number is in it.

### [2026-10-31] A raster "is this font antialiased" test measured the screenshot pipeline
**Symptom:** Rendering Silkscreen at 24/28/30/32/36px and counting mid-tone pixels suggested 32px was the only "exact" size (0.0% half-tone edges) while 24px showed 13.8% — contradicting measured advance widths, which are whole pixels at all of 24/28/32/36.
**Context:** `assets-raw/aa-test.html` + a PNG decoder counting grey levels per text row, on this machine.
**Root cause:** The browser's `devicePixelRatio` here is **1.5**, so every CSS pixel is 1.5 device pixels; no CSS font size can land on the device grid, and the screenshot is resampled on top of that. The test measured DPR, not the font.
**Fix:** Discarded. The whole-pixel fact is established by advance widths in the DOM, which are DPR-independent. Font-size guidance now rests on that.
**Prevention:** Before any device-pixel assertion, read `window.devicePixelRatio` and refuse to run unless it is 1 (or the ratio is accounted for). "Rendered crisply" is not measurable on a fractional-DPR host.

### [2026-10-31] Text-prefix matching retitled the wrong element on 3 of 25 screens
**Symptom:** After shipping pass 1, `A_UpdatePay` rendered a Silkscreen header above a Jakarta headline while `A_BalanceError` did the opposite; `A_HomeDone` showed its character-card name in Silkscreen while `A_Home` kept the same name in Jakarta — the same element in two faces across a before/after screen pair.
**Context:** `scripts/type-pass1-ship.mjs`, first version. Titles were located by scanning a screen for the first element whose text started with a given string and whose style set Jakarta at ≥22px.
**Root cause:** Two kinds of large text exist in the handoff — a top-bar label that names the screen, and a centred state headline inside a screen that already has one — and both start with similar words ("Update Nimiq Pay" / "Update Nimiq Pay to continue"). The matcher took document order, which is not role. `A_HomeDone`'s failure was the same bug one level down: a name inside a card has no title role at all.
**Fix:** `git checkout -- Savborne-handoff.html` and re-ship from the clean file rather than layering corrections. The list now keys on `[screen, text, tag]`, refuses any element whose declared face is not Jakarta, and re-reads its own output to prove every title landed as Silkscreen at the claimed size before writing. Verified afterwards in the browser: 30 screens, 0 Silkscreen below 20px added, every title computed as expected.
**Prevention:** When a selector can match two elements, make the key tuple include the thing that distinguishes them (here: tag and declared face), and add a post-condition that re-reads the output — not just a count of edits.

### [2026-10-31] Pass 2 reported "47 retyped, 0 skipped" while 3 inherited units were untouched
**Symptom:** After the first pass-2 ship, `A_FirstCheckin` and `A_Withdrawal` still rendered their `NIM` units in Silkscreen 14px, while the script printed `47 sites retyped, 0 skipped` and its leftover check found none.
**Context:** `scripts/type-pass2-ship.mjs`. The 47 rendered sites are 44 declarations that name Silkscreen plus 3 spans that declare only a size and inherit the face from the 24px number they sit inside.
**Root cause:** Two errors with one blind spot. (1) `retype()` only *replaced* an existing `font-family`; for a site that never declared one it silently did nothing, and the guard that compared "family present" to "is inherited" used `===` and passed the wrong branch. (2) `findDeclarations()` locates sites by searching for the literal string `font-family: 'Silkscreen'`, so an inherited site can never appear — and the post-check asserted "zero leftovers" with that same blind query. The script's evidence and the script's assertion shared the assumption that failed.
**Fix:** `retype()` now inserts the family when the site is in the explicit inherited list and throws if a non-inherited site declares no family; post-condition 4 asserts the three old span markups are *absent* from the output. The browser caught the defect, not the script: 3 `NIM` units still computed Silkscreen 14px after the "clean" ship.
**Prevention:** A check that reuses the query it is checking proves nothing. Assert the absence of the old markup (or the presence of the new one), not a zero result from the same blind query. When a transform can legally be a no-op, that is a bug in the transform, not a skipped input.

---

## Historical

*(none yet)*

---

## Known Environment Quirks (from research phase)

### Nimiq Pay Mini App WebView
**Symptom:** `window.nimiq` is undefined on page load.
**Context:** Opening a Mini App URL in Nimiq Pay.
**Root cause:** The provider is injected asynchronously after the WebView initializes. Standard page scripts run before injection completes.
**Fix:** Use `@nimiq/mini-app-sdk`'s `init()` function which waits for provider availability before resolving.
**Prevention:** Never access `window.nimiq` directly at module top-level. Always await `init()` first.

### Vercel Hobby Plan — Cron Limitation
**Symptom:** Background jobs don't run frequently.
**Context:** Ranked matchmaking queue needs polling.
**Root cause:** Hobby plan cron jobs run only once per day (not every N minutes).
**Fix:** Design the queue to work entirely on user-triggered polls (client calls every 10 s). No background worker needed.
**Prevention:** Never design features that depend on frequent server-side cron. All periodic logic must be client-triggered.

### Supabase Free Tier — Connection Limits
**Symptom:** Connection pool exhaustion under concurrent users.
**Context:** Multiple users checking in simultaneously.
**Root cause:** Free tier limits direct Postgres connections.
**Fix:** Use Supabase's built-in connection pooler (PgBouncer via the API) or route all DB access through the REST/Edge Function layer.
**Prevention:** Never open direct Postgres connections from Next.js server components on Vercel serverless. Use `@supabase/supabase-js` client only.
