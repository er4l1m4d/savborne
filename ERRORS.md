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
