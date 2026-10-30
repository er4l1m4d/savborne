// Inventory every sprite slot in the handoff: attributes, owning screen, surrounding markup.
// The old sprite art is 16x24 and the new art is 16x16, so the shipper needs to know what
// each slot actually depicts and how it is sized before anything is replaced.
import fs from 'node:fs';
const h = fs.readFileSync('Savborne-handoff.html', 'utf8');

// Screen/section ownership: figures carry id="A_..." or similar; walk backwards for the nearest.
const owners = [...h.matchAll(/<(?:section|figure|div)\b[^>]*\bid="([^"]+)"[^>]*>/g)].map((m) => ({ id: m[1], at: m.index }));
const ownerAt = (idx) => { const prev = owners.filter((o) => o.at < idx).pop(); return prev ? prev.id : '(none)'; };

// Every svg whose viewBox is a sprite shape (16x24 old art, 16x16 new art)
const rows = [];
for (const m of h.matchAll(/<svg\b[^>]*viewBox="0 0 16 (16|24)"[^>]*>/g)) {
  const tag = m[0];
  const at = m.index;
  const attr = (n) => (tag.match(new RegExp(`${n}="([^"]*)"`)) || [, ''])[1];
  const h2 = attr('height'), w2 = attr('width');
  if (!(attr('viewBox') === '0 0 16 24' || (attr('viewBox') === '0 0 16 16' && Number(h2) >= 32))) continue;
  const before = h.slice(Math.max(0, at - 320), at);
  const after = h.slice(at + tag.length, at + tag.length + 160);
  const el = h.slice(at, h.indexOf('</svg>', at) + 6);
  rows.push({
    line: h.slice(0, at).split('\n').length,
    owner: ownerAt(at),
    viewBox: attr('viewBox'),
    w: w2, h: h2,
    label: attr('aria-label'),
    cls: attr('class'),
    style: attr('style'),
    parentTail: before.replace(/\s+/g, ' ').slice(-90),
    afterHead: after.replace(/\s+/g, ' ').slice(0, 70),
    paths: (el.match(/<path/g) || []).length,
    colors: [...new Set((el.match(/fill="([^"]+)"/g) || []))].length,
    len: el.length,
  });
}
console.log(`${rows.length} sprite-sized svgs\n`);
for (const r of rows) {
  console.log(`L${r.line} [${r.owner}] vb=${r.viewBox} ${r.w}x${r.h} label="${r.label}" class="${r.cls}" style="${r.style}" paths=${r.paths} colors=${r.colors} bytes=${r.len}`);
  console.log(`   before: …${r.parentTail}`);
  console.log(`   after : ${r.afterHead}…\n`);
}
