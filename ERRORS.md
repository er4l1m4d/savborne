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

### [2026-11-01] Pass 3 shipped a phone icon with 2 orphan pixels; only `art-gates` could see them
**Symptom:** `node scripts/art-gates.mjs Savborne-handoff.html` reported `FAIL  Phone showing Savborne (24x24)  ORPHANS: 2` — 188 pass, 1 FAIL — on an icon I had written by hand, read back, and found nothing wrong with.
**Context:** The `A_Gate` screen added by `scripts/close-document-ship.mjs`, a 24x24 pixel-art handset at 72px inside the 132px `.pxw/.px` panel.
**Root cause:** Two separate blind spots stacked. (1) The icon was hand-authored as path data, and the interior app tiles were written as `h1v18h-1z` — **vertical** strips — which is legal SVG and reads correctly by eye. `art-gates` reconstructs a bitmap from `1px`-tall horizontal runs only (`M(\d+) (\d+)h(\d+)v1h-\3z`); the vertical strips were simply invisible to it, so the pixels it *could* see were isolated and it reported them as orphans. The gate was not wrong about what it could parse; my markup was outside the dialect it audits. (2) Reading the markup could never have caught it, because the defect is a property of the reconstructed bitmap, not of any single line.
**Fix:** The icon is now generated from a `PHONE_GRID` array of 24x24 cells and emitted through one function, `pathFromGrid()`, which can only produce the run form the gate parses. The ship script rebuilds the bitmap from its own emitted markup, re-runs the same 4-neighbour test, and throws before writing if any pixel has no neighbour. The defective ship was discarded with `git checkout -- Savborne-handoff.html` and re-shipped from the clean file. `art-gates` now reports `189 art assets audited — 0 FAIL, 189 pass`.
**Prevention:** If a checker must parse your output, generate the output in the checker's dialect rather than in whatever dialect is easiest to type — and then run the checker's *own* test inside the generator, so the defect is caught before the artefact is written, not after. A gate reading only the subset of the markup it understands will report false orphans on the rest; that is a signal to change the markup, not to relax the gate.

### [2026-11-01] Off-grid Silkscreen numerals invisible to every scan; found by reading the file
**Symptom:** Seven Silkscreen numerals at sizes 21, 29 and 51 — all off the 4px grid the art bible declares a bug — had survived passes 1 and 2 and were reported by no gate.
**Context:** `A_Profile` (three stat tiles), `A_Withdrawal` (a value and its coral pair), `A_Queue` (`0:42`), `A_QueueTimeout` (`3:05`) in `Savborne-handoff.html`. The profile tiles and the queue timer were found by reading the file during this pass, not by any script.
**Root cause:** `grid-census.mjs` audits **art** viewBox scales, not type sizes; `type-audit.mjs` checks Silkscreen below 20px and `.num` usage in `src/`, not Silkscreen size multiples in the artefact; and pass 2's scope was explicitly "below 20px", which all seven of these are above. Each tool was correct within its remit and the site fell between all three remits.
**Fix:** All seven snapped onto the grid (21→20 ×5, 29→28, 51→52), and `close-document-ship.mjs` now asserts that **no** Silkscreen size outside the 4px grid survives anywhere in a screen frame. The technique that made the snaps reliable is recorded too: a bare style string is ambiguous because the plain 21px style is a literal substring of the coral variant, so every snap is anchored to the value text it sets and the old style is asserted *absent* afterwards.
**Prevention:** A rule stated as absolute ("a Silkscreen size that is not a multiple of 4 is a bug") needs a check that is equally absolute. Scope-limited passes leave the complement unaudited, so when a pass fixes "all X below a threshold", add the whole-set assertion for the property, not just the slice it touched.

### [2026-11-02] `bible-typography.mjs` silently deleted the typography pass history from `assets/manifest.json`
**Symptom:** Running the script after a documentation edit rewrote `assets/manifest.json` and dropped `typography.measured`, `typography.pass1`, `typography.pass2` and `typography.pass3` — roughly 45 lines of recorded rationale, measurements and defects. The script printed `manifest updated and re-parsed OK` throughout, because a valid JSON file with fewer keys still parses.
**Context:** `scripts/bible-typography.mjs:25`. The script was written once, when `typography` held only the initial decision. Every later pass appended its own record to the same object.
**Root cause:** It assigned a fresh object (`j.typography = { ... }`) instead of merging. Assignment to an object key is a total replacement, so any key unknown to this script was destroyed. Nothing in the script compared key counts before and after.
**Fix:** It now spreads the existing object first (`{ ...j.typography, ... }`) and only overwrites the keys it owns. Verified by running it and asserting `pass1`/`pass2`/`pass3`/`measured` still exist afterwards (14 keys before and after). The two rule strings it does own were also corrected to the pass-3 size rule, and it now records the balance build gap.
**Prevention:** A script that regenerates one section of a shared document must merge into it, not replace it — and should assert that the key count did not shrink. "The file re-parsed" proves syntax, not data. This is the same failure shape as the post-checks in the pass-2 and off-grid entries above: the assertion shared the blind spot of the code that made the change.

