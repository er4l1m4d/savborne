# Handoff prompt — Savborne redesign

Paste everything below the line into a fresh agent.

---

You are taking over art direction and front-end work on **Savborne**, a crypto-saving battle game in the Nimiq ecosystem. A previous agent did roughly fifteen sessions of pixel-art and design-system work with the user. You are continuing, not restarting. Read §"Authoritative files" before touching anything.

## Who you are working with

Solo developer, **zero budget**, ships to Vercel with Supabase, app runs inside the Nimiq Pay mini-app webview. Target is mobile — a real phone, and they have a second Android device for testing.

**They handle all database operations manually.** Write migrations as files for them to paste; never apply them.

They prefer depth over breadth, want complete information rather than summaries, and want to be asked questions with concrete options they can pick — not long prose they have to respond to. Ask one question at a time. Offer 2–4 options with real trade-offs and a recommendation.

## The workflow — keep it exactly as it is

1. **Read the artefact, never describe it from memory.** This is the rule that broke twice. See §Failure modes.
2. **Preview first.** Build the change, show it as a before/after contact sheet or a rendered image, and only ship into `Savborne-handoff.html` after the user signs off.
3. **Ship → verify → paste raw output.** After every ship, run the gates and paste the unedited output. No paraphrasing numbers.
4. **Commit after each verified ship.** Small, reversible, honestly-described commits.
5. **Name your overrides.** If you change a decision the user already made, say so out loud at the moment you do it rather than quietly doing it.
6. **Record the reasoning, not just the result.** Provenance goes in `assets/manifest.json`; rules go in `docs/art-bible.md`; dead ends get written down so nobody repeats them.

## Authoritative files

| File | What it is |
|---|---|
| `Savborne-handoff.html` | **The design artefact.** ~415KB, one enormous line. Screens, tokens, gallery, motion demo. |
| `docs/art-bible.md` | The governing spec. 8 sections: sources, palette, contrast audit, rules, battle state channels, coverage matrix, motion, typography. |
| `assets/manifest.json` | Provenance for every asset decision, including rejected options and *why* they were rejected. Read this before re-proposing anything. |
| `assets/glyphs.json` `badges.json` `characters.json` `items.json` | Derived art, single source of truth for each family. |
| `docs/Savborne-spec.md` | The product spec. Section 8 is badges. |
| `ERRORS.md` | Running log of mistakes and fixes. Add to it. |
| `src/` | The Next.js 16 / Tailwind v4 / Supabase app. |

**`assets-raw/` is gitignored scratch space.** It contains preview pages, contact sheets and abandoned drafts from the previous agent — including pages that *look* authoritative but were never approved. Do not treat anything in there as a decision.

## Verification commands

```
node scripts/art-gates.mjs Savborne-handoff.html   # palette, orphans, contrast
node scripts/glyph-provenance.mjs                  # sourced glyphs vs their SVGs
node scripts/structure-check.mjs                   # tag balance, ids, sprite wrappers
node scripts/grid-census.mjs                       # non-whole display sizes
node scripts/arena-plates.mjs                      # is turn state actually in the file
node scripts/motion-vocabulary.mjs                 # keyframes/tokens actually in the doc
node scripts/type-audit.mjs                        # does src/ obey the type rule
node scripts/font-features.mjs                     # tnum/pnum in the woff2 binaries
node scripts/palette-census.mjs                    # colours really in the pack
npx tsc --noEmit && npm run lint
```

**What these cannot see** — read this before trusting a green result:

- `art-gates.mjs` checks palette membership, orphan pixels and contrast. It **cannot see a wrong fill rule**, a **non-reachable game state**, or whether a grid has **room for a distinguishing detail**.
- Neither `tsc` nor `eslint` looks at CSS at all.
- `structure-check.mjs` compares against `assets-raw/handoff-before-chars.html`, which may be stale.
- A green gate is a floor, not approval. Bible rule 8.

## Failure modes — learn these, they repeat

**1. Describing the artefact from a model of it instead of reading it.** This happened twice in one session and cost two full rewrites.

