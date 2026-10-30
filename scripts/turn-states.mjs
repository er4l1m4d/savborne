// Stream 2 preview — battle states, built strictly from the §4 channel matrix.
// Nothing here is shipped to the handoff; this is the review artefact.
//
// Each state renders the same arena with only the channels §4 assigns to it:
//   opacity   = defeated        scale     = outcome
//   vertical  = liveness (bob)  horiz     = aggression (lunge)
//   tint      = damage          plate border = control   plate tag = status
// The bob and the lunge are real CSS animations, so "can you tell whose turn it is"
// is answerable by looking rather than by reading a spec.
import fs from 'node:fs';

const ART = JSON.parse(fs.readFileSync('assets/characters.json', 'utf8'));
const HERO = ART['Hero · Silver'], RIVAL = ART['Rival · Mint Wraith'];
const MINT = '#6FD0AE', CORAL = '#F2735A', EDGE = '#C9C1A8', MUTED = '#A9B8B2', PLATE = '#151F1D';

// one fighter plate. border: 'lit' | 'neutral' | 'hatched'; tag: string or null
function plate(name, lvl, hp, colour, { border = 'neutral', tag = null } = {}) {
  const bs = border === 'lit' ? `border: 2px solid ${MINT}; box-shadow: 0 0 0 2px rgba(111,208,174,.25);`
    : border === 'hatched' ? `border: 2px dashed ${MUTED};`
    : `border: 2px solid ${EDGE};`;
  const ts = border === 'lit' ? MINT : border === 'hatched' ? MUTED : EDGE;
  return `<div style="position:absolute;${colour === 'top' ? 'left:14px; top:14px' : 'right:14px; bottom:36px'};width:168px;box-sizing:border-box;padding:10px 12px;background:${PLATE};${bs}display:flex;flex-direction:column;gap:6px">
  <div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:14px;font-weight:700;color:${ts}">${name}</span><span style="font-size:12px;color:${MUTED};font-weight:600">Lv ${lvl}</span></div>
  <div style="height:14px;box-sizing:border-box;border:2px solid ${EDGE};background:#0C1211"><div style="width:${hp}%;height:100%;background:${hp > 50 ? MINT : hp > 20 ? '#F2B544' : CORAL}"></div></div>
  <div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:12px;color:${MUTED};font-weight:700">${hp} / 100 HP</span>${tag ? `<span style="font-size:10px;font-weight:800;letter-spacing:.08em;color:${ts}">${tag}</span>` : ''}</div>
</div>`;
}

// fighter: size, position, opacity (defeated), bob (liveness), lunge (aggression), flash (damage)
// The flip and the animation live on SEPARATE elements. A keyframe that animates
// `transform` replaces the whole declaration, so putting scaleX(-1) and the animation on
// the same div silently un-mirrors the sprite the moment it starts moving — measured, not
// theorised: the bobbing rival in panel 2 rendered matrix(1,...) while the still rival in
// every other panel rendered matrix(-1,...).
function fighter(art, { size, x = null, y = null, bottom = null, opacity = 1, flip = false, anim = null }) {
  const pos = `position:absolute;${x !== null ? `left:${x}px;` : ''}${y !== null ? `top:${y}px;` : ''}${bottom !== null ? `bottom:${bottom}px;` : ''}`;
  const outer = `${pos}width:${size}px;height:${size}px;${opacity !== 1 ? `opacity:${opacity};` : ''}${anim ? `animation:${anim};` : ''}`;
  const inner = `<svg width="${size}" height="${size}" viewBox="0 0 16 16" shape-rendering="crispEdges" style="image-rendering:pixelated;display:block">${art}</svg>`;
  return `<div style="${outer}"><div style="width:100%;height:100%;${flip ? 'transform:scaleX(-1);' : ''}">${inner}</div></div>`;
}

const ARENA_H = 300;
function arena(label, note, body, flag = '') {
  return `<figure><figcaption><b>${label}</b><span>${note}</span>${flag ? `<em>${flag}</em>` : ''}</figcaption>
<div class="arena">${body}</div></figure>`;
}

