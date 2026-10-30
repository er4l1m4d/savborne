// Rework the four UI chrome glyphs: back, check, lock, leave.
// 12x12 hand-drawn, single currentColor path (matching how the doc embeds them), then
// auto-centred so the painted bbox gets equal padding on both axes — the same rule the nav
// icons were held to. Emits a preview page (old vs new at 48px and 24px) and a gate temp.
import fs from 'node:fs';
import zlib from 'node:zlib';

const G = (rows) => {
  if (rows.length !== 12) throw new Error(`grid must be 12 rows, got ${rows.length}`);
  rows.forEach((r, i) => { if (r.length !== 12) throw new Error(`row ${i} is ${r.length} chars, need 12`); });
  return rows.map((r) => r.split(''));
};

// ── back: 2px chevron, apex left ──────────────────────────────────────
const back = G([
  '............',
  '............',
  '.......xx...',
  '......xx....',
  '.....xx.....',
  '....xx......',
  '....xx......',
  '.....xx.....',
  '......xx....',
  '.......xx...',
  '............',
  '............',
]);

// ── check: 2px strokes, short arm down to a vertex, long arm up ───────
const check = G([
  '............',
  '............',
  '............',
  '.........xx.',
  '........xx..',
  '.xx.....xx..',
  '..xx...xx...',
  '...xxxxx....',
  '............',
  '............',
  '............',
  '............',
]);

// ── lock: arch shackle, solid body, punched keyhole ───────────────────
const lock = G([
  '............',
  '....xxxx....',
  '....x..x....',
  '....x..x....',
  '..xxxxxxxx..',
  '..xxxxxxxx..',
  '..xxx..xxx..',
  '..xxx..xxx..',
  '..xxxxxxxx..',
  '............',
  '............',
  '............',
]);

// ── leave: doorway on the left, arrow leaving it to the right ─────────
const leave = G([
  '............',
  '.aaa........',
  '.a..........',
  '.a.....xx...',
  '.a......xx..',
  '.a..xxxxxx..',
  '.a..xxxxxx..',
  '.a......xx..',
  '.a.....xx...',
  '.a..........',
  '.aaa........',
  '............',
]);

// ── defend: OUTLINE heater shield, hollow inside ────────────────────────
// Deliberately an outline, not a fill: the Bronze Shield *item* is a filled heater with a
// boss, so a filled shield here would read as the item rather than the action.
const defend = G([
  '............',
  '.aaaaaaaaaa.',
  '.aa......aa.',
  '.aa......aa.',
  '.aa......aa.',
  '..aa....aa..',
  '..aa....aa..',
  '...aa..aa...',
  '....aaaa....',
  '.....aa.....',
  '............',
  '............',
]);

// ── use item: arrow driving down into a tray (was a bag — same shape as the
// Cloth Purse item the player can own, which is the collision being removed) ──
const useItem = G([
  '............',
  '.....aa.....',
  '.....aa.....',
  '.....aa.....',
  '...aaaaaa...',
  '....aaaa....',
  '.aa......aa.',
  '.aa......aa.',
  '.aa......aa.',
  '.aaaaaaaaaa.',
  '............',
  '............',
]);

// gallery label of the art each new glyph replaces
const OLD_LABEL = { back: 'back', check: 'check', lock: 'lock', leave: 'leave', defend: 'shield', useItem: 'bag' };
const CAPTION = { back: 'back', check: 'check', lock: 'lock', leave: 'leave', defend: 'Defend (was "shield")', useItem: 'Use item (was "bag")' };
function centered(g) {
  const on = g.map((r, y) => r.map((c, x) => (c === '.' ? null : { x, y }))).flat().filter(Boolean);
  const x0 = Math.min(...on.map((p) => p.x)), x1 = Math.max(...on.map((p) => p.x));
  const y0 = Math.min(...on.map((p) => p.y)), y1 = Math.max(...on.map((p) => p.y));
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const dx = Math.floor((12 - w) / 2) - x0, dy = Math.floor((12 - h) / 2) - y0;
  const out = Array.from({ length: 12 }, () => Array(12).fill('.'));
  for (const p of on) out[p.y + dy][p.x + dx] = 'x';
  return { grid: out, w, h, padL: dx + x0, padT: dy + y0, padR: 11 - (x1 + dx), padB: 11 - (y1 + dy) };
}

