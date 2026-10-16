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

## 2. The palette (measured from `tilemap_packed.png`, 27 colors, opaque pixels)

Neutrals/outline: `#3F2631` (near-black plum — the pack's outline color), `#262B44`, `#52607C`, `#8B9BB4`, `#C0CBDC`, `#FFFFFF`
Warm/leather/skin: `#763B36`, `#BD6C4A`, `#CF8254`, `#EAA56C`, `#F7C282`, `#E19A65`
Material ramps (3-step, light→dark, taken from the pack's own usage):
- **Steel/silver**: `#C0CBDC` → `#8B9BB4` → `#52607C` (deep shadow `#262B44`)
- **Bronze/copper**: `#EAA56C` → `#CF8254` → `#BD6C4A` (deep `#763B36`)
- **Gilt/gold**: `#FEE761` → `#FEAE34` (deep `#BD6C4A`)
- **Cloth cream**: `#F7C282` → `#E19A65` → `#BD6C4A`
- **Leather/wood**: `#BD6C4A` → `#763B36` → `#3F2631`
- **Mint (hero accent)**: `#69FFD4` → `#43E1B3` → `#25956A`
- **Coral/red (rival accent)**: `#FF706D` → `#E84537` → `#763B36`
- **Magic blue**: `#75E3FF` → `#0099DB`; **Purple**: `#D176D0` → `#9B4CA3`

UI-token → art mapping (for accents that must echo the UI): `--sv-mint #6FD0AE→#43E1B3`, `--sv-coral #F2735A→#E84537`, `--sv-text #F3EEDD→#F7C282`, ink `--sv-ground→#3F2631`.

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
3. **Grids:** tiles/items 16×16 (pack-native). Characters 16×16 (pack-native — supersedes the invented 16×24). Display scales are whole multiples (2×, 3×, 4×) with `image-rendering: pixelated`.
4. **Silhouette language:** weapons = diagonal, tip up-right; containers = bottom-heavy mass with visible opening top-left; tools = circular head + grip; badges = roundel + ribbon; characters read at 1× as head+shoulders mass.
5. **Every asset passes:** palette membership, no orphan pixels (any painted pixel with no 4-neighbour), silhouette-identifiable when flooded to solid `#3F2631`, and readable in grayscale.

## 4. Coverage matrix — HUMAN-VERIFIED 2026-10-16 (contact sheet + user confirmations)

Earlier guesses were partly wrong (r0c0 is a floor tile, not a scroll; r7c0 is a wizard, not a king). Verified identities below:

| Savborne slot | Tiny Dungeon tile (verified) | Status |
|---|---|---|
| Hero · Entry gear | r7c1 (tile_0085) orange-haired youth, plain clothes | DECIDED |
| Hero · Bronze gear | r8c2 (tile_0098) youth with steel shoulder plate | DECIDED |
| Hero · Silver gear | r8c0 (tile_0096) full steel knight | DECIDED |
| Hero · Gold gear | r8c0 recolored via gilt map: `C0CBDC→FEE761, 8B9BB4→FEAE34, 52607C→BD6C4A, 262B44→763B36`, outline/skin kept | DECIDED (quantized recolor) |
| Rival / opponent | r7c3 (tile_0087) white-haired goblin, light armor | DECIDED — distinct silhouette |
| Item · Silver Blade | r8c10 (tile_0106) broad steel sword | DECIDED — no kitbash needed |
| Item · Bronze Shield | r8c6 (tile_0102) steel heater shield → bronze ramp recolor | DECIDED |
| Extra weapon art | r8c8 sword, r8c11 bronze-hilt sword w/ red gem, r9c9 hammer, r9c11 axe, r10c9 dagger | available |
| Item · Ledger Scroll | r10c10 (tile_0130) scroll with blue seal | DECIDED |
| Item · Cloth Purse | keep current hand-drawn shape, recolor to bible ramps (bronze ramp for leather: `EAA56C→CF8254→BD6C4A`, outline `#3F2631`) | user-approved |
| Item · Copper Compass | kitbash from round pack elements through bible ramps | pending tile pick (candidates on sheet r8c5 emblem, r9 orbs) |
| Item · Gold Gauntlet | kitbash: crop armored hand/arm region of r8c0 knight, gilt map | pending region confirm |
| Item · Golden Crown | king/crown tile NOT found — hand-draw to bible or use wizard-hat motif | GAP |
| Nav icons | Option A (hand-drawn) vs B (tiles: gate r6c9, scroll r10c10, sword r8c10, wizard r7c0, head r7c1) vs C (Shade CC0 pack) — live comparison at `/assets-raw/nav-compare.html` | PENDING USER PICK |
| UI glyphs (back/check/lock/warning/forward) | search log: Shade 16×16 = CC0 author-confirmed (candidate); Kyrise license unverified; Raven rejected | awaiting nav pick outcome |
| Badges (6) | no pack equivalents | hand-draw to bible §3 language |
| Arena backdrop | full environment tileset (walls, floors, gate, torches) | bonus, optional |

**Superseded decisions:** C (kitbash weapons) no longer needed — real sword/shield tiles exist. Weapons ship as untouched pack art (shield gets the bronze-ramp quantized recolor only).

## 5. Motion (timing sheet)

- Idle: 2-frame bob, translateY 0 → −1px, 500ms per frame, `steps(1)`.
- Attack: 3 frames — windup (−1px back), active (+3px lunge, 120ms), recover (+1px, 200ms); total ≤450ms.
- Damage flash: swap material rows to `#FF706D` tint for 2 frames (100ms).
- Reduced motion: all frames collapse to final pose, static.
