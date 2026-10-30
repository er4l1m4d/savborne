// The outline shell, measured — second pass.
// First pass falsified its own hypothesis: every existing ground token lands between
// 1.04:1 and 1.38:1 against #3F2631, so "lighten the arena" cannot work with the palette
// we have. This computes what floor WOULD be needed, and renders the two options that
// are actually available: a decided mid-tone floor, or quantising the outline away.
import fs from 'node:fs';

const ART = JSON.parse(fs.readFileSync('assets/characters.json', 'utf8'));
const OUTLINE = '#3F2631';
const KEYS = ['Hero · Silver', 'Rival · Mint Wraith', 'Heroine · Entry'];

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0').toUpperCase()).join('');
// solve for a ground LIGHTER than the outline at ratio r: (Lg+0.05)/(Lo+0.05) = r
const lighterFloor = (r) => r * (lum(OUTLINE) + 0.05) - 0.05;
const hexFromL = (L) => {                 // neutral grey-green with luminance ~L
  const inv = (l) => 255 * (l <= 0.00304 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055);
  return toHex([inv(L * 0.9), inv(L), inv(L * 0.95)]);
};

const EXISTING = [
  ['#0C1211', 'page ground (--sv-ground)'], ['#101A18', 'arena today'], ['#151F1D', 'surface'],
  ['#1C2E29', 'app --surface'], ['#274438', 'app --surface-hi'], ['#2E4642', 'edge / bevel-shadow'],
];
const NEEDS = [1.5, 2, 3].map((r) => ({ r, L: lighterFloor(r), hex: hexFromL(lighterFloor(r)) }));

const cell = (key, bg, label, sub, ok, art) => `<div class="cell" style="background:${bg}">
  <svg width="96" height="96" viewBox="0 0 16 16" style="image-rendering:pixelated" role="img" aria-label="${key} on ${label}">${art || ART[key]}</svg>
  <b>${bg}</b><span>${label}</span><em class="${ok ? 'ok' : 'bad'}">${sub}</em></div>`;

const strip = (k) => EXISTING.map(([bg, name]) =>
  cell(k, bg, name, `outline ${ratio(OUTLINE, bg).toFixed(2)}:1`, ratio(OUTLINE, bg) >= 1.6)).join('');
// option 3 really does merge the contour into the floor, so the claim on the page is true
const mergedIntoFloor = (k) => ART[k].replace(/fill="#3F2631"/g, 'fill="#101A18"');
const options = (k) => [
  cell(k, '#101A18', 'arena today', 'the film, as shipped', false),
  cell(k, NEEDS[1].hex, `new mid-tone floor at ${NEEDS[1].r}:1`, 'needs a new token', true),
  cell(k, '#101A18', 'contour merged into the floor', 'halo gone — contour gone too', true, mergedIntoFloor(k)),
].join('');

fs.writeFileSync('assets-raw/outline-ground.html', `<!doctype html><html><head><meta charset="utf-8"><title>The outline shell — what it actually takes</title><style>
body{background:#0C1211;color:#F3EEDD;font:600 13px system-ui;padding:22px;margin:0}h1{font-size:19px}h3{margin:24px 0 8px;font-size:14px;color:#A9B8B2}
.strip,.opts{display:flex;gap:12px;flex-wrap:wrap}
.cell{display:flex;flex-direction:column;align-items:center;gap:5px;padding:12px;border:2px solid #2E4642;width:124px;box-sizing:border-box;text-align:center}
.cell b{font-size:12px}.cell span{font-size:10px;color:#A9B8B2;font-weight:500;min-height:24px}
.cell em{font-style:normal;font-size:10px;font-family:ui-monospace,monospace}
.ok{color:#6FD0AE}.bad{color:#F2735A}
.note{color:#A9B8B2;max-width:920px}
table{border-collapse:collapse;margin:14px 0;font-size:12px}td,th{border:1px solid #2E4642;padding:5px 10px;text-align:left}th{background:#151F1D}</style></head><body>
<h1>The outline shell — what it actually takes</h1>
<p class="note"><b>Correction to the first version of this page,</b> which claimed the fix was "almost certainly the ground". The table below falsifies that: every ground token in the system measures between 1.04:1 and 1.38:1 against the pack outline <code>${OUTLINE}</code>. There is no existing floor that makes it read as a line.</p>
<h3>Every ground token we already own</h3>
<table><tr><th>ground</th><th>role</th><th>outline vs ground</th></tr>
${EXISTING.map(([bg, n]) => `<tr><td><code>${bg}</code></td><td>${n}</td><td>${ratio(OUTLINE, bg).toFixed(2)}:1</td></tr>`).join('')}
</table>
${KEYS.map((k) => `<h3>${k}</h3><div class="strip">${strip(k)}</div>`).join('')}
<h3 style="margin-top:30px">The arithmetic of what would be needed</h3>
<p class="note">The outline is <code>${OUTLINE}</code> at luminance ${lum(OUTLINE).toFixed(4)}. It cannot be pushed below the arena — darkening the ground to reach contrast is mathematically impossible here, because the outline is already lighter than every surface and you cannot go below black. The only direction is a ground <i>lighter</i> than the outline:</p>
<table><tr><th>target contrast</th><th>required ground luminance</th><th>approximate colour</th><th>what it does to the screen</th></tr>
${NEEDS.map((n) => `<tr><td>${n.r}:1</td><td>${n.L.toFixed(4)}</td><td><code>${n.hex}</code></td><td>${n.r === 1.5 ? 'still reads as a haze' : n.r === 2 ? 'a visible mid-tone floor — a real design change' : 'a bright floor; the arena stops feeling like a night scene'}</td></tr>`).join('')}
</table>
<h3>The two options that are actually available</h3>
${KEYS.map((k) => `<h3>${k}</h3><div class="opts">${options(k)}</div>`).join('')}
<p class="note" style="margin-top:24px"><b>And the third, which the numbers point at.</b> These tiles were authored to sit on a <i>tilemap floor</i> — walls, grass, stone — where a dark contour has something to separate from. On a flat single-colour panel the contour has no job, so it stops being a line and becomes a halo. The bible already carries an unbuilt row for exactly this: "Arena backdrop — full environment tileset (walls, floors, gate, torches), bonus, optional." That row is no longer optional if the film matters to you; it is the only fix that leaves both the sprites and the palette untouched.</p>
</body></html>`);
console.log('preview: http://localhost:5511/assets-raw/outline-ground.html');
console.log('\nexisting grounds vs outline:');
for (const [bg, n] of EXISTING) console.log(`  ${bg}  ${n.padEnd(26)} ${ratio(OUTLINE, bg).toFixed(2)}:1`);
console.log('\nground needed for a real line:');
for (const n of NEEDS) console.log(`  ${n.r}:1  ->  L ${n.L.toFixed(4)}  ~${n.hex}`);