// run-length rect encoding, one path (currentColor) — the format the doc already uses
const isOn = (v) => v === 1 || v === 'x';
function paths(g, fill) {
  const N = g.length;
  const ds = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N;) {
    if (!isOn(g[y][x])) { x++; continue; }
    let run = 1; while (x + run < N && isOn(g[y][x + run])) run++;
    ds.push(`M${x} ${y}h${run}v1h-${run}z`);
    x += run;
  }
  return `<path fill="${fill}" shape-rendering="crispEdges" d="${ds.join('')}"></path>`;
}

// orphan check: a painted pixel with no 4-neighbour
function orphans(g) {
  let n = 0; const list = [];
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g.length; x++) {
    if (!isOn(g[y][x])) continue;
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isOn(g[y + dy]?.[x + dx] ?? 0));
    if (!nb) { n++; list.push(`${x},${y}`); }
  }
  return { n, list };
}

const SET = { back, check, lock, leave, defend, useItem };
const built = {};
console.log('glyph    bbox    padding L/R/T/B   orphans');
for (const [name, g] of Object.entries(SET)) {
  const c = centered(g);
  const o = orphans(c.grid);
  built[name] = c.grid;
  console.log(`${name.padEnd(7)} ${String(c.w).padStart(2)}x${String(c.h).padEnd(3)}   ${c.padL}/${c.padR}/${c.padT}/${c.padB}${' '.repeat(6 - String(c.padL + c.padR + c.padT + c.padB).length)}  ${o.n}${o.n ? ' <- ' + o.list.join(' ') : ''}`);
}

// ── third track: real MIT pixel icons, parsed from their own path data ─────────
// pixelarticons are rect-only paths (M/h/H/v/V/z, integer coords, no curves), so the
// bounding box of each closed subpath IS the painted rectangle. Parsed exactly — nothing
// is rasterised or anti-aliased, which is the failure mode the bible already rejected once.
const PIX = JSON.parse(fs.readFileSync('assets-raw/pixelarticons/icons.json', 'utf8'));
function rectsFromPath(d) {
  const cmds = [];
  for (const m of d.matchAll(/([MmHhVvZz])([^MmHhVvZz]*)/g)) cmds.push([m[1], (m[2].match(/-?\d*\.?\d+/g) || []).map(Number)]);
  const rects = [];
  let cx = 0, cy = 0, sx = 0, sy = 0, pts = [];
  const flush = () => {
    if (pts.length > 1) {
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      rects.push([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]);
    }
    pts = [];
  };
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
  return rects;
}
function gridFrom(pathsArr, N) {
  const g = Array.from({ length: N }, () => Array(N).fill(0));
  for (const d of pathsArr) for (const [ax, ay, bx, by] of rectsFromPath(d))
    for (let y = Math.min(ay, by); y < Math.max(ay, by); y++) for (let x = Math.min(ax, bx); x < Math.max(ax, bx); x++)
      if (g[y]) g[y][x] = 1;
  return g;
}
// 24 -> 12: a 2x2 block survives only if at least 2 of its 4 pixels are painted
function down2(g) {
  const out = Array.from({ length: 12 }, () => Array(12).fill(0));
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++)
    out[y][x] = (g[y * 2][x * 2] + g[y * 2 + 1][x * 2] + g[y * 2][x * 2 + 1] + g[y * 2 + 1][x * 2 + 1]) >= 2 ? 1 : 0;
  return out;
}
const px = (g) => g.flat().filter(isOn).length;
const cands = {};
for (const name of Object.keys(SET)) {
  cands[name] = (PIX.candidateFor[name] || []).map((icon) => {
    const g24 = gridFrom(PIX.icons[icon], 24);
    const g12 = down2(g24);
    return { icon, g24, g12, n24: px(g24), n12: px(g12), half: Math.round(px(g24) / 4), orphans12: orphans(g12).n };
  });
}
console.log('\nsourced (pixelarticons, MIT) — does their 24x24 survive our 12x12 grid?');
for (const [name, list] of Object.entries(cands)) {
  for (const c of list) console.log(`  ${name.padEnd(8)} ${c.icon.padEnd(13)} 24px grid: ${String(c.n24).padStart(3)}px   -> 12px grid: ${String(c.n12).padStart(3)}px (quarter of source = ${c.half})   orphans at 12: ${c.orphans12}`);
}