### [2026-11-02] `Transaction.fromHex` does not exist in `@nimiq/core` 2.x
**Symptom:** Deserializing the wallet's broadcast result failed: `Transaction.fromHex` is not a function (and no `fromHex` appears in the installed type definitions), even though guides and older snippets use it.
**Context:** `normalizeTxHash` in `src/lib/nimiq.ts`, needed because `sendBasicTransaction` is documented as returning "the serialized transaction" but has been observed returning a plain hash.
**Root cause:** The 2.x SDK renamed its parser. The correct entry point is `Transaction.fromAny(...)`, which accepts a hex string. The similarly named `fromHex` from 1.x was removed.
**Fix:** The 64-hex branch short-circuits without loading WASM; anything longer lazily imports `@nimiq/core/web` and calls `Transaction.fromAny(trimmed).hash()`.
**Prevention:** Read the installed `.d.ts` (`node_modules/@nimiq/core/types/...`) before calling an SDK method you have only seen in docs. `npm run build` catches the JS case, but only if the import is static — this one is dynamic by design.

### [2026-11-02] `getBalance` is not a Nimiq node RPC method; use `getAccountByAddress`
**Symptom:** `getBalance` against `rpc.nimiqwatch.com` returned `Method not allowed`, so every server-side balance read failed.
**Context:** `src/lib/vault/rpc.ts`, the runtime-agnostic client used by check-ins and settlement.
**Root cause:** Two different APIs were conflated. The **wallet provider** (`window.nimiq.getBalance`) exposes `getBalance`; the **node JSON-RPC** exposes `getAccountByAddress`, whose result carries `balance` in Luna. The server never has a wallet provider.
**Fix:** `getAccount()` calls `getAccountByAddress` with `params: [address]` and maps `data.balance`. A unit test asserts the client never calls `getBalance`.
**Prevention:** When moving logic from the WebView to a server route, re-probe the transport. Wallet method names are not node method names.

### [2026-11-02] An unfunded address is not a 404 — it is HTTP 200 with `balance: 0`
**Symptom:** Probing a never-used testnet address returned `{"data":{"balance":0,"type":"basic"}}` at HTTP 200. Any "address not found" branch built on an error response would never fire, and any balance path that treated an empty account as an outage would 503 for a brand-new user.
**Context:** `src/lib/vault/rpc.ts` and every caller of `getAccount` (check-ins, settlement).
**Root cause:** Nodes materialise a basic account view for any well-formed address. Absence of funds is a valid state, not an error.
**Fix:** An unfunded vault settles to `balanceLuna: 0` and a null bracket; only a transport/RPC failure is `RpcError('unreachable')` and a 503. Verified live: an unfunded address returns `balance: 0` at HTTP 200, and the balance path treats that as zero rather than as an outage.
**Prevention:** Distinguish "no data" from "zero data" by probing the live service once and encoding the observed shape, not the assumed one.

### [2026-11-02] Settling before reading the balance stranded money side effects
**Symptom:** Found in review, before it shipped: if `getAccount` failed after the transfer row was flipped to `included`, every later poll short-circuited on `status !== 'pending'`, so the player's bracket, balance, withdrawal flags, badge revocations and item unlocks were **permanently** skipped for a transfer the chain had accepted.
**Context:** `pollAndSettle` in `src/lib/vault/settle.ts`, step 5–7.
**Root cause:** Ordering. The terminal-state write happened before the last read it depended on. The state machine correctly refuses to re-settle, which turns any post-transition failure into an unrecoverable one.
**Fix:** Read the vault account first, then perform the conditional `status = 'pending'` update, then run the side effects. A failure before the update leaves the row pending and retryable. Three fake-DB tests lock the ordering in (`settle.test.ts`).
**Prevention:** In a state machine with a terminal state and side effects, do every read before the transition. Ask: "if the process dies on the next line, can a retry still finish the job?" If not, the transition is in the wrong place.

### [2026-11-03] `node:test` + `tsx` cannot mock modules: no top-level await, no `mock.module`, sealed exports
**Symptom:** Four failed probes in a row: `Top-level await is currently not supported with the "cjs" output format`; `mock.module is not a function`; `Cannot set property supabaseAdmin of #<Object> which has only a getter`; `Cannot redefine property: supabaseAdmin`.
**Context:** Writing route-level tests (`src/app/api/**/route.test.ts`) that need a fake database, with the harness command `node --import tsx --test "src/**/*.test.ts"`.
**Root cause:** `package.json` has no `"type": "module"`, so tsx emits CJS. `node:test`'s module mocking requires ESM, and tsx compiles named exports into accessor properties that are neither writable nor configurable.
**Fix:** Do not mock modules. Install a fake at `globalThis.fetch` — the seam supabase-js and the Nimiq RPC client both use, resolved lazily at call time (verified across multiple tests in one process). `src/test/fake-net.ts` provides `installFakeNet(handler)`, `nodeTx()`, `rows()` and call recording. Production code needed no injection seam.
**Prevention:** Before designing test seams, spend five minutes proving which ones the harness actually supports. Prefer an existing global boundary over a new abstraction; the fake is stricter (unmatched calls throw) and works on real route handlers.

