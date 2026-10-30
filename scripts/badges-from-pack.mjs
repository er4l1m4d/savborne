// Badges from real pixelarticons (MIT) instead of my drawings — the six pictograms the
// user rejected as not reading, replaced with icons from the pack we already licensed.
// Read straight out of node_modules so nothing is transcribed.
//
// Grid moves to 24x24, because that is the pack's grid and resampling it to 16 would
// break the pixels the same way the Shade 16x16 attempt did.
//
// State marks are CORNER CHIPS, not a full cross — the cross defaced the icon and the
// user rejected it. The icon is never altered; a small chip is added in the lower right.
import fs from 'node:fs';

const SRC = 'node_modules/pixelarticons/svg';
const N = 24;

const CHOICE = {
  // `revocable` mirrors computeBadgeActions() in src/lib/game/badges.ts exactly: those are
  // the only three badges any code path emits a `revoke` for. A "removed" rendering of the
  // other three depicts a state the game cannot produce, so it is not shipped or exhibited.
  first_steps:  { icon: 'map-pin', revocable: false, why: 'a check-in is a location pin; no stairs/footprint icon exists in the free set' },
  week_warrior: { icon: 'fire',    revocable: true,  why: 'streak = fire, the near-universal convention; revoked on withdrawal or when the streak drops below 7' },
  iron_saver:   { icon: 'money',   revocable: true,  why: 'a savings challenge; revoked on withdrawal or when the streak drops below 28' },
  steady_hand:  { icon: 'anchor',  revocable: false, why: 'holds steady through 30 days of no withdrawal; no revoke path exists' },
  first_blade:  { icon: 'sword',   revocable: false, why: 'first battle win; a win is never taken back, so no revoke path exists' },
  golden_crown: { icon: 'crown',   revocable: true,  why: 'Gold bracket status, literally; revoked when the balance drops below Gold' },
};

// Even-odd polygon scanline fill, ported verbatim from scripts/glyphs-24.mjs.
// The first attempt here filled each subpath's BOUNDING BOX, which mangles every
// pixelarticon — the same bug already solved once for the UI glyph set. pixelarticons
// draws multi-vertex outlines (a flame, a crown), so bbox fill smears them into blobs.
function ringsFromPath(d) {
  const cmds = [];
  for (const m of d.matchAll(/([MmHhVvZz])([^MmHhVvZz]*)/g)) cmds.push([m[1], (m[2].match(/-?\d*\.?\d+/g) || []).map(Number)]);
  const rings = [];
  let cx = 0, cy = 0, sx = 0, sy = 0, pts = [];
  const flush = () => { if (pts.length > 2) rings.push(pts.slice()); pts = []; };
  for (const [c, ns] of cmds) {
    if (c === 'M' || c === 'm') {
      flush();
      if (c === 'm') { cx += ns[0]; cy += ns[1]; } else { cx = ns[0]; cy = ns[1]; }
      sx = cx; sy = cy; pts = [[cx, cy]];
      for (let i = 2; i + 1 < ns.length; i += 2) { cx = ns[i]; cy = ns[i + 1]; pts.push([cx, cy]); }
    } else if (c === 'H') for (const n of ns) { cx = n; pts.push([cx, cy]); }
    else if (c === 'h') for (const n of ns) { cx += n; pts.push([cx, cy]); }
    else if (c === 'V') for (const n of ns) { cy = n; pts.push([cx, cy]); }
    else if (c === 'v') for (const n of ns) { cy += n; pts.push([cx, cy]); }
    else if (c === 'Z' || c === 'z') { pts.push([sx, sy]); flush(); cx = sx; cy = sy; }
  }
  flush();
  return rings;
}
const inside = (ring, px, py) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
function gridFromSvg(file) {
  const raw = fs.readFileSync(`${SRC}/${file}.svg`, 'utf8');
  const ds = [...raw.matchAll(/d="([^"]*)"/g)].map((m) => m[1]);
  const g = Array.from({ length: N }, () => Array(N).fill(0));
  // even-odd WITHIN each path, then UNION across paths. Running one even-odd pass over
  // every ring from every path lets a later path carve a hole in an earlier one — SVG
  // fills each <path> independently. pixelarticons' `fire` is two paths, and the wrong
  // order made its inner tongue delete part of the outer flame.
  for (const d of ds) {
    const rings = ringsFromPath(d);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let depth = 0;
      for (const r of rings) if (inside(r, x + 0.5, y + 0.5)) depth++;
      if (depth % 2 === 1) g[y][x] = 1;
    }
  }
  return g;
}