const doc = fs.readFileSync('Savborne-handoff.html', 'utf8');
// Match the svg whose </svg> is IMMEDIATELY followed by <code>label</code>. A single
// regex with a lazy span can leap across sibling svgs and return the wrong art.
const oldOf = (label) => {
  const want = new RegExp(`^\\s*<code>${label}</code>`);
  for (const m of doc.matchAll(/<svg\b[^>]*viewBox="0 0 12 12"[^>]*>[\s\S]*?<\/svg>/g)) {
    if (!want.test(doc.slice(m.index + m[0].length, m.index + m[0].length + 40))) continue;
    return m[0].replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  }
  return '';
};
const cell = (name, inner, size, cap) => cellX(inner, size, '0 0 12 12', cap);
const cellX = (inner, size, vb, cap) => `<div class="c"><svg width="${size}" height="${size}" viewBox="${vb}" shape-rendering="crispEdges" style="color:#F3EEDD">${inner}</svg><b>${cap}</b></div>`;
// their grid is 24x24; shown at whole-pixel scales, plus the honest 12x12 reduction
const sourced = (name) => cands[name].map((c) =>
  cellX(paths(c.g24, 'currentColor'), 48, '0 0 24 24', `${c.icon} native @48`) +
  cellX(paths(c.g24, 'currentColor'), 24, '0 0 24 24', `${c.icon} native @24`) +
  cellX(paths(c.g12, 'currentColor'), 24, '0 0 12 12', `${c.icon} → 12-grid @24`)).join('');
