// Compare document structure before/after the character ship. Tag balance and the id
// inventory are the regression net for the class of bug where a splice eats a closing tag
// and the browser silently swallows the following markup into an <svg>.
import fs from 'node:fs';
const now = fs.readFileSync('Savborne-handoff.html', 'utf8');
const was = fs.readFileSync('assets-raw/handoff-before-chars.html', 'utf8');
const count = (s, re) => (s.match(re) || []).length;
const tags = ['div', 'svg', 'figure', 'section', 'p', 'span', 'code', 'figcaption'];
console.log('tag           before open/close   after open/close');
for (const t of tags) {
  const bo = count(was, new RegExp(`<${t}\\b`, 'g')), bc = count(was, new RegExp(`</${t}>`, 'g'));
  const ao = count(now, new RegExp(`<${t}\\b`, 'g')), ac = count(now, new RegExp(`</${t}>`, 'g'));
  const mark = ao === ac ? '' : '   *** UNBALANCED ***';
  console.log(`${t.padEnd(12)} ${String(bo).padStart(4)}/${String(bc).padStart(4)}        ${String(ao).padStart(4)}/${String(ac).padStart(4)}   delta ${String(ao - bo).padStart(3)}/${String(ac - bc).padStart(3)}${mark}`);
}
const ids = (s) => [...s.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
const a = ids(was), b = ids(now);
const missing = a.filter((x) => !b.includes(x)), added = b.filter((x) => !a.includes(x));
console.log(`\nids: ${a.length} before, ${b.length} after`);
console.log('missing after:', missing.length ? missing.join(', ') : 'none');
console.log('added after  :', added.length ? added.join(', ') : 'none');
// every screen figure must still be reachable, and every .spr must sit inside a 1:1 wrapper
const wraps = [...now.matchAll(/<div[^>]*aria-label="([^"]*)"[^>]*width:\s*(\d+)px;\s*height:\s*(\d+)px[^>]*>\s*<svg class="spr"/g)];
const bad = wraps.filter((m) => m[2] !== m[3]);
console.log(`\n.spr wrappers found: ${wraps.length}, non-square: ${bad.length}${bad.length ? ' -> ' + bad.map((m) => m[1]).join(' | ') : ''}`);
const vb = [...now.matchAll(/<svg class="spr"[^>]*viewBox="([^"]+)"/g)].map((m) => m[1]);
console.log(`.spr viewBoxes: ${[...new Set(vb)].join(', ')} (${vb.length} svgs)`);
