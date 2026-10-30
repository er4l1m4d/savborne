// The badges as they exist on the profile screen today, extracted from the handoff and
// rendered three ways: at their real 36px, at 12x so the pixels are countable, and with
// each colour's contrast against the card and the page ground.
// This is the "before" for the rework — no interpretation, just what is on screen.
import fs from 'node:fs';
import zlib from 'node:zlib';

const h = fs.readFileSync('Savborne-handoff.html', 'utf8');
const CARD = '#151F1D', GROUND = '#0C1211';

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

const found = [...h.matchAll(/<svg\b[^>]*viewBox="0 0 8 8"[^>]*>[\s\S]*?<\/svg>/g)]
  .map((m) => ({ tag: m[0], label: (m[0].match(/aria-label="([^"]*)"/) || [, '(unlabelled)'])[1] }));

// dedupe by label, keeping the first occurrence of each distinct label
const byLabel = new Map();
for (const f of found) if (!byLabel.has(f.label)) byLabel.set(f.label, f);
// two 8x8 marks on this grid are UI chrome, not badges — kept separate so the badge
// rework does not accidentally adopt an arrow or a warning triangle
const all = [...byLabel.values()];
const list = all.filter((b) => /badge/i.test(b.label));
const nonBadges = all.filter((b) => !/badge/i.test(b.label));
if (nonBadges.length) console.log(`8x8 marks that are NOT badges (UI chrome, separate question): ${nonBadges.map((b) => b.label).join(', ')}\n`);

console.log(`${found.length} 8x8 badge svgs, ${list.length} distinct labels\n`);
for (const b of list) {
  b.cols = [...new Set((b.tag.match(/fill="[^"]+"/g) || []).map((s) => s.slice(6, -1)))];
  b.best = Math.max(...b.cols.map((c) => ratio(c, CARD)));
  console.log(`${b.label}`);
  console.log(`   colours: ${b.cols.join(' ')}   (${b.cols.length} flat colour${b.cols.length === 1 ? ' — no shading, no roundel, no ribbon' : ''})`);
  console.log(`   best vs card ${b.best.toFixed(2)}:1  ${b.best >= 3 ? 'OK' : '*** FAILS the 3:1 bar ***'}`);
}

// ---- PNG sheet: each badge at 12x, on the card colour it actually sits on ----
const Z = 12, PAD = 16, COLS = Math.min(4, list.length);
const R = Math.ceil(list.length / COLS);
const CELL = 8 * Z;
const W = PAD + COLS * (CELL + PAD + 30), H = PAD + R * (CELL + PAD + 18);
const img = Buffer.alloc(W * H * 4);
const bgc = [parseInt(CARD.slice(1, 3), 16), parseInt(CARD.slice(3, 5), 16), parseInt(CARD.slice(5, 7), 16)];
for (let i = 0; i < W * H; i++) { img[i * 4] = bgc[0]; img[i * 4 + 1] = bgc[1]; img[i * 4 + 2] = bgc[2]; img[i * 4 + 3] = 255; }
const put = (x, y, c) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2]; img[i + 3] = 255; };
list.forEach((b, n) => {
  const g = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (const p of b.tag.matchAll(/fill="([^"]+)"[^>]*d="([^"]*)"/g)) {
    const rgb = [parseInt(p[1].slice(1, 3), 16), parseInt(p[1].slice(3, 5), 16), parseInt(p[1].slice(5, 7), 16)];
    for (const r of p[2].matchAll(/M(\d+) (\d+)h(\d+)/g))
      for (let i = 0; i < Number(r[3]); i++) if (g[Number(r[2])]) g[Number(r[2])][Number(r[1]) + i] = rgb;
  }
  const cx = PAD + (n % COLS) * (CELL + PAD + 30) + 30, cy = PAD + Math.floor(n / COLS) * (CELL + PAD + 18);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    if (!g[y][x]) continue;
    for (let dy = 0; dy < Z; dy++) for (let dx = 0; dx < Z; dx++) put(cx + x * Z + dx, cy + y * Z + dy, g[y][x]);
  }
});
const raw = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; img.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync('assets-raw/badges-before.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));

// ---- HTML: real 36px as the profile shows them, next to 12x, with the numbers ----
// The doc already embeds badges at width="36", so size any svg to whatever we want rather
// than assuming it says 8.
const sized = (tag, px) => tag.replace(/\swidth="\d+"/, ` width="${px}"`).replace(/\sheight="\d+"/, ` height="${px}"`);
const cards = list.map((b) => `<div class="c"><div class="pair"><div class="real">${sized(b.tag, 36)}</div><div>${sized(b.tag, 96)}</div></div><b>${b.label}</b><span>${b.cols.join(' · ')}</span><em class="${b.best >= 3 ? 'ok' : 'bad'}">best ${b.best.toFixed(2)}:1 ${b.best >= 3 ? 'passes' : 'FAILS 3:1'}</em></div>`).join('');
fs.writeFileSync('assets-raw/badges-before.html', `<!doctype html><html><head><meta charset="utf-8"><title>The profile badges, today</title><style>
body{background:${GROUND};color:#F3EEDD;font:600 13px system-ui;padding:22px;margin:0}h1{font-size:19px}.lead{color:#A9B8B2;max-width:900px;font-weight:500}
.grid{display:flex;gap:14px;flex-wrap:wrap;margin-top:18px}
.c{background:${CARD};border:2px solid #C9C1A8;box-shadow:0 3px 0 #2E4642;padding:14px;display:flex;flex-direction:column;align-items:center;gap:7px;width:236px;box-sizing:border-box}
.pair{display:flex;align-items:flex-end;gap:12px;background:${GROUND};padding:10px;border:1px solid #2E4642}
.real{outline:1px dashed #4B5A56}
.c b{font-size:12px}.c span{font-size:9px;color:#A9B8B2;font-weight:500;font-family:ui-monospace,monospace}
.c em{font-style:normal;font-size:10px;font-family:ui-monospace,monospace}
.ok{color:#6FD0AE}.bad{color:#F2735A}
svg{image-rendering:pixelated;display:block}
</style></head><body>
<h1>The profile badges as they are today</h1>
<p class="lead">Extracted from the handoff, unedited. Left in each pair is the badge at the <b>36px it actually renders at on the profile screen</b>; right is the same art at 96px so the pixels can be counted.</p>
<div class="grid">${cards}</div>
<p class="lead" style="margin-top:20px"><b>The finding, and it is not the one I expected.</b> Every one of these badges is a <b>single flat colour</b> — one silhouette, one fill, no shading, no rim, no ribbon. To be clear about what that does and does not mean: the silhouettes <i>are</i> distinct (a funnel, a flame, a sword, a shield, a flag, a crown), so this is not a legibility disaster. What is missing is <b>badgeness</b> — the bible specifies badges as "roundel + ribbon" and not one of them has either. They are bare pictograms. On a profile card next to the UI pictograms, nothing about them says <i>award</i>.<br><br>
<b>Three fail contrast:</b> Iron Saver (locked), Steady Hand (locked) and Week Warrior (removed) all use <code>#4B5A56</code> — <b>2.32:1</b> against the card they sit on, 2.61:1 against the page ground, below the 3:1 bar the gate enforces. <b>One fails palette:</b> the Golden Crown uses <code>#E8C14A</code>, which is the UI token <code>--gold</code>, not a pack colour.<br><br>
<b>And one collision I walked straight into earlier today:</b> Steady Hand is a <b>flag</b> — and the glyph I just shipped for Report / forfeit is also a flag, on the same screen. Bible rule 6 says an action glyph may not duplicate the silhouette of an ownable thing. That rule was written for glyphs and items; it applies here too, and I created the violation with the badge set already in the file.</p>
<p class="lead"><b>Why the grid is the first domino.</b> The bible specifies badges as "roundel + ribbon". At 8×8 there is not enough room for a roundel, a ribbon <i>and</i> something that tells six badges apart — which is exactly why they were drawn as flat stamps instead. The grid did not fail the drawing; it forced it. My earlier 8/12/16 test measured this: at 8×8 a roundel-plus-ribbon consumes the whole tile and leaves <b>zero pixels for an identifying mark</b>.<br><br>
<b>So the rework is three decisions, not one:</b> what grid, what construction (flat stamp vs the bible's roundel + ribbon), and how states are expressed (locked and removed are currently different <i>colours</i> that happen to be too dark, rather than one treatment applied to one drawing).</p>
</body></html>`);
console.log('\npage:  http://localhost:5511/assets-raw/badges-before.html');
console.log('sheet: assets-raw/badges-before.png');
