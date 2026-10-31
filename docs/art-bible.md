# Savborne Art Bible v1.0

Governs all pixel art in `Savborne-handoff.html` and the future `src/` assets.
Every art pixel must live inside the declared palette. UI chrome (text, panels, bars) keeps UI tokens — the two systems are separate and meet only at borders.

## 1. Sources (verified, not remembered)

| Source | Status | Evidence |
|---|---|---|
| **Kenney "Tiny Dungeon" 1.0** (05-07-2022), CC0 | **ADOPTED — primary game-art material** | `assets-raw/kenney_tinydungeon/` (zip from opengameart.org mirror of kenney.nl; in-pack `License.txt` = CC0). 132 tiles, 16×16, 27 colors. |
| Kenney "RPG Icons" | **DOES NOT EXIST** (404) | probed 2026-10-16 |
| "16×16 Game Assets" | **REJECTED** — George B., **CC-BY 4.0** (attribution required), not Kenney, not CC0 | OGA page license badge |
| Kenney `game-icons`, `input-prompts`, `ui-pack` | not adopted — not pixel-art grids matching Tiny Dungeon language | kenney.nl pages 200, packs are flat UI/gamepad prompts |
| Benchmarks for critique: Stardew Valley item icons, Luna characters | reference only, never traced | named for silhouette comparison |

## 2. The palette (measured from `tilemap_packed.png` — 28 PLTE entries, 27 distinct colours actually painted)

Census taken 2026-10-17 by `scripts/palette-census.mjs`, which counts opaque pixels only. **Every one of the 27 is now declared here and in `art-gates.mjs`** — an earlier version of this section listed 27 hexes but three of them were UI tokens and three real pack colours were missing, so the gate would have failed a tile that legitimately used them (`#FEC99C` was the one that mattered: it is the light step of the copper floor at r4c1).