- Art bible §4 was written specifying channels that had never been rendered anywhere. The user asked to see them live; the file had **no turn state at all** — every nameplate border identical cream, no status tags, no animation. The agent had built a scratch page in `assets-raw/` from the spec and then been "verifying" against it.
- §6 was then rewritten from that same scratch page. `Savborne-handoff.html` already contained nine working `@keyframes`, a timing-token set and a live battle demo that contradicted almost every value the draft proposed. The lunge was `translateX(24px)` on `steps(6)`, not `+9px` on `ease-out`. Damage was a brightness flash plus a shake, not a colour tint that had never existed.

*The fix:* `motion-vocabulary.mjs` and `arena-plates.mjs` read the document. Run them before writing about it.

**2. Gates that can't see the defect.** Four glyphs shipped with pixels eaten out of them because the builder ran one even-odd pass over every ring from every `<path>`. SVG fills each path independently and unions them, so a later path carved holes in an earlier one. Palette, orphan and contrast checks all stayed green. Found only by rasterising the source SVG and the encoding side by side and diffing pixels. Now guarded by `glyph-provenance.mjs` — but only for glyphs.

**3. Drawing a state the game cannot produce.** A "removed" badge was designed for all six badges. `computeBadgeActions()` in `src/lib/game/badges.ts` has a `revoke` path for only three. Every gate passed the impossible states, because reachability is not a pixel property. The user caught it by asking a plain question. **Closed 2026-11-02:** `BadgeArt` in `src/components/Glyphs.tsx` now refuses at render time to draw a state outside a badge's `reachableStates`, so the rule is enforced in code rather than described in prose.

**4. Asserting a technical premise without checking.** The type rule depends on `font-variant-numeric: tabular-nums`, which is a **silent no-op** unless the font ships a `tnum` feature. Verified by Brotli-decompressing the self-hosted woff2 and reading the feature tags: Jakarta's latin subset has `tnum`, two secondary Jakarta subsets do not, and **Silkscreen has no OpenType features at all**. Had it been assumed, the fix would have shipped doing nothing.

**5. Measuring something and reporting the opposite.** A first attempt at the turn signal used a mint border against cream and the agent estimated "1.35:1". Actual measurement: **1.03:1** — no difference at all. Later a check sampled the sprite's *outline* colour, nearly black, and reported a comparison between two blacks.

**6. Silent corruption in mutation scripts.** Greedy regex splices ate closing tags; stale indices applied edits to the wrong offsets; a non-ASCII needle failed to match. Every ship script now: collects matches first, edits **back to front**, asserts expected counts, checks tag balance, and **refuses to write** rather than write something wrong.

## Current verified state

```
0 commits ahead of origin/main — everything pushed as of 2026-11-02
189 art assets audited — 0 FAIL
13 sourced glyphs verified against their SVGs, 0 drift
div 648/648 · svg 166/166 · span 411/411 · ids 66
32 screens (A_Gate and A_Preparing added in pass 3); grid-census exits 1 by
  design at 108 non-whole scales
tsc clean · next build already run and green · eslint 0 errors, 37 pre-existing
  warnings (one is the user's own page.tsx)
working tree: src/app/(tabs)/page.tsx modified (user's own daily-missions work —
  do NOT commit it under your messages); AGENTS.md untracked (written by next dev);
  and an in-progress vault spike (src/app/vault-spike/, @nimiq/core, tsconfig
  ES2020, a SPIKE ONLY bypass in VersionGate.tsx) that is also the user's
```

Two grids only: **16×16 game art**, **24×24 chrome and badges**. `8×8` and `12×12` are fully retired. Glyphs and badges now render as real SVG in the app, not unicode — see §"App wiring".

**`next build` is the only real gate for CSS changes,** and it has now been run green repeatedly (most recently with the badge and move-button work). Keep running it; `tsc` alone cannot see CSS.

## Decided — do not relitigate