const RAMPS = {
  earned:  { ink: '#FEE761', deep: '#BD6C4A', chip: null },
  locked:  { ink: '#C0CBDC', deep: '#8B9BB4', chip: 'minus' },
  removed: { ink: '#8B9BB4', deep: '#5A6988', chip: 'cross' },
};
const CS = 9;   // chip is 9x9 in the lower right, with a 1px gap so it never fuses to the icon

// A filled 9x9 chip in the lower right with the symbol PUNCHED OUT of it, so the symbol
// reads as background showing through. Filling the symbol instead would be invisible
// against the filled chip.
function withChip(g, kind) {
  const body = g.map((r) => r.slice());
  const chip = Array.from({ length: N }, () => Array(N).fill(0));
  if (!kind) return { body, chip };
  const lx = N - CS, ly = N - CS;
  for (let y = ly; y < N; y++) for (let x = lx; x < N; x++) { chip[y][x] = 1; body[y][x] = 0; }   // punch the icon out beneath it
  const hole = (x, y) => { if (y >= ly && y < N && x >= lx && x < N) chip[y][x] = 0; };
  if (kind === 'minus') for (let x = lx + 2; x <= N - 3; x++) { hole(x, ly + 4); hole(x, ly + 5); }
  else for (let i = 1; i < CS - 1; i++) { hole(lx + i, ly + i); hole(N - 1 - i, ly + i); }
  return { body, chip };
}

function paths(g, ink) {
  const ds = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N;) {
    if (!g[y][x]) { x++; continue; }
    let run = 1; while (x + run < N && g[y][x + run]) run++;
    ds.push(`M${x} ${y}h${run}v1h-${run}z`);
    x += run;
  }
  return ds.length ? `<path fill="${ink}" shape-rendering="crispEdges" d="${ds.join('')}"></path>` : '';
}
// rim shading per bible rule 1: deep tone on the bottom/right edge only
function rimmed(g, ink, deep) {
  const rim = g.map((r, y) => r.map((v, x) => v && (!g[y + 1]?.[x] || !g[y][x + 1]) ? 2 : v ? 1 : 0));
  return paths(rim.map((r) => r.map((v) => v === 2 ? 0 : v)), ink) + paths(rim.map((r) => r.map((v) => v === 2 ? 1 : 0)), deep);
}
const count = (g) => g.flat().filter(Boolean).length;

const built = {};
console.log('badge           icon      painted  chip px  states differ?');
for (const [key, { icon }] of Object.entries(CHOICE)) {
  const g = gridFromSvg(icon);
  built[key] = {};
  const base = count(g);
  for (const [st, ramp] of Object.entries(RAMPS)) {
    const { body, chip } = withChip(g, ramp.chip);
    built[key][st] = rimmed(body, ramp.ink, ramp.deep) + paths(chip, ramp.deep);
  }
  const lockedChip = count(withChip(g, 'minus').chip), removedChip = count(withChip(g, 'cross').chip);
  console.log(`${key.padEnd(14)} ${icon.padEnd(9)} ${String(base).padStart(5)}   ${String(lockedChip).padStart(4)}    earned ${base} / locked body ${count(withChip(g, 'minus').body)} + ${lockedChip} chip / removed body ${count(withChip(g, 'cross').body)} + ${removedChip} chip`);
}

// built with an explicit loop: nested template literals inside ${} closed the
// interpolation early last time and wrote literal ").join('" into the file
const tempParts = [];
for (const [k, states] of Object.entries(built)) for (const [st, p] of Object.entries(states)) {
  tempParts.push(`<svg width="48" height="48" viewBox="0 0 24 24" role="img" aria-label="${k} badge, ${st}">${p}</svg>`);
}
fs.writeFileSync('assets-raw/badges24-temp.html', `<html><body>${tempParts.join('\n')}</body></html>`);

