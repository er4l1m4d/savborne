// Stream 5b — the badge set, rebuilt on the decisions:
//   grid 16x16 · flat pictograms (bible rule 4 rewritten to match) · states = ramp swap
//   PLUS a structural change so locked/removed survive grayscale · Steady Hand stops
//   being a flag, because the Report/forfeit glyph already is one.
//
// States, structurally distinct:
//   earned  = solid fill
//   locked  = hollow outline only   (no fill at all)
//   removed = hollow outline + a diagonal strike
// Preview only. Nothing touches Savborne-handoff.html from this script.
import fs from 'node:fs';
import zlib from 'node:zlib';

const N = 16;
const G = (name, rows) => {
  if (rows.length !== N) throw new Error(`${name}: ${rows.length} rows, want ${N}`);
  rows.forEach((r, i) => { if (r.length !== N) throw new Error(`${name} row ${i}: ${r.length} chars, want ${N}`); });
  return rows.map((r) => r.split(''));
};

// ── the six pictograms ────────────────────────────────────────────────────
const ART = {
  // First Steps — a staircase profile, one connected mass. The offset-blocks version read
  // as a lightning bolt because the treads only touched at their corners.
  first_steps: G('first_steps', [
    '................',
    '................',
    '................',
    '..........#####.',
    '..........#####.',
    '..........#####.',
    '.....##########.',
    '.....##########.',
    '.....##########.',
    '..#############.',
    '..#############.',
    '..#############.',
    '................',
    '................',
    '................',
    '................',
  ]),
  // Week Warrior — a flame, kept from the current set (it reads well)
  week_warrior: G('week_warrior', [
    '................',
    '......##........',
    '.....####.......',
    '.....####.......',
    '....######......',
    '....######......',
    '...########.....',
    '...########.....',
    '..##########....',
    '..##########....',
    '..##########....',
    '...########.....',
    '....######......',
    '.....####.......',
    '................',
    '................',
  ]),
  // Iron Saver — two pig-iron ingots, one behind the other. The contiguous pyramid version
  // read as a bell. Separated bars are safe again now that state marks are additive rather
  // than derived from hollowing the shape.
  iron_saver: G('iron_saver', [
    '................',
    '................',
    '....########....',
    '...##########...',
    '..############..',
    '................',
    '..############..',
    '.##############.',
    '.##############.',
    '.##############.',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ]),
  // Steady Hand — an anchor. Was a flag, which collided with the Report/forfeit
  // glyph on the same screen. Thirty days with no withdrawal = it holds.
  steady_hand: G('steady_hand', [
    '................',
    '.......##.......',
    '......####......',
    '......####......',
    '.......##.......',
    '.#############..',
    '.......##.......',
    '.......##.......',
    '.......##.......',
    '.......##.......',
    '..##...##...##..',
    '.####..##..####.',
    '.##############.',
    '..##########....',
    '....######......',
    '................',
  ]),
  // First Blade — a diagonal sword. The Attack glyph is a VERTICAL sword, so the
  // pose differs and they stay tellable apart.
  first_blade: G('first_blade', [
    '................',
    '.............##.',
    '............###.',
    '...........###..',
    '..........###...',
    '.........###....',
    '........###.....',
    '.......###......',
    '......###.......',
    '.....###........',
    '..#..##..#......',
    '..##.##.##......',
    '...######.......',
    '.....##.........',
    '.....##.........',
    '................',
  ]),
  // Golden Crown — a flat three-point crown. Shares its referent with the Golden
  // Crown item (both mean "at Gold"), so a shared silhouette is reinforcement here,
  // not the collision rule 6 targets: the item is jewelled and rounded, this is flat.
  golden_crown: G('golden_crown', [
    '................',
    '..#.....#.....#.',
    '..#.....#.....#.',
    '..##...###...##.',
    '..##...###...##.',
    '..###########...',
    '..###########...',
    '..###########...',
    '..###########...',
    '..###########...',
    '...#########....',
    '................',
    '................',
    '................',
    '................',
    '................',
  ]),
};

// ── state transforms ─────────────────────────────────────────────────────
const on = (g, x, y) => g[y]?.[x] === '#';
const cells = (g) => { const o = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (on(g, x, y)) o.push([x, y]); return o; };