Neutrals and outline: `#3F2631` 7728px (near-black plum — the pack's outline colour), `#8B9BB4` 3515, `#C0CBDC` 2989, `#262B44` 2930, `#52607C` 1625, `#FFFFFF` 275, `#5A6988` 46, `#E4EDF9` 16, `#AAB7CC` 2
Warm, leather, skin: `#EAA56C` 3013, `#763B36` 2790, `#BD6C4A` 1608, `#CF8254` 363, `#F7C282` 324, `#E19A65` 73, `#FEC99C` 11
Accents: `#43E1B3` 113, `#E84537` 112, `#FF706D` 64, `#25956A` 63, `#9B4CA3` 62, `#D176D0` 24, `#0099DB` 24, `#69FFD4` 22, `#75E3FF` 20
Gilt: `#FEAE34` 12, `#FEE761` 6 — the pack barely uses its own gold ramp, which is why the gilt map is a declared recolor rather than a re-draw.

Material ramps (light→dark, taken from the pack's own usage):
- **Steel/silver**: `#E4EDF9` → `#C0CBDC` → `#8B9BB4` → `#52607C` (deep shadow `#262B44`; `#AAB7CC` is a one-off mid step)
- **Copper/bronze**: `#FEC99C` → `#EAA56C` → `#CF8254` → `#BD6C4A` (deep `#763B36`)
- **Gilt/gold**: `#FEE761` → `#FEAE34` (deep `#BD6C4A`)
- **Cloth cream**: `#F7C282` → `#E19A65` → `#BD6C4A`
- **Leather/wood**: `#BD6C4A` → `#763B36` → `#3F2631`
- **Mint (hero accent)**: `#69FFD4` → `#43E1B3` → `#25956A`
- **Coral/red (rival accent)**: `#FF706D` → `#E84537` → `#763B36`
- **Magic blue**: `#75E3FF` → `#0099DB`; **Purple**: `#D176D0` → `#9B4CA3`

**These are art colours only.** UI chrome keeps UI tokens; the two systems are separate and meet only at borders. Where an art asset must echo a UI accent, the mapping is declared, not improvised: `--sv-mint #6FD0AE→#43E1B3`, `--sv-coral #F2735A→#E84537`, `--sv-text #F3EEDD→#F7C282`, ink `--sv-ground→#3F2631`. `#6FD0AE`, `#F2735A` and `#F3EEDD` are **not** pack colours and must not appear in art.

**Round-2 audit finding:** the current hand-drawn art uses `#D9A066 #8A5A2B #E08A5B #C9D3DC #7A8B94 #E8C14A #9A7420` — **none are in the pack palette**. All round-2 art fails palette audit and is subject to rework (this bible exists because of that failure).

## 2b. Contrast audit vs UI backgrounds (measured 2026-10-16, `art-gates.mjs`)

Pack colors below 3:1 against `--sv-ground #0C1211`:

| Color | vs ground | Role | Ruling |
|---|---|---|---|
| `#3F2631` | 1.38:1 | pack outline/darkest shadow | **allowed as interior outline/shadow only** — never alone as an icon fill |
| `#262B44` | 1.36:1 | deep steel shadow | same |
| `#763B36` | 2.21:1 | deep bronze/leather shadow | same |
| `#52607C` | 2.99:1 | mid steel | allowed (mid-ramp, never sole carrier) |

**Director's ruling:** no ramp is brightened — the four failures are the pack's *structural* darks; lifting them (mechanical minimums: `#6F5C65`, `#5C6073`, `#86534E`) would destroy its shading model. Enforcement moves to the **asset-level gate**: every icon/sprite must contain ≥1 color at ≥3:1 vs ground (WCAG 1.4.11). If a future asset must carry meaning in a dark color alone, use the listed lifted hex.

## 3. Rules

1. **Light source: top-left.** Highlight pixels sit on top/left edges of a material; the darkest ramp step on bottom/right. (Verified against pack knight tiles: helmet highlight top-left.)
2. **Outline: single row of `#3F2631`** on the silhouette edge where the pack uses one; interior shapes unoutlined.
3. **Grids:** tiles/items 16×16 (pack-native). Characters 16×16 (pack-native — supersedes the invented 16×24). **UI chrome glyphs and badges 24×24** — supersedes the invented 12×12 and the invented 8×8, and chosen so third-party pixel icons can be used at their native grid instead of being resampled. **8×8 is retired: zero instances remain.** Display scales are whole multiples only (16→48/96, 24→24/48/72/96) with `image-rendering: pixelated`; 36px and 18px are not whole multiples of either grid and were removed.
4. **Silhouette language:** weapons = diagonal, tip up-right; containers = bottom-heavy mass with visible opening top-left; tools = circular head + grip; characters read at 1× as head+shoulders mass. **Badges are flat pictograms — NOT roundel + ribbon.** This supersedes the original rule 4 wording, which specified "badges = roundel + ribbon": at any grid small enough to sit on a profile card there is no room for a roundel, a ribbon and an identifying mark, and the badges that rule produced were single-colour stamps that satisfied neither it nor the eye. Badges now take one pictogram from the licensed icon set and carry state via a corner chip, not via ornament.
5. **Every asset passes:** palette membership, no orphan pixels (any painted pixel with no 4-neighbour), silhouette-identifiable when flooded to solid `#3F2631`, and readable in grayscale.

6. **An action glyph may not duplicate the silhouette of an ownable item.** Three glyphs broke this and were fixed: `Defend` was a filled shield (the Bronze Shield item is a filled shield) → now an outline; `Use item` was a bag (the Cloth Purse is a bag) → now a backpack with a different construction; `Special Move` was a three-point crown (Golden Crown is an ownable badge) → now `zap`. Object-shaped icons standing in for actions must be visually distinct from the item of the same name, or replaced.
7. **Gallery labels name functions, not objects.** The glyph gallery used to read `shield` and `bag`, which hid the fact that they were the Defend and Use item buttons and made them look like stray chrome. Every entry is now labelled with what it does.
8. **The gate is a floor, not a quality bar.** `art-gates.mjs` checks palette membership, orphan pixels and contrast. It passed a badge drawn at 8×8 that has no room left for a distinguishing mark, because "unusable" and "passes the checks" are different questions. Where an asset must carry an identifying detail, measure that the grid has room for it and render a sheet — never treat a green gate as approval.
9. **A gate cannot see a wrong fill rule.** Four shipped glyphs (`leave`, `useItem`, `flag`, `withdrawal`) had pixels missing because the builder ran one even-odd pass over every ring from every `<path>`; SVG fills each path independently and unions them, so a later path carved holes in an earlier one. Palette, orphans and contrast all stayed green. The only check that catches this compares against an independent renderer of the source — so `scripts/glyph-provenance.mjs` now re-derives every sourced glyph from its vendored SVG and fails on any drift, and any new sourced art must go through it.
10. **Art may not depict a state the game cannot produce.** Three badges were drawn in a "removed" rendering — First Steps, First Blade, Steady Hand — for which `computeBadgeActions()` in `src/lib/game/badges.ts` has no `revoke` path at all. Every gate passed them: palette, orphans, contrast, provenance. Reachability is not a pixel property, so no art gate can catch it; the check is reading the state machine the asset is supposed to represent. `assets/badges.json` now carries `revocable` and `reachableStates` per badge, derived from the code, and the gallery renders from that field rather than from a cartesian product of every state — so if a revoke path is added later, the art set changes when the *rule* changes, not when someone remembers.

## 4. Battle state channels — REVISED 2026-10-30 (2nd revision), supersedes 2026-10-17

Every battle state must be legible without reading a word of text. To keep it that way, **each channel carries exactly one meaning**, with a value scale. A state may compose several channels; no channel may serve two meanings, and no state may claim a channel already assigned below.

### Scope — and what a channel is

**This table governs the two battle sprites and their nameplates, and nothing else.** General UI motion in §6 — entrances, bar fills, level-up, tick, the thinking indicator — is transition and feedback, not state, and is free of the exclusivity rule. Narrowing the scope is a correction: the previous revision implied it covered all motion, and the document's own keyframes had already broken that claim four times over.

**A channel is a perceptual gesture, not a CSS property.** Lunge and shake both animate `translateX`, and both are legitimate, because they are distinguishable without reading anything — one-way and committed versus two-way and decaying. What may not happen is two meanings riding the same *gesture*. Judging it by property instead of gesture would forbid a great deal of good animation and protect nothing.

| Channel | Its one meaning | Values, as implemented |
|---|---|---|
| **nameplate border** | **control state — the primary, motion-independent cue** | acting = **4px solid `#C9C1A8`** · idle = **2px solid `#5A6988`** · committed = **2px dashed `#5A6988`** |
| **nameplate tag** | status label; the explicit layer under the border | `YOUR MOVE` · `THEIRS` · `ACTED` · `OFFLINE` |
| **sprite opacity** | waiting — reinforcement of the border, never the cue | `1` acting · **`0.62` not acting** |
| **opacity + scale together** | defeated | `0.55` **and** `84`, never either alone |
| **scale** | outcome magnitude | `108` winner · `84` loser · equal in a tie |
| **lunge** (one-way horizontal) | aggression | `0 → translateX(24px) → 0`, 450ms `steps(6)`, attacker's resolving beat only |
| **impact** (brightness flash + two-way decaying shake) | damage received | `filter: brightness(2.2)` 400ms `steps(4)` **plus** `translateX ±6px` 300ms `steps(5)` |
| **glow** (gilt silhouette rim) | **an effect has been applied to this fighter** — claimed 2026-10-30 for defend and item-use | 1px rim `#FEE761`, 8-neighbour silhouette. **Not yet implemented**; needs a pre-baked rim path per character |
| **bob** (small vertical) | **decoration only, carries no information** | `0 → −2px, steps(1)` on the acting fighter. Demoted 2026-10-30, see consequence 3 |
| **ground shadow** | floor contact | **retired 2026-10-17.** Never carries state |

**`#FF706D` is not a damage cue and never was implemented as one.** The previous revision specified damage as a colour tint to that hex; the document's own `.sv-hit` uses a brightness filter and a shake, and has always done so. Adopted as specified.

### The state grid

| State | plate border | plate tag | sprite opacity | scale | lunge | impact | glow |
|---|---|---|---|---|---|---|---|
| **your turn** | **acting 4px** | `YOUR MOVE` | 1 you · .62 them | standing | — | — | — |
| **their turn** | acting 4px on theirs | `THEIRS` | .62 you · 1 them | standing | — | — | — |
| **committed** | **hatched** on yours | `ACTED` | .62 you | standing | — | — | — |
| **resolving** | unchanged | unchanged | unchanged | standing | **fires** on attacker | **fires** on victim | — |
| **defend / item** | unchanged | unchanged | unchanged | standing | — | — | **fires** |
| **won** | neutral | — | 1 | 108 winner · 84 loser | — | — | — |
| **lost** | neutral | — | **0.55 + 84** on the loser | — | — | — | — |
| **tie** | neutral | — | 1 · 1 | **equal** | — | — | — |
| **disconnected** | idle | `OFFLINE` | unchanged | standing | — | — | — |

### Consequences of the rule, not exceptions to it

1. **A tie must not dim either fighter.** Opacity means defeated and a tie defeats nobody. Shipped that way: `A_Tie` has no opacity anywhere in its arena and both sprites stand equal.
2. **Disconnected gets no sprite channel.** It is a match-level state, so it lives in the plate tag and the screen dim. Giving a fighter opacity would make a dropped connection look like a knockout.
3. **The bob is decoration, because measurement killed it as a cue.** It was specified as `0 → −1px, steps(2)` with the claim that it "survives the grayscale blink test" — written before anything was rendered. At the shipped size a 2px travel on a 104px sprite is **1.9% of its height** and was invisible in a zoomed render with a ruler beside it. It stays so the active fighter does not look frozen, and a reduced-motion user loses nothing by its absence.
4. **The border is the cue, and it had to be rebuilt to deserve the job.** The original spec was "lit mint `#6FD0AE` versus neutral cream `#C9C1A8`", which measures **1.03:1** — a hue difference on a 2px line, invisible in grayscale and against colourblindness, while the plate's own HP bar is the same mint in a shape seventy times louder. It is now a luminance and weight difference: **4px `#C9C1A8` against 2px `#5A6988`, 3.06:1**. `#5A6988` is taken from the pack census rather than blended, and was chosen so the idle border still clears 3:1 against the arena on its own (**3.43:1**) — the rendered proposal used `#545147` at 2.38:1 and was not shipped.
5. **Sprite opacity at `0.62` and defeated at `0.55` do not collide, and that is a load-bearing fact, not luck.** `battleServer.ts` writes the HP clamp and `status: 'completed'` in the same update, so there is no frame in which a fighter is at 0 HP while a turn is live — the two states can never co-occur. Defeated is also never opacity alone: it is opacity **and** the shrink to 84. **If a mid-battle knockout animation is ever added, this rule breaks and must be amended first.**
6. **`prefers-reduced-motion` no longer degrades the design.** The original consequence 5 conceded that reduced-motion users were left with a weaker signal. After consequences 3 and 4 the primary cue is static by construction, so the collapse removes only decoration. The document implements the collapse in JS via a `reduce` flag from `matchMedia`, plus a CSS media query.
7. **Turn state exists in three arenas and cannot exist in four.** `A_Battle`, `A_InBattleWait` and `A_ConnLost` carry nameplates and now carry the treatment. `A_ItemSheet`, `A_Win`, `A_Loss` and `A_Tie` have **no nameplate at all** — they are two sprites on a bare panel — so there is no border to light and no tag to show. That is the same gap consequence 8 records for ground contact, and it is why the arena backdrop in §5 is open work rather than polish.
8. **Ground shadows are retired, not reassigned.** The arena pills measured **1.08:1** against the arena floor — effectively invisible — and no token in the set is dark enough for a hard-edged shadow to read without inventing a new colour. Deleted from the five arenas that carried them on 2026-10-17 (`A_ConnLost` never had one). `A_Win`, `A_Loss` and `A_Tie` now have neither a ground cue nor a nameplate. If shadows return they return as a decided token, not an ad-hoc `rgba()`.
9. **The plate has no fill to dim.** The arena surface reversal made the arena `#0C1211`, which is what every nameplate already used as its background, so plates are now border-only. Every control-state signal therefore has to live in the border, which is what consequence 4 provides and what any future change must not weaken.
10. **This section was wrong twice, in the same way, and the check that catches it is not a gate.** The first revision specified channels that had never been rendered. The second was written against a scratch preview I had authored, and the document already contained a working motion vocabulary that contradicted it — `sv-lunge` travels 24px on `steps(6)`, not 9px on `ease-out`, and `.sv-hit` has always been a brightness flash plus a shake rather than a colour tint. Both errors were the same error: **describing the artefact from a model of it instead of reading the artefact.** `scripts/motion-vocabulary.mjs` is the read; run it before amending §4 or §6.

### Shipped state, verified

`arena-plates.mjs` on 2026-10-30: `A_Battle` tags `[YOUR MOVE]` with a `#5A6988` idle border and rival sprite opacity `0.62`; `A_InBattleWait` tags `[THEIRS, ACTED]` with a dashed idle border and hero sprite `0.62`; `A_ConnLost` tags `[OFFLINE]`; `A_Win` and `A_Loss` carry `0.55` on the defeated sprite only; `A_Tie` carries no opacity. Counts in the file: 2 acting plates, 3 idle or hatched, 2 sprite opacities at `0.62`. 187 assets audited, 0 FAIL.

## 5. Coverage matrix — HUMAN-VERIFIED 2026-10-16 (contact sheet + user confirmations)

Earlier guesses were partly wrong (r0c0 is a floor tile, not a scroll; r7c0 is a wizard, not a king). Verified identities below:

| Savborne slot | Tiny Dungeon tile (verified) | Status |
|---|---|---|
| Hero · Entry gear | r7c1 (tile_0085) orange-haired youth, plain clothes | SHIPPED |
| Hero · Bronze gear | r8c2 (tile_0098) youth with steel shoulder plate | SHIPPED |
| Hero · Silver gear | r8c0 (tile_0096) full steel knight | SHIPPED |
| Hero · Gold gear | r8c0 recolored via gilt map: `C0CBDC→FEE761, 8B9BB4→FEAE34, 52607C→BD6C4A, 262B44→763B36`, outline/skin kept | SHIPPED (quantized recolor) |
| Heroine · Entry / Bronze | **composite, pack tiles only:** head = r8c3 rows 0–9 clipped to cols 2–13 (drops the one column of loose hair that made her head wider than the hero's; both tiles put eyes at cols 6 and 10, so the face lands identically) + the gear tile's rows 10–15 **verbatim** | SHIPPED |
| Heroine · Silver / Gold | closed helm is r8c0 rows 0–9 **verbatim** (no face to swap) + 4 hair pixels at row 10, cols 5,6,9,10 — outline cells only, so no armour cell is lost. Gold = Silver heroine through the same gilt map. Verified by `scripts/heroine-check.mjs` (13 invariants) | SHIPPED |
| Rival roster (AI opponent) | **four tiles, one rolled per battle:** Mint Wraith r9c0 · Hollow Ghost r10c1 · Hooded Miser r9c3 · Cutpurse r9c1. Uniform across the pool, fixed for the life of a battle (derived from battle id, so polling never re-rolls). Each carries its own name into the UI ("Mint Wraith wins", not "Savborne AI wins"). Friend battles always show a human gear sprite | SHIPPED (art) |
| Rejected rival tiles | r8c8 = a **sword**, not a creature (user dropped it); r7c3 = white-haired goblin, superseded by the four-rival roster | REJECTED — do not reinstate |
| Item · Silver Blade | r8c10 (tile_0106) broad steel sword | DECIDED — no kitbash needed |
| Item · Bronze Shield | r8c6 (tile_0102) steel heater shield → bronze ramp recolor | DECIDED |
| Extra weapon art | r8c8 sword, r8c11 bronze-hilt sword w/ red gem, r9c9 hammer, r9c11 axe, r10c9 dagger | available |
| Item · Ledger Scroll | **RENAMED → "Ledger Tome" (user sign-off 2026-10-16)** — hand-drawn closed tome: leather cover, gold band, red gem, cream page edge. App copy/data rename pending app phase | DECIDED |
| Item · Cloth Purse | **hand-drawn drawstring pouch** (cloth ramps `F7C282→E19A65→BD6C4A`, leather base); pack satchel r7c5 rejected for nav duty only | DECIDED |
| Item · Copper Compass | kitbash from round pack elements through bible ramps | pending tile pick (candidates on sheet r8c5 emblem, r9 orbs) |
| Item · Gold Gauntlet | kitbash: crop armored hand/arm region of r8c0 knight, gilt map | pending region confirm |
| Item · Golden Crown | **hand-drawn v2 (programmatic)**: solid 3-point + pearl stems, dilated k-outline, per-column gold ramp (`FEE761→FEAE34→BD6C4A`), red/blue gem inlays | DECIDED |
| Nav icons | **SHIPPED — Option B tiles, product-hue treatment (user-approved):** Home=banner r2c5 (wall chroma-keyed) · Missions=satchel r7c5 · Battle=sword r8c10 · Ranks=plaque r5c5 · Profile=youth head r7c1. Pipeline per `assets/manifest.json`: tile → wall-key → center-bbox → nearest-product-hue snap (`#F3EEDD #C9C1A8 #A9B8B2 #6FD0AE #F2735A #FF6A4D #FF9C86 #F6EFD9 #2E4642 #4B5A56 #A8452F #0C3B35`); active tab: reds `#E84537 #FF706D`→`#6FD0AE`. Display 24px (exact device pixels at DPR≥2). All 50 nav svgs + 5 gallery cards pass palette/orphan/visibility gates | FINAL ✓ |
| UI glyphs (14, at 24×24) | **SHIPPED — pixelarticons, MIT © Gerrit Halfmann, v2.4.2, used natively on their own 24×24 grid.** back=`chevron-left` · lock=`lock` · leave=`logout` · Defend=`shield` · Use item=`backpack` · Attack=`sword` · Ranked=`trophy` · Friend=`users` · Special Move=`zap` · Report/forfeit=`flag` · Withdraw=`arrow-right` · Update=`arrow-up` · Warning=`square-alert`. The one hand-drawn exception is **check** — their check is a 1px diagonal that fails our orphan gate at every size (8 px, all orphans at 12). Vendored verbatim at `assets-raw/pixelarticons/` with `LICENSE.txt`; path data rebuilt from the package files by `scripts/pixelarticons-vendor.mjs`, polygon-filled by `scripts/glyphs-24.mjs`, shipped by `scripts/glyphs-ship.mjs`. `arrow-up` and `square-alert` arrived when the last two 8×8 chrome marks (Update arrow, Warning) migrated to this grid — `Warning` was failing the gate at −Infinity:1. **A fill-rule defect in the original builder ate pixels from four multi-path glyphs; see rule 9. Repaired by `scripts/glyphs-refill.mjs` and guarded by `scripts/glyph-provenance.mjs` (13 sourced, 0 drift).** | SHIPPED ✓ |
| Glyph meanings recovered from context | five 12×12 glyphs had **no aria-labels and no gallery entries**; identified by enclosing-button text and screen position — flag (Profile + battle HUD), crossed-swords (Ranked ×3 **and** Attack ×1 — one X doing two jobs, now split), person (Friend), crown-shaped (Special Move — see rule 6), arrow (Withdrawal). The gallery now carries all twelve instead of six | DONE |
| Arena ground shadows | `rgba(0,0,0,0.4)` pills behind every fighter. Measured **1.08:1** against the arena floor — invisible — and the `A_Battle`/`A_InBattleWait` rival copy also sat 34px below its sprite's feet. Removed from the five arenas that carried them 2026-10-17 | RETIRED — see §4 consequence 4 |
| Arena surface | **Flat panel filled with the page ground `#0C1211`**, in all 7 arenas. Decided 2026-10-17 after a same-day reversal: a `#763B36` floor with a lit `#EAA56C` horizon was built, shipped and verified, then rejected. Chosen because `#0C1211` is the best contour value among tokens we own (1.38:1 vs the old arena's 1.30:1) and because matching the page lets the bevel frame carry the panel. Rejected on measurement: Kenney's own copper floor `#EAA56C` (contour 6.59:1 but the silver knight falls to 1.27:1 against its own ground) and floor-as-contour-colour `#3F2631` (halo gone by identity, outline gone with it). **The film is not fixed — 1.38:1 is still a halo.** Only a mid-tone floor (`#565A58` for 2:1, `#707673` for 3:1) or a real tilemap backdrop would fix it, and both change the arena more than was wanted | SHIPPED — film accepted knowingly |
| Badges (6) | **SHIPPED 2026-10-17 at 24×24, sourced — not drawn.** The 16×16 decision made earlier the same day was superseded: hand-drawn 16×16 pictograms were reviewed and rejected as not reading, and pixelarticons (already licensed and vendored for the UI glyphs) contains a proper icon for all six. Grid follows the pack, because resampling 24 to 16 breaks pixels the way the rejected Shade attempt did. first_steps=`map-pin` · week_warrior=`fire` · iron_saver=`money` · steady_hand=`anchor` · first_blade=`sword` · golden_crown=`crown`. **Steady Hand stopped being a flag** — the Report/forfeit glyph is a flag and both sit on the Profile screen (rule 6 in a new place, created by the glyph ship). **States are one drawing plus a ramp swap plus a corner chip**, so they survive grayscale: earned = gilt `#FEE761`/`#BD6C4A` solid; locked = steel `#C0CBDC`/`#8B9BB4` with a minus chip; removed = slate `#8B9BB4`/`#5A6988` with a cross chip. Chips punch out of the lower-right 9×9 so the pictogram stays legible. A full-canvas cross strike was built first and rejected as defacing the icon. Every shipped state ≥5.98:1 against the card, which is what the old 2.32:1 failures violated. **Only 15 of the 18 possible badge×state combinations exist** — `first_steps`, `first_blade` and `steady_hand` have no revoke path, so they ship earned + locked only (see rule 10). The removed state appears on exactly one screen, `A_Withdrawal`, where it is the only visible cost of taking money out. Display 48px on the Profile card, 72px in large panels, 24px inline in leaderboard rows. Built by `scripts/badges-from-pack.mjs` → `assets/badges.json`; shipped by `scripts/badges-ship.mjs`, `scripts/badge-followups.mjs`, trimmed by `scripts/badge-gallery-trim.mjs` | SHIPPED ✓ |
| Arena backdrop | full environment tileset (walls, floors, gate, torches) | bonus, optional |

**Superseded decisions:** C (kitbash weapons) no longer needed — real sword/shield tiles exist. Weapons ship as untouched pack art (shield gets the bronze-ramp quantized recolor only).

## 6. Motion — the beat layer, REVISED 2026-10-30 (2nd revision)

Channel assignments for **battle state** are governed by §4, and §4's scope is the two battle sprites and their nameplates. Everything else here is transition and feedback, which §4 does not restrict.

This revision is written from `scripts/motion-vocabulary.mjs`, which reads the keyframes, timing tokens and demo functions out of `Savborne-handoff.html` itself. The previous revision was written from a scratch preview and contradicted the document's own working animation on every line. Where a number below disagrees with that earlier draft, **the document won.**

### The vocabulary that already exists

| Name | Definition | Where it belongs |
|---|---|---|
| `sv-lunge` | `0% none → 40% translateX(24px) → 100% none`, **450ms `steps(6)`** | §4 **aggression** |
| `sv-hit` | `sv-flash 400ms steps(4)` **+** `sv-shake 300ms steps(5)` composed | §4 **damage received** |
| `sv-flash` | `0%,100% filter:none → 30% filter:brightness(2.2)` | half of `sv-hit` |
| `sv-shake` | `±6px → ±4px` decaying, two-way | half of `sv-hit` |
| `sv-fill` | `width: var(--from) → var(--to)`, **700ms `steps(14)`** | feedback — HP bars, XP bars |
| `sv-enter` | `opacity 0 translateY(8px) → 1 none`, **180ms** | transition |
| `sv-pop` | rises `8px → −16px` and fades, **900ms `--sv-ease`** | feedback — floating XP text |
| `sv-tick` | `scale 1 → 1.25 → 1`, **300ms `steps(3)`** | feedback — a number changed |
| `sv-levelup` | `scale .6 → 1.15 → 1` with opacity, **1200ms `steps(8)`** | celebration |
| `sv-dots` | `width 0 → 2ch` | feedback — waiting on the opponent |
| `.sv-btn__face` | `transform 80ms steps(2)` | press feedback |

Tokens: `--sv-ease: cubic-bezier(0.2, 0.8, 0.2, 1)` · `--sv-t-press: 80ms` · `--sv-t-enter: 180ms` · `--sv-t-fill: 700ms` · `--sv-t-pop: 900ms`.

**The house rule the whole set already follows: motion is quantised.** Every battle and feedback beat uses `steps(n)`, not a smooth ease — the only exceptions are `sv-pop` and `sv-enter`, which are transitions rather than state. A pixel-art sprite that glides looks wrong; one that jumps in six frames looks like it was drawn that way. Any new beat inherits this.

### The constraint that shapes the battle beats

The app polls `GET /api/battles/[id]` every three seconds. There is no game loop, no push, no websocket. So **every battle beat is triggered by a state transition observed between two polls, never by a clock.** Two consequences follow, and they are not preferences:

1. **A beat can arrive up to three seconds after the thing it depicts happened.** Nothing may depend on beats landing at a particular moment.
2. **Two turns can resolve inside one poll interval.** The arbitration rule is **newest wins, older dropped** — the client holds at most one beat sequence in flight, and when a poll reveals a newer state it renders that and discards the older beat rather than queueing it. Queueing would put the screen behind reality, which is worse than occasionally missing a lunge.

What that rules out, stated plainly so nobody plans for it: an indicator that resolves the instant an opponent taps, a simultaneous two-sided clash, and any sequence where beat *N* must finish before *N+1* begins. Note that `sv-dots` is a *held* indicator, not an instantaneous one — it says "the opponent is deciding" for as long as the poll keeps saying so, which is exactly what survives this architecture.

### The battle beat table

| Beat | Trigger (poll diff) | Fires | Duration | Reduced motion |
|---|---|---|---|---|
| **turn handover** | `currentTurn` increments, or `hasMovedThisTurn` flips for the side now acting | plate border, plate tag, sprite opacity; `sv-bob` starts on the acting fighter only | 120ms | border, tag and opacity **snap to final values**. No motion is lost, because per §4 none of them was carrying state |
| **commit** | local tap, before the poll returns | plate border → hatched, tag `ACTED` | 0 — immediate | identical. This is the player's own feedback and is never deferred |
| **attack** | new `lastTurn` where this side played attack | `sv-lunge` on the attacker, then `sv-hit` on the defender | 450ms + 400/300ms overlap | **lunge and impact both skipped.** The HP bar still drains |
| **special** | same, move type `special` | `sv-lunge`, larger travel, same gesture | 600ms | skipped |
| **damage** | same diff, the receiving side | `sv-hit`, then `sv-fill` on the HP bar | 400ms + 700ms | **flash and shake skipped, bar still drains over 700ms `steps(14)`** — a value changing with no transition is a legibility cost, not an accessibility win |
| **defend** | move type `defend` | **glow** — gilt rim on the defender | 240ms in, 240ms out | see the glow note below; the rim is static, so it may persist for one frame and clear |
| **item used** | `item_key` present | **glow**, identical to defend — one meaning, one treatment | same | same |
| **timeout** | move type `defend` **and** the `auto` flag | glow + the turn log line "ran out of time" | as defend | as defend |
| **result** | `status` → `completed` | opacity and scale per §4: loser `0.55`+`84`, winner `1`+`108`, **tie `96`+`96` both at `1`** | 400ms | values applied instantly |

### Required before the timeout beat can exist

The server auto-plays `defend` when `turnDeadline` passes and the payload reports it as an ordinary chosen move, so the client **cannot distinguish "they defended" from "they ran out of time"** — the information is not in the response. This is an API change, not a CSS decision, and it is the one item here that needs code:

- a flag on the move row (`auto`, or `move_source` of `chosen` / `timeout`) written where `battleServer.ts` applies the deadline
- surfaced through the battle `GET` response and into `lastTurn`
- the turn log line and the beat then read from it

Until that lands the honest ceiling is: **we can show what they played, never why.** The countdown number is already on screen, so a player can infer it; the animation cannot.

### Required before the glow beat can exist

`filter: drop-shadow` produces a soft, anti-aliased halo and would break the quantised idiom the whole set holds. The rim is therefore generated the way the badge chips are — an **8-neighbour** silhouette outline, one pixel wide, in `#FEE761` — and **pre-baked per character into `assets/characters.json`** as an extra path so the client only toggles its visibility. A 4-neighbour rim was tried and renders as a dotted outline, because every diagonal corner is left unpainted.

This is an asset change and is **not done**. `scripts/glow-candidates.mjs` is the reference implementation of the rim. Until it lands, defend and item-use have no beat, which is the honest state of things rather than a gap in the spec.

### Reduced motion

The document implements the collapse twice: a JS `reduce` flag from `matchMedia('(prefers-reduced-motion: reduce)')`, used inside the demo functions to zero delays and disable transitions, and a CSS media query. **Both are required** — the media query cannot express "skip this beat but still drain the bar", which is a per-beat decision, not a global one.

Collapses: `sv-lunge`, `sv-hit` (flash and shake), `sv-shake`, `sv-pop`, `sv-enter`, `sv-levelup`, `sv-tick`, `sv-dots`, the bob.
Survives: `sv-fill` on HP and XP bars, all final values, plate border, plate tag, sprite opacity.

### Open, and deliberately not solved here

`A_ItemSheet`, `A_Win`, `A_Loss` and `A_Tie` carry no nameplate, so the handover and commit beats have nowhere to land on those screens. §4 consequence 7 records it. This section specifies the beats; making them visible in four of the seven battle arenas needs the §5 backdrop or a plate on those screens, and that is a separate decision.

## 7. Typography — two faces, one job each — DECIDED 2026-10-30

### The rule

| Face | Owns | Never owns |
|---|---|---|
| **Silkscreen** | **20px and above** — page and section titles, the wordmark, big result numerals | body copy, labels, any number that changes value on screen |
| **Plus Jakarta Sans** | **below 20px** — body, labels, buttons, and every figure that updates | display headings at 20px+ |

Read the 20px line as **who may own display**, not as a size ban on Jakarta: reading text — paragraphs, labels, status lines — stays Jakarta at any size, and only display (titles, wordmark, big numerals) is Silkscreen's. See correction 3 below for why the distinction had to be written down.

Both are self-hosted by `next/font/google` from `src/app/layout.tsx` and exposed as `--font-jakarta` and `--font-silkscreen`, aliased in `globals.css` to `--font-body` and `--font-display`.

**No third font.** Space Mono was proposed for numerals and rejected: it is a fourth download on a zero-budget mobile app, it competes with Silkscreen for the same retro-digital attention rather than occupying a distinct role, and tabular figures are a *feature* you can switch on, not a typeface you have to ship. That last point is verified below, not assumed.

### Numerals

Every figure that updates on screen carries the `.num` utility: HP readouts, `Turn 2 of 5`, the auto-defend countdown, the NIM balance, XP totals, leaderboard scores.

`.num` pins the family to Jakarta and turns on tabular figures:

```
font-family: var(--font-jakarta), system-ui, sans-serif;
font-variant-numeric: tabular-nums;
font-feature-settings: "tnum" 1;
```

**This was verified against the font binaries, not assumed.** `scripts/font-features.mjs` Brotli-decompresses the self-hosted woff2 files and reads the OpenType feature tags directly, because `font-variant-numeric: tabular-nums` is a silent no-op when a font has no `tnum` feature:

```
Plus Jakarta Sans  latin subset   56429B   tnum YES   pnum YES
Plus Jakarta Sans  2nd subset     52273B   tnum no
Plus Jakarta Sans  3rd subset     19664B   tnum no
Silkscreen         all 4 cuts     —        tnum NO    no OpenType features at all
```

Two consequences worth stating out loud:

1. **Google Fonts ships Jakarta as several unicode-range cuts and only the latin one carries `tnum`.** Digits are U+0030–0039, which is inside the latin range, so the tabulating cut is the one that serves them. If a future subset change ever drops the latin cut, numerals silently go proportional again — re-run `font-features.mjs` after any font or subset edit.
2. **Silkscreen has no `tnum` and no feature table.** Its digits were assumed to be uniform because it is a pixel font. That assumption was measured on 2026-10-31 and is **false** — see "Measured corrections" below. The rule stands (numbers that change value are Jakarta, always), but its stated reason did not.

### Measured corrections — 2026-10-31

Three claims in this section were written before anything measured them. All three are now measured in the DOM at 24px, after `document.fonts.ready`, with `document.fonts.check` confirming each face had loaded (`assets-raw/type-specimen.html`).

**1. Silkscreen's digits are not uniform.** `1` advances **15.00px**; every other digit advances **18.00px** — a **3.00px spread**. Jakarta plain digits span 9.18–17.39px (8.21px spread); Jakarta `.num` measures **14.41px flat, spread 0.00**. So Silkscreen numerals jitter exactly as a proportional face does, only in coarser steps, and `.num` is the only thing in this system that holds a column still. The conclusion above is *more* right than its reason was.

**2. Silkscreen advances on a 4px grid.** Total advance for a mixed string is a whole number of pixels at 12/16/20/24/28/32/36/40/44/48 and fractional at 14/18/21/26/29/30/51. A pixel face should only be set at sizes where its em divides into whole pixels, so **a Silkscreen size that is not a multiple of 4 is a bug, not a preference** — at 30px a string lands on a half pixel and the browser antialiases the edges the font exists to keep hard. Accepted sizes therefore snap to the nearest multiple of 4, ties rounding up so a heading never shrinks. **`text-3xl` is 30px and is the one shipped size that breaks this.**

**3. The 20px boundary decides display, not all text.** The table above reads as though Jakarta is banned at 20px and above, but the artefact has 60 Jakarta instances at 20px or more — every body paragraph, menu label and status line among them. The boundary is about *who may own display*: Silkscreen owns titles, the wordmark and big numerals; Jakarta owns reading text at any size. A 26px status line in Jakarta is the rule working, not an exception. What *is* a violation is Silkscreen below 20px, of which the artefact carried **47 instances** (14px × 35, 12px × 9, 10px × 1, 18px × 1, 19px × 1) — almost all of them ranks, ratings, `Lv 14` and the `23h 58m left` countdown, i.e. the changing numbers this section forbids.

### Pass 1 — screen titles, shipped 2026-10-31

The artefact and the app disagreed about who draws a page title: `A_Missions` set "Missions" in Jakarta 800 at 28px while `src/app/(tabs)/missions/page.tsx:80` sets it in Silkscreen at `text-3xl`. Applying the rule, pass 1 retitled **25 screens** in `Savborne-handoff.html`:

- face → Silkscreen 400; letter-spacing → `normal` (negative tracking breaks a pixel grid)
- size → nearest multiple of 4, ties up: 34→36 (FirstCheckin, BracketClimb), 30→32 (FriendWait), 22→24 (the UpdatePay and BalanceError headers); 21 unchanged, none shrank
- weight 800 → 400 — Silkscreen ships 400 and 700 only. Every screen title in the app is already 400 except the three battle result headlines (`src/app/battle/[id]/page.tsx:164,182,193`), which set `font-bold`; that mismatch is left for a later pass rather than folded into this one silently.

**What counts as a title** had to be decided, because the file contains two kinds of large text:

| kind | example | pass 1 |
|---|---|---|
| top-bar label — names the screen | `A_Settings` "Settings" 28px, `A_BalanceError` "Couldn't read balance" 22px | **retitled** |
| sole heading, screen has no top bar | `A_Welcome` 36px, `A_Win` "You win!" 44px, `A_Withdrawal` 32px | **retitled** |
| state headline under an existing title | `A_BalanceError` "Couldn't read your balance" 32px, `A_UpdatePay` "…to continue" 32px | kept Jakarta |
| name inside a card | `A_Home` / `A_HomeDone` "Kemi" 28px | kept Jakarta |
| turn counter, status line, menu label, glyph | `Turn 2 of 5` 26px, "No match yet." 26px, "Ranked" 24px, "?" 64px | kept Jakarta |

The first attempt keyed on a text prefix and took the wrong element on three screens — `A_BalanceError`'s centred headline instead of its header, and `A_HomeDone`'s card name as a title, which left the same element in two faces across a before/after pair. It was re-shipped from a clean file. `scripts/type-pass1-ship.mjs` now keys on `[screen, text, tag]`, refuses an element that is not already Jakarta, and re-reads its own output before writing.

**Still outstanding:** the 47 sub-20px Silkscreen instances are pass 2 (they become Jakarta `.num`), and the app's `text-3xl` title size is a separate change because it needs a build.

### The bug this section closed

`.num` was applied in **14 places across 7 files and defined nowhere in the codebase.** Every one of those numbers was rendering in whatever font cascaded, with proportional figures — so the auto-defend countdown re-flowed its own width once per second, and `Turn 2 of 5` shifted as the turn advanced. The class name existed as an intention with no implementation behind it.

### Headers

**Uppercase, with letter-spacing**, as shipped — `BADGES`, `MISSIONS`, `XP`. Considered and rejected: sentence case, on the grounds that it reads calmer and more adult for a savings product. The user's call stands: uppercase matches the terminal register the pixel art sets, and the two faces already provide the hierarchy that sentence case would have had to carry alone.

Copy tone is governed separately and is not a typography matter: plain, calm, and it never shames a withdrawal.
