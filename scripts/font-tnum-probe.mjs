// Does the tabular-figures rule actually work on the two fonts we ship?
// font-variant-numeric: tabular-nums is a no-op unless the font carries a `tnum` GSUB
// feature, and Silkscreen is a pixel font that may be uniform by construction instead.
// Measured with canvas text metrics, which works without a visible window.
const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Silkscreen:wght@400;700&display=swap">
<style>body{background:#0C1211;color:#F3EEDD;font:12px monospace;padding:16px}pre{white-space:pre-wrap}</style>
</head><body><pre id="out">measuring…</pre>
<script>
const FACES = [
  ['Plus Jakarta Sans 700', '700 20px "Plus Jakarta Sans"'],
  ['Plus Jakarta Sans 400', '400 20px "Plus Jakarta Sans"'],
  ['Silkscreen 400',         '400 20px "Silkscreen"'],
  ['Silkscreen 700',         '700 20px "Silkscreen"'],
  ['system-ui (fallback)',   '400 20px system-ui'],
];
const DIGITS = '0123456789';
function measure(font, text, variant) {
  const c = document.createElement('canvas');
  const x = c.getContext('2d');
  x.font = font;
  if (variant) { try { x.letterSpacing = variant; } catch (e) {} }
  return x.measureText(text).width;
}
function widths(font) {
  const c = document.createElement('canvas');
  const x = c.getContext('2d');
  x.font = font;
  return [...DIGITS].map((d) => +x.measureText(d).width.toFixed(3));
}
(async () => {
  // wait for the webfonts so we are not measuring a fallback
  try {
    await document.fonts.ready;
    await Promise.all([
      document.fonts.load('700 20px "Plus Jakarta Sans"'),
      document.fonts.load('400 20px "Plus Jakarta Sans"'),
      document.fonts.load('400 20px "Silkscreen"'),
      document.fonts.load('700 20px "Silkscreen"'),
    ]);
    await document.fonts.ready;
  } catch (e) {}
  const lines = [];
  lines.push('loaded?  Plus Jakarta Sans: ' + document.fonts.check('700 20px "Plus Jakarta Sans"')
                  + '   Silkscreen: ' + document.fonts.check('400 20px "Silkscreen"'));
  lines.push('');
  lines.push('face                      sum(digits)  string   delta   distinct  tabular?');
  for (const [name, font] of FACES) {
    const w = widths(font);
    const sum = w.reduce((a, b) => a + b, 0);
    const str = measure(font, DIGITS);
    const distinct = new Set(w.map((v) => v.toFixed(2))).size;
    const uniform = distinct === 1;
    const tabularByFeature = Math.abs(sum - str) < 0.01 && !uniform;
    lines.push(
      name.padEnd(25)
      + String(sum.toFixed(2)).padStart(9)
      + String(str.toFixed(2)).padStart(9)
      + String((sum - str).toFixed(2)).padStart(8)
      + String(distinct).padStart(10)
      + '   ' + (uniform ? 'MONOSPACE-ish (all digits equal width)'
               : tabularByFeature ? 'kerned but equal advance'
               : 'PROPORTIONAL — digits differ in width')
    );
  }
  lines.push('');
  lines.push('Now: does font-variant-numeric actually change anything?');
  // canvas cannot set font-variant-numeric, so probe with DOM instead
  for (const [name, font] of FACES.slice(0, 4)) {
    const mk = (variant) => {
      const s = document.createElement('span');
      s.style.cssText = 'font:' + font + ';position:absolute;left:-9999px;white-space:pre;font-variant-numeric:' + variant;
      s.textContent = DIGITS;
      document.body.appendChild(s);
      const w = s.getBoundingClientRect().width;
      s.remove();
      return w;
    };
    const normal = mk('normal');
    const tnum = mk('tabular-nums');
    lines.push('  ' + name.padEnd(24) + ' normal ' + normal.toFixed(2)
      + '  tabular-nums ' + tnum.toFixed(2)
      + '  delta ' + (tnum - normal).toFixed(2)
      + (Math.abs(tnum - normal) < 0.05 ? '   -> tnum does NOTHING (no feature, or already uniform)' : '   -> tnum CHANGES metrics (feature present)'));
  }
  document.getElementById('out').textContent = lines.join(String.fromCharCode(10));
})();
</script></body></html>`;
import fs from 'node:fs';
fs.writeFileSync('assets-raw/font-tnum-probe.html', html);
console.log('wrote assets-raw/font-tnum-probe.html');