// Hollowing was the wrong idea: on a thin pictogram (a sword, an anchor) every pixel is
// already an edge pixel, so "outline" and "solid" come out byte-identical — measured, not
// guessed: steady_hand locked was 79 painted against 79 earned, first_blade 46 against 46.
// The state mark must therefore be ADDITIVE and independent of the silhouette's thickness.
function cornerTicks(g) {
  const out = g.map((r) => r.slice());
  const T = 3;
  for (const [x0, y0, dx, dy] of [[0, 0, 1, 1], [N - 1, 0, -1, 1], [0, N - 1, 1, -1], [N - 1, N - 1, -1, -1]]) {
    for (let i = 0; i < T; i++) {
      if (out[y0]?.[x0 + dx * i] !== undefined) out[y0][x0 + dx * i] = '#';
      if (out[y0 + dy * i]?.[x0] !== undefined) out[y0 + dy * i][x0] = '#';
    }
  }
  return out;
}
function crossStrike(g) {
  // both diagonals, 2px thick so every added pixel has a neighbour
  const out = g.map((r) => r.slice());
  const set = (x, y) => { if (y >= 0 && y < N && x >= 0 && x < N) out[y][x] = '#'; };
  for (let i = 0; i < N; i++) {
    set(i, i); set(i + 1, i);
    set(N - 1 - i, i); set(N - 1 - i, i + 1);
  }
  return out;
}
const STATES = {
  earned: (g) => g,
  locked: (g) => cornerTicks(g),   // four corner brackets — "reserved, not yet yours"
  removed: (g) => crossStrike(g),  // a full 2px cross — "taken away"
};

// ── ramps: every one keeps a colour above 3:1 against the card ────────────
const CARD = '#151F1D';
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const RAMPS = {
  earned: { ink: '#FEE761', deep: '#BD6C4A' },
  locked: { ink: '#C0CBDC', deep: '#8B9BB4' },
  removed: { ink: '#8B9BB4', deep: '#5A6988' },
};

function paths(g, ramp) {
  // Bible rule 1: light from top-left. The old (x+y)%3 hack produced a candy-stripe
  // texture that read as a hazard pattern, not as shading. Correct approach is a solid
  // body with the deep tone held to a 1px rim on the bottom and right edges only.
  const byColor = new Map();
  const push = (col, d) => { if (!byColor.has(col)) byColor.set(col, []); byColor.get(col).push(d); };
  for (let y = 0; y < N; y++) for (let x = 0; x < N;) {
    if (g[y][x] !== '#') { x++; continue; }
    let run = 1; while (x + run < N && g[y][x + run] === '#') run++;
    // deep if this cell has no neighbour below or to its right — i.e. it is a bottom/right rim
    const rim = !on(g, x + run - 1, y + 1) || !on(g, x + run, y);
    push(rim ? ramp.deep : ramp.ink, `M${x} ${y}h${run}v1h-${run}z`);
    x += run;
  }
  return [...byColor].map(([c, ds]) => `<path fill="${c}" shape-rendering="crispEdges" d="${ds.join('')}"></path>`).join('');
}
function orphans(g) {
  let n = 0;
  for (const [x, y] of cells(g)) if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => on(g, x + dx, y + dy))) n++;
  return n;
}

// ── build ────────────────────────────────────────────────────────────────
const built = {};
console.log('badge           state     painted  delta vs earned  orphans  best contrast vs card');
for (const [key, g] of Object.entries(ART)) {
  built[key] = {};
  const base = cells(g).length;
  for (const st of Object.keys(STATES)) {
    const sg = STATES[st](g);
    built[key][st] = paths(sg, RAMPS[st]);
    const best = Math.max(...[RAMPS[st].ink, RAMPS[st].deep].map((c) => ratio(c, CARD)));
    const delta = cells(sg).length - base;
    // a zero delta on a non-earned state means the mark did nothing — the hollow bug
    const warn = st !== 'earned' && delta === 0 ? '  *** MARK DOES NOTHING ***' : '';
    console.log(`${key.padEnd(15)} ${st.padEnd(8)} ${String(cells(sg).length).padStart(5)}    ${String(delta).padStart(5)}          ${String(orphans(sg)).padStart(4)}  ${best.toFixed(2)}:1 ${best >= 3 ? 'OK' : '*** FAIL ***'}${warn}`);
  }
}

// gate temp
const tempSvg = (k, st, p) => `<svg width="48" height="48" viewBox="0 0 16 16" role="img" aria-label="${k} badge, ${st}">${p}</svg>`;
const tempList = [];
for (const [k, states] of Object.entries(built)) for (const [st, p] of Object.entries(states)) tempList.push(tempSvg(k, st, p));
fs.writeFileSync('assets-raw/badges-temp.html', `<html><body>${tempList.join('\n')}</body></html>`);