const cardHtml = [];
for (const [k, v] of Object.entries(CHOICE)) {
  // only the states the game can actually produce - see reachableStates below
  const reachable = v.revocable ? ['earned', 'locked', 'removed'] : ['earned', 'locked'];
  const stateCells = reachable.map((st) => `<div><svg width="48" height="48" viewBox="0 0 24 24">${built[k][st]}</svg><span>${st}</span></div>`).join('');
  cardHtml.push(`<div class="c"><div class="pair">${stateCells}<div><svg width="96" height="96" viewBox="0 0 24 24">${built[k].earned}</svg><span>96px</span></div></div><b>${k.replace(/_/g, ' ')} — ${v.icon}</b><em>${v.revocable ? 'revocable' : 'permanent'} · ${v.why}</em></div>`);
}
// PNG contact sheet so the set can be reviewed without a browser: rows = badges,
// columns = earned / locked / removed / earned-at-4x
import zlib from 'node:zlib';
const Z = 5, PAD = 14, CELLW = N * Z;
const cols = ['earned', 'locked', 'removed'];
const keys = Object.keys(CHOICE);
const W = PAD + cols.length * (CELLW + PAD), H = PAD + keys.length * (CELLW + PAD);
const img = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) { img[i * 4] = 21; img[i * 4 + 1] = 31; img[i * 4 + 2] = 29; img[i * 4 + 3] = 255; }
const put = (x, y, c) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2]; img[i + 3] = 255; };
keys.forEach((k, row) => {
  cols.forEach((st, col) => {
    const ramp = RAMPS[st];
    const { body, chip } = withChip(gridFromSvg(CHOICE[k].icon), ramp.chip);
    const rim = body.map((r, y) => r.map((v, x) => v && (!body[y + 1]?.[x] || !body[y][x + 1]) ? 2 : v ? 1 : 0));
    const cx = PAD + col * (CELLW + PAD), cy = PAD + row * (CELLW + PAD);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let hex = null;
      if (rim[y][x] === 1) hex = ramp.ink; else if (rim[y][x] === 2) hex = ramp.deep;
      else if (chip[y][x]) hex = ramp.deep;
      if (!hex) continue;
      const rgb = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
      for (let dy = 0; dy < Z; dy++) for (let dx = 0; dx < Z; dx++) put(cx + x * Z + dx, cy + y * Z + dy, rgb);
    }
  });
});
const raw = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; img.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync('assets-raw/badges24.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));

// assets/badges.json is the single source of truth for badge art, same role glyphs.json
// plays. States are pre-expanded because a state is a rendering of one drawing, not a
// separate drawing — the ramp and the chip are the only things that change.
const badgeOut = {};
for (const [k, v] of Object.entries(CHOICE)) {
  badgeOut[k] = {
    viewBox: '0 0 24 24',
    source: `pixelarticons:${v.icon} (MIT)`,
    meaning: v.why,
    revocable: v.revocable,
    // reachableStates is the contract the gallery and the app consume. The state SYSTEM is
    // uniform - a state is a ramp plus a chip and works for any badge - but only these
    // states can actually occur, so only these ship.
    reachableStates: v.revocable ? ['earned', 'locked', 'removed'] : ['earned', 'locked'],
    states: Object.fromEntries(Object.entries(built[k]).map(([st, p]) => [st, p])),
    ramps: RAMPS,
  };
}
fs.writeFileSync('assets/badges.json', JSON.stringify(badgeOut, null, 2));

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Badges from pixelarticons</title><style>
body{background:#0C1211;color:#F3EEDD;font:600 13px system-ui;padding:22px;margin:0}h1{font-size:19px}.lead{color:#A9B8B2;max-width:940px;font-weight:500}
.grid{display:flex;gap:14px;flex-wrap:wrap;margin-top:18px}
.c{background:#151F1D;border:2px solid #C9C1A8;box-shadow:0 3px 0 #2E4642;padding:14px;display:flex;flex-direction:column;align-items:center;gap:8px;width:262px;box-sizing:border-box}
.pair{display:flex;align-items:flex-end;gap:10px}
.pair>div{display:flex;flex-direction:column;align-items:center;gap:4px}
.pair span{font-size:9px;color:#A9B8B2;font-weight:500}
.c b{font-size:12px}.c em{font-style:normal;font-size:10px;color:#A9B8B2;text-align:center}
svg{image-rendering:pixelated;display:block}
</style></head><body>
<h1>Badges — real icons from the pack we already licensed</h1>
<p class="lead">These are <b>pixelarticons</b> (MIT), not my drawings, read straight out of the installed package. Grid is <b>24×24</b> because that is their grid — squeezing them to 16 would break the pixels the same way the rejected Shade attempt did. Each badge shows at 48px (2×) and 96px (4×); the profile card currently renders badges at 36px, which is not a whole multiple of 24 and is one of the things this ship has to fix.</p>
<p class="lead"><b>The removed state is no longer a cross over the whole icon.</b> Locked and removed get a small <b>corner chip</b> in the lower right — a minus for locked, a cross for removed — punched out of the symbol so it reads as background showing through. The chip replaces the icon's corner rather than lying on top of it, so the two never fuse into one blob.</p>
${cardHtml.join('')}
</body></html>`;
fs.writeFileSync('assets-raw/badges24.html', html);
console.log('\npage: http://localhost:5511/assets-raw/badges24.html');
console.log('gate temp: assets-raw/badges24-temp.html · nothing written to the handoff');
