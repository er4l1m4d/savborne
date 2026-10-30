// Character batch — extract pack sprites (4 hero gears + goblin rival), preview page + gate temp
import fs from 'node:fs';
import zlib from 'node:zlib';

function decodePng(buf) {
  let pos = 8; let w, h, ctype, idat = [];
  const plte = []; let trns = null;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ctype = data[9]; }
    else if (type === 'PLTE') { for (let i = 0; i < data.length; i += 3) plte.push([data[i], data[i + 1], data[i + 2]]); }
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = ctype === 3 ? 1 : (ctype === 6 ? 4 : 3);
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[rp++]; const line = raw.slice(rp, rp + stride); rp += stride;
    const cur = out.slice(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], cc = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (f === 1) v = (v + a) & 255; else if (f === 2) v = (v + b) & 255;
      else if (f === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (f === 4) { const p = a + b - cc, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - cc); v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : cc)) & 255; }
      cur[x] = v;
    }
  }
  return { w, h, ctype, plte, trns, out, stride };
}
const P = decodePng(fs.readFileSync('assets-raw/kenney_tinydungeon/Tilemap/tilemap_packed.png'));
const hexOf = ([r, g, b]) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
const pxAt = (x, y) => {
  if (P.ctype === 6) { const i = y * P.stride + x * 4; return [P.out[i], P.out[i + 1], P.out[i + 2], P.out[i + 3]]; }
  if (P.ctype === 2) { const i = y * P.stride + x * 3; return [P.out[i], P.out[i + 1], P.out[i + 2], 255]; }
  const idx = P.out[y * P.stride + x]; const c = P.plte[idx] || [0, 0, 0];
  return [c[0], c[1], c[2], P.trns && P.trns[idx] !== undefined ? P.trns[idx] : 255];
};
const tileGrid = (r, c) => Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => {
  const p = pxAt(c * 16 + x, r * 16 + y); return p[3] < 128 ? null : hexOf(p);
}));
const recolor = (g, map) => g.map((row) => row.map((v) => (v && map[v] ? map[v] : v)));
const GOLD_MAP = { '#C0CBDC': '#FEE761', '#8B9BB4': '#FEAE34', '#52607C': '#BD6C4A', '#262B44': '#763B36' };

function paths(g) {
  const byColor = new Map();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16;) {
    const col = g[y][x]; if (!col) { x++; continue; }
    let run = 1; while (x + run < 16 && g[y][x + run] === col) run++;
    if (!byColor.has(col)) byColor.set(col, []);
    byColor.get(col).push(`M${x} ${y}h${run}v1h-${run}z`);
    x += run;
  }
  return [...byColor].map(([col, ds]) => `<path fill="${col}" shape-rendering="crispEdges" d="${ds.join('')}"></path>`).join('');
}

// AI rival roster — one of these four is rolled per AI battle (uniform random,
// stable per battle id). Sword r8c8 and goblin r7c3 are rejected/superseded.
const RIVALS = [
  { key: 'Mint Wraith', r: 9, c: 0, note: 'r9c0 pack-native — #43E1B3 blob ghost, on-brand with the mint accent' },
  { key: 'Hollow Ghost', r: 10, c: 1, note: 'r10c1 pack-native — pale sheet ghost' },
  { key: 'Hooded Miser', r: 9, c: 3, note: 'r9c3 pack-native — hood, #E84537 eyes, grey beard' },
  { key: 'Cutpurse', r: 9, c: 1, note: 'r9c1 pack-native — tan-hooded bandit' },
];
const HEROES = [
  { key: 'Hero · Entry', note: 'r7c1 pack-native' },
  { key: 'Hero · Bronze', note: 'r8c2 pack-native' },
  { key: 'Hero · Silver', note: 'r8c0 pack-native' },
  { key: 'Hero · Gold', note: 'r8c0 + declared gilt map' },
];

const HERO_ENTRY = tileGrid(7, 1);
const HERO_BRONZE = tileGrid(8, 2);
const HERO_SILVER = tileGrid(8, 0);
const HEAD_SOURCE = tileGrid(8, 3);
const OUTLINE = '#3F2631';
const HAIR = '#BD6C4A';

// Heroine head = r8c3 rows 0-9, clipped to cols 2-13. The clip drops the single
// column of loose hair that made her head wider than the hero's, which puts her
// outline on the hero's own outline columns. Eyes already sit at cols 6 and 10 in
// both tiles, so the face lands in exactly the same place — no repositioning.
const heroineHead = () => Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) =>
  y <= 9 && x >= 2 && x <= 13 ? HEAD_SOURCE[y][x] : null));

// Body rows 10-15 come from the gear tile verbatim: pauldrons, belt, legs and
// every armour colour untouched. Hair is cropped at the neck, so no lock falls
// over a shoulder.
const dressHeroine = (body) => {
  const head = heroineHead();
  return Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => (y <= 9 ? head[y][x] : body[y][x])));
};