// PNG sheet: rows = badges, columns = earned/locked/removed, at 6x
const Z = 6, PADX = 18, COLS = 3, names = Object.keys(ART), stCol = ['earned', 'locked', 'removed'];
const CELL = N * Z;
const W = PADX + COLS * (CELL + PADX), H = PADX + names.length * (CELL + PADX);
const img = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) { img[i * 4] = 21; img[i * 4 + 1] = 31; img[i * 4 + 2] = 29; img[i * 4 + 3] = 255; }
const put = (x, y, c) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2]; img[i + 3] = 255; };
names.forEach((k, row) => stCol.forEach((st, col) => {
  const sg = STATES[st](ART[k]), ramp = RAMPS[st];
  const cx = PADX + col * (CELL + PADX), cy = PADX + row * (CELL + PADX);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (sg[y][x] !== '#') continue;
    // same rim rule as paths(): deep on the bottom/right edge, bright elsewhere
    const runEnd = !on(sg, x + 1, y) || x + 1 >= N || sg[y][x + 1] !== '#';
    const colEnd = y + 1 >= N || sg[y + 1]?.[x] !== '#';
    const hex = (runEnd || colEnd) ? ramp.deep : ramp.ink;
    const rgb = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    for (let dy = 0; dy < Z; dy++) for (let dx = 0; dx < Z; dx++) put(cx + x * Z + dx, cy + y * Z + dy, rgb);
  }
}));
const raw = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; img.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync('assets-raw/badges-new.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));

// preview page: profile cards at real 36px + enlarged, per badge
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Badges — 16x16 rework</title><style>
body{background:#0C1211;color:#F3EEDD;font:600 13px system-ui;padding:22px;margin:0}h1{font-size:19px}.lead{color:#A9B8B2;max-width:920px;font-weight:500}
.grid{display:flex;gap:14px;flex-wrap:wrap;margin-top:18px}
.c{background:${CARD};border:2px solid #C9C1A8;box-shadow:0 3px 0 #2E4642;padding:14px;display:flex;flex-direction:column;align-items:center;gap:8px;width:250px;box-sizing:border-box}
.pair{display:flex;align-items:flex-end;gap:10px}
.pair>div{display:flex;flex-direction:column;align-items:center;gap:4px}
.pair span{font-size:9px;color:#A9B8B2;font-weight:500}
.c b{font-size:12px}svg{image-rendering:pixelated;display:block}
h2{font-size:12px;color:#A9B8B2;margin:22px 0 4px}
</style></head><body>
<h1>Badges — rebuilt at 16×16, flat pictograms, three structural states</h1>
<p class="lead">Each badge shown at the <b>36px it renders at on the profile card</b> and at 96px. Three states, each a ramp swap <i>plus</i> a structural mark so they survive grayscale: <b>earned</b> is solid gilt; <b>locked</b> is steel with four corner brackets — a reserved slot; <b>removed</b> is slate struck through with a 2px cross. Steady Hand is now an anchor, because a flag would have collided with the Report/forfeit glyph on this same screen.<br><br>
<b>Two things the earlier drafts got wrong, recorded here so they do not quietly return.</b> The first state system hollowed locked to an outline — but on a thin pictogram every pixel is already an edge pixel, so locked and earned came out byte-identical (steady_hand 79 against 79, first_blade 46 against 46). And the shading used a repeating diagonal, which produced a candy-stripe texture that violated the bible's top-left light rule outright. Both are fixed; the marks are now additive and the rim is bottom/right only.</p>
${names.map((k) => `<div class="c"><div class="pair">${stCol.map((st) => `<div><svg width="36" height="36" viewBox="0 0 16 16">${built[k][st]}</svg><span>${st}</span></div>`).join('')}${stCol.slice(0, 1).map((st) => `<div><svg width="96" height="96" viewBox="0 0 16 16">${built[k][st]}</svg><span>earned 96px</span></div>`).join('')}</div><b>${k.replace(/_/g, ' ')}</b></div>`).join('')}
<h2>sheet</h2><p class="lead">assets-raw/badges-new.png — rows are the six badges, columns are earned / locked / removed.</p>
</body></html>`;
fs.writeFileSync('assets-raw/badges-new.html', html);
console.log('\npage:  http://localhost:5511/assets-raw/badges-new.html');
console.log('sheet: assets-raw/badges-new.png · gate temp: assets-raw/badges-temp.html');
console.log('nothing written to Savborne-handoff.html');