const rows = Object.keys(SET).map((name) => {
  const nw = paths(built[name], 'currentColor');
  const stats = cands[name].map((c) => `${c.icon}: ${c.n24}px at 24² → ${c.n12}px at 12² (a clean quarter would be ${c.half}), ${c.orphans12} orphan px`).join(' · ');
  return `<h3>${CAPTION[name]}</h3>
<div class="row"><span class="track">OURS</span>
  ${cell(name, oldOf(OLD_LABEL[name]), 48, 'OLD 48px')}${cell(name, oldOf(OLD_LABEL[name]), 24, 'OLD 24px (in-app)')}
  ${cell(name, nw, 48, 'NEW 48px')}${cell(name, nw, 24, 'NEW 24px (in-app)')}
  <div class="grid12">${(built[name].map((r) => r.join('')).join('\n'))}</div>
</div>
<div class="row"><span class="track src">SOURCED · pixelarticons · MIT</span>${sourced(name)}</div>
<p class="stat">${stats}</p>`;
}).join('');
fs.writeFileSync('assets-raw/glyphs-preview.html', `<!doctype html><html><head><meta charset="utf-8"><title>Glyph rework — back / check / lock / leave / Defend / Use item</title><style>
body{background:#0C1211;color:#F3EEDD;font:600 14px system-ui;padding:24px;margin:0}h1{font-size:20px}h3{margin:22px 0 6px}
.row{display:flex;align-items:flex-end;gap:16px;background:#151F1D;border:2px solid #C9C1A8;padding:14px;flex-wrap:wrap}
.c{display:flex;flex-direction:column;align-items:center;gap:6px;background:#0E1716;border:1px solid #2E4642;padding:10px;min-width:72px}
.c b{font-size:10px;color:#A9B8B2;font-weight:600}
svg{background:#0C1211}
.grid12{font:10px/11px monospace;color:#6FD0AE;white-space:pre;background:#0C1211;border:1px solid #2E4642;padding:6px}
.note{color:#A9B8B2;max-width:820px}
.track{font:800 10px system-ui;letter-spacing:.08em;color:#0C1211;background:#C9C1A8;padding:3px 7px;align-self:center}
.track.src{background:#6FD0AE}
.stat{color:#A9B8B2;font:500 11px/1.6 ui-monospace,monospace;margin:4px 0 0;max-width:900px}
.row .c:last-of-type{margin-right:0}</style></head><body>
<h1>UI glyph rework — back, check, lock, leave, and the two battle actions</h1>
<p class="note">The old four were drawn before the centring rule existed: each sits in a corner of its 12×12 cell with 4–6px of dead space on two sides, and "leave" is 11 disconnected chunks. New versions are auto-centred (equal padding both axes) and sized to fill the cell. Shown at 48px (gallery) and 24px (the size they actually render at in the app).</p>
<p class="note"><b>The last two are the collision fix.</b> What the gallery calls <code>shield</code> and <code>bag</code> are the <b>Defend</b> and <b>Use item</b> buttons in the battle action bar — each used exactly once. They were labelled by object, not function, and both duplicated items the player can own: the Bronze Shield is a filled heater, the Cloth Purse is a bag. So Defend becomes an <b>outline</b> shield (hollow, so it cannot be read as the item) and Use item stops being a bag entirely — an arrow driving down into a tray. The gallery labels become "Defend" and "Use item".</p>
<p class="note"><b>Where the SOURCED row comes from.</b> <a style="color:#6FD0AE" href="https://pixelarticons.com">pixelarticons</a> — 1036 free pixel icons, <b>MIT © Gerrit Halfmann</b>, drawn on a strict 24×24 grid as plain <code>&lt;path&gt;</code> rectangles with <code>fill="currentColor"</code> and no sub-pixel coordinates. Verified today at pixelarticons.com and github.com/halfmage/pixelarticons; the eight icons and the license text are vendored at <code>assets-raw/pixelarticons/</code>. They are parsed from their own path data, not screenshotted or resampled, so what you see is exactly their pixels. The last cell in each sourced row is their 24×24 reduced to our 12×12 grid (a 2×2 block survives only if ≥2 of its 4 pixels are painted) — that is the honest test of whether a 24-grid set can serve a 12-grid slot.</p>
${rows}
</body></html>`);
fs.writeFileSync('assets-raw/glyphs-temp.html', `<html><body>${Object.entries(built).map(([k, g]) => `<svg width="24" height="24" viewBox="0 0 12 12" role="img" aria-label="${k}">${paths(g, '#F3EEDD')}</svg>`).join('\n')}</body></html>`);
// their 24-grids reduced to our 12-grid, put through the same gate as ours
fs.writeFileSync('assets-raw/glyphs-sourced-temp.html', `<html><body>${Object.entries(cands).flatMap(([k, list]) => list.map((c) => `<svg width="24" height="24" viewBox="0 0 12 12" role="img" aria-label="sourced ${c.icon}">${paths(c.g12, '#F3EEDD')}</svg>`)).join('\n')}</body></html>`);

