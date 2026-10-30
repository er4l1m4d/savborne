// Stream 1b — the arena floor. Candidates come from Kenney's own sample map (floor-survey.mjs):
// r4c0 is his dominant floor tile (173 placements, flat #EAA56C) and r0c0 is the dark flat
// fill (86 placements, #763B36). Both are measured here against the sprites that must stand
// on them, because they trade against each other: a light floor makes the CONTOUR read and
// the FIGURE vanish, a dark floor does the opposite. Rendered, not argued.
import fs from 'node:fs';

const ART = JSON.parse(fs.readFileSync('assets/characters.json', 'utf8'));
const OUTLINE = '#3F2631', FIGURE = '#C0CBDC';

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

// flat tile colours, measured from the sheet by floor-survey.mjs
const TREATMENTS = [
  { id: 'today', name: 'flat arena panel', floor: null, bg: '#101A18', note: 'what ships now' },
  { id: 'copper', name: 'r4c0 copper floor', floor: '#EAA56C', bg: '#EAA56C', note: "Kenney's own dominant floor (173 uses)" },
  { id: 'dark', name: 'r0c0 dark floor', floor: '#763B36', bg: '#101A18', note: 'his dark flat fill (86 uses)' },
  { id: 'dark-edge', name: 'r0c0 floor + lit horizon', floor: '#763B36', bg: '#101A18', horizon: '#EAA56C', note: 'dark floor with the pack floor colour as a 1px edge' },
  { id: 'match', name: 'floor = the contour colour', floor: OUTLINE, bg: OUTLINE, note: 'r0c0/r0c1 dark family — makes the halo vanish by identity, not by contrast' },
];
const BAND = 64, ARENA_W = 346, ARENA_H = 200;

const arena = (t, key) => {
  const band = t.floor
    ? `<rect x="0" y="${ARENA_H - BAND}" width="${ARENA_W}" height="${BAND}" fill="${t.floor}"></rect>`
      + (t.horizon ? `<rect x="0" y="${ARENA_H - BAND}" width="${ARENA_W}" height="2" fill="${t.horizon}"></rect>` : '')
    : '';
  const ground = t.floor ?? t.bg;
  return `<figure><figcaption><b>${t.name}</b><span>${t.note}</span>
  <em>contour ${ratio(OUTLINE, ground).toFixed(2)}:1 · figure ${ratio(FIGURE, ground).toFixed(2)}:1</em></figcaption>
<svg width="${ARENA_W}" height="${ARENA_H}" viewBox="0 0 ${ARENA_W} ${ARENA_H}" role="img" aria-label="${key} on ${t.name}">
  <rect width="${ARENA_W}" height="${ARENA_H}" fill="${t.bg}"></rect>${band}
  <g transform="translate(58 ${ARENA_H - BAND - 80 + 20}) scale(5)" shape-rendering="crispEdges">${ART[key]}</g>
</svg></figure>`;
};

const KEYS = ['Hero · Silver', 'Rival · Mint Wraith'];
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Arena floor candidates</title><style>
body{background:#0C1211;color:#F3EEDD;font:600 13px system-ui;padding:22px;margin:0}h1{font-size:19px}h3{margin:26px 0 10px;color:#A9B8B2;font-size:13px}
.row{display:flex;gap:16px;flex-wrap:wrap}
figure{margin:0}figcaption{margin-bottom:6px;width:346px;box-sizing:border-box}figcaption b{display:block;font-size:12px}
figcaption span{display:block;color:#A9B8B2;font-size:10px;font-weight:500;min-height:26px}
figcaption em{font-style:normal;font-size:10px;font-family:ui-monospace,monospace;color:#6FD0AE}
svg{border:2px solid #2E4642;display:block}
.note{color:#A9B8B2;max-width:940px}
table{border-collapse:collapse;margin:16px 0;font-size:12px}td,th{border:1px solid #2E4642;padding:5px 10px;text-align:left}th{background:#151F1D}
</style></head><body>
<h1>Arena floor candidates — the trade, measured</h1>
<p class="note">The contour is <code>${OUTLINE}</code>. It only reads as a line when the ground is lighter than it — which is why a flat dark panel turns it into a film. But the pack's own floor is <b>copper <code>#EAA56C</code></b>, and our silver knight is <code>${FIGURE}</code>: put a copper floor under a steel figure and the <i>figure</i> merges into the ground instead. These two requirements trade against each other, so pick on the numbers.</p>
<table><tr><th>treatment</th><th>floor</th><th>contour vs floor</th><th>figure vs floor</th><th>verdict</th></tr>
${TREATMENTS.map((t) => {
  const g = t.floor ?? t.bg;
  const c = ratio(OUTLINE, g), f = ratio(FIGURE, g);
  return `<tr><td>${t.name}</td><td><code>${g}</code></td><td>${c.toFixed(2)}:1</td><td>${f.toFixed(2)}:1</td><td>${c < 1.05 ? 'contour identical to ground — no halo exists' : f < 3 ? 'contour reads, figure merges' : c < 3 ? 'contour still a film' : 'both read'}</td></tr>`;
}).join('')}
</table>
${KEYS.map((k) => `<h3>${k}</h3><div class="row">${TREATMENTS.map((t) => arena(t, k)).join('')}</div>`).join('')}
<p class="note"><b>Why the copper floor is out.</b> It is Kenney's own dominant floor tile and it does fix the contour — 6.59:1. It also drops the silver knight to <b>1.27:1 against its own ground</b>, which is worse than the problem being solved. Our sprites are steel and gold; the pack's floors were built for characters that stand <i>in front of</i> them, not on a flat panel of them.<br><br><b>The last row is the one that actually works, and it works by identity rather than contrast.</b> Set the arena floor to the contour colour itself and the halo stops existing — there is nothing to see, because the film and the ground are the same value. The figure then sits at <b>8.36:1</b> — comfortably above the 3:1 bar the gate enforces — and <code>#3F2631</code> is already a pack colour, so no new token is invented and the palette rule holds. The cost is honest and worth stating: the arena becomes a plum field rather than a near-black one, and the sprites lose their outline entirely — they will read as pure fill, which is a real change of character, not a free fix.</p>
</body></html>`;
fs.writeFileSync('assets-raw/arena-floor.html', html);
console.log('preview: http://localhost:5511/assets-raw/arena-floor.html');
for (const t of TREATMENTS) {
  const g = t.floor ?? t.bg;
  console.log(`  ${t.name.padEnd(26)} floor ${g}  contour ${ratio(OUTLINE, g).toFixed(2)}:1  figure ${ratio(FIGURE, g).toFixed(2)}:1`);
}