// Closed-helm gears keep the helm verbatim. Identity comes from four hair pixels
// in the shadow band under the rim (row 10, cols 5,6,9,10) — outline cells only,
// so no armour cell is lost and no painted cell is emptied. The build asserts the
// target cells really are outline; if the pack ever shifts, this fails loudly.
const HELM_LOCKS = [[10, 5], [10, 6], [10, 9], [10, 10]];
const withHelmLocks = (helm) => {
  const g = helm.map((row) => row.slice());
  for (const [y, x] of HELM_LOCKS) {
    if (g[y][x] !== OUTLINE) throw new Error(`helm lock at r${y}c${x} is ${g[y][x]}, not outline — recipe invalid`);
    g[y][x] = HAIR;
  }
  return g;
};

const CHARS = {
  'Hero · Entry': HERO_ENTRY,
  'Hero · Bronze': HERO_BRONZE,
  'Hero · Silver': HERO_SILVER,
  'Hero · Gold': recolor(HERO_SILVER, GOLD_MAP),
  'Heroine · Entry': dressHeroine(HERO_ENTRY),
  'Heroine · Bronze': dressHeroine(HERO_BRONZE),
  'Heroine · Silver': withHelmLocks(HERO_SILVER),
  'Heroine · Gold': recolor(withHelmLocks(HERO_SILVER), GOLD_MAP),
  ...Object.fromEntries(RIVALS.map((v) => [`Rival · ${v.key}`, tileGrid(v.r, v.c)])),
};
fs.mkdirSync('assets', { recursive: true });
fs.writeFileSync('assets/characters.json', JSON.stringify(Object.fromEntries(Object.entries(CHARS).map(([k, g]) => [k, paths(g)]))));

const HEROINES = [
  { key: 'Heroine · Entry', gear: 'Entry', note: 'head r8c3 cols 2–13 + body r7c1 verbatim' },
  { key: 'Heroine · Bronze', gear: 'Bronze', note: 'head r8c3 cols 2–13 + body r8c2 verbatim' },
  { key: 'Heroine · Silver', gear: 'Silver', note: 'helm r8c0 verbatim + 4 hair pixels at row 10, cols 5,6,9,10' },
  { key: 'Heroine · Gold', gear: 'Gold', note: 'Silver heroine + declared gilt map' },
];