// ---- PNG sheet so the shapes can be looked at, not described ----
const parse = (d) => {
  const g = Array.from({ length: 12 }, () => Array(12).fill(0));
  for (const r of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) for (let i = 0; i < Number(r[3]); i++) g[Number(r[2])][Number(r[1]) + i] = 1;
  return g;
};
const sheet = Object.keys(SET).flatMap((name) => {
  const o = (oldOf(OLD_LABEL[name]).match(/d="([^"]*)"/) || [, ''])[1];
  return [{ cap: name + ' OLD', g: parse(o) }, { cap: name + ' NEW', g: built[name].map((r) => r.map((c) => (c === 'x' ? 1 : 0))) }];
});
const S = 10, PAD = 12, COLS = 4;
const ROWS = Math.ceil(sheet.length / COLS);
const CELL = 12 * S;
const W = PAD + COLS * (CELL + PAD + 30), H = PAD + ROWS * (CELL + PAD);
const img = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) { img[i * 4] = 12; img[i * 4 + 1] = 18; img[i * 4 + 2] = 17; img[i * 4 + 3] = 255; }
const put = (x, y, c) => { const i = (y * W + x) * 4; img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2]; img[i + 3] = 255; };
sheet.forEach((s, i) => {
  const cx = PAD + (i % COLS) * (CELL + PAD + 30) + 30, cy = PAD + Math.floor(i / COLS) * (CELL + PAD);
  for (let k = 0; k <= 12; k++) for (let t = 0; t < CELL; t++) { put(cx + t, cy + k * S, [30, 44, 42]); put(cx + k * S, cy + t, [30, 44, 42]); }
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
    if (!s.g[y][x]) continue;
    for (let dy = 0; dy < S - 1; dy++) for (let dx = 0; dx < S - 1; dx++) put(cx + x * S + dx, cy + y * S + dy, [243, 238, 221]);
  }
});
const raw = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; img.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync('assets-raw/glyphs-sheet.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log('sheet: assets-raw/glyphs-sheet.png — row-major, OLD/NEW pairs: back, check, lock, leave');
console.log('\npreview: http://localhost:5511/assets-raw/glyphs-preview.html');
console.log('gate temp: assets-raw/glyphs-temp.html');

// ---- comparison sheet: OURS | THEIRS native 24 | THEIRS forced to 12 ----
const cmp = Object.keys(SET).flatMap((name) => [
  { cap: `${name} OURS 12`, g: built[name], S: 9 },
  ...cands[name].map((c) => ({ cap: `${c.icon} 24`, g: c.g24, S: 9 })),
  ...cands[name].map((c) => ({ cap: `${c.icon} ->12`, g: c.g12, S: 9 })),
]);
const CP = 14;
const CCOLS = 3;
const CROWS = Math.ceil(cmp.length / CCOLS);
const CW = CP + CCOLS * (120 + CP + 90), CH = CP + CROWS * (120 + CP);
const cimg = Buffer.alloc(CW * CH * 4);
for (let i = 0; i < CW * CH; i++) { cimg[i * 4] = 12; cimg[i * 4 + 1] = 18; cimg[i * 4 + 2] = 17; cimg[i * 4 + 3] = 255; }
const cput = (x, y, c) => { const i = (y * CW + x) * 4; cimg[i] = c[0]; cimg[i + 1] = c[1]; cimg[i + 2] = c[2]; cimg[i + 3] = 255; };
cmp.forEach((s, i) => {
  const cx = CP + (i % CCOLS) * (120 + CP + 90) + 90, cy = CP + Math.floor(i / CCOLS) * (120 + CP);
  for (let y = 0; y < s.g.length; y++) for (let x = 0; x < s.g.length; x++) {
    if (!isOn(s.g[y][x])) continue;
    for (let dy = 0; dy < s.S - 1; dy++) for (let dx = 0; dx < s.S - 1; dx++) cput(cx + x * s.S + dx, cy + y * s.S + dy, [243, 238, 221]);
  }
});
const craw = Buffer.alloc(CH * (CW * 4 + 1));
for (let y = 0; y < CH; y++) { craw[y * (CW * 4 + 1)] = 0; cimg.copy(craw, y * (CW * 4 + 1) + 1, y * CW * 4, (y + 1) * CW * 4); }
fs.writeFileSync('assets-raw/glyphs-compare.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', (() => { const b = Buffer.alloc(13); b.writeUInt32BE(CW, 0); b.writeUInt32BE(CH, 4); b[8] = 8; b[9] = 6; return b; })()), chunk('IDAT', zlib.deflateSync(craw)), chunk('IEND', Buffer.alloc(0))]));
console.log('compare sheet: assets-raw/glyphs-compare.png — 3 per row: OURS 12-grid, then pixelarticons native 24-grid');
