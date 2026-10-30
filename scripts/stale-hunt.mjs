// Find every svg still using OLD round-2 art colors or 8x8/12x12 grids, with its screen context
import fs from 'node:fs';
const c = fs.readFileSync('Savborne-handoff.html', 'utf8');
const OLD = ['#D9A066', '#8A5A2B', '#E08A5B', '#C9D3DC', '#7A8B94', '#E8C14A', '#9A7420'];
// screen boundaries
const marks = [...c.matchAll(/<figure class="scr" id="([^"]+)"|<h2 id="([^"]+)"|<h3[^>]*>([^<]+)<\/h3>/g)]
  .map((m) => ({ i: m.index, name: m[1] || m[2] || m[3] }));
function ctx(idx) {
  let cur = 'header/styles';
  for (const m of marks) { if (m.i < idx) cur = m.name; else break; }
  return cur;
}
const rows = [];
for (const m of c.matchAll(/<svg\b[^>]*>[\s\S]*?<\/svg>/g)) {
  const tag = m[0];
  const vb = (tag.match(/viewBox="([^"]+)"/) || [])[1] || '?';
  const label = (tag.match(/aria-label="([^"]+)"/) || [])[1] || (tag.match(/<code>([^<]+)<\/code>/) || [])[1] || '';
  const old = OLD.filter((o) => tag.includes(o));
  const isArt = /0 0 (8 8|12 12|16 24)/.test(vb) || old.length;
  if (!isArt) continue;
  rows.push(`${ctx(m.index).padEnd(18)} vb=${vb.padEnd(11)} ${old.length ? 'OLD-COLORS: ' + old.join(',') : 'grid-only'}  ${label.slice(0, 34)}`);
}
console.log(rows.join('\n'));
console.log(`\ntotal suspect svgs: ${rows.length}`);
