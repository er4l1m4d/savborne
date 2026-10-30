// Does the SHIPPED glyph encoding match what the browser renders from the original SVG?
// glyphs-24.mjs ran one even-odd pass over every ring of every <path>. SVG fills each
// <path> independently and unions them, so for a multi-path icon a second path can have
// carved a hole instead of adding mass. Four shipped glyphs are multi-path.
// This rasterises both versions to a canvas and diffs them pixel by pixel.
import fs from 'node:fs';

const SRC = 'node_modules/pixelarticons/svg';
const G = JSON.parse(fs.readFileSync('assets/glyphs.json', 'utf8'));
// glyph key -> source icon file. `source` reads "pixelarticons:chevron-left (MIT)"
// and `paths` is already-built <path> markup, not an array.
const srcOf = (k) => (G[k].source || '').match(/pixelarticons:([a-z0-9-]+)/)?.[1];

const rows = [];
for (const k of Object.keys(G)) {
  const enc = G[k].paths;
  const s = srcOf(k);
  if (!s) { rows.push({ k, s: '(no source)', multi: 1, src: '', enc }); continue; }
  const raw = fs.readFileSync(`${SRC}/${s}.svg`, 'utf8');
  const ds = [...raw.matchAll(/d="([^"]*)"/g)].map((m) => m[1]);
  rows.push({ k, s, multi: ds.length, src: ds.map((d) => `<path d="${d}"/>`).join(''), enc });
}

const html = `<!doctype html><html><head><meta charset="utf-8"><title>glyph fill-rule diff</title></head><body>
<pre id="out">running</pre>
<div id="stage" style="position:absolute;left:-9999px"></div>
<script>
const ROWS = ${JSON.stringify(rows)};
const PX = 24;
function toCanvas(svgMarkup, kind) {
  return new Promise((res) => {
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = PX; c.height = PX;
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = false;
      x.drawImage(img, 0, 0, PX, PX);
      const d = x.getImageData(0, 0, PX, PX).data;
      const on = [];
      for (let i = 0; i < PX * PX; i++) on.push(d[i * 4 + 3] > 128 ? 1 : 0);
      URL.revokeObjectURL(url);
      res(on);
    };
    img.onerror = () => { URL.revokeObjectURL(url); res(null); };
    img.src = url;
  });
}
const wrap = (inner) => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="#000">' + inner + '</g></svg>';

(async () => {
  const lines = [];
  let bad = 0;
  for (const r of ROWS) {
    if (!r.src) { lines.push(r.k.padEnd(10) + ' ' + r.s.padEnd(14) + ' skipped — hand-drawn, no source to compare'); continue; }
    const orig = await toCanvas(wrap(r.src));
    const mine = await toCanvas(wrap(r.enc));
    if (!orig || !mine) { lines.push(r.k.padEnd(10) + ' ' + r.s.padEnd(14) + ' RASTER FAILED'); continue; }
    let diff = 0, missing = 0, extra = 0;
    for (let i = 0; i < PX * PX; i++) { if (orig[i] !== mine[i]) { diff++; if (orig[i] && !mine[i]) missing++; else extra++; } }
    const oCount = orig.reduce((a, b) => a + b, 0), mCount = mine.reduce((a, b) => a + b, 0);
    if (diff) bad++;
    lines.push(
      r.k.padEnd(10) + ' ' + r.s.padEnd(14) + ' paths=' + r.multi +
      '  orig=' + String(oCount).padStart(4) + ' mine=' + String(mCount).padStart(4) +
      '  diff=' + String(diff).padStart(4) + '  (holes in mine=' + missing + ', extra=' + extra + ')' +
      (diff === 0 ? '   MATCH' : '   *** MISMATCH ***')
    );
  }
  document.getElementById('out').textContent = lines.join('\\n') + '\\n\\n' + bad + ' of ' + ROWS.length + ' glyphs differ from the browser render';
})();
</script></body></html>`;
fs.writeFileSync('assets-raw/glyph-diff.html', html);
console.log('open http://localhost:5511/assets-raw/glyph-diff.html and read the <pre>');
console.log('glyphs checked:', rows.length);