// §4 discipline: the tag answers "what is happening with THIS fighter". Exactly one plate
// carries a control tag at a time — YOUR MOVE or THEIRS — and the other shows ACTED or
// nothing. A rival tagged THEIRS while the hero has control would be a contradiction.
const STATES = [
  {
    label: 'your turn', note: 'border lit + YOUR MOVE + hero bobs; rival still, untagged',
    body: plate('Kemi', 7, 78, 'top', { border: 'lit', tag: 'YOUR MOVE' })
      + fighter(RIVAL, { size: 84, x: 214, y: 22, flip: true })
      + plate('Mint Wraith', 5, 62, 'bottom', { border: 'neutral', tag: null })
      + fighter(HERO, { size: 104, bottom: 44, x: 28, anim: 'bob .5s steps(1) infinite' }),
  },
  {
    label: 'their turn', note: 'rival border lit + THEIRS + rival bobs; hero still, ACTED',
    body: plate('Kemi', 7, 78, 'top', { border: 'neutral', tag: 'ACTED' })
      + fighter(RIVAL, { size: 84, x: 214, y: 22, flip: true, anim: 'bob .5s steps(1) infinite' })
      + plate('Mint Wraith', 5, 62, 'bottom', { border: 'lit', tag: 'THEIRS' })
      + fighter(HERO, { size: 104, bottom: 44, x: 28 }),
  },
  {
    label: 'committed', note: 'you acted, opponent has not: hatched border + ACTED, no bob on either',
    body: plate('Kemi', 7, 78, 'top', { border: 'hatched', tag: 'ACTED' })
      + fighter(RIVAL, { size: 84, x: 214, y: 22, flip: true })
      + plate('Mint Wraith', 5, 62, 'bottom', { border: 'neutral', tag: null })
      + fighter(HERO, { size: 104, bottom: 44, x: 28 }),
  },
  {
    label: 'resolving', note: 'attacker lunges +3px, defender flashes coral — plates unchanged',
    body: plate('Kemi', 7, 78, 'top', { border: 'neutral', tag: null })
      + fighter(RIVAL, { size: 84, x: 214, y: 22, flip: true, anim: 'flash .2s steps(1) 2' })
      + plate('Mint Wraith', 5, 41, 'bottom', { border: 'neutral', tag: null })
      + fighter(HERO, { size: 104, bottom: 44, x: 28, anim: 'lunge .45s ease-out' }),
  },
  {
    label: 'won', note: 'opacity 1 + scale 108 vs opacity .55 + scale 84',
    body: plate('Kemi', 7, 41, 'top', { border: 'neutral', tag: null })
      + fighter(RIVAL, { size: 84, x: 200, y: 30, flip: true, opacity: .55 })
      + plate('Mint Wraith', 5, 0, 'bottom', { border: 'neutral', tag: null })
      + fighter(HERO, { size: 108, bottom: 40, x: 24 }),
  },
  {
    label: 'lost', note: 'same two channels, mirrored — nothing new invented',
    body: plate('Kemi', 7, 0, 'top', { border: 'neutral', tag: null })
      + fighter(RIVAL, { size: 108, x: 190, y: 22, flip: true })
      + plate('Mint Wraith', 5, 34, 'bottom', { border: 'neutral', tag: null })
      + fighter(HERO, { size: 84, bottom: 40, x: 34, opacity: .55 }),
  },
  {
    label: 'tie — FIXED', note: 'was 108 vs 96. §4 says a tie defeats nobody, so: equal scale, both at full opacity',
    body: plate('Kemi', 7, 12, 'top', { border: 'neutral', tag: null })
      + fighter(RIVAL, { size: 96, x: 200, y: 26, flip: true })
      + plate('Mint Wraith', 5, 12, 'bottom', { border: 'neutral', tag: null })
      + fighter(HERO, { size: 96, bottom: 40, x: 38 }),
  },
  {
    label: 'disconnected', note: 'no sprite channel — the whole arena fades, the plate tag carries the state',
    body: `<div style="position:absolute;inset:0;opacity:.55">`
      + plate('Kemi', 7, 51, 'top', { border: 'neutral', tag: null })
      + fighter(RIVAL, { size: 84, x: 214, y: 22, flip: true })
      + plate('Mint Wraith', 5, 44, 'bottom', { border: 'neutral', tag: null })
      + fighter(HERO, { size: 104, bottom: 44, x: 28 })
      + `</div><div style="position:absolute;left:0;right:0;top:118px;text-align:center;font-size:11px;font-weight:800;letter-spacing:.1em;color:${CORAL}">OFFLINE</div>`,
  },
];

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Stream 2 — battle states</title><style>
body{background:#0C1211;color:#F3EEDD;font:600 13px 'Plus Jakarta Sans',system-ui,sans-serif;padding:22px;margin:0}
h1{font-size:19px;margin:0 0 6px}.lead{color:#A9B8B2;max-width:960px;font-weight:500}
.grid{display:flex;gap:18px;flex-wrap:wrap;margin-top:20px}
figure{margin:0}figcaption{margin-bottom:6px;width:318px}figcaption b{display:block;font-size:13px}
figcaption span{display:block;color:#A9B8B2;font-size:11px;font-weight:500;min-height:28px}
figcaption em{font-style:normal;color:#F2B544;font-size:10px}
.arena{position:relative;width:318px;height:${ARENA_H}px;background:#0C1211;border:2px solid #C9C1A8;box-shadow:0 3px 0 #2E4642;overflow:hidden}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
@keyframes lunge{0%{transform:translateX(0)}30%{transform:translateX(-3px)}55%{transform:translateX(9px)}100%{transform:translateX(0)}}
@keyframes flash{0%,100%{filter:none}50%{filter:brightness(1.9) saturate(.2)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
h2{font-size:13px;color:#A9B8B2;margin:26px 0 6px}
table{border-collapse:collapse;font-size:12px;margin-top:8px}td,th{border:1px solid #2E4642;padding:5px 9px;text-align:left;vertical-align:top}th{background:#151F1D}
code{font-family:ui-monospace,monospace;font-size:11px}
</style></head><body>
<h1>Stream 2 — battle states, from the §4 channel matrix</h1>
<p class="lead">Same arena, eight states. Only the channels §4 assigns are used: opacity means defeated, scale means outcome, the bob means <i>acts now</i>, the lunge means aggression, the flash means damage taken, the plate border means control, the plate tag means status. <b>The bob, the lunge and the flash are live animations — watch panels 1, 2 and 4.</b></p>
<div class="grid">${STATES.map((s) => arena(s.label, s.note, s.body, s.flag)).join('')}</div>
<h2>The one bug this fixes</h2>
<p class="lead">The tie in the handoff is <b>108 against 96</b>. §4 says opacity means defeated and scale means outcome, and a tie defeats nobody — so a tie must be equal scale at full opacity. That is panel seven: 96 and 96, both at opacity 1.</p>
<h2>What I need you to judge</h2>
<p class="lead"><b>Panel one versus panel two, without reading the tags.</b> Can you tell whose turn it is? That is the blink test §4 consequence 3 promises. The bob is 2px on a <code>steps(1)</code> half-second — if you cannot read it at this size, turn state moves to a channel with more travel and the bob stops being load-bearing.</p>
<h2>The beat table — what runs, and what drives it</h2>
<p class="lead">The app polls <code>GET /api/battles/[id]</code> every 3 seconds. There is no game loop and no push. So every beat below is triggered by a <b>state transition observed between two polls</b>, never by a clock. A beat must be idempotent and skippable: if two turns resolve inside one 3s window, the newer diff wins and the older beat is dropped rather than queued.</p>
<table><tr><th>beat</th><th>trigger (poll diff)</th><th>channel / property</th><th>values</th><th>dur</th><th>easing</th><th>reduced-motion</th></tr>
<tr><td>turn handover</td><td><code>hasMovedThisTurn</code> flips, or <code>currentTurn</code> increments</td><td>plate border + tag; bob start/stop</td><td>neutral→lit; bob on the acting side only</td><td>120ms</td><td>linear</td><td>border + tag only, no bob</td></tr>
<tr><td>commit</td><td>local tap, before the poll returns</td><td>plate border → hatched, tag ACTED</td><td>immediate</td><td>0</td><td>—</td><td>identical</td></tr>
<tr><td>attack lunge</td><td><code>lastTurn</code> where this side's move = attack / special</td><td>transform translateX</td><td>0 → −3 → +9 → 0</td><td>450ms</td><td>ease-out</td><td>skipped entirely</td></tr>
<tr><td>damage</td><td>same diff, the receiving side</td><td>filter brightness+saturate, then HP width</td><td>flash ×2, bar 78%→41%</td><td>200ms + 500ms</td><td>steps(1), linear</td><td>bar only, no flash</td></tr>
<tr><td>defend</td><td>move = defend</td><td><b>no channel exists</b> — see gap 1</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>
<tr><td>item used</td><td><code>item_key</code> present</td><td><b>no channel exists</b> — see gap 1</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>
<tr><td>result</td><td><code>status</code> → completed</td><td>opacity + scale</td><td>loser .55 / 84, winner 1 / 108; tie 96 / 96 both at 1</td><td>400ms</td><td>ease-out</td><td>instant, values only</td></tr>
</table>
<h2>Two gaps this exposes, which I am not going to paper over</h2>
<p class="lead"><b>Gap 1 — defend and item have no channel.</b> §4 assigns lunge to aggression and tint to damage received. Defend deals no damage and uses no aggression, and an item does neither, so under the matrix as written <b>they cannot animate at all.</b> The reserved <code>glow</code> channel is the obvious home: define it once as <i>"an effect has been applied to this fighter"</i> — shield up, item active — and defend and item both get a beat without stealing a channel from anyone. That is a §4 amendment, so it needs your sign-off rather than me quietly drawing it.<br><br>
<b>Gap 2 — a timeout is indistinguishable from a move.</b> The server auto-plays Defend when <code>turnDeadline</code> passes, and the payload reports it as a normal move. So the client cannot animate "they ran out of time" — the information is not in the response. That needs an API change (a flag on the move row), not a CSS decision. Until then the honest ceiling is: we can show <i>what</i> they played, never <i>why</i>.</p>
<h2>What cannot work without a real game loop, said plainly</h2>
<p class="lead">Anything requiring sub-3-second latency or overlapping beats. Specifically: no "the opponent is thinking" indicator that resolves the instant they tap; no simultaneous two-sided clash animation; no frame-locked sequencing where beat N must finish before N+1 starts, because a poll can deliver two turns at once and the older one must be discarded. What <i>does</i> work, and is everything in the table above: single-shot, skippable, transform-only beats driven by state diffs. That is enough for a turn-based savings game and I would not build past it.</p>
</body></html>`;
fs.writeFileSync('assets-raw/turn-states.html', html);
console.log('preview: http://localhost:5511/assets-raw/turn-states.html');
console.log('8 states rendered; nothing written to Savborne-handoff.html');