### [2026-11-03] A fake PostgREST must answer `.single()` with a bare object
**Symptom:** `POST /api/vaults` returned 201 but the serialized vault fields were `undefined`; 14 of 15 tests passed, so the failure looked like a route bug.
**Context:** The first version of `src/test/fake-net.ts` always replied with a JSON array.
**Root cause:** supabase-js sends `accept: application/vnd.pgrst.object+json` when the builder ends in `.single()`, and PostgREST answers with a bare object. `.maybeSingle()` sends no such header and unwraps an array itself. Serving an array to `.single()` yields `data` = the array, so `row.card_token` is `undefined`.
**Fix:** `FakeCall.wantsSingleObject` records the header, and the fake normalizes a one-element array to a bare object on 2xx replies. Tests can then always describe results as row arrays.
**Prevention:** When faking a wire protocol, reproduce the *request* headers that change the response shape, not just the URL and body. Two builders that look interchangeable in TypeScript are different protocols here.

### [2026-11-03] PowerShell and the test runner read `[hash]` in a path as a wildcard
**Symptom:** `node --test "src/app/api/transfers/[hash]/route.test.ts"` reported zero tests from that file and ran the others; `Copy-Item`/`Get-Content` on the same path failed with "Cannot find path".
**Context:** Testing Next.js dynamic routes on Windows/PowerShell, and mutation-testing them by copying the file to a temp backup.
**Root cause:** `[...]` is a character class to both PowerShell's path resolution and the Node test runner's argument globbing, so the literal filename is not found.
**Fix:** Run via a glob that consumes the brackets (`src/app/api/transfers/**/route.test.ts`; the project's `npm test` pattern already does this) and use `-LiteralPath` for every file operation.
**Prevention:** On Windows, never pass a bracketed path as a literal argument. After a "passing" test run, check the reported test count — a silently skipped file looks like success.

### [2026-11-03] Vercel build failed in `next/font/google` on a docs-only commit
**Symptom:** `npm run build` on Vercel died after ~21 s with 20 errors, all `Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'` and `Error while looking up import map: next/font/google queries have exactly one entry`, every one tracing to `[next]/internal/font/google/plus_jakarta_sans_cbbbef67.module.css` ← `./src/app/layout.tsx`. The commit it built (`4bc6d1a`) changed two markdown files and nothing else.
**Context:** Vercel build of `main`, Next 16.4.1 + Turbopack, `vercel build` with a restored build cache. The same commit built clean locally (`✓ Compiled successfully in 7.8s`), so the failing layer was the build's network fetch, not the app code.
**Root cause:** `next/font/google` resolves Google Fonts **at build time**: Turbopack fetches the `css2` stylesheet, rewrites each `@font-face` `src` to an internal `@vercel/turbopack-next/internal/font/google/font?{json}` request, then downloads each woff2. Turbopack parses that query with `qstring` and bails when it does not split into exactly one entry, so any Google response whose font URLs contain `&` — the extensionless `/l/font?kit=...&skey=...` form, or a 404 on a font file — surfaces as "Module not found". Upstream: vercel/next.js#99114, #97344, #97376. Which response variant you get varies by IP/PoP and by cache state, which is why it is intermittent and why "retry the deploy" and "clear the cache" only sometimes help.
**Fix:** Removed the build-time dependency. The three latin woff2 files (Jakarta variable 200–800, Silkscreen 400 and 700) are vendored in `src/app/fonts/`, loaded with `next/font/local` in `src/app/layout.tsx`, keeping the same `--font-jakarta` / `--font-silkscreen` variables, weights, latin subset and `display: swap`. `npm run fonts:vendor` (`scripts/vendor-fonts.mjs`) re-pins them and asserts the `wOF2` magic. Verified with a clean `.next` build: the three files are emitted to `.next/static/media`, the CSS declares `--font-jakarta: "jakarta", "jakarta Fallback"` and `--font-silkscreen: "silkscreen", "silkscreen Fallback"`, and a grep of the build output finds zero `fonts.googleapis.com` / `fonts.gstatic.com` / `@vercel/turbopack-next/internal/font` references.
**Prevention:** Treat "asset fetched during build" as a release dependency. Any loader that downloads at build time (`next/font/google`, remote image/icon pipelines) can fail a deploy with no code change to blame. Vendor the bytes, keep a script that regenerates them, and check that the build output contains no reference to the remote host. The local build passing is not evidence the Vercel build will — same code, different network.

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