const svg = (key, size) => `<svg width="${size}" height="${size}" viewBox="0 0 16 16" role="img" aria-label="${key}" style="image-rendering:pixelated">${paths(CHARS[key])}</svg>`;
const keys = Object.keys(CHARS);
const NOTE = Object.fromEntries([
  ...HEROES.map((h) => [h.key, h.note]),
  ...HEROINES.map((h) => [h.key, h.note]),
  ...RIVALS.map((v) => [`Rival · ${v.key}`, v.note]),
]);
const card = (k) => `
<div class="card"><div class="row">${svg(k, 128)}${svg(k, 64)}${svg(k, 16)}</div><b>${k}</b><span>${NOTE[k]}</span></div>`;
const heroCards = HEROES.map((h) => card(h.key)).join('');
const rivalCards = RIVALS.map((v) => card(`Rival · ${v.key}`)).join('');
const pairRows = HEROINES.map((h, i) => {
  const heroKey = HEROES[i].key;
  const same = CHARS[heroKey].flat().filter((v, j) => v !== CHARS[h.key].flat()[j]).length;
  return `<div class="pair">
  <div class="side">${svg(heroKey, 128)}<b>${heroKey}</b></div>
  <div class="delta">${same} px differ</div>
  <div class="side">${svg(h.key, 128)}<b>${h.key}</b></div>
  <span>${h.note}</span>
</div>`;
}).join('');
const duel = (v) => `<div class="arena">
  <div class="fighter"><div class="hp"><i style="width:78%;background:#6FD0AE"></i></div>${svg('Hero · Silver', 96)}<b>Kemi · Silver</b></div>
  <div class="vs">VS</div>
  <div class="fighter"><div class="hp"><i style="width:62%;background:#F2735A"></i></div>${svg(`Rival · ${v.key}`, 96)}<b>${v.key}</b></div>
</div>`;
fs.writeFileSync('assets-raw/characters-preview.html', `<!doctype html><html><head><meta charset="utf-8"><title>Characters — review before ship</title><style>
body{background:#0C1211;color:#F3EEDD;font:600 14px system-ui;padding:24px;margin:0}h1{font-size:20px}h2{font-size:16px;margin:26px 0 4px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.card{background:#151F1D;border:2px solid #C9C1A8;box-shadow:0 3px 0 #2E4642;padding:14px;display:flex;flex-direction:column;align-items:center;gap:8px}
.card b{font-size:15px}
.card span{color:#A9B8B2;font-size:11px;font-weight:500;text-align:center}
.row{display:flex;align-items:flex-end;gap:14px;background:#0E1716;border:2px solid #2E4642;padding:10px}
.duels{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}
.arena{display:flex;gap:12px;align-items:flex-end;justify-content:center;background:#101A18;border:2px solid #C9C1A8;padding:16px;box-sizing:border-box;min-width:0}
.fighter{display:flex;flex-direction:column;gap:6px;align-items:center;text-align:center;min-width:0}
.fighter b{display:block;width:96px;font-size:13px}
.hp{width:96px;height:12px;box-sizing:border-box;border:2px solid #C9C1A8;background:#0C1211}
.hp i{display:block;height:100%}
.vs{align-self:center;font:400 16px 'Courier New',monospace;color:#F3EEDD;flex:0 0 auto}
.note{color:#A9B8B2;max-width:760px}
.pair{background:#151F1D;border:2px solid #C9C1A8;box-shadow:0 3px 0 #2E4642;padding:16px;display:flex;align-items:flex-end;gap:18px;flex-wrap:wrap;margin:12px 0}
.pair .side{display:flex;flex-direction:column;align-items:center;gap:6px}
.pair b{font-size:13px}
.pair span{flex:1 1 200px;color:#A9B8B2;font-size:11px;font-weight:500;align-self:center}
.delta{font:400 12px 'Courier New',monospace;color:#6FD0AE;align-self:center;white-space:nowrap}
.rule{background:#151F1D;border:2px solid #6FD0AE;padding:12px 14px;max-width:760px;margin:10px 0 4px}</style></head><body>
<h1>Character batch — hero gears, heroine gears, the AI rival roster</h1>
<p class="note">Each card: 8× (arena size), 4×, 1× (source grid). Heroes and rivals are single Tiny Dungeon tiles at 16×16; heroines are composites built from pack tiles only — no invented kits, no scaling artifacts. Gold uses the declared gilt map from the bible.</p>

<h2>Hero gears (what the player is)</h2>
<div class="grid">${heroCards}</div>

<h2>Heroine gears — hero and heroine, gear by gear</h2>
<p class="rule"><b>Recipe:</b> her head is tile <code>r8c3</code> rows 0–9, clipped to columns 2–13 so her outline lands on the hero's own outline columns (both tiles put eyes at columns 6 and 10, so the face sits in exactly the same place). The body is the gear tile's rows 10–15 verbatim — pauldrons, belt, legs and colours untouched, hair cropped at the neck. The two closed-helm gears keep the helm pixel-for-pixel and gain four hair pixels in the shadow band under the rim, outline cells only.</p>
${pairRows}
<div class="grid">${HEROINES.map((h) => card(h.key)).join('')}</div>

<h2>Rival roster (what the AI is)</h2>
<p class="rule"><b>Roll rule:</b> every AI battle draws one of these four at random — uniform across the pool, and fixed for the life of that battle (derived from the battle id, so re-polling the screen never re-rolls it). Each rival carries its own name into the UI: the HP bar and the result line read <i>“Mint Wraith wins”</i>, not <i>“Savborne AI wins”</i>. Friend battles are unaffected — a human always shows their own gear sprite.</p>
<div class="grid">${rivalCards}</div>
<p class="note"><b>Coverage caveat, stated plainly:</b> Mint Wraith is the sparsest tile in the roster — it paints a 14×12 area inside its 16×16 cell (52% of pixels) where Hooded Miser and Cutpurse fill 84%. It is also the only rival that floats: its feet stop two pixels above the cell floor. Pack-native means no rescaling, so in the arena it reads smaller and airier than the other three. That is either a feature (a ghost, drifting) or a reason to swap it — your call, not mine.</p>

<h2>Same battle, four possible opponents</h2>
<div class="duels">${RIVALS.map(duel).join('')}</div>
</body></html>`);
fs.writeFileSync('assets-raw/characters-temp.html', `<html><body>${keys.map((k) => svg(k, 36)).join('\n')}</body></html>`);
for (const k of keys) {
  const rows = CHARS[k].map((row) => row.some(Boolean));
  const first = rows.indexOf(true), last = 15 - rows.lastIndexOf(true);
  const n = CHARS[k].flat().filter(Boolean).length;
  console.log(`coverage  ${k}: ${n}px (${(n / 256 * 100).toFixed(0)}%)  empty top ${first} bottom ${last}`);
}
console.log('chars:', keys.join(' | '));
console.log('preview: http://localhost:5511/assets-raw/characters-preview.html');

// `--grids` dumps every composed grid with a column ruler, so the seam between a
// borrowed head and a borrowed body can be inspected as pixels, not described.
if (process.argv.includes('--grids')) {
  const LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const seen = [...new Set(Object.values(CHARS).flat().flat().filter(Boolean))].sort();
  const leg = new Map(seen.map((h, i) => [h, LETTERS[i] || '?']));
  for (const k of keys) {
    console.log(`\n=== ${k} ===`);
    console.log('    ' + [...Array(16).keys()].map((i) => i % 10).join(''));
    CHARS[k].forEach((row, y) => console.log(String(y).padStart(2, ' ') + ' ' + row.map((v) => (v ? leg.get(v) : '.')).join('').padEnd(16, ' ')));
  }
  console.log('\nlegend:', seen.map((h, i) => `${LETTERS[i]}=${h}`).join(' '));
}