- **Badges are flat pictograms**, not roundel + ribbon. Rule 4 rewritten.
- **UI glyphs and badges are sourced from pixelarticons** (MIT, v2.4.2, vendored) at their native 24×24, rather than hand-drawn. Hand-drawn attempts were reviewed and rejected as not readable.
- **Arena surface is a flat panel in the page ground `#0C1211`.** A lit-horizon floor was built, shipped, verified and then reversed by the user the same day. The outline is a 1.38:1 film — accepted knowingly, no palette token fixes it.
- **Ground shadows retired.** The pills measured 1.08:1 against the arena.
- **Turn cue is the nameplate border** — acting = 4px `#C9C1A8`, idle = 2px `#5A6988`, 3.06:1. Sprite opacity `0.62` is reinforcement. The bob is **decoration carrying no information**.
- **Glow = gilt `#FEE761` silhouette rim**, meaning "an effect has been applied to this fighter". Covers defend and item identically.
- **Type:** Silkscreen ≥20px, Jakarta <20px, tabular numerals via `.num`. No third font — Space Mono rejected.
- **Headers stay uppercase.** The agent recommended sentence case; the user overruled. Their call.
- **Rival roster** of four named AI opponents, rolled randomly per battle. **Heroine** sprites share every gear body pixel-for-pixel with the hero; only the head differs.
- **Badge states are trimmed to reachable ones** — 15 of 18. `first_steps`, `first_blade`, `steady_hand` have no revoke path.

## Remaining work, in order

**1. Stream 3 remainder — DONE (stale).** A type specimen for the 20px boundary already exists: `#type` under Tokens in the handoff has the 8-row face table. Nothing left here.

**2. Stream 4 — stat cards and move buttons — DONE 2026-11-02.** The rating / wins / check-in decision was made: three tiles (Rating / Wins / Check-ins), with wins-losses-ties collapsed into a single record line so nothing the six tiles carried is lost. The move button was reconciled to the documented one — 84px column, 24px glyph above an 18/700 label, and `Special Move` keeps one label with a small `cooldown 1` corner note instead of wrapping to a longer string. Icons come from `assets/glyphs.json` via `src/components/Glyphs.tsx`.

**3. Stream 2 leftovers — two named blockers, both code:**
   - **Glow rim asset.** Needs a pre-baked 8-neighbour `#FEE761` silhouette rim path per character in `assets/characters.json`. `scripts/glow-candidates.mjs` is the reference. `filter: drop-shadow` is wrong — it anti-aliases. A 4-neighbour rim renders as a dotted outline.
   - **Timeout flag.** `battleServer.ts` auto-plays `defend` on deadline and the payload reports it as a chosen move, so the client cannot distinguish them. Needs an `auto` / `move_source` column and route change. Until then: we can show *what* they played, never *why*.

**4. Stream 6 — profile head-crop avatar.** Blocked on an `appearance` DB column. Note the tradeoff already found: a head crop **loses the gear signal** that tells you what bracket someone is in.

**5. App wiring, the honest list:**
   - **Badges are now wired** (2026-11-02). `/profile` renders the real earned/locked art from `assets/badges.json` via `BadgeArt`, which also refuses to draw a state the game cannot produce. `src/lib/game/badges.ts` supplies names and descriptions.
   - **`/api/profile` still filters `revoked_at IS NULL`**, so revoked badges never reach the client — the profile can only ever show earned or locked, and a player who loses Week Warrior to a withdrawal only finds out from the home check-in panel's "Revoked" line. There is no permanent record of a lost badge on the profile. Decided against for now: showing `removed` on the profile was considered and deferred, because it needs `/api/profile` to return entitlement rather than active badges — a change other screens read. Revisit deliberately, not by accident.
   - The home award panel (`src/app/(tabs)/page.tsx`) still renders `◈ Earned` / `◇ Revoked` as **text**. That is the natural place for the `removed` badge art, but the file has the user's uncommitted work in it. Natural next wiring step.
   - `--sprite-well` is defined and mapped but still never used in `src/`.
   - Settings glyph renders at 22px on a 24px grid — genuinely non-whole, still real (see the two `24x24 art shown at 22px` lines in `grid-census`). The other 106 census hits are artefacts of the doc's `scale(.7)` preview and are not real.
   - `.num` was used in 14 places and defined nowhere; fixed 2026-10-30. Watch for the same shape of bug elsewhere.

## First thing to do

Say hello, then **run the verification block above and report what you find**, before asking the user anything. If your numbers don't match §"Current verified state", something has changed and you need to know that first.

Then ask which of the remaining items to take. Streams 3 and 4 are done, so the live choices are the glow rim asset, the timeout flag, Stream 6, and the remaining app wiring above.
