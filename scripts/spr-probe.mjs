// Print the container markup around each .spr slot: the sprite is absolutely positioned
// and stretched to its parent, so the parent's size is what actually governs the render.
import fs from 'node:fs';
const h = fs.readFileSync('Savborne-handoff.html', 'utf8');
const owners = [...h.matchAll(/<(?:section|figure|div)\b[^>]*\bid="([^"]+)"[^>]*>/g)].map((m) => ({ id: m[1], at: m.index }));
const ownerAt = (idx) => (owners.filter((o) => o.at < idx).pop() || { id: '(none)' }).id;
let i = 0;
for (const m of h.matchAll(/<svg\b[^>]*class="spr"[^>]*>/g)) {
  i++;
  const at = m.index;
  const el = h.slice(at, h.indexOf('</svg>', at) + 6);
  const before = h.slice(Math.max(0, at - 400), at).replace(/\s+/g, ' ');
  const after = h.slice(h.indexOf('</svg>', at), h.indexOf('</svg>', at) + 260).replace(/\s+/g, ' ');
  console.log(`--- .spr #${i}  L${h.slice(0, at).split('\n').length}  [${ownerAt(at)}]  ${el.length}B  vb=${(el.match(/viewBox="([^"]*)"/) || [])[1]}`);
  console.log(`  PARENT …${before.slice(-200)}`);
  console.log(`  AFTER  ${after.slice(0, 200)}\n`);
}
console.log('total .spr slots:', i);
